"""Synchronisation hors ligne (V4-DATA-32/33) : file de mutations idempotentes (`client_mutation_id`), contrôle de
version optimiste (`base_version`) — une mutation basée sur une version périmée n'écrase jamais le serveur : elle
passe en « conflit » avec les deux versions, résolu explicitement (client / serveur / fusion) et audité."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access
from app.core.crud import serialize
from app.core.errors import AppError, BusinessRuleError, NotFound
from app.core.utils import jsonable, utcnow
from app.modules.sync.models import SyncMutation


class SyncConflict(Exception):
    def __init__(self, server_version: int, server_data: dict[str, Any], fields: list[str]) -> None:
        super().__init__("conflict")
        self.server_version = server_version
        self.server_data = server_data
        self.fields = fields


Handler = Callable[[Session, Access, dict[str, Any], bool], dict[str, Any]]
HANDLERS: dict[tuple[str, str], Handler] = {}


def handles(entity: str, operation: str) -> Callable[[Handler], Handler]:
    def deco(fn: Handler) -> Handler:
        HANDLERS[(entity, operation)] = fn
        return fn

    return deco


def _check_version(obj: Any, mutation: dict[str, Any], fields: list[str], force: bool) -> None:
    base = mutation.get("base_version")
    if force or base is None:
        return
    if int(base) != int(obj.version):
        changed = [f for f in fields if f in mutation["payload"]]
        raise SyncConflict(int(obj.version), jsonable({f: getattr(obj, f, None) for f in changed}), changed)


# ============================================================================ handlers métier
@handles("task_progress", "update")
def _task_progress(db: Session, access: Access, m: dict[str, Any], force: bool) -> dict[str, Any]:
    from app.modules.projects.models import Task
    from app.modules.projects.service import update_task_progress

    task = db.get(Task, m["entity_id"])
    if task is None or task.deleted_at is not None:
        raise NotFound("Tâche introuvable")
    access.require_project(task.project_id, "site:report")
    _check_version(task, m, ["progress_pct"], force)
    payload = m["payload"]
    update = update_task_progress(
        db,
        task,
        pct=Decimal(str(payload["progress_pct"])),
        note=payload.get("note"),
        evidence=[str(x) for x in payload.get("evidence_file_ids", [])],
        user_id=access.p.id,
        source="offline",
    )
    db.flush()
    return {"task_id": str(task.id), "version": task.version, "progress_update_id": str(update.id)}


DAILY_LOG_FIELDS = [
    "activities",
    "issues",
    "needs",
    "safety_notes",
    "weather",
    "workforce_count",
    "subcontractor_workforce",
    "deliveries_summary",
    "visitors",
    "delay_hours",
    "temperature_c",
]


@handles("daily_log", "create")
def _daily_log_create(db: Session, access: Access, m: dict[str, Any], force: bool) -> dict[str, Any]:
    from datetime import date

    from app.modules.projects.models import DailyLog

    payload = m["payload"]
    project_id = uuid.UUID(str(payload["project_id"]))
    access.require_project(project_id, "site:report")
    log_date = date.fromisoformat(str(payload["log_date"]))
    site_id = uuid.UUID(str(payload["site_id"])) if payload.get("site_id") else None
    existing = db.execute(
        select(DailyLog).where(
            DailyLog.project_id == project_id,
            DailyLog.log_date == log_date,
            DailyLog.site_id.is_(None) if site_id is None else DailyLog.site_id == site_id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise SyncConflict(
            int(existing.version),
            jsonable({f: getattr(existing, f) for f in DAILY_LOG_FIELDS}),
            [f for f in DAILY_LOG_FIELDS if f in payload],
        )
    log = DailyLog(
        project_id=project_id,
        site_id=site_id,
        log_date=log_date,
        author_id=access.p.id,
        source="offline",
        **{f: payload[f] for f in DAILY_LOG_FIELDS if f in payload},
    )
    db.add(log)
    db.flush()
    return {"daily_log_id": str(log.id), "version": log.version}


@handles("daily_log", "update")
def _daily_log_update(db: Session, access: Access, m: dict[str, Any], force: bool) -> dict[str, Any]:
    from app.modules.projects.models import DailyLog

    log = db.get(DailyLog, m["entity_id"])
    if log is None:
        raise NotFound("Rapport introuvable")
    access.require_project(log.project_id, "site:report")
    if log.status == "validated":
        raise BusinessRuleError("Rapport validé : modification impossible", code="LOCKED")
    _check_version(log, m, DAILY_LOG_FIELDS, force)
    for field in DAILY_LOG_FIELDS:
        if field in m["payload"]:
            setattr(log, field, m["payload"][field])
    db.flush()
    return {"daily_log_id": str(log.id), "version": log.version}


@handles("attendance_scan", "action")
def _attendance(db: Session, access: Access, m: dict[str, Any], force: bool) -> dict[str, Any]:
    from app.modules.hr.service import employee_by_badge, record_scan

    if not access.p.has_any("hr:write", "site:report"):
        access.require("site:report")
    payload = m["payload"]
    employee = employee_by_badge(db, str(payload["badge"]))
    project_id = uuid.UUID(str(payload["project_id"])) if payload.get("project_id") else None
    if project_id:
        access.require_project(project_id)
    row, kind = record_scan(
        db,
        employee=employee,
        project_id=project_id,
        site_id=uuid.UUID(str(payload["site_id"])) if payload.get("site_id") else None,
        at=datetime.fromisoformat(str(payload["at"])) if payload.get("at") else None,
        latitude=payload.get("latitude"),
        longitude=payload.get("longitude"),
        method="offline",
        recorded_by_id=access.p.id,
        client_mutation_id=m["client_mutation_id"],
        action=payload.get("action"),
    )
    return {"attendance_id": str(row.id), "scan": kind}


@handles("incident", "create")
def _incident(db: Session, access: Access, m: dict[str, Any], force: bool) -> dict[str, Any]:
    from app.modules.qhse.service import declare_incident

    payload = dict(m["payload"])
    project_id = uuid.UUID(str(payload["project_id"]))
    access.require_project(project_id)
    if not access.p.has_any("qhse:write", "site:report"):
        access.require("site:report")
    allowed = {
        "project_id",
        "site_id",
        "zone_id",
        "kind",
        "severity",
        "occurred_at",
        "location",
        "latitude",
        "longitude",
        "title",
        "description",
        "people_involved",
        "injuries",
        "lost_time_days",
        "immediate_actions",
    }
    data = {k: v for k, v in payload.items() if k in allowed}
    data["project_id"] = project_id
    data["occurred_at"] = datetime.fromisoformat(str(data["occurred_at"]))
    data["source"] = "mobile" if payload.get("source") == "mobile" else "offline"
    # Photos prises hors ligne : envoyées (/qhse/files) avant la mutation, retrouvées par empreinte et auteur.
    checksums = [str(c) for c in (payload.get("photo_checksums") or [])][:30]
    if checksums:
        from app.modules.system.models import StoredFile

        rows = db.execute(
            select(StoredFile.id, StoredFile.checksum_sha256)
            .where(
                StoredFile.checksum_sha256.in_(checksums),
                StoredFile.uploaded_by_id == access.p.id,
                StoredFile.purpose == "qhse",
                StoredFile.deleted_at.is_(None),
            )
            .order_by(StoredFile.created_at)
        ).all()
        by_checksum = {checksum: str(file_id) for file_id, checksum in rows}
        data["photo_file_ids"] = [by_checksum[c] for c in dict.fromkeys(checksums) if c in by_checksum]
    incident = declare_incident(db, data=data, user_id=access.p.id)
    return {"incident_id": str(incident.id), "number": incident.number}


@handles("stock_issue", "action")
def _stock_issue(db: Session, access: Access, m: dict[str, Any], force: bool) -> dict[str, Any]:
    from app.modules.inventory import service as stock
    from app.modules.inventory.models import StockItem

    payload = m["payload"]
    project_id = uuid.UUID(str(payload["project_id"]))
    access.require_project(project_id, "inventory:write")
    item = db.get(StockItem, uuid.UUID(str(payload["item_id"])))
    if item is None:
        raise NotFound("Article introuvable")
    movement = stock.issue(
        db,
        item=item,
        warehouse_id=uuid.UUID(str(payload["warehouse_id"])),
        quantity=Decimal(str(payload["quantity"])),
        user_id=access.p.id,
        project_id=project_id,
        site_id=uuid.UUID(str(payload["site_id"])) if payload.get("site_id") else None,
        reason=payload.get("reason"),
        client_mutation_id=m["client_mutation_id"],
    )
    return {"movement_id": str(movement.id)}


@handles("bim_annotation", "update")
def _annotation_update(db: Session, access: Access, m: dict[str, Any], force: bool) -> dict[str, Any]:
    from app.modules.bim.models import BimAnnotation

    annotation = db.get(BimAnnotation, m["entity_id"])
    if annotation is None or annotation.deleted_at is not None:
        raise NotFound("Annotation introuvable")
    access.require_project(annotation.project_id, "bim:write")
    fields = ["geometry", "content", "color"]
    _check_version(annotation, m, fields, force)
    if annotation.author_id != access.p.id:
        raise BusinessRuleError("Seul l'auteur peut modifier son annotation")
    for field in fields:
        if field in m["payload"]:
            setattr(annotation, field, m["payload"][field])
    db.flush()
    return {"annotation_id": str(annotation.id), "version": annotation.version}


# ============================================================================ moteur
def apply(db: Session, access: Access, mutation: dict[str, Any], *, device_id: str | None) -> SyncMutation:
    """Applique une mutation dans un point de sauvegarde : succès, conflit ou rejet sont tous persistés."""
    existing = db.execute(
        select(SyncMutation).where(SyncMutation.client_mutation_id == mutation["client_mutation_id"])
    ).scalar_one_or_none()
    if existing is not None:
        if existing.user_id != access.p.id:
            raise AppError("Identifiant de mutation déjà utilisé", code="MUTATION_ID_CONFLICT", status_code=409)
        existing.attempts += 1
        return existing
    row = SyncMutation(
        client_mutation_id=mutation["client_mutation_id"],
        user_id=access.p.id,
        device_id=device_id,
        entity=mutation["entity"],
        entity_id=mutation.get("entity_id"),
        operation=mutation["operation"],
        base_version=mutation.get("base_version"),
        payload=jsonable(mutation.get("payload") or {}),
        client_created_at=mutation.get("client_created_at"),
    )
    handler = HANDLERS.get((mutation["entity"], mutation["operation"]))
    if handler is None:
        row.status, row.error = "rejected", "Type de mutation non pris en charge"
        db.add(row)
        db.flush()
        return row
    savepoint = db.begin_nested()
    try:
        result = handler(db, access, mutation, False)
        savepoint.commit()
        row.status, row.result = "applied", jsonable(result)
    except SyncConflict as conflict:
        savepoint.rollback()
        row.status = "conflict"
        row.conflict = {
            "server_version": conflict.server_version,
            "server_data": conflict.server_data,
            "fields": conflict.fields,
            "client_data": jsonable(mutation.get("payload") or {}),
        }
    except AppError as exc:
        savepoint.rollback()
        row.status, row.error = "rejected", exc.message[:2000]
    db.add(row)
    db.flush()
    if row.status == "conflict":
        audit.record(
            db,
            family="business",
            module="sync",
            action="CONFLICT",
            resource_type=row.entity,
            resource_id=row.entity_id,
            diff={"mutation": row.client_mutation_id, "fields": row.conflict["fields"]},
            criticality="MEDIUM",
        )
    return row


def resolve(
    db: Session, access: Access, row: SyncMutation, *, resolution: str, merged: dict[str, Any] | None
) -> SyncMutation:
    if row.status != "conflict":
        raise BusinessRuleError("Mutation sans conflit")
    if row.user_id != access.p.id and not access.has("projects:write"):
        raise NotFound("Conflit introuvable")
    if resolution == "server_wins":
        row.status = "resolved"
    else:
        payload = merged if resolution == "merged" else row.payload
        if not payload:
            raise BusinessRuleError("Contenu fusionné requis")
        handler = HANDLERS[(row.entity, row.operation)]
        mutation = {
            "client_mutation_id": row.client_mutation_id,
            "entity": row.entity,
            "entity_id": row.entity_id,
            "operation": "update"
            if row.operation == "create" and row.conflict.get("server_version")
            else row.operation,
            "base_version": None,
            "payload": payload,
        }
        if row.operation == "create" and row.entity == "daily_log":
            from datetime import date

            from app.modules.projects.models import DailyLog

            existing = (
                db.execute(
                    select(DailyLog).where(
                        DailyLog.project_id == uuid.UUID(str(payload["project_id"])),
                        DailyLog.log_date == date.fromisoformat(str(payload["log_date"])),
                    )
                )
                .scalars()
                .first()
            )
            mutation["entity_id"] = existing.id if existing else None
            handler = HANDLERS[("daily_log", "update")]
        row.result = jsonable(handler(db, access, mutation, True))
        row.status = "resolved"
    row.resolution = resolution
    row.resolved_at = utcnow()
    row.resolved_by_id = access.p.id
    audit.record(
        db,
        family="business",
        module="sync",
        action="CONFLICT_RESOLVE",
        resource_type=row.entity,
        resource_id=row.entity_id,
        diff={"resolution": resolution, "mutation": row.client_mutation_id},
        criticality="MEDIUM",
    )
    return row


def pull(db: Session, access: Access, *, since: datetime | None, project_ids: list[uuid.UUID]) -> dict[str, Any]:
    """Changements depuis `since` pour les projets accessibles (tâches, journaux, documents publiés / obsolètes,
    issues BIM assignées) ; `server_time` sert de curseur suivant."""
    from app.modules.bim.models import BimIssue
    from app.modules.documents.models import Document, DocumentVersion
    from app.modules.projects.models import DailyLog, Task

    server_time = utcnow()
    scope = [p for p in project_ids if access.can_access_project(p)]

    def changed(model: Any, column: Any) -> Any:
        stmt = select(model).where(model.project_id.in_(scope or [uuid.uuid4()]))
        return stmt.where(column > since) if since else stmt

    tasks = db.execute(changed(Task, Task.updated_at).limit(2000)).scalars().all()
    logs = db.execute(changed(DailyLog, DailyLog.updated_at).limit(500)).scalars().all()
    issues = (
        db.execute(changed(BimIssue, BimIssue.updated_at).where(BimIssue.assignee_id == access.p.id).limit(500))
        .scalars()
        .all()
    )
    versions = db.execute(
        select(DocumentVersion, Document)
        .join(Document, Document.id == DocumentVersion.document_id)
        .where(
            Document.project_id.in_(scope or [uuid.uuid4()]),
            DocumentVersion.status.in_(["published", "obsolete"]),
            (DocumentVersion.published_at > since) | (DocumentVersion.obsolete_at > since)
            if since
            else DocumentVersion.status.in_(["published", "obsolete"]),
        )
        .limit(1000)
    ).all()
    return jsonable(
        {
            "server_time": server_time,
            "tasks": [
                {
                    k: v
                    for k, v in serialize(t).items()
                    if k
                    in (
                        "id",
                        "project_id",
                        "title",
                        "status",
                        "progress_pct",
                        "start_planned",
                        "end_planned",
                        "version",
                        "deleted_at",
                        "lot_id",
                        "zone_id",
                    )
                }
                for t in tasks
            ],
            "daily_logs": [serialize(log) for log in logs],
            "bim_issues": [serialize(i) for i in issues],
            "documents": [
                {
                    "document_id": d.id,
                    "title": d.title,
                    "version_id": v.id,
                    "label": f"v{v.version_major}.{v.version_minor}",
                    "status": v.status,
                    "obsolete_at": v.obsolete_at,
                    "superseded_by_id": v.superseded_by_id,
                }
                for v, d in versions
            ],
        }
    )
