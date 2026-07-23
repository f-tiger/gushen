"""进攻型成长筛选 + 动量集中优化测试（合成数据）。"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.services.analysis.screener import growth_score, screen
from app.services.portfolio.optimizer import optimize


def _series(slope: float, vol: float, n: int = 300, seed: int = 0) -> pd.Series:
    dates = pd.bdate_range("2023-01-02", periods=n)
    rng = np.random.default_rng(seed)
    base = np.linspace(100, 100 * (1 + slope), n)
    return pd.Series(base + rng.normal(0, vol, n), index=dates)


@pytest.fixture
def mixed_prices() -> pd.DataFrame:
    # ROCKET 强势上行；FLAT 横盘；DOG 下行
    return pd.DataFrame({
        "ROCKET": _series(1.5, 1.0, seed=1),
        "FLAT": _series(0.02, 1.0, seed=2),
        "DOG": _series(-0.4, 1.0, seed=3),
    })


def test_growth_score_higher_for_stronger_uptrend(mixed_prices):
    assert growth_score(mixed_prices["ROCKET"]) > growth_score(mixed_prices["FLAT"])
    assert growth_score(mixed_prices["FLAT"]) > growth_score(mixed_prices["DOG"])


def test_screen_ranks_rocket_first(mixed_prices):
    price_map = {c: mixed_prices[c] for c in mixed_prices.columns}
    candidates = screen(price_map, top_k=3)
    assert candidates[0].symbol == "ROCKET"
    # 每个候选都必须带下行风险信息（诚实）
    assert candidates[0].max_drawdown <= 0
    assert candidates[0].annualized_vol >= 0


def test_momentum_method_concentrates_on_winner(mixed_prices):
    result = optimize(mixed_prices, method="momentum")
    # 应把权重集中到强动量的 ROCKET，且不配下行的 DOG
    assert result.weights.get("ROCKET", 0) > 0.5
    assert result.weights.get("DOG", 0) == 0


def test_momentum_in_methods_list():
    from app.services.portfolio.optimizer import METHODS
    assert "momentum" in METHODS
