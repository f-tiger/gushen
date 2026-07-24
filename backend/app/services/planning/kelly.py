"""分数凯利仓位计算器 —— 博高倍时该押多少才不被打死。

依据 docs/research-high-return.md §5：高波动押注永远别用全凯利；用分数凯利并封顶。
关键诚实点：没有真实 edge（胜率不够）时，凯利会告诉你「别押」——这正是它的价值。
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class KellyResult:
    win_prob: float
    win_multiple: float       # 赢时的收益倍数，如 10x → payoff 9（+900%）
    loss_fraction: float      # 输时损失比例，1.0=全损
    full_kelly: float         # 全凯利建议仓位比例
    fractional_kelly: float   # 分数凯利（更稳）
    capped_fraction: float    # 封顶后的实际建议
    recommended_amount: float
    note: str

    def to_dict(self) -> dict:
        return {
            "win_prob": self.win_prob,
            "win_multiple": self.win_multiple,
            "loss_fraction": self.loss_fraction,
            "full_kelly": round(self.full_kelly, 4),
            "fractional_kelly": round(self.fractional_kelly, 4),
            "capped_fraction": round(self.capped_fraction, 4),
            "recommended_amount": round(self.recommended_amount, 2),
            "note": self.note,
        }


def kelly_fraction(win_prob: float, win_payoff: float, loss_fraction: float = 1.0) -> float:
    """非对称凯利：押注比例 f，赢时财富×(1+f·b)，输时×(1−f·a)。

    win_payoff=b（赢时收益比例，10x→9），loss_fraction=a（输时损失比例，1.0=全损）。
    f* = (p·b − q·a)/(a·b)；≤0 表示无正期望优势，不应押注。
    """
    p = max(0.0, min(1.0, win_prob))
    q = 1.0 - p
    if win_payoff <= 0 or loss_fraction <= 0:
        return 0.0
    f = (p * win_payoff - q * loss_fraction) / (loss_fraction * win_payoff)
    return max(0.0, f)


def size_bet(
    bankroll: float,
    win_prob: float,
    win_multiple: float,
    loss_fraction: float = 1.0,
    kelly_scale: float = 0.25,
    cap: float = 0.10,
) -> KellyResult:
    """给出一次高倍押注的建议仓位（分数凯利 + 硬封顶）。

    win_multiple：目标倍数，如 10 表示 10x。payoff b = win_multiple − 1。
    kelly_scale：分数凯利系数（默认 1/4，稳健）。cap：单注占总资金上限。
    """
    b = win_multiple - 1.0
    full = kelly_fraction(win_prob, b, loss_fraction)
    frac = full * kelly_scale
    capped = min(frac, cap)
    amount = bankroll * capped

    if full <= 0:
        note = (
            f"在胜率 {win_prob:.0%}、目标 {win_multiple:.0f}x 下，凯利判定为「无正期望优势，"
            f"不应押注」——要么你的胜率被高估，要么赔率不够。硬去押=长期走向破产。"
        )
    else:
        note = (
            f"全凯利 {full:.1%}，取 {kelly_scale:.0%} 分数凯利后 {frac:.1%}，"
            f"封顶 {cap:.0%} → 建议单注 {capped:.1%}（¥{amount:,.0f}）。"
            f"分散到多次不相关押注，单注归零不致命。"
        )
    return KellyResult(win_prob, win_multiple, loss_fraction, full, frac, capped, amount, note)
