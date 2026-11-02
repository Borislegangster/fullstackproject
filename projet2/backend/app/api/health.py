"""Healthcheck endpoints — DB, SMTP, APS, overall readiness, metrics."""
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app import metrics

router = APIRouter(prefix="/health", tags=["Health"])

settings = get_settings()


@router.get("")
async def health():
    """Cheap liveness probe."""
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "time": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/ready")
async def readiness(db: AsyncSession = Depends(get_db)):
    """Readiness probe.

    Production K8s / load-balancer use this to decide whether to route traffic.
    `db` is the only hard dependency — SMTP / APS / uploads are reported but
    don't fail the overall check (the app can still serve most traffic without
    them).
    """
    db_ok = False
    db_detail = ""
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        db_detail = str(e)[:200]

    smtp_ok = bool(settings.SMTP_USER and settings.SMTP_PASS)
    aps_ok = bool(settings.APS_CLIENT_ID and settings.APS_CLIENT_SECRET)

    # Filesystem check — the uploads directory must be writable for PDF
    # generation, document uploads, etc.
    upload_dir = os.path.abspath(
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "uploads")
    )
    uploads_ok = False
    try:
        os.makedirs(upload_dir, exist_ok=True)
        sentinel = os.path.join(upload_dir, ".readyz")
        with open(sentinel, "w") as fh:
            fh.write("ok")
        os.remove(sentinel)
        uploads_ok = True
    except Exception:
        uploads_ok = False

    overall = db_ok and uploads_ok
    return {
        "status": "ok" if overall else "degraded",
        "checks": {
            "db": {"ok": db_ok, "detail": db_detail},
            "smtp": {"ok": smtp_ok, "configured": smtp_ok},
            "aps": {"ok": aps_ok, "configured": aps_ok},
            "uploads": {"ok": uploads_ok, "path": upload_dir},
        },
    }


@router.get("/db")
async def health_db(db: AsyncSession = Depends(get_db)):
    """Database round-trip check."""
    try:
        result = await db.execute(text("SELECT 1"))
        if result.scalar() == 1:
            return {"ok": True}
        return {"ok": False, "detail": "Unexpected DB reply"}
    except Exception as e:
        return {"ok": False, "detail": str(e)[:200]}


@router.get("/smtp")
async def health_smtp():
    """SMTP configuration check — does NOT send a real email."""
    if not settings.SMTP_USER or not settings.SMTP_PASS:
        return {"ok": False, "configured": False, "detail": "SMTP credentials not set"}
    return {
        "ok": True,
        "configured": True,
        "host": settings.SMTP_HOST,
        "port": settings.SMTP_PORT,
        "from": settings.SMTP_FROM or settings.SMTP_USER,
    }


@router.get("/aps")
async def health_aps():
    """Autodesk Platform Services configuration check."""
    if not settings.APS_CLIENT_ID or not settings.APS_CLIENT_SECRET:
        return {"ok": False, "configured": False, "detail": "APS credentials not set"}
    return {"ok": True, "configured": True}


@router.get("/metrics", response_class=Response)
async def prometheus_metrics():
    """Prometheus scrape endpoint — text exposition format."""
    return Response(
        content=metrics.render_prometheus(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


@router.get("/uploads")
async def health_uploads():
    """Upload directory writable check."""
    upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "uploads")
    upload_dir = os.path.abspath(upload_dir)
    try:
        os.makedirs(upload_dir, exist_ok=True)
        test_path = os.path.join(upload_dir, ".healthcheck")
        with open(test_path, "w") as f:
            f.write("ok")
        os.remove(test_path)
        return {"ok": True, "path": upload_dir}
    except Exception as e:
        return {"ok": False, "path": upload_dir, "detail": str(e)[:200]}
