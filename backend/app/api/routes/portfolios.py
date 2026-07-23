"""组合持久化 + 模拟执行 + 再平衡 API（需登录）。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.base import get_db
from app.models import Order, Portfolio, Position, User
from app.services.market import get_provider
from app.services.rebalance.engine import evaluate
from app.services.trading.execution import build_execution_plan

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


class CreatePortfolioRequest(BaseModel):
    name: str = "My Portfolio"
    cash: float = Field(100_000, gt=0)
    method: str = "hrp"
    target_weights: dict[str, float] = Field(default_factory=dict)
    is_simulated: bool = True


class ExecuteRequest(BaseModel):
    # 价格可显式传入（便于测试/离线）；缺省则从行情源取回
    prices: dict[str, float] | None = None


class RebalanceRequest(BaseModel):
    threshold: float = Field(0.05, gt=0, le=0.5)
    prices: dict[str, float] | None = None
    execute: bool = False


def _portfolio_or_404(db: Session, user: User, pid: int) -> Portfolio:
    p = db.query(Portfolio).filter(
        Portfolio.id == pid, Portfolio.user_id == user.id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="组合不存在")
    return p


def _serialize(p: Portfolio) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "cash_balance": float(p.cash_balance),
        "method": p.method,
        "is_simulated": p.is_simulated,
        "target_weights": p.target_weights,
        "positions": [
            {"symbol": pos.symbol, "quantity": float(pos.quantity),
             "avg_cost": float(pos.avg_cost)}
            for pos in p.positions
        ],
    }


def _prices_for(symbols: list[str], override: dict[str, float] | None) -> dict[str, float]:
    if override:
        return override
    provider = get_provider()
    out: dict[str, float] = {}
    for s in symbols:
        try:
            out[s] = provider.get_quote(s).price
        except Exception:  # noqa: BLE001
            continue
    return out


@router.post("", status_code=201)
def create_portfolio(
    req: CreatePortfolioRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    p = Portfolio(
        user_id=user.id, name=req.name, cash_balance=req.cash,
        method=req.method, target_weights=req.target_weights,
        is_simulated=req.is_simulated,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _serialize(p)


@router.get("")
def list_portfolios(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    ps = db.query(Portfolio).filter(Portfolio.user_id == user.id).all()
    return {"portfolios": [_serialize(p) for p in ps]}


@router.get("/{pid}")
def get_portfolio(
    pid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    return _serialize(_portfolio_or_404(db, user, pid))


@router.post("/{pid}/execute")
def execute(
    pid: int,
    req: ExecuteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    p = _portfolio_or_404(db, user, pid)
    if not p.target_weights:
        raise HTTPException(status_code=400, detail="组合无目标权重，先设置或优化")

    current = {pos.symbol: float(pos.quantity) for pos in p.positions}
    prices = _prices_for(list(p.target_weights), req.prices)
    if not prices:
        raise HTTPException(status_code=502, detail="无可用价格（检查数据源或显式传 prices）")

    total_value = float(p.cash_balance) + sum(
        current.get(s, 0) * prices.get(s, 0) for s in current
    )
    plan = build_execution_plan(p.target_weights, prices, total_value, current)

    # 落库：更新持仓、记录订单、更新现金
    for t in plan.trades:
        db.add(Order(portfolio_id=p.id, symbol=t.symbol, side=t.side,
                     quantity=t.quantity, price=t.price))
    existing = {pos.symbol: pos for pos in p.positions}
    for sym, shares in plan.target_shares.items():
        if sym in existing:
            existing[sym].quantity = shares
            existing[sym].avg_cost = prices.get(sym, existing[sym].avg_cost)
        elif shares > 0:
            db.add(Position(portfolio_id=p.id, symbol=sym, quantity=shares,
                            avg_cost=prices.get(sym, 0)))
    p.cash_balance = plan.cash_after
    db.commit()
    db.refresh(p)
    return {"plan": plan.to_dict(), "portfolio": _serialize(p)}


@router.post("/{pid}/rebalance")
def rebalance(
    pid: int,
    req: RebalanceRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    p = _portfolio_or_404(db, user, pid)
    if not p.target_weights:
        raise HTTPException(status_code=400, detail="组合无目标权重")
    shares = {pos.symbol: float(pos.quantity) for pos in p.positions}
    prices = _prices_for(list(set(p.target_weights) | set(shares)), req.prices)
    decision = evaluate(p.target_weights, shares, prices, req.threshold)

    result = {"decision": decision.to_dict(), "executed": False,
              "disclaimer": "再平衡建议仅供参考，不构成投资建议。"}
    if req.execute and decision.should_rebalance and decision.plan:
        for t in decision.plan.trades:
            db.add(Order(portfolio_id=p.id, symbol=t.symbol, side=t.side,
                         quantity=t.quantity, price=t.price))
        existing = {pos.symbol: pos for pos in p.positions}
        for sym, sh in decision.plan.target_shares.items():
            if sym in existing:
                existing[sym].quantity = sh
            elif sh > 0:
                db.add(Position(portfolio_id=p.id, symbol=sym, quantity=sh,
                                avg_cost=prices.get(sym, 0)))
        p.cash_balance = decision.plan.cash_after
        db.commit()
        result["executed"] = True
    return result
