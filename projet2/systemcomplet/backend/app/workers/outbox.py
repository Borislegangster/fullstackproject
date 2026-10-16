"""Dispatcher outbox : réclame les événements (FOR UPDATE SKIP LOCKED), exécute les handlers, gère les
reprises avec backoff exponentiel et la file morte (alerte système). Retries contrôlés (§19.2)."""

from __future__ import annotations

import logging
import uuid
from collections.abc import Callable
from datetime import timedelta
from typing import Any

from sqlalchemy import func, select, text, update
from sqlalchemy.orm import Session

from app.core import metrics
from app.core.config import settings
from app.core.context import RequestContext, reset_context, set_context
from app.core.database import SessionLocal
from app.core.utils import utcnow
from app.modules.system.models import OutboxEvent

log = logging.getLogger("globus.outbox")

Handler = Callable[[Session, OutboxEvent], Any]
_HANDLERS: dict[str, list[Handler]] = {}
_WILDCARD: list[Handler] = []


def handler(event_type: str | None = None) -> Callable[[Handler], Handler]:
    def deco(fn: Handler) -> Handler:
        if event_type is None:
            _WILDCARD.append(fn)
        else:
            _HANDLERS.setdefault(event_type, []).append(fn)
        return fn

    return deco


def _register_defaults() -> None:
    if _HANDLERS or _WILDCARD:
        return
    from app.modules.notifications import service as notif

    @handler("notification.dispatch")
    def _dispatch(db: Session, ev: OutboxEvent) -> None:
        notif.dispatch(db, ev.payload or {})

    @handler()
    def _rules(db: Session, ev: OutboxEvent) -> None:
        if ev.event_type != "notification.dispatch":
            notif.handle_event(db, ev)

    @handler()
    def _webhooks(db: Session, ev: OutboxEvent) -> None:
        if ev.event_type == "notification.dispatch":
            return
        from app.modules.admin.webhooks import enqueue_outgoing

        enqueue_outgoing(db, ev)

    @handler()
    def _realtime(db: Session, ev: OutboxEvent) -> None:
        if ev.event_type == "notification.dispatch" or not ev.project_id:
            return
        from app.websocket.hub import publish_room

        publish_room(
            f"project:{ev.project_id}",
            "event",
            {"type": ev.event_type, "id": ev.aggregate_id, "aggregate": ev.aggregate_type},
        )

    try:
        from app.workers import domain_handlers  # noqa: F401 — enregistre les handlers métier
    except ImportError:
        log.debug("domain_handlers_missing")


def claim(batch: int) -> list[uuid.UUID]:
    db = SessionLocal()
    try:
        rows = (
            db.execute(
                text(
                    """
            UPDATE outbox_events SET status = 'processing', attempts = attempts + 1, available_at = clock_timestamp()
            WHERE id IN (
                SELECT id FROM outbox_events
                WHERE status = 'pending' AND available_at <= clock_timestamp()
                ORDER BY created_at
                LIMIT :n
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id
            """
                ),
                {"n": batch},
            )
            .scalars()
            .all()
        )
        db.commit()
        return [uuid.UUID(str(r)) for r in rows]
    finally:
        db.close()


def process_event(event_id: uuid.UUID) -> bool:
    _register_defaults()
    db = SessionLocal()
    token = None
    try:
        ev = db.get(OutboxEvent, event_id)
        if ev is None:
            return True
        token = set_context(RequestContext(request_id=ev.correlation_id or uuid.uuid4().hex, application="worker"))
        try:
            for fn in _HANDLERS.get(ev.event_type, []) + _WILDCARD:
                fn(db, ev)
            ev.status = "done"
            ev.processed_at = utcnow()
            ev.last_error = None
            db.commit()
            return True
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            ev = db.get(OutboxEvent, event_id)
            if ev is None:
                return False
            ev.last_error = f"{type(exc).__name__}: {exc}"[:2000]
            metrics.outbox_failures.labels(ev.event_type).inc()
            if ev.attempts >= settings.OUTBOX_MAX_ATTEMPTS:
                ev.status = "failed"
                _dead_letter_alert(db, ev)
            else:
                ev.status = "pending"
                ev.available_at = utcnow() + timedelta(seconds=min(3600, 15 * (2**ev.attempts)))
            db.commit()
            log.warning(
                "outbox_event_failed",
                extra={
                    "event_type": ev.event_type,
                    "event_id": str(ev.id),
                    "attempts": ev.attempts,
                    "error": ev.last_error[:300],
                },
            )
            return False
    finally:
        if token is not None:
            reset_context(token)
        db.close()


def _dead_letter_alert(db: Session, ev: OutboxEvent) -> None:
    if ev.event_type == "system.alert":
        return
    db.add(
        OutboxEvent(
            event_type="system.alert",
            payload={
                "title": "Événement en échec définitif",
                "message": f"{ev.event_type} ({ev.id}) : {ev.last_error[:300] if ev.last_error else ''}",
            },
            status="pending",
            available_at=utcnow(),
        )
    )


def recover_stuck(db: Session, minutes: int = 10) -> int:
    result = db.execute(
        update(OutboxEvent)
        .where(OutboxEvent.status == "processing", OutboxEvent.available_at < utcnow() - timedelta(minutes=minutes))
        .values(status="pending")
    )
    db.flush()
    return int(result.rowcount or 0)


def pending_count() -> int:
    db = SessionLocal()
    try:
        count = db.execute(
            select(func.count()).select_from(OutboxEvent).where(OutboxEvent.status == "pending")
        ).scalar_one()
        metrics.outbox_pending.set(count)
        return int(count)
    finally:
        db.close()


def run_once(batch: int | None = None) -> int:
    ids = claim(batch or settings.OUTBOX_BATCH_SIZE)
    for event_id in ids:
        process_event(event_id)
    return len(ids)


def drain(max_rounds: int = 20) -> int:
    """Traite toute la file (tests, scripts)."""
    total = 0
    for _ in range(max_rounds):
        n = run_once()
        total += n
        if n == 0:
            break
    return total
