"""组合解读 —— 把确定性算法产出的权重/指标讲成人话。

数字全部入参，LLM 只做表达。无 key 时用确定性模板回退，保证端点始终可用。
"""

from __future__ import annotations

import json

from app.services.ai.client import SYSTEM_GUARDRAILS, ai_available, chat
from app.services.compliance.guard import sanitize

_LEVEL_CN = {
    "conservative": "保守",
    "moderate_conservative": "稳健偏保守",
    "moderate": "稳健",
    "moderate_aggressive": "稳健偏进取",
    "aggressive": "进取",
}


def build_prompt(profile: dict, portfolio: dict) -> str:
    return (
        "请基于以下【已由确定性算法计算好的】数据，向用户解释这个投资组合：\n"
        f"- 风险画像：{json.dumps(profile, ensure_ascii=False)}\n"
        f"- 组合与历史估算指标：{json.dumps(portfolio, ensure_ascii=False)}\n\n"
        "解释要点：为什么这些权重适合该风险档位、分散化的意义、"
        "历史指标怎么读（并强调非未来预测）。不要改动任何数字。"
    )


def fallback_explanation(profile: dict, portfolio: dict) -> str:
    """确定性回退（无需 LLM）。"""
    level = _LEVEL_CN.get(profile.get("level", ""), profile.get("level", ""))
    weights = portfolio.get("weights", {})
    top = sorted(weights.items(), key=lambda kv: kv[1], reverse=True)
    alloc = "、".join(f"{s} {w*100:.0f}%" for s, w in top)
    return (
        f"根据你的风险画像（评分 {profile.get('score')}，档位「{level}」），"
        f"系统用 {portfolio.get('method')} 方法构建了如下组合：{alloc}。\n"
        f"该方法在同类资产间做了分散配置以平衡风险。历史数据估算：年化收益约 "
        f"{portfolio.get('expected_annual_return', 0)*100:.1f}%、波动约 "
        f"{portfolio.get('annual_volatility', 0)*100:.1f}%、夏普 "
        f"{portfolio.get('sharpe_ratio', 0):.2f}——这是对历史的回顾，并非未来预测。\n"
        "以上仅供教育参考，不构成投资建议。"
    )


def explain_portfolio(profile: dict, portfolio: dict) -> dict:
    if ai_available():
        try:
            text = chat(SYSTEM_GUARDRAILS, build_prompt(profile, portfolio))
            return {"source": "ai", "explanation": sanitize(text)}
        except Exception:  # noqa: BLE001 —— 失败回退，端点不崩
            pass
    return {
        "source": "fallback",
        "explanation": sanitize(fallback_explanation(profile, portfolio)),
    }
