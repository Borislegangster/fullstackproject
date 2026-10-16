"""Santé, métriques Prometheus, statut des services (§23.1)."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request, Response
from prometheus_client import generate_latest
from prometheus_client.exposition import CONTENT_TYPE_LATEST
from sqlalchemy import text

from app import __version__
from app.core import metrics
from app.core.config import settings
from app.core.database import SessionLocal

router = APIRouter(tags=["Système"])
_STARTED = time.time()


@router.get("/health/live")
def live() -> dict[str, Any]:
    return {"status": "ok", "version": __version__, "uptime_s": int(time.time() - _STARTED)}


@router.get("/health/ready")
def ready(response: Response) -> dict[str, Any]:
    checks: dict[str, Any] = {}
    ok = True
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:  # noqa: BLE001
        checks["database"] = f"error: {type(exc).__name__}"
        ok = False
    if settings.REDIS_URL:
        try:
            import redis

            redis.Redis.from_url(settings.REDIS_URL, socket_timeout=1).ping()
            checks["redis"] = "ok"
        except Exception as exc:  # noqa: BLE001
            checks["redis"] = f"error: {type(exc).__name__}"
            ok = False
    for name, folder in (
        ("public_media", settings.PUBLIC_MEDIA_DIR),
        ("private_storage", settings.PRIVATE_STORAGE_DIR),
    ):
        if name == "private_storage" and settings.PRIVATE_STORAGE_BACKEND != "local":
            continue
        try:
            path = Path(folder)
            path.mkdir(parents=True, exist_ok=True)
            probe = path / ".probe"
            probe.write_text("ok")
            probe.unlink()
            checks[name] = "ok"
        except OSError as exc:
            checks[name] = f"error: {exc.__class__.__name__}"
            ok = False
    if not ok:
        response.status_code = 503
    return {"status": "ok" if ok else "degraded", "checks": checks}


@router.get("/metrics", include_in_schema=False)
def prometheus(request: Request) -> Response:
    return Response(generate_latest(metrics.registry), media_type=CONTENT_TYPE_LATEST)
