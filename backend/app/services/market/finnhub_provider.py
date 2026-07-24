"""Finnhub 适配器 —— 原型阶段的实时报价源（免费档 60 次/分钟、实时美股报价）。

⚠️ 合规：Finnhub 免费档限个人/非商用；对外上线须升级付费计划
（见 docs/research.md §1）。需设置 FINNHUB_API_KEY。
"""

from __future__ import annotations

from datetime import date, datetime

from app.core.config import settings
from app.services.market.base import Bar, MarketDataProvider, Quote


class FinnhubProvider(MarketDataProvider):
    name = "finnhub"

    def _client(self):
        import finnhub

        if not settings.finnhub_api_key:
            raise RuntimeError("FINNHUB_API_KEY 未设置")
        return finnhub.Client(api_key=settings.finnhub_api_key)

    def get_bars(
        self, symbol: str, start: date, end: date, timeframe: str = "D"
    ) -> list[Bar]:
        client = self._client()
        res = client.stock_candles(
            symbol,
            timeframe,
            int(datetime.combine(start, datetime.min.time()).timestamp()),
            int(datetime.combine(end, datetime.min.time()).timestamp()),
        )
        if res.get("s") != "ok":
            return []
        bars: list[Bar] = []
        for i, ts in enumerate(res["t"]):
            bars.append(
                Bar(
                    time=datetime.utcfromtimestamp(ts).date(),
                    open=res["o"][i],
                    high=res["h"][i],
                    low=res["l"][i],
                    close=res["c"][i],
                    volume=res["v"][i],
                )
            )
        return bars

    def get_quote(self, symbol: str) -> Quote:
        client = self._client()
        q = client.quote(symbol)
        return Quote(symbol=symbol, price=float(q.get("c", 0.0)), delayed=False)

    def get_news(self, symbol: str) -> list[dict]:
        client = self._client()
        today = date.today()
        frm = today.replace(year=today.year - 1) if today.month == 2 else today
        return client.company_news(
            symbol, _from=frm.isoformat(), to=today.isoformat()
        )[:20]

    def get_fundamentals(self, symbol: str) -> dict | None:
        try:
            client = self._client()
            data = client.company_basic_financials(symbol, "all")
            metric = data.get("metric", {}) if data else {}
            fcf = metric.get("freeCashFlowTTM") or metric.get("freeCashFlowAnnual")
            mcap = metric.get("marketCapitalization")  # 单位：百万美元
            if not fcf or not mcap:
                return None
            market_cap = float(mcap) * 1_000_000
            return {"fcf": float(fcf), "market_cap": market_cap,
                    "fcf_yield": float(fcf) / market_cap}
        except Exception:  # noqa: BLE001
            return None
