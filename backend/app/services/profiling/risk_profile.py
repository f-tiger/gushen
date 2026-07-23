"""风险画像 —— 确定性映射（可审计）。

分层原则（docs/architecture.md §3.1）：
- LLM 只负责**结构化访谈**，把自然语言对话转成下面这套结构化答案；
- **评分与配置映射是确定性的**，不交给 LLM，保证可复算、可审计。

MVP 用一份简单问卷；后续可由 LLM 访谈产出同样结构的 answers 再喂入本函数。
"""

from __future__ import annotations

from dataclasses import dataclass

# 每题：answer 值域 0..3（越大越激进），权重相加后归一到 0..100
QUESTIONS = {
    "horizon": "投资期限（0:<1年 .. 3:>10年）",
    "drawdown_tolerance": "能承受的最大回撤（0:<5% .. 3:>30%）",
    "experience": "投资经验（0:无 .. 3:丰富）",
    "income_stability": "收入稳定性（0:不稳定 .. 3:很稳定）",
    "goal": "目标（0:保本 .. 3:激进增值）",
}

# level 档位与推荐默认方法/权重上限
_LEVELS = [
    (0, 20, "conservative", "min_volatility", 0.20, 3),
    (20, 40, "moderate_conservative", "hrp", 0.25, 5),
    (40, 60, "moderate", "hrp", 0.30, 8),
    (60, 80, "moderate_aggressive", "inverse_vol", 0.35, 10),
    (80, 101, "aggressive", "max_sharpe", 0.40, 15),
]


@dataclass
class ProfileResult:
    score: int
    level: str
    recommended_method: str
    max_weight: float
    target_horizon_years: int

    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "level": self.level,
            "recommended_method": self.recommended_method,
            "max_weight": self.max_weight,
            "target_horizon_years": self.target_horizon_years,
        }


def score_answers(answers: dict[str, int]) -> ProfileResult:
    """把 0..3 的问卷答案映射为 0..100 分与配置建议。"""
    keys = list(QUESTIONS)
    provided = {k: max(0, min(3, int(answers.get(k, 0)))) for k in keys}
    raw = sum(provided.values())
    score = round(raw / (3 * len(keys)) * 100)

    horizon_map = {0: 1, 1: 3, 2: 7, 3: 15}
    horizon_years = horizon_map[provided["horizon"]]

    for lo, hi, level, method, max_w, _ in _LEVELS:
        if lo <= score < hi:
            return ProfileResult(score, level, method, max_w, horizon_years)
    # 兜底
    return ProfileResult(score, "moderate", "hrp", 0.30, horizon_years)
