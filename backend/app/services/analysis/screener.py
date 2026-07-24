"""进攻型成长筛选器 —— 找高弹性/强动量候选，明确标注上行与下行。

立场：帮你**发现并评估**高上行标的，不承诺命中。每个候选都同时给出上行信号
（动量/突破/创新高）与下行风险（波动/最大回撤），让你在看清风险的前提下进攻。
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from app.services.analysis.technical import (
    annualized_vol,
    classify_trend,
    max_drawdown,
    momentum,
)


@dataclass
class GrowthCandidate:
    symbol: str
    score: float
    momentum_3m: float
    momentum_6m: float
    momentum_12m: float
    near_52w_high: float          # 现价 / 52 周高点，越接近 1 越强
    breakout: bool                # 是否突破近 60 日高点
    trend: str
    annualized_vol: float         # 下行风险指标之一
    max_drawdown: float           # 历史最大回撤（提醒潜在亏损幅度）

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "score": round(self.score, 4),
            "momentum": {
                "3m": _r(self.momentum_3m),
                "6m": _r(self.momentum_6m),
                "12m": _r(self.momentum_12m),
            },
            "near_52w_high": round(self.near_52w_high, 4),
            "breakout": self.breakout,
            "trend": self.trend,
            "risk": {
                "annualized_vol": round(self.annualized_vol, 4),
                "max_drawdown": round(self.max_drawdown, 4),
            },
        }


def _r(x: float) -> float | None:
    return round(x, 4) if x == x else None


def _near_52w_high(prices: pd.Series) -> float:
    window = prices.iloc[-252:] if len(prices) >= 252 else prices
    hi = float(window.max())
    return float(prices.iloc[-1] / hi) if hi > 0 else 0.0


def _breakout(prices: pd.Series, lookback: int = 60) -> bool:
    if len(prices) < lookback + 1:
        return False
    prior_high = float(prices.iloc[-lookback - 1 : -1].max())
    return float(prices.iloc[-1]) > prior_high


def growth_score(prices: pd.Series) -> float:
    """短线进攻评分：动量为主 + 突破/创新高加成。适合『追强势』。

    评分刻画『当前上行强度』，不预测未来；高分标的通常也高波动（见 risk 字段）。
    """
    prices = prices.dropna()
    if len(prices) < 130:
        return float("nan")
    m3 = momentum(prices, 63) or 0.0
    m6 = momentum(prices, 126) or 0.0
    m12 = momentum(prices, 252) if len(prices) > 252 else m6
    near = _near_52w_high(prices)
    brk = 1.0 if _breakout(prices) else 0.0
    return 0.25 * m3 + 0.35 * m6 + 0.20 * m12 + 0.15 * (near - 1) + 0.05 * brk


def multibagger_score(prices: pd.Series) -> float:
    """猎多倍股评分 —— 基于 464 只 10 倍股实证（docs/research-high-return.md §3）。

    与短线相反：多倍股在 3/6 月动量上负载荷、越贴近 52 周高点越跑输。
    故此评分**奖励远离高点**、**弱化/反转短动量**，保留温和的中长期趋势。
    注：最强预测因子是高 FCF yield，需基本面数据源接入（当前用价格无法计算，留待接入）。
    """
    prices = prices.dropna()
    if len(prices) < 130:
        return float("nan")
    m3 = momentum(prices, 63) or 0.0
    m6 = momentum(prices, 126) or 0.0
    m12 = momentum(prices, 252) if len(prices) > 252 else m6
    near = _near_52w_high(prices)
    # 反转短动量与 near-high：远离高点(1-near)得分高；轻度参考 12 月趋势
    return -0.20 * m3 - 0.15 * m6 + 0.15 * m12 + 0.50 * (1.0 - near)


def screen(
    price_map: dict[str, pd.Series], top_k: int = 10, mode: str = "momentum"
) -> list[GrowthCandidate]:
    """对候选池打分排名，返回进攻型候选（附下行风险）。

    mode: "momentum"（短线追强势）| "multibagger"（猎多倍股，反转 near-high 权重）。
    """
    scorer = multibagger_score if mode == "multibagger" else growth_score
    out: list[GrowthCandidate] = []
    for sym, prices in price_map.items():
        prices = prices.dropna()
        s = scorer(prices)
        if s != s:  # NaN
            continue
        out.append(
            GrowthCandidate(
                symbol=sym,
                score=s,
                momentum_3m=momentum(prices, 63),
                momentum_6m=momentum(prices, 126),
                momentum_12m=momentum(prices, 252) if len(prices) > 252 else float("nan"),
                near_52w_high=_near_52w_high(prices),
                breakout=_breakout(prices),
                trend=classify_trend(prices)["direction"],
                annualized_vol=annualized_vol(prices),
                max_drawdown=max_drawdown(prices),
            )
        )
    out.sort(key=lambda c: c.score, reverse=True)
    return out[:top_k]
