"""API analytics : collecte publique (respect du consentement) et tableaux de bord ERP."""

from __future__ import annotations

import hashlib
from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import OptionalPrincipal, Principal, require
from app.core.middleware import client_ip
from app.core.ratelimit import rate_limit
from app.core.utils import jsonable
from app.modules.analytics import service

public = APIRouter(prefix="/public/analytics", tags=["Analytics (public)"])
router = APIRouter(prefix="/analytics", tags=["Analytics"])


class CollectEvent(BaseModel):
    type: str = Field(max_length=40)
    path: str | None = Field(default=None, max_length=500)
    title: str | None = Field(default=None, max_length=300)
    target: str | None = Field(default=None, max_length=200)
    value: float | None = None
    content_type: str | None = Field(default=None, max_length=40)
    content_id: str | None = Field(default=None, max_length=80)
    props: dict[str, Any] = Field(default_factory=dict)


class CollectIn(BaseModel):
    session_id: str = Field(min_length=8, max_length=64)
    visitor_id: str | None = Field(default=None, max_length=64)  # présent uniquement si consentement
    consent: bool = False
    referrer: str | None = Field(default=None, max_length=500)
    landing: str | None = Field(default=None, max_length=500)
    language: str | None = Field(default=None, max_length=10)
    utm: dict[str, str] = Field(default_factory=dict)
    is_new: bool = True
    events: list[CollectEvent] = Field(min_length=1, max_length=50)


@public.post("/collect", status_code=202)
def collect(
    data: CollectIn,
    request: Request,
    principal: OptionalPrincipal,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit("analytics", settings.RATE_LIMIT_ANALYTICS)),
) -> dict[str, Any]:
    if request.headers.get("dnt") == "1" and not data.consent:
        return {"accepted": 0}
    ua = request.headers.get("user-agent", "")[:400]
    if data.consent and data.visitor_id:
        visitor = hashlib.sha256(("v:" + data.visitor_id).encode()).hexdigest()
    else:
        visitor = hashlib.sha256((service.daily_salt() + (client_ip(request.scope) or "") + ua).encode()).hexdigest()
    country = (request.headers.get("cf-ipcountry") or request.headers.get("x-country-code") or "")[:2].upper() or None
    context = {
        "visitor_hash": visitor,
        "consent": data.consent,
        "user_agent": ua,
        "referrer": data.referrer,
        "landing": data.landing,
        "language": data.language,
        "is_new": data.is_new,
        "utm": {
            k: str(v)[:160] for k, v in data.utm.items() if k in ("source", "medium", "campaign", "content", "term")
        },
        "own_host": (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").split(":")[0],
        "country": country,
        "region": request.headers.get("cf-region") or request.headers.get("x-region"),
        "city": request.headers.get("cf-ipcity") or request.headers.get("x-city"),
        "user_id": principal.id if principal else None,
    }
    stored = service.ingest(
        db, session_id=data.session_id, events=[e.model_dump() for e in data.events], context=context
    )
    db.commit()
    return {"accepted": stored}


def _range(start: date | None, end: date | None, period: str | None) -> tuple[date, date]:
    today = datetime.now(UTC).date()
    if period == "today":
        return today, today
    if period == "7d":
        return today - timedelta(days=6), today
    if period == "30d" or (start is None and end is None and period is None):
        return today - timedelta(days=29), today
    if period == "quarter":
        q_start = date(today.year, 3 * ((today.month - 1) // 3) + 1, 1)
        return q_start, today
    if period == "year":
        return date(today.year, 1, 1), today
    if period == "12m":
        return today - timedelta(days=364), today
    return start or today - timedelta(days=29), end or today


@router.get("/overview")
def overview(
    start: date | None = None,
    end: date | None = None,
    period: str | None = Query(None, pattern="^(today|7d|30d|quarter|year|12m|custom)$"),
    granularity: str = Query("day", pattern="^(day|week|month|quarter|year)$"),
    compare: bool = True,
    principal: Principal = Depends(require("analytics:read")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    s, e = _range(start, end, period)
    result = service.overview(db, s, e, compare=compare, granularity=granularity)
    db.commit()
    return jsonable(result)


@router.get("/blog")
def blog(
    start: date | None = None,
    end: date | None = None,
    period: str | None = None,
    principal: Principal = Depends(require("analytics:read")),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    s, e = _range(start, end, period)
    result = service.blog_stats(db, s, e)
    db.commit()
    return jsonable(result)


@router.post("/aggregate")
def aggregate(
    day: date | None = None, principal: Principal = Depends(require("analytics:read")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    result = service.aggregate_day(db, day or datetime.now(UTC).date())
    db.commit()
    return result


@router.get("/ga4")
def ga4(
    start: str = "30daysAgo",
    end: str = "today",
    dimensions: str = "sessionSourceMedium",
    metrics: str = "sessions,conversions",
    principal: Principal = Depends(require("analytics:read")),
) -> dict[str, Any]:
    """Rapport GA4 Data API (si configuré) — complète les données propriétaires (Ads, audiences)."""
    from app.providers.geo import ga4_report

    return ga4_report(
        start=start,
        end=end,
        dimensions=[d for d in dimensions.split(",") if d][:5],
        metrics=[m for m in metrics.split(",") if m][:8],
    )
