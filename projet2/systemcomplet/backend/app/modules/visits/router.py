"""API Visite immersive partageable (R5) : création / révocation (client, équipe), ouverture publique sécurisée."""

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
from app.core.errors import NotFound
from app.core.ratelimit import rate_limit
from app.core.utils import utcnow
from app.modules.visits import service
from app.modules.visits.models import ImmersiveShare

router = APIRouter(tags=["Visites immersives partagées"])
public = APIRouter(prefix="/public/visits", tags=["Visite immersive (public)"])


class ShareIn(BaseModel):
    content_id: uuid.UUID | None = None
    model_id: uuid.UUID | None = None
    days: int = Field(default=30, ge=1, le=service.MAX_DAYS)
    pin: str | None = Field(default=None, pattern=r"^\d{4,8}$")
    max_views: int | None = Field(default=None, ge=1, le=10000)
    message: str | None = Field(default=None, max_length=500)


def _project(db: Session, access: Access, project_id: uuid.UUID) -> Any:
    from app.modules.projects.models import Project

    access.require_project(project_id)
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise NotFound("Projet introuvable")
    return project


def _create(db: Session, access: Access, project_id: uuid.UUID, data: ShareIn, *, client: bool) -> dict[str, Any]:
    project = _project(db, access, project_id)
    share, url = service.create(
        db,
        project,
        content_id=data.content_id,
        model_id=data.model_id,
        days=data.days,
        pin=data.pin,
        max_views=data.max_views,
        message=data.message,
        user_id=access.p.id,
        client=client,
    )
    audit.record(
        db,
        family="security",
        module="visits",
        action="SHARE_CREATE",
        resource_type="immersive_share",
        resource_id=share.id,
        project_id=project.id,
        diff={"days": data.days, "pin": bool(data.pin), "max_views": data.max_views},
    )
    db.commit()
    return {**service.share_out(share), "url": url}


@router.post("/client/projects/{project_id}/visits", status_code=201)
def client_share(
    project_id: uuid.UUID, data: ShareIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Le client partage une visite 360° / sa maquette 3D avec ses proches (lien affiché une seule fois)."""
    access.require("client:portal")
    return _create(db, access, project_id, data, client=True)


@router.get("/client/projects/{project_id}/visits")
def client_shares(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require("client:portal")
    _project(db, access, project_id)
    rows = db.execute(
        select(ImmersiveShare)
        .where(ImmersiveShare.project_id == project_id, ImmersiveShare.created_by_id == access.p.id)
        .order_by(ImmersiveShare.created_at.desc())
    ).scalars()
    return [service.share_out(s) for s in rows]


@router.post("/projects/{project_id}/visits", status_code=201)
def staff_share(
    project_id: uuid.UUID, data: ShareIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("projects:publish_client")
    return _create(db, access, project_id, data, client=False)


@router.get("/projects/{project_id}/visits")
def staff_shares(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require("projects:read")
    _project(db, access, project_id)
    rows = db.execute(
        select(ImmersiveShare).where(ImmersiveShare.project_id == project_id).order_by(ImmersiveShare.created_at.desc())
    ).scalars()
    return [service.share_out(s) for s in rows]


@router.post("/visits/{share_id}/revoke")
def revoke(share_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """Révocation immédiate (le client révoque ses propres liens ; l'équipe, tous ceux du projet)."""
    share = db.get(ImmersiveShare, share_id)
    if share is None:
        raise NotFound("Lien introuvable")
    _project(db, access, share.project_id)
    if access.p.is_client:
        access.require("client:portal")
        if share.created_by_id != access.p.id:
            raise NotFound("Lien introuvable")
    else:
        access.require("projects:publish_client")
    share.revoked_at = share.revoked_at or utcnow()
    audit.record(
        db,
        family="security",
        module="visits",
        action="SHARE_REVOKE",
        resource_type="immersive_share",
        resource_id=share.id,
        project_id=share.project_id,
    )
    db.commit()
    return service.share_out(share)


# ---------------------------------------------------------------------------- public
@public.get("/{token}", dependencies=[Depends(rate_limit("visit", "60/minute"))])
def visit_preview(token: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    return service.preview(db, service.resolve(db, token))


class OpenIn(BaseModel):
    pin: str | None = Field(default=None, max_length=8)


@public.post("/{token}/open", dependencies=[Depends(rate_limit("visit_open", "30/minute"))])
def visit_open(token: str, data: OpenIn, db: Session = Depends(get_db)) -> dict[str, Any]:
    result = service.open_visit(db, service.resolve(db, token), data.pin)
    db.commit()
    return result
