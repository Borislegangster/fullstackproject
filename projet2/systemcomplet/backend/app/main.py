"""Application FastAPI — GLOBUS ENGINEERING (API v1).

Single Source of Truth (PostgreSQL), API First (OpenAPI publié), event-driven (outbox), offline-first
(synchronisation), security by design (RBAC/ABAC, MFA, audit chaîné), observabilité (logs JSON,
métriques, corrélation).
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app import __version__
from app.core.config import settings
from app.core.errors import register_error_handlers
from app.core.logging import setup_logging
from app.core.middleware import (
    MaintenanceMiddleware,
    RequestContextMiddleware,
    SecurityHeadersMiddleware,
    SiteRefreshMiddleware,
)

log = logging.getLogger("globus.app")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    setup_logging()
    from starlette.concurrency import run_in_threadpool

    from app.core.database import SessionLocal
    from app.modules.system.bootstrap import bootstrap
    from app.websocket.hub import hub

    def _boot() -> None:
        with SessionLocal() as db:
            bootstrap(db)

    await run_in_threadpool(_boot)
    await hub.start()
    stop_event = asyncio.Event()
    worker_task = None
    if settings.WORKER_INLINE and settings.ENV != "test":
        from app.workers.main import run_inline

        worker_task = asyncio.create_task(run_inline(stop_event))
    log.info("api_started", extra={"env": settings.ENV, "version": __version__})
    try:
        yield
    finally:
        stop_event.set()
        if worker_task:
            worker_task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await worker_task
        await hub.stop()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=__version__,
        description="API métier GLOBUS ENGINEERING — Concevoir. Calculer. Construire. Contrôler.",
        openapi_url=f"{settings.API_PREFIX}/openapi.json",
        docs_url=f"{settings.API_PREFIX}/docs",
        redoc_url=f"{settings.API_PREFIX}/redoc",
        lifespan=lifespan,
    )
    register_error_handlers(app)
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(MaintenanceMiddleware)
    app.add_middleware(SiteRefreshMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "X-CSRF-Token",
            "Idempotency-Key",
            "X-Client-App",
            "X-App-Version",
            "X-Device-Id",
            "X-Request-ID",
            "X-API-Key",
        ],
        expose_headers=["X-Request-ID", "Idempotent-Replayed", "Content-Disposition"],
    )
    app.add_middleware(RequestContextMiddleware)

    from app.api.router import api_router
    from app.api.system import router as system_router
    from app.websocket.router import router as ws_router

    app.include_router(system_router)
    app.include_router(api_router, prefix=settings.API_PREFIX)
    app.include_router(ws_router)
    return app


app = create_app()
