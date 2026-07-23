"""应用配置。所有配置项均可用环境变量覆盖（见 .env.example）。"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # 基本
    app_name: str = "Gushen"
    environment: str = "development"
    debug: bool = True
    api_prefix: str = "/api"

    # 鉴权（⚠️ 生产务必用环境变量覆盖为随机强密钥）
    secret_key: str = "dev-insecure-change-me"

    # 合规姿态：personal（个人自用，放宽免责/个性化）| education_only | advisory
    # 本项目定位为个人自用站，默认 personal。
    compliance_mode: str = "personal"

    # 数据库（默认指向 docker-compose 里的 TimescaleDB）
    database_url: str = "postgresql+psycopg2://gushen:gushen@localhost:5432/gushen"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # 行情数据源
    # 原型阶段：yfinance（历史）+ Finnhub 免费档（实时）。
    # ⚠️ 免费档仅限个人/非商用，对外上线须切换到付费商用授权（见 docs/research.md §1）。
    market_data_provider: str = "yfinance"  # yfinance | finnhub
    finnhub_api_key: str = ""

    # AI（Claude）
    anthropic_api_key: str = ""
    ai_model: str = "claude-sonnet-5"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
