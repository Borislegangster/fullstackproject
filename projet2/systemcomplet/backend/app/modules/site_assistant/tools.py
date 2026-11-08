"""Outils de l'assistant du site : ce que Claude peut lire et faire dans le CMS, la médiathèque, le SEO et
l'analytics. Chaque outil est décrit par un modèle Pydantic (schéma envoyé à Claude ET validation de ce qu'il
renvoie avant toute exécution).

Règle de prudence : Claude ne change jamais seul ce que voient les visiteurs.
  • appliqué d'office : création de brouillons, modification d'un brouillon (rien n'est public) ;
  • proposé à la validation : contenu publié, SEO d'un contenu publié, textes alternatifs, redirections,
    publication — essayé à blanc (erreurs renvoyées à Claude), puis appliqué par une personne, avec ses droits.
"""

from __future__ import annotations

import base64
import json
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import Text, cast, func, or_, select
from sqlalchemy.orm import Session

from app.core.crud import serialize
from app.core.deps import Principal
from app.core.errors import AppError
from app.core.utils import jsonable, utcnow
from app.modules.cms import media as media_svc
from app.modules.cms import models as m
from app.modules.cms import service
from app.modules.cms.schemas import PageIn
from app.modules.site_assistant import cms_ops
from app.modules.site_assistant.models import SiteAssistantAction, SiteAssistantMessage, SiteAssistantSession, stamp

COLLECTION_KEYS = tuple(service.COLLECTIONS)
KINDS = ("page", *COLLECTION_KEYS)
Kind = Literal[KINDS]  # type: ignore[valid-type]
CollectionKind = Literal[COLLECTION_KEYS]  # type: ignore[valid-type]
STATUSES = ("draft", "in_review", "validated", "published", "archived")


class ToolError(Exception):
    """Erreur renvoyée à Claude (tool_result en erreur) pour qu'il corrige sa demande."""


@dataclass
class ToolContext:
    db: Session
    principal: Principal
    session: SiteAssistantSession
    actions: list[SiteAssistantAction] = field(default_factory=list)


class Args(BaseModel):
    model_config = ConfigDict(extra="forbid")


@dataclass
class Tool:
    name: str
    description: str
    args: type[Args]
    handler: Callable[[ToolContext, Any], Any]
    step: str  # libellé de l'étape affichée pendant le travail
    perms: tuple[str, ...] = ()
    write: bool = False

    def definition(self) -> dict[str, Any]:
        schema = self.args.model_json_schema()
        schema.pop("title", None)
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": schema,
            "eager_input_streaming": True,
        }


# ============================================================================ aides
def _short(value: Any, limit: int = 300) -> Any:
    if isinstance(value, str) and len(value) > limit:
        return value[:limit] + "…"
    return value


def _edit_url(kind: str, obj: Any) -> str:
    if kind == "page":
        return f"/erp/cms/pages/{obj.id}"
    return f"/erp/cms?onglet=collections&collection={kind}&element={obj.id}"


def _seo_target(kind: str, obj: Any) -> tuple[str, str]:
    if kind == "page":
        return "page", obj.route_key
    definition = service.get_collection(kind)
    return definition.seo_type or kind, str(obj.id)


def _record(
    ctx: ToolContext,
    *,
    tool: str,
    status: str,
    summary: str,
    payload: dict[str, Any],
    kind: str | None = None,
    obj: Any = None,
    result: dict[str, Any] | None = None,
    label: str | None = None,
) -> SiteAssistantAction:
    action = SiteAssistantAction(
        created_at=stamp(),
        session_id=ctx.session.id,
        tool=tool,
        summary=summary[:400],
        payload=jsonable(payload),
        target_type=kind,
        target_id=str(obj.id) if obj is not None else None,
        target_label=(label or (cms_ops.title_of(kind, obj) if kind and obj is not None else None) or "")[:300] or None,
        status=status,
        result=jsonable(result or {}),
        decided_by_id=ctx.principal.id if status == "applied" else None,
        decided_at=utcnow() if status == "applied" else None,
    )
    ctx.db.add(action)
    ctx.db.flush()
    ctx.actions.append(action)
    return action


def _dry_run(ctx: ToolContext, operation: Callable[[], Any]) -> None:
    """Essai à blanc d'une proposition (mêmes contrôles que l'application réelle), puis annulation."""
    savepoint = ctx.db.begin_nested()
    try:
        operation()
        ctx.db.flush()
    except ValidationError as exc:
        raise ToolError(_validation_message(exc)) from exc
    except AppError as exc:
        raise ToolError(exc.message) from exc
    finally:
        savepoint.rollback()


def _apply(ctx: ToolContext, operation: Callable[[], Any]) -> Any:
    savepoint = ctx.db.begin_nested()
    try:
        result = operation()
        ctx.db.flush()
    except ValidationError as exc:
        savepoint.rollback()
        raise ToolError(_validation_message(exc)) from exc
    except AppError as exc:
        savepoint.rollback()
        raise ToolError(exc.message) from exc
    savepoint.commit()
    return result


def _validation_message(exc: ValidationError) -> str:
    parts = []
    for err in exc.errors()[:15]:
        where = ".".join(str(x) for x in err.get("loc", ()))
        parts.append(f"{where} : {err.get('msg')}")
    return "Données invalides — " + " ; ".join(parts)


def _proposed(action: SiteAssistantAction) -> dict[str, Any]:
    return {
        "status": "proposed",
        "action_id": str(action.id),
        "message": "Proposition enregistrée : elle sera appliquée quand la personne la validera.",
    }


# ============================================================================ lecture
class OverviewArgs(Args):
    pass


def site_overview(ctx: ToolContext, _args: OverviewArgs) -> dict[str, Any]:
    db = ctx.db
    pages = dict(db.execute(select(m.CmsPage.status, func.count()).group_by(m.CmsPage.status)).all())
    collections = {}
    for key, definition in service.COLLECTIONS.items():
        counts = dict(db.execute(select(definition.model.status, func.count()).group_by(definition.model.status)).all())
        collections[key] = {
            "label": definition.label,
            "par_statut": counts,
            "a_une_page_publique": bool(definition.path_template),
        }
    images = (
        select(func.count())
        .select_from(m.MediaAsset)
        .where(m.MediaAsset.deleted_at.is_(None), m.MediaAsset.status == "active", m.MediaAsset.kind == "image")
    )
    no_alt = images.where(or_(m.MediaAsset.alt_text.is_(None), m.MediaAsset.alt_text == ""))
    out: dict[str, Any] = {
        "pages": pages,
        "collections": collections,
        "mediatheque": {
            "images": db.scalar(images) or 0,
            "images_sans_texte_alternatif": db.scalar(no_alt) or 0,
            "total": db.scalar(select(func.count()).select_from(m.MediaAsset).where(m.MediaAsset.deleted_at.is_(None)))
            or 0,
        },
        "redirections_actives": db.scalar(
            select(func.count()).select_from(m.Redirect).where(m.Redirect.is_active.is_(True))
        )
        or 0,
    }
    if ctx.principal.has("analytics:read"):
        from app.modules.analytics import service as analytics

        end = utcnow().date()
        report = analytics.overview(db, end - timedelta(days=29), end, compare=True)
        out["analytics_30_jours"] = {"totaux": report.get("totals"), "periode_precedente": report.get("previous")}
    return jsonable(out)


class ListArgs(Args):
    kind: Kind = Field(description="« page » ou une collection (blog_posts, offers, projects, faq_items…)")
    search: str | None = Field(default=None, max_length=120, description="Texte cherché dans le titre")
    status: Literal[STATUSES] | None = None  # type: ignore[valid-type]
    limit: int = Field(default=30, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


def list_content(ctx: ToolContext, args: ListArgs) -> dict[str, Any]:
    db = ctx.db
    if args.kind == "page":
        model, title_attr, search_cols = m.CmsPage, "title", ("title", "path")
    else:
        definition = service.get_collection(args.kind)
        model, title_attr, search_cols = definition.model, definition.title_attr, definition.search
    stmt = select(model)
    if args.status:
        stmt = stmt.where(model.status == args.status)
    if args.search:
        like = f"%{args.search}%"
        stmt = stmt.where(or_(*[getattr(model, c).ilike(like) for c in search_cols if hasattr(model, c)]))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    order = model.updated_at.desc() if hasattr(model, "updated_at") else model.id
    rows = db.execute(stmt.order_by(order).offset(args.offset).limit(args.limit)).scalars().all()
    items = [
        {
            "id": str(r.id),
            "title": getattr(r, title_attr, None),
            "status": r.status,
            "path": service.public_path(db, args.kind, r),
            "updated_at": r.updated_at,
        }
        for r in rows
    ]
    return jsonable({"total": total, "items": items})


class GetArgs(Args):
    kind: Kind
    id: str = Field(description="Identifiant de l'élément (champ id des listes)")


def get_content(ctx: ToolContext, args: GetArgs) -> dict[str, Any]:
    from app.modules.cms.router_admin import _page_out

    try:
        obj = cms_ops.load(ctx.db, args.kind, args.id)
    except AppError as exc:
        raise ToolError(exc.message) from exc
    if args.kind == "page":
        return _page_out(ctx.db, obj, full=True)
    data = jsonable(serialize(obj))
    target_type, target_key = _seo_target(args.kind, obj)
    seo = service.get_seo(ctx.db, target_type, target_key)
    data["path"] = service.public_path(ctx.db, args.kind, obj)
    data["seo"] = jsonable({c.key: getattr(seo, c.key) for c in seo.__table__.columns}) if seo else None
    data["seo_target"] = {"target_type": target_type, "target_key": target_key}
    return data


class FieldsArgs(Args):
    kind: Kind


def describe_fields(ctx: ToolContext, args: FieldsArgs) -> dict[str, Any]:
    if args.kind == "page":
        return {
            "schema": PageIn.model_json_schema(),
            "notes": [
                "Une page = des sections, chacune avec des blocs (champ data.kind : hero, rich_text, features, cta…).",
                "Les champs *_media_id attendent l'identifiant d'un média de la médiathèque (search_media).",
                "rich_text.html : HTML simple (p, h2, h3, ul, ol, li, strong, em, a, blockquote).",
                "Pour modifier une page existante, envoyez la page complète (lue avec get_content), modifiée.",
            ],
        }
    definition = service.get_collection(args.kind)
    model = definition.model
    related: dict[str, list[dict[str, str]]] = {}
    for column in model.__table__.columns:
        for fk in column.foreign_keys:
            table = fk.column.table
            if not table.name.startswith("cms_"):
                continue
            label_col = next((c for c in ("name", "title", "label", "key") if c in table.c), None)
            if label_col is None:
                continue
            rows = ctx.db.execute(select(table.c.id, table.c[label_col]).limit(60)).all()
            related[column.key] = [{"id": str(i), "label": str(n)} for i, n in rows]
    return {
        "schema": cms_ops.create_schema(args.kind).model_json_schema(),
        "title_field": definition.title_attr,
        "public_path": definition.path_template,
        "choices_for_reference_fields": related,
        "notes": [
            "slug / key : facultatifs, déduits du titre.",
            "Champs *_media_id : identifiant d'un média (search_media) ; body_blocks : mêmes blocs que les pages.",
            "Un nouvel élément est créé en brouillon ; sa publication passe par request_publication.",
        ],
    }


class MediaSearchArgs(Args):
    query: str | None = Field(default=None, max_length=120, description="Titre, texte alternatif, étiquette")
    kind: Literal["image", "video", "document", "external_video", "svg"] | None = None
    folder: str | None = Field(default=None, max_length=120)
    missing_alt: bool = Field(default=False, description="Seulement les images sans texte alternatif")
    limit: int = Field(default=40, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


def search_media(ctx: ToolContext, args: MediaSearchArgs) -> dict[str, Any]:
    stmt = select(m.MediaAsset).where(m.MediaAsset.deleted_at.is_(None), m.MediaAsset.status == "active")
    if args.kind:
        stmt = stmt.where(m.MediaAsset.kind == args.kind)
    if args.folder:
        stmt = stmt.where(m.MediaAsset.folder == args.folder)
    if args.missing_alt:
        stmt = stmt.where(
            m.MediaAsset.kind == "image", or_(m.MediaAsset.alt_text.is_(None), m.MediaAsset.alt_text == "")
        )
    if args.query:
        like = f"%{args.query}%"
        stmt = stmt.where(
            or_(
                m.MediaAsset.title.ilike(like),
                m.MediaAsset.alt_text.ilike(like),
                m.MediaAsset.original_name.ilike(like),
                cast(m.MediaAsset.tags, Text).ilike(like),
            )
        )
    total = ctx.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = ctx.db.execute(stmt.order_by(m.MediaAsset.created_at.desc()).offset(args.offset).limit(args.limit)).scalars()
    items = [
        {
            "id": str(a.id),
            "kind": a.kind,
            "title": a.title,
            "alt_text": a.alt_text,
            "caption": _short(a.caption, 200),
            "folder": a.folder,
            "tags": a.tags or [],
            "original_name": a.original_name,
            "width": a.width,
            "height": a.height,
            "usage_count": a.usage_count,
            "url": media_svc.media_url(a.id) if a.storage_key else a.external_url,
        }
        for a in rows
    ]
    return jsonable({"total": total, "items": items})


class ViewMediaArgs(Args):
    media_id: str


VISION_MIMES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def image_block(asset: m.MediaAsset) -> dict[str, Any] | None:
    """Image de la médiathèque prête à être montrée à Claude (variante 960 px si elle existe)."""
    from app.core.storage import public_storage

    variant = (asset.variants or {}).get("md") or (asset.variants or {}).get("thumb")
    key, mime = (variant["key"], variant["mime"]) if variant else (asset.storage_key, asset.mime_type)
    if not key or mime not in VISION_MIMES:
        return None
    data = public_storage().get(key)
    if len(data) > 4_500_000:
        return None
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": mime, "data": base64.standard_b64encode(data).decode("ascii")},
    }


def view_media(ctx: ToolContext, args: ViewMediaArgs) -> list[dict[str, Any]]:
    try:
        asset = media_svc.get_media(ctx.db, uuid.UUID(args.media_id))
    except (ValueError, AppError) as exc:
        raise ToolError("Média introuvable") from exc
    if asset.kind != "image" or image_block(asset) is None:
        raise ToolError("Seules les images JPG, PNG, WebP ou GIF peuvent être regardées")
    meta = {"id": str(asset.id), "title": asset.title, "alt_text": asset.alt_text, "folder": asset.folder}
    # Référence conservée dans l'historique ; l'image est rechargée à l'identique à chaque appel du modèle.
    ref = {"type": "image", "source": {"type": "media_ref", "media_id": str(asset.id)}}
    return [ref, {"type": "text", "text": json.dumps(meta, ensure_ascii=False)}]


class SeoAuditArgs(Args):
    only_issues: bool = True
    limit: int = Field(default=80, ge=1, le=300)


def seo_audit(ctx: ToolContext, args: SeoAuditArgs) -> dict[str, Any]:
    from app.modules.cms.router_admin import seo_overview

    rows = seo_overview(principal=ctx.principal, db=ctx.db)
    if args.only_issues:
        rows = [r for r in rows if r["issues"]]
    out = []
    for r in rows[: args.limit]:
        seo = r.get("seo") or {}
        out.append(
            {
                "target_type": r["target_type"],
                "target_key": r["target_key"],
                "path": r["path"],
                "title": r["title"],
                "status": r["status"],
                "issues": r["issues"],
                "seo_title": seo.get("title"),
                "seo_description": seo.get("description"),
            }
        )
    return {"total": len(rows), "items": out}


class AnalyticsArgs(Args):
    start: date
    end: date


def analytics_report(ctx: ToolContext, args: AnalyticsArgs) -> dict[str, Any]:
    from app.modules.analytics import service as analytics

    if args.end < args.start or (args.end - args.start).days > 400:
        raise ToolError("Période invalide (début ≤ fin, 400 jours maximum)")
    report = analytics.overview(ctx.db, args.start, args.end, compare=True)
    trimmed = {k: (v[:12] if isinstance(v, list) else v) for k, v in report.items() if k not in ("series",)}
    trimmed["blog"] = analytics.blog_stats(ctx.db, args.start, args.end)[:12]
    return jsonable(trimmed)


class SiteConfigArgs(Args):
    part: Literal["settings", "navigation", "redirects", "forms"]


def site_config(ctx: ToolContext, args: SiteConfigArgs) -> Any:
    from app.modules.cms.router_admin import get_navigation, get_site_settings

    if args.part == "settings":
        return get_site_settings(principal=ctx.principal, db=ctx.db)
    if args.part == "navigation":
        return jsonable(get_navigation(principal=ctx.principal, db=ctx.db))
    if args.part == "redirects":
        rows = ctx.db.execute(select(m.Redirect).order_by(m.Redirect.source_path).limit(300)).scalars()
        return jsonable(
            [
                {k: getattr(r, k) for k in ("source_path", "target_path", "status_code", "is_active", "hits")}
                for r in rows
            ]
        )
    rows = ctx.db.execute(select(m.FormDefinition).order_by(m.FormDefinition.key)).scalars()
    return jsonable(
        [{"key": f.key, "title": getattr(f, "title", None), "fields": getattr(f, "fields", None)} for f in rows]
    )


# ============================================================================ écriture
class CreateArgs(Args):
    kind: CollectionKind = Field(description="Collection (pour une page, utilisez save_page)")
    data: dict[str, Any] = Field(description="Champs de l'élément (voir describe_fields)")
    summary: str = Field(max_length=300, description="Ce que vous créez, en une phrase")


def create_content(ctx: ToolContext, args: CreateArgs) -> dict[str, Any]:
    obj = _apply(ctx, lambda: cms_ops.collection_create(ctx.db, ctx.principal, args.kind, args.data))
    _record(
        ctx,
        tool="create_content",
        status="applied",
        summary=args.summary,
        payload=args.model_dump(),
        kind=args.kind,
        obj=obj,
    )
    return {
        "status": "draft_created",
        "id": str(obj.id),
        "path": service.public_path(ctx.db, args.kind, obj),
        "edit_url": _edit_url(args.kind, obj),
    }


class UpdateArgs(Args):
    kind: CollectionKind
    id: str
    changes: dict[str, Any] = Field(description="Seulement les champs à modifier")
    summary: str = Field(max_length=300)


def update_content(ctx: ToolContext, args: UpdateArgs) -> dict[str, Any]:
    try:
        obj = cms_ops.load(ctx.db, args.kind, args.id)
    except AppError as exc:
        raise ToolError(exc.message) from exc
    if obj.status == "draft":
        _apply(ctx, lambda: cms_ops.collection_update(ctx.db, ctx.principal, args.kind, obj, args.changes))
        _record(
            ctx,
            tool="update_content",
            status="applied",
            summary=args.summary,
            payload=args.model_dump(),
            kind=args.kind,
            obj=obj,
        )
        return {"status": "draft_updated", "id": str(obj.id)}
    _dry_run(ctx, lambda: cms_ops.collection_update(ctx.db, ctx.principal, args.kind, obj, dict(args.changes)))
    obj = cms_ops.load(ctx.db, args.kind, args.id)
    return _proposed(
        _record(
            ctx,
            tool="update_content",
            status="proposed",
            summary=args.summary,
            payload=args.model_dump(),
            kind=args.kind,
            obj=obj,
        )
    )


class SavePageArgs(Args):
    page_id: str | None = Field(default=None, description="Vide pour une nouvelle page")
    page: dict[str, Any] = Field(description="La page complète (route_key, path, title, sections…)")
    summary: str = Field(max_length=300)


def save_page(ctx: ToolContext, args: SavePageArgs) -> dict[str, Any]:
    if not args.page_id:
        page = _apply(ctx, lambda: cms_ops.page_save(ctx.db, ctx.principal, args.page, None))
        _record(
            ctx,
            tool="save_page",
            status="applied",
            summary=args.summary,
            payload=args.model_dump(),
            kind="page",
            obj=page,
        )
        return {"status": "draft_created", "id": str(page.id), "path": page.path, "edit_url": _edit_url("page", page)}
    try:
        page = cms_ops.load(ctx.db, "page", args.page_id)
    except AppError as exc:
        raise ToolError(exc.message) from exc
    if page.status == "draft":
        _apply(ctx, lambda: cms_ops.page_save(ctx.db, ctx.principal, args.page, page))
        _record(
            ctx,
            tool="save_page",
            status="applied",
            summary=args.summary,
            payload=args.model_dump(),
            kind="page",
            obj=page,
        )
        return {"status": "draft_updated", "id": str(page.id)}
    _dry_run(ctx, lambda: cms_ops.page_save(ctx.db, ctx.principal, args.page, page))
    page = cms_ops.load(ctx.db, "page", args.page_id)
    return _proposed(
        _record(
            ctx,
            tool="save_page",
            status="proposed",
            summary=args.summary,
            payload=args.model_dump(),
            kind="page",
            obj=page,
        )
    )


class SeoArgs(Args):
    kind: Kind = Field(description="Type de l'élément ciblé")
    id: str = Field(description="Identifiant de l'élément ciblé")
    changes: dict[str, Any] = Field(
        description="Champs SEO à modifier : title, description, h1, og_title, og_description, og_image_media_id, "
        "keywords, robots_index, canonical_url…"
    )
    summary: str = Field(max_length=300)


def set_seo(ctx: ToolContext, args: SeoArgs) -> dict[str, Any]:
    try:
        obj = cms_ops.load(ctx.db, args.kind, args.id)
    except AppError as exc:
        raise ToolError(exc.message) from exc
    target_type, target_key = _seo_target(args.kind, obj)
    payload = {**args.model_dump(), "target_type": target_type, "target_key": target_key}
    if obj.status == "draft":
        _apply(ctx, lambda: cms_ops.seo_set(ctx.db, ctx.principal, target_type, target_key, args.changes))
        _record(ctx, tool="set_seo", status="applied", summary=args.summary, payload=payload, kind=args.kind, obj=obj)
        return {"status": "applied_to_draft"}
    _dry_run(ctx, lambda: cms_ops.seo_set(ctx.db, ctx.principal, target_type, target_key, dict(args.changes)))
    obj = cms_ops.load(ctx.db, args.kind, args.id)
    return _proposed(
        _record(ctx, tool="set_seo", status="proposed", summary=args.summary, payload=payload, kind=args.kind, obj=obj)
    )


class MediaArgs(Args):
    media_id: str
    changes: dict[str, Any] = Field(description="title, alt_text, caption, credits, tags, folder")
    summary: str = Field(max_length=300)


def update_media(ctx: ToolContext, args: MediaArgs) -> dict[str, Any]:
    _dry_run(ctx, lambda: cms_ops.media_update(ctx.db, ctx.principal, args.media_id, dict(args.changes)))
    asset = media_svc.get_media(ctx.db, uuid.UUID(args.media_id))
    action = _record(
        ctx,
        tool="update_media",
        status="proposed",
        summary=args.summary,
        payload=args.model_dump(),
        kind="media",
        obj=asset,
        label=asset.title,
    )
    return _proposed(action)


class RedirectArgs(Args):
    source_path: str = Field(max_length=500)
    target_path: str = Field(max_length=500)
    status_code: Literal[301, 302, 410] = 301
    note: str | None = Field(default=None, max_length=250)
    summary: str = Field(max_length=300)


def create_redirect(ctx: ToolContext, args: RedirectArgs) -> dict[str, Any]:
    data = {
        "source_path": args.source_path,
        "target_path": args.target_path,
        "status_code": args.status_code,
        "note": args.note,
    }
    _dry_run(ctx, lambda: cms_ops.redirect_create(ctx.db, ctx.principal, dict(data)))
    return _proposed(
        _record(
            ctx,
            tool="create_redirect",
            status="proposed",
            summary=args.summary,
            payload=data,
            label=f"{args.source_path} → {args.target_path}",
        )
    )


class PublishArgs(Args):
    kind: Kind
    id: str
    note: str | None = Field(default=None, max_length=500)
    summary: str = Field(max_length=300)


def request_publication(ctx: ToolContext, args: PublishArgs) -> dict[str, Any]:
    try:
        obj = cms_ops.load(ctx.db, args.kind, args.id)
    except AppError as exc:
        raise ToolError(exc.message) from exc
    if obj.status == "published":
        raise ToolError("Déjà publié")
    _dry_run(ctx, lambda: cms_ops.check_publishable(ctx.db, args.kind, obj))
    return _proposed(
        _record(
            ctx,
            tool="request_publication",
            status="proposed",
            summary=args.summary,
            payload=args.model_dump(),
            kind=args.kind,
            obj=obj,
        )
    )


# ============================================================================ registre
TOOLS: list[Tool] = [
    Tool(
        "site_overview",
        "Vue d'ensemble du site : pages et collections par statut, médiathèque (images sans texte "
        "alternatif), redirections, fréquentation des 30 derniers jours.",
        OverviewArgs,
        site_overview,
        "Vue d'ensemble du site",
    ),
    Tool(
        "list_content",
        "Liste les pages ou les éléments d'une collection (id, titre, statut, adresse publique).",
        ListArgs,
        list_content,
        "Consultation des contenus",
    ),
    Tool(
        "get_content",
        "Lit un élément complet : champs, sections et blocs d'une page, réglages SEO.",
        GetArgs,
        get_content,
        "Lecture d'un contenu",
    ),
    Tool(
        "describe_fields",
        "Champs attendus pour une page ou une collection (schéma, choix possibles). À consulter avant "
        "de créer ou modifier un élément.",
        FieldsArgs,
        describe_fields,
        "Lecture de la structure des contenus",
    ),
    Tool(
        "search_media",
        "Cherche dans la médiathèque (images, vidéos, documents) ; missing_alt pour les images sans texte alternatif.",
        MediaSearchArgs,
        search_media,
        "Recherche dans la médiathèque",
    ),
    Tool(
        "view_media",
        "Regarde une image de la médiathèque (pour rédiger son texte alternatif, choisir un visuel…).",
        ViewMediaArgs,
        view_media,
        "Examen d'une image",
    ),
    Tool(
        "seo_audit",
        "Audit SEO de toutes les pages publiques : problèmes détectés (titre, méta-description, image de "
        "partage, indexation).",
        SeoAuditArgs,
        seo_audit,
        "Audit SEO",
        perms=("cms:read",),
    ),
    Tool(
        "analytics_report",
        "Fréquentation du site sur une période : visiteurs, sessions, pages vues, canaux, "
        "campagnes, appareils, pays, pages les plus vues, conversions, recherches internes, articles du blog.",
        AnalyticsArgs,
        analytics_report,
        "Analyse de la fréquentation",
        perms=("analytics:read",),
    ),
    Tool(
        "site_config",
        "Lit les réglages du site, la navigation, les redirections ou les formulaires.",
        SiteConfigArgs,
        site_config,
        "Lecture des réglages du site",
    ),
    Tool(
        "create_content",
        "Crée un élément de collection en BROUILLON (article de blog, offre, réalisation, FAQ, "
        "témoignage…). Rien n'est publié.",
        CreateArgs,
        create_content,
        "Création d'un brouillon",
        perms=("cms:write",),
        write=True,
    ),
    Tool(
        "update_content",
        "Modifie un élément de collection. Brouillon : modifié directement ; contenu publié ou en "
        "relecture : proposition soumise à validation.",
        UpdateArgs,
        update_content,
        "Modification d'un contenu",
        perms=("cms:write",),
        write=True,
    ),
    Tool(
        "save_page",
        "Crée une page (brouillon) ou modifie une page existante (page complète). Page publiée : "
        "proposition soumise à validation.",
        SavePageArgs,
        save_page,
        "Rédaction d'une page",
        perms=("cms:write",),
        write=True,
    ),
    Tool(
        "set_seo",
        "Règle le SEO d'un élément (titre, méta-description, H1, partage, mots-clés). Contenu publié : "
        "proposition soumise à validation.",
        SeoArgs,
        set_seo,
        "Réglage SEO",
        perms=("seo:write",),
        write=True,
    ),
    Tool(
        "update_media",
        "Propose de modifier un média : titre, texte alternatif, légende, crédits, étiquettes, dossier.",
        MediaArgs,
        update_media,
        "Proposition sur un média",
        perms=("media:write",),
        write=True,
    ),
    Tool(
        "create_redirect",
        "Propose une redirection (ancienne adresse → nouvelle, 301 / 302, ou 410 supprimé).",
        RedirectArgs,
        create_redirect,
        "Proposition de redirection",
        perms=("seo:write",),
        write=True,
    ),
    Tool(
        "request_publication",
        "Propose la publication d'un élément ou d'une page (la personne valide et publie).",
        PublishArgs,
        request_publication,
        "Proposition de publication",
        perms=("cms:write",),
        write=True,
    ),
]
TOOLS_BY_NAME = {t.name: t for t in TOOLS}


def tools_for(principal: Principal) -> list[Tool]:
    return [t for t in TOOLS if all(principal.has(p) for p in t.perms)]


def run_tool(ctx: ToolContext, name: str, raw_input: Any) -> tuple[Any, bool]:
    """Exécute un outil : (contenu du résultat, en_erreur). Les erreurs reviennent à Claude, jamais à l'utilisateur."""
    tool = TOOLS_BY_NAME.get(name)
    if tool is None or not all(ctx.principal.has(p) for p in tool.perms):
        return f"Outil indisponible : {name}", True
    try:
        args = tool.args.model_validate(raw_input if isinstance(raw_input, dict) else {})
    except ValidationError as exc:
        return _validation_message(exc), True
    try:
        result = tool.handler(ctx, args)
    except ToolError as exc:
        return str(exc), True
    except AppError as exc:
        return exc.message, True
    if isinstance(result, list):
        return result, False
    return json.dumps(jsonable(result), ensure_ascii=False, default=str)[:60_000], False


# ============================================================================ validation humaine
def apply_action(db: Session, principal: Principal, action: SiteAssistantAction) -> dict[str, Any]:
    """Applique une proposition, avec les droits de la personne qui valide."""
    p = action.payload
    if action.tool == "update_content":
        obj = cms_ops.load(db, p["kind"], p["id"])
        cms_ops.collection_update(db, principal, p["kind"], obj, dict(p["changes"]))
        return {"id": str(obj.id), "path": service.public_path(db, p["kind"], obj)}
    if action.tool == "save_page":
        page = cms_ops.load(db, "page", p["page_id"])
        cms_ops.page_save(db, principal, p["page"], page)
        return {"id": str(page.id), "path": page.path}
    if action.tool == "set_seo":
        cms_ops.seo_set(db, principal, p["target_type"], p["target_key"], dict(p["changes"]))
        return {"target": f"{p['target_type']}:{p['target_key']}"}
    if action.tool == "update_media":
        asset = cms_ops.media_update(db, principal, p["media_id"], dict(p["changes"]))
        return {"id": str(asset.id)}
    if action.tool == "create_redirect":
        row = cms_ops.redirect_create(db, principal, dict(p))
        return {"id": str(row.id)}
    if action.tool == "request_publication":
        obj = cms_ops.load(db, p["kind"], p["id"])
        cms_ops.publish(db, principal, p["kind"], obj, p.get("note"))
        return {"id": str(obj.id), "path": service.public_path(db, p["kind"], obj)}
    raise AppError("Action non applicable", code="NOT_APPLICABLE")


def add_step(db: Session, session: SiteAssistantSession, text: str) -> None:
    db.add(SiteAssistantMessage(created_at=stamp(), session_id=session.id, role="step", text=text[:500]))
