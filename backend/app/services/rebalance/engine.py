"""再平衡引擎（P6）。

阈值触发（docs/research-robo-advisor.md §3）：当任一标的当前权重相对目标权重的
偏离超过阈值时，触发再平衡；否则不动，以节省交易成本与税负。
"""

from __future__ import annotations

from dataclasses import dataclass

from app.services.trading.execution import ExecutionPlan, build_execution_plan


@dataclass
class DriftItem:
    symbol: str
    current_weight: float
    target_weight: float

    @property
    def drift(self) -> float:
        return self.current_weight - self.target_weight


@dataclass
class RebalanceDecision:
    should_rebalance: bool
    max_drift: float
    threshold: float
    drifts: list[DriftItem]
    plan: ExecutionPlan | None = None

    def to_dict(self) -> dict:
        return {
            "should_rebalance": self.should_rebalance,
            "max_drift": round(self.max_drift, 4),
            "threshold": self.threshold,
            "drifts": [
                {
                    "symbol": d.symbol,
                    "current_weight": round(d.current_weight, 4),
                    "target_weight": round(d.target_weight, 4),
                    "drift": round(d.drift, 4),
                }
                for d in self.drifts
            ],
            "plan": self.plan.to_dict() if self.plan else None,
        }


def current_weights(
    shares: dict[str, float], prices: dict[str, float]
) -> tuple[dict[str, float], float]:
    values = {s: shares.get(s, 0.0) * prices.get(s, 0.0) for s in shares}
    total = sum(values.values())
    if total <= 0:
        return {s: 0.0 for s in shares}, 0.0
    return {s: v / total for s, v in values.items()}, total


def evaluate(
    target_weights: dict[str, float],
    shares: dict[str, float],
    prices: dict[str, float],
    threshold: float = 0.05,
) -> RebalanceDecision:
    """评估是否需要再平衡，并在需要时给出执行计划。"""
    cur_w, total_value = current_weights(shares, prices)
    all_syms = set(target_weights) | set(cur_w)
    drifts = [
        DriftItem(s, cur_w.get(s, 0.0), target_weights.get(s, 0.0)) for s in sorted(all_syms)
    ]
    max_drift = max((abs(d.drift) for d in drifts), default=0.0)
    should = max_drift > threshold

    plan = None
    if should and total_value > 0:
        plan = build_execution_plan(
            target_weights, prices, total_value, current_shares=shares
        )
    return RebalanceDecision(should, max_drift, threshold, drifts, plan)
