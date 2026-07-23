from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Order(Base):
    """模拟盘下单记录（真实盘阶段用于记录调仓建议的执行）。"""

    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), index=True)
    symbol: Mapped[str] = mapped_column(String(16), index=True)
    side: Mapped[str] = mapped_column(String(4))  # buy | sell
    order_type: Mapped[str] = mapped_column(String(8), default="market")  # market|limit
    quantity: Mapped[float] = mapped_column(Numeric(18, 6))
    price: Mapped[float] = mapped_column(Numeric(18, 6), default=0)
    status: Mapped[str] = mapped_column(String(12), default="filled")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    portfolio: Mapped["Portfolio"] = relationship(back_populates="orders")
