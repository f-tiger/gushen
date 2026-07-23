"""聚合所有 API 路由。"""

from fastapi import APIRouter

from app.api.routes import (
    ai,
    auth,
    backtest,
    health,
    market,
    portfolio,
    portfolios,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(market.router)
api_router.include_router(portfolio.router)
api_router.include_router(portfolios.router)
api_router.include_router(backtest.router)
api_router.include_router(ai.router)
