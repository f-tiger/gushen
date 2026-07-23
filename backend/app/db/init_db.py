"""开发用快速建表脚本（create_all）。

生产/协作请用 Alembic 迁移（见 migrations/）。此脚本仅便于本地起步。

用法：python -m app.db.init_db
"""

from __future__ import annotations

from app.db.base import Base, engine
from app import models  # noqa: F401 —— 触发模型注册到 Base.metadata


def init() -> None:
    Base.metadata.create_all(bind=engine)
    print("[init_db] 已创建全部表：", ", ".join(Base.metadata.tables))


if __name__ == "__main__":
    init()
