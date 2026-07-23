"""技术/趋势分析 API。"""

from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.analysis.screener import screen
from app.services.analysis.technical import analyze, rank_by_momentum
from app.services.market import get_provider

router = APIRouter(prefix="/analysis", tags=["analysis"])


def _load_series(symbol: str, days: int) -> pd.Series:
    provider = get_provider()
    end = date.today()
    start = end - timedelta(days=days)
    bars = provider.get_bars(symbol.upper(), start, end)
    if not bars:
        raise HTTPException(status_code=502, detail=f"{symbol} 无行情数据")
    return pd.Series({b.time: b.close for b in bars}, dtype="float64").sort_index()


@router.get("/{symbol}")
def analyze_symbol(symbol: str, days: int = Query(400, ge=60, le=3650)) -> dict:
    series = _load_series(symbol, days)
    return analyze(symbol.upper(), series).to_dict()


class RankRequest(BaseModel):
    symbols: list[str] = Field(..., min_length=1)
    lookback_days: int = Field(180, ge=20, le=756)
    history_days: int = Field(400, ge=60, le=3650)


@router.post("/rank")
def rank(req: RankRequest) -> dict:
    price_map = {}
    for sym in req.symbols:
        try:
            price_map[sym.upper()] = _load_series(sym, req.history_days)
        except HTTPException:
            continue
    if not price_map:
        raise HTTPException(status_code=502, detail="无可用行情数据")
    return {"ranking": rank_by_momentum(price_map, req.lookback_days),
            "lookback_days": req.lookback_days}


class ScreenRequest(BaseModel):
    symbols: list[str] = Field(..., min_length=1)
    top_k: int = Field(10, ge=1, le=50)
    history_days: int = Field(400, ge=130, le=3650)


@router.post("/screen")
def screen_growth(req: ScreenRequest) -> dict:
    """进攻型成长筛选：按动量/突破/创新高排名，附下行风险。"""
    price_map = {}
    for sym in req.symbols:
        try:
            price_map[sym.upper()] = _load_series(sym, req.history_days)
        except HTTPException:
            continue
    if not price_map:
        raise HTTPException(status_code=502, detail="无可用行情数据")
    candidates = screen(price_map, req.top_k)
    return {
        "candidates": [c.to_dict() for c in candidates],
        "note": "评分刻画当前上行强度，非预测；高分通常高波动。集中押注上行大、下行也大。",
    }
