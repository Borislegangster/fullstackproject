"""API Jumeau numérique (I1) : mesure de l'avancement réel par l'image, validation et certification."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.access import Access, get_access
from app.core.database import get_db
from app.core.errors import BusinessRuleError, NotFound
from app.core.utils import utcnow
from app.modules.twin import service
from app.modules.twin.models import ProgressObservation

router = APIRouter(tags=["Jumeau numérique de chantier"])


def _project(db: Session, access: Access, project_id: uuid.UUID, *perms: str) -> Any:
    from app.modules.projects.models import Project

    if perms:
        access.require(*perms)
    access.require_project(project_id)
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise NotFound("Projet introuvable")
    return project


class AnalyzeIn(BaseModel):
    zone_id: uuid.UUID | None = None


@router.post("/projects/{project_id}/twin/analyze", status_code=201)
def analyze(
    project_id: uuid.UUID, data: AnalyzeIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Compare les photos récentes (zone ou chantier) au planning et à la maquette : avancement observé par tâche."""
    project = _project(db, access, project_id, "projects:write", "ai:use")
    observation = service.analyze(db, project, zone_id=data.zone_id, user_id=access.p.id)
    db.commit()
    return service.observation_out(observation, internal=True)


@router.get("/projects/{project_id}/twin")
def observations(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    _project(db, access, project_id, "projects:read")
    rows = db.execute(
        select(ProgressObservation)
        .where(ProgressObservation.project_id == project_id)
        .order_by(ProgressObservation.created_at.desc())
        .limit(50)
    ).scalars()
    return [service.observation_out(o, internal=True) for o in rows]


class ValidateIn(BaseModel):
    adjustments: dict[str, int] = Field(default_factory=dict)
    note: str | None = Field(default=None, max_length=2000)


@router.post("/twin/observations/{observation_id}/validate")
def validate(
    observation_id: uuid.UUID, data: ValidateIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    observation = service.get(db, observation_id)
    _project(db, access, observation.project_id, "projects:write")
    if any(not 0 <= v <= 100 for v in data.adjustments.values()):
        raise BusinessRuleError("Avancement entre 0 et 100 %")
    service.validate(db, observation, adjustments=data.adjustments, note=data.note, user=access.p.user)
    db.commit()
    return service.observation_out(observation, internal=True)


class RejectIn(BaseModel):
    note: str = Field(min_length=5, max_length=2000)


@router.post("/twin/observations/{observation_id}/reject")
def reject(
    observation_id: uuid.UUID, data: RejectIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    observation = service.get(db, observation_id)
    _project(db, access, observation.project_id, "projects:write")
    if observation.status != "pending":
        raise BusinessRuleError("Observation déjà traitée")
    observation.status = "rejected"
    observation.decided_by_id = access.p.id
    observation.decided_at = utcnow()
    observation.decision_note = data.note
    db.commit()
    return service.observation_out(observation, internal=True)


@router.get("/client/projects/{project_id}/twin")
def client_observations(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    """Avancement mesuré et certifié (le client ne voit que les mesures validées par l'équipe)."""
    _project(db, access, project_id, "client:portal")
    rows = db.execute(
        select(ProgressObservation)
        .where(ProgressObservation.project_id == project_id, ProgressObservation.status == "validated")
        .order_by(ProgressObservation.observed_on.desc())
        .limit(20)
    ).scalars()
    return [service.observation_out(o, internal=False) for o in rows]
