"""Charges utiles des pages de détail publiques (univers, offres, expertises, services, réalisations, articles,
aide) et des cartes de collections.

Une seule implémentation sert les pages publiques (contenu publié) et l'aperçu de l'administration (contenu en
cours d'édition) : l'aperçu montre exactement ce que le site affichera. Les éléments liés (offres d'un univers,
articles connexes…) restent filtrés sur le contenu publié.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import sign_payload, verify_signed_payload
from app.core.utils import jsonable
from app.modules.cms import models as m
from app.modules.cms import service
from app.modules.cms.media import load_media_map

PREVIEW_TTL_SECONDS = 30 * 60


def comment_tree(db: Session, post_id: uuid.UUID) -> list[dict[str, Any]]:
    rows = (
        db.execute(
            select(m.BlogComment)
            .where(m.BlogComment.post_id == post_id, m.BlogComment.status == "approved")
            .order_by(m.BlogComment.created_at)
        )
        .scalars()
        .all()
    )
    by_parent: dict[uuid.UUID | None, list[m.BlogComment]] = {}
    for r in rows:
        by_parent.setdefault(r.parent_id, []).append(r)

    def build(parent: uuid.UUID | None) -> list[dict[str, Any]]:
        return [
            {
                "id": c.id,
                "author_name": c.author_name,
                "content": c.content,
                "is_staff": c.is_staff,
                "like_count": c.like_count,
                "created_at": c.created_at,
                "replies": build(c.id),
            }
            for c in by_parent.get(parent, [])
        ]

    return build(None)


# ---------------------------------------------------------------------------- détails
def universe_detail(db: Session, row: m.Universe) -> dict[str, Any]:
    offers = (
        db.execute(
            select(m.Offer)
            .where(m.Offer.universe_id == row.id, *service.live_filter(m.Offer))
            .order_by(m.Offer.sort_order)
        )
        .scalars()
        .all()
    )
    media = load_media_map(db, {x for x in [row.hero_media_id] + [o.media_id for o in offers] if x})
    payload = service._universe_card(db, row, media)
    payload.update(
        description=row.description,
        prospect_wants=row.prospect_wants,
        funnel=row.funnel,
        body_blocks=service.resolve_blocks(db, row.body_blocks or []),
        offers=[service.offer_payload(db, o, media, row) for o in offers],
        seo=service.seo_payload(db, service.get_seo(db, "universe", str(row.id))),
    )
    return jsonable(payload)


def offer_detail(db: Session, row: m.Offer, universe_row: m.Universe) -> dict[str, Any]:
    media = load_media_map(db, {row.media_id} if row.media_id else set())
    payload = service.offer_payload(db, row, media, universe_row)
    payload["body_blocks"] = service.resolve_blocks(db, row.body_blocks or [])
    payload["seo"] = service.seo_payload(db, service.get_seo(db, "offer", str(row.id)))
    return jsonable(payload)


def simple_detail(db: Session, kind: str, row: Any, seo_type: str) -> dict[str, Any]:
    payload = service.collection_public_payload(db, kind, row)
    payload["body_blocks"] = service.resolve_blocks(db, getattr(row, "body_blocks", None) or [])
    payload["seo"] = service.seo_payload(db, service.get_seo(db, seo_type, str(row.id)))
    return jsonable(payload)


def service_detail(db: Session, row: m.Service) -> dict[str, Any]:
    payload = simple_detail(db, "services", row, "service")
    if row.related_offer_ids:
        offers = (
            db.execute(
                select(m.Offer).where(
                    m.Offer.id.in_([uuid.UUID(str(x)) for x in row.related_offer_ids]), *service.live_filter(m.Offer)
                )
            )
            .scalars()
            .all()
        )
        media = load_media_map(db, {o.media_id for o in offers if o.media_id})
        payload["related_offers"] = [service.offer_payload(db, o, media) for o in offers]
    if row.faq_item_ids:
        faqs = (
            db.execute(
                select(m.FaqItem).where(
                    m.FaqItem.id.in_([uuid.UUID(str(x)) for x in row.faq_item_ids]), *service.live_filter(m.FaqItem)
                )
            )
            .scalars()
            .all()
        )
        payload["faq"] = [{"id": f.id, "question": f.question, "answer": f.answer} for f in faqs]
    return jsonable(payload)


def project_detail(db: Session, row: m.PortfolioProject) -> dict[str, Any]:
    payload = service.collection_public_payload(db, "projects", row)
    before_after_ids = {
        uuid.UUID(str(x[k]))
        for x in (row.before_after or [])
        for k in ("before_media_id", "after_media_id")
        if x.get(k)
    }
    media = load_media_map(db, before_after_ids)
    payload["before_after"] = [
        {
            "before": media.get(str(x.get("before_media_id"))),
            "after": media.get(str(x.get("after_media_id"))),
            "caption": x.get("caption"),
        }
        for x in (row.before_after or [])
    ]
    payload["body_blocks"] = service.resolve_blocks(db, row.body_blocks or [])
    if row.testimonial_id:
        t = db.get(m.Testimonial, row.testimonial_id)
        if t and service.is_live(t):
            tm = load_media_map(db, {x for x in (t.photo_media_id, t.video_media_id) if x})
            payload["testimonial"] = service.testimonial_payload(t, tm)
    payload["seo"] = service.seo_payload(db, service.get_seo(db, "project", str(row.id)))
    related = (
        db.execute(
            select(m.PortfolioProject)
            .where(
                *service.live_filter(m.PortfolioProject),
                m.PortfolioProject.id != row.id,
                m.PortfolioProject.universe == row.universe,
            )
            .order_by(m.PortfolioProject.sort_order)
            .limit(3)
        )
        .scalars()
        .all()
    )
    rel_media = load_media_map(db, {p.cover_media_id for p in related if p.cover_media_id})
    payload["related"] = [service.project_card(p, rel_media) for p in related]
    return jsonable(payload)


def blog_detail(db: Session, row: m.BlogPost) -> dict[str, Any]:
    media = load_media_map(db, {row.cover_media_id} if row.cover_media_id else set())
    cats = {c.id: c for c in db.execute(select(m.BlogCategory)).scalars()}
    authors = {a.id: a for a in db.execute(select(m.BlogAuthor)).scalars()}
    payload = service.blog_card(row, media, cats, authors)
    author = authors.get(row.author_id) if row.author_id else None
    if author:
        am = load_media_map(db, {author.photo_media_id} if author.photo_media_id else set())
        payload["author"] = {
            "slug": author.slug,
            "name": author.name,
            "title": author.title,
            "bio": author.bio,
            "linkedin_url": author.linkedin_url,
            "photo": am.get(str(author.photo_media_id)) if author.photo_media_id else None,
        }
    payload.update(
        body_blocks=service.resolve_blocks(db, row.body_blocks or []),
        allow_comments=row.allow_comments,
        share_count=row.share_count,
        comments=comment_tree(db, row.id),
        seo=service.seo_payload(db, service.get_seo(db, "blog_post", str(row.id))),
    )
    related = (
        db.execute(
            select(m.BlogPost)
            .where(*service.live_filter(m.BlogPost), m.BlogPost.id != row.id, m.BlogPost.category_id == row.category_id)
            .order_by(m.BlogPost.published_at.desc())
            .limit(3)
        )
        .scalars()
        .all()
    )
    rel_media = load_media_map(db, {p.cover_media_id for p in related if p.cover_media_id})
    payload["related"] = [service.blog_card(p, rel_media, cats, authors) for p in related]
    return jsonable(payload)


def detail_payload(db: Session, key: str, row: Any) -> dict[str, Any] | None:
    """Page de détail publique d'un élément de collection (None : la collection n'a pas de page dédiée)."""
    if key == "universes":
        return universe_detail(db, row)
    if key == "offers":
        universe_row = db.get(m.Universe, row.universe_id)
        return offer_detail(db, row, universe_row) if universe_row else None
    if key == "expertises":
        return simple_detail(db, "expertises", row, "expertise")
    if key == "services":
        return service_detail(db, row)
    if key == "projects":
        return project_detail(db, row)
    if key == "blog_posts":
        return blog_detail(db, row)
    if key == "help_articles":
        return simple_detail(db, "help_articles", row, "help_article")
    return None


# ---------------------------------------------------------------------------- cartes (listes et blocs)
_CATALOG_KINDS = {
    "expertises": "expertises",
    "services": "services",
    "team_members": "team",
    "partners": "partners",
    "certifications": "certifications",
    "videos": "videos",
    "faq_items": "faq",
}


def card_payload(db: Session, key: str, row: Any) -> tuple[str, dict[str, Any]] | None:
    """(type de bloc du site, élément) tel qu'il apparaît dans les listes et blocs des pages."""
    from app.modules.cms.media import collect_media_ids

    media = load_media_map(
        db, collect_media_ids({c.key: getattr(row, c.key) for c in row.__table__.columns if "media_id" in c.key})
    )
    if key == "universes":
        return "universes", jsonable(service._universe_card(db, row, media))
    if key == "offers":
        return "offers", jsonable(service.offer_payload(db, row, media, db.get(m.Universe, row.universe_id)))
    if key == "projects":
        return "projects", jsonable(service.project_card(row, media))
    if key == "blog_posts":
        cats = {c.id: c for c in db.execute(select(m.BlogCategory)).scalars()}
        authors = {a.id: a for a in db.execute(select(m.BlogAuthor)).scalars()}
        return "blog", jsonable(service.blog_card(row, media, cats, authors))
    if key == "testimonials":
        return "testimonials", jsonable(service.testimonial_payload(row, media))
    if key == "key_figures":
        item = {"value": row.value, "prefix": row.prefix, "suffix": row.suffix, "label": row.label}
        return "stats", jsonable({**item, "description": row.description})
    if key in _CATALOG_KINDS:
        kind = _CATALOG_KINDS[key]
        return kind, jsonable(service.collection_public_payload(db, kind, row, media))
    if key == "banners":
        return "banner", jsonable(service.collection_public_payload(db, "banners", row, media))
    return None


# ---------------------------------------------------------------------------- jeton d'aperçu
def preview_token(key: str, item_id: uuid.UUID) -> str:
    return sign_payload({"purpose": "cms_preview", "k": key, "i": str(item_id)}, PREVIEW_TTL_SECONDS)


def read_preview_token(token: str) -> tuple[str, uuid.UUID] | None:
    data = verify_signed_payload(token)
    if not data or data.get("purpose") != "cms_preview":
        return None
    try:
        return str(data["k"]), uuid.UUID(str(data["i"]))
    except (KeyError, ValueError):
        return None
