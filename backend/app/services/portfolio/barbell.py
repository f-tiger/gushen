"""杠铃（Barbell）组合构造器 —— 大部分保命 + 一小块凸性进攻。

依据 docs/research-high-return.md §5/§6：拥抱右偏分布的正确姿势——多数资金稳健，
一小块做定义化风险的高凸性押注，单注封顶，任何一注归零都不致命。
"""

from __future__ import annotations

import pandas as pd

from app.services.portfolio.optimizer import optimize


def build_barbell(
    core_prices: pd.DataFrame,
    satellite_prices: pd.DataFrame,
    safe_pct: float = 0.80,
    core_method: str = "min_volatility",
    satellite_method: str = "momentum",
    per_bet_cap: float = 0.10,
) -> dict:
    """构造杠铃组合。

    core：保命端（稳健/低波动），占 safe_pct；
    satellite：进攻端（高动量/高凸性），占 1−safe_pct，单注不超过 per_bet_cap（占总组合）。
    """
    if not 0.0 < safe_pct < 1.0:
        raise ValueError("safe_pct 须在 (0,1)")
    risk_pct = 1.0 - safe_pct

    core = optimize(core_prices, core_method).weights
    sat = optimize(satellite_prices, satellite_method).weights

    weights: dict[str, float] = {s: w * safe_pct for s, w in core.items()}

    # 进攻端按权重缩放到 risk_pct，并对单注封顶（占总组合）
    for s, w in sat.items():
        contrib = min(w * risk_pct, per_bet_cap)
        weights[s] = weights.get(s, 0.0) + contrib

    total = sum(weights.values())
    if total > 0:
        weights = {s: round(w / total, 4) for s, w in weights.items()}

    core_syms = set(core)
    sat_syms = set(sat)
    return {
        "weights": weights,
        "safe_pct": safe_pct,
        "risk_pct": round(risk_pct, 4),
        "core_symbols": sorted(core_syms),
        "satellite_symbols": sorted(sat_syms),
        "per_bet_cap": per_bet_cap,
        "note": (
            f"杠铃：{safe_pct:.0%} 保命核心（{core_method}）+ {risk_pct:.0%} 进攻 sleeve"
            f"（{satellite_method}，单注封顶 {per_bet_cap:.0%}）。进攻端归零不致命，"
            f"右尾一旦命中由凸性放大。"
        ),
    }
