"""目标可行性分析器 —— 诚实地把「收益目标」翻译成所需年化与达成概率。

设计立场：不承诺收益。给定目标与组合的历史 μ/σ，用几何布朗运动（对数正态）
估算达成概率，如实标注目标是否现实。这样激进目标（如 1 年 10 倍）会被清楚地
呈现为极低概率，帮助设定理性预期，而不是被误导。
"""

from __future__ import annotations

import math
from dataclasses import dataclass


def _norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


@dataclass
class GoalAnalysis:
    initial: float
    target: float
    years: float
    required_cagr: float
    prob_success: float
    verdict: str
    median_outcome: float
    p5_outcome: float
    p95_outcome: float
    message: str

    def to_dict(self) -> dict:
        return {
            "initial": round(self.initial, 2),
            "target": round(self.target, 2),
            "years": self.years,
            "required_cagr": round(self.required_cagr, 4),
            "prob_success": round(self.prob_success, 4),
            "verdict": self.verdict,
            "projection": {
                "median": round(self.median_outcome, 2),
                "p5": round(self.p5_outcome, 2),
                "p95": round(self.p95_outcome, 2),
            },
            "message": self.message,
        }


def _classify(required_cagr: float, prob: float) -> str:
    if required_cagr <= 0.12:
        return "realistic"       # 与长期股市回报相当
    if required_cagr <= 0.25:
        return "aggressive"      # 激进但并非天方夜谭
    if required_cagr <= 0.50:
        return "very_aggressive"  # 极激进，需承担大幅回撤风险
    return "unrealistic"          # 基本不可能靠分散投资达成


def analyze_goal(
    initial: float,
    target: float,
    years: float,
    expected_return: float,
    expected_vol: float,
) -> GoalAnalysis:
    """expected_return / expected_vol 为组合年化收益率与波动率（来自回测/优化估算）。"""
    if initial <= 0 or target <= 0 or years <= 0:
        raise ValueError("initial/target/years 必须为正")

    required_cagr = (target / initial) ** (1.0 / years) - 1.0

    # 对数正态：ln(V_T) ~ N(ln(V0)+(mu-0.5*sigma^2)*T, sigma^2*T)
    if expected_vol > 0:
        drift = math.log(initial) + (expected_return - 0.5 * expected_vol**2) * years
        sd = expected_vol * math.sqrt(years)
        z = (math.log(target) - drift) / sd
        prob = 1.0 - _norm_cdf(z)
        median = math.exp(drift)
        p5 = math.exp(drift - 1.645 * sd)
        p95 = math.exp(drift + 1.645 * sd)
    else:
        grown = initial * (1 + expected_return) ** years
        prob = 1.0 if grown >= target else 0.0
        median = p5 = p95 = grown

    verdict = _classify(required_cagr, prob)
    message = _message(required_cagr, prob, verdict, years)
    return GoalAnalysis(initial, target, years, required_cagr, prob,
                        verdict, median, p5, p95, message)


def _message(required_cagr: float, prob: float, verdict: str, years: float) -> str:
    pct = required_cagr * 100
    base = f"达成该目标需要年化约 {pct:.0f}%；按当前组合的历史收益/波动估算，达成概率约 {prob*100:.1f}%。"
    tail = {
        "realistic": "该目标与长期股市回报相当，属可努力实现的范围。",
        "aggressive": "该目标偏激进，需要较高风险敞口，谨慎评估回撤承受力。",
        "very_aggressive": "该目标极其激进，通常伴随大幅回撤甚至重大亏损风险。",
        "unrealistic": (
            "该目标在分散投资框架下基本无法实现——这种量级的年化回报只有极端杠杆/"
            "单一投机才可能短暂博到，期望结果是重大亏损。建议下调目标或拉长期限。"
        ),
    }[verdict]
    return base + tail
