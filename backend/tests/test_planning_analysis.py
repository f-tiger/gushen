"""目标可行性 + 技术分析测试（纯逻辑/合成数据，无网络）。"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.services.analysis.technical import (
    analyze,
    classify_trend,
    momentum,
    period_returns,
    rank_by_momentum,
    rsi,
)
from app.services.planning.goal import analyze_goal


# ---------- 目标可行性 ----------

def test_10x_in_one_year_is_unrealistic():
    # 100w -> 1000w，1 年：所需年化 900%，用典型激进组合估算应判为不现实、概率极低
    a = analyze_goal(1_000_000, 10_000_000, 1.0, expected_return=0.15, expected_vol=0.25)
    assert a.required_cagr > 8.0  # ~900%
    assert a.verdict == "unrealistic"
    assert a.prob_success < 0.01
    assert "基本无法实现" in a.message


def test_realistic_goal_is_flagged_realistic():
    # 10 年翻倍 ≈ 年化 7.2%
    a = analyze_goal(100_000, 200_000, 10.0, expected_return=0.08, expected_vol=0.15)
    assert a.verdict == "realistic"
    assert a.prob_success > 0.4


def test_goal_rejects_nonpositive():
    with pytest.raises(ValueError):
        analyze_goal(0, 100, 1, 0.1, 0.2)


# ---------- 技术分析 ----------

@pytest.fixture
def uptrend_series():
    # 稳定上行 + 轻噪声，300 个交易日
    dates = pd.bdate_range("2023-01-02", periods=300)
    base = np.linspace(100, 200, 300)
    rng = np.random.default_rng(0)
    return pd.Series(base + rng.normal(0, 1, 300), index=dates)


def test_uptrend_classified(uptrend_series):
    t = classify_trend(uptrend_series)
    assert t["direction"] == "uptrend"
    assert t["ma50"] is not None and t["ma200"] is not None


def test_momentum_positive_in_uptrend(uptrend_series):
    assert momentum(uptrend_series, 126) > 0


def test_rsi_in_range(uptrend_series):
    r = rsi(uptrend_series).dropna()
    assert (r.between(0, 100)).all()


def test_period_returns_weekly_monthly(uptrend_series):
    wk = period_returns(uptrend_series, "W")
    mo = period_returns(uptrend_series, "ME")
    assert len(wk) > len(mo) > 0


def test_analyze_summary_shape(uptrend_series):
    d = analyze("TEST", uptrend_series).to_dict()
    assert d["symbol"] == "TEST"
    assert "trend" in d and "momentum" in d
    assert d["momentum"]["6m"] is not None


def test_rank_by_momentum_orders():
    dates = pd.bdate_range("2023-01-02", periods=200)
    strong = pd.Series(np.linspace(100, 200, 200), index=dates)
    weak = pd.Series(np.linspace(100, 105, 200), index=dates)
    ranking = rank_by_momentum({"STRONG": strong, "WEAK": weak}, lookback=126)
    assert ranking[0]["symbol"] == "STRONG"
