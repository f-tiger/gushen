from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Portfolio(Base):
    """一个投资组合。

    is_simulated=True 表示模拟盘（用于算法验证与建立信任），
    False 表示对应真实投资的指导组合。
    weights 保存最近一次优化产出的目标权重（symbol -> weight），
    method 记录用哪种优化方法生成，便于审计与可解释性。
    """

    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(128), default="My Portfolio")

    cash_balance: Mapped[float] = mapped_column(Numeric(18, 2), default=100000)
    base_currency: Mapped[str] = mapped_column(String(8), default="USD")

    is_simulated: Mapped[bool] = mapped_column(default=True)
    method: Mapped[str] = mapped_column(String(32), default="hrp")
    target_weights: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="portfolios")
    positions: Mapped[list["Position"]] = relationship(
        back_populates="portfolio", cascade="all, delete-orphan"
    )
    orders: Mapped[list["Order"]] = relationship(
        back_populates="portfolio", cascade="all, delete-orphan"
    )
