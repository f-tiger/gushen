"""AI 表达层测试 —— 聚焦无 key 的确定性回退与工具接地逻辑（不打网络）。"""

from __future__ import annotations

from app.services.ai.explain import build_prompt, fallback_explanation, explain_portfolio
from app.services.ai.qa import extract_symbols

PROFILE = {"score": 67, "level": "moderate_aggressive", "recommended_method": "inverse_vol"}
PORTFOLIO = {
    "method": "inverse_vol",
    "weights": {"SPY": 0.3, "QQQ": 0.2, "GLD": 0.3, "TLT": 0.2},
    "expected_annual_return": 0.08,
    "annual_volatility": 0.12,
    "sharpe_ratio": 0.66,
}


def test_fallback_explanation_mentions_numbers_and_disclaimer():
    text = fallback_explanation(PROFILE, PORTFOLIO)
    assert "inverse_vol" in text
    assert "SPY" in text
    assert "不构成投资建议" in text


def test_explain_portfolio_degrades_without_key():
    # 测试环境无 ANTHROPIC_API_KEY → 应走 fallback
    out = explain_portfolio(PROFILE, PORTFOLIO)
    assert out["source"] == "fallback"
    assert "explanation" in out


def test_build_prompt_contains_data_and_no_compute_instruction():
    prompt = build_prompt(PROFILE, PORTFOLIO)
    assert "inverse_vol" in prompt
    assert "不要改动任何数字" in prompt


def test_extract_symbols_filters_stopwords():
    syms = extract_symbols("AAPL 和 SPY 哪个适合长期持有？AI 会怎么看", hint=["GLD"])
    assert "AAPL" in syms and "SPY" in syms and "GLD" in syms
    assert "AI" not in syms  # 停用词过滤
