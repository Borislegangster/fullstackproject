"""API Panneau de chantier connecté (I4) : configuration par l'équipe projet, impression, page publique, messages."""

from __future__ import annotations

import time
import uuid
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.database import get_db
from app.core.errors import NotFound
from app.core.middleware import client_ip
from app.core.ratelimit import rate_limit
from app.core.utils import utcnow
from app.modules.panels import service
from app.modules.panels.models import SitePanelMessage

router = APIRouter(tags=["Panneau de chantier connecté"])
public = APIRouter(prefix="/public/chantiers", tags=["Chantiers (public)"])


def _project(db: Session, access: Access, project_id: uuid.UUID, perm: str) -> Any:
    from app.modules.projects.models import Project

    access.require(perm)
    access.require_project(project_id)
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise NotFound("Projet introuvable")
    return project


def _panel(db: Session, project_id: uuid.UUID) -> Any:
    panel = service.get_panel(db, project_id)
    if panel is None:
        raise NotFound("Panneau non configuré")
    return panel


@router.get("/projects/{project_id}/panel")
def get_panel(project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict:
    project = _project(db, access, project_id, "projects:read")
    panel = service.get_panel(db, project.id)
    if panel is None:
        return {"configured": False, "suggestion": service.suggestion(db, project)}
    return {"configured": True, "panel": service.panel_out(db, panel)}


class PanelIn(BaseModel):
    slug: str | None = Field(default=None, min_length=3, max_length=80)
    enabled: bool | None = None
    title: str | None = Field(default=None, min_length=3, max_length=250)
    location_label: str | None = Field(default=None, max_length=200)
    owner_label: str | None = Field(default=None, max_length=200)
    contractor_label: str | None = Field(default=None, min_length=2, max_length=200)
    permit_number: str | None = Field(default=None, max_length=80)
    permit_date: date | None = None
    permit_authority: str | None = Field(default=None, max_length=200)
    works_description: str | None = Field(default=None, max_length=4000)
    working_hours: str | None = Field(default=None, max_length=200)
    contact_phone: str | None = Field(default=None, max_length=30)
    show_progress: bool | None = None
    show_milestones: bool | None = None
    show_photos: bool | None = None
    hiring_open: bool | None = None
    hiring_text: str | None = Field(default=None, max_length=1000)


@router.put("/projects/{project_id}/panel")
def save_panel(
    project_id: uuid.UUID, data: PanelIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Crée / met à jour le panneau. Le rendre public (`enabled`) exige le droit de publication client."""
    project = _project(db, access, project_id, "projects:write")
    values = data.model_dump(exclude_unset=True)
    if values.get("enabled"):
        access.require("projects:publish_client")
    before = service.get_panel(db, project.id)
    was_enabled = bool(before and before.enabled)
    panel = service.save_panel(db, project, values, user_id=access.p.id)
    audit.record(
        db,
        family="business",
        module="panels",
        action="PUBLISH" if panel.enabled and not was_enabled else "UPDATE",
        resource_type="site_panel",
        resource_id=panel.id,
        project_id=project.id,
        diff={k: str(v)[:200] for k, v in values.items()},
    )
    db.commit()
    return service.panel_out(db, panel)


class PhotosIn(BaseModel):
    site_media_ids: list[uuid.UUID] = Field(max_length=service.MAX_PHOTOS)


@router.put("/projects/{project_id}/panel/photos")
def set_photos(
    project_id: uuid.UUID, data: PhotosIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Photos publiées sur la page du chantier (copies publiques sans métadonnées GPS/appareil)."""
    project = _project(db, access, project_id, "projects:publish_client")
    panel = _panel(db, project.id)
    service.set_photos(db, panel, data.site_media_ids, user_id=access.p.id)
    audit.record(
        db,
        family="business",
        module="panels",
        action="PHOTOS",
        resource_type="site_panel",
        resource_id=panel.id,
        project_id=project.id,
        diff={"photos": [str(i) for i in data.site_media_ids]},
    )
    db.commit()
    return service.panel_out(db, panel)


@router.get("/projects/{project_id}/panel/print.pdf")
def panel_pdf(project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> Response:
    project = _project(db, access, project_id, "projects:read")
    panel = _panel(db, project.id)
    return Response(
        service.panel_pdf(db, panel),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="panneau-{panel.slug}.pdf"', "Cache-Control": "no-store"},
    )


@router.get("/projects/{project_id}/panel/qr.png")
def panel_qr(project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> Response:
    project = _project(db, access, project_id, "projects:read")
    panel = _panel(db, project.id)
    return Response(
        service.qr_png(service.public_url(panel, qr=True)),
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="qr-{panel.slug}.png"', "Cache-Control": "no-store"},
    )


@router.get("/projects/{project_id}/panel/messages")
def panel_messages(
    project_id: uuid.UUID,
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    project = _project(db, access, project_id, "projects:read")
    stmt = select(SitePanelMessage).where(SitePanelMessage.project_id == project.id)
    if status:
        stmt = stmt.where(SitePanelMessage.status == status)
    rows = db.execute(stmt.order_by(SitePanelMessage.created_at.desc()).limit(200)).scalars()
    return [service.message_out(m) for m in rows]


class HandleIn(BaseModel):
    note: str | None = Field(default=None, max_length=2000)


@router.post("/projects/{project_id}/panel/messages/{message_id}/handle")
def handle_message(
    project_id: uuid.UUID,
    message_id: uuid.UUID,
    data: HandleIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    project = _project(db, access, project_id, "projects:write")
    entry = db.get(SitePanelMessage, message_id)
    if entry is None or entry.project_id != project.id:
        raise NotFound("Message introuvable")
    entry.status = "handled"
    entry.handled_by_id = access.p.id
    entry.handled_at = utcnow()
    entry.handling_note = data.note
    db.commit()
    return service.message_out(entry)


# ---------------------------------------------------------------------------- public
@public.get("", dependencies=[Depends(rate_limit("panels", "120/minute"))])
def chantiers(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """Chantiers en cours dont le panneau connecté est publié."""
    return service.list_public(db)


@public.get("/{slug}", dependencies=[Depends(rate_limit("panels", "120/minute"))])
def chantier(slug: str, src: str | None = None, db: Session = Depends(get_db)) -> dict[str, Any]:
    panel = service.resolve(db, slug)
    payload = service.public_payload(db, panel)
    if src != "preview":  # aperçus (métadonnées SEO, partage) : pas une visite
        service.record_view(db, panel, from_qr=src == "qr")
        db.commit()
    return payload


class MessageIn(BaseModel):
    kind: str = Field(pattern=r"^(info|devis|riverain|candidature)$")
    name: str = Field(min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    message: str = Field(min_length=10, max_length=4000)
    consent: bool = False
    rendered_at: int | None = None
    website: str | None = Field(default=None, max_length=200)  # pot de miel


@public.post("/{slug}/messages", status_code=201, dependencies=[Depends(rate_limit("panel_msg", "10/hour"))])
def chantier_message(slug: str, data: MessageIn, request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    panel = service.resolve(db, slug)
    ok = {"status": "received", "message": "Merci, l'équipe du chantier vous répondra rapidement."}
    if data.website or (data.rendered_at and time.time() - data.rendered_at < 3):
        return ok  # robot : réponse identique, rien n'est enregistré
    service.submit_message(
        db,
        panel,
        kind=data.kind,
        name=data.name,
        phone=data.phone,
        email=str(data.email) if data.email else None,
        message=data.message,
        consent=data.consent,
        ip=client_ip(request.scope),
        user_agent=request.headers.get("user-agent"),
    )
    db.commit()
    return ok
