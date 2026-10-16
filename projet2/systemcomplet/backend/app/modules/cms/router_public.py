"""API publique de la vitrine (lecture seule des contenus publiés + interactions blog).

Règle Zero Hardcode : uniquement des contenus publiés en base ; une base vide renvoie des listes vides
ou 404 (état vide explicite côté site).
"""

from __future__ import annotations

import hashlib
import time
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.errors import AppError, NotFound
from app.core.middleware import client_ip
from app.core.pagination import PageParams, paginate
from app.core.ratelimit import rate_limit
from app.core.storage import public_storage
from app.core.utils import jsonable, utcnow
from app.modules.cms import brand as brand_svc
from app.modules.cms import details, service
from app.modules.cms import models as m
from app.modules.cms.media import load_media_map
from app.modules.cms.schemas import CommentIn, FeedbackIn, ShareIn

router = APIRouter(prefix="/public", tags=["Vitrine (public)"])

CACHE_SHORT = "public, max-age=30, stale-while-revalidate=120"


def _cache(response: Response, value: str = CACHE_SHORT) -> None:
    response.headers["Cache-Control"] = value


def visitor_hash(request: Request) -> str:
    """Empreinte visiteur non réversible, salée quotidiennement (pas d'IP brute stockée)."""
    from app.modules.analytics.service import daily_salt

    raw = f"{client_ip(request.scope) or ''}|{request.headers.get('user-agent', '')}"
    return hashlib.sha256((daily_salt() + raw).encode()).hexdigest()


# ---------------------------------------------------------------------------- site & pages
@router.get("/site")
def site(response: Response, db: Session = Depends(get_db)) -> dict[str, Any]:
    _cache(response)
    return jsonable(service.site_payload(db))


# ---------------------------------------------------------------------------- icône unique de la plateforme
@router.get("/brand")
def brand(response: Response, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Identité visuelle : icônes versionnées (favicon, PWA, iOS, assistant) — aussi pour les applications natives."""
    _cache(response)
    return brand_svc.brand_payload(db)


@router.get("/brand/{name}")
def brand_icon(name: str, v: str | None = None, db: Session = Depends(get_db)) -> FileResponse:
    path, mime, version = brand_svc.variant_file(db, name)
    return FileResponse(
        str(path),
        media_type=mime,
        headers={
            # URL versionnée (?v=) : immuable ; sans version : courte durée pour suivre un changement d'icône.
            "Cache-Control": "public, max-age=31536000, immutable" if v == version else "public, max-age=300",
            "ETag": f'"{version}-{name}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/pages/{route_key}")
def page(route_key: str, response: Response, db: Session = Depends(get_db)) -> dict[str, Any]:
    row = db.execute(
        select(m.CmsPage).where(m.CmsPage.route_key == route_key, *service.live_filter(m.CmsPage))
    ).scalar_one_or_none()
    if row is None:
        raise NotFound("Page non publiée")
    _cache(response)
    return jsonable(service.page_public_payload(db, row))


@router.get("/resolve")
def resolve_path(path: str = Query(..., max_length=500), db: Session = Depends(get_db)) -> dict[str, Any]:
    """Résolution d'un chemin libre (pages CMS personnalisées) ou d'une redirection."""
    clean = "/" + path.strip("/") if path != "/" else "/"
    redirect = db.execute(
        select(m.Redirect).where(m.Redirect.source_path == clean, m.Redirect.is_active.is_(True))
    ).scalar_one_or_none()
    if redirect:
        redirect.hits += 1
        redirect.last_hit_at = utcnow()
        db.commit()
        return {"type": "redirect", "target": redirect.target_path, "status": redirect.status_code}
    row = db.execute(
        select(m.CmsPage).where(m.CmsPage.path == clean, *service.live_filter(m.CmsPage))
    ).scalar_one_or_none()
    if row is None:
        raise NotFound("Aucun contenu publié à cette adresse")
    return {"type": "page", "page": jsonable(service.page_public_payload(db, row))}


@router.get("/redirects")
def redirects(response: Response, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    _cache(response, "public, max-age=60")
    return service.redirect_map(db)


@router.post("/redirects/hit")
def redirect_hit(data: dict[str, str], db: Session = Depends(get_db)) -> dict[str, str]:
    row = db.execute(select(m.Redirect).where(m.Redirect.source_path == data.get("source", ""))).scalar_one_or_none()
    if row:
        row.hits += 1
        row.last_hit_at = utcnow()
        db.commit()
    return {"status": "ok"}


@router.get("/sitemap")
def sitemap(response: Response, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    _cache(response, "public, max-age=300")
    return jsonable(service.sitemap_entries(db))


@router.get("/robots")
def robots(response: Response, db: Session = Depends(get_db)) -> dict[str, Any]:
    _cache(response, "public, max-age=300")
    return service.robots_payload(db)


@router.get("/forms/{key}")
def form_definition(key: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    form = db.execute(
        select(m.FormDefinition).where(m.FormDefinition.key == key, m.FormDefinition.is_active.is_(True))
    ).scalar_one_or_none()
    if form is None:
        raise NotFound("Formulaire indisponible")
    return {**service.form_payload(form), "rendered_at": int(time.time())}


# ---------------------------------------------------------------------------- univers & offres
@router.get("/universes")
def universes(response: Response, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    rows = (
        db.execute(select(m.Universe).where(*service.live_filter(m.Universe)).order_by(m.Universe.sort_order))
        .scalars()
        .all()
    )
    media = load_media_map(db, {r.hero_media_id for r in rows if r.hero_media_id})
    _cache(response)
    return jsonable([service._universe_card(db, r, media) for r in rows])


@router.get("/universes/{slug}")
def universe(slug: str, response: Response, db: Session = Depends(get_db)) -> dict[str, Any]:
    row = db.execute(
        select(m.Universe).where(m.Universe.slug == slug, *service.live_filter(m.Universe))
    ).scalar_one_or_none()
    if row is None:
        raise NotFound("Univers introuvable")
    _cache(response)
    return details.universe_detail(db, row)


@router.get("/offers/{slug}")
def offer(slug: str, response: Response, db: Session = Depends(get_db)) -> dict[str, Any]:
    row = db.execute(select(m.Offer).where(m.Offer.slug == slug, *service.live_filter(m.Offer))).scalar_one_or_none()
    if row is None:
        raise NotFound("Offre introuvable")
    universe_row = db.get(m.Universe, row.universe_id)
    if universe_row is None or not service.is_live(universe_row):
        raise NotFound("Offre introuvable")
    _cache(response)
    return details.offer_detail(db, row, universe_row)


# ---------------------------------------------------------------------------- expertises & services
def _simple_list(db: Session, kind: str, model: Any, extra: list[Any] | None = None) -> list[dict[str, Any]]:
    rows = (
        db.execute(select(model).where(*service.live_filter(model), *(extra or [])).order_by(model.sort_order))
        .scalars()
        .all()
    )
    return [service.collection_public_payload(db, kind, r) for r in rows]


def _detail(db: Session, kind: str, model: Any, slug: str, seo_type: str) -> dict[str, Any]:
    row = db.execute(select(model).where(model.slug == slug, *service.live_filter(model))).scalar_one_or_none()
    if row is None:
        raise NotFound("Contenu introuvable")
    return details.simple_detail(db, kind, row, seo_type)


@router.get("/expertises")
def expertises(response: Response, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    _cache(response)
    return jsonable(_simple_list(db, "expertises", m.Expertise))


@router.get("/expertises/{slug}")
def expertise(slug: str, response: Response, db: Session = Depends(get_db)) -> dict[str, Any]:
    _cache(response)
    return jsonable(_detail(db, "expertises", m.Expertise, slug, "expertise"))


@router.get("/services")
def services(response: Response, category: str | None = None, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    _cache(response)
    extra = [m.Service.category == category] if category else []
    return jsonable(_simple_list(db, "services", m.Service, extra))


@router.get("/services/{slug}")
def service_detail(slug: str, response: Response, db: Session = Depends(get_db)) -> dict[str, Any]:
    row = db.execute(
        select(m.Service).where(m.Service.slug == slug, *service.live_filter(m.Service))
    ).scalar_one_or_none()
    if row is None:
        raise NotFound("Contenu introuvable")
    _cache(response)
    return details.service_detail(db, row)


# ---------------------------------------------------------------------------- projets (portfolio)
@router.get("/projects")
def projects(
    params: PageParams = Depends(),
    universe: str | None = None,
    category: str | None = None,
    city: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(m.PortfolioProject).where(*service.live_filter(m.PortfolioProject))
    if universe:
        stmt = stmt.where(m.PortfolioProject.universe == universe)
    if category:
        stmt = stmt.where(m.PortfolioProject.category == category)
    if city:
        stmt = stmt.where(m.PortfolioProject.city == city)
    if status:
        stmt = stmt.where(m.PortfolioProject.delivery_status == status)
    result = paginate(
        db,
        stmt,
        params,
        sort_fields={"year": m.PortfolioProject.year, "title": m.PortfolioProject.title},
        default_sort=m.PortfolioProject.sort_order,
        search_columns=[m.PortfolioProject.title, m.PortfolioProject.city],
    )
    media = load_media_map(db, {p.cover_media_id for p in result["items"] if p.cover_media_id})
    result["items"] = [service.project_card(p, media) for p in result["items"]]
    facets = db.execute(
        select(m.PortfolioProject.universe, m.PortfolioProject.category, m.PortfolioProject.city).where(
            *service.live_filter(m.PortfolioProject)
        )
    ).all()
    result["facets"] = {
        "universes": sorted({f[0] for f in facets if f[0]}),
        "categories": sorted({f[1] for f in facets if f[1]}),
        "cities": sorted({f[2] for f in facets if f[2]}),
    }
    return jsonable(result)


@router.get("/projects/{slug}")
def project(slug: str, response: Response, db: Session = Depends(get_db)) -> dict[str, Any]:
    row = db.execute(
        select(m.PortfolioProject).where(m.PortfolioProject.slug == slug, *service.live_filter(m.PortfolioProject))
    ).scalar_one_or_none()
    if row is None:
        raise NotFound("Projet introuvable")
    _cache(response)
    return details.project_detail(db, row)


# ---------------------------------------------------------------------------- blog
@router.get("/blog/categories")
def blog_categories(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    rows = db.execute(
        select(m.BlogCategory, func.count(m.BlogPost.id))
        .join(
            m.BlogPost, (m.BlogPost.category_id == m.BlogCategory.id) & (m.BlogPost.status == "published"), isouter=True
        )
        .group_by(m.BlogCategory.id)
        .order_by(m.BlogCategory.sort_order)
    ).all()
    return [{"slug": c.slug, "name": c.name, "description": c.description, "count": n} for c, n in rows]


@router.get("/blog/posts")
def blog_posts(
    params: PageParams = Depends(),
    category: str | None = None,
    tag: str | None = None,
    author: str | None = None,
    family: str | None = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(m.BlogPost).where(*service.live_filter(m.BlogPost))
    if category:
        cat = db.execute(select(m.BlogCategory).where(m.BlogCategory.slug == category)).scalar_one_or_none()
        stmt = stmt.where(m.BlogPost.category_id == (cat.id if cat else None))
    if author:
        a = db.execute(select(m.BlogAuthor).where(m.BlogAuthor.slug == author)).scalar_one_or_none()
        stmt = stmt.where(m.BlogPost.author_id == (a.id if a else None))
    if tag:
        stmt = stmt.where(m.BlogPost.tags.contains([tag]))
    if family:
        stmt = stmt.where(m.BlogPost.content_family == family)
    result = paginate(
        db,
        stmt,
        params,
        sort_fields={"published_at": m.BlogPost.published_at, "views": m.BlogPost.view_count},
        default_sort=m.BlogPost.published_at.desc(),
        search_columns=[m.BlogPost.title, m.BlogPost.excerpt],
    )
    media = load_media_map(db, {p.cover_media_id for p in result["items"] if p.cover_media_id})
    cats = {c.id: c for c in db.execute(select(m.BlogCategory)).scalars()}
    authors = {a.id: a for a in db.execute(select(m.BlogAuthor)).scalars()}
    result["items"] = [service.blog_card(p, media, cats, authors) for p in result["items"]]
    return jsonable(result)


@router.get("/blog/posts/{slug}")
def blog_post(slug: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    row = db.execute(
        select(m.BlogPost).where(m.BlogPost.slug == slug, *service.live_filter(m.BlogPost))
    ).scalar_one_or_none()
    if row is None:
        raise NotFound("Article introuvable")
    return details.blog_detail(db, row)


@router.post("/blog/posts/{slug}/view")
def blog_view(
    slug: str, request: Request, db: Session = Depends(get_db), _: None = Depends(rate_limit("blog_view", "120/minute"))
) -> dict[str, Any]:
    row = db.execute(select(m.BlogPost).where(m.BlogPost.slug == slug)).scalar_one_or_none()
    if row is None:
        raise NotFound("Article introuvable")
    row.view_count += 1
    db.commit()
    return {"views": row.view_count}


@router.post("/blog/posts/{slug}/comments", status_code=201)
def blog_comment(
    slug: str,
    data: CommentIn,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit("blog_comment", "10/hour")),
) -> dict[str, Any]:
    row = db.execute(
        select(m.BlogPost).where(m.BlogPost.slug == slug, *service.live_filter(m.BlogPost))
    ).scalar_one_or_none()
    if row is None or not row.allow_comments:
        raise NotFound("Commentaires fermés")
    if data.website:  # pot de miel rempli → robot
        return {"status": "pending"}
    if data.rendered_at and time.time() - data.rendered_at < 3:
        raise AppError("Envoi trop rapide", code="BOT_SUSPECTED")
    if data.parent_id:
        parent = db.get(m.BlogComment, data.parent_id)
        if parent is None or parent.post_id != row.id:
            raise AppError("Commentaire parent invalide")
    links = data.content.count("http")
    comment = m.BlogComment(
        post_id=row.id,
        parent_id=data.parent_id,
        author_name=data.author_name.strip(),
        author_email=data.author_email,
        content=data.content.strip(),
        status="spam" if links > 2 else "pending",
        ip_hash=visitor_hash(request),
    )
    db.add(comment)
    from app.modules.analytics.service import record_server_event

    record_server_event(
        db,
        "blog_comment" if not data.parent_id else "blog_reply",
        path=f"/blog/{slug}",
        content_type="blog_post",
        content_id=str(row.id),
    )
    db.commit()
    return {"status": "pending", "message": "Merci ! Votre commentaire sera publié après modération."}


@router.post("/blog/posts/{slug}/like")
def blog_like(
    slug: str, request: Request, db: Session = Depends(get_db), _: None = Depends(rate_limit("blog_like", "60/hour"))
) -> dict[str, Any]:
    row = db.execute(
        select(m.BlogPost).where(m.BlogPost.slug == slug, *service.live_filter(m.BlogPost))
    ).scalar_one_or_none()
    if row is None:
        raise NotFound("Article introuvable")
    vh = visitor_hash(request)
    existing = db.execute(
        select(m.BlogReaction).where(
            m.BlogReaction.post_id == row.id, m.BlogReaction.visitor_hash == vh, m.BlogReaction.comment_id.is_(None)
        )
    ).scalar_one_or_none()
    if existing:
        db.delete(existing)
        row.like_count = max(0, row.like_count - 1)
        liked = False
    else:
        db.add(m.BlogReaction(post_id=row.id, visitor_hash=vh, kind="like"))
        row.like_count += 1
        liked = True
        from app.modules.analytics.service import record_server_event

        record_server_event(db, "blog_like", path=f"/blog/{slug}", content_type="blog_post", content_id=str(row.id))
    db.commit()
    return {"liked": liked, "like_count": row.like_count}


@router.post("/blog/comments/{comment_id}/like")
def comment_like(
    comment_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit("comment_like", "60/hour")),
) -> dict[str, Any]:
    comment = db.get(m.BlogComment, comment_id)
    if comment is None or comment.status != "approved":
        raise NotFound("Commentaire introuvable")
    vh = visitor_hash(request)
    existing = db.execute(
        select(m.BlogReaction).where(m.BlogReaction.comment_id == comment_id, m.BlogReaction.visitor_hash == vh)
    ).scalar_one_or_none()
    if existing is None:
        db.add(m.BlogReaction(comment_id=comment_id, visitor_hash=vh, kind="like"))
        comment.like_count += 1
    db.commit()
    return {"like_count": comment.like_count}


@router.post("/blog/posts/{slug}/share")
def blog_share(
    slug: str,
    data: ShareIn,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit("blog_share", "60/hour")),
) -> dict[str, Any]:
    row = db.execute(select(m.BlogPost).where(m.BlogPost.slug == slug)).scalar_one_or_none()
    if row is None:
        raise NotFound("Article introuvable")
    db.add(m.BlogShare(post_id=row.id, network=data.network, visitor_hash=visitor_hash(request)))
    row.share_count += 1
    from app.modules.analytics.service import record_server_event

    record_server_event(
        db, "blog_share", path=f"/blog/{slug}", content_type="blog_post", content_id=str(row.id), target=data.network
    )
    db.commit()
    return {"share_count": row.share_count}


@router.get("/blog/authors/{slug}")
def blog_author(slug: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    author = db.execute(select(m.BlogAuthor).where(m.BlogAuthor.slug == slug)).scalar_one_or_none()
    if author is None:
        raise NotFound("Auteur introuvable")
    media = load_media_map(db, {author.photo_media_id} if author.photo_media_id else set())
    return jsonable(
        {
            "slug": author.slug,
            "name": author.name,
            "title": author.title,
            "bio": author.bio,
            "linkedin_url": author.linkedin_url,
            "photo": media.get(str(author.photo_media_id)) if author.photo_media_id else None,
        }
    )


# ---------------------------------------------------------------------------- FAQ, aide, preuves sociales
@router.get("/faq")
def faq(response: Response, universe: str | None = None, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    cats = db.execute(select(m.FaqCategory).order_by(m.FaqCategory.sort_order)).scalars().all()
    stmt = select(m.FaqItem).where(*service.live_filter(m.FaqItem)).order_by(m.FaqItem.sort_order)
    if universe:
        stmt = stmt.where(or_(m.FaqItem.universe == universe, m.FaqItem.universe.is_(None)))
    items = db.execute(stmt).scalars().all()
    out = []
    for cat in [*cats, None]:
        entries = [
            {"id": i.id, "question": i.question, "answer": i.answer, "universe": i.universe}
            for i in items
            if i.category_id == (cat.id if cat else None)
        ]
        if entries:
            out.append(
                {
                    "slug": cat.slug if cat else "general",
                    "name": cat.name if cat else "Questions générales",
                    "items": entries,
                }
            )
    _cache(response)
    return jsonable(out)


@router.get("/help")
def help_center(response: Response, audience: str = "public", db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    cats = db.execute(select(m.HelpCategory).order_by(m.HelpCategory.sort_order)).scalars().all()
    articles = (
        db.execute(
            select(m.HelpArticle)
            .where(*service.live_filter(m.HelpArticle), m.HelpArticle.audience.in_(["public", audience]))
            .order_by(m.HelpArticle.sort_order)
        )
        .scalars()
        .all()
    )
    out = []
    for cat in [*cats, None]:
        entries = [
            {"slug": a.slug, "title": a.title, "summary": a.summary, "path": f"/aide/{a.slug}"}
            for a in articles
            if a.category_id == (cat.id if cat else None)
        ]
        if entries:
            out.append(
                {
                    "slug": cat.slug if cat else "general",
                    "name": cat.name if cat else "Général",
                    "description": cat.description if cat else None,
                    "icon": cat.icon if cat else None,
                    "articles": entries,
                }
            )
    _cache(response)
    return out


@router.get("/help/{slug}")
def help_article(slug: str, response: Response, db: Session = Depends(get_db)) -> dict[str, Any]:
    _cache(response)
    return jsonable(_detail(db, "help_articles", m.HelpArticle, slug, "help_article"))


@router.post("/help/{slug}/feedback")
def help_feedback(
    slug: str,
    data: FeedbackIn,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit("help_feedback", "30/hour")),
) -> dict[str, str]:
    row = db.execute(select(m.HelpArticle).where(m.HelpArticle.slug == slug)).scalar_one_or_none()
    if row is None:
        raise NotFound("Article introuvable")
    if data.helpful:
        row.helpful_yes += 1
    else:
        row.helpful_no += 1
    db.commit()
    return {"status": "ok"}


@router.get("/testimonials")
def testimonials(
    response: Response, universe: str | None = None, featured: bool | None = None, db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    stmt = select(m.Testimonial).where(*service.live_filter(m.Testimonial)).order_by(m.Testimonial.sort_order)
    if universe:
        stmt = stmt.where(m.Testimonial.universe == universe)
    if featured is not None:
        stmt = stmt.where(m.Testimonial.featured.is_(featured))
    rows = db.execute(stmt).scalars().all()
    media = load_media_map(db, {x for r in rows for x in (r.photo_media_id, r.video_media_id) if x})
    _cache(response)
    return jsonable([service.testimonial_payload(r, media) for r in rows])


@router.get("/catalog/{kind}")
def catalog(
    kind: str,
    response: Response,
    family: str | None = None,
    universe: str | None = None,
    group: str | None = None,
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Équipe, partenaires, certifications, chiffres clés, vidéothèque."""
    mapping = {
        "team": (m.TeamMember, "team_members"),
        "partners": (m.Partner, "partners"),
        "certifications": (m.Certification, "certifications"),
        "key-figures": (m.KeyFigure, "key_figures"),
        "videos": (m.Video, "videos"),
    }
    if kind not in mapping:
        raise NotFound("Catalogue inconnu")
    model, key = mapping[kind]
    extra = []
    if kind == "videos" and family:
        extra.append(m.Video.family == family)
    if kind == "videos" and universe:
        extra.append(m.Video.universe == universe)
    if kind == "team" and group:
        extra.append(m.TeamMember.group == group)
    _cache(response)
    return jsonable(_simple_list(db, key, model, extra))


@router.get("/search")
def search(
    q: str = Query(..., min_length=2, max_length=100),
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit("public_search", "60/minute")),
) -> dict[str, Any]:
    """Recherche plein texte sur le contenu publié (pages et leurs sections, offres, expertises, services,
    réalisations, articles, aide publique, FAQ) : insensible aux accents et à la casse, tous les mots requis."""
    from app.modules.analytics.service import record_server_event
    from app.modules.cms.search import search as site_search

    results, partial = site_search(db, q)
    record_server_event(db, "search", path="/recherche", target=q[:100], value=0.0 if partial else float(len(results)))
    db.commit()
    return {"query": q, "total": len(results), "partial": partial, "results": jsonable(results)}


@router.get("/preview/{token}")
def preview(
    token: str,
    response: Response,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit("cms_preview", "120/minute")),
) -> dict[str, Any]:
    """Contenu non publié pour l'aperçu du site : uniquement l'élément désigné par un jeton signé (30 min)."""
    target = details.read_preview_token(token)
    if target is None:
        raise NotFound("Aperçu expiré ou invalide")
    key, item_id = target
    definition = service.get_collection(key)
    row = db.get(definition.model, item_id)
    detail = details.detail_payload(db, key, row) if row is not None else None
    if detail is None:
        raise NotFound("Aperçu indisponible")
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Robots-Tag"] = "noindex"
    return {"kind": key, "detail": detail}


# ---------------------------------------------------------------------------- médias publics
@router.get("/media/{media_id}/{variant}")
def public_media(media_id: uuid.UUID, variant: str, db: Session = Depends(get_db)) -> Any:
    asset = db.get(m.MediaAsset, media_id)
    if asset is None or asset.deleted_at is not None or asset.status != "active":
        raise NotFound("Média introuvable")
    if asset.kind == "external_video":
        return RedirectResponse(asset.external_url or "/", status_code=302)
    if variant == "original":
        key, mime = asset.storage_key, asset.mime_type
    else:
        info = (asset.variants or {}).get(variant)
        if not info:
            key, mime = asset.storage_key, asset.mime_type
        else:
            key, mime = info["key"], info["mime"]
    if not key:
        raise NotFound("Fichier indisponible")
    path = public_storage().local_path(key)
    if not path.exists():
        raise NotFound("Fichier indisponible")
    headers = {
        "Cache-Control": "public, max-age=604800",
        "ETag": f'"{asset.checksum_sha256 or asset.id}-{variant}"',
        "X-Content-Type-Options": "nosniff",
    }
    if mime == "image/svg+xml":
        headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'"
    disposition = (
        "inline" if (mime or "").startswith(("image/", "video/")) or mime == "application/pdf" else "attachment"
    )
    return FileResponse(
        str(path),
        media_type=mime or "application/octet-stream",
        headers=headers,
        content_disposition_type=disposition,
        filename=asset.original_name if disposition == "attachment" else None,
    )


_ = settings
