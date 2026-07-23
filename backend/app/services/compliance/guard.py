"""合规守卫。

默认姿态 education_only（见 docs/compliance-stance.md）：
- 所有对外的投资相关文本强制附免责声明；
- education_only 模式下不得输出"个性化买卖指令"式措辞（用中立、教育口吻）。

advisory 模式（需持牌 RIA）才放开个性化建议——由 settings.compliance_mode 控制。
"""

from __future__ import annotations

from app.core.config import settings

DISCLAIMER = "以上仅供教育参考，不构成投资建议。"

# education_only 下应避免的个性化指令性措辞
_PERSONALIZED_MARKERS = ("你应该买", "建议你买入", "立即买入", "马上卖出", "全仓")


def is_personal() -> bool:
    """个人自用模式：放宽——不强制免责声明、不软化个性化措辞。"""
    return settings.compliance_mode == "personal"


def is_education_only() -> bool:
    return settings.compliance_mode == "education_only"


def ensure_disclaimer(text: str) -> str:
    """确保文本以免责声明结尾（personal 模式下不加）。"""
    if is_personal() or DISCLAIMER in text:
        return text
    return text.rstrip() + "\n" + DISCLAIMER


def sanitize(text: str) -> str:
    """education_only 模式下软化个性化措辞并加免责；personal 模式原样返回。"""
    if is_personal():
        return text
    out = text
    if is_education_only():
        for marker in _PERSONALIZED_MARKERS:
            out = out.replace(marker, "可考虑（仅作示例说明）")
    return ensure_disclaimer(out)
