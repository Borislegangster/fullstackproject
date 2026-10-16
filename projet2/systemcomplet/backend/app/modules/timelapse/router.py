"""API Journal de chantier vidéo (R2) : caméras 4G, time-lapses (équipe, client), dépôt des clichés par jeton."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Header, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.database import get_db
from app.core.errors import BusinessRuleError, NotFound
from app.core.ratelimit import rate_limit
from app.modules.timelapse import service
from app.modules.timelapse.models import SiteCamera, Timelapse

router = APIRouter(tags=["Time-lapse et caméras de chantier"])
devices = APIRouter(prefix="/devices/cameras", tags=["Caméras de chantier (appareils)"])


def _project(db: Session, access: Access, project_id: uuid.UUID, perm: str) -> Any:
    from app.modules.projects.models import Project

    access.require(perm)
    access.require_project(project_id)
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise NotFound("Projet introuvable")
    return project


# ---------------------------------------------------------------------------- caméras
class CameraIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)


@router.get("/projects/{project_id}/cameras")
def cameras(project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list:
    _project(db, access, project_id, "projects:read")
    rows = db.execute(
        select(SiteCamera).where(SiteCamera.project_id == project_id).order_by(SiteCamera.created_at)
    ).scalars()
    return [service.camera_out(c) for c in rows]


@router.post("/projects/{project_id}/cameras", status_code=201)
def add_camera(
    project_id: uuid.UUID, data: CameraIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Enregistre une caméra : le jeton n'est affiché qu'une fois (à saisir dans la caméra / passerelle 4G)."""
    project = _project(db, access, project_id, "projects:write")
    camera, token = service.create_camera(db, project.id, data.name, user_id=access.p.id)
    audit.record(
        db,
        family="security",
        module="timelapse",
        action="CAMERA_CREATE",
        resource_type="site_camera",
        resource_id=camera.id,
        project_id=project.id,
    )
    db.commit()
    return {**service.camera_out(camera), "token": token, "upload_url": "/api/v1/devices/cameras/snapshots"}


@router.delete("/cameras/{camera_id}")
def disable_camera(
    camera_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    camera = db.get(SiteCamera, camera_id)
    if camera is None:
        raise NotFound("Caméra introuvable")
    _project(db, access, camera.project_id, "projects:write")
    camera.active = False
    audit.record(
        db,
        family="security",
        module="timelapse",
        action="CAMERA_DISABLE",
        resource_type="site_camera",
        resource_id=camera.id,
        project_id=camera.project_id,
    )
    db.commit()
    return service.camera_out(camera)


@devices.post("/snapshots", status_code=201, dependencies=[Depends(rate_limit("camera", "240/hour"))])
async def snapshot(
    file: UploadFile = File(...),
    taken_at: datetime | None = Form(None),
    x_camera_token: str | None = Header(default=None, alias="X-Camera-Token"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Dépôt d'un cliché par une caméra 4G (jeton propre à la caméra, révocable depuis l'ERP)."""
    camera = service.camera_for_token(db, x_camera_token)
    media = service.ingest_snapshot(
        db, camera, filename=file.filename or "snapshot.jpg", data=await file.read(16 * 1024 * 1024), taken_at=taken_at
    )
    db.commit()
    return {"status": "stored", "id": str(media.id)}


# ---------------------------------------------------------------------------- time-lapses
@router.get("/projects/{project_id}/timelapses")
def timelapses(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    _project(db, access, project_id, "projects:read")
    rows = db.execute(
        select(Timelapse).where(Timelapse.project_id == project_id).order_by(Timelapse.period_start.desc()).limit(52)
    ).scalars()
    return [service.timelapse_out(t, user_id=access.p.id) for t in rows]


class GenerateIn(BaseModel):
    period_end: date | None = None
    send: bool = False


@router.post("/projects/{project_id}/timelapses", status_code=201)
def generate(
    project_id: uuid.UUID, data: GenerateIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """(Re)génère le time-lapse d'une semaine (par défaut la semaine écoulée) ; envoi au client en option."""
    project = _project(db, access, project_id, "projects:publish_client")
    if data.period_end:
        if data.period_end > date.today():
            raise BusinessRuleError("Semaine non écoulée", code="PERIOD_IN_FUTURE")
        start, end = data.period_end - timedelta(days=6), data.period_end
    else:
        start, end = service.last_week()
    timelapse = service.generate(db, project, start, end, by="user", force=True)
    if timelapse is None:
        raise BusinessRuleError(
            f"Pas assez d'images sur la période ({service.MIN_FRAMES} photos publiées ou clichés caméra minimum)",
            code="NOT_ENOUGH_FRAMES",
        )
    if data.send:
        service.deliver(db, project, timelapse)
    db.commit()
    return service.timelapse_out(timelapse, user_id=access.p.id)


@router.get("/client/projects/{project_id}/timelapses")
def client_timelapses(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require("client:portal")
    access.require_project(project_id)
    rows = db.execute(
        select(Timelapse)
        .where(
            Timelapse.project_id == project_id,
            Timelapse.status == "ready",
            Timelapse.published_to_client.is_(True),
        )
        .order_by(Timelapse.period_start.desc())
        .limit(52)
    ).scalars()
    return [service.timelapse_out(t, user_id=access.p.id) for t in rows]
