"""回测引擎测试（合成数据、无网络）。"""

from __future__ import annotations

import importlib.util

import pytest

from app.services.backtest.engine import backtest, compare

HAS_PYPFOPT = importlib.util.find_spec("pypfopt") is not None


def test_backtest_produces_nav_and_metrics(synthetic_prices):
    result = backtest(synthetic_prices, method="equal_weight", rebalance="M")
    assert len(result.nav) > 0
    assert result.nav.iloc[0] > 0
    assert result.metrics.n_rebalances >= 1
    # 最大回撤应为非正
    assert result.metrics.max_drawdown <= 0


def test_transaction_cost_reduces_return(synthetic_prices):
    no_cost = backtest(synthetic_prices, "inverse_vol", cost_bps=0)
    high_cost = backtest(synthetic_prices, "inverse_vol", cost_bps=50)
    assert high_cost.metrics.total_return <= no_cost.metrics.total_return


def test_compare_ranks_by_sharpe(synthetic_prices):
    methods = ["equal_weight", "inverse_vol"]
    if HAS_PYPFOPT:
        methods.append("min_volatility")
    results = compare(synthetic_prices, methods)
    assert len(results) >= 2
    sharpes = [r.metrics.sharpe_ratio for r in results]
    assert sharpes == sorted(sharpes, reverse=True)


def test_rejects_insufficient_data(synthetic_prices):
    with pytest.raises(ValueError):
        backtest(synthetic_prices.iloc[:100], lookback_window=126)


def test_rejects_bad_frequency(synthetic_prices):
    with pytest.raises(ValueError):
        backtest(synthetic_prices, rebalance="X")
