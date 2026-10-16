"""Analytics vitrine (§23) : collecte d'événements (respect du consentement), sessions, canaux UTM,
appareils/OS, géographie licite (en-têtes CDN), agrégats quotidiens, tableaux de bord segmentables par
période (V4-ANALYTICS-35/36). Aucune IP brute conservée (§28.1)."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, date, datetime, timedelta
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import Date, case, cast, distinct, func, literal, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.utils import utcnow
from app.modules.analytics.models import (
    AnalyticsEvent,
    AnalyticsSalt,
    AnalyticsSession,
    ContentMetric,
    PageMetric,
    SessionMetric,
    SocialClickMetric,
    TechnicalMetric,
)

SOCIAL_HOSTS = {
    "facebook.com": "facebook",
    "m.facebook.com": "facebook",
    "l.facebook.com": "facebook",
    "instagram.com": "instagram",
    "l.instagram.com": "instagram",
    "linkedin.com": "linkedin",
    "lnkd.in": "linkedin",
    "t.co": "x",
    "twitter.com": "x",
    "x.com": "x",
    "tiktok.com": "tiktok",
    "youtube.com": "youtube",
    "wa.me": "whatsapp",
    "web.whatsapp.com": "whatsapp",
}
SEARCH_HOSTS = ("google.", "bing.", "duckduckgo.", "yahoo.", "qwant.", "ecosia.")
CONVERSION_TYPES = {
    "form_submit",
    "conversion",
    "describe_project_submit",
    "contact_submit",
    "estimator_submit",
    "instant_estimate_submit",
    "newsletter_subscribe",
    "whatsapp_click",
    "phone_click",
    "cta_click",
}
_salt_cache: dict[str, str] = {}


def daily_salt(day: date | None = None) -> str:
    """Sel rotatif quotidien (le hachage des visiteurs n'est pas corrélable d'un jour à l'autre)."""
    day = day or datetime.now(UTC).date()
    key = day.isoformat()
    if key in _salt_cache:
        return _salt_cache[key]
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        row = db.get(AnalyticsSalt, day)
        if row is None:
            salt = secrets.token_hex(16)
            db.execute(
                insert(AnalyticsSalt)
                .values(day=day, salt=salt, created_at=utcnow())
                .on_conflict_do_nothing(index_elements=["day"])
            )
            db.commit()
            row = db.get(AnalyticsSalt, day)
        value = row.salt if row else secrets.token_hex(16)
    except Exception:  # noqa: BLE001
        value = hashlib.sha256(key.encode()).hexdigest()[:32]
    finally:
        db.close()
    _salt_cache.clear()
    _salt_cache[key] = value
    return value


def classify_channel(referrer: str | None, utm_medium: str | None, utm_source: str | None, own_host: str) -> str:
    medium = (utm_medium or "").lower()
    if medium in ("cpc", "ppc", "paid", "paid_social", "display", "ads", "cpm"):
        return "paid"
    if medium in ("email", "newsletter"):
        return "email"
    if medium in ("social", "social_organic"):
        return "social"
    if not referrer:
        return "direct" if not utm_source else "referral"
    host = (urlparse(referrer).hostname or "").lower().removeprefix("www.")
    if not host or host == own_host:
        return "direct"
    if host in SOCIAL_HOSTS:
        return "social"
    if any(h in host for h in SEARCH_HOSTS):
        return "organic"
    return "referral"


def parse_device(user_agent: str | None) -> tuple[str, str | None, str | None]:
    if not user_agent:
        return "desktop", None, None
    try:
        from user_agents import parse

        ua = parse(user_agent)
        device = "bot" if ua.is_bot else "mobile" if ua.is_mobile else "tablet" if ua.is_tablet else "desktop"
        os_family = ua.os.family
        os_name = {
            "Mac OS X": "macOS",
            "iOS": "iOS",
            "Android": "Android",
            "Windows": "Windows",
            "Linux": "Linux",
            "Ubuntu": "Linux",
            "Chrome OS": "ChromeOS",
        }.get(os_family, os_family)
        return device, os_name, ua.browser.family
    except Exception:  # noqa: BLE001
        return "desktop", None, None


def ingest(db: Session, *, session_id: str, events: list[dict[str, Any]], context: dict[str, Any]) -> int:
    """Enregistre un lot d'événements du navigateur ; crée/actualise la session."""
    if not session_id or len(session_id) > 64:
        return 0
    now = utcnow()
    session = db.get(AnalyticsSession, session_id)
    device, os_name, browser = parse_device(context.get("user_agent"))
    if device == "bot":
        return 0
    if session is None:
        own_host = (context.get("own_host") or "").removeprefix("www.")
        utm = context.get("utm") or {}
        session = AnalyticsSession(
            id=session_id,
            visitor_hash=context.get("visitor_hash", ""),
            consent_analytics=bool(context.get("consent")),
            started_at=now,
            last_seen_at=now,
            landing_path=(context.get("landing") or "")[:500] or None,
            referrer_host=(urlparse(context.get("referrer") or "").hostname or None),
            channel=classify_channel(context.get("referrer"), utm.get("medium"), utm.get("source"), own_host),
            utm_source=utm.get("source"),
            utm_medium=utm.get("medium"),
            utm_campaign=utm.get("campaign"),
            utm_content=utm.get("content"),
            utm_term=utm.get("term"),
            device_type=device,
            os=os_name,
            browser=browser,
            country=context.get("country"),
            region=context.get("region") if context.get("consent") else None,
            city=context.get("city") if context.get("consent") else None,
            language=context.get("language"),
            is_new_visitor=bool(context.get("is_new", True)),
            user_id=context.get("user_id"),
        )
        db.add(session)
        db.flush()
    stored = 0
    for raw in events[:50]:
        etype = str(raw.get("type", ""))[:40]
        if not etype:
            continue
        path = str(raw.get("path") or "")[:500] or None
        db.add(
            AnalyticsEvent(
                session_id=session_id,
                ts=now,
                type=etype,
                path=path,
                title=(raw.get("title") or None),
                target=(str(raw.get("target"))[:200] if raw.get("target") else None),
                value=float(raw["value"]) if isinstance(raw.get("value"), (int, float)) else None,
                content_type=raw.get("content_type"),
                content_id=str(raw.get("content_id"))[:80] if raw.get("content_id") else None,
                props={k: v for k, v in (raw.get("props") or {}).items() if isinstance(v, (str, int, float, bool))},
            )
        )
        stored += 1
        if etype == "page_view":
            session.page_views += 1
            session.exit_path = path
        if etype in CONVERSION_TYPES and etype != "cta_click":
            session.converted = True
            types = set(session.conversion_types or [])
            types.add(str(raw.get("target") or etype))
            session.conversion_types = sorted(types)
    session.events_count += stored
    session.last_seen_at = now
    session.duration_seconds = int((now - session.started_at).total_seconds())
    return stored


def record_server_event(
    db: Session,
    etype: str,
    *,
    path: str | None = None,
    target: str | None = None,
    value: float | None = None,
    content_type: str | None = None,
    content_id: str | None = None,
    session_id: str | None = None,
) -> None:
    """Événement généré côté serveur (conversion, like, partage, commentaire)."""
    sid = session_id or "server"
    if db.get(AnalyticsSession, sid) is None and sid == "server":
        db.add(AnalyticsSession(id="server", visitor_hash="server", device_type="bot", channel="direct"))
        db.flush()
    db.add(
        AnalyticsEvent(
            session_id=sid,
            type=etype,
            path=path,
            target=target,
            value=value,
            content_type=content_type,
            content_id=content_id,
        )
    )


# ---------------------------------------------------------------------------- agrégats
def aggregate_day(db: Session, day: date) -> dict[str, int]:
    start = datetime(day.year, day.month, day.day, tzinfo=UTC)
    end = start + timedelta(days=1)
    for model in (SessionMetric, PageMetric, SocialClickMetric, ContentMetric, TechnicalMetric):
        db.query(model).filter(model.day == day).delete()
    sessions = (
        select(AnalyticsSession)
        .where(AnalyticsSession.started_at >= start, AnalyticsSession.started_at < end, AnalyticsSession.id != "server")
        .subquery()
    )
    dims = {
        "all": None,
        "device": sessions.c.device_type,
        "os": sessions.c.os,
        "country": sessions.c.country,
        "channel": sessions.c.channel,
        "utm_source": sessions.c.utm_source,
        "utm_medium": sessions.c.utm_medium,
        "utm_campaign": sessions.c.utm_campaign,
        "utm_content": sessions.c.utm_content,
        "utm_term": sessions.c.utm_term,
        "landing": sessions.c.landing_path,
        "browser": sessions.c.browser,
        "city": sessions.c.city,
    }
    count = 0
    for dim, col in dims.items():
        value_col = col if col is not None else literal("all")
        rows = db.execute(
            select(
                func.coalesce(value_col, "(non défini)").label("v"),
                func.count().label("s"),
                func.count(distinct(sessions.c.visitor_hash)).label("vis"),
                func.sum(case((sessions.c.is_new_visitor.is_(True), 1), else_=0)).label("new"),
                func.coalesce(func.sum(sessions.c.page_views), 0).label("pv"),
                func.coalesce(func.sum(sessions.c.duration_seconds), 0).label("dur"),
                func.sum(case((sessions.c.page_views <= 1, 1), else_=0)).label("b"),
                func.sum(case((sessions.c.converted.is_(True), 1), else_=0)).label("c"),
            ).group_by("v")
        ).all()
        for r in rows:
            db.add(
                SessionMetric(
                    day=day,
                    dimension=dim,
                    dimension_value=str(r.v)[:200],
                    sessions=r.s,
                    visitors=r.vis,
                    new_visitors=r.new or 0,
                    page_views=r.pv or 0,
                    total_duration=r.dur or 0,
                    bounces=r.b or 0,
                    conversions=r.c or 0,
                )
            )
            count += 1
    events = select(AnalyticsEvent).where(AnalyticsEvent.ts >= start, AnalyticsEvent.ts < end).subquery()
    pv = db.execute(
        select(events.c.path, func.count(), func.count(distinct(events.c.session_id)))
        .where(events.c.type == "page_view", events.c.path.is_not(None))
        .group_by(events.c.path)
    ).all()
    read = dict(
        db.execute(
            select(events.c.path, func.coalesce(func.sum(events.c.value), 0))
            .where(events.c.type == "read_time")
            .group_by(events.c.path)
        ).all()
    )
    scroll = dict(
        db.execute(
            select(events.c.path, func.avg(events.c.value)).where(events.c.type == "scroll").group_by(events.c.path)
        ).all()
    )
    ctas = dict(
        db.execute(
            select(events.c.path, func.count()).where(events.c.type == "cta_click").group_by(events.c.path)
        ).all()
    )
    entries = dict(db.execute(select(sessions.c.landing_path, func.count()).group_by(sessions.c.landing_path)).all())
    exits = dict(db.execute(select(sessions.c.exit_path, func.count()).group_by(sessions.c.exit_path)).all())
    for path, views, uniq in pv:
        db.add(
            PageMetric(
                day=day,
                path=path,
                views=views,
                unique_visitors=uniq,
                entries=entries.get(path, 0),
                exits=exits.get(path, 0),
                total_time_seconds=int(read.get(path, 0) or 0),
                avg_scroll=float(scroll[path]) if scroll.get(path) is not None else None,
                cta_clicks=ctas.get(path, 0),
            )
        )
        count += 1
    social = (
        select(
            events.c.target.label("network"), func.coalesce(events.c.props["location"].as_string(), "site").label("loc")
        )
        .where(events.c.type == "social_click")
        .subquery()
    )
    for network, location, n in db.execute(
        select(social.c.network, social.c.loc, func.count()).group_by(social.c.network, social.c.loc)
    ).all():
        db.add(
            SocialClickMetric(
                day=day, network=(network or "inconnu")[:30], location=(location or "site")[:30], clicks=n
            )
        )
        count += 1
    content_rows = db.execute(
        select(
            events.c.content_type,
            events.c.content_id,
            func.sum(case((events.c.type == "page_view", 1), else_=0)),
            func.coalesce(func.sum(case((events.c.type == "read_time", events.c.value), else_=0)), 0),
            func.sum(case((events.c.type == "blog_like", 1), else_=0)),
            func.sum(case((events.c.type == "blog_comment", 1), else_=0)),
            func.sum(case((events.c.type == "blog_reply", 1), else_=0)),
            func.sum(case((events.c.type == "blog_share", 1), else_=0)),
            func.sum(case((events.c.type == "cta_click", 1), else_=0)),
        )
        .where(events.c.content_type.is_not(None), events.c.content_id.is_not(None))
        .group_by(events.c.content_type, events.c.content_id)
    ).all()
    for ctype, cid, views, read_t, likes, comments, replies, shares, cta in content_rows:
        db.add(
            ContentMetric(
                day=day,
                content_type=ctype,
                content_id=cid,
                views=views or 0,
                read_time_total=int(read_t or 0),
                likes=likes or 0,
                comments=comments or 0,
                replies=replies or 0,
                shares=shares or 0,
                cta_clicks=cta or 0,
            )
        )
        count += 1
    for kind, key, n in db.execute(
        select(events.c.type, events.c.path, func.count())
        .where(events.c.type.in_(["not_found", "js_error"]))
        .group_by(events.c.type, events.c.path)
    ).all():
        db.add(TechnicalMetric(day=day, kind=kind, key=(key or "/")[:500], count=n))
        count += 1
    for metric, n, p75 in db.execute(
        select(events.c.target, func.count(), func.percentile_cont(0.75).within_group(events.c.value))
        .where(events.c.type == "web_vital")
        .group_by(events.c.target)
    ).all():
        db.add(
            TechnicalMetric(
                day=day, kind=f"vital_{metric}"[:20], key="global", count=n, p75=float(p75) if p75 is not None else None
            )
        )
        count += 1
    db.flush()
    return {"items": count}


def aggregate_daily(db: Session) -> dict[str, Any]:
    yesterday = datetime.now(UTC).date() - timedelta(days=1)
    result = aggregate_day(db, yesterday)
    today = datetime.now(UTC).date()
    aggregate_day(db, today)
    return {"items": result["items"], "day": yesterday.isoformat()}


# ---------------------------------------------------------------------------- tableaux de bord
def _period(start: date, end: date, compare: bool) -> tuple[date, date, date | None, date | None]:
    if not compare:
        return start, end, None, None
    span = (end - start).days + 1
    return start, end, start - timedelta(days=span), start - timedelta(days=1)


def overview(db: Session, start: date, end: date, *, compare: bool = True, granularity: str = "day") -> dict[str, Any]:
    """Synthèse segmentée par période (jour/semaine/mois/trimestre/année) avec comparaison."""
    aggregate_day(db, datetime.now(UTC).date())  # données du jour à jour
    s, e, ps, pe = _period(start, end, compare)

    def totals(a: date, b: date) -> dict[str, Any]:
        row = db.execute(
            select(
                func.coalesce(func.sum(SessionMetric.sessions), 0),
                func.coalesce(func.sum(SessionMetric.visitors), 0),
                func.coalesce(func.sum(SessionMetric.new_visitors), 0),
                func.coalesce(func.sum(SessionMetric.page_views), 0),
                func.coalesce(func.sum(SessionMetric.total_duration), 0),
                func.coalesce(func.sum(SessionMetric.bounces), 0),
                func.coalesce(func.sum(SessionMetric.conversions), 0),
            ).where(SessionMetric.dimension == "all", SessionMetric.day >= a, SessionMetric.day <= b)
        ).one()
        sessions, visitors, new, pv, dur, bounces, conv = (int(x or 0) for x in row)
        return {
            "sessions": sessions,
            "visitors": visitors,
            "new_visitors": new,
            "returning_visitors": max(0, visitors - new),
            "page_views": pv,
            "avg_duration_s": round(dur / sessions, 1) if sessions else 0,
            "pages_per_session": round(pv / sessions, 2) if sessions else 0,
            "bounce_rate": round(bounces * 100 / sessions, 1) if sessions else 0,
            "conversions": conv,
            "conversion_rate": round(conv * 100 / sessions, 2) if sessions else 0,
        }

    trunc = {"day": "day", "week": "week", "month": "month", "quarter": "quarter", "year": "year"}.get(
        granularity, "day"
    )
    bucket = cast(func.date_trunc(trunc, cast(SessionMetric.day, Date)), Date).label("bucket")
    series = db.execute(
        select(
            bucket,
            func.sum(SessionMetric.sessions),
            func.sum(SessionMetric.visitors),
            func.sum(SessionMetric.page_views),
            func.sum(SessionMetric.conversions),
        )
        .where(SessionMetric.dimension == "all", SessionMetric.day >= s, SessionMetric.day <= e)
        .group_by(bucket)
        .order_by(bucket)
    ).all()
    current = totals(s, e)
    previous = totals(ps, pe) if ps and pe else None

    def breakdown(dimension: str, limit: int = 10) -> list[dict[str, Any]]:
        rows = db.execute(
            select(SessionMetric.dimension_value, func.sum(SessionMetric.sessions), func.sum(SessionMetric.conversions))
            .where(SessionMetric.dimension == dimension, SessionMetric.day >= s, SessionMetric.day <= e)
            .group_by(SessionMetric.dimension_value)
            .order_by(func.sum(SessionMetric.sessions).desc())
            .limit(limit)
        ).all()
        return [{"value": v, "sessions": int(n or 0), "conversions": int(c or 0)} for v, n, c in rows]

    pages = db.execute(
        select(
            PageMetric.path,
            func.sum(PageMetric.views),
            func.sum(PageMetric.entries),
            func.sum(PageMetric.exits),
            func.sum(PageMetric.total_time_seconds),
            func.sum(PageMetric.cta_clicks),
        )
        .where(PageMetric.day >= s, PageMetric.day <= e)
        .group_by(PageMetric.path)
        .order_by(func.sum(PageMetric.views).desc())
        .limit(20)
    ).all()
    conversions = db.execute(
        select(AnalyticsEvent.target, AnalyticsEvent.type, func.count())
        .where(
            AnalyticsEvent.type.in_(CONVERSION_TYPES),
            cast(AnalyticsEvent.ts, Date) >= s,
            cast(AnalyticsEvent.ts, Date) <= e,
        )
        .group_by(AnalyticsEvent.target, AnalyticsEvent.type)
        .order_by(func.count().desc())
        .limit(20)
    ).all()
    social = db.execute(
        select(SocialClickMetric.network, func.sum(SocialClickMetric.clicks))
        .where(SocialClickMetric.day >= s, SocialClickMetric.day <= e)
        .group_by(SocialClickMetric.network)
        .order_by(func.sum(SocialClickMetric.clicks).desc())
    ).all()
    technical = db.execute(
        select(
            TechnicalMetric.kind, TechnicalMetric.key, func.sum(TechnicalMetric.count), func.avg(TechnicalMetric.p75)
        )
        .where(TechnicalMetric.day >= s, TechnicalMetric.day <= e)
        .group_by(TechnicalMetric.kind, TechnicalMetric.key)
        .order_by(func.sum(TechnicalMetric.count).desc())
        .limit(30)
    ).all()
    searches = db.execute(
        select(AnalyticsEvent.target, func.count())
        .where(AnalyticsEvent.type == "search", cast(AnalyticsEvent.ts, Date) >= s, cast(AnalyticsEvent.ts, Date) <= e)
        .group_by(AnalyticsEvent.target)
        .order_by(func.count().desc())
        .limit(20)
    ).all()
    return {
        "period": {"start": s, "end": e, "previous_start": ps, "previous_end": pe, "granularity": trunc},
        "totals": current,
        "previous": previous,
        "series": [
            {
                "bucket": b,
                "sessions": int(a or 0),
                "visitors": int(v or 0),
                "page_views": int(p or 0),
                "conversions": int(c or 0),
            }
            for b, a, v, p, c in series
        ],
        "devices": breakdown("device"),
        "os": breakdown("os"),
        "countries": breakdown("country", 20),
        "cities": breakdown("city", 20),
        "browsers": breakdown("browser"),
        "channels": breakdown("channel"),
        "campaigns": breakdown("utm_campaign", 20),
        "sources": breakdown("utm_source", 20),
        "mediums": breakdown("utm_medium"),
        "contents": breakdown("utm_content"),
        "terms": breakdown("utm_term"),
        "landing_pages": breakdown("landing", 20),
        "pages": [
            {
                "path": p,
                "views": int(v or 0),
                "entries": int(en or 0),
                "exits": int(ex or 0),
                "time_s": int(t or 0),
                "cta_clicks": int(c or 0),
            }
            for p, v, en, ex, t, c in pages
        ],
        "conversions": [{"target": t, "type": ty, "count": n} for t, ty, n in conversions],
        "social_clicks": [{"network": n, "clicks": int(c or 0)} for n, c in social],
        "technical": [
            {"kind": k, "key": key, "count": int(n or 0), "p75": float(p) if p is not None else None}
            for k, key, n, p in technical
        ],
        "searches": [{"query": q, "count": n} for q, n in searches],
    }


def blog_stats(db: Session, start: date, end: date) -> list[dict[str, Any]]:
    from app.modules.cms.models import BlogPost

    aggregate_day(db, datetime.now(UTC).date())
    rows = db.execute(
        select(
            ContentMetric.content_id,
            func.sum(ContentMetric.views),
            func.sum(ContentMetric.read_time_total),
            func.sum(ContentMetric.likes),
            func.sum(ContentMetric.comments),
            func.sum(ContentMetric.replies),
            func.sum(ContentMetric.shares),
        )
        .where(ContentMetric.content_type == "blog_post", ContentMetric.day >= start, ContentMetric.day <= end)
        .group_by(ContentMetric.content_id)
    ).all()
    posts = {str(p.id): p for p in db.execute(select(BlogPost)).scalars()}
    out = []
    for cid, views, read_t, likes, comments, replies, shares in rows:
        post = posts.get(cid)
        out.append(
            {
                "post_id": cid,
                "title": post.title if post else cid,
                "slug": post.slug if post else None,
                "views": int(views or 0),
                "avg_read_s": round((read_t or 0) / views, 1) if views else 0,
                "likes": int(likes or 0),
                "comments": int(comments or 0),
                "replies": int(replies or 0),
                "shares": int(shares or 0),
            }
        )
    for pid, post in posts.items():
        if pid not in {o["post_id"] for o in out} and post.status == "published":
            out.append(
                {
                    "post_id": pid,
                    "title": post.title,
                    "slug": post.slug,
                    "views": 0,
                    "avg_read_s": 0,
                    "likes": 0,
                    "comments": 0,
                    "replies": 0,
                    "shares": 0,
                    "totals": {
                        "views": post.view_count,
                        "likes": post.like_count,
                        "comments": post.comment_count,
                        "shares": post.share_count,
                    },
                }
            )
    return sorted(out, key=lambda x: x["views"], reverse=True)
