"""凯利仓位 + 杠铃 + 多倍股模式测试（合成数据/纯逻辑）。"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.services.analysis.screener import growth_score, multibagger_score, screen
from app.services.planning.kelly import kelly_fraction, size_bet
from app.services.portfolio.barbell import build_barbell


# ---------- 凯利 ----------

def test_kelly_zero_when_no_edge():
    # 10x 押注(b=9)，胜率 10% 恰好盈亏平衡 → 凯利=0，不该押
    assert kelly_fraction(0.10, 9, 1.0) == 0.0


def test_kelly_positive_with_edge():
    # 胜率 15% > 盈亏平衡 → 正凯利
    assert kelly_fraction(0.15, 9, 1.0) > 0


def test_size_bet_no_edge_warns_and_zero():
    r = size_bet(1_000_000, 0.08, 10)
    assert r.capped_fraction == 0.0
    assert "不应押注" in r.note


def test_size_bet_caps_and_scales():
    r = size_bet(1_000_000, 0.30, 10, kelly_scale=0.25, cap=0.10)
    # 分数凯利后仍不超过封顶
    assert r.capped_fraction <= 0.10
    assert r.recommended_amount == pytest.approx(r.capped_fraction * 1_000_000)


# ---------- 多倍股模式 ----------

def _series(slope, seed, n=300):
    dates = pd.bdate_range("2023-01-02", periods=n)
    rng = np.random.default_rng(seed)
    return pd.Series(np.linspace(100, 100 * (1 + slope), n) + rng.normal(0, 1, n), index=dates)


def _near_high_series(n=300, seed=1):
    # 稳步上行、结尾贴近 52 周高点
    dates = pd.bdate_range("2023-01-02", periods=n)
    rng = np.random.default_rng(seed)
    return pd.Series(np.linspace(100, 200, n) + rng.normal(0, 1, n), index=dates)


def _pulled_back_series(n=300, seed=2):
    # 前段冲高至 ~200，后段回落到 ~150 —— 远离高点（near≈0.75），短动量转负
    dates = pd.bdate_range("2023-01-02", periods=n)
    rng = np.random.default_rng(seed)
    peak = n * 3 // 5
    up = np.linspace(100, 200, peak)
    down = np.linspace(200, 150, n - peak)
    return pd.Series(np.concatenate([up, down]) + rng.normal(0, 1, n), index=dates)


def test_multibagger_mode_reverses_near_high_preference():
    near_high = _near_high_series()
    pulled_back = _pulled_back_series()
    price_map = {"NEARHIGH": near_high, "PULLBACK": pulled_back}
    # momentum 模式偏好仍在冲高的 NEARHIGH
    mom = screen(price_map, mode="momentum")
    assert mom[0].symbol == "NEARHIGH"
    # multibagger 模式反转：偏好回落、远离高点的 PULLBACK（证据：near-high 跑输）
    assert multibagger_score(pulled_back) > multibagger_score(near_high)
    mb = screen(price_map, mode="multibagger")
    assert mb[0].symbol == "PULLBACK"


def test_growth_and_multibagger_differ():
    s = _series(1.0, 3)
    assert growth_score(s) != multibagger_score(s)


# ---------- 杠铃 ----------

@pytest.fixture
def core_sat():
    dates = pd.bdate_range("2022-01-03", periods=400)
    rng = np.random.default_rng(7)
    core = pd.DataFrame({
        "SPY": 100 * np.exp(np.cumsum(rng.normal(3e-4, 0.008, 400))),
        "TLT": 100 * np.exp(np.cumsum(rng.normal(1e-4, 0.007, 400))),
        "GLD": 100 * np.exp(np.cumsum(rng.normal(2e-4, 0.006, 400))),
    }, index=dates)
    sat = pd.DataFrame({
        "NVDA": 100 * np.exp(np.cumsum(rng.normal(1.2e-3, 0.02, 400))),
        "SMCI": 100 * np.exp(np.cumsum(rng.normal(8e-4, 0.03, 400))),
    }, index=dates)
    return core, sat


def test_barbell_allocates_safe_majority(core_sat):
    core, sat = core_sat
    out = build_barbell(core, sat, safe_pct=0.8, per_bet_cap=0.1)
    w = out["weights"]
    assert abs(sum(w.values()) - 1.0) < 1e-2  # 权重四舍五入到 4 位的容差
    core_weight = sum(w.get(s, 0) for s in ["SPY", "TLT", "GLD"])
    # 保命端应占多数
    assert core_weight > 0.6


def test_barbell_per_bet_cap(core_sat):
    core, sat = core_sat
    out = build_barbell(core, sat, safe_pct=0.7, per_bet_cap=0.08)
    for s in ["NVDA", "SMCI"]:
        assert out["weights"].get(s, 0) <= 0.08 + 0.02  # 归一化容差
