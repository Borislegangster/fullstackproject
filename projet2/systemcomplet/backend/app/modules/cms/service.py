"""Services CMS : workflow de publication (brouillon → revue → validation → publication → dépublication
planifiée → archivage), révisions, SEO, redirections automatiques, rendu public (résolution des médias
et des collections), sitemap/robots dynamiques, publication planifiée."""

from __future__ import annotations

import logging
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.deps import Principal
from app.core.errors import AppError, Conflict, Forbidden, NotFound
from app.core.utils import jsonable, utcnow
from app.modules.cms import models as m
from app.modules.cms.brand import brand_payload
from app.modules.cms.media import load_media_map, media_payload, validate_media_refs
from app.modules.cms.schemas import PageIn, SeoIn

log = logging.getLogger("globus.cms")


@dataclass(frozen=True)
class CollectionDef:
    key: str
    model: Any
    label: str
    seo_type: str | None = None
    path_template: str | None = None  # chemin public (« {slug} »)
    publishable: bool = True
    title_attr: str = "name"
    search: tuple[str, ...] = ()
    sort_default: str = "sort_order"


COLLECTIONS: dict[str, CollectionDef] = {
    "universes": CollectionDef(
        "universes", m.Universe, "Univers", "universe", "/offres/{slug}", title_attr="name", search=("name", "tagline")
    ),
    "offers": CollectionDef(
        "offers",
        m.Offer,
        "Offres",
        "offer",
        "/offres/{universe_slug}/{slug}",
        title_attr="name",
        search=("name", "summary"),
    ),
    "expertises": CollectionDef(
        "expertises",
        m.Expertise,
        "Expertises",
        "expertise",
        "/expertises/{slug}",
        title_attr="name",
        search=("name", "summary"),
    ),
    "services": CollectionDef(
        "services",
        m.Service,
        "Services",
        "service",
        "/services/{slug}",
        title_attr="name",
        search=("name", "summary", "category"),
    ),
    "projects": CollectionDef(
        "projects",
        m.PortfolioProject,
        "Projets",
        "project",
        "/projets/{slug}",
        title_attr="title",
        search=("title", "summary", "city"),
    ),
    "blog_posts": CollectionDef(
        "blog_posts",
        m.BlogPost,
        "Articles",
        "blog_post",
        "/blog/{slug}",
        title_attr="title",
        search=("title", "excerpt"),
        sort_default="published_at",
    ),
    "help_articles": CollectionDef(
        "help_articles",
        m.HelpArticle,
        "Aide",
        "help_article",
        "/aide/{slug}",
        title_attr="title",
        search=("title", "summary"),
    ),
    "faq_items": CollectionDef("faq_items", m.FaqItem, "FAQ", None, None, title_attr="question", search=("question",)),
    "testimonials": CollectionDef(
        "testimonials", m.Testimonial, "Témoignages", title_attr="author_name", search=("author_name", "quote")
    ),
    "team_members": CollectionDef("team_members", m.TeamMember, "Équipe", search=("name", "role")),
    "partners": CollectionDef("partners", m.Partner, "Partenaires", search=("name",)),
    "certifications": CollectionDef("certifications", m.Certification, "Certifications", search=("name", "issuer")),
    "key_figures": CollectionDef("key_figures", m.KeyFigure, "Chiffres clés", title_attr="label", search=("label",)),
    "videos": CollectionDef("videos", m.Video, "Vidéothèque", title_attr="title", search=("title",)),
    "banners": CollectionDef("banners", m.Banner, "Bannières / popups", title_attr="title", search=("title", "key")),
}
TAXONOMIES = {
    "blog_categories": m.BlogCategory,
    "blog_authors": m.BlogAuthor,
    "faq_categories": m.FaqCategory,
    "help_categories": m.HelpCategory,
}

TRANSITIONS: dict[tuple[str, str], str] = {
    ("draft", "in_review"): "cms:write",
    ("in_review", "draft"): "cms:review",
    ("in_review", "validated"): "cms:review",
    ("validated", "draft"): "cms:review",
    ("validated", "published"): "cms:publish",
    ("draft", "published"): "cms:publish",  # publication directe par un publicateur (circuit court)
    ("in_review", "published"): "cms:publish",
    ("published", "archived"): "cms:publish",
    ("published", "draft"): "cms:publish",
    ("archived", "draft"): "cms:publish",
}


# ---------------------------------------------------------------------------- visibilité publique
def is_live(obj: Any, now: datetime | None = None) -> bool:
    now = now or utcnow()
    if getattr(obj, "status", "published") != "published":
        return False
    if getattr(obj, "publish_at", None) and obj.publish_at > now:
        return False
    return not (getattr(obj, "unpublish_at", None) and obj.unpublish_at <= now)


def live_filter(model: Any) -> list[Any]:
    now = utcnow()
    return [
        model.status == "published",
        or_(model.publish_at.is_(None), model.publish_at <= now),
        or_(model.unpublish_at.is_(None), model.unpublish_at > now),
    ]


# ---------------------------------------------------------------------------- SEO
def get_seo(db: Session, target_type: str, target_key: str) -> m.SeoMetadata | None:
    return db.execute(
        select(m.SeoMetadata).where(m.SeoMetadata.target_type == target_type, m.SeoMetadata.target_key == target_key)
    ).scalar_one_or_none()


def upsert_seo(
    db: Session, target_type: str, target_key: str, data: SeoIn | dict[str, Any] | None
) -> m.SeoMetadata | None:
    if data is None:
        return get_seo(db, target_type, target_key)
    values = data.model_dump() if isinstance(data, SeoIn) else SeoIn.model_validate(data).model_dump()
    validate_media_refs(db, values)
    row = get_seo(db, target_type, target_key)
    if row is None:
        row = m.SeoMetadata(target_type=target_type, target_key=target_key)
        db.add(row)
    for key, value in values.items():
        setattr(row, key, value)
    db.flush()
    return row


def seo_payload(db: Session, row: m.SeoMetadata | None) -> dict[str, Any] | None:
    if row is None:
        return None
    media = load_media_map(db, {x for x in (row.og_image_media_id, row.twitter_image_media_id) if x})
    return {
        "title": row.title,
        "description": row.description,
        "canonical_url": row.canonical_url,
        "robots_index": row.robots_index,
        "robots_follow": row.robots_follow,
        "og_title": row.og_title,
        "og_description": row.og_description,
        "og_image": media.get(str(row.og_image_media_id)) if row.og_image_media_id else None,
        "twitter_card": row.twitter_card,
        "twitter_image": media.get(str(row.twitter_image_media_id)) if row.twitter_image_media_id else None,
        "h1": row.h1,
        "keywords": row.keywords or [],
    }


def seo_issues(row: m.SeoMetadata | None, title_fallback: str | None) -> list[str]:
    issues: list[str] = []
    title = (row.title if row else None) or title_fallback
    if not row:
        issues.append("Métadonnées SEO absentes")
    if not title:
        issues.append("Titre manquant")
    elif len(title) > 65:
        issues.append("Titre long (> 65 caractères)")
    if not row or not row.description:
        issues.append("Méta-description manquante")
    elif len(row.description) < 70 or len(row.description) > 160:
        issues.append("Méta-description hors 70–160 caractères")
    if row and not row.og_image_media_id:
        issues.append("Image de partage (OpenGraph) absente")
    if row and not row.robots_index:
        issues.append("Page non indexée (noindex)")
    return issues


# ---------------------------------------------------------------------------- révisions
def snapshot_of(obj: Any) -> dict[str, Any]:
    data = {c.key: getattr(obj, c.key) for c in obj.__table__.columns}
    if isinstance(obj, m.CmsPage):
        data["sections"] = [
            {
                "id": s.id,
                "key": s.key,
                "title": s.title,
                "sort_order": s.sort_order,
                "settings": s.settings,
                "visible": s.visible,
                "blocks": [
                    {"id": b.id, "kind": b.kind, "sort_order": b.sort_order, "data": b.data, "visible": b.visible}
                    for b in s.blocks
                ],
            }
            for s in obj.sections
        ]
    return jsonable(data)


def add_revision(
    db: Session, entity_type: str, obj: Any, user_id: uuid.UUID | None, note: str | None = None
) -> m.CmsRevision:
    number = (
        db.execute(
            select(func.max(m.CmsRevision.number)).where(
                m.CmsRevision.entity_type == entity_type, m.CmsRevision.entity_id == obj.id
            )
        ).scalar()
        or 0
    ) + 1
    rev = m.CmsRevision(
        entity_type=entity_type,
        entity_id=obj.id,
        number=number,
        status=obj.status,
        snapshot=snapshot_of(obj),
        note=note,
        user_id=user_id,
    )
    db.add(rev)
    if hasattr(obj, "revision"):
        obj.revision = number
    db.flush()
    return rev


# ---------------------------------------------------------------------------- pages
# Pages servies par une route fixe du site (accueil, pages de liste) : clé et chemin imposés par le code du site.
SYSTEM_PAGES: dict[str, str] = {
    "home": "/",
    "offers": "/offres",
    "expertises": "/expertises",
    "services": "/services",
    "projects": "/projets",
    "blog": "/blog",
    "describe-project": "/decrire-mon-projet",
    "faq": "/faq",
    "help": "/aide",
}

# Premiers segments d'adresse occupés par les écrans du site et des espaces : une page CMS y serait masquée.
RESERVED_SEGMENTS = frozenset(
    {
        *("aide", "avis", "blog", "chantiers", "decrire-mon-projet", "devis", "energie-confort"),
        *("estimation-instantanee", "expertises", "faq", "financement", "fournisseur", "offres", "paiement"),
        *("parrainage", "payer", "projets", "recherche", "services", "verification", "visite"),
        *("activation", "connexion", "inscription", "mot-de-passe-oublie", "reset"),
        *("agenda", "appels", "messagerie", "notifications"),
        *("erp", "espace-client", "extranet", "embarque", "api", "uploads", "_next", "icons"),
        *("robots.txt", "sitemap.xml", "manifest.webmanifest", "favicon.ico", "apple-touch-icon.png"),
    }
)


def _check_page_address(db: Session, data: PageIn, page: m.CmsPage | None) -> None:
    """Adresse d'une page : clé et chemin uniques, pages système figées, chemins des écrans du site interdits."""
    if page is not None and page.route_key in SYSTEM_PAGES:
        if data.route_key != page.route_key or data.path != page.path:
            raise AppError(
                f"« {page.title} » est une page du site à adresse fixe ({page.path}) : "
                "son contenu se modifie, pas son adresse ni sa clé.",
                code="SYSTEM_PAGE",
            )
    elif data.route_key in SYSTEM_PAGES:
        if data.path != SYSTEM_PAGES[data.route_key]:
            raise AppError(
                f"La clé « {data.route_key} » est réservée à la page {SYSTEM_PAGES[data.route_key]}.",
                code="SYSTEM_PAGE",
            )
    else:
        first = data.path.strip("/").split("/")[0]
        if data.path == "/" or first in RESERVED_SEGMENTS:
            raise AppError(
                f"Le chemin « {data.path} » est déjà utilisé par le site. Choisissez une autre adresse"
                f"{f' (ex. « /{first}-infos »)' if first else ''}.",
                code="PATH_RESERVED",
            )
    for column, value, label in (
        (m.CmsPage.route_key, data.route_key, "La clé"),
        (m.CmsPage.path, data.path, "Le chemin"),
    ):
        stmt = select(m.CmsPage.title).where(column == value)
        if page is not None:
            stmt = stmt.where(m.CmsPage.id != page.id)
        other = db.scalar(stmt.limit(1))
        if other is not None:
            raise Conflict(f"{label} « {value} » est déjà utilisé par la page « {other} ».", code="PAGE_EXISTS")


def _rename_page_key(db: Session, old: str, new: str) -> None:
    """Changement de clé : les liens de menu et le référencement de la page suivent."""
    db.execute(update(m.NavigationItem).where(m.NavigationItem.page_route_key == old).values(page_route_key=new))
    for model in (m.SeoMetadata, m.SchemaMarkup):
        db.execute(update(model).where(model.target_type == "page", model.target_key == old).values(target_key=new))


def save_page(db: Session, principal: Principal, data: PageIn, page: m.CmsPage | None = None) -> m.CmsPage:
    payload = data.model_dump(mode="json")
    validate_media_refs(db, {"sections": payload["sections"], "body": payload.get("body")})
    for s_index, section in enumerate(data.sections, start=1):
        for b_index, block in enumerate(section.blocks, start=1):
            if block.data.kind != "form":
                continue
            where = f"Section {s_index} › Bloc {b_index} (formulaire)"
            if not block.data.form_key:
                raise AppError(f"{where} : choisissez le formulaire à afficher.", code="UNKNOWN_FORM")
            if not db.execute(select(m.FormDefinition.id).where(m.FormDefinition.key == block.data.form_key)).first():
                raise AppError(
                    f"{where} : le formulaire « {block.data.form_key} » n'existe plus, choisissez-en un autre.",
                    code="UNKNOWN_FORM",
                )
    _check_page_address(db, data, page)
    if page is None:
        page = m.CmsPage(
            route_key=data.route_key, path=data.path, title=data.title, created_by_id=principal.id, status="draft"
        )
        db.add(page)
        db.flush()
        action = "CREATE"
    else:
        _guard_published_edit(principal, page)
        if data.path != page.path and page.status == "published":
            _auto_redirect(db, page.path, data.path, principal.id)
        if data.route_key != page.route_key:
            _rename_page_key(db, page.route_key, data.route_key)
        action = "UPDATE"
    page.route_key = data.route_key
    page.path = data.path
    page.title = data.title
    page.template = data.template
    page.summary = data.summary
    page.body = data.body
    page.sort_order = data.sort_order
    page.publish_at = data.publish_at
    page.unpublish_at = data.unpublish_at
    page.updated_by_id = principal.id
    page.sections.clear()
    db.flush()
    for s_index, section in enumerate(data.sections):
        sec = m.CmsSection(
            page_id=page.id,
            key=section.key,
            title=section.title,
            sort_order=s_index,
            settings=jsonable(section.settings),
            visible=section.visible,
        )
        for b_index, block in enumerate(section.blocks):
            block_data = block.data.model_dump(mode="json")
            sec.blocks.append(
                m.CmsBlock(kind=block_data["kind"], sort_order=b_index, data=block_data, visible=block.visible)
            )
        page.sections.append(sec)
    db.flush()
    if data.seo is not None:
        upsert_seo(db, "page", page.route_key, data.seo)
    add_revision(db, "page", page, principal.id)
    audit.record(
        db,
        family="business",
        module="cms",
        action=action,
        resource_type="cms_page",
        resource_id=page.id,
        diff={"route_key": page.route_key, "title": page.title, "sections": len(data.sections)},
    )
    _maybe_revalidate([page.path])
    return page


def _guard_published_edit(principal: Principal, obj: Any) -> None:
    if getattr(obj, "status", None) == "published" and not principal.has("cms:publish"):
        raise Forbidden(
            "Contenu publié : seule une personne habilitée à publier peut le modifier", code="PUBLISHED_CONTENT_LOCKED"
        )


def release_path(db: Session, path: str) -> None:
    """Un contenu reprend cette adresse : les redirections qui en partaient la masqueraient (ou boucleraient)."""
    for stale in db.execute(select(m.Redirect).where(m.Redirect.source_path == path)).scalars():
        if stale.auto_generated:
            db.delete(stale)
        else:
            stale.is_active = False
    db.flush()


def _auto_redirect(db: Session, old_path: str, new_path: str, user_id: uuid.UUID | None) -> None:
    if old_path == new_path:
        return
    release_path(db, new_path)
    existing = db.execute(select(m.Redirect).where(m.Redirect.source_path == old_path)).scalar_one_or_none()
    if existing is None:
        db.add(
            m.Redirect(
                source_path=old_path,
                target_path=new_path,
                status_code=301,
                auto_generated=True,
                note="Créée automatiquement (changement d'URL)",
                created_by_id=user_id,
            )
        )
    else:
        existing.target_path = new_path
        existing.status_code = 301
        existing.is_active = True
    # Évite les chaînes : les redirections qui pointaient vers l'ancien chemin visent le nouveau.
    for chained in db.execute(select(m.Redirect).where(m.Redirect.target_path == old_path)).scalars():
        if chained.source_path != new_path:
            chained.target_path = new_path


def transition(
    db: Session,
    principal: Principal,
    entity_type: str,
    obj: Any,
    target: str,
    *,
    note: str | None,
    publish_at: datetime | None = None,
    unpublish_at: datetime | None = None,
) -> Any:
    current = obj.status
    if current == target:
        return obj
    perm = TRANSITIONS.get((current, target))
    if perm is None:
        raise AppError(f"Transition {current} → {target} non autorisée", code="INVALID_TRANSITION")
    principal.require(perm)
    if target == "published":
        _check_publishable(db, entity_type, obj)
        if publish_at is not None:
            obj.publish_at = publish_at
        if unpublish_at is not None:
            obj.unpublish_at = unpublish_at
        obj.approved_by_id = principal.id
        obj.published_at = utcnow()
        live_path = public_path(db, entity_type, obj)
        if live_path:
            release_path(db, live_path)
    if target == "validated":
        obj.reviewed_by_id = principal.id
    if target == "archived":
        obj.archived_at = utcnow()
    obj.status = target
    obj.updated_by_id = principal.id
    db.flush()
    add_revision(db, entity_type, obj, principal.id, note=note or f"{current} → {target}")
    audit.record(
        db,
        family="business",
        module="cms",
        action="PUBLISH" if target == "published" else "TRANSITION",
        resource_type=entity_type,
        resource_id=obj.id,
        diff={"status": [current, target]},
        reason=note,
    )
    paths = [p for p in [public_path(db, entity_type, obj)] if p]
    _maybe_revalidate(paths or ["/"])
    return obj


def _check_publishable(db: Session, entity_type: str, obj: Any) -> None:
    """Garde-fous avant publication (pas de contenu vide, médias valides)."""
    data = {c.key: getattr(obj, c.key) for c in obj.__table__.columns}
    validate_media_refs(db, data)
    if isinstance(obj, m.CmsPage):
        has_content = bool(obj.body) or any(s.visible and s.blocks for s in obj.sections)
        if not has_content:
            raise AppError(
                "Page vide : ajoutez au moins une section avec un bloc avant de publier", code="EMPTY_CONTENT"
            )
    elif isinstance(obj, m.BlogPost) and not (obj.body_blocks and obj.title):
        raise AppError("Article vide : contenu requis avant publication", code="EMPTY_CONTENT")
    elif isinstance(obj, m.Offer):
        universe = db.get(m.Universe, obj.universe_id)
        if universe is None:
            raise AppError("Univers de l'offre introuvable")


def public_path(db: Session, entity_type: str, obj: Any) -> str | None:
    if entity_type == "page":
        return obj.path
    definition = COLLECTIONS.get(entity_type)
    if not definition or not definition.path_template:
        return None
    values = {"slug": getattr(obj, "slug", "")}
    if isinstance(obj, m.Offer):
        universe = db.get(m.Universe, obj.universe_id)
        values["universe_slug"] = universe.slug if universe else ""
    return definition.path_template.format(**values)


def refresh_site(paths: list[str] | None = None) -> None:
    """Révalidation du site public sans bloquer la requête d'édition (appel HTTP en tâche de fond)."""
    if settings.WEB_INTERNAL_URL and settings.REVALIDATE_SECRET:
        threading.Thread(target=_maybe_revalidate, args=(paths or ["/"],), daemon=True).start()


def _maybe_revalidate(paths: list[str]) -> None:
    if not settings.WEB_INTERNAL_URL or not settings.REVALIDATE_SECRET:
        return
    try:
        httpx.post(
            f"{settings.WEB_INTERNAL_URL.rstrip('/')}/api/revalidate",
            timeout=3,
            json={"paths": paths},
            headers={"x-revalidate-secret": settings.REVALIDATE_SECRET},
        )
    except httpx.HTTPError:
        log.debug("revalidate_failed")


def run_scheduled_publication(db: Session) -> dict[str, Any]:
    """Job : publications à échéance déjà validées et dépublications planifiées → archivage."""
    now = utcnow()
    published, archived = 0, 0
    models: list[tuple[str, Any]] = [("page", m.CmsPage)] + [(k, d.model) for k, d in COLLECTIONS.items()]
    for entity_type, model in models:
        for obj in db.execute(
            select(model).where(model.status == "validated", model.publish_at.is_not(None), model.publish_at <= now)
        ).scalars():
            obj.status = "published"
            obj.published_at = now
            add_revision(db, entity_type, obj, None, note="Publication planifiée")
            audit.record(
                db,
                family="business",
                module="cms",
                action="PUBLISH",
                resource_type=entity_type,
                resource_id=obj.id,
                actor_type="system",
                reason="Publication planifiée",
            )
            published += 1
        for obj in db.execute(
            select(model).where(model.status == "published", model.unpublish_at.is_not(None), model.unpublish_at <= now)
        ).scalars():
            obj.status = "archived"
            obj.archived_at = now
            add_revision(db, entity_type, obj, None, note="Dépublication planifiée")
            audit.record(
                db,
                family="business",
                module="cms",
                action="UNPUBLISH",
                resource_type=entity_type,
                resource_id=obj.id,
                actor_type="system",
                reason="Dépublication planifiée",
            )
            archived += 1
    db.flush()
    return {"items": published + archived, "published": published, "archived": archived}


# ---------------------------------------------------------------------------- rendu public
def _universe_card(db: Session, u: m.Universe, media: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(u.id),
        "key": u.key,
        "slug": u.slug,
        "name": u.name,
        "tagline": u.tagline,
        "promise": u.promise,
        "target": u.target,
        "mechanism": u.mechanism,
        "icon": u.icon,
        "accent": u.accent,
        "hero": media.get(str(u.hero_media_id)) if u.hero_media_id else None,
        "path": f"/offres/{u.slug}",
    }


def offer_payload(db: Session, o: m.Offer, media: dict[str, Any], universe: m.Universe | None = None) -> dict[str, Any]:
    universe = universe or db.get(m.Universe, o.universe_id)
    return {
        "id": str(o.id),
        "slug": o.slug,
        "name": o.name,
        "summary": o.summary,
        "description": o.description,
        "deliverables": o.deliverables,
        "steps": o.steps,
        "ideal_for": o.ideal_for,
        "price_hint": o.price_hint,
        "duration_hint": o.duration_hint,
        "icon": o.icon,
        "cta_label": o.cta_label,
        "media": media.get(str(o.media_id)) if o.media_id else None,
        "universe": {"key": universe.key, "slug": universe.slug, "name": universe.name} if universe else None,
        "path": f"/offres/{universe.slug}/{o.slug}" if universe else None,
    }


def project_card(p: m.PortfolioProject, media: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(p.id),
        "slug": p.slug,
        "title": p.title,
        "universe": p.universe,
        "category": p.category,
        "city": p.city,
        "country": p.country,
        "year": p.year,
        "surface_m2": p.surface_m2,
        "delivery_status": p.delivery_status,
        "summary": p.summary,
        "cover": media.get(str(p.cover_media_id)) if p.cover_media_id else None,
        "path": f"/projets/{p.slug}",
    }


def testimonial_payload(t: m.Testimonial, media: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(t.id),
        "author_name": t.author_name,
        "author_role": t.author_role,
        "location": t.location,
        "universe": t.universe,
        "quote": t.quote,
        "rating": t.rating,
        "photo": media.get(str(t.photo_media_id)) if t.photo_media_id else None,
        "video": media.get(str(t.video_media_id)) if t.video_media_id else None,
        "verified": bool(t.verified),
        "submitted_at": t.submitted_at,
    }


def blog_card(
    p: m.BlogPost,
    media: dict[str, Any],
    categories: dict[uuid.UUID, m.BlogCategory],
    authors: dict[uuid.UUID, m.BlogAuthor],
) -> dict[str, Any]:
    cat = categories.get(p.category_id) if p.category_id else None
    author = authors.get(p.author_id) if p.author_id else None
    return {
        "id": str(p.id),
        "slug": p.slug,
        "title": p.title,
        "excerpt": p.excerpt,
        "cover": media.get(str(p.cover_media_id)) if p.cover_media_id else None,
        "category": {"slug": cat.slug, "name": cat.name} if cat else None,
        "author": {"slug": author.slug, "name": author.name} if author else None,
        "published_at": p.published_at,
        "reading_minutes": p.reading_minutes,
        "tags": p.tags,
        "content_family": p.content_family,
        "like_count": p.like_count,
        "comment_count": p.comment_count,
        "view_count": p.view_count,
        "path": f"/blog/{p.slug}",
    }


def resolve_blocks(db: Session, blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Résout médias et références de collections pour un rendu complet en un appel."""
    from app.modules.cms.media import collect_media_ids

    media_ids: set[uuid.UUID] = set()
    for block in blocks:
        media_ids |= collect_media_ids(block)
    resolved: list[dict[str, Any]] = []
    for block in blocks:
        kind = block.get("kind")
        item: dict[str, Any] = {**block}
        ref = _resolve_ref(db, block)
        if ref is not None:
            item["items"] = ref["items"]
        resolved.append(item)
        if kind == "stats" and block.get("source") == "key_figures":
            figures = (
                db.execute(select(m.KeyFigure).where(*live_filter(m.KeyFigure)).order_by(m.KeyFigure.sort_order))
                .scalars()
                .all()
            )
            item["items"] = [
                {
                    "value": f.value,
                    "prefix": f.prefix,
                    "suffix": f.suffix,
                    "label": f.label,
                    "description": f.description,
                }
                for f in figures
            ]
        if kind == "contact_info" or kind == "map":
            item["site"] = public_site_contacts(db)
        if kind == "form":
            form = db.execute(
                select(m.FormDefinition).where(
                    m.FormDefinition.key == block.get("form_key"), m.FormDefinition.is_active.is_(True)
                )
            ).scalar_one_or_none()
            item["form"] = form_payload(form) if form else None
    media = load_media_map(db, media_ids)

    def attach(node: Any) -> Any:
        if isinstance(node, dict):
            out = {}
            for k, v in node.items():
                if k.endswith("media_id") and v:
                    out[k] = v
                    out[k[: -len("_id")] or "media"] = media.get(str(v))
                elif k.endswith("media_ids") and isinstance(v, list):
                    out[k] = v
                    out[k[: -len("_ids")] + "s"] = [media.get(str(x)) for x in v if media.get(str(x))]
                else:
                    out[k] = attach(v)
            return out
        if isinstance(node, list):
            return [attach(x) for x in node]
        return node

    return [attach(b) for b in resolved]


def _resolve_ref(db: Session, block: dict[str, Any]) -> dict[str, Any] | None:
    kind = block.get("kind")
    ids = [uuid.UUID(str(x)) for x in block.get("ids") or []]
    limit = int(block.get("limit") or 6)
    media_ids: set[uuid.UUID] = set()
    items: list[dict[str, Any]] = []
    if kind == "testimonials":
        stmt = select(m.Testimonial).where(*live_filter(m.Testimonial))
        if block.get("mode") == "ids" and ids:
            stmt = stmt.where(m.Testimonial.id.in_(ids))
        elif block.get("mode") == "universe" and block.get("universe"):
            stmt = stmt.where(m.Testimonial.universe == block["universe"])
        elif block.get("mode") == "featured":
            stmt = stmt.where(m.Testimonial.featured.is_(True))
        rows = db.execute(stmt.order_by(m.Testimonial.sort_order).limit(limit)).scalars().all()
        media_ids = {x for r in rows for x in (r.photo_media_id, r.video_media_id) if x}
        media = load_media_map(db, media_ids)
        items = [testimonial_payload(r, media) for r in rows]
    elif kind == "projects":
        stmt = select(m.PortfolioProject).where(*live_filter(m.PortfolioProject))
        if block.get("mode") == "ids" and ids:
            stmt = stmt.where(m.PortfolioProject.id.in_(ids))
        elif block.get("mode") == "universe" and block.get("universe"):
            stmt = stmt.where(m.PortfolioProject.universe == block["universe"])
        elif block.get("mode") == "featured":
            stmt = stmt.where(m.PortfolioProject.featured.is_(True))
        order = (
            m.PortfolioProject.published_at.desc() if block.get("mode") == "latest" else m.PortfolioProject.sort_order
        )
        rows = db.execute(stmt.order_by(order).limit(limit)).scalars().all()
        media_ids = {r.cover_media_id for r in rows if r.cover_media_id}
        media = load_media_map(db, media_ids)
        items = [project_card(r, media) for r in rows]
    elif kind == "universes":
        stmt = select(m.Universe).where(*live_filter(m.Universe))
        if block.get("keys"):
            stmt = stmt.where(m.Universe.key.in_(block["keys"]))
        rows = db.execute(stmt.order_by(m.Universe.sort_order)).scalars().all()
        media = load_media_map(db, {r.hero_media_id for r in rows if r.hero_media_id})
        items = [_universe_card(db, r, media) for r in rows]
    elif kind == "offers":
        stmt = (
            select(m.Offer, m.Universe)
            .join(m.Universe, m.Universe.id == m.Offer.universe_id)
            .where(*live_filter(m.Offer), *live_filter(m.Universe))
        )
        if ids:
            stmt = stmt.where(m.Offer.id.in_(ids))
        elif block.get("universe"):
            stmt = stmt.where(m.Universe.key == block["universe"])
        rows = db.execute(stmt.order_by(m.Universe.sort_order, m.Offer.sort_order)).all()
        media = load_media_map(db, {o.media_id for o, _ in rows if o.media_id})
        items = [offer_payload(db, o, media, u) for o, u in rows]
    elif kind in ("expertises", "services", "team", "partners", "certifications", "videos", "blog", "faq"):
        items, media_ids = _catalog(db, kind, block, ids, limit)
    else:
        return None
    return {"items": items, "media_ids": set()}


def _catalog(
    db: Session, kind: str, block: dict[str, Any], ids: list[uuid.UUID], limit: int
) -> tuple[list[dict[str, Any]], set[uuid.UUID]]:
    model = {
        "expertises": m.Expertise,
        "services": m.Service,
        "team": m.TeamMember,
        "partners": m.Partner,
        "certifications": m.Certification,
        "videos": m.Video,
        "blog": m.BlogPost,
        "faq": m.FaqItem,
    }[kind]
    stmt = select(model).where(*live_filter(model))
    if ids:
        stmt = stmt.where(model.id.in_(ids))
    if kind == "services" and block.get("category"):
        stmt = stmt.where(m.Service.category == block["category"])
    if kind == "team" and block.get("category"):
        stmt = stmt.where(m.TeamMember.group == block["category"])
    if kind == "partners" and block.get("category"):
        stmt = stmt.where(m.Partner.category == block["category"])
    if kind == "videos":
        if block.get("family"):
            stmt = stmt.where(m.Video.family == block["family"])
        if block.get("universe"):
            stmt = stmt.where(m.Video.universe == block["universe"])
    if kind == "faq" and block.get("universe"):
        stmt = stmt.where(m.FaqItem.universe == block["universe"])
    if kind == "faq" and block.get("category"):
        cat = db.execute(select(m.FaqCategory).where(m.FaqCategory.slug == block["category"])).scalar_one_or_none()
        stmt = stmt.where(m.FaqItem.category_id == (cat.id if cat else None))
    if kind == "blog":
        if block.get("category"):
            cat = db.execute(
                select(m.BlogCategory).where(m.BlogCategory.slug == block["category"])
            ).scalar_one_or_none()
            stmt = stmt.where(m.BlogPost.category_id == (cat.id if cat else None))
        if block.get("family"):
            stmt = stmt.where(m.BlogPost.content_family == block["family"])
        stmt = stmt.order_by(m.BlogPost.published_at.desc())
    else:
        stmt = stmt.order_by(model.sort_order)
    rows = db.execute(stmt.limit(limit)).scalars().all()
    from app.modules.cms.media import collect_media_ids

    media_ids: set[uuid.UUID] = set()
    for r in rows:
        media_ids |= collect_media_ids(
            {c.key: getattr(r, c.key) for c in model.__table__.columns if c.key.endswith("media_id")}
        )
    media = load_media_map(db, media_ids)
    if kind == "blog":
        cats = {c.id: c for c in db.execute(select(m.BlogCategory)).scalars()}
        authors = {a.id: a for a in db.execute(select(m.BlogAuthor)).scalars()}
        return [blog_card(r, media, cats, authors) for r in rows], media_ids
    return [collection_public_payload(db, kind, r, media) for r in rows], media_ids


def collection_public_payload(db: Session, kind: str, row: Any, media: dict[str, Any] | None = None) -> dict[str, Any]:
    if media is None:
        from app.modules.cms.media import collect_media_ids

        media = load_media_map(db, collect_media_ids({c.key: getattr(row, c.key) for c in row.__table__.columns}))
    hidden = {
        "created_by_id",
        "updated_by_id",
        "reviewed_by_id",
        "approved_by_id",
        "status",
        "revision",
        "publish_at",
        "unpublish_at",
        "archived_at",
        "created_at",
        "updated_at",
        "erp_project_id",
        "consent_reference",
        "source_note",
    }
    data: dict[str, Any] = {}
    for column in row.__table__.columns:
        key = column.key
        if key in hidden:
            continue
        value = getattr(row, key)
        if key.endswith("media_id"):
            data[key[: -len("_id")]] = media.get(str(value)) if value else None
        elif key.endswith("media_ids"):
            data[key[: -len("_ids")] + "s"] = [media.get(str(v)) for v in (value or []) if media.get(str(v))]
        else:
            data[key] = value
    if kind == "services":
        data["path"] = f"/services/{row.slug}"
    if kind == "expertises":
        data["path"] = f"/expertises/{row.slug}"
    if kind == "faq":
        data["answer"] = row.answer
    return jsonable(data)


def page_public_payload(db: Session, page: m.CmsPage) -> dict[str, Any]:
    blocks_by_section = []
    section_media = load_media_map(
        db,
        {
            uuid.UUID(str(s.settings["media_id"]))
            for s in page.sections
            if s.visible and isinstance(s.settings, dict) and s.settings.get("media_id")
        },
    )
    for section in page.sections:
        if not section.visible:
            continue
        blocks = [b.data for b in section.blocks if b.visible]
        if not blocks:
            continue
        blocks_by_section.append(
            {
                "key": section.key,
                "title": section.title,
                "settings": {
                    **(section.settings or {}),
                    "media": section_media.get(str((section.settings or {}).get("media_id"))),
                },
                "blocks": resolve_blocks(db, blocks),
            }
        )
    markups = (
        db.execute(
            select(m.SchemaMarkup).where(
                m.SchemaMarkup.target_type == "page",
                m.SchemaMarkup.target_key == page.route_key,
                m.SchemaMarkup.enabled.is_(True),
            )
        )
        .scalars()
        .all()
    )
    return {
        "route_key": page.route_key,
        "path": page.path,
        "title": page.title,
        "template": page.template,
        "summary": page.summary,
        "body": page.body,
        "sections": blocks_by_section,
        "seo": seo_payload(db, get_seo(db, "page", page.route_key)),
        "schema_markup": [{"type": s.schema_type, "data": s.data} for s in markups],
        "published_at": page.published_at,
        "updated_at": page.updated_at,
    }


def public_site_contacts(db: Session) -> dict[str, Any]:
    site = db.execute(select(m.SiteSettings).limit(1)).scalar_one_or_none()
    if site is None:
        return {}
    return {
        "company_name": site.company_name,
        "email": site.email,
        "phone": site.phone,
        "whatsapp": site.whatsapp,
        "address": site.address,
        "city": site.city,
        "country": site.country,
        "latitude": site.latitude,
        "longitude": site.longitude,
        "opening_hours": site.opening_hours,
        "google_business_url": site.google_business_url,
    }


def form_payload(form: m.FormDefinition) -> dict[str, Any]:
    return {
        "key": form.key,
        "title": form.title,
        "description": form.description,
        "fields": form.fields,
        "consents": form.consents,
        "success_message": form.success_message,
        "min_fill_seconds": form.min_fill_seconds,
    }


def site_payload(db: Session) -> dict[str, Any]:
    site = db.execute(select(m.SiteSettings).limit(1)).scalar_one_or_none()
    menus = db.execute(select(m.NavigationMenu)).scalars().all()
    pages = {p.route_key: p for p in db.execute(select(m.CmsPage).where(*live_filter(m.CmsPage))).scalars()}

    def items(menu: m.NavigationMenu) -> list[dict[str, Any]]:
        by_parent: dict[uuid.UUID | None, list[m.NavigationItem]] = {}
        for item in menu.items:
            if item.visible:
                by_parent.setdefault(item.parent_id, []).append(item)

        def build(parent: uuid.UUID | None) -> list[dict[str, Any]]:
            out = []
            for it in sorted(by_parent.get(parent, []), key=lambda x: x.sort_order):
                if it.link_type == "page":
                    page = pages.get(it.page_route_key or "")
                    if page is None:
                        continue  # page non publiée : lien masqué
                    href = page.path
                else:
                    href = it.url
                out.append(
                    {
                        "label": it.label,
                        "href": href,
                        "description": it.description,
                        "icon": it.icon,
                        "open_new_tab": it.open_new_tab,
                        "highlight": it.highlight,
                        "children": build(it.id),
                    }
                )
            return out

        return build(None)

    socials = (
        db.execute(select(m.SocialLink).where(m.SocialLink.is_active.is_(True)).order_by(m.SocialLink.sort_order))
        .scalars()
        .all()
    )
    banners = db.execute(select(m.Banner).where(*live_filter(m.Banner)).order_by(m.Banner.sort_order)).scalars().all()
    site_media = (
        [site.logo_media_id, site.logo_dark_media_id, site.favicon_media_id, site.default_og_media_id] if site else []
    )
    media_ids = {x for x in site_media if x} | {b.media_id for b in banners if b.media_id}
    media = load_media_map(db, media_ids)
    tracking = (site.tracking if site else {}) or {}
    return {
        "company_name": site.company_name if site else None,
        "slogan": site.slogan if site else None,
        "promise": site.promise if site else None,
        "contacts": public_site_contacts(db),
        "legal_info": site.legal_info if site else {},
        "logo": media.get(str(site.logo_media_id)) if site and site.logo_media_id else None,
        "logo_dark": media.get(str(site.logo_dark_media_id)) if site and site.logo_dark_media_id else None,
        "favicon": media.get(str(site.favicon_media_id)) if site and site.favicon_media_id else None,
        # Icône unique de la plateforme (favicon, PWA, assistant…), versionnée.
        "brand": brand_payload(db),
        "default_og_image": media.get(str(site.default_og_media_id)) if site and site.default_og_media_id else None,
        "seo_title_template": site.seo_title_template if site else "%s",
        "default_meta_description": site.default_meta_description if site else None,
        "search_console_verification": site.search_console_verification if site else None,
        "tracking": {
            k: v
            for k, v in tracking.items()
            if k in ("ga4_id", "gads_id", "gads_labels", "meta_pixel", "tiktok_pixel", "linkedin_partner")
        },
        "consent": {
            "texts": site.consent_texts if site else {},
            "policy_version": site.consent_policy_version if site else "1",
        },
        "menus": {menu.key: {"title": menu.title, "items": items(menu)} for menu in menus},
        "socials": [{"network": s.network, "url": s.url, "label": s.label} for s in socials],
        "banners": [
            {
                "key": b.key,
                "kind": b.kind,
                "title": b.title,
                "content": b.content,
                "cta_label": b.cta_label,
                "cta_href": b.cta_href,
                "media": media.get(str(b.media_id)) if b.media_id else None,
                "route_keys": b.route_keys,
                "position": b.position,
                "frequency": b.frequency,
                "delay_seconds": b.delay_seconds,
                "dismissible": b.dismissible,
            }
            for b in banners
        ],
        "pages": {k: p.path for k, p in pages.items()},
        "reviews": _reviews_summary(db),
    }


def _reviews_summary(db: Session) -> dict[str, Any]:
    from app.modules.reviews.service import summary

    return summary(db)


def sitemap_entries(db: Session) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for page in db.execute(select(m.CmsPage).where(*live_filter(m.CmsPage))).scalars():
        seo = get_seo(db, "page", page.route_key)
        if seo and not seo.robots_index:
            continue
        entries.append(
            {
                "path": page.path,
                "lastmod": page.updated_at,
                "priority": float(seo.sitemap_priority) if seo else (1.0 if page.path == "/" else 0.7),
                "changefreq": seo.sitemap_changefreq if seo else "weekly",
            }
        )
    for key, definition in COLLECTIONS.items():
        if not definition.path_template:
            continue
        for row in db.execute(select(definition.model).where(*live_filter(definition.model))).scalars():
            seo = get_seo(db, definition.seo_type or key, str(row.id))
            if seo and not seo.robots_index:
                continue
            path = public_path(db, key, row)
            if path:
                entries.append(
                    {
                        "path": path,
                        "lastmod": row.updated_at,
                        "priority": float(seo.sitemap_priority) if seo else 0.6,
                        "changefreq": seo.sitemap_changefreq if seo else "monthly",
                    }
                )
    return entries


def robots_payload(db: Session) -> dict[str, Any]:
    site = db.execute(select(m.SiteSettings).limit(1)).scalar_one_or_none()
    disallow = [
        "/erp",
        "/espace-client",
        "/extranet",
        "/api/",
        "/connexion",
        "/inscription",
        "/mot-de-passe-oublie",
        "/reset",
        "/paiement",
        "/verification",
    ]
    return {
        "disallow": disallow,
        "extra": site.robots_extra if site else None,
        "sitemap": f"{settings.PUBLIC_BASE_URL.rstrip('/')}/sitemap.xml",
        "allow_indexing": settings.is_production,
    }


def redirect_map(db: Session) -> list[dict[str, Any]]:
    rows = db.execute(select(m.Redirect).where(m.Redirect.is_active.is_(True))).scalars().all()
    return [{"source": r.source_path, "target": r.target_path, "status": r.status_code} for r in rows]


def get_collection(key: str) -> CollectionDef:
    definition = COLLECTIONS.get(key)
    if definition is None:
        raise NotFound("Collection inconnue")
    return definition


__all__ = ["COLLECTIONS", "TAXONOMIES", "media_payload"]
