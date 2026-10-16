"""Visite immersive partageable (innovation R5).

Le client (ou l'équipe) crée un lien vers un contenu publié : photo / vidéo 360°, visite virtuelle, vidéo drone ou
maquette 3D du configurateur. Les invités l'ouvrent sans compte, en VR (casque WebXR) ou au gyroscope du téléphone.
Sécurité : jeton aléatoire (empreinte seule en base), expiration obligatoire (90 jours max), nombre de vues
plafonnable, code PIN facultatif (5 essais), révocation immédiate ; les fichiers sont servis par liens signés courts ;
aucune donnée financière ni personnelle n'est exposée.
"""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError, BusinessRuleError, NotFound
from app.core.security import random_token, sha256_hex
from app.core.utils import jsonable, utcnow
from app.modules.visits.models import ImmersiveShare

MAX_DAYS = 90
MAX_PIN_FAILURES = 5
SHAREABLE_KINDS = ("photo_360", "video_360", "virtual_tour", "drone", "timelapse")


def _pin_hash(share_id: uuid.UUID, pin: str) -> str:
    return sha256_hex(f"visit:{share_id}:{pin.strip()}")


def create(
    db: Session,
    project: Any,
    *,
    content_id: uuid.UUID | None,
    model_id: uuid.UUID | None,
    days: int,
    pin: str | None,
    max_views: int | None,
    message: str | None,
    user_id: uuid.UUID | None,
    client: bool,
) -> tuple[ImmersiveShare, str]:
    from app.modules.configurator.models import ConfiguratorModel
    from app.modules.projects.models import ImmersiveContent

    if (content_id is None) == (model_id is None):
        raise BusinessRuleError("Choisissez un contenu 360° / vidéo OU une maquette 3D")
    if not 1 <= days <= MAX_DAYS:
        raise BusinessRuleError(f"Durée de validité : 1 à {MAX_DAYS} jours", code="INVALID_EXPIRY")
    if pin is not None and not (pin.isdigit() and 4 <= len(pin) <= 8):
        raise BusinessRuleError("Code PIN : 4 à 8 chiffres", code="INVALID_PIN")
    if content_id:
        content = db.get(ImmersiveContent, content_id)
        if content is None or content.project_id != project.id or content.kind not in SHAREABLE_KINDS:
            raise NotFound("Contenu immersif introuvable")
        if client and not content.published_to_client:
            raise NotFound("Contenu immersif introuvable")
        if not (content.file_id or content.external_url):
            raise BusinessRuleError("Ce contenu n'a pas de média à partager")
        title, content_type = content.title, "immersive"
    else:
        model = db.get(ConfiguratorModel, model_id)
        if model is None or model.project_id != project.id or not model.file_id:
            raise NotFound("Maquette 3D introuvable")
        if client and not model.published_to_client:
            raise NotFound("Maquette 3D introuvable")
        title, content_type = model.name, "model"
    token = random_token(24)
    share = ImmersiveShare(
        id=uuid.uuid4(),
        project_id=project.id,
        content_type=content_type,
        content_id=content_id,
        model_id=model_id,
        title=title[:200],
        message=(message or "").strip()[:500] or None,
        token_hash=sha256_hex(token),
        token_hint=token[-6:],
        expires_at=utcnow() + timedelta(days=days),
        max_views=max_views,
        created_by_id=user_id,
    )
    if pin:
        share.pin_hash = _pin_hash(share.id, pin)
    db.add(share)
    db.flush()
    return share, f"{settings.PUBLIC_BASE_URL.rstrip('/')}/visite/{token}"


def resolve(db: Session, token: str) -> ImmersiveShare:
    share = db.execute(
        select(ImmersiveShare).where(ImmersiveShare.token_hash == sha256_hex(token))
    ).scalar_one_or_none()
    if share is None or share.revoked_at is not None:
        raise NotFound("Lien de visite inconnu ou révoqué")
    if share.expires_at < utcnow():
        raise NotFound("Lien de visite expiré : demandez-en un nouveau")
    if share.max_views is not None and share.views >= share.max_views:
        raise NotFound("Ce lien a atteint son nombre maximal de visites")
    return share


def preview(db: Session, share: ImmersiveShare) -> dict[str, Any]:
    from app.modules.projects.models import ImmersiveContent, Project

    project = db.get(Project, share.project_id)
    kind = "model"
    if share.content_id:
        content = db.get(ImmersiveContent, share.content_id)
        kind = content.kind if content else "photo_360"
    return jsonable(
        {
            "title": share.title,
            "project": project.name if project else None,
            "city": project.city if project else None,
            "kind": kind,
            "message": share.message,
            "requires_pin": share.pin_hash is not None,
            "locked": share.pin_failures >= MAX_PIN_FAILURES,
            "expires_at": share.expires_at,
        }
    )


def open_visit(db: Session, share: ImmersiveShare, pin: str | None) -> dict[str, Any]:
    """Vérifie le PIN, compte la vue et renvoie les URL signées (2 h) du contenu."""
    from app.core.downloads import signed_url
    from app.modules.configurator.models import ConfiguratorModel
    from app.modules.projects.models import ImmersiveContent

    if share.pin_hash:
        if share.pin_failures >= MAX_PIN_FAILURES:
            raise AppError("Lien verrouillé après plusieurs codes erronés", code="VISIT_LOCKED", status_code=423)
        if not pin or _pin_hash(share.id, pin) != share.pin_hash:
            share.pin_failures += 1
            db.commit()
            raise AppError("Code incorrect", code="VISIT_PIN_INVALID", status_code=403)
    share.views += 1
    share.last_viewed_at = utcnow()
    out: dict[str, Any] = {"title": share.title, "content_type": share.content_type}
    if share.content_id:
        content = db.get(ImmersiveContent, share.content_id)
        if content is None:
            raise NotFound("Contenu retiré")
        out.update(
            {
                "kind": content.kind,
                "description": content.description,
                "captured_at": content.captured_at,
                "url": content.external_url or signed_url(content.file_id, user_id=None, ttl=7200),
                "external": bool(content.external_url),
            }
        )
    else:
        model = db.get(ConfiguratorModel, share.model_id)
        if model is None or not model.file_id:
            raise NotFound("Maquette retirée")
        out.update({"kind": "model", "url": signed_url(model.file_id, user_id=None, ttl=7200), "external": False})
    return jsonable(out)


def share_out(share: ImmersiveShare) -> dict[str, Any]:
    return jsonable(
        {
            "id": share.id,
            "project_id": share.project_id,
            "content_type": share.content_type,
            "content_id": share.content_id,
            "model_id": share.model_id,
            "title": share.title,
            "message": share.message,
            "token_hint": f"…{share.token_hint}",
            "has_pin": share.pin_hash is not None,
            "expires_at": share.expires_at,
            "max_views": share.max_views,
            "views": share.views,
            "last_viewed_at": share.last_viewed_at,
            "revoked_at": share.revoked_at,
            "active": share.revoked_at is None and share.expires_at > utcnow(),
            "created_at": share.created_at,
        }
    )


__all__ = ["create", "open_visit", "preview", "resolve", "share_out"]
