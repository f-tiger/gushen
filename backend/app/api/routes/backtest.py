"""回测 API —— 在自有股票池上横评组合算法。"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.routes.portfolio import _load_prices
from app.services.backtest.engine import backtest, compare
from app.services.portfolio.optimizer import METHODS

router = APIRouter(prefix="/backtest", tags=["backtest"])


class BacktestRequest(BaseModel):
    symbols: list[str] = Field(..., min_length=2, examples=[["SPY", "QQQ", "GLD", "TLT"]])
    methods: list[str] = Field(default=["hrp", "min_volatility", "equal_weight"])
    lookback_days: int = Field(1095, ge=300, le=3650)
    rebalance: str = Field("M", pattern="^[MQW]$")
    lookback_window: int = Field(126, ge=40, le=504)
    cost_bps: float = Field(5.0, ge=0, le=100)


@router.post("/compare")
def run_compare(req: BacktestRequest) -> dict:
    bad = [m for m in req.methods if m not in METHODS]
    if bad:
        raise HTTPException(status_code=400, detail=f"未知方法: {bad}，可选 {METHODS}")
    prices = _load_prices(req.symbols, req.lookback_days)
    results = compare(
        prices,
        req.methods,
        rebalance=req.rebalance,
        lookback_window=req.lookback_window,
        cost_bps=req.cost_bps,
    )
    if not results:
        raise HTTPException(status_code=400, detail="回测未产生结果（检查数据/参数）")
    return {
        "symbols": [s.upper() for s in req.symbols],
        "ranked_by": "sharpe_ratio",
        "results": [r.to_dict() for r in results],
        "disclaimer": "历史回测不代表未来收益，仅供算法选型参考，不构成投资建议。",
    }


@router.post("/run")
def run_single(req: BacktestRequest) -> dict:
    method = req.methods[0] if req.methods else "hrp"
    if method not in METHODS:
        raise HTTPException(status_code=400, detail=f"未知方法 {method}")
    prices = _load_prices(req.symbols, req.lookback_days)
    try:
        result = backtest(
            prices,
            method,
            rebalance=req.rebalance,
            lookback_window=req.lookback_window,
            cost_bps=req.cost_bps,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"回测失败: {exc}") from exc
    return {**result.to_dict(), "disclaimer": "历史回测不代表未来收益。"}
