"""Structured logging configuration — JSON output in prod, human-friendly in DEV.

Initialised once at startup by `app.main`. Other modules just use
`structlog.get_logger(__name__)` or `logging.getLogger(__name__)` — the
emitted log records flow through this pipeline.
"""
from __future__ import annotations

import logging
import os
import sys

import structlog

from app.config import get_settings


def setup_logging() -> None:
    """Configure structlog and the stdlib logger for the running process."""
    settings = get_settings()
    in_dev = bool(settings.DEBUG)

    # ── stdlib logging — JSON in prod, indented text in dev ──
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.INFO)
    root = logging.getLogger()
    # Drop default Uvicorn duplicates
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)

    # Tone down libs
    for noisy in ("uvicorn.access", "sqlalchemy.engine", "watchfiles"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    # ── structlog pipeline ──
    processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]
    if in_dev:
        processors.append(structlog.dev.ConsoleRenderer(colors=False))
    else:
        processors.append(structlog.processors.JSONRenderer())

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def init_sentry() -> bool:
    """Initialise Sentry if SENTRY_DSN is set. Returns True if active."""
    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        return False
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=dsn,
            integrations=[FastApiIntegration(), SqlalchemyIntegration()],
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_RATE", "0.1")),
            send_default_pii=False,
            environment=os.getenv("SENTRY_ENV", "development"),
        )
        return True
    except Exception:
        return False
