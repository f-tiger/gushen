"""组合与风险画像 API。"""

from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.market import get_provider
from app.services.portfolio.barbell import build_barbell
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


class BarbellRequest(BaseModel):
    core_symbols: list[str] = Field(..., min_length=2, examples=[["SPY", "TLT", "GLD"]])
    satellite_symbols: list[str] = Field(..., min_length=1, examples=[["NVDA", "SMCI"]])
    safe_pct: float = Field(0.80, gt=0, lt=1)
    per_bet_cap: float = Field(0.10, gt=0, le=1)
    lookback_days: int = Field(365, ge=60, le=3650)


@router.post("/barbell")
def barbell(req: BarbellRequest) -> dict:
    """杠铃组合：保命核心 + 定义化风险的进攻 sleeve（docs/research-high-return.md §5）。"""
    core = _load_prices(req.core_symbols, req.lookback_days)
    # 进攻端可能只有 1 个标的；用等权/动量前先构造 DataFrame
    sat = _load_prices(req.satellite_symbols, req.lookback_days) if len(req.satellite_symbols) >= 2 else None
    if sat is None:
        # 单标的进攻端：直接全给该标的
        sym = req.satellite_symbols[0].upper()
        core_w = optimize(core, "min_volatility").weights
        weights = {s: round(w * req.safe_pct, 4) for s, w in core_w.items()}
        weights[sym] = round(weights.get(sym, 0) + (1 - req.safe_pct), 4)
        return {"weights": weights, "safe_pct": req.safe_pct,
                "note": "单标的进攻端；其余为保命核心。归零不致命。"}
    try:
        return build_barbell(core, sat, req.safe_pct, per_bet_cap=req.per_bet_cap)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"杠铃构造失败: {exc}") from exc


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
