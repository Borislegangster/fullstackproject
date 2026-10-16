"""API Planning intelligent (A4) : risques de retard, application des replanifications, message au client."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.database import get_db
from app.core.errors import BusinessRuleError, NotFound
from app.core.utils import utcnow
from app.modules.scheduling import service
from app.modules.scheduling.models import ScheduleRisk

router = APIRouter(tags=["Planning intelligent"])


def _project(db: Session, access: Access, project_id: uuid.UUID, perm: str) -> Any:
    from app.modules.projects.models import Project

    access.require(perm)
    access.require_project(project_id)
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise NotFound("Projet introuvable")
    return project


def _out(db: Session, rows: list[ScheduleRisk]) -> list[dict[str, Any]]:
    from app.modules.projects.models import Task

    return [service.risk_out(r, db.get(Task, r.task_id)) for r in rows]


@router.get("/projects/{project_id}/schedule-risks")
def project_risks(
    project_id: uuid.UUID,
    status: str | None = "open",
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    _project(db, access, project_id, "planning:read")
    stmt = select(ScheduleRisk).where(ScheduleRisk.project_id == project_id)
    if status:
        stmt = stmt.where(ScheduleRisk.status == status)
    rows = db.execute(stmt.order_by(ScheduleRisk.severity, ScheduleRisk.created_at.desc())).scalars().all()
    return _out(db, list(rows))


@router.get("/schedule-risks")
def portfolio_risks(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    """Risques ouverts sur tous les chantiers accessibles (vue Direction / conducteurs de travaux)."""
    access.require("planning:read")
    stmt = access.filter_by_project(select(ScheduleRisk), ScheduleRisk.project_id, allow_null=False)
    rows = db.execute(stmt.where(ScheduleRisk.status == "open").order_by(ScheduleRisk.created_at.desc()).limit(300))
    return _out(db, list(rows.scalars()))


@router.post("/projects/{project_id}/schedule-risks/scan")
def scan(project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    project = _project(db, access, project_id, "planning:write")
    result = service.scan_project(db, project)
    db.commit()
    return result


def _risk(db: Session, access: Access, risk_id: uuid.UUID, perm: str) -> ScheduleRisk:
    risk = db.get(ScheduleRisk, risk_id)
    if risk is None:
        raise NotFound("Risque introuvable")
    _project(db, access, risk.project_id, perm)
    return risk


class NoteIn(BaseModel):
    note: str | None = Field(default=None, max_length=2000)


@router.post("/schedule-risks/{risk_id}/apply")
def apply(
    risk_id: uuid.UUID, data: NoteIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Applique la replanification proposée (décalage en cascade) et prépare le message au client."""
    risk = _risk(db, access, risk_id, "planning:write")
    result = service.apply(db, risk, user=access.p.user, note=data.note)
    db.commit()
    return result


@router.post("/schedule-risks/{risk_id}/dismiss")
def dismiss(
    risk_id: uuid.UUID, data: NoteIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    risk = _risk(db, access, risk_id, "planning:write")
    if risk.status != "open":
        raise BusinessRuleError("Risque déjà traité")
    if not (data.note or "").strip():
        raise BusinessRuleError("Motif requis (ex. « bâches installées », « livraison avancée »)")
    risk.status = "dismissed"
    risk.decided_by_id = access.p.id
    risk.decided_at = utcnow()
    risk.decision_note = data.note
    audit.record(
        db,
        family="business",
        module="planning",
        action="RISK_DISMISS",
        resource_type="schedule_risk",
        resource_id=risk.id,
        project_id=risk.project_id,
        reason=data.note,
    )
    db.commit()
    return service.risk_out(risk)


class NoticeIn(BaseModel):
    message: str = Field(min_length=20, max_length=2000)


@router.post("/schedule-risks/{risk_id}/notify-client")
def notify_client(
    risk_id: uuid.UUID, data: NoticeIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Communication anticipée au client (message relu par le chef de projet)."""
    risk = _risk(db, access, risk_id, "projects:publish_client")
    service.notify_client(db, risk, message=data.message, user=access.p.user)
    db.commit()
    return service.risk_out(risk)
