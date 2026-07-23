"""组合与风险画像 API。"""

from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.market import get_provider
from app.services.portfolio.optimizer import METHODS, optimize
from app.services.profiling.risk_profile import score_answers

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


class OptimizeRequest(BaseModel):
    symbols: list[str] = Field(..., min_length=2, examples=[["SPY", "QQQ", "GLD", "TLT"]])
    method: str = "hrp"
    lookback_days: int = Field(365, ge=60, le=3650)
    max_weight: float = Field(1.0, gt=0, le=1.0)


class ProfileRequest(BaseModel):
    answers: dict[str, int] = Field(
        ..., examples=[{"horizon": 3, "drawdown_tolerance": 2, "experience": 1,
                        "income_stability": 2, "goal": 2}]
    )


class RecommendRequest(ProfileRequest):
    symbols: list[str] = Field(..., min_length=2)
    lookback_days: int = Field(365, ge=60, le=3650)


def _load_prices(symbols: list[str], lookback_days: int) -> pd.DataFrame:
    provider = get_provider()
    end = date.today()
    start = end - timedelta(days=lookback_days)
    series: dict[str, pd.Series] = {}
    for sym in symbols:
        bars = provider.get_bars(sym.upper(), start, end)
        if not bars:
            continue
        s = pd.Series(
            {b.time: b.close for b in bars}, name=sym.upper(), dtype="float64"
        )
        series[sym.upper()] = s
    if len(series) < 2:
        raise HTTPException(
            status_code=502, detail="可用行情标的不足 2 个，无法优化（检查数据源/代码）"
        )
    return pd.DataFrame(series).sort_index().dropna()


@router.get("/methods")
def list_methods() -> dict:
    return {"methods": METHODS, "default": "hrp"}


@router.post("/risk-profile")
def risk_profile(req: ProfileRequest) -> dict:
    return score_answers(req.answers).to_dict()


@router.post("/optimize")
def optimize_portfolio(req: OptimizeRequest) -> dict:
    if req.method not in METHODS:
        raise HTTPException(status_code=400, detail=f"method 须为 {METHODS} 之一")
    prices = _load_prices(req.symbols, req.lookback_days)
    try:
        result = optimize(prices, req.method, weight_bounds=(0.0, req.max_weight))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"优化失败: {exc}") from exc
    return result.to_dict()


@router.post("/recommend")
def recommend(req: RecommendRequest) -> dict:
    """一步到位：问卷 → 画像 → 用推荐方法优化组合。"""
    profile = score_answers(req.answers)
    prices = _load_prices(req.symbols, req.lookback_days)
    try:
        result = optimize(
            prices, profile.recommended_method, weight_bounds=(0.0, profile.max_weight)
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"优化失败: {exc}") from exc
    return {"profile": profile.to_dict(), "portfolio": result.to_dict()}
