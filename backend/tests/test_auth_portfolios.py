"""鉴权 + 组合持久化 + 执行 + 再平衡 的端到端 API 测试（SQLite）。"""

from __future__ import annotations


def test_register_login_me(client):
    email = "flow@example.com"
    r = client.post("/api/auth/register", json={"email": email, "password": "pw123456"})
    assert r.status_code == 201
    token = r.json()["access_token"]

    r = client.post("/api/auth/login", json={"email": email, "password": "pw123456"})
    assert r.status_code == 200

    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == email


def test_login_wrong_password(client):
    client.post("/api/auth/register", json={"email": "wp@example.com", "password": "pw123456"})
    r = client.post("/api/auth/login", json={"email": "wp@example.com", "password": "bad"})
    assert r.status_code == 401


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_portfolio_create_execute_rebalance(client, auth_headers):
    # 建组合（带目标权重）
    r = client.post(
        "/api/portfolios",
        headers=auth_headers,
        json={"name": "核心组合", "cash": 10_000, "method": "hrp",
              "target_weights": {"SPY": 0.5, "GLD": 0.5}},
    )
    assert r.status_code == 201
    pid = r.json()["id"]

    # 执行（显式传价格，离线）
    r = client.post(
        f"/api/portfolios/{pid}/execute",
        headers=auth_headers,
        json={"prices": {"SPY": 100.0, "GLD": 50.0}},
    )
    assert r.status_code == 200
    body = r.json()
    shares = {p["symbol"]: p["quantity"] for p in body["portfolio"]["positions"]}
    assert shares["SPY"] == 50 and shares["GLD"] == 100

    # 再平衡评估：价格不变 -> 不应触发
    r = client.post(
        f"/api/portfolios/{pid}/rebalance",
        headers=auth_headers,
        json={"threshold": 0.05, "prices": {"SPY": 100.0, "GLD": 50.0}},
    )
    assert r.json()["decision"]["should_rebalance"] is False

    # SPY 价格翻倍 -> 应触发
    r = client.post(
        f"/api/portfolios/{pid}/rebalance",
        headers=auth_headers,
        json={"threshold": 0.05, "prices": {"SPY": 200.0, "GLD": 50.0}, "execute": True},
    )
    body = r.json()
    assert body["decision"]["should_rebalance"] is True
    assert body["executed"] is True


def test_cannot_access_others_portfolio(client, auth_headers):
    r = client.post("/api/portfolios", headers=auth_headers,
                    json={"name": "A", "cash": 1000, "target_weights": {"SPY": 1.0}})
    pid = r.json()["id"]
    # 另一个用户
    r2 = client.post("/api/auth/register",
                     json={"email": "other@example.com", "password": "pw123456"})
    other = {"Authorization": f"Bearer {r2.json()['access_token']}"}
    assert client.get(f"/api/portfolios/{pid}", headers=other).status_code == 404
