"""Opérations CMS exécutées pour l'assistant du site, avec exactement les règles des écrans : schémas de saisie,
adresses (slug) déduites et uniques, redirections automatiques, révisions, journal d'audit, droits de la personne.

Chaque opération est appelée soit par Claude (brouillons, ou essai à blanc d'une proposition dans un point de
sauvegarde annulé), soit par la personne qui applique une proposition — toujours avec SES droits."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access
from app.core.crud import apply_changes, model_schema
from app.core.deps import Principal, _permissions_for, org_kind_of
from app.core.errors import AppError, NotFound
from app.core.utils import jsonable
from app.modules.cms import media as media_svc
from app.modules.cms import models as m
from app.modules.cms import service
from app.modules.cms.schemas import MediaUpdate, PageIn, SeoIn

# Champs gérés par le serveur (circuit de publication, compteurs) : jamais saisis, comme dans les écrans.
_EXCLUDE_IN = {
    "status",
    "published_at",
    "archived_at",
    "revision",
    "created_by_id",
    "updated_by_id",
    "reviewed_by_id",
    "approved_by_id",
    "view_count",
    "like_count",
    "share_count",
    "comment_count",
    "helpful_yes",
    "helpful_no",
}
_REDIRECT_EXCLUDE = {"hits", "last_hit_at", "auto_generated", "created_by_id"}


def principal_for(db: Session, user_id: uuid.UUID) -> Principal:
    """Droits actuels d'une personne (travail en arrière-plan, hors requête HTTP)."""
    from app.modules.identity.models import User

    user = db.get(User, user_id)
    if user is None or not user.is_active or user.deleted_at is not None:
        raise NotFound("Compte introuvable ou inactif")
    perms, global_scope, _ = _permissions_for(user)
    return Principal(
        user=user,
        session_id=None,
        roles=set(user.role_codes),
        permissions=perms,
        organization_id=user.organization_id,
        org_kind=org_kind_of(user),
        global_scope=global_scope,
        mfa_verified=True,
        auth_via="assistant",
    )


def create_schema(key: str) -> Any:
    model = service.get_collection(key).model
    return model_schema(model, name=f"{model.__name__}AssistantCreate", exclude=_EXCLUDE_IN, optional={"slug", "key"})


def update_schema(key: str) -> Any:
    model = service.get_collection(key).model
    return model_schema(model, name=f"{model.__name__}AssistantUpdate", exclude=_EXCLUDE_IN, partial=True)


def load(db: Session, kind: str, entity_id: str) -> Any:
    try:
        ident = uuid.UUID(str(entity_id))
    except ValueError as exc:
        raise NotFound("Identifiant invalide") from exc
    model = m.CmsPage if kind == "page" else service.get_collection(kind).model
    obj = db.get(model, ident)
    if obj is None or getattr(obj, "deleted_at", None) is not None:
        raise NotFound("Élément introuvable")
    return obj


def title_of(kind: str, obj: Any) -> str:
    if kind == "page":
        return f"{obj.title} ({obj.path})"
    return str(getattr(obj, service.get_collection(kind).title_attr, None) or obj.id)


# ---------------------------------------------------------------------------- collections
def collection_create(db: Session, principal: Principal, key: str, data: dict[str, Any]) -> Any:
    from app.modules.cms.router_admin import _collection_hooks

    access = Access(principal, db)
    access.require("cms:write")
    model = service.get_collection(key).model
    values = create_schema(key).model_validate(data).model_dump()
    cols = model.__table__.columns
    obj = model(**{k: v for k, v in values.items() if v is not None or cols[k].nullable})
    hooks = _collection_hooks(key)
    hooks["before_create"](db, obj, access, values)
    db.add(obj)
    db.flush()
    audit.record(
        db,
        family="business",
        module="cms",
        action="CREATE",
        resource_type=model.__tablename__,
        resource_id=obj.id,
        diff=audit.diff_dicts({}, jsonable(values)),
        reason="Assistant du site (Claude)",
    )
    hooks["after_change"](db, obj, access, "create")
    return obj


def collection_update(db: Session, principal: Principal, key: str, obj: Any, changes: dict[str, Any]) -> Any:
    from app.modules.cms.router_admin import _collection_hooks

    access = Access(principal, db)
    access.require("cms:write")
    values = update_schema(key).model_validate(changes).model_dump(exclude_unset=True)
    hooks = _collection_hooks(key)
    hooks["before_update"](db, obj, access, values)
    diff = apply_changes(obj, values)
    db.flush()
    if diff:
        audit.record(
            db,
            family="business",
            module="cms",
            action="UPDATE",
            resource_type=obj.__tablename__,
            resource_id=obj.id,
            diff=diff,
            reason="Assistant du site (Claude)",
        )
    hooks["after_change"](db, obj, access, "update")
    return obj


# ---------------------------------------------------------------------------- pages
def page_save(db: Session, principal: Principal, data: dict[str, Any], page: m.CmsPage | None) -> m.CmsPage:
    principal.require("cms:write")
    return service.save_page(db, principal, PageIn.model_validate(data), page)


# ---------------------------------------------------------------------------- SEO
def seo_set(db: Session, principal: Principal, target_type: str, target_key: str, changes: dict[str, Any]) -> Any:
    """Modifie seulement les champs donnés : les autres réglages SEO de la cible sont conservés."""
    principal.require("seo:write")
    row = service.get_seo(db, target_type, target_key)
    current = {name: getattr(row, name) for name in SeoIn.model_fields if row is not None and hasattr(row, name)}
    merged = SeoIn.model_validate({**current, **changes})
    saved = service.upsert_seo(db, target_type, target_key, merged)
    audit.record(
        db,
        family="business",
        module="seo",
        action="UPDATE",
        resource_type="seo_metadata",
        resource_id=saved.id if saved else None,
        diff={"target": f"{target_type}:{target_key}", "fields": sorted(changes)},
        reason="Assistant du site (Claude)",
    )
    return saved


# ---------------------------------------------------------------------------- médiathèque
def media_update(db: Session, principal: Principal, media_id: str, changes: dict[str, Any]) -> m.MediaAsset:
    principal.require("media:write")
    asset = media_svc.get_media(db, uuid.UUID(str(media_id)))
    values = MediaUpdate.model_validate(changes).model_dump(exclude_unset=True)
    values.pop("poster_media_id", None)
    before = audit.snapshot(asset, list(values))
    for key, value in values.items():
        setattr(asset, key, value)
    db.add(m.MediaRevision(media_id=asset.id, action="update", user_id=principal.id, changes=jsonable(values)))
    audit.record(
        db,
        family="business",
        module="media",
        action="UPDATE",
        resource_type="media",
        resource_id=asset.id,
        diff=audit.diff_dicts(before, values),
        reason="Assistant du site (Claude)",
    )
    db.flush()
    return asset


# ---------------------------------------------------------------------------- redirections
def redirect_create(db: Session, principal: Principal, data: dict[str, Any]) -> m.Redirect:
    from app.modules.cms.router_admin import _check_redirect

    principal.require("seo:write")
    schema = model_schema(m.Redirect, name="RedirectAssistantCreate", exclude=_REDIRECT_EXCLUDE)
    values = schema.model_validate(data).model_dump()
    obj = m.Redirect(**{k: v for k, v in values.items() if v is not None}, created_by_id=principal.id)
    _check_redirect(db, obj)
    db.add(obj)
    db.flush()
    audit.record(
        db,
        family="business",
        module="seo",
        action="CREATE",
        resource_type="redirects",
        resource_id=obj.id,
        diff=jsonable(values),
        reason="Assistant du site (Claude)",
    )
    return obj


# ---------------------------------------------------------------------------- publication
def publish(db: Session, principal: Principal, kind: str, obj: Any, note: str | None) -> Any:
    """Publication (circuit court du publicateur) : soumise au droit cms:publish de la personne qui valide."""
    if obj.status == "published":
        return obj
    return service.transition(db, principal, kind, obj, "published", note=note or "Publié depuis l'assistant du site")


def check_publishable(db: Session, kind: str, obj: Any) -> None:
    service._check_publishable(db, kind, obj)


def unpublish(db: Session, principal: Principal, kind: str, obj: Any, note: str | None) -> Any:
    """Retrait du site (archivage) : soumis aux droits de la personne qui valide."""
    if obj.status == "archived":
        return obj
    return service.transition(db, principal, kind, obj, "archived", note=note or "Retiré depuis l'assistant du site")


# ---------------------------------------------------------------------------- navigation et réglages du site
# Réglages du site que l'assistant peut proposer : textes de présentation et SEO par défaut. Les coordonnées
# légales, balises de suivi, bandeau cookies, robots et logos restent réservés aux écrans de réglage.
ASSISTANT_SITE_FIELDS = frozenset(
    {"slogan", "promise", "default_meta_description", "seo_title_template", "default_og_media_id", "opening_hours"}
)


def navigation_save(db: Session, principal: Principal, key: str, data: dict[str, Any]) -> Any:
    from app.modules.cms.router_admin import save_navigation
    from app.modules.cms.schemas import NavigationIn

    principal.require("cms:write")
    menu = save_navigation(db, key, NavigationIn.model_validate(data))
    service.revalidate_after_commit(db, ["/"])
    return menu


def site_settings_save(db: Session, principal: Principal, changes: dict[str, Any]) -> Any:
    from app.modules.cms.router_admin import save_site_settings

    principal.require("cms:publish")
    unknown = sorted(set(changes) - ASSISTANT_SITE_FIELDS)
    if unknown:
        raise AppError(
            "Réglages modifiables par l'assistant : " + ", ".join(sorted(ASSISTANT_SITE_FIELDS)) + f" (refusé : "
            f"{', '.join(unknown)})",
            code="SITE_FIELD_NOT_ALLOWED",
        )
    site = save_site_settings(db, changes)
    service.revalidate_after_commit(db, ["/"])
    return site
