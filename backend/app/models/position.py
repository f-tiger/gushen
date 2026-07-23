from __future__ import annotations

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Position(Base):
    """组合内某标的的持仓（数量 + 平均成本）。

    未实现盈亏由最新价实时计算，不落库。
    """

    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), index=True)
    symbol: Mapped[str] = mapped_column(String(16), index=True)
    quantity: Mapped[float] = mapped_column(Numeric(18, 6), default=0)
    avg_cost: Mapped[float] = mapped_column(Numeric(18, 6), default=0)

    portfolio: Mapped["Portfolio"] = relationship(back_populates="positions")
