from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RiskProfile(Base):
    """用户风险画像结果。

    score/level 由确定性映射（app.services.profiling）根据问卷或 LLM 结构化访谈
    的结构化输出计算得到；answers 保存原始输入以便审计与复算。
    """

    __tablename__ = "risk_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    # 0-100 综合风险承受分；level 为映射后的档位
    score: Mapped[int] = mapped_column(Integer)
    level: Mapped[str] = mapped_column(String(32))  # conservative..aggressive
    target_horizon_years: Mapped[int] = mapped_column(Integer, default=10)

    # 原始问卷/访谈输入（可审计）
    answers: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="risk_profiles")
