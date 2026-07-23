"""Walk-forward 回测引擎 —— 组合算法的验证器。

设计动机（docs/research-robo-advisor.md §3）：方法无免费午餐、优劣依市场/时段而定，
必须在自有股票池上横评各算法，用真实业绩曲线选型，而非套用外部论文结论。

做法：
- 按再平衡频率（月/季）切分时间轴；
- 每个再平衡点，用**此前** lookback_window 天的数据求解目标权重（不使用未来数据）；
- 持有到下个再平衡点，按日累计组合收益，扣除换手交易成本；
- 输出 NAV 曲线与指标（总收益/CAGR/年化波动/夏普/最大回撤）。
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from app.services.portfolio.optimizer import optimize

TRADING_DAYS = 252
_FREQ = {"M": "MS", "Q": "QS", "W": "W-MON"}  # 月初/季初/每周一再平衡


@dataclass
class BacktestMetrics:
    total_return: float
    cagr: float
    annual_volatility: float
    sharpe_ratio: float
    max_drawdown: float
    n_rebalances: int

    def to_dict(self) -> dict:
        return {
            "total_return": round(self.total_return, 4),
            "cagr": round(self.cagr, 4),
            "annual_volatility": round(self.annual_volatility, 4),
            "sharpe_ratio": round(self.sharpe_ratio, 4),
            "max_drawdown": round(self.max_drawdown, 4),
            "n_rebalances": self.n_rebalances,
        }


@dataclass
class BacktestResult:
    method: str
    nav: pd.Series
    metrics: BacktestMetrics

    def to_dict(self, nav_points: int = 250) -> dict:
        # 下采样 NAV 以控制响应大小
        nav = self.nav
        if len(nav) > nav_points:
            step = len(nav) // nav_points
            nav = nav.iloc[::step]
        return {
            "method": self.method,
            "metrics": self.metrics.to_dict(),
            "nav": [
                {"date": d.date().isoformat(), "value": round(float(v), 2)}
                for d, v in nav.items()
            ],
        }


def _metrics(nav: pd.Series, daily_ret: pd.Series, n_rebalances: int) -> BacktestMetrics:
    total_return = float(nav.iloc[-1] / nav.iloc[0] - 1)
    n = len(nav)
    years = n / TRADING_DAYS
    cagr = float((nav.iloc[-1] / nav.iloc[0]) ** (1 / years) - 1) if years > 0 else 0.0
    ann_vol = float(daily_ret.std() * np.sqrt(TRADING_DAYS))
    sharpe = cagr / ann_vol if ann_vol > 0 else 0.0
    drawdown = nav / nav.cummax() - 1.0
    max_dd = float(drawdown.min())
    return BacktestMetrics(total_return, cagr, ann_vol, sharpe, max_dd, n_rebalances)


def backtest(
    prices: pd.DataFrame,
    method: str = "hrp",
    rebalance: str = "M",
    lookback_window: int = 126,
    initial: float = 100_000.0,
    cost_bps: float = 5.0,
    weight_bounds: tuple[float, float] = (0.0, 1.0),
) -> BacktestResult:
    """对给定价格矩阵做 walk-forward 回测。

    prices: 行=日期，列=标的，值=调整后收盘价。
    cost_bps: 单边换手交易成本（基点）。
    """
    if rebalance not in _FREQ:
        raise ValueError(f"rebalance 须为 {list(_FREQ)} 之一")
    prices = prices.dropna()
    if len(prices) <= lookback_window + 5:
        raise ValueError("历史数据长度不足以覆盖 lookback_window")

    daily_rets = prices.pct_change().fillna(0.0)
    rebal_dates = pd.date_range(
        prices.index[lookback_window], prices.index[-1], freq=_FREQ[rebalance]
    )
    rebal_dates = [d for d in rebal_dates if d in prices.index or True]

    nav = pd.Series(index=prices.index[lookback_window:], dtype="float64")
    value = initial
    weights: dict[str, float] = {}
    prev_weights: dict[str, float] = {}
    n_rebal = 0
    cost_rate = cost_bps / 10_000.0

    rebal_set = set(pd.DatetimeIndex(rebal_dates).normalize())

    for i, day in enumerate(prices.index[lookback_window:]):
        # 到再平衡点：用过去 lookback_window 天重算权重
        if pd.Timestamp(day).normalize() in rebal_set or not weights:
            window = prices.loc[:day].iloc[-lookback_window:]
            try:
                weights = optimize(window, method, weight_bounds).weights
            except Exception:
                weights = prev_weights or {
                    c: 1 / prices.shape[1] for c in prices.columns
                }
            # 换手成本
            turnover = sum(
                abs(weights.get(c, 0) - prev_weights.get(c, 0))
                for c in set(weights) | set(prev_weights)
            )
            value *= 1 - turnover * cost_rate
            prev_weights = weights
            n_rebal += 1

        # 当日组合收益
        r = sum(weights.get(c, 0) * daily_rets.loc[day, c] for c in weights)
        value *= 1 + r
        nav.loc[day] = value

    port_ret = nav.pct_change().fillna(0.0)
    return BacktestResult(method, nav, _metrics(nav, port_ret, n_rebal))


def compare(
    prices: pd.DataFrame, methods: list[str], **kwargs
) -> list[BacktestResult]:
    """横评多个方法（算法验证器核心用法）。"""
    results = []
    for m in methods:
        try:
            results.append(backtest(prices, m, **kwargs))
        except Exception:
            continue
    # 按夏普降序
    return sorted(results, key=lambda r: r.metrics.sharpe_ratio, reverse=True)
