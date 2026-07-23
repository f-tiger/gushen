"""RAG 脚手架 —— 投研问答的检索层。

现状：提供**关键词回退检索**（纯 Python，无需嵌入模型/向量库），可离线运行与测试。
生产路径：实现 Embedder 接口（如 Claude/开源嵌入）+ pgvector 存储，把 keyword_search
替换为向量相似度检索（见 docs/architecture.md §4.3）。检索接口保持不变，便于平滑升级。
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Protocol


@dataclass
class Document:
    id: str
    title: str
    content: str
    symbol: str | None = None


def _tokenize(text: str) -> list[str]:
    # 拉丁/数字按词切分；中文（无空格）按单字切分，保证关键词回退能命中重叠
    text = text.lower()
    tokens = re.findall(r"[a-z0-9]+", text)
    tokens += re.findall(r"[一-鿿]", text)
    return tokens


def keyword_search(query: str, docs: list[Document], top_k: int = 3) -> list[Document]:
    """按查询词与文档的词重叠打分，返回 top_k。向量检索就绪前的回退实现。"""
    q_terms = set(_tokenize(query))
    if not q_terms:
        return []
    scored: list[tuple[float, Document]] = []
    for d in docs:
        d_terms = _tokenize(d.title + " " + d.content)
        if not d_terms:
            continue
        overlap = sum(1 for t in d_terms if t in q_terms)
        if overlap:
            scored.append((overlap / len(set(d_terms)), d))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [d for _, d in scored[:top_k]]


class Retriever(Protocol):
    """检索器接口 —— keyword 回退与未来的 pgvector 实现共用。"""

    def retrieve(self, query: str, top_k: int = 3) -> list[Document]: ...


class KeywordRetriever:
    def __init__(self, docs: list[Document]):
        self._docs = docs

    def retrieve(self, query: str, top_k: int = 3) -> list[Document]:
        return keyword_search(query, self._docs, top_k)


def build_context(docs: list[Document], max_chars: int = 1500) -> str:
    """把检索到的文档拼成给 LLM 的上下文。"""
    parts = []
    used = 0
    for d in docs:
        snippet = f"【{d.title}】{d.content}"
        if used + len(snippet) > max_chars:
            snippet = snippet[: max_chars - used]
        parts.append(snippet)
        used += len(snippet)
        if used >= max_chars:
            break
    return "\n\n".join(parts)
