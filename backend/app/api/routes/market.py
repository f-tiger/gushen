"""行情 API。"""

from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

from app.services.market import get_provider

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/quote/{symbol}")
def get_quote(symbol: str) -> dict:
    provider = get_provider()
    try:
        q = provider.get_quote(symbol.upper())
    except Exception as exc:  # noqa: BLE001 —— 原型阶段直接回传错误
        raise HTTPException(status_code=502, detail=f"行情源错误: {exc}") from exc
    return {"symbol": q.symbol, "price": q.price, "delayed": q.delayed}


@router.get("/bars/{symbol}")
def get_bars(
    symbol: str,
    days: int = Query(180, ge=1, le=3650),
    timeframe: str = "1d",
) -> dict:
    provider = get_provider()
    end = date.today()
    start = end - timedelta(days=days)
    try:
        bars = provider.get_bars(symbol.upper(), start, end, timeframe)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"行情源错误: {exc}") from exc
    return {
        "symbol": symbol.upper(),
        "count": len(bars),
        "bars": [
            {
                "time": b.time.isoformat(),
                "open": b.open,
                "high": b.high,
                "low": b.low,
                "close": b.close,
                "volume": b.volume,
            }
            for b in bars
        ],
    }
