"""技术与趋势分析 —— 多周期指标，辅助决策。

纯函数，输入为按日期升序的收盘价 Series。全部为标准、可复算的技术指标；
不预测未来，只刻画当前状态与趋势，供人工决策参考。
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

TRADING_DAYS = 252


def sma(prices: pd.Series, window: int) -> pd.Series:
    return prices.rolling(window).mean()


def ema(prices: pd.Series, span: int) -> pd.Series:
    return prices.ewm(span=span, adjust=False).mean()


def rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    delta = prices.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - 100 / (1 + rs)


def macd(prices: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> dict:
    macd_line = ema(prices, fast) - ema(prices, slow)
    signal_line = ema(macd_line, signal)
    return {
        "macd": macd_line,
        "signal": signal_line,
        "histogram": macd_line - signal_line,
    }


def momentum(prices: pd.Series, lookback: int) -> float:
    """区间总收益（动量）。"""
    if len(prices) <= lookback:
        return float("nan")
    return float(prices.iloc[-1] / prices.iloc[-1 - lookback] - 1)


def annualized_vol(prices: pd.Series) -> float:
    return float(prices.pct_change().dropna().std() * np.sqrt(TRADING_DAYS))


def max_drawdown(prices: pd.Series) -> float:
    dd = prices / prices.cummax() - 1.0
    return float(dd.min())


def period_returns(prices: pd.Series, rule: str) -> pd.Series:
    """按周('W')/月('ME')重采样的区间收益率。"""
    resampled = prices.resample(rule).last().dropna()
    return resampled.pct_change().dropna()


def classify_trend(prices: pd.Series) -> dict:
    """基于均线的多空/交叉趋势判定。"""
    price = float(prices.iloc[-1])
    s50 = sma(prices, 50)
    s200 = sma(prices, 200)
    ma50 = float(s50.iloc[-1]) if s50.notna().iloc[-1] else None
    ma200 = float(s200.iloc[-1]) if s200.notna().iloc[-1] else None

    if ma50 is None or ma200 is None:
        direction = "insufficient_data"
        cross = None
    else:
        direction = "uptrend" if price > ma50 > ma200 else (
            "downtrend" if price < ma50 < ma200 else "sideways"
        )
        # 金叉/死叉（最近一次 50 与 200 的穿越）
        cross = None
        diff = (s50 - s200).dropna()
        if len(diff) >= 2:
            if diff.iloc[-2] <= 0 < diff.iloc[-1]:
                cross = "golden_cross"
            elif diff.iloc[-2] >= 0 > diff.iloc[-1]:
                cross = "death_cross"
    return {"direction": direction, "cross": cross,
            "price": price, "ma50": ma50, "ma200": ma200}


@dataclass
class TechnicalSummary:
    symbol: str
    last_price: float
    trend: dict
    rsi14: float | None
    momentum: dict
    annualized_vol: float
    max_drawdown: float
    weekly_return_last: float | None
    monthly_return_last: float | None

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "last_price": round(self.last_price, 4),
            "trend": {k: (round(v, 4) if isinstance(v, float) else v)
                      for k, v in self.trend.items()},
            "rsi14": round(self.rsi14, 2) if self.rsi14 is not None else None,
            "momentum": {k: (round(v, 4) if v == v else None)  # NaN -> None
                         for k, v in self.momentum.items()},
            "annualized_vol": round(self.annualized_vol, 4),
            "max_drawdown": round(self.max_drawdown, 4),
            "weekly_return_last": (round(self.weekly_return_last, 4)
                                   if self.weekly_return_last is not None else None),
            "monthly_return_last": (round(self.monthly_return_last, 4)
                                    if self.monthly_return_last is not None else None),
        }


def analyze(symbol: str, prices: pd.Series) -> TechnicalSummary:
    """对单个标的做多周期技术分析汇总。"""
    prices = prices.dropna()
    rsi_series = rsi(prices)
    rsi_last = float(rsi_series.iloc[-1]) if rsi_series.notna().any() else None
    wk = period_returns(prices, "W")
    mo = period_returns(prices, "ME")
    return TechnicalSummary(
        symbol=symbol,
        last_price=float(prices.iloc[-1]),
        trend=classify_trend(prices),
        rsi14=rsi_last,
        momentum={
            "1m": momentum(prices, 21),
            "3m": momentum(prices, 63),
            "6m": momentum(prices, 126),
            "12m": momentum(prices, 252),
        },
        annualized_vol=annualized_vol(prices),
        max_drawdown=max_drawdown(prices),
        weekly_return_last=float(wk.iloc[-1]) if len(wk) else None,
        monthly_return_last=float(mo.iloc[-1]) if len(mo) else None,
    )


def rank_by_momentum(price_map: dict[str, pd.Series], lookback: int = 126) -> list[dict]:
    """按动量对多个标的排名（相对强弱）。"""
    rows = []
    for sym, prices in price_map.items():
        m = momentum(prices.dropna(), lookback)
        if m == m:  # 非 NaN
            rows.append({"symbol": sym, "momentum": round(m, 4)})
    rows.sort(key=lambda r: r["momentum"], reverse=True)
    return rows
