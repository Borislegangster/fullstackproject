"""Événements métier (patron outbox) — notifications, webhooks, KPI, temps réel (§2.2 Event-driven)."""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.context import get_context
from app.core.utils import jsonable, utcnow
from app.modules.system.models import OutboxEvent


def emit(
    db: Session,
    event_type: str,
    payload: dict[str, Any] | None = None,
    *,
    aggregate_type: str | None = None,
    aggregate_id: Any = None,
    project_id: uuid.UUID | None = None,
    actor_id: uuid.UUID | None = None,
    delay_seconds: int = 0,
) -> OutboxEvent:
    ctx = get_context()
    if actor_id is None and ctx.user_id:
        try:
            actor_id = uuid.UUID(ctx.user_id)
        except ValueError:
            actor_id = None
    event = OutboxEvent(
        id=uuid.uuid4(),
        event_type=event_type,
        aggregate_type=aggregate_type,
        aggregate_id=str(aggregate_id) if aggregate_id is not None else None,
        project_id=project_id,
        actor_id=actor_id,
        payload=jsonable(payload or {}),
        status="pending",
        available_at=utcnow() + timedelta(seconds=delay_seconds),
        correlation_id=ctx.request_id,
    )
    db.add(event)
    return event
