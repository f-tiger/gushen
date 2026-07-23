"""合规守卫 + RAG 关键词检索测试。"""

from __future__ import annotations

from app.services.ai.rag import Document, build_context, keyword_search
from app.services.compliance.guard import DISCLAIMER, ensure_disclaimer, sanitize


def test_ensure_disclaimer_appends_once():
    text = "分散化可以降低风险。"
    out = ensure_disclaimer(text)
    assert out.endswith(DISCLAIMER)
    # 已含则不重复
    assert ensure_disclaimer(out).count(DISCLAIMER) == 1


def test_sanitize_softens_personalized_wording():
    # 默认 education_only 模式
    out = sanitize("你应该买 SPY。")
    assert "你应该买" not in out
    assert DISCLAIMER in out


def test_keyword_search_ranks_relevant_docs():
    docs = [
        Document("1", "分散化", "分散化投资通过持有多种资产降低风险"),
        Document("2", "利率", "美联储加息影响债券价格"),
    ]
    hits = keyword_search("什么是分散化投资", docs, top_k=1)
    assert hits and hits[0].id == "1"


def test_build_context_respects_max_chars():
    docs = [Document("1", "t", "x" * 5000)]
    ctx = build_context(docs, max_chars=100)
    assert len(ctx) <= 120  # 标题等少量额外字符
