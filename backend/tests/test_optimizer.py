"""组合优化引擎测试。

纯 numpy 方法（equal_weight / inverse_vol）无条件测试；
需要 PyPortfolioOpt 的方法（hrp / min_volatility / max_sharpe）在库缺失时跳过。
"""

from __future__ import annotations

import importlib.util

import pytest

from app.services.portfolio.optimizer import METHODS, optimize

HAS_PYPFOPT = importlib.util.find_spec("pypfopt") is not None
NEEDS_PYPFOPT = {"hrp", "min_volatility", "max_sharpe"}


def _assert_valid_weights(weights: dict[str, float]) -> None:
    assert weights, "权重不应为空"
    assert all(w >= 0 for w in weights.values()), "不应有负权重"
    assert abs(sum(weights.values()) - 1.0) < 1e-2, "权重应归一到 1"


@pytest.mark.parametrize("method", METHODS)
def test_optimize_produces_valid_weights(synthetic_prices, method):
    if method in NEEDS_PYPFOPT and not HAS_PYPFOPT:
        pytest.skip("PyPortfolioOpt 未安装")
    result = optimize(synthetic_prices, method=method)
    assert result.method == method
    _assert_valid_weights(result.weights)
    assert result.annual_volatility >= 0


def test_equal_weight_is_uniform(synthetic_prices):
    result = optimize(synthetic_prices, method="equal_weight")
    vals = list(result.weights.values())
    assert max(vals) - min(vals) < 1e-6


def test_inverse_vol_favors_low_vol_asset(synthetic_prices):
    # GLD 波动最低（0.008），逆波动率下权重应高于 QQQ（0.015）
    result = optimize(synthetic_prices, method="inverse_vol")
    assert result.weights["GLD"] > result.weights["QQQ"]


def test_max_weight_bound_respected(synthetic_prices):
    if not HAS_PYPFOPT:
        pytest.skip("PyPortfolioOpt 未安装")
    result = optimize(synthetic_prices, method="min_volatility", weight_bounds=(0.0, 0.4))
    # clean/归一化后允许极小溢出容差
    assert max(result.weights.values()) <= 0.4 + 0.05


def test_rejects_single_asset(synthetic_prices):
    with pytest.raises(ValueError):
        optimize(synthetic_prices[["SPY"]], method="equal_weight")


def test_rejects_unknown_method(synthetic_prices):
    with pytest.raises(ValueError):
        optimize(synthetic_prices, method="does_not_exist")
