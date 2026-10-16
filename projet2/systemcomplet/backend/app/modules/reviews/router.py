"""API Avis clients vérifiés (R6) : invitations (équipe), dépôt par lien nominatif ou depuis l'espace client,
synthèse publique (note moyenne des avis vérifiés publiés)."""

from __future__ import annotations

import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.access import Access, get_access
from app.core.config import settings
from app.core.database import get_db
from app.core.errors import BusinessRuleError, NotFound
from app.core.middleware import client_ip
from app.core.ratelimit import rate_limit
from app.core.security import sha256_hex
from app.modules.reviews import service
from app.modules.reviews.models import ReviewInvitation

router = APIRouter(tags=["Avis clients"])
public = APIRouter(prefix="/public/reviews", tags=["Avis clients (public)"])
MAX_MEDIA_BYTES = settings.MAX_UPLOAD_MB * 4 * 1024 * 1024


def _project(db: Session, access: Access, project_id: uuid.UUID) -> Any:
    from app.modules.projects.models import Project

    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise NotFound("Projet introuvable")
    access.require_project(project.id)
    return project


class InviteIn(BaseModel):
    user_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)  # vide = tous les clients du chantier
    channels: list[Literal["email", "whatsapp"]] = Field(default_factory=lambda: ["email", "whatsapp"], min_length=1)


@router.post("/projects/{project_id}/review-invitations", status_code=201)
def invite(
    project_id: uuid.UUID, data: InviteIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    """Invite le(s) client(s) du chantier à donner leur avis (le lien n'est jamais visible par l'équipe)."""
    if not access.has("crm:write"):
        access.require("projects:publish_client")
    project = _project(db, access, project_id)
    clients = {u.id: u for u in service.client_users(db, project)}
    targets = [clients[i] for i in data.user_ids if i in clients] if data.user_ids else list(clients.values())
    if not targets:
        raise BusinessRuleError("Aucun client actif sur ce chantier", code="NO_CLIENT")
    out = [service.invite(db, project, user, channels=list(data.channels), actor_id=access.p.id) for user in targets]
    db.commit()
    return [service.invitation_out(i) for i in out]


@router.get("/review-invitations")
def list_invitations(
    project_id: uuid.UUID | None = None, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require("projects:read")
    stmt = access.filter_by_project(select(ReviewInvitation), ReviewInvitation.project_id, allow_null=False)
    if project_id:
        stmt = stmt.where(ReviewInvitation.project_id == project_id)
    rows = db.execute(stmt.order_by(ReviewInvitation.created_at.desc()).limit(500)).scalars().all()
    return [service.invitation_out(r) for r in rows]


@router.post("/review-invitations/{invitation_id}/remind")
def remind(
    invitation_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Relance : un nouveau lien remplace le précédent."""
    from app.modules.identity.models import User
    from app.modules.projects.models import Project

    if not access.has("crm:write"):
        access.require("projects:publish_client")
    invitation = db.get(ReviewInvitation, invitation_id)
    if invitation is None:
        raise NotFound("Invitation introuvable")
    access.require_project(invitation.project_id)
    if invitation.status == "completed":
        raise BusinessRuleError("Avis déjà déposé")
    user = db.get(User, invitation.user_id) if invitation.user_id else None
    if user is None:
        raise BusinessRuleError("Client introuvable")
    fresh = service.invite(
        db, db.get(Project, invitation.project_id), user, channels=invitation.channels, actor_id=access.p.id
    )
    fresh.reminded_at = fresh.created_at
    db.commit()
    return service.invitation_out(fresh)


# ---------------------------------------------------------------------------- dépôt (lien et espace client)
async def _read(upload: UploadFile | None) -> tuple[str, bytes] | None:
    if upload is None or not upload.filename:
        return None
    data = await upload.read(MAX_MEDIA_BYTES + 1)
    if len(data) > MAX_MEDIA_BYTES:
        raise BusinessRuleError("Fichier trop volumineux", code="FILE_TOO_LARGE")
    return upload.filename, data


async def _submit(
    db: Session,
    invitation: ReviewInvitation,
    request: Request,
    *,
    rating: int,
    comment: str,
    display: str,
    author_role: str | None,
    location: str | None,
    consent_publish: bool,
    photo: UploadFile | None,
    video: UploadFile | None,
) -> dict[str, Any]:
    ip = client_ip(request.scope)
    service.submit(
        db,
        invitation,
        rating=rating,
        comment=comment,
        display=display,
        author_role=author_role,
        location=location,
        consent_publish=consent_publish,
        photo=await _read(photo),
        video=await _read(video),
        ip_hash=sha256_hex(f"review:{ip}") if ip else None,
    )
    db.commit()
    return {"status": "completed", "published_after_review": consent_publish}


@public.get("/summary")
def reviews_summary(db: Session = Depends(get_db)) -> dict[str, Any]:
    return service.summary(db)


@public.get("/{token}", dependencies=[Depends(rate_limit("reviews", "30/minute"))])
def invitation_info(token: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    from app.modules.cms.models import SiteSettings
    from app.modules.projects.models import Project

    invitation = service.resolve(db, token)
    project = db.get(Project, invitation.project_id)
    site = db.execute(select(SiteSettings)).scalars().first()
    db.commit()
    return {
        "first_name": invitation.recipient_name.split()[0],
        "project_name": project.name if project else "",
        "city": project.city if project else None,
        "company": getattr(site, "company_name", None) or "GLOBUS ENGINEERING",
        "status": invitation.status,
    }


@public.post("/{token}", dependencies=[Depends(rate_limit("reviews", "30/minute"))])
async def submit_public(
    token: str,
    request: Request,
    rating: int = Form(..., ge=1, le=5),
    comment: str = Form(..., min_length=20, max_length=1500),
    display: str = Form("initials", pattern="^(full|initials)$"),
    author_role: str | None = Form(None, max_length=150),
    location: str | None = Form(None, max_length=150),
    consent_publish: bool = Form(False),
    photo: UploadFile | None = File(None),
    video: UploadFile | None = File(None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    invitation = service.resolve(db, token, mark_opened=False)
    return await _submit(
        db,
        invitation,
        request,
        rating=rating,
        comment=comment,
        display=display,
        author_role=author_role,
        location=location,
        consent_publish=consent_publish,
        photo=photo,
        video=video,
    )


@router.get("/client/projects/{project_id}/review")
def my_review(project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict:
    access.require("client:portal")
    project = _project(db, access, project_id)
    invitation = (
        db.execute(
            select(ReviewInvitation)
            .where(ReviewInvitation.project_id == project.id, ReviewInvitation.user_id == access.p.id)
            .order_by(ReviewInvitation.created_at.desc())
        )
        .scalars()
        .first()
    )
    return {
        "invited": invitation is not None and invitation.status in ("sent", "opened"),
        "completed": invitation is not None and invitation.status == "completed",
        "eligible": project.status in service.policy(db)["auto_invite_statuses"],
    }


@router.post("/client/projects/{project_id}/review")
async def submit_client(
    project_id: uuid.UUID,
    request: Request,
    rating: int = Form(..., ge=1, le=5),
    comment: str = Form(..., min_length=20, max_length=1500),
    display: str = Form("initials", pattern="^(full|initials)$"),
    author_role: str | None = Form(None, max_length=150),
    location: str | None = Form(None, max_length=150),
    consent_publish: bool = Form(False),
    photo: UploadFile | None = File(None),
    video: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    """Avis déposé depuis l'espace client (client du chantier, invitation créée si besoin)."""
    access.require("client:portal")
    project = _project(db, access, project_id)
    if project.status not in service.policy(db)["auto_invite_statuses"]:
        raise BusinessRuleError("Votre avis sera sollicité à la remise des clés", code="REVIEW_NOT_YET")
    invitation = (
        db.execute(
            select(ReviewInvitation)
            .where(
                ReviewInvitation.project_id == project.id,
                ReviewInvitation.user_id == access.p.id,
                ReviewInvitation.status.in_(["sent", "opened", "completed"]),
            )
            .order_by(ReviewInvitation.created_at.desc())
        )
        .scalars()
        .first()
    )
    if invitation is None:
        invitation = service.invite(db, project, access.p.user, channels=[], actor_id=access.p.id)
    return await _submit(
        db,
        invitation,
        request,
        rating=rating,
        comment=comment,
        display=display,
        author_role=author_role,
        location=location,
        consent_publish=consent_publish,
        photo=photo,
        video=video,
    )
