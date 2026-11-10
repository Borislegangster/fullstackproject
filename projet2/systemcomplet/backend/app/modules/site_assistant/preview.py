"""Aperçu fidèle, sur le vrai site, de ce que l'assistant a préparé : page ou élément tel que le verront les
visiteurs une fois la proposition appliquée (ou brouillon tel qu'il sera publié).

Mécanisme : jeton signé de 30 minutes (même circuit que l'aperçu du CMS, Draft Mode Next.js). Pour une proposition,
le rendu est calculé dans une transaction annulée — modification appliquée avec les droits de la personne qui a
lancé la conversation, page recalculée, puis tout est défait : rien n'est enregistré ni révalidé.
"""

from __future__ import annotations

import uuid
from typing import Any

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.utils import jsonable
from app.modules.cms import details, service
from app.modules.site_assistant import cms_ops
from app.modules.site_assistant.models import SiteAssistantAction, SiteAssistantSession

PROPOSAL_TOOLS = {"save_page", "update_content"}


def _has_detail_page(db: Session, kind: str, obj: Any) -> bool:
    return kind in service.COLLECTIONS and details.detail_payload(db, kind, obj) is not None


def preview_target(db: Session, action: SiteAssistantAction) -> dict[str, Any] | None:
    """Où regarder le résultat d'une action : {path, token} (token absent = page en ligne, déjà à jour)."""
    kind, target_id = action.target_type, action.target_id
    if not kind or not target_id or kind in ("media", "navigation", "site_settings"):
        return None
    try:
        obj = cms_ops.load(db, kind, target_id)
    except AppError:
        return None
    if kind == "page":
        path = obj.path
        if action.tool == "save_page" and action.status == "proposed":
            path = str((action.payload.get("page") or {}).get("path") or obj.path)
            return {"path": path, "token": details.preview_token("proposal", action.id)}
        if obj.status != "published":
            return {"path": path, "token": details.preview_token("page", obj.id)}
        return {"path": path, "token": None}
    if not _has_detail_page(db, kind, obj):
        return None
    path = service.public_path(db, kind, obj)
    if action.tool == "update_content" and action.status == "proposed":
        return {"path": path, "token": details.preview_token("proposal", action.id)}
    if obj.status != "published":
        return {"path": path, "token": details.preview_token(kind, obj.id)}
    return {"path": path, "token": None}


def _forget_revalidation(db: Session, before: set[str]) -> None:
    if before:
        db.info["revalidate_paths"] = set(before)
    else:
        db.info.pop("revalidate_paths", None)


def proposal_preview(db: Session, action_id: uuid.UUID) -> dict[str, Any] | None:
    """Rendu public d'une proposition en attente ({kind, detail}), sans rien enregistrer."""
    from app.modules.site_assistant.tools import apply_action

    action = db.get(SiteAssistantAction, action_id)
    if action is None or action.status != "proposed" or action.tool not in PROPOSAL_TOOLS:
        return None
    session = db.get(SiteAssistantSession, action.session_id)
    if session is None:
        return None
    try:
        principal = cms_ops.principal_for(db, session.user_id)
    except AppError:
        return None
    payload = action.payload or {}
    before = set(db.info.get("revalidate_paths", ()))
    savepoint = db.begin_nested()
    try:
        apply_action(db, principal, action)
        db.flush()
        if action.tool == "save_page":
            page = cms_ops.load(db, "page", payload["page_id"])
            db.refresh(page)
            return {"kind": "page", "detail": jsonable(service.page_public_payload(db, page))}
        kind = payload["kind"]
        obj = cms_ops.load(db, kind, payload["id"])
        detail = details.detail_payload(db, kind, obj)
        return {"kind": kind, "detail": jsonable(detail)} if detail is not None else None
    except (AppError, ValidationError, KeyError):
        return None
    finally:
        savepoint.rollback()
        _forget_revalidation(db, before)
