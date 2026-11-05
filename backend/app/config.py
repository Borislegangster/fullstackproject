# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings, SettingsConfigDict
# pyrefly: ignore [missing-import]
from pydantic import field_validator
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """Application settings — loaded from .env or environment variables.

    CRITICAL: Never use default values for secret keys in production.
    All JWT keys must be set explicitly via environment variables.
    Generate with: python -c "import secrets; print(secrets.token_urlsafe(64))"
    """

    APP_NAME: str = "Globus BTP API"
    DEBUG: bool = False  # Secure by default — set DEBUG=True in dev .env

    # Database — SQLite for dev, PostgreSQL for prod (required)
    DATABASE_URL: str = "sqlite+aiosqlite:///./globus_dev.db"

    # JWT — No insecure defaults. Must be set in .env
    JWT_SECRET_KEY: str = ""
    JWT_REFRESH_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    # Rate Limiting
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_API: str = "200/minute"

    # Email / SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SMTP_FROM: str = ""
    FRONTEND_URL: str = "http://localhost:5173"

    # Autodesk Platform Services (Bureau d'Études)
    APS_CLIENT_ID: str = ""
    APS_CLIENT_SECRET: str = ""

    # WebRTC visioconférence (Bureau d'Études) — STUN public + TURN optionnel.
    STUN_URL: str = "stun:stun.l.google.com:19302"
    TURN_URL: str = ""          # e.g. turn:turn.example.com:3478
    TURN_USERNAME: str = ""
    TURN_CREDENTIAL: str = ""

    # Admin
    ADMIN_EMAIL: str = ""

    # Flutterwave Payment Gateway
    FLW_SECRET_KEY: str = ""       # FLWSECK_TEST-... or FLWSECK-...
    FLW_PUBLIC_KEY: str = ""       # FLWPUBK_TEST-... or FLWPUBK-...
    FLW_SECRET_HASH: str = ""      # random string set on Flutterwave dashboard webhook settings
    FLW_ENVIRONMENT: str = "test"  # "test" or "live"

    # Cloud Storage (AWS S3 / Cloudflare R2)
    USE_CLOUD_STORAGE: bool = False
    S3_ENDPOINT_URL: Optional[str] = None  # https://<account_id>.r2.cloudflarestorage.com
    S3_ACCESS_KEY_ID: Optional[str] = None
    S3_SECRET_ACCESS_KEY: Optional[str] = None
    S3_BUCKET_NAME: Optional[str] = None
    S3_REGION_NAME: str = "auto"
    # Public base URL (R2 public bucket / custom domain / CDN) for directly-loadable
    # assets (project photos, logo, CMS media). Required to serve public files from
    # cloud; when unset, public assets stay on the local /uploads dir.
    S3_PUBLIC_BASE_URL: Optional[str] = None  # e.g. https://files.globus-btp.com

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def jwt_secret_must_be_set(cls, v: str, info) -> str:
        """Enforce non-empty JWT secret in non-DEBUG mode.

        In DEBUG (dev), an auto-generated transient secret is used if empty.
        In production (DEBUG=False), an empty secret raises immediately.
        """
        if not v:
            debug = (info.data or {}).get("DEBUG", False)
            if not debug:
                raise ValueError(
                    "JWT_SECRET_KEY must be set in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
                )
            # Dev fallback: generate a per-process key. Tokens won't survive restarts.
            import secrets as _secrets
            return _secrets.token_urlsafe(64)
        return v

    @field_validator("JWT_REFRESH_SECRET_KEY")
    @classmethod
    def jwt_refresh_secret_must_be_set(cls, v: str, info) -> str:
        """Same rules as JWT_SECRET_KEY but for refresh tokens."""
        if not v:
            debug = (info.data or {}).get("DEBUG", False)
            if not debug:
                raise ValueError(
                    "JWT_REFRESH_SECRET_KEY must be set in production."
                )
            import secrets as _secrets
            return _secrets.token_urlsafe(64)
        return v

    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8", 
        case_sensitive=True,
        extra="allow"
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
