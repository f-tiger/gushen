"""模拟执行 —— 把目标权重按最新价换算成整数股持仓与订单。

纯函数（价格入参），便于测试与复算。真实盘阶段可复用同一逻辑生成调仓建议。
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Trade:
    symbol: str
    side: str  # buy | sell
    quantity: float
    price: float

    @property
    def notional(self) -> float:
        return self.quantity * self.price


@dataclass
class ExecutionPlan:
    trades: list[Trade] = field(default_factory=list)
    target_shares: dict[str, float] = field(default_factory=dict)
    cash_after: float = 0.0

    def to_dict(self) -> dict:
        return {
            "trades": [
                {
                    "symbol": t.symbol,
                    "side": t.side,
                    "quantity": round(t.quantity, 4),
                    "price": round(t.price, 4),
                    "notional": round(t.notional, 2),
                }
                for t in self.trades
            ],
            "target_shares": {k: round(v, 4) for k, v in self.target_shares.items()},
            "cash_after": round(self.cash_after, 2),
        }


def build_execution_plan(
    target_weights: dict[str, float],
    prices: dict[str, float],
    total_value: float,
    current_shares: dict[str, float] | None = None,
    whole_shares: bool = True,
) -> ExecutionPlan:
    """根据目标权重、最新价、组合总值，算出需买卖的股数。

    current_shares 为空时视为建仓；非空时生成从当前到目标的调仓（再平衡执行）。
    """
    current = dict(current_shares or {})
    target_shares: dict[str, float] = {}
    trades: list[Trade] = []
    spent = 0.0

    for sym, w in target_weights.items():
        price = prices.get(sym, 0.0)
        if price <= 0:
            continue
        target_notional = total_value * w
        shares = target_notional / price
        if whole_shares:
            shares = float(int(shares))
        target_shares[sym] = shares
        delta = shares - current.get(sym, 0.0)
        if abs(delta) < 1e-9:
            continue
        trades.append(
            Trade(sym, "buy" if delta > 0 else "sell", abs(delta), price)
        )
        spent += delta * price

    # 卖出当前持有但不在目标里的标的
    for sym, sh in current.items():
        if sym not in target_weights and sh > 0:
            price = prices.get(sym, 0.0)
            trades.append(Trade(sym, "sell", sh, price))
            spent -= sh * price
            target_shares[sym] = 0.0

    return ExecutionPlan(trades=trades, target_shares=target_shares,
                         cash_after=total_value - _held_value(target_shares, prices))


def _held_value(shares: dict[str, float], prices: dict[str, float]) -> float:
    return sum(sh * prices.get(sym, 0.0) for sym, sh in shares.items())
