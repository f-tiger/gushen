"""目标可行性 API。"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.routes.portfolio import _load_prices
from app.services.backtest.engine import backtest
from app.services.planning.goal import analyze_goal

router = APIRouter(prefix="/planning", tags=["planning"])


class GoalRequest(BaseModel):
    initial: float = Field(..., gt=0, examples=[1_000_000])
    target: float = Field(..., gt=0, examples=[10_000_000])
    years: float = Field(1.0, gt=0)
    # 二选一：直接给组合年化收益/波动，或给 symbols+method 由回测估算
    expected_return: float | None = None
    expected_vol: float | None = None
    symbols: list[str] | None = None
    method: str = "hrp"
    lookback_days: int = Field(1095, ge=300, le=3650)


@router.post("/goal")
def goal(req: GoalRequest) -> dict:
    exp_ret, exp_vol = req.expected_return, req.expected_vol
    if exp_ret is None or exp_vol is None:
        if not req.symbols or len(req.symbols) < 2:
            raise HTTPException(
                status_code=400,
                detail="需提供 expected_return+expected_vol，或至少 2 个 symbols 由回测估算",
            )
        prices = _load_prices(req.symbols, req.lookback_days)
        bt = backtest(prices, req.method)
        exp_ret = bt.metrics.cagr
        exp_vol = bt.metrics.annual_volatility
    result = analyze_goal(req.initial, req.target, req.years, exp_ret, exp_vol)
    return {
        **result.to_dict(),
        "assumptions": {"expected_return": round(exp_ret, 4),
                        "expected_vol": round(exp_vol, 4)},
    }
