"""Claude 客户端封装。

分层铁律（docs/architecture.md §3.1）：LLM 只做语言表达，**绝不做数值计算/报价**。
所有数字由调用方经确定性算法或工具调用取回后传入。

无 ANTHROPIC_API_KEY 时优雅降级：ai_available() 返回 False，上层用确定性回退。
"""

from __future__ import annotations

from app.core.config import settings

# 固定系统约束：所有 AI 表达功能共享
SYSTEM_GUARDRAILS = (
    "你是一个投资者教育助手。严格遵守：\n"
    "1. 你只负责用通俗语言解释与表达，绝不自行计算或编造任何数字（价格、收益、权重等）——"
    "所有数字均来自用户提供的、经确定性算法得出的数据。\n"
    "2. 每次回答都以中立、教育的口吻，不得给出针对个人的买卖指令。\n"
    "3. 结尾附一句免责声明：'以上仅供教育参考，不构成投资建议。'"
)


def ai_available() -> bool:
    return bool(settings.anthropic_api_key)


def chat(system: str, user: str, max_tokens: int = 1024) -> str:
    """调用 Claude；不可用时抛 RuntimeError（由上层降级处理）。"""
    if not ai_available():
        raise RuntimeError("ANTHROPIC_API_KEY 未配置")
    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    resp = client.messages.create(
        model=settings.ai_model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return "".join(
        block.text for block in resp.content if getattr(block, "type", "") == "text"
    )
