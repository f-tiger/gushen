"""组合优化引擎 —— 本项目技术核心。

设计原则（见 docs/research-robo-advisor.md §2、§3）：
- **不裸用历史均值方差**（对输入敏感、易出极端权重）。默认走 HRP / 风险平价，
  或用 Ledoit-Wolf 协方差收缩 + 约束的均值方差。
- **不预设最优算法**：提供多方法，由上层的回测/模拟验证在自有股票池上横评选型。

依赖：
- 纯 numpy 实现（equal_weight / inverse_vol）——无需重依赖，永远可用。
- PyPortfolioOpt（hrp / min_volatility / max_sharpe）——按需导入，缺失时报错但不影响前两者。
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

# 交给确定性算法的方法白名单
# momentum 为进攻型：向强动量标的集中加权（高上行、也高下行）
METHODS = ["hrp", "inverse_vol", "min_volatility", "max_sharpe", "equal_weight", "momentum"]

TRADING_DAYS = 252


@dataclass
class OptimizeResult:
    method: str
    weights: dict[str, float]
    expected_annual_return: float
    annual_volatility: float
    sharpe_ratio: float

    def to_dict(self) -> dict:
        return {
            "method": self.method,
            "weights": self.weights,
            "expected_annual_return": round(self.expected_annual_return, 4),
            "annual_volatility": round(self.annual_volatility, 4),
            "sharpe_ratio": round(self.sharpe_ratio, 4),
        }


def _clean(weights: dict[str, float], cutoff: float = 1e-4) -> dict[str, float]:
    """丢弃极小权重并归一化。"""
    w = {k: float(v) for k, v in weights.items() if abs(float(v)) > cutoff}
    total = sum(w.values())
    if total <= 0:
        n = len(weights)
        return {k: round(1 / n, 4) for k in weights}
    return {k: round(v / total, 4) for k, v in w.items()}


def _performance(
    weights: dict[str, float], prices: pd.DataFrame, risk_free: float = 0.0
) -> tuple[float, float, float]:
    """用历史数据估算组合的年化收益/波动/夏普（仅供参考，非预测）。"""
    returns = prices[list(weights)].pct_change().dropna()
    w = np.array([weights[c] for c in weights])
    mean_daily = returns.mean().to_numpy()
    cov_daily = returns.cov().to_numpy()
    ann_ret = float(np.dot(w, mean_daily) * TRADING_DAYS)
    ann_vol = float(np.sqrt(w @ cov_daily @ w) * np.sqrt(TRADING_DAYS))
    sharpe = (ann_ret - risk_free) / ann_vol if ann_vol > 0 else 0.0
    return ann_ret, ann_vol, sharpe


def _equal_weight(prices: pd.DataFrame) -> dict[str, float]:
    cols = list(prices.columns)
    return {c: 1 / len(cols) for c in cols}


def _momentum(prices: pd.DataFrame, lookback: int = 126, top_k: int = 3) -> dict[str, float]:
    """进攻型动量集中：只保留动量最强的 top_k 个标的，按正动量加权。

    ⚠️ 高集中 = 高上行也高下行。这是进攻策略，不是稳健配置。
    """
    if len(prices) <= lookback:
        return _equal_weight(prices)
    mom = prices.iloc[-1] / prices.iloc[-1 - lookback] - 1.0
    mom = mom.clip(lower=0.0)  # 负动量不配
    winners = mom.sort_values(ascending=False).head(max(1, min(top_k, prices.shape[1])))
    total = winners.sum()
    if total <= 0:
        return _equal_weight(prices)
    return {sym: float(winners.get(sym, 0.0) / total) for sym in prices.columns}


def _inverse_vol(prices: pd.DataFrame) -> dict[str, float]:
    """逆波动率加权 —— 风险平价的轻量近似，纯 numpy，无需 cvxpy。"""
    returns = prices.pct_change().dropna()
    vol = returns.std().replace(0, np.nan)
    inv = 1.0 / vol
    inv = inv.fillna(0.0)
    total = inv.sum()
    if total <= 0:
        return _equal_weight(prices)
    return {c: float(inv[c] / total) for c in prices.columns}


def optimize(
    prices: pd.DataFrame,
    method: str = "hrp",
    weight_bounds: tuple[float, float] = (0.0, 1.0),
    risk_free: float = 0.0,
) -> OptimizeResult:
    """对给定价格矩阵求解目标权重。

    prices: 行=日期，列=标的，值=调整后收盘价。
    """
    if method not in METHODS:
        raise ValueError(f"未知方法 {method}，可选：{METHODS}")
    if prices.shape[1] < 2:
        raise ValueError("组合至少需要 2 个标的")

    prices = prices.dropna(axis=1, how="all").dropna()

    if method == "equal_weight":
        raw = _equal_weight(prices)
    elif method == "inverse_vol":
        raw = _inverse_vol(prices)
    elif method == "momentum":
        raw = _momentum(prices)
    else:
        raw = _pypfopt_optimize(prices, method, weight_bounds)

    weights = _clean(raw)
    ann_ret, ann_vol, sharpe = _performance(weights, prices, risk_free)
    return OptimizeResult(method, weights, ann_ret, ann_vol, sharpe)


def _pypfopt_optimize(
    prices: pd.DataFrame, method: str, weight_bounds: tuple[float, float]
) -> dict[str, float]:
    """需要 PyPortfolioOpt 的方法：hrp / min_volatility / max_sharpe。

    均值方差类统一使用 Ledoit-Wolf 协方差收缩以稳健化。
    """
    from pypfopt import expected_returns, risk_models
    from pypfopt.efficient_frontier import EfficientFrontier
    from pypfopt.hierarchical_portfolio import HRPOpt

    if method == "hrp":
        returns = prices.pct_change().dropna()
        hrp = HRPOpt(returns)
        hrp.optimize()
        return dict(hrp.clean_weights())

    # 均值方差族：协方差收缩（Ledoit-Wolf）
    mu = expected_returns.mean_historical_return(prices)
    S = risk_models.CovarianceShrinkage(prices).ledoit_wolf()
    ef = EfficientFrontier(mu, S, weight_bounds=weight_bounds)
    if method == "min_volatility":
        ef.min_volatility()
    elif method == "max_sharpe":
        ef.max_sharpe()
    return dict(ef.clean_weights())
