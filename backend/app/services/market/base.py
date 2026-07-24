"""行情数据源抽象层。

业务层只依赖 MarketDataProvider 接口；换源 / 多源聚合只需替换适配器，
不改动业务代码（见 docs/architecture.md §5）。
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date


@dataclass
class Bar:
    """一根 K 线。"""

    time: date
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass
class Quote:
    """一条报价。delayed=True 表示延迟行情（免费源常见）。"""

    symbol: str
    price: float
    delayed: bool = True


class MarketDataProvider(ABC):
    """行情数据源统一接口。"""

    name: str = "base"

    @abstractmethod
    def get_bars(
        self, symbol: str, start: date, end: date, timeframe: str = "1d"
    ) -> list[Bar]:
        """历史 K 线。"""

    @abstractmethod
    def get_quote(self, symbol: str) -> Quote:
        """最新报价。"""

    def get_news(self, symbol: str) -> list[dict]:
        """相关新闻（可选实现）。"""
        return []

    def get_fundamentals(self, symbol: str) -> dict | None:
        """基本面（可选实现）：返回 {fcf, market_cap, fcf_yield} 或 None。

        FCF yield = 自由现金流 / 市值，是多倍股最强预测因子
        （docs/research-high-return.md §3）。默认不实现。
        """
        return None
