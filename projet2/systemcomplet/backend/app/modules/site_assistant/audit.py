"""Audit éditorial de la vitrine, page par page, tel que la voit un visiteur : sections et blocs vides, images
manquantes, textes trop courts, listes sans élément publié, pages de détail minces, SEO à reprendre.

Sert à l'assistant du site pour décider quoi compléter (et dans quel ordre) avant de rédiger ou d'illustrer.
"""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy import JSON, String, Text, func, select
from sqlalchemy.orm import Session

from app.modules.cms import models as m
from app.modules.cms import service

MIN_PAGE_WORDS = 250
MIN_SECTIONS = 3
MIN_DETAIL_WORDS = 150
MIN_SUMMARY_CHARS = 80
MAX_ITEMS_LISTED = 25

# Page système → collection affichée en liste sous le contenu CMS de la page.
LISTINGS = {
    "offers": "offers",
    "expertises": "expertises",
    "services": "services",
    "projects": "projects",
    "blog": "blog_posts",
    "faq": "faq_items",
    "help": "help_articles",
}
# Bloc de page → collection dont il affiche les éléments publiés.
BLOCK_COLLECTIONS = {
    "testimonials": "testimonials",
    "projects": "projects",
    "universes": "universes",
    "offers": "offers",
    "expertises": "expertises",
    "services": "services",
    "team": "team_members",
    "partners": "partners",
    "certifications": "certifications",
    "videos": "videos",
    "blog": "blog_posts",
    "faq": "faq_items",
    "stats": "key_figures",
}
# Collections avec une page de détail publique (contrôlées élément par élément).
DETAIL_COLLECTIONS = ("universes", "offers", "expertises", "services", "projects", "blog_posts", "help_articles")
SUPPORT_COLLECTIONS = ("testimonials", "team_members", "partners", "certifications", "key_figures", "videos")

_NON_TEXT_KEYS = re.compile(
    r"(^id$|_id$|_ids$|url$|href$|^kind$|style|layout|^icon$|theme|^mode$|^source$|position|^key$|slug|mime|"
    r"^accent$|^columns$|^limit$|^universe$|^form_key$|^anchor$|^target$|^lat|^lng|^lon|^zoom$|^variant$)"
)
_TAG = re.compile(r"<[^>]+>")


def _words(node: Any, key: str = "") -> int:
    if isinstance(node, str):
        if _NON_TEXT_KEYS.search(key) or node.startswith(("http", "/", "#")):
            return 0
        return len(_TAG.sub(" ", node).split())
    if isinstance(node, dict):
        return sum(_words(v, k) for k, v in node.items())
    if isinstance(node, list):
        return sum(_words(v, key) for v in node)
    return 0


def _images(node: Any) -> int:
    if isinstance(node, dict):
        total = 0
        for k, v in node.items():
            if k.endswith("media_id") and v:
                total += 1
            elif k.endswith("media_ids") and isinstance(v, list):
                total += len([x for x in v if x])
            elif isinstance(v, dict | list):
                total += _images(v)
        return total
    if isinstance(node, list):
        return sum(_images(v) for v in node)
    return 0


def _block_issues(data: dict[str, Any], resolved: dict[str, Any] | None) -> list[str]:
    kind = data.get("kind")
    issues: list[str] = []
    if kind == "hero" and not _images(data):
        issues.append("bannière sans image ni vidéo")
    elif kind == "rich_text" and _words(data) < 60:
        issues.append(f"texte court ({_words(data)} mots)")
    elif kind in ("features", "steps"):
        count = len(data.get("items") or [])
        if count < 3:
            issues.append(f"peu d'éléments ({count})")
        elif kind == "features" and not any(i.get("media_id") or i.get("icon") for i in data.get("items") or []):
            issues.append("éléments sans icône ni image")
    elif kind == "gallery" and not _images(data):
        issues.append("galerie vide")
    elif kind == "media" and not _images(data):
        issues.append("bloc image sans image")
    elif kind == "video" and not (data.get("media_id") or data.get("url") or data.get("video_media_id")):
        issues.append("vidéo absente")
    elif kind == "before_after" and not data.get("items"):
        issues.append("avant / après sans image")
    elif kind == "cta" and _words(data) < 6:
        issues.append("appel à l'action sans texte")
    if kind in BLOCK_COLLECTIONS and not (kind == "stats" and data.get("source") == "inline"):
        items = (resolved or {}).get("items")
        if items is not None and not items:
            issues.append(f"bloc vide : aucun élément publié dans la collection « {BLOCK_COLLECTIONS[kind]} »")
    return issues


def _seo_issues(db: Session, target_type: str, target_key: str, title: str | None) -> list[str]:
    return list(service.seo_issues(service.get_seo(db, target_type, target_key), title))


def _published(db: Session, key: str) -> list[Any]:
    model = service.get_collection(key).model
    order = model.sort_order if hasattr(model, "sort_order") else model.created_at
    return list(db.execute(select(model).where(*service.live_filter(model)).order_by(order)).scalars())


def _item_images(obj: Any) -> int:
    total = 0
    for column in obj.__table__.columns:
        value = getattr(obj, column.key)
        if column.key.endswith("media_id") and value:
            total += 1
        elif column.key.endswith("media_ids") and isinstance(value, list):
            total += len(value)
        elif column.key == "body_blocks":
            total += _images(value or [])
    return total


def _item_words(obj: Any) -> int:
    total = 0
    for column in obj.__table__.columns:
        if _NON_TEXT_KEYS.search(column.key):
            continue
        value = getattr(obj, column.key)
        if isinstance(column.type, Text | String | JSON) and value:
            total += _words(value, column.key)
    return total


def _summary_of(obj: Any) -> str:
    for name in ("summary", "excerpt", "tagline", "promise", "description"):
        value = getattr(obj, name, None)
        if value:
            return _TAG.sub(" ", str(value)).strip()
    return ""


def _page_report(db: Session, page: m.CmsPage) -> dict[str, Any]:
    payload = service.page_public_payload(db, page)
    resolved_by_section = {s["key"]: s["blocks"] for s in payload["sections"]}
    sections: list[dict[str, Any]] = []
    words = images = 0
    for section in page.sections:
        if not section.visible:
            continue
        visible = [b for b in section.blocks if b.visible]
        resolved = resolved_by_section.get(section.key) or []
        block_reports = []
        for index, block in enumerate(visible):
            data = block.data or {}
            words += _words(data)
            images += _images(data)
            issues = _block_issues(data, resolved[index] if index < len(resolved) else None)
            block_reports.append({"kind": data.get("kind"), "words": _words(data), "issues": issues})
        if (section.settings or {}).get("media_id"):
            images += 1
        sections.append({"key": section.key, "title": section.title, "blocks": block_reports})
    issues: list[str] = []
    listing = LISTINGS.get(page.route_key)
    listing_info: dict[str, Any] | None = None
    if listing:
        items = _published(db, listing)
        without_image = [i for i in items if not _item_images(i)] if listing != "faq_items" else []
        listing_info = {"collection": listing, "published": len(items), "without_image": len(without_image)}
        if not items:
            issues.append(f"liste vide : aucun élément publié dans « {listing} » (le visiteur voit « Aucun … publié »)")
        elif without_image:
            issues.append(f"{len(without_image)} élément(s) de la liste sans image")
    if page.status != "published":
        issues.append(f"page non publiée ({page.status})")
    if len(sections) < MIN_SECTIONS and not listing:
        issues.append(f"page courte ({len(sections)} section(s))")
    if words < MIN_PAGE_WORDS and not (listing and listing_info and listing_info["published"] >= 3):
        issues.append(f"peu de texte ({words} mots dans les sections)")
    if not images:
        issues.append("aucune image dans les sections de la page")
    seo = _seo_issues(db, "page", page.route_key, page.title)
    block_issue_count = sum(len(b["issues"]) for s in sections for b in s["blocks"])
    return {
        "id": str(page.id),
        "path": page.path,
        "route_key": page.route_key,
        "title": page.title,
        "status": page.status,
        "sections": len(sections),
        "words": words,
        "images": images,
        "listing": listing_info,
        "issues": issues,
        "seo_issues": seo,
        "blocks_with_issues": [
            {"section": s["key"], "kind": b["kind"], "issues": b["issues"]}
            for s in sections
            for b in s["blocks"]
            if b["issues"]
        ],
        "score": len(issues) * 2 + block_issue_count + len(seo),
    }


def _collection_report(db: Session, key: str) -> dict[str, Any]:
    definition = service.get_collection(key)
    items = _published(db, key)
    drafts = db.scalar(select(func.count()).select_from(definition.model).where(definition.model.status != "published"))
    flagged = []
    for obj in items:
        issues = []
        if not _item_images(obj):
            issues.append("sans image")
        summary = _summary_of(obj)
        if len(summary) < MIN_SUMMARY_CHARS:
            issues.append(f"résumé court ({len(summary)} caractères)")
        words = _item_words(obj)
        if words < MIN_DETAIL_WORDS:
            issues.append(f"page de détail mince ({words} mots)")
        target_type = definition.seo_type or key
        seo = _seo_issues(db, target_type, str(obj.id), getattr(obj, definition.title_attr, None))
        if issues or seo:
            flagged.append(
                {
                    "id": str(obj.id),
                    "title": getattr(obj, definition.title_attr, None),
                    "path": service.public_path(db, key, obj),
                    "issues": issues,
                    "seo_issues": seo,
                }
            )
    flagged.sort(key=lambda x: -(len(x["issues"]) * 2 + len(x["seo_issues"])))
    return {
        "collection": key,
        "label": definition.label,
        "published": len(items),
        "not_published": drafts or 0,
        "items_with_issues": len(flagged),
        "items": flagged[:MAX_ITEMS_LISTED],
    }


def site_content_audit(db: Session, *, include_ok: bool = False) -> dict[str, Any]:
    pages = list(db.execute(select(m.CmsPage).order_by(m.CmsPage.path)).scalars())
    reports = [_page_report(db, p) for p in pages if p.status in ("published", "draft", "in_review", "validated")]
    known = {p.route_key for p in pages}
    missing_system = [
        {"route_key": key, "path": path, "issue": "aucune page CMS : le site affiche un en-tête générique"}
        for key, path in service.SYSTEM_PAGES.items()
        if key not in known
    ]
    reports.sort(key=lambda r: (r["status"] != "published", -r["score"]))
    if not include_ok:
        reports = [r for r in reports if r["score"] or r["status"] != "published"]
    collections = [_collection_report(db, key) for key in DETAIL_COLLECTIONS]
    support = {
        key: {"label": service.get_collection(key).label, "published": len(_published(db, key))}
        for key in SUPPORT_COLLECTIONS
    }
    media_images = db.scalar(
        select(func.count())
        .select_from(m.MediaAsset)
        .where(m.MediaAsset.deleted_at.is_(None), m.MediaAsset.status == "active", m.MediaAsset.kind == "image")
    )
    return {
        "regles": {
            "page_min_mots": MIN_PAGE_WORDS,
            "page_min_sections": MIN_SECTIONS,
            "detail_min_mots": MIN_DETAIL_WORDS,
            "resume_min_caracteres": MIN_SUMMARY_CHARS,
        },
        "pages": reports,
        "pages_systeme_absentes": missing_system,
        "collections_avec_page": collections,
        "collections_d_appui": support,
        "images_dans_la_mediatheque": media_images or 0,
        "pages_codees_hors_cms": [
            "/chantiers (chantiers en cours, depuis les projets de l'ERP)",
            "/estimation-instantanee, /financement, /energie-confort, /recherche (écrans du site, textes fixes)",
        ],
    }
