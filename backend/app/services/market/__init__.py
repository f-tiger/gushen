"""行情服务工厂：按配置返回对应的数据源适配器。"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.services.market.base import Bar, MarketDataProvider, Quote


@lru_cache
def get_provider(name: str | None = None) -> MarketDataProvider:
    provider = (name or settings.market_data_provider).lower()
    if provider == "finnhub":
        from app.services.market.finnhub_provider import FinnhubProvider

        return FinnhubProvider()
    from app.services.market.yfinance_provider import YFinanceProvider

    return YFinanceProvider()


__all__ = ["Bar", "Quote", "MarketDataProvider", "get_provider"]
