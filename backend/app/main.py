"""FastAPI 应用入口。

启动：uvicorn app.main:app --reload
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.router import api_router
from app.core.config import settings

app = FastAPI(
    title=settings.app_name,
    version=__version__,
    description="AI 智能投顾（美股）后端 —— 组合优化 / 模拟验证 / 投研问答",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/")
def root() -> dict:
    return {"app": settings.app_name, "version": __version__, "docs": "/docs"}
