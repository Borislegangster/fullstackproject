"""Avis clients vérifiés (R6) — invitations, dépôt (lien nominatif ou espace client), modération, synthèse publique.

Garanties : un avis n'est « vérifié » que s'il provient d'une invitation nominative liée à un chantier réel ; le lien
n'est jamais montré à l'équipe (elle ne peut pas déposer d'avis à la place du client) ; la publication exige le
consentement explicite du client (tracé), sinon la note reste interne (mesure de satisfaction).
"""

from __future__ import annotations

import logging
import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.errors import BusinessRuleError, Conflict, NotFound
from app.core.events import emit
from app.core.security import random_token, sha256_hex
from app.core.utils import jsonable, utcnow
from app.modules.reviews.models import ReviewInvitation

log = logging.getLogger("globus.reviews")
DEFAULTS: dict[str, Any] = {"auto_invite_statuses": ["reception", "garantie"], "ttl_days": 45}


def policy(db: Session) -> dict[str, Any]:
    from app.modules.system.models import Setting

    row = db.get(Setting, "reviews")
    return {**DEFAULTS, **(row.value if row and isinstance(row.value, dict) else {})}


def client_users(db: Session, project: Any) -> list[Any]:
    from app.modules.identity.models import User
    from app.modules.projects.models import ProjectMember

    ids = set(
        db.execute(
            select(ProjectMember.user_id).where(
                ProjectMember.project_id == project.id, ProjectMember.project_role == "client"
            )
        ).scalars()
    )
    if project.client_organization_id:
        ids |= set(
            db.execute(
                select(User.id).where(User.organization_id == project.client_organization_id, User.is_active.is_(True))
            ).scalars()
        )
    return [u for u in (db.get(User, i) for i in ids) if u is not None and u.is_active]


def invite(
    db: Session, project: Any, user: Any, *, channels: list[str], actor_id: uuid.UUID | None
) -> ReviewInvitation:
    """Crée une invitation nominative (le jeton n'est transmis qu'au client, par ses canaux)."""
    for previous in db.execute(
        select(ReviewInvitation).where(
            ReviewInvitation.project_id == project.id,
            ReviewInvitation.user_id == user.id,
            ReviewInvitation.status.in_(["sent", "opened"]),
        )
    ).scalars():
        previous.status = "expired"
    token = random_token(24)
    invitation = ReviewInvitation(
        project_id=project.id,
        user_id=user.id,
        recipient_name=user.full_name,
        token_hash=sha256_hex(token),
        channels=channels,
        status="sent",
        expires_at=utcnow() + timedelta(days=int(policy(db)["ttl_days"])),
        created_by_id=actor_id,
    )
    db.add(invitation)
    db.flush()
    if channels:  # dépôt direct depuis l'espace client : aucun envoi
        _send_invitation(db, invitation, user, project, token, channels)
    return invitation


def _send_invitation(
    db: Session, invitation: ReviewInvitation, user: Any, project: Any, token: str, channels: list[str]
) -> None:
    """Le lien nominatif part directement au client (e-mail / WhatsApp) : il ne transite ni par les événements
    métier (webhooks sortants, temps réel), ni par l'interface de l'équipe."""
    from app.core.utils import clean_phone
    from app.modules.notifications.service import queue_external

    context = {
        "first_name": user.first_name,
        "project_name": project.name,
        "link": f"{settings.PUBLIC_BASE_URL.rstrip('/')}/avis/{token}",
        "title": f"Votre avis compte — {project.name}",
        "body": f"Bonjour {user.first_name}, comment s'est passé votre projet avec GLOBUS ? 2 minutes suffisent.",
    }
    if "email" in channels and user.email:
        queue_external(db, channel="email", recipient=user.email, template_code="review.invited", context=context)
    whatsapp = clean_phone(getattr(user, "whatsapp", None) or user.phone)
    if "whatsapp" in channels and whatsapp:
        queue_external(db, channel="whatsapp", recipient=whatsapp, template_code="review.invited", context=context)
    emit(
        db,
        "review.invited",
        {
            "invitation_id": invitation.id,
            "user_id": user.id,
            "first_name": user.first_name,
            "project_id": project.id,
            "project_name": project.name,
        },
        aggregate_type="project",
        aggregate_id=project.id,
        project_id=project.id,
    )


def auto_invite(db: Session, project: Any) -> int:
    """Remise des clés : invite chaque client du chantier n'ayant pas encore donné son avis."""
    count = 0
    for user in client_users(db, project):
        done = db.execute(
            select(ReviewInvitation.id).where(
                ReviewInvitation.project_id == project.id,
                ReviewInvitation.user_id == user.id,
                ReviewInvitation.status.in_(["sent", "opened", "completed"]),
            )
        ).first()
        if done is None:
            invite(db, project, user, channels=["email", "whatsapp"], actor_id=None)
            count += 1
    return count


def resolve(db: Session, token: str, *, mark_opened: bool = True) -> ReviewInvitation:
    invitation = db.execute(
        select(ReviewInvitation).where(ReviewInvitation.token_hash == sha256_hex(token))
    ).scalar_one_or_none()
    if invitation is None or invitation.status == "expired":
        raise NotFound("Invitation inconnue ou remplacée par une plus récente")
    if invitation.status != "completed" and invitation.expires_at < utcnow():
        invitation.status = "expired"
        raise NotFound("Invitation expirée : demandez un nouveau lien à votre chef de projet")
    if mark_opened and invitation.status == "sent":
        invitation.status = "opened"
        invitation.opened_at = utcnow()
    return invitation


def _display_name(full_name: str, mode: str) -> str:
    parts = full_name.split()
    if mode == "initials" and len(parts) > 1:
        return f"{parts[0]} {parts[-1][0]}."
    return full_name


def _upload(db: Session, upload: tuple[str, bytes] | None, *, title: str) -> uuid.UUID | None:
    if not upload:
        return None
    from app.core.errors import Conflict as MediaConflict
    from app.modules.cms.media import upload_media

    filename, data = upload
    try:
        return upload_media(
            db,
            filename=filename,
            data=data,
            title=title,
            alt_text=title,
            folder="avis-clients",
            tags=["avis", "client"],
            author_id=None,
        ).id
    except MediaConflict as exc:
        return uuid.UUID(str(exc.details["media_id"])) if isinstance(exc.details, dict) else None


def submit(
    db: Session,
    invitation: ReviewInvitation,
    *,
    rating: int,
    comment: str,
    display: str,
    author_role: str | None,
    location: str | None,
    consent_publish: bool,
    photo: tuple[str, bytes] | None = None,
    video: tuple[str, bytes] | None = None,
    ip_hash: str | None = None,
) -> ReviewInvitation:
    from app.modules.cms.models import Testimonial
    from app.modules.projects.models import Project

    if invitation.status == "completed":
        raise Conflict("Avis déjà déposé — merci !", code="REVIEW_ALREADY_SUBMITTED")
    comment = (comment or "").strip()
    if not 1 <= rating <= 5:
        raise BusinessRuleError("Note de 1 à 5")
    if len(comment) < 20:
        raise BusinessRuleError("Quelques mots de plus (20 caractères minimum)", code="REVIEW_TOO_SHORT")
    project = db.get(Project, invitation.project_id)
    now = utcnow()
    invitation.rating = rating
    invitation.comment = comment[:1500]
    invitation.consent_publish = consent_publish
    invitation.status = "completed"
    invitation.completed_at = now
    if consent_publish:
        author = _display_name(invitation.recipient_name, display)
        testimonial = Testimonial(
            author_name=author,
            author_role=(author_role or "").strip()[:150] or None,
            location=(location or (project.city if project else None) or "")[:150] or None,
            universe=project.universe if project else None,
            quote=comment[:1500],
            rating=rating,
            verified=True,
            project_id=invitation.project_id,
            submitted_at=now,
            consent_reference=f"Invitation {invitation.id} — consentement de publication du {now:%d/%m/%Y %H:%M} UTC"
            + (f" — {ip_hash[:12]}" if ip_hash else ""),
            status="in_review",
            created_by_id=invitation.user_id,
        )
        testimonial.photo_media_id = _upload(db, photo, title=f"Avis de {author}")
        testimonial.video_media_id = _upload(db, video, title=f"Vidéo — avis de {author}")
        db.add(testimonial)
        db.flush()
        invitation.testimonial_id = testimonial.id
    audit.record(
        db,
        family="business",
        module="reviews",
        action="SUBMIT",
        resource_type="review_invitation",
        resource_id=invitation.id,
        project_id=invitation.project_id,
        actor_id=invitation.user_id,
        diff={"rating": rating, "consent_publish": consent_publish},
    )
    emit(
        db,
        "review.submitted",
        {
            "id": invitation.testimonial_id or invitation.id,
            "rating": rating,
            "project_name": project.name if project else "",
            "author": invitation.recipient_name,
            "consent_publish": consent_publish,
            "excerpt": comment[:160],
        },
        aggregate_type="review_invitation",
        aggregate_id=invitation.id,
        project_id=invitation.project_id,
    )
    return invitation


def summary(db: Session) -> dict[str, Any]:
    """Synthèse publique des avis vérifiés publiés (note moyenne, volume, répartition)."""
    from app.modules.cms.models import Testimonial
    from app.modules.cms.service import live_filter

    rows = db.execute(
        select(Testimonial.rating, func.count())
        .where(*live_filter(Testimonial), Testimonial.verified.is_(True), Testimonial.rating.is_not(None))
        .group_by(Testimonial.rating)
    ).all()
    count = sum(c for _, c in rows)
    if not count:
        return {"count": 0, "average": None, "distribution": {}}
    average = sum(Decimal(r) * c for r, c in rows) / count
    return jsonable(
        {
            "count": count,
            "average": round(float(average), 1),
            "distribution": {str(r): c for r, c in sorted(rows, reverse=True)},
        }
    )


def invitation_out(invitation: ReviewInvitation) -> dict[str, Any]:
    return jsonable(
        {
            "id": invitation.id,
            "project_id": invitation.project_id,
            "user_id": invitation.user_id,
            "recipient_name": invitation.recipient_name,
            "channels": invitation.channels,
            "status": invitation.status,
            "created_at": invitation.created_at,
            "opened_at": invitation.opened_at,
            "completed_at": invitation.completed_at,
            "expires_at": invitation.expires_at,
            "rating": invitation.rating,
            "consent_publish": invitation.consent_publish,
            "testimonial_id": invitation.testimonial_id,
        }
    )


__all__ = ["auto_invite", "client_users", "invitation_out", "invite", "policy", "resolve", "submit", "summary"]
