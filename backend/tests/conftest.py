"""测试夹具：生成确定性的合成价格数据（无网络、无数据库）。"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest


@pytest.fixture
def synthetic_prices() -> pd.DataFrame:
    """4 个标的、约 2 年日频价格，几何布朗运动，固定随机种子可复现。"""
    rng = np.random.default_rng(42)
    n_days = 504
    dates = pd.bdate_range("2022-01-03", periods=n_days)
    specs = {
        "SPY": (0.0004, 0.010),
        "QQQ": (0.0005, 0.015),
        "GLD": (0.0002, 0.008),
        "TLT": (0.0001, 0.009),
    }
    data = {}
    for sym, (mu, sigma) in specs.items():
        shocks = rng.normal(mu, sigma, n_days)
        data[sym] = 100 * np.exp(np.cumsum(shocks))
    return pd.DataFrame(data, index=dates)
