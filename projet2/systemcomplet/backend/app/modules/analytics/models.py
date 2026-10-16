"""Analytics propriétaire : AnalyticsEvent, sessions, SessionMetric, PageMetric, SocialClickMetric, ContentMetric,
TechnicalMetric (§23). Aucune IP brute n'est conservée (hachage salé rotatif, §28.1)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import BigInteger, Date, Float, Identity, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, bigint_col, bool_col, dt_col, json_col, str_col
from app.core.utils import utcnow


class AnalyticsSession(Base):
    __tablename__ = "analytics_sessions"
    __table_args__ = (Index("ix_analytics_sessions_started", "started_at"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    visitor_hash: Mapped[str] = str_col(64, nullable=False, index=True)
    consent_analytics: Mapped[bool] = bool_col(False)
    started_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now(), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now(), nullable=False)
    landing_path: Mapped[str | None] = str_col(500)
    exit_path: Mapped[str | None] = str_col(500)
    referrer_host: Mapped[str | None] = str_col(200)
    channel: Mapped[str] = str_col(
        20, nullable=False, default="direct"
    )  # organic / paid / social / referral / email / direct
    utm_source: Mapped[str | None] = str_col(120)
    utm_medium: Mapped[str | None] = str_col(120)
    utm_campaign: Mapped[str | None] = str_col(160)
    utm_content: Mapped[str | None] = str_col(160)
    utm_term: Mapped[str | None] = str_col(160)
    device_type: Mapped[str] = str_col(10, nullable=False, default="desktop")  # mobile / tablet / desktop / bot
    os: Mapped[str | None] = str_col(40)
    browser: Mapped[str | None] = str_col(40)
    country: Mapped[str | None] = str_col(2)
    region: Mapped[str | None] = str_col(100)
    city: Mapped[str | None] = str_col(100)
    language: Mapped[str | None] = str_col(10)
    page_views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    events_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_new_visitor: Mapped[bool] = bool_col(True)
    converted: Mapped[bool] = bool_col(False)
    conversion_types: Mapped[list[Any]] = json_col(list)
    user_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"
    __table_args__ = (
        Index("ix_analytics_events_ts", "ts"),
        Index("ix_analytics_events_session", "session_id"),
        Index("ix_analytics_events_type_ts", "type", "ts"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    session_id: Mapped[str] = str_col(64, nullable=False)
    ts: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now(), nullable=False)
    type: Mapped[str] = str_col(
        40, nullable=False
    )  # page_view / cta_click / form_start / form_submit / conversion / blog_like / blog_share / social_click / search / not_found / js_error / web_vital / scroll / read_time / outbound
    path: Mapped[str | None] = str_col(500)
    title: Mapped[str | None] = str_col(300)
    target: Mapped[str | None] = str_col(200)
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    content_type: Mapped[str | None] = str_col(40)
    content_id: Mapped[str | None] = str_col(80)
    props: Mapped[dict[str, Any]] = json_col(dict)


class SessionMetric(Base):
    """Agrégats quotidiens par dimension (device, os, country, channel, utm_campaign, landing…)."""

    __tablename__ = "analytics_session_metrics"
    __table_args__ = (UniqueConstraint("day", "dimension", "dimension_value"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    dimension: Mapped[str] = str_col(30, nullable=False)
    dimension_value: Mapped[str] = str_col(200, nullable=False)
    sessions: Mapped[int] = bigint_col(0)
    visitors: Mapped[int] = bigint_col(0)
    new_visitors: Mapped[int] = bigint_col(0)
    page_views: Mapped[int] = bigint_col(0)
    total_duration: Mapped[int] = bigint_col(0)
    bounces: Mapped[int] = bigint_col(0)
    conversions: Mapped[int] = bigint_col(0)


class PageMetric(Base):
    __tablename__ = "analytics_page_metrics"
    __table_args__ = (UniqueConstraint("day", "path"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    path: Mapped[str] = str_col(500, nullable=False)
    views: Mapped[int] = bigint_col(0)
    unique_visitors: Mapped[int] = bigint_col(0)
    entries: Mapped[int] = bigint_col(0)
    exits: Mapped[int] = bigint_col(0)
    total_time_seconds: Mapped[int] = bigint_col(0)
    avg_scroll: Mapped[float | None] = mapped_column(Float, nullable=True)
    cta_clicks: Mapped[int] = bigint_col(0)


class SocialClickMetric(Base):
    __tablename__ = "analytics_social_metrics"
    __table_args__ = (UniqueConstraint("day", "network", "location"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    network: Mapped[str] = str_col(30, nullable=False)
    location: Mapped[str] = str_col(30, nullable=False, default="site")  # header / footer / share / blog / contact
    clicks: Mapped[int] = bigint_col(0)


class ContentMetric(Base):
    __tablename__ = "analytics_content_metrics"
    __table_args__ = (UniqueConstraint("day", "content_type", "content_id"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    content_type: Mapped[str] = str_col(40, nullable=False)
    content_id: Mapped[str] = str_col(80, nullable=False)
    views: Mapped[int] = bigint_col(0)
    read_time_total: Mapped[int] = bigint_col(0)
    likes: Mapped[int] = bigint_col(0)
    comments: Mapped[int] = bigint_col(0)
    replies: Mapped[int] = bigint_col(0)
    shares: Mapped[int] = bigint_col(0)
    cta_clicks: Mapped[int] = bigint_col(0)


class TechnicalMetric(Base):
    """404, erreurs JS, Core Web Vitals (p75), appareils problématiques."""

    __tablename__ = "analytics_technical_metrics"
    __table_args__ = (UniqueConstraint("day", "kind", "key"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    kind: Mapped[str] = str_col(
        20, nullable=False
    )  # not_found / js_error / vital_LCP / vital_CLS / vital_INP / vital_TTFB / device_error
    key: Mapped[str] = str_col(500, nullable=False)
    count: Mapped[int] = bigint_col(0)
    p75: Mapped[float | None] = mapped_column(Float, nullable=True)


class AnalyticsSalt(Base):
    """Sel rotatif pour le hachage des visiteurs (pas d'IP brute en base)."""

    __tablename__ = "analytics_salts"

    day: Mapped[date] = mapped_column(Date, primary_key=True)
    salt: Mapped[str] = str_col(64, nullable=False)
    created_at: Mapped[datetime | None] = dt_col()


__all__ = [
    "AnalyticsEvent",
    "AnalyticsSalt",
    "AnalyticsSession",
    "ContentMetric",
    "PageMetric",
    "SessionMetric",
    "SocialClickMetric",
    "TechnicalMetric",
]
