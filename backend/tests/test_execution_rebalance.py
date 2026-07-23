"""模拟执行 + 再平衡引擎（纯逻辑，无 DB/网络）。"""

from __future__ import annotations

from app.services.rebalance.engine import current_weights, evaluate
from app.services.trading.execution import build_execution_plan


def test_build_execution_plan_allocates_by_weight():
    plan = build_execution_plan(
        {"SPY": 0.5, "GLD": 0.5},
        {"SPY": 100.0, "GLD": 50.0},
        total_value=10_000,
    )
    shares = plan.target_shares
    # 50% of 10000 = 5000 -> 50 股 SPY@100，100 股 GLD@50
    assert shares["SPY"] == 50
    assert shares["GLD"] == 100
    assert all(t.side == "buy" for t in plan.trades)


def test_execution_sells_removed_symbol():
    plan = build_execution_plan(
        {"SPY": 1.0},
        {"SPY": 100.0, "GLD": 50.0},
        total_value=10_000,
        current_shares={"GLD": 20},
    )
    sells = [t for t in plan.trades if t.side == "sell"]
    assert any(t.symbol == "GLD" for t in sells)


def test_current_weights():
    w, total = current_weights({"SPY": 10, "GLD": 20}, {"SPY": 100, "GLD": 50})
    assert abs(total - 2000) < 1e-6
    assert abs(w["SPY"] - 0.5) < 1e-6


def test_evaluate_no_rebalance_when_within_threshold():
    # 当前权重≈目标，drift 小
    d = evaluate(
        {"SPY": 0.5, "GLD": 0.5},
        {"SPY": 50, "GLD": 100},
        {"SPY": 100, "GLD": 50},
        threshold=0.05,
    )
    assert d.should_rebalance is False
    assert d.plan is None


def test_evaluate_triggers_rebalance_on_drift():
    # SPY 大涨导致超配
    d = evaluate(
        {"SPY": 0.5, "GLD": 0.5},
        {"SPY": 50, "GLD": 100},
        {"SPY": 300, "GLD": 50},  # SPY 价格翻 3 倍 -> 权重 ~0.75
        threshold=0.05,
    )
    assert d.should_rebalance is True
    assert d.plan is not None
    assert d.max_drift > 0.05
