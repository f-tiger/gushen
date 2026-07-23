"""风险画像映射测试（确定性、可复算）。"""

from __future__ import annotations

from app.services.profiling.risk_profile import score_answers


def test_all_min_is_conservative():
    p = score_answers(
        {"horizon": 0, "drawdown_tolerance": 0, "experience": 0,
         "income_stability": 0, "goal": 0}
    )
    assert p.score == 0
    assert p.level == "conservative"
    assert p.recommended_method == "min_volatility"


def test_all_max_is_aggressive():
    p = score_answers(
        {"horizon": 3, "drawdown_tolerance": 3, "experience": 3,
         "income_stability": 3, "goal": 3}
    )
    assert p.score == 100
    assert p.level == "aggressive"
    assert p.recommended_method == "max_sharpe"


def test_horizon_maps_to_years():
    p = score_answers({"horizon": 3})
    assert p.target_horizon_years == 15


def test_out_of_range_answers_are_clamped():
    p = score_answers({"horizon": 99, "goal": -5})
    assert 0 <= p.score <= 100
