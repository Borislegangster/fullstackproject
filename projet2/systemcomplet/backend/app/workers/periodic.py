"""Jobs périodiques transverses : échéances (statuts), rappels quotidiens, purge contrôlée (rétention)."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

from sqlalchemy import and_, delete, func, select, update
from sqlalchemy.orm import Session

from app.core.events import emit
from app.core.utils import utcnow

log = logging.getLogger("globus.periodic")


def overdue_checks(db: Session) -> dict[str, Any]:
    """Met à jour les statuts « en retard » (appels de fonds, factures clients)."""
    from app.modules.billing.models import ClientInvoice
    from app.modules.finance.models import FundsCall

    today = date.today()
    calls = db.execute(
        update(FundsCall)
        .where(FundsCall.status.in_(["issued", "partially_paid"]), FundsCall.due_date < today)
        .values(status="overdue")
    ).rowcount
    invoices = db.execute(
        update(ClientInvoice)
        .where(ClientInvoice.status.in_(["sent", "partially_paid"]), ClientInvoice.due_date < today)
        .values(status="overdue")
    ).rowcount
    db.flush()
    return {"items": int((calls or 0) + (invoices or 0)), "funds_calls": calls, "invoices": invoices}


def daily_reminders(db: Session) -> dict[str, Any]:
    """Rappels quotidiens : actions correctives en retard, dossier Tranquillité, maintenance, stocks bas."""
    from app.modules.equipment.models import Equipment, MaintenancePlan
    from app.modules.inventory.models import StockItem, StockLevel
    from app.modules.projects.models import Project, TranquilliteItem
    from app.modules.qhse.models import CorrectiveAction

    today = date.today()
    counts = {"corrective": 0, "tranquillite": 0, "maintenance": 0, "stock": 0}
    for action in db.execute(
        select(CorrectiveAction).where(
            CorrectiveAction.status.in_(["open", "in_progress"]), CorrectiveAction.due_date < today
        )
    ).scalars():
        emit(
            db,
            "corrective_action.overdue",
            {
                "id": action.id,
                "number": action.number,
                "title": action.title,
                "due_date": action.due_date,
                "responsible_id": action.responsible_id,
            },
            aggregate_type="corrective_action",
            aggregate_id=action.id,
            project_id=action.project_id,
        )
        counts["corrective"] += 1
    horizon = today + timedelta(days=15)
    for item in db.execute(
        select(TranquilliteItem).where(
            TranquilliteItem.status.not_in(["verifie", "expire"]),
            TranquilliteItem.due_date.is_not(None),
            TranquilliteItem.due_date <= horizon,
        )
    ).scalars():
        emit(
            db,
            "tranquillite.due_soon",
            {
                "id": item.id,
                "title": item.title,
                "category": item.category,
                "due_date": item.due_date,
                "responsible_id": item.responsible_id,
            },
            aggregate_type="tranquillite_item",
            aggregate_id=item.id,
            project_id=item.project_id,
        )
        counts["tranquillite"] += 1
    for plan, equipment in db.execute(
        select(MaintenancePlan, Equipment)
        .join(Equipment, Equipment.id == MaintenancePlan.equipment_id)
        .where(MaintenancePlan.is_active.is_(True), MaintenancePlan.next_due_date <= today + timedelta(days=7))
    ).all():
        emit(
            db,
            "equipment.maintenance_due",
            {"id": equipment.id, "equipment": equipment.name, "title": plan.title, "due_date": plan.next_due_date},
            aggregate_type="equipment",
            aggregate_id=equipment.id,
        )
        counts["maintenance"] += 1
    totals = (
        select(StockLevel.item_id, func.sum(StockLevel.quantity).label("qty")).group_by(StockLevel.item_id).subquery()
    )
    for item, qty in db.execute(
        select(StockItem, func.coalesce(totals.c.qty, 0))
        .join(totals, totals.c.item_id == StockItem.id, isouter=True)
        .where(
            StockItem.is_active.is_(True),
            StockItem.min_threshold > 0,
            func.coalesce(totals.c.qty, 0) < StockItem.min_threshold,
        )
    ).all():
        emit(
            db,
            "stock.low",
            {"id": item.id, "item": item.name, "quantity": qty, "unit": item.unit, "threshold": item.min_threshold},
            aggregate_type="stock_item",
            aggregate_id=item.id,
        )
        counts["stock"] += 1
    _ = Project
    db.flush()
    return {"items": sum(counts.values()), **counts}


def retention_purge(db: Session) -> dict[str, Any]:
    """Purge contrôlée (suppression logique / données techniques expirées) — jamais de données métier."""
    from app.core.storage import private_storage
    from app.modules.analytics.models import AnalyticsEvent
    from app.modules.communications.models import Call
    from app.modules.identity.models import UserSession, UserToken
    from app.modules.system.models import IdempotencyKey, OutboxEvent, StoredFile

    now = utcnow()
    stats: dict[str, Any] = {}
    stats["idempotency"] = db.execute(delete(IdempotencyKey).where(IdempotencyKey.expires_at < now)).rowcount
    stats["tokens"] = db.execute(delete(UserToken).where(UserToken.expires_at < now - timedelta(days=30))).rowcount
    stats["sessions"] = db.execute(
        delete(UserSession).where(and_(UserSession.expires_at < now - timedelta(days=90)))
    ).rowcount
    stats["outbox"] = db.execute(
        delete(OutboxEvent).where(OutboxEvent.status == "done", OutboxEvent.processed_at < now - timedelta(days=30))
    ).rowcount
    stats["analytics_events"] = db.execute(
        delete(AnalyticsEvent).where(AnalyticsEvent.ts < now - timedelta(days=400))
    ).rowcount
    recordings = 0
    for call in db.execute(
        select(Call).where(Call.recording_file_id.is_not(None), Call.recording_retention_until < now)
    ).scalars():
        stored = db.get(StoredFile, call.recording_file_id)
        if stored is not None:
            try:
                private_storage().delete(stored.storage_key)
            except Exception:  # noqa: BLE001
                log.warning("recording_delete_failed")
            stored.deleted_at = now
        call.recording_file_id = None
        recordings += 1
    stats["recordings"] = recordings
    db.flush()
    stats["items"] = sum(int(v or 0) for v in stats.values() if isinstance(v, int))
    return stats
