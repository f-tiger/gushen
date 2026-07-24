"""yfinance 适配器 —— 原型阶段的历史行情源。

⚠️ 合规：yfinance 是非官方接口，底层 Yahoo 数据仅限个人使用，Apache 许可只覆盖
代码不覆盖数据。仅用于原型/研究；对外上线须切换到付费商用授权的数据源
（见 docs/research.md §1）。
"""

from __future__ import annotations

from datetime import date

from app.services.market.base import Bar, MarketDataProvider, Quote


class YFinanceProvider(MarketDataProvider):
    name = "yfinance"

    def get_bars(
        self, symbol: str, start: date, end: date, timeframe: str = "1d"
    ) -> list[Bar]:
        import yfinance as yf

        df = yf.download(
            symbol,
            start=start.isoformat(),
            end=end.isoformat(),
            interval=timeframe,
            progress=False,
            auto_adjust=True,
        )
        bars: list[Bar] = []
        if df is None or df.empty:
            return bars
        # 多 symbol 下载会返回多层列；单 symbol 时取一层即可
        for idx, row in df.iterrows():
            def _val(col: str) -> float:
                v = row[col]
                # 处理可能的多层列
                return float(v.iloc[0] if hasattr(v, "iloc") else v)

            bars.append(
                Bar(
                    time=idx.date(),
                    open=_val("Open"),
                    high=_val("High"),
                    low=_val("Low"),
                    close=_val("Close"),
                    volume=_val("Volume"),
                )
            )
        return bars

    def get_quote(self, symbol: str) -> Quote:
        import yfinance as yf

        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="1d")
        price = float(hist["Close"].iloc[-1]) if not hist.empty else 0.0
        return Quote(symbol=symbol, price=price, delayed=True)

    def get_fundamentals(self, symbol: str) -> dict | None:
        import yfinance as yf

        try:
            info = yf.Ticker(symbol).info
            fcf = info.get("freeCashflow")
            mcap = info.get("marketCap")
            if not fcf or not mcap:
                return None
            return {"fcf": float(fcf), "market_cap": float(mcap),
                    "fcf_yield": float(fcf) / float(mcap)}
        except Exception:  # noqa: BLE001
            return None
