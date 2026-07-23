"""API 冒烟测试（TestClient，仅覆盖不打网络的端点）。

背景：FastAPI 0.115 的 _IncludedRouter 使 app.routes 内省看不到子路由，
故用真实请求验证路由确实挂载并响应。
"""

from __future__ import annotations

from starlette.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_list_methods():
    r = client.get("/api/portfolio/methods")
    assert r.status_code == 200
    assert "hrp" in r.json()["methods"]


def test_risk_profile_endpoint():
    r = client.post(
        "/api/portfolio/risk-profile",
        json={"answers": {"horizon": 3, "drawdown_tolerance": 2, "experience": 1,
                          "income_stability": 2, "goal": 2}},
    )
    assert r.status_code == 200
    assert r.json()["level"] == "moderate_aggressive"


def test_ai_status_degraded_without_key():
    r = client.get("/api/ai/status")
    assert r.status_code == 200
    assert r.json()["available"] is False


def test_ai_explain_fallback():
    r = client.post(
        "/api/ai/explain-portfolio",
        json={
            "profile": {"score": 67, "level": "moderate_aggressive"},
            "portfolio": {"method": "hrp", "weights": {"SPY": 0.5, "GLD": 0.5},
                          "expected_annual_return": 0.08, "annual_volatility": 0.12,
                          "sharpe_ratio": 0.66},
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "fallback"
    assert "不构成投资建议" in body["explanation"]


def test_ai_ask_no_symbols_no_network():
    # 问题不含股票代码 → 不触发行情抓取 → 无网络
    r = client.post("/api/ai/ask", json={"question": "什么是分散化投资？"})
    assert r.status_code == 200
    assert r.json()["source"] == "no_ai"
