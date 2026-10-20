"""API d'administration du CMS (ERP → CMS / Médiathèque / SEO)."""

from __future__ import annotations

import csv
import io
import re
import uuid
from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile
from pydantic import BaseModel, Field, TypeAdapter
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access
from app.core.crud import make_crud_router
from app.core.database import get_db
from app.core.deps import Principal, require
from app.core.errors import AppError, Conflict, NotFound
from app.core.pagination import PageParams, paginate
from app.core.utils import jsonable, slugify, utcnow
from app.modules.cms import media as media_svc
from app.modules.cms import models as m
from app.modules.cms import service
from app.modules.cms.schemas import (
    Block,
    CommentIn,
    ExternalVideoIn,
    MediaUpdate,
    NavigationIn,
    PageIn,
    SeoIn,
    TransitionIn,
)

router = APIRouter(prefix="/cms", tags=["CMS"])
_blocks_adapter = TypeAdapter(list[Block])


# ---------------------------------------------------------------------------- pages
def _page_out(db: Session, page: m.CmsPage, *, full: bool = False) -> dict[str, Any]:
    seo = service.get_seo(db, "page", page.route_key)
    data: dict[str, Any] = {
        "id": page.id,
        "route_key": page.route_key,
        "path": page.path,
        "title": page.title,
        "template": page.template,
        "status": page.status,
        "summary": page.summary,
        "publish_at": page.publish_at,
        "unpublish_at": page.unpublish_at,
        "published_at": page.published_at,
        "revision": page.revision,
        "updated_at": page.updated_at,
        "seo_issues": service.seo_issues(seo, page.title),
        "live": service.is_live(page),
        "system": page.route_key in service.SYSTEM_PAGES,
    }
    if full:
        data["body"] = page.body
        data["sort_order"] = page.sort_order
        data["sections"] = [
            {
                "id": s.id,
                "key": s.key,
                "title": s.title,
                "visible": s.visible,
                "settings": s.settings,
                "blocks": [{"id": b.id, "visible": b.visible, "data": b.data} for b in s.blocks],
            }
            for s in page.sections
        ]
        data["seo"] = {c.key: getattr(seo, c.key) for c in seo.__table__.columns} if seo else None
    return jsonable(data)


def _get_page(db: Session, page_id: uuid.UUID) -> m.CmsPage:
    page = db.get(m.CmsPage, page_id)
    if page is None:
        raise NotFound("Page introuvable")
    return page


@router.get("/pages")
def list_pages(
    status: str | None = None, principal: Principal = Depends(require("cms:read")), db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    stmt = select(m.CmsPage).order_by(m.CmsPage.sort_order, m.CmsPage.path)
    if status:
        stmt = stmt.where(m.CmsPage.status == status)
    return [_page_out(db, p) for p in db.execute(stmt).scalars()]


@router.post("/pages", status_code=201)
def create_page(
    data: PageIn, principal: Principal = Depends(require("cms:write")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    page = service.save_page(db, principal, data)
    db.commit()
    return _page_out(db, page, full=True)


@router.get("/pages/{page_id}")
def get_page(
    page_id: uuid.UUID, principal: Principal = Depends(require("cms:read")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    return _page_out(db, _get_page(db, page_id), full=True)


@router.put("/pages/{page_id}")
def update_page(
    page_id: uuid.UUID,
    data: PageIn,
    principal: Principal = Depends(require("cms:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    page = service.save_page(db, principal, data, _get_page(db, page_id))
    db.commit()
    return _page_out(db, page, full=True)


@router.post("/pages/{page_id}/transition")
def transition_page(
    page_id: uuid.UUID,
    data: TransitionIn,
    principal: Principal = Depends(require("cms:read")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    page = service.transition(
        db,
        principal,
        "page",
        _get_page(db, page_id),
        data.target,
        note=data.note,
        publish_at=data.publish_at,
        unpublish_at=data.unpublish_at,
    )
    db.commit()
    return _page_out(db, page, full=True)


@router.get("/pages/{page_id}/preview")
def preview_page(
    page_id: uuid.UUID, principal: Principal = Depends(require("cms:read")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    return jsonable(service.page_public_payload(db, _get_page(db, page_id)))


@router.delete("/pages/{page_id}")
def delete_page(
    page_id: uuid.UUID, principal: Principal = Depends(require("cms:publish")), db: Session = Depends(get_db)
) -> dict[str, str]:
    page = _get_page(db, page_id)
    if page.route_key in service.SYSTEM_PAGES:
        raise Conflict(
            f"« {page.title} » est une page du site à adresse fixe : elle ne peut pas être supprimée "
            "(modifiez ou masquez ses sections).",
            code="SYSTEM_PAGE",
        )
    if page.status == "published":
        raise Conflict("Archivez la page avant de la supprimer", code="PAGE_PUBLISHED")
    service.add_revision(db, "page", page, principal.id, note="Suppression")
    audit.record(
        db,
        family="business",
        module="cms",
        action="DELETE",
        resource_type="cms_page",
        resource_id=page.id,
        diff={"route_key": page.route_key},
        criticality="MEDIUM",
    )
    db.delete(page)
    db.commit()
    return {"status": "deleted"}


# ---------------------------------------------------------------------------- révisions
@router.get("/revisions/{entity_type}/{entity_id}")
def list_revisions(
    entity_type: str,
    entity_id: uuid.UUID,
    principal: Principal = Depends(require("cms:read")),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    rows = (
        db.execute(
            select(m.CmsRevision)
            .where(m.CmsRevision.entity_type == entity_type, m.CmsRevision.entity_id == entity_id)
            .order_by(m.CmsRevision.number.desc())
        )
        .scalars()
        .all()
    )
    return [
        {
            "id": r.id,
            "number": r.number,
            "status": r.status,
            "note": r.note,
            "user_id": r.user_id,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.get("/revisions/item/{revision_id}")
def get_revision(
    revision_id: uuid.UUID, principal: Principal = Depends(require("cms:read")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    rev = db.get(m.CmsRevision, revision_id)
    if rev is None:
        raise NotFound("Révision introuvable")
    return {"id": rev.id, "number": rev.number, "entity_type": rev.entity_type, "snapshot": rev.snapshot}


@router.post("/revisions/item/{revision_id}/restore")
def restore_revision(
    revision_id: uuid.UUID, principal: Principal = Depends(require("cms:write")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    rev = db.get(m.CmsRevision, revision_id)
    if rev is None:
        raise NotFound("Révision introuvable")
    snap = dict(rev.snapshot)
    if rev.entity_type == "page":
        page = _get_page(db, rev.entity_id)
        sections = snap.get("sections", [])
        data = PageIn.model_validate(
            {
                "route_key": snap["route_key"],
                "path": snap["path"],
                "title": snap["title"],
                "template": snap.get("template", "default"),
                "summary": snap.get("summary"),
                "body": snap.get("body"),
                "sort_order": snap.get("sort_order", 0),
                "sections": [
                    {
                        "key": s["key"],
                        "title": s.get("title"),
                        "visible": s.get("visible", True),
                        "settings": s.get("settings") or {},
                        "blocks": [{"visible": b.get("visible", True), "data": b["data"]} for b in s.get("blocks", [])],
                    }
                    for s in sections
                ],
            }
        )
        page = service.save_page(db, principal, data, page)
        db.commit()
        return _page_out(db, page, full=True)
    definition = service.get_collection(rev.entity_type)
    obj = db.get(definition.model, rev.entity_id)
    if obj is None:
        raise NotFound("Élément introuvable")
    service._guard_published_edit(principal, obj)
    skip = {"id", "created_at", "updated_at", "status", "published_at", "archived_at", "revision", "created_by_id"}
    for column in definition.model.__table__.columns:
        if column.key in snap and column.key not in skip:
            value = snap[column.key]
            try:
                py = column.type.python_type
                if value is not None and py is uuid.UUID:
                    value = uuid.UUID(str(value))
            except NotImplementedError:
                pass
            setattr(obj, column.key, value)
    service.add_revision(db, rev.entity_type, obj, principal.id, note=f"Restauration de la révision {rev.number}")
    audit.record(
        db,
        family="business",
        module="cms",
        action="RESTORE",
        resource_type=rev.entity_type,
        resource_id=obj.id,
        diff={"revision": rev.number},
    )
    db.commit()
    return {"status": "restored", "id": obj.id}


# ---------------------------------------------------------------------------- collections
def _validate_item(db: Session, obj: Any, values: dict[str, Any]) -> None:
    if values.get("body_blocks") is not None:
        values["body_blocks"] = jsonable(
            [b.model_dump(mode="json") for b in _blocks_adapter.validate_python(values["body_blocks"])]
        )
        obj.body_blocks = values["body_blocks"]
    data = {**{c.key: getattr(obj, c.key, None) for c in obj.__table__.columns}, **values}
    media_svc.validate_media_refs(db, data)
    if values.get("answer"):
        from app.modules.cms.schemas import sanitize_html

        values["answer"] = sanitize_html(values["answer"])
        obj.answer = values["answer"]


# Identifiants techniques (adresse « slug », clé) : facultatifs à la saisie, déduits du titre et rendus uniques.
_AUTO_IDS = ("slug", "key")


def _unique_ident(db: Session, model: Any, attr: str, base: str, exclude_id: uuid.UUID | None = None) -> str:
    column = getattr(model, attr)
    length = model.__table__.columns[attr].type.length or 120
    candidate, n = base[:length], 1
    while True:
        stmt = select(model.id).where(column == candidate)
        if exclude_id is not None:
            stmt = stmt.where(model.id != exclude_id)
        if db.scalar(stmt.limit(1)) is None:
            return candidate
        n += 1
        suffix = f"_{n}" if base.isupper() else f"-{n}"
        candidate = base[: length - len(suffix)] + suffix


def _ident_from(model: Any, attr: str, text: str) -> str:
    length = model.__table__.columns[attr].type.length or 120
    value = slugify(text, max_length=length)
    # Clé d'univers : code en majuscules (HOME, BUSINESS…), comme les univers d'origine.
    return value.upper().replace("-", "_") if model is m.Universe and attr == "key" else value


def _fill_identifiers(db: Session, model: Any, obj: Any, title_attr: str, values: dict[str, Any]) -> None:
    """Création / modification : identifiant vide → déduit du titre ; saisi → normalisé ; doublon saisi → refusé."""
    cols = model.__table__.columns
    for attr in _AUTO_IDS:
        if attr not in cols:
            continue
        creating = obj.id is None
        raw = values.get(attr) if attr in values else (None if creating else getattr(obj, attr))
        if not creating and attr in values and not (raw or "").strip():
            values.pop(attr)  # effacé dans le formulaire : on garde l'adresse actuelle (liens existants)
            continue
        if not creating and attr not in values:
            continue
        typed = bool((raw or "").strip())
        base = _ident_from(
            model, attr, str(raw) if typed else str(getattr(obj, title_attr, None) or values.get(title_attr) or "")
        )
        if typed:
            clash = select(model.id).where(getattr(model, attr) == base)
            if obj.id is not None:
                clash = clash.where(model.id != obj.id)
            if db.scalar(clash.limit(1)) is not None:
                label = "Cette adresse (slug)" if attr == "slug" else "Cette clé"
                raise Conflict(f"{label} « {base} » est déjà utilisée par un autre élément.")
            value = base
        else:
            value = _unique_ident(db, model, attr, base, obj.id)
        values[attr] = value
        if creating:
            setattr(obj, attr, value)  # modification : appliqué ensuite (redirection automatique de l'ancienne adresse)


def _collection_hooks(key: str) -> dict[str, Any]:
    definition = service.COLLECTIONS[key]

    def before_create(db: Session, obj: Any, access: Access, values: dict[str, Any]) -> None:
        access.require("cms:write")
        obj.status = "draft"
        obj.created_by_id = access.p.id
        _fill_identifiers(db, definition.model, obj, definition.title_attr, values)
        _validate_item(db, obj, values)

    # Adresses publiques avant modification (élément publié et, pour un univers, ses offres publiées) : une adresse
    # qui change (slug, univers d'une offre) reçoit une redirection 301 après enregistrement.
    previous: dict[uuid.UUID, list[tuple[str, Any, Any]]] = {}

    def _published_paths(db: Session, obj: Any) -> list[tuple[str, Any, Any]]:
        found = []
        if obj.status == "published" and (path := service.public_path(db, key, obj)):
            found.append((path, key, obj))
        if key == "universes":
            offers = db.execute(
                select(m.Offer).where(m.Offer.universe_id == obj.id, m.Offer.status == "published")
            ).scalars()
            found += [(p, "offers", o) for o in offers if (p := service.public_path(db, "offers", o))]
        return found

    def before_update(db: Session, obj: Any, access: Access, values: dict[str, Any]) -> None:
        service._guard_published_edit(access.p, obj)
        _fill_identifiers(db, definition.model, obj, definition.title_attr, values)
        _validate_item(db, obj, values)
        obj.updated_by_id = access.p.id
        previous[obj.id] = _published_paths(db, obj)

    def after_change(db: Session, obj: Any, access: Access, action: str) -> None:
        for old_path, entity, item in previous.pop(obj.id, []):
            new_path = service.public_path(db, entity, item)
            if new_path and new_path != old_path:
                service._auto_redirect(db, old_path, new_path, access.p.id)
        if action != "delete":
            service.add_revision(db, key, obj, access.p.id)

    return {"before_create": before_create, "before_update": before_update, "after_change": after_change}


for _key, _def in service.COLLECTIONS.items():
    router.include_router(
        make_crud_router(
            _def.model,
            prefix=f"/{_key.replace('_', '-')}",
            tags=["CMS — collections"],
            module="cms",
            read_perm="cms:read",
            write_perm="cms:write",
            delete_perm="cms:publish",
            label=_def.label,
            filters=[
                "status",
                "universe",
                "universe_id",
                "category",
                "category_id",
                "featured",
                "family",
                "kind",
                "delivery_status",
                "author_id",
            ],
            search=list(_def.search),
            sort=["sort_order", "updated_at", "published_at", "created_at", _def.title_attr],
            default_sort=_def.sort_default if _def.sort_default in _def.model.__table__.columns else None,
            exclude_in={
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
            },
            optional_in={"slug", "key"},
            **_collection_hooks(_key),
        )
    )


def _taxonomy_hooks(model: Any) -> dict[str, Any]:
    def before_save(db: Session, obj: Any, access: Access, values: dict[str, Any]) -> None:
        _fill_identifiers(db, model, obj, "name", values)

    return {"before_create": before_save, "before_update": before_save}


for _key, _model in service.TAXONOMIES.items():
    router.include_router(
        make_crud_router(
            _model,
            prefix=f"/{_key.replace('_', '-')}",
            tags=["CMS — taxonomies"],
            module="cms",
            read_perm="cms:read",
            write_perm="cms:write",
            label=_key,
            search=["name"],
            sort=["name", "sort_order"],
            default_sort="name",
            optional_in={"slug"},
            **_taxonomy_hooks(_model),
        )
    )


@router.post("/collections/{key}/{item_id}/transition")
def transition_item(
    key: str,
    item_id: uuid.UUID,
    data: TransitionIn,
    principal: Principal = Depends(require("cms:read")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    definition = service.get_collection(key)
    obj = db.get(definition.model, item_id)
    if obj is None:
        raise NotFound("Élément introuvable")
    obj = service.transition(
        db, principal, key, obj, data.target, note=data.note, publish_at=data.publish_at, unpublish_at=data.unpublish_at
    )
    db.commit()
    return {
        "id": obj.id,
        "status": obj.status,
        "published_at": obj.published_at,
        "publish_at": obj.publish_at,
        "unpublish_at": obj.unpublish_at,
        "path": service.public_path(db, key, obj),
    }


@router.get("/collections/{key}/{item_id}/preview")
def preview_item(
    key: str, item_id: uuid.UUID, principal: Principal = Depends(require("cms:read")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Aperçu fidèle : page publique de l'élément (même rendu que le site, via un jeton signé de 30 min) et carte
    telle qu'elle apparaît dans les listes et blocs — y compris pour un brouillon."""
    from app.modules.cms import details

    definition = service.get_collection(key)
    obj = db.get(definition.model, item_id)
    if obj is None:
        raise NotFound("Élément introuvable")
    card = details.card_payload(db, key, obj)
    has_page = details.detail_payload(db, key, obj) is not None
    return jsonable(
        {
            "kind": key,
            "title": getattr(obj, definition.title_attr, None),
            "status": getattr(obj, "status", None),
            "path": service.public_path(db, key, obj) if has_page else None,
            "token": details.preview_token(key, obj.id) if has_page else None,
            "card": {"kind": card[0], "item": card[1]} if card else None,
            "data": service.collection_public_payload(db, key, obj),
        }
    )


# ---------------------------------------------------------------------------- SEO
@router.get("/seo/overview")
def seo_overview(
    principal: Principal = Depends(require("cms:read")), db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for page in db.execute(select(m.CmsPage).order_by(m.CmsPage.path)).scalars():
        seo = service.get_seo(db, "page", page.route_key)
        out.append(
            {
                "target_type": "page",
                "target_key": page.route_key,
                "path": page.path,
                "title": page.title,
                "status": page.status,
                "seo": _seo_dict(seo),
                "issues": service.seo_issues(seo, page.title),
            }
        )
    for key, definition in service.COLLECTIONS.items():
        if not definition.path_template:
            continue
        for row in db.execute(select(definition.model)).scalars():
            seo = service.get_seo(db, definition.seo_type or key, str(row.id))
            title = getattr(row, definition.title_attr, None)
            out.append(
                {
                    "target_type": definition.seo_type or key,
                    "target_key": str(row.id),
                    "path": service.public_path(db, key, row),
                    "title": title,
                    "status": row.status,
                    "seo": _seo_dict(seo),
                    "issues": service.seo_issues(seo, title),
                }
            )
    return jsonable(out)


def _seo_dict(seo: m.SeoMetadata | None) -> dict[str, Any] | None:
    return {c.key: getattr(seo, c.key) for c in seo.__table__.columns} if seo else None


@router.get("/seo/{target_type}/{target_key}")
def get_seo(
    target_type: str,
    target_key: str,
    principal: Principal = Depends(require("cms:read")),
    db: Session = Depends(get_db),
) -> dict[str, Any] | None:
    return jsonable(_seo_dict(service.get_seo(db, target_type, target_key)))


@router.put("/seo/{target_type}/{target_key}")
def put_seo(
    target_type: str,
    target_key: str,
    data: SeoIn,
    principal: Principal = Depends(require("seo:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any] | None:
    row = service.upsert_seo(db, target_type, target_key, data)
    audit.record(
        db,
        family="business",
        module="seo",
        action="UPDATE",
        resource_type="seo_metadata",
        resource_id=row.id if row else None,
        diff={"target": f"{target_type}:{target_key}"},
    )
    db.commit()
    return jsonable(_seo_dict(row))


router.include_router(
    make_crud_router(
        m.Redirect,
        prefix="/redirects",
        tags=["SEO"],
        module="seo",
        read_perm="cms:read",
        write_perm="seo:write",
        label="Redirection",
        search=["source_path", "target_path"],
        sort=["source_path", "hits", "created_at"],
        filters=["status_code", "is_active"],
        exclude_in={"hits", "last_hit_at", "auto_generated", "created_by_id"},
        before_create=lambda db, obj, access, values: _check_redirect(db, obj),
        before_update=lambda db, obj, access, values: _check_redirect(db, obj, values),
    )
)


# Adresses jamais traitées par les redirections du site (espaces connectés, API, fichiers) : règle sans effet.
_NOT_REDIRECTABLE = (
    "/api",
    "/_next",
    "/erp",
    "/espace-client",
    "/extranet",
    "/embarque",
    "/connexion",
    "/inscription",
    "/activation",
    "/brand",
    "/fonts",
    "/uploads",
)


def _clean_path(path: str) -> str:
    path = path.strip()
    return "/" + path.strip("/") if path not in ("", "/") else "/"


def _check_redirect(db: Session, obj: m.Redirect, values: dict[str, Any] | None = None) -> None:
    """Redirection : adresses normalisées, source unique et redirigeable, cible valide, jamais de boucle."""
    data = values if values is not None else {}
    source = _clean_path(data.get("source_path", obj.source_path) or "")
    target = data.get("target_path", obj.target_path)
    target = (target or "").strip() or None
    code = data.get("status_code", obj.status_code)
    if code not in (301, 302, 410):
        raise AppError("Code de redirection autorisé : 301, 302 ou 410")
    if not (data.get("source_path", obj.source_path) or "").strip().startswith("/"):
        raise AppError("Le chemin source doit commencer par /")
    if source == "/":
        raise AppError("La page d'accueil ne peut pas être redirigée.", code="INVALID_REDIRECT")
    if any(source == p or source.startswith(p + "/") for p in _NOT_REDIRECTABLE):
        raise AppError(
            f"« {source} » appartient aux espaces de la plateforme (ERP, espace client, API…) : non redirigeable.",
            code="INVALID_REDIRECT",
        )
    if code != 410 and not target:
        raise AppError("Cible requise pour une redirection 301/302")
    if target and not target.startswith(("/", "https://", "http://")):
        raise AppError("La cible commence par « / » (page du site) ou « https:// ».", code="INVALID_REDIRECT")
    if target and target.startswith("/"):
        target = _clean_path(target)
    if target and target == source:
        raise AppError("Redirection circulaire")
    clash = select(m.Redirect.id).where(m.Redirect.source_path == source)
    if obj.id is not None:
        clash = clash.where(m.Redirect.id != obj.id)
    if db.scalar(clash.limit(1)) is not None:
        raise Conflict(f"Une redirection existe déjà depuis « {source} » : modifiez-la.", code="REDIRECT_EXISTS")
    # Chaîne de redirections : la cible ne doit pas, de proche en proche, ramener à la source.
    current, seen = target, {source}
    for _ in range(20):
        if not current or not current.startswith("/"):
            break
        if current in seen:
            raise AppError(
                f"Boucle de redirection : « {current} » ramène déjà vers « {source} ».", code="REDIRECT_LOOP"
            )
        seen.add(current)
        stmt = select(m.Redirect.target_path).where(
            m.Redirect.source_path == current, m.Redirect.is_active.is_(True), m.Redirect.status_code != 410
        )
        if obj.id is not None:
            stmt = stmt.where(m.Redirect.id != obj.id)
        current = db.scalar(stmt.limit(1))
    if values is None:
        obj.source_path, obj.target_path = source, target
    else:
        if "source_path" in values:
            values["source_path"] = source
        if "target_path" in values:
            values["target_path"] = target


@router.post("/redirects/import")
async def import_redirects(
    file: UploadFile = File(...), principal: Principal = Depends(require("seo:write")), db: Session = Depends(get_db)
) -> dict[str, int]:
    """Import CSV : source;cible;code (301/302/410)."""
    content = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(content), delimiter=";" if ";" in content.splitlines()[0] else ",")
    created = updated = 0
    for row in reader:
        if not row or row[0].strip().lower() in ("source", "source_path"):
            continue
        source = row[0].strip()
        target = row[1].strip() if len(row) > 1 and row[1].strip() else None
        code = int(row[2]) if len(row) > 2 and row[2].strip().isdigit() else 301
        redirect = db.execute(select(m.Redirect).where(m.Redirect.source_path == source)).scalar_one_or_none()
        obj = redirect or m.Redirect(source_path=source, created_by_id=principal.id)
        obj.target_path, obj.status_code, obj.is_active = target, code, True
        _check_redirect(db, obj)
        if redirect is None:
            db.add(obj)
            created += 1
        else:
            updated += 1
    audit.record(
        db,
        family="business",
        module="seo",
        action="IMPORT",
        resource_type="redirects",
        diff={"created": created, "updated": updated},
    )
    db.commit()
    return {"created": created, "updated": updated}


SCHEMA_TYPES = {
    "Organization",
    "LocalBusiness",
    "WebSite",
    "WebPage",
    "Service",
    "Article",
    "FAQPage",
    "BreadcrumbList",
}
_SCHEMA_PROP = re.compile(r"^[A-Za-z][A-Za-z0-9]{0,59}$")


def _check_schema_markup(db: Session, obj: Any, access: Access, values: dict[str, Any]) -> None:
    """Données structurées : rattachées à une page du site (seule cible affichée), propriétés schema.org simples."""
    merged = {**{k: getattr(obj, k, None) for k in ("target_type", "target_key", "schema_type", "data")}, **values}
    if merged.get("schema_type") not in SCHEMA_TYPES:
        raise AppError("Type de données structurées inconnu", code="INVALID_SCHEMA_MARKUP")
    if merged.get("target_type") != "page":
        raise AppError("Les données structurées se rattachent à une page du site", code="INVALID_SCHEMA_MARKUP")
    page = db.execute(select(m.CmsPage.id).where(m.CmsPage.route_key == merged.get("target_key"))).first()
    if page is None:
        raise AppError("Page introuvable : choisissez-la dans la liste", code="INVALID_SCHEMA_MARKUP")
    data = merged.get("data") or {}
    if not isinstance(data, dict):
        raise AppError("Propriétés invalides", code="INVALID_SCHEMA_MARKUP")
    for key, value in data.items():
        if not _SCHEMA_PROP.match(str(key)):
            raise AppError(f"Propriété schema.org invalide : {key}", code="INVALID_SCHEMA_MARKUP")
        if isinstance(value, str) and len(value) > 2000:
            raise AppError(f"Valeur trop longue pour {key}", code="INVALID_SCHEMA_MARKUP")


router.include_router(
    make_crud_router(
        m.SchemaMarkup,
        prefix="/schema-markups",
        tags=["SEO"],
        module="seo",
        read_perm="cms:read",
        write_perm="seo:write",
        label="Données structurées",
        filters=["target_type", "target_key", "schema_type"],
        before_create=_check_schema_markup,
        before_update=_check_schema_markup,
    )
)
router.include_router(
    make_crud_router(
        m.SocialLink,
        prefix="/social-links",
        tags=["CMS"],
        module="cms",
        read_perm="cms:read",
        write_perm="cms:write",
        label="Réseau social",
        sort=["sort_order", "network"],
        default_sort="sort_order",
    )
)
router.include_router(
    make_crud_router(
        m.FormDefinition,
        prefix="/forms",
        tags=["CMS"],
        module="cms",
        read_perm="cms:read",
        write_perm="cms:write",
        label="Formulaire",
        search=["key", "title"],
    )
)
router.include_router(
    make_crud_router(
        m.AutoReplyTemplate,
        prefix="/auto-replies",
        tags=["CMS"],
        module="cms",
        read_perm="cms:read",
        write_perm="cms:write",
        label="Réponse automatique",
        filters=["channel", "code"],
    )
)


@router.get("/forms/{key}/submissions")
def form_submissions(
    key: str,
    params: PageParams = Depends(),
    principal: Principal = Depends(require("crm:read")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(m.FormSubmission).where(m.FormSubmission.form_key == key)
    return paginate(
        db,
        stmt,
        params,
        sort_fields={"created_at": m.FormSubmission.created_at},
        default_sort=m.FormSubmission.created_at.desc(),
        transform=lambda s: {
            "id": s.id,
            "data": s.data,
            "status": s.status,
            "lead_id": s.lead_id,
            "utm": s.utm,
            "created_at": s.created_at,
        },
    )


# ---------------------------------------------------------------------------- navigation
@router.get("/navigation")
def get_navigation(
    principal: Principal = Depends(require("cms:read")), db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    menus = db.execute(select(m.NavigationMenu).order_by(m.NavigationMenu.key)).scalars().all()

    def tree(menu: m.NavigationMenu, parent: uuid.UUID | None = None) -> list[dict[str, Any]]:
        return [
            {
                "id": i.id,
                "label": i.label,
                "link_type": i.link_type,
                "page_route_key": i.page_route_key,
                "url": i.url,
                "description": i.description,
                "icon": i.icon,
                "open_new_tab": i.open_new_tab,
                "highlight": i.highlight,
                "visible": i.visible,
                "children": tree(menu, i.id),
            }
            for i in sorted(menu.items, key=lambda x: x.sort_order)
            if i.parent_id == parent
        ]

    return [{"key": mn.key, "title": mn.title, "items": tree(mn)} for mn in menus]


@router.put("/navigation/{key}")
def put_navigation(
    key: str, data: NavigationIn, principal: Principal = Depends(require("cms:write")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    if not key.replace("_", "").isalnum() or len(key) > 40:
        raise AppError("Clé de menu invalide")
    menu = db.execute(select(m.NavigationMenu).where(m.NavigationMenu.key == key)).scalar_one_or_none()
    if menu is None:
        menu = m.NavigationMenu(key=key, title=data.title)
        db.add(menu)
        db.flush()
    menu.title = data.title
    # Suppression en bloc : les sous-éléments partent par la cascade de la base (évite les suppressions en double).
    db.execute(delete(m.NavigationItem).where(m.NavigationItem.menu_id == menu.id))
    db.expire(menu, ["items"])

    def add(items: list[Any], parent: uuid.UUID | None) -> None:
        for index, item in enumerate(items):
            row = m.NavigationItem(
                id=uuid.uuid4(),
                menu_id=menu.id,
                parent_id=parent,
                label=item.label,
                link_type=item.link_type,
                page_route_key=item.page_route_key,
                url=item.url,
                description=item.description,
                icon=item.icon,
                sort_order=index,
                open_new_tab=item.open_new_tab,
                highlight=item.highlight,
                visible=item.visible,
            )
            menu.items.append(row)
            db.flush()
            add(item.children, row.id)

    add(data.items, None)
    audit.record(
        db,
        family="business",
        module="cms",
        action="UPDATE",
        resource_type="navigation",
        resource_id=menu.id,
        diff={"key": key, "items": len(data.items)},
    )
    db.commit()
    return {"key": menu.key, "title": menu.title, "count": len(menu.items)}


# ---------------------------------------------------------------------------- paramètres du site
_SITE_FIELDS = {c.key for c in m.SiteSettings.__table__.columns} - {"id", "created_at", "updated_at"}
_TRACKING_KEYS = {"ga4_id", "gads_id", "gads_labels", "meta_pixel", "tiktok_pixel", "linkedin_partner"}
_TRACKING_ID = re.compile(r"^[A-Za-z0-9_-]{3,40}$")


def _check_tracking(value: Any) -> None:
    """Identifiants de balises tierces : format strict (injectés dans des scripts après consentement)."""
    if value in (None, {}):
        return
    if not isinstance(value, dict) or set(value) - _TRACKING_KEYS:
        raise AppError("Suivi : clés autorisées " + ", ".join(sorted(_TRACKING_KEYS)), code="INVALID_TRACKING")
    for key, item in value.items():
        values = item.values() if key == "gads_labels" and isinstance(item, dict) else [item]
        if key == "gads_labels" and not isinstance(item, dict | type(None)):
            raise AppError("Suivi : gads_labels doit être un objet", code="INVALID_TRACKING")
        for v in values:
            if v not in (None, "") and not _TRACKING_ID.fullmatch(str(v)):
                raise AppError(f"Identifiant de suivi invalide ({key})", code="INVALID_TRACKING")


_CONSENT_KEYS = {"title", "banner", "necessary", "analytics", "marketing"}
_ROBOTS_LINE = re.compile(r"^Disallow:\s*/[^\s#]*$", re.I)


def _check_consent_texts(value: Any) -> dict[str, str]:
    """Textes du bandeau cookies : champs connus, texte simple ; les champs vides reprennent le texte par défaut."""
    if value in (None, ""):
        return {}
    if not isinstance(value, dict) or set(value) - _CONSENT_KEYS:
        raise AppError("Bandeau cookies : textes autorisés " + ", ".join(sorted(_CONSENT_KEYS)), code="INVALID_CONSENT")
    out = {}
    for key, text in value.items():
        if text in (None, ""):
            continue
        if not isinstance(text, str) or len(text) > 600:
            raise AppError("Bandeau cookies : texte trop long (600 caractères au plus)", code="INVALID_CONSENT")
        out[key] = text.strip()
    return out


def _check_robots(value: Any) -> str | None:
    """Pages exclues des moteurs de recherche : une ligne « Disallow: /chemin » par page."""
    lines = [line.strip() for line in str(value or "").splitlines() if line.strip()]
    bad = [line for line in lines if not _ROBOTS_LINE.match(line)]
    if bad:
        raise AppError("Adresse de page invalide (doit commencer par /) : " + ", ".join(bad[:3]), code="INVALID_ROBOTS")
    return "\n".join(lines) or None


@router.get("/site-settings")
def get_site_settings(
    principal: Principal = Depends(require("cms:read")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    site = db.execute(select(m.SiteSettings).limit(1)).scalar_one_or_none()
    return jsonable({k: getattr(site, k) for k in _SITE_FIELDS}) if site else {}


@router.put("/site-settings")
def put_site_settings(
    data: dict[str, Any], principal: Principal = Depends(require("cms:publish")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    unknown = set(data) - _SITE_FIELDS
    if unknown:
        raise AppError(f"Champs inconnus : {', '.join(sorted(unknown))}")
    if "tracking" in data:
        _check_tracking(data["tracking"])
    if "consent_texts" in data:
        data["consent_texts"] = _check_consent_texts(data["consent_texts"])
    if "robots_extra" in data:
        data["robots_extra"] = _check_robots(data["robots_extra"])
    media_svc.validate_media_refs(db, data)
    if data.get("favicon_media_id"):
        from app.modules.cms.brand import ensure_icon_media

        ensure_icon_media(db, uuid.UUID(str(data["favicon_media_id"])))
    site = db.execute(select(m.SiteSettings).limit(1)).scalar_one_or_none()
    if site is None:
        site = m.SiteSettings()
        db.add(site)
    before = audit.snapshot(site)
    for key, value in data.items():
        column = m.SiteSettings.__table__.columns[key]
        if value is not None and column.type.python_type is uuid.UUID:
            value = uuid.UUID(str(value))
        setattr(site, key, value)
    db.flush()
    audit.record(
        db,
        family="business",
        module="cms",
        action="UPDATE",
        resource_type="site_settings",
        resource_id=site.id,
        diff=audit.diff_dicts(before, audit.snapshot(site)),
    )
    db.commit()
    return jsonable({k: getattr(site, k) for k in _SITE_FIELDS})


@router.get("/brand/icon-pack")
def brand_icon_pack(principal: Principal = Depends(require("cms:read")), db: Session = Depends(get_db)) -> Response:
    """Pack d'icônes (toutes tailles, favicon.ico, iOS, maskable, brand.json) pour les applications mobile et bureau."""
    from app.modules.cms.brand import icon_pack

    return Response(
        icon_pack(db),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="icones-plateforme.zip"', "Cache-Control": "no-store"},
    )


class HtmlPreviewIn(BaseModel):
    html: str = Field(max_length=200_000)


@router.post("/html/preview")
def html_preview(data: HtmlPreviewIn, principal: Principal = Depends(require("cms:write"))) -> dict[str, Any]:
    """HTML tel qu'il sera enregistré et affiché (assaini) + ce qui a été retiré, avant insertion."""
    from app.modules.cms.schemas import html_warnings, sanitize_html

    try:
        clean = sanitize_html(data.html)
    except ValueError as exc:
        raise AppError(str(exc), code="INVALID_HTML") from exc
    return {"html": clean, "warnings": html_warnings(data.html)}


# ---------------------------------------------------------------------------- médiathèque
def _media_out(asset: m.MediaAsset) -> dict[str, Any]:
    return jsonable(
        {
            "id": asset.id,
            "kind": asset.kind,
            "title": asset.title,
            "alt_text": asset.alt_text,
            "caption": asset.caption,
            "credits": asset.credits,
            "original_name": asset.original_name,
            "mime_type": asset.mime_type,
            "size_bytes": asset.size_bytes,
            "checksum_sha256": asset.checksum_sha256,
            "width": asset.width,
            "height": asset.height,
            "folder": asset.folder,
            "tags": asset.tags,
            "status": asset.status,
            "usage_count": asset.usage_count,
            "external_provider": asset.external_provider,
            "external_id": asset.external_id,
            "external_url": asset.external_url,
            "author_id": asset.author_id,
            "created_at": asset.created_at,
            "updated_at": asset.updated_at,
            "focal_x": asset.focal_x,
            "focal_y": asset.focal_y,
            "poster_media_id": asset.poster_media_id,
            "preview": media_svc.media_payload(asset) if asset.status == "active" else None,
        }
    )


@router.get("/media")
def list_media(
    params: PageParams = Depends(),
    kind: str | None = None,
    folder: str | None = None,
    status: str = Query("active"),
    orphan: bool | None = None,
    principal: Principal = Depends(require("cms:read")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    # Compteurs d'utilisation tenus à jour (un média ajouté à une page ne doit pas rester marqué « libre »).
    last_scan = db.scalar(select(func.max(m.MediaAsset.last_usage_scan_at)))
    if last_scan is None or utcnow() - last_scan > timedelta(minutes=2):
        media_svc.scan_usage(db)
        db.commit()
    stmt = select(m.MediaAsset).where(m.MediaAsset.deleted_at.is_(None), m.MediaAsset.status == status)
    if kind:
        stmt = stmt.where(m.MediaAsset.kind == kind)
    if folder:
        stmt = stmt.where(m.MediaAsset.folder == folder)
    if orphan is not None:
        stmt = stmt.where((m.MediaAsset.usage_count == 0) if orphan else (m.MediaAsset.usage_count > 0))
    return paginate(
        db,
        stmt,
        params,
        sort_fields={
            "created_at": m.MediaAsset.created_at,
            "title": m.MediaAsset.title,
            "size": m.MediaAsset.size_bytes,
        },
        default_sort=m.MediaAsset.created_at.desc(),
        search_columns=[m.MediaAsset.title, m.MediaAsset.original_name, m.MediaAsset.alt_text],
        transform=_media_out,
    )


@router.get("/media/folders")
def media_folders(
    principal: Principal = Depends(require("cms:read")), db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    rows = db.execute(
        select(m.MediaAsset.folder, func.count())
        .where(m.MediaAsset.deleted_at.is_(None))
        .group_by(m.MediaAsset.folder)
        .order_by(m.MediaAsset.folder)
    ).all()
    return [{"folder": f, "count": c} for f, c in rows]


@router.post("/media", status_code=201)
async def upload_media(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    alt_text: str | None = Form(None),
    folder: str = Form("general"),
    tags: str = Form(""),
    principal: Principal = Depends(require("media:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    data = await file.read()
    asset = media_svc.upload_media(
        db,
        filename=file.filename or "media",
        data=data,
        title=title,
        alt_text=alt_text,
        folder=folder,
        tags=[t.strip() for t in tags.split(",") if t.strip()],
        author_id=principal.id,
    )
    db.commit()
    return _media_out(asset)


@router.post("/media/external", status_code=201)
def add_external_video(
    data: ExternalVideoIn, principal: Principal = Depends(require("media:write")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    if data.poster_media_id:
        media_svc.validate_media_refs(db, {"poster_media_id": data.poster_media_id})
    asset = media_svc.register_external_video(
        db,
        url=data.url,
        title=data.title,
        alt_text=data.alt_text,
        caption=data.caption,
        folder=data.folder,
        tags=data.tags,
        poster_media_id=data.poster_media_id,
        author_id=principal.id,
    )
    db.commit()
    return _media_out(asset)


@router.get("/media/{media_id}")
def get_media(
    media_id: uuid.UUID, principal: Principal = Depends(require("cms:read")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    asset = media_svc.get_media(db, media_id)
    revisions = (
        db.execute(
            select(m.MediaRevision)
            .where(m.MediaRevision.media_id == media_id)
            .order_by(m.MediaRevision.created_at.desc())
        )
        .scalars()
        .all()
    )
    # Pages désignées par leur titre (l'index des usages les repère par clé technique).
    titles = dict(db.execute(select(m.CmsPage.route_key, m.CmsPage.title)).tuples().all())
    usages = [
        {**u, "ref": titles.get(u["ref"], u["ref"])} if u["type"] == "page" else u
        for u in media_svc.media_usage(db).get(media_id, [])
    ]
    return {
        **_media_out(asset),
        "usages": usages,
        "revisions": jsonable(
            [
                {"action": r.action, "changes": r.changes, "user_id": r.user_id, "created_at": r.created_at}
                for r in revisions
            ]
        ),
    }


@router.patch("/media/{media_id}")
def update_media(
    media_id: uuid.UUID,
    data: MediaUpdate,
    principal: Principal = Depends(require("media:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    asset = media_svc.get_media(db, media_id)
    values = data.model_dump(exclude_unset=True)
    if values.get("poster_media_id"):
        media_svc.validate_media_refs(db, {"poster_media_id": values["poster_media_id"]})
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
    )
    db.commit()
    return _media_out(asset)


@router.post("/media/{media_id}/replace")
async def replace_media(
    media_id: uuid.UUID,
    file: UploadFile = File(...),
    principal: Principal = Depends(require("media:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    asset = media_svc.get_media(db, media_id)
    media_svc.replace_media(db, asset, filename=file.filename or "media", data=await file.read(), user_id=principal.id)
    db.commit()
    return _media_out(asset)


@router.post("/media/{media_id}/archive")
def archive_media(
    media_id: uuid.UUID,
    force: bool = False,
    principal: Principal = Depends(require("media:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    asset = media_svc.get_media(db, media_id)
    media_svc.archive_media(db, asset, user_id=principal.id, force=force and principal.has("cms:publish"))
    db.commit()
    return _media_out(asset)


@router.post("/media/{media_id}/restore")
def restore_media(
    media_id: uuid.UUID, principal: Principal = Depends(require("media:write")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    asset = media_svc.get_media(db, media_id)
    asset.status = "active"
    db.add(m.MediaRevision(media_id=asset.id, action="restore", user_id=principal.id))
    audit.record(db, family="business", module="media", action="RESTORE", resource_type="media", resource_id=asset.id)
    db.commit()
    return _media_out(asset)


@router.post("/media-scan")
def scan_media(principal: Principal = Depends(require("media:write")), db: Session = Depends(get_db)) -> dict[str, Any]:
    result = media_svc.scan_usage(db)
    db.commit()
    return result


# ---------------------------------------------------------------------------- modération du blog
@router.get("/blog-comments")
def list_comments(
    params: PageParams = Depends(),
    status: str | None = "pending",
    principal: Principal = Depends(require("cms:read")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(m.BlogComment, m.BlogPost.title).join(m.BlogPost, m.BlogPost.id == m.BlogComment.post_id)
    if status:
        stmt = stmt.where(m.BlogComment.status == status)
    return paginate(
        db,
        stmt,
        params,
        scalars=False,
        default_sort=m.BlogComment.created_at.desc(),
        search_columns=[m.BlogComment.content, m.BlogComment.author_name],
        transform=lambda row: jsonable(
            {
                "id": row[0].id,
                "post_id": row[0].post_id,
                "post_title": row[1],
                "parent_id": row[0].parent_id,
                "author_name": row[0].author_name,
                "content": row[0].content,
                "status": row[0].status,
                "is_staff": row[0].is_staff,
                "created_at": row[0].created_at,
            }
        ),
    )


@router.post("/blog-comments/{comment_id}/moderate")
def moderate_comment(
    comment_id: uuid.UUID,
    data: dict[str, str],
    principal: Principal = Depends(require("cms:review")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    comment = db.get(m.BlogComment, comment_id)
    if comment is None:
        raise NotFound("Commentaire introuvable")
    status = data.get("status")
    if status not in ("approved", "rejected", "spam", "pending"):
        raise AppError("Statut de modération invalide")
    previous = comment.status
    comment.status = status
    comment.moderated_by_id = principal.id
    comment.moderated_at = utcnow()
    _recount_comments(db, comment.post_id)
    audit.record(
        db,
        family="business",
        module="cms",
        action="MODERATE",
        resource_type="blog_comment",
        resource_id=comment.id,
        diff={"status": [previous, status]},
    )
    db.commit()
    return {"id": comment.id, "status": comment.status}


@router.post("/blog-comments/{comment_id}/reply", status_code=201)
def reply_comment(
    comment_id: uuid.UUID,
    data: CommentIn,
    principal: Principal = Depends(require("cms:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    parent = db.get(m.BlogComment, comment_id)
    if parent is None:
        raise NotFound("Commentaire introuvable")
    # Le site n'affiche que les fils publiés : répondre à un commentaire en attente le publie (droit de relecture).
    if parent.status in ("rejected", "spam"):
        raise AppError("Ce commentaire est refusé : publiez-le avant d'y répondre.", code="COMMENT_NOT_PUBLISHED")
    if parent.status == "pending":
        if not principal.has("cms:review"):
            raise AppError(
                "Ce commentaire attend la modération : un relecteur doit le publier avant la réponse.",
                code="COMMENT_NOT_PUBLISHED",
            )
        parent.status = "approved"
        parent.moderated_by_id = principal.id
        parent.moderated_at = utcnow()
    reply = m.BlogComment(
        post_id=parent.post_id,
        parent_id=parent.id,
        author_name=principal.user.full_name,
        content=data.content,
        status="approved",
        is_staff=True,
        staff_user_id=principal.id,
        moderated_by_id=principal.id,
        moderated_at=utcnow(),
    )
    db.add(reply)
    db.flush()
    _recount_comments(db, parent.post_id)
    audit.record(
        db, family="business", module="cms", action="REPLY", resource_type="blog_comment", resource_id=reply.id
    )
    db.commit()
    return {"id": reply.id, "status": reply.status}


def _recount_comments(db: Session, post_id: uuid.UUID) -> None:
    post = db.get(m.BlogPost, post_id)
    if post:
        post.comment_count = db.execute(
            select(func.count())
            .select_from(m.BlogComment)
            .where(m.BlogComment.post_id == post_id, m.BlogComment.status == "approved")
        ).scalar_one()
