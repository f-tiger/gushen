"""AI 表达层 API —— 组合解读 + 工具接地问答。"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.ai.client import ai_available
from app.services.ai.explain import explain_portfolio
from app.services.ai.qa import answer

router = APIRouter(prefix="/ai", tags=["ai"])


class ExplainRequest(BaseModel):
    profile: dict = Field(..., description="风险画像（score/level/...）")
    portfolio: dict = Field(..., description="组合结果（method/weights/指标）")


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1)
    symbols: list[str] | None = None


@router.get("/status")
def ai_status() -> dict:
    return {"available": ai_available()}


@router.post("/explain-portfolio")
def explain(req: ExplainRequest) -> dict:
    return explain_portfolio(req.profile, req.portfolio)


@router.post("/ask")
def ask(req: AskRequest) -> dict:
    return answer(req.question, req.symbols)
