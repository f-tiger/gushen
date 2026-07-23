"""投研问答 —— 工具接地（tool-grounded）。

关键原则（docs/research.md §3）：现成 LLM 金融任务幻觉率高，**数字必须经工具取回**，
不能让模型凭记忆报价。这里在提问时先用行情源取回相关标的的实时报价作为上下文，
再交给 LLM 组织语言；无 key 时返回取回的数据本身 + 提示。
"""

from __future__ import annotations

import re

from app.services.ai.client import SYSTEM_GUARDRAILS, ai_available, chat
from app.services.market import get_provider

_SYMBOL_RE = re.compile(r"\b[A-Z]{1,5}\b")


def extract_symbols(question: str, hint: list[str] | None = None) -> list[str]:
    """从问题中抽取候选美股代码（大写 1-5 字母），叠加显式 hint。"""
    found = set(hint or [])
    found.update(m for m in _SYMBOL_RE.findall(question))
    # 过滤常见非代码大写词
    stop = {"AI", "US", "USD", "ETF", "IPO", "CEO", "SEC"}
    return [s for s in found if s not in stop][:8]


def fetch_grounding(symbols: list[str]) -> list[dict]:
    """经行情源取回报价，作为回答的事实依据。"""
    provider = get_provider()
    grounded = []
    for sym in symbols:
        try:
            q = provider.get_quote(sym)
            grounded.append({"symbol": q.symbol, "price": q.price, "delayed": q.delayed})
        except Exception:  # noqa: BLE001
            continue
    return grounded


def answer(question: str, symbols: list[str] | None = None) -> dict:
    syms = extract_symbols(question, symbols)
    grounding = fetch_grounding(syms) if syms else []

    if not ai_available():
        return {
            "source": "no_ai",
            "grounding": grounding,
            "answer": "AI 未配置（缺 ANTHROPIC_API_KEY）。以下是经行情源取回的相关数据供参考。"
            "\n以上仅供教育参考，不构成投资建议。",
        }

    context = "\n".join(
        f"- {g['symbol']}: 最新价 {g['price']}{'（延迟）' if g['delayed'] else ''}"
        for g in grounding
    ) or "（无可用行情数据）"
    prompt = (
        f"用户问题：{question}\n\n"
        f"【经行情源取回的事实数据，回答涉及数字时只能引用这些】：\n{context}\n\n"
        "请基于以上数据用通俗语言回答；若数据不足，如实说明，不要编造数字。"
    )
    try:
        text = chat(SYSTEM_GUARDRAILS, prompt)
        return {"source": "ai", "grounding": grounding, "answer": text}
    except Exception:  # noqa: BLE001
        return {
            "source": "error_fallback",
            "grounding": grounding,
            "answer": "AI 调用失败。以上为经行情源取回的数据。仅供教育参考，不构成投资建议。",
        }
