from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    """Application settings — loaded from .env or environment variables."""

    APP_NAME: str = "Globus BTP API"
    DEBUG: bool = True

    # Database — SQLite for dev, PostgreSQL for prod
    DATABASE_URL: str = "sqlite+aiosqlite:///./globus_dev.db"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
