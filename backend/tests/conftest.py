"""测试夹具。

关键：在导入任何 app 模块之前，把 DATABASE_URL 指向本地 SQLite，
这样整个测试套件无需 Postgres/psycopg2 即可跑 DB 相关端点。
"""

from __future__ import annotations

import os
import uuid

# ⚠️ 必须在导入 app.* 之前设置
os.environ.setdefault("DATABASE_URL", "sqlite:///./_test_gushen.db")
os.environ.setdefault("SECRET_KEY", "test-secret")

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
import pytest  # noqa: E402
from starlette.testclient import TestClient  # noqa: E402

from app.db.base import Base, engine  # noqa: E402
import app.models  # noqa: E402,F401 —— 注册模型
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    try:
        os.remove("./_test_gushen.db")
    except OSError:
        pass


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def auth_headers(client: TestClient) -> dict:
    """注册一个唯一用户并返回带 Bearer 令牌的请求头。"""
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    resp = client.post("/api/auth/register", json={"email": email, "password": "pw123456"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


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
