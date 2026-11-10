"""Outils de l'assistant du site : ce que Claude peut lire et faire dans le CMS, la médiathèque, le SEO et
l'analytics. Chaque outil est décrit par un modèle Pydantic (schéma envoyé à Claude ET validation de ce qu'il
renvoie avant toute exécution).

Règle de prudence : Claude ne change jamais seul ce que voient les visiteurs.
  • appliqué d'office : création de brouillons, modification d'un brouillon, image générée déposée dans la
    médiathèque (rien n'est public tant qu'elle n'est pas utilisée dans un contenu publié) ;
  • proposé à la validation : contenu publié, SEO d'un contenu publié, textes alternatifs, redirections, menus,
    réglages du site, publication, retrait — essayé à blanc (erreurs renvoyées à Claude), puis appliqué par une
    personne, avec ses droits, après aperçu sur le site.
Plusieurs propositions sur un même élément dans une conversation sont fusionnées (la dernière version d'une page
remplace la précédente) ; une proposition dont la cible a changé depuis est refusée à l'application.
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
from app.core.errors import AppError, Conflict
from app.core.utils import jsonable, utcnow
from app.modules.cms import media as media_svc
from app.modules.cms import models as m
from app.modules.cms import service
from app.modules.cms.schemas import PageIn
from app.modules.site_assistant import cms_ops
from app.modules.site_assistant.models import SiteAssistantAction, SiteAssistantMessage, SiteAssistantSession, stamp
from app.providers.imagegen import ASPECTS

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
    queued = set(ctx.db.info.get("revalidate_paths", ()))
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
        # Un essai à blanc ne doit pas révalider le site au prochain enregistrement.
        if queued:
            ctx.db.info["revalidate_paths"] = queued
        else:
            ctx.db.info.pop("revalidate_paths", None)


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


def _proposed(action: SiteAssistantAction, *, merged: bool = False) -> dict[str, Any]:
    return {
        "status": "proposed",
        "action_id": str(action.id),
        "message": (
            "Proposition existante mise à jour (une seule proposition par élément) : elle sera appliquée quand la "
            "personne la validera, après aperçu."
            if merged
            else "Proposition enregistrée : elle sera appliquée quand la personne la validera, après aperçu."
        ),
    }


def _pending(ctx: ToolContext, tool: str, kind: str | None, target_id: str | None) -> SiteAssistantAction | None:
    """Proposition encore en attente, dans cette conversation, du même outil sur la même cible."""
    return ctx.db.execute(
        select(SiteAssistantAction)
        .where(
            SiteAssistantAction.session_id == ctx.session.id,
            SiteAssistantAction.tool == tool,
            SiteAssistantAction.target_type == kind,
            SiteAssistantAction.target_id == target_id,
            SiteAssistantAction.status == "proposed",
        )
        .order_by(SiteAssistantAction.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()


def _merge(action: SiteAssistantAction, summary: str, payload: dict[str, Any]) -> SiteAssistantAction:
    action.payload = jsonable(payload)
    action.summary = summary[:400]
    action.created_at = stamp()
    return action


def _version(obj: Any) -> str:
    """Repère de version d'une cible (numéro de révision du CMS, qui change à chaque enregistrement de contenu ou
    de statut, mais pas avec les compteurs de vues) : une proposition est refusée si la cible a changé depuis."""
    revision = getattr(obj, "revision", None)
    return f"r{revision}" if revision is not None else str(getattr(obj, "updated_at", None) or "")


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
        data = jsonable(_page_out(ctx.db, obj, full=True))
        pending = _pending(ctx, "save_page", "page", str(obj.id))
        if pending is not None:
            data["proposition_en_attente"] = {
                "action_id": str(pending.id),
                "page": pending.payload.get("page"),
                "note": "Version proposée, pas encore validée. Pour la compléter, repartez de cette version : un "
                "nouvel save_page sur cette page remplace la proposition en attente.",
            }
        return data
    data = jsonable(serialize(obj))
    target_type, target_key = _seo_target(args.kind, obj)
    seo = service.get_seo(ctx.db, target_type, target_key)
    data["path"] = service.public_path(ctx.db, args.kind, obj)
    data["seo"] = jsonable({c.key: getattr(seo, c.key) for c in seo.__table__.columns}) if seo else None
    data["seo_target"] = {"target_type": target_type, "target_key": target_key}
    pending = _pending(ctx, "update_content", args.kind, str(obj.id))
    if pending is not None:
        data["modifications_en_attente"] = {
            "action_id": str(pending.id),
            "changes": pending.payload.get("changes"),
            "note": "Modifications proposées, pas encore validées ; un nouvel update_content s'y ajoute.",
        }
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
    pending = _pending(ctx, "update_content", args.kind, str(obj.id))
    changes = {**((pending.payload.get("changes") or {}) if pending else {}), **args.changes}
    _dry_run(ctx, lambda: cms_ops.collection_update(ctx.db, ctx.principal, args.kind, obj, dict(changes)))
    obj = cms_ops.load(ctx.db, args.kind, args.id)
    payload = {**args.model_dump(), "changes": changes}
    if pending is not None:
        summary = args.summary if args.summary in pending.summary else f"{pending.summary} ; {args.summary}"
        payload["base_version"] = pending.payload.get("base_version")
        return _proposed(_merge(pending, summary, payload), merged=True)
    payload["base_version"] = _version(obj)
    return _proposed(
        _record(
            ctx,
            tool="update_content",
            status="proposed",
            summary=args.summary,
            payload=payload,
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
    payload = args.model_dump()
    pending = _pending(ctx, "save_page", "page", str(page.id))
    if pending is not None:
        payload["base_version"] = pending.payload.get("base_version")
        return _proposed(_merge(pending, args.summary, payload), merged=True)
    payload["base_version"] = _version(page)
    return _proposed(
        _record(ctx, tool="save_page", status="proposed", summary=args.summary, payload=payload, kind="page", obj=page)
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
    pending = _pending(ctx, "set_seo", args.kind, str(obj.id))
    changes = {**((pending.payload.get("changes") or {}) if pending else {}), **args.changes}
    payload["changes"] = changes
    _dry_run(ctx, lambda: cms_ops.seo_set(ctx.db, ctx.principal, target_type, target_key, dict(changes)))
    obj = cms_ops.load(ctx.db, args.kind, args.id)
    if pending is not None:
        return _proposed(_merge(pending, args.summary, payload), merged=True)
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


class UnpublishArgs(Args):
    kind: Kind
    id: str
    note: str | None = Field(default=None, max_length=500)
    summary: str = Field(max_length=300, description="Pourquoi retirer cet élément du site")


def request_unpublish(ctx: ToolContext, args: UnpublishArgs) -> dict[str, Any]:
    try:
        obj = cms_ops.load(ctx.db, args.kind, args.id)
    except AppError as exc:
        raise ToolError(exc.message) from exc
    if obj.status != "published":
        raise ToolError("Cet élément n'est pas en ligne")
    if args.kind == "page" and obj.route_key in service.SYSTEM_PAGES:
        raise ToolError("Page du site à adresse fixe : modifiez son contenu au lieu de la retirer")
    return _proposed(
        _record(
            ctx,
            tool="request_unpublish",
            status="proposed",
            summary=args.summary,
            payload=args.model_dump(),
            kind=args.kind,
            obj=obj,
        )
    )


class NavigationArgs(Args):
    key: str = Field(max_length=40, description="Menu : header, footer, mobile, cta… (voir site_config navigation)")
    title: str = Field(max_length=150)
    items: list[dict[str, Any]] = Field(
        description="Le menu complet : [{label, link_type: page|path|url|anchor, page_route_key | url, description, "
        "icon, highlight, visible, children: […]}]"
    )
    summary: str = Field(max_length=300)


def update_navigation(ctx: ToolContext, args: NavigationArgs) -> dict[str, Any]:
    data = {"title": args.title, "items": args.items}
    _dry_run(ctx, lambda: cms_ops.navigation_save(ctx.db, ctx.principal, args.key, dict(data)))
    payload = {"key": args.key, **data}
    pending = _pending(ctx, "update_navigation", "navigation", args.key)
    if pending is not None:
        return _proposed(_merge(pending, args.summary, payload), merged=True)
    action = _record(
        ctx,
        tool="update_navigation",
        status="proposed",
        summary=args.summary,
        payload=payload,
        label=f"Menu « {args.key} »",
    )
    action.target_type, action.target_id = "navigation", args.key
    return _proposed(action)


class SiteSettingsArgs(Args):
    changes: dict[str, Any] = Field(
        description="Seulement : "
        + ", ".join(sorted(cms_ops.ASSISTANT_SITE_FIELDS))
        + " (default_og_media_id : image de partage par défaut ; opening_hours : liste d'horaires)"
    )
    summary: str = Field(max_length=300)


def _publisher_view(principal: Principal) -> Principal:
    from dataclasses import replace

    return replace(principal, permissions={*principal.permissions, "cms:publish"})


def update_site_settings(ctx: ToolContext, args: SiteSettingsArgs) -> dict[str, Any]:
    pending = _pending(ctx, "update_site_settings", "site_settings", "site")
    changes = {**((pending.payload.get("changes") or {}) if pending else {}), **args.changes}
    # Essai à blanc avec le droit de publier : seule la forme est vérifiée ici ; les droits réels le seront quand
    # la personne appliquera la proposition.
    probe = _publisher_view(ctx.principal)
    _dry_run(ctx, lambda: cms_ops.site_settings_save(ctx.db, probe, dict(changes)))
    payload = {"changes": changes}
    if pending is not None:
        return _proposed(_merge(pending, args.summary, payload), merged=True)
    action = _record(
        ctx, tool="update_site_settings", status="proposed", summary=args.summary, payload=payload, label="Réglages"
    )
    action.target_type, action.target_id = "site_settings", "site"
    return _proposed(action)


class AuditArgs(Args):
    include_ok: bool = Field(default=False, description="Inclure aussi les pages sans problème détecté")


def audit_site_content(ctx: ToolContext, args: AuditArgs) -> dict[str, Any]:
    from app.modules.site_assistant.audit import site_content_audit

    return jsonable(site_content_audit(ctx.db, include_ok=args.include_ok))


MAX_IMAGES_PER_TURN = 12
IMAGE_SUFFIX = (
    "\n\nPhotorealistic, professional quality. No text, letters, numbers, logos, brand names or watermarks "
    "anywhere in the image. People, if any, are generic and not identifiable public figures."
)


class GenerateImageArgs(Args):
    prompt: str = Field(
        min_length=30,
        max_length=3500,
        description="Description détaillée de l'image, de préférence en anglais : sujet, lieu (Cameroun, Afrique "
        "centrale), matériaux, lumière, cadrage, objectif photo, ambiance. Style photo réaliste et professionnel.",
    )
    aspect: Literal[ASPECTS] = Field(  # type: ignore[valid-type]
        default="3:2", description="16:9 bannière, 3:2 ou 4:3 section ou carte, 1:1 vignette, 3:4 ou 9:16 portrait"
    )
    title: str = Field(min_length=3, max_length=200, description="Titre du média dans la médiathèque")
    alt_text: str = Field(min_length=10, max_length=250, description="Texte alternatif (ce que montre l'image)")
    purpose: str = Field(max_length=200, description="Où l'image servira (ex. bannière de la page Services)")


def _images_today(db: Session) -> int:
    from app.modules.ai.models import AIRequest

    since = utcnow() - timedelta(hours=24)
    return (
        db.scalar(
            select(func.count())
            .select_from(AIRequest)
            .where(
                AIRequest.feature == "site_assistant_image",
                AIRequest.status == "ok",
                AIRequest.created_at >= since,
            )
        )
        or 0
    )


def _record_image_request(
    ctx: ToolContext, provider: Any, args: GenerateImageArgs, *, started: float, image: Any = None, error: str = ""
) -> None:
    import hashlib
    import time

    from app.modules.ai.models import AIRequest

    usage = (getattr(image, "usage", None) or {}) if image is not None else {}
    ctx.db.add(
        AIRequest(
            feature="site_assistant_image",
            provider=provider.name,
            model=provider.model,
            user_id=ctx.principal.id,
            entity_type="site_assistant_session",
            entity_id=str(ctx.session.id),
            input_hash=hashlib.sha256(args.prompt.encode()).hexdigest(),
            input_tokens=int(usage.get("input_tokens") or 0),
            output_tokens=int(usage.get("output_tokens") or 0),
            duration_ms=int((time.perf_counter() - started) * 1000),
            status="error" if error else "ok",
            error=error or None,
            output={
                "prompt": args.prompt[:2000],
                "aspect": args.aspect,
                "purpose": args.purpose,
                "size": f"{image.width}x{image.height}" if image is not None else None,
            },
            validation_status="not_required",
        )
    )
    ctx.db.flush()


def generate_image(ctx: ToolContext, args: GenerateImageArgs) -> list[dict[str, Any]]:
    import re
    import time

    from app.core.config import settings
    from app.providers.imagegen import ImageGenError, get_image_provider

    provider = get_image_provider()
    if provider is None:
        raise ToolError("Génération d'images non configurée : servez-vous des images de la médiathèque (search_media).")
    if sum(1 for a in ctx.actions if a.tool == "generate_image") >= MAX_IMAGES_PER_TURN:
        raise ToolError(f"{MAX_IMAGES_PER_TURN} images générées dans ce tour : continuez avec la médiathèque.")
    limit = 40 if settings.IMAGE_GEN_DAILY_LIMIT is None else settings.IMAGE_GEN_DAILY_LIMIT
    if _images_today(ctx.db) >= limit:
        raise ToolError(
            f"Plafond de {limit} images générées par 24 h atteint (Paramètres › Intégrations) : servez-vous de la "
            "médiathèque ou signalez les images restant à créer."
        )
    started = time.perf_counter()
    try:
        image = provider.generate(args.prompt.strip() + IMAGE_SUFFIX, args.aspect)
    except ImageGenError as exc:
        _record_image_request(ctx, provider, args, started=started, error=str(exc))
        raise ToolError(str(exc)) from exc
    stem = re.sub(r"[^a-z0-9]+", "-", args.title.lower()).strip("-")[:60] or "illustration"
    credits = f"Illustration générée par IA ({provider.label}, {provider.model})"[:250]

    def store() -> m.MediaAsset:
        asset = media_svc.upload_media(
            ctx.db,
            filename=f"ia-{stem}{image.extension}",
            data=image.data,
            title=args.title,
            alt_text=args.alt_text,
            folder="ia",
            tags=["ia", "image-generee"],
            author_id=ctx.principal.id,
        )
        asset.credits = credits
        asset.caption = f"Image générée par IA — {args.purpose}"[:2000]
        return asset

    asset = _apply(ctx, store)
    _record_image_request(ctx, provider, args, started=started, image=image)
    _record(
        ctx,
        tool="generate_image",
        status="applied",
        summary=f"Image générée : {args.title}",
        payload={**args.model_dump(), "provider": provider.name, "model": provider.model},
        kind="media",
        obj=asset,
        label=args.title,
        result={
            "media_id": str(asset.id),
            "url": media_svc.media_url(asset.id),
            "width": image.width,
            "height": image.height,
        },
    )
    meta = {
        "media_id": str(asset.id),
        "title": asset.title,
        "alt_text": asset.alt_text,
        "size": f"{image.width}x{image.height}",
        "folder": "ia",
        "note": "Image ajoutée à la médiathèque (dossier « ia », mention « Illustration générée par IA »). "
        "Regarde-la : si elle ne convient pas (déformation, texte parasite, scène peu crédible), génère-en une "
        "autre avec une description corrigée ; sinon utilise son media_id dans le contenu.",
    }
    ref = {"type": "image", "source": {"type": "media_ref", "media_id": str(asset.id)}}
    return [ref, {"type": "text", "text": json.dumps(meta, ensure_ascii=False)}]


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
        "audit_site_content",
        "Audit éditorial de toute la vitrine, page par page, tel que la voit un visiteur : sections et blocs vides, "
        "bannières sans image, textes courts, listes sans élément publié, pages de détail minces (offres, "
        "services, réalisations, articles…), SEO. À lancer en premier pour un travail d'ensemble.",
        AuditArgs,
        audit_site_content,
        "Audit des pages de la vitrine",
    ),
    Tool(
        "generate_image",
        "Génère une illustration réaliste et professionnelle et l'ajoute à la médiathèque (dossier « ia », "
        "mentionnée comme générée par IA) ; renvoie l'image pour contrôle et son media_id. Seulement quand la "
        "médiathèque n'a pas d'image adaptée, et jamais pour représenter une réalisation, une personne réelle, "
        "l'équipe ou un témoignage de GLOBUS.",
        GenerateImageArgs,
        generate_image,
        "Création d'une image",
        perms=("media:write",),
        write=True,
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
    Tool(
        "request_unpublish",
        "Propose de retirer du site un contenu publié obsolète ou erroné (archivage, réversible).",
        UnpublishArgs,
        request_unpublish,
        "Proposition de retrait",
        perms=("cms:write",),
        write=True,
    ),
    Tool(
        "update_navigation",
        "Propose un menu complet (en-tête, pied de page, mobile, boutons d'action) : liens vers les pages, "
        "libellés, sous-menus. Lire d'abord site_config navigation.",
        NavigationArgs,
        update_navigation,
        "Proposition de menu",
        perms=("cms:write",),
        write=True,
    ),
    Tool(
        "update_site_settings",
        "Propose de modifier les textes généraux du site : slogan, promesse, méta-description et modèle de titre "
        "par défaut, image de partage par défaut, horaires.",
        SiteSettingsArgs,
        update_site_settings,
        "Proposition de réglages du site",
        perms=("cms:write",),
        write=True,
    ),
]
TOOLS_BY_NAME = {t.name: t for t in TOOLS}


def tools_for(principal: Principal) -> list[Tool]:
    from app.providers.imagegen import get_image_provider

    images = get_image_provider() is not None
    return [t for t in TOOLS if all(principal.has(p) for p in t.perms) and (t.name != "generate_image" or images)]


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
        _check_version(obj, p)
        cms_ops.collection_update(db, principal, p["kind"], obj, dict(p["changes"]))
        return {"id": str(obj.id), "path": service.public_path(db, p["kind"], obj)}
    if action.tool == "save_page":
        page = cms_ops.load(db, "page", p["page_id"])
        _check_version(page, p)
        cms_ops.page_save(db, principal, p["page"], page)
        return {"id": str(page.id), "path": page.path}
    if action.tool == "request_unpublish":
        obj = cms_ops.load(db, p["kind"], p["id"])
        cms_ops.unpublish(db, principal, p["kind"], obj, p.get("note"))
        return {"id": str(obj.id)}
    if action.tool == "update_navigation":
        menu = cms_ops.navigation_save(db, principal, p["key"], {"title": p["title"], "items": p["items"]})
        return {"key": menu.key}
    if action.tool == "update_site_settings":
        cms_ops.site_settings_save(db, principal, dict(p["changes"]))
        return {"fields": sorted(p["changes"])}
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


def _check_version(obj: Any, payload: dict[str, Any]) -> None:
    base = payload.get("base_version")
    if base and base != _version(obj):
        raise Conflict(
            "Le contenu a été modifié depuis cette proposition : demandez à Claude de la refaire sur la version "
            "actuelle.",
            code="PROPOSAL_STALE",
        )


def add_step(db: Session, session: SiteAssistantSession, text: str) -> None:
    db.add(SiteAssistantMessage(created_at=stamp(), session_id=session.id, role="step", text=text[:500]))
