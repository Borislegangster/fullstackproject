"""Base de connaissances de l'assistant (vitrine et WhatsApp) : TOUTES les informations publiques de l'entreprise
enregistrées dans le CMS, mises en forme pour Claude.

Coordonnées et adresse, horaires, mentions légales, réseaux sociaux, pages publiées, univers, offres (avec les
indications de prix et de délai publiées), expertises, services, réalisations, FAQ, articles d'aide publics, blog,
témoignages, équipe, partenaires, certifications, chiffres clés et vidéos. Seul le contenu publié (et en ligne à
cet instant) est repris ; aucun brouillon, aucune donnée interne.

Le texte est reconstruit quand le contenu change (empreinte des tables) et au plus tard après ``TTL_SECONDS`` ; il
est identique octet pour octet tant que rien ne change, ce qui permet sa mise en cache côté Anthropic.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.cms import models as m
from app.modules.cms import service
from app.modules.cms.search import _clean, _join, _live

TTL_SECONDS = 60
MAX_CHARS = 240_000  # ≈ 60 000 jetons : au-delà, les rubriques les moins utiles (blog, vidéos) sont raccourcies
# Pages fonctionnelles du site (routes publiques sans paramètre), toujours valables comme lien proposé au visiteur.
STATIC_PATHS = (
    "/",
    "/offres",
    "/services",
    "/expertises",
    "/projets",
    "/blog",
    "/faq",
    "/aide",
    "/chantiers",
    "/decrire-mon-projet",
    "/estimation-instantanee",
    "/financement",
    "/energie-confort",
    "/recherche",
)
_TRACKED = (
    m.SiteSettings,
    m.SocialLink,
    m.CmsPage,
    m.Universe,
    m.Offer,
    m.Expertise,
    m.Service,
    m.PortfolioProject,
    m.BlogPost,
    m.BlogCategory,
    m.BlogAuthor,
    m.HelpArticle,
    m.HelpCategory,
    m.FaqItem,
    m.FaqCategory,
    m.Testimonial,
    m.TeamMember,
    m.Partner,
    m.Certification,
    m.KeyFigure,
    m.Video,
)
LEGAL_LABELS = {
    "forme": "Forme juridique",
    "forme_juridique": "Forme juridique",
    "capital": "Capital",
    "rccm": "RCCM",
    "niu": "NIU",
    "siege": "Siège social",
    "directeur_publication": "Directeur de la publication",
    "hebergeur": "Hébergeur du site",
}


@dataclass
class Knowledge:
    text: str = ""
    paths: frozenset[str] = frozenset()
    external_links: frozenset[str] = frozenset()  # liens publiés hors du site (Google Maps, réseaux sociaux)
    contacts: dict[str, Any] = field(default_factory=dict)


_lock = threading.Lock()
_cache: dict[str, Any] = {"signature": None, "at": 0.0, "value": None}


def _cut(text: str | None, size: int) -> str:
    text = _clean(text)
    if len(text) <= size:
        return text
    return text[:size].rsplit(" ", 1)[0] + " […]"


def _num(value: Any) -> str:
    return f"{value.normalize():f}" if isinstance(value, Decimal) else str(value)


def _line(label: str, value: Any) -> str | None:
    if value is None or value == "" or value == [] or value == {}:
        return None
    if isinstance(value, (int, float, Decimal)):
        text = _num(value)
    else:
        text = _clean(value if isinstance(value, str) else _join(value))
    return f"- {label} : {text}" if text else None


def _block(title: str, path: str | None, lines: list[str | None], body: str | None = None) -> str:
    head = f"### {_clean(title)}" + (f" — page {path}" if path else "")
    out = [head, *[ln for ln in lines if ln]]
    if body:
        out.append(body)
    return "\n".join(out)


def _section(title: str, blocks: list[str]) -> str:
    return f"## {title}\n\n" + "\n\n".join(blocks) if blocks else ""


def _signature(db: Session) -> tuple[Any, ...]:
    parts: list[Any] = []
    for model in _TRACKED:
        parts.append(tuple(db.execute(select(func.count(), func.max(model.updated_at)).select_from(model)).one()))
    parts.append(db.execute(select(func.count()).select_from(m.CmsBlock)).scalar_one())
    return tuple(parts)


def public_knowledge(db: Session) -> Knowledge:
    """Base de connaissances courante (en cache tant que le contenu publié ne change pas)."""
    signature = _signature(db)
    with _lock:
        fresh = time.monotonic() - _cache["at"] < TTL_SECONDS
        if fresh and _cache["signature"] == signature and _cache["value"] is not None:
            return _cache["value"]
    value = build(db)
    with _lock:
        _cache.update(signature=signature, at=time.monotonic(), value=value)
    return value


def reset_cache() -> None:
    with _lock:
        _cache.update(signature=None, at=0.0, value=None)


def _live_rows(db: Session, model: Any, *order: Any) -> list[Any]:
    return list(db.execute(select(model).where(*_live(model)).order_by(*order, model.id)).scalars())


# ---------------------------------------------------------------------------- rubriques
def _identity(db: Session, paths: set[str], links: set[str]) -> tuple[str, dict[str, Any], set[str]]:
    site = db.execute(select(m.SiteSettings).limit(1)).scalar_one_or_none()
    company = (site.company_name if site else None) or "GLOBUS ENGINEERING"
    cities: set[str] = set()
    lines: list[str | None] = [f"- Nom : {company}"]
    contacts: dict[str, Any] = {"company": company}
    if site is not None:
        if site.city:
            cities.add(site.city.strip())
        hours = "; ".join(
            " ".join(str(h.get(k) or "") for k in ("days", "hours")).strip() if isinstance(h, dict) else str(h)
            for h in site.opening_hours or []
        )
        lines += [
            _line("Signature", site.slogan),
            _line("Promesse", site.promise),
            _line("Adresse des bureaux", site.address),
            _line("Ville", site.city),
            _line("Pays", site.country),
            _line("Horaires d'ouverture", hours),
            _line("Téléphone", site.phone),
            _line("WhatsApp", site.whatsapp),
            _line("E-mail", site.email),
            _line("Itinéraire (Google Maps)", site.google_business_url),
            (
                f"- Coordonnées GPS : {site.latitude}, {site.longitude}"
                if site.latitude is not None and site.longitude is not None
                else None
            ),
        ]
        for key, value in (site.legal_info or {}).items():
            label = LEGAL_LABELS.get(str(key), str(key).replace("_", " ").capitalize())
            lines.append(_line(label, _cut(str(value), 400) if value else None))
        if site.google_business_url:
            links.add(site.google_business_url)
        contacts.update(
            phone=site.phone,
            whatsapp=site.whatsapp,
            email=site.email,
            address=site.address,
            city=site.city,
            country=site.country,
            opening_hours=hours or None,
            maps_url=site.google_business_url,
        )
    socials = db.execute(
        select(m.SocialLink).where(m.SocialLink.is_active.is_(True)).order_by(m.SocialLink.sort_order, m.SocialLink.id)
    ).scalars()
    for link in socials:
        lines.append(f"- Réseau social ({link.label or link.network}) : {link.url}")
        links.add(link.url)
    return _section("Identité et coordonnées de l'entreprise", [_block(company, None, lines)]), contacts, cities


def _pages(db: Session, paths: set[str]) -> str:
    blocks = []
    for page in _live_rows(db, m.CmsPage, m.CmsPage.sort_order, m.CmsPage.path):
        parts: list[Any] = []
        for section in page.sections:
            if not section.visible:
                continue
            parts.append(section.title or "")
            parts.extend(block.data for block in section.blocks if block.visible)
        parts.append(page.body or "")
        paths.add(page.path)
        blocks.append(_block(page.title, page.path, [_line("Résumé", page.summary)], _cut(_join(*parts), 6000)))
    return _section("Pages du site", blocks)


def _collections(db: Session, paths: set[str], cities: set[str]) -> list[str]:
    out: list[str] = []
    universes = _live_rows(db, m.Universe, m.Universe.sort_order)
    by_id = {u.id: u for u in universes}
    blocks = []
    for u in universes:
        path = service.public_path(db, "universes", u)
        paths.add(path or "")
        body = _join(u.description, u.prospect_wants, u.funnel, u.body_blocks)
        lines = [_line("Accroche", u.tagline), _line("Promesse", u.promise), _line("Pour qui", u.target)]
        blocks.append(_block(u.name, path, lines, _cut(body, 3000)))
    out.append(_section("Univers (nos offres par profil de client)", blocks))

    blocks = []
    for o in _live_rows(db, m.Offer, m.Offer.sort_order):
        universe = by_id.get(o.universe_id)
        if universe is None:
            continue
        path = service.public_path(db, "offers", o)
        paths.add(path or "")
        lines = [
            f"- Univers : {universe.name}",
            _line("Résumé", o.summary),
            _line("Idéal pour", o.ideal_for),
            _line("Indication de prix publiée", o.price_hint),
            _line("Indication de délai publiée", o.duration_hint),
            _line("Livrables", o.deliverables),
            _line("Étapes", o.steps),
        ]
        blocks.append(_block(o.name, path, lines, _cut(_join(o.description, o.body_blocks), 3000)))
    out.append(_section("Offres", blocks))

    blocks = []
    for s in _live_rows(db, m.Service, m.Service.sort_order):
        path = service.public_path(db, "services", s)
        paths.add(path or "")
        lines = [_line("Catégorie", s.category), _line("Résumé", s.summary), _line("Livrables", s.deliverables)]
        blocks.append(_block(s.name, path, lines, _cut(_join(s.body_blocks), 2000)))
    out.append(_section("Services", blocks))

    blocks = []
    for e in _live_rows(db, m.Expertise, m.Expertise.sort_order):
        path = service.public_path(db, "expertises", e)
        paths.add(path or "")
        lines = [_line("Discipline", e.discipline), _line("Résumé", e.summary)]
        blocks.append(_block(e.name, path, lines, _cut(_join(e.description, e.body_blocks), 2500)))
    out.append(_section("Expertises", blocks))

    categories = {c.id: c.name for c in db.execute(select(m.FaqCategory)).scalars()}
    blocks = []
    for f in _live_rows(db, m.FaqItem, m.FaqItem.featured.desc(), m.FaqItem.sort_order):
        category = categories.get(f.category_id) if f.category_id else None
        head = f"Q : {_clean(f.question)}" + (f" ({category})" if category else "")
        blocks.append(f"{head}\nR : {_cut(f.answer, 1500)}")
    out.append(_section("Questions fréquentes (page /faq)", blocks))

    blocks = []
    for p in _live_rows(db, m.PortfolioProject, m.PortfolioProject.featured.desc(), m.PortfolioProject.sort_order):
        path = service.public_path(db, "projects", p)
        paths.add(path or "")
        if p.city and (p.country or "Cameroun").strip().lower() in ("cameroun", "cameroon", "cm"):
            cities.add(p.city.strip())
        place = ", ".join(x for x in (p.city, p.country) if x)
        lines = [
            _line("Lieu", place),
            _line("Année", p.year),
            _line("Catégorie", p.category),
            _line("Surface", f"{_num(p.surface_m2)} m²" if p.surface_m2 else None),
            _line("Durée", f"{p.duration_months} mois" if p.duration_months else None),
            _line("Budget", p.budget_range),
            _line("Type de client", p.client_type),
            _line("État", "livré" if p.delivery_status == "delivered" else "en cours"),
            _line("Résumé", p.summary),
            _line("Défi", p.challenge),
            _line("Solution", p.solution),
            _line("Résultats", p.results),
        ]
        blocks.append(_block(p.title, path, lines, _cut(_join(p.body_blocks), 1500)))
    out.append(_section("Réalisations", blocks))
    return out


def _proof(db: Session) -> list[str]:
    out: list[str] = []
    figures = [
        f"- {k.prefix or ''}{_num(k.value)}{(' ' + k.suffix) if k.suffix else ''} : {k.label}"
        + (f" ({_clean(k.description)})" if k.description else "")
        for k in _live_rows(db, m.KeyFigure, m.KeyFigure.sort_order)
    ]
    out.append(_section("Chiffres clés", ["\n".join(figures)] if figures else []))

    certifications = [
        "- "
        + " — ".join(
            x
            for x in (
                _clean(c.name),
                _clean(c.issuer) if c.issuer else "",
                str(c.year) if c.year else "",
                _cut(c.description, 400),
            )
            if x
        )
        for c in _live_rows(db, m.Certification, m.Certification.sort_order)
    ]
    out.append(_section("Certifications et agréments", ["\n".join(certifications)] if certifications else []))

    team = [
        f"- {_clean(t.name)} — {_clean(t.role)}"
        + (f" ({_clean(t.group)})" if t.group else "")
        + (f" : {_cut(t.bio, 400)}" if t.bio else "")
        for t in _live_rows(db, m.TeamMember, m.TeamMember.sort_order)
    ]
    out.append(_section("Équipe", ["\n".join(team)] if team else []))

    partners = [
        f"- {_clean(p.name)} ({p.category})" + (f" : {p.url}" if p.url else "")
        for p in _live_rows(db, m.Partner, m.Partner.sort_order)
    ]
    out.append(_section("Partenaires", ["\n".join(partners)] if partners else []))

    testimonials = []
    for t in _live_rows(db, m.Testimonial, m.Testimonial.featured.desc(), m.Testimonial.sort_order):
        who = ", ".join(_clean(x) for x in (t.author_name, t.author_role, t.location) if x)
        rating = f" — {t.rating}/5" if t.rating else ""
        verified = " — avis vérifié (client d'un chantier réel)" if t.verified else ""
        testimonials.append(f"- « {_cut(t.quote, 500)} » ({who}{rating}{verified})")
    out.append(_section("Témoignages de clients", ["\n".join(testimonials)] if testimonials else []))
    return out


def _articles(db: Session, paths: set[str]) -> list[str]:
    out: list[str] = []
    help_categories = {c.id: c.name for c in db.execute(select(m.HelpCategory)).scalars()}
    blocks = []
    for h in _live_rows(db, m.HelpArticle, m.HelpArticle.sort_order):
        if h.audience != "public":
            continue
        path = service.public_path(db, "help_articles", h)
        paths.add(path or "")
        lines = [_line("Rubrique", help_categories.get(h.category_id)), _line("Résumé", h.summary)]
        blocks.append(_block(h.title, path, lines, _cut(_join(h.body_blocks), 2500)))
    out.append(_section("Centre d'aide", blocks))

    blog_categories = {c.id: c.name for c in db.execute(select(m.BlogCategory)).scalars()}
    blocks = []
    for b in _live_rows(db, m.BlogPost, m.BlogPost.published_at.desc().nulls_last()):
        path = service.public_path(db, "blog_posts", b)
        paths.add(path or "")
        lines = [
            _line("Rubrique", blog_categories.get(b.category_id)),
            _line("Publié le", b.published_at.date().isoformat() if b.published_at else None),
            _line("Chapô", b.excerpt),
        ]
        blocks.append(_block(b.title, path, lines, _cut(_join(b.body_blocks), 1200)))
    out.append(_section("Articles du blog", blocks))

    videos = [
        f"- {_clean(v.title)}" + (f" : {_cut(v.description, 300)}" if v.description else "")
        for v in _live_rows(db, m.Video, m.Video.featured.desc(), m.Video.sort_order)
    ]
    out.append(_section("Vidéos", ["\n".join(videos)] if videos else []))
    return out


def build(db: Session) -> Knowledge:
    paths: set[str] = set(STATIC_PATHS)
    links: set[str] = set()
    identity, contacts, cities = _identity(db, paths, links)
    sections = [identity, _pages(db, paths), *_collections(db, paths, cities), *_proof(db)]
    articles = _articles(db, paths)
    places = sorted(c for c in cities if c)
    if places:
        title = "Villes de notre siège et de nos réalisations publiées (Cameroun)"
        sections.insert(1, _section(title, ["- " + ", ".join(places)]))
    text = "\n\n".join(s for s in sections if s)
    budget = MAX_CHARS - len(text)
    for section in articles:  # aide, blog, vidéos : ajoutés tant qu'il reste de la place
        if not section:
            continue
        if len(section) + 2 > budget:
            if budget > 2000:
                text += "\n\n" + section[: budget - 40].rsplit("\n", 1)[0] + "\n[… rubrique raccourcie]"
            break
        text += "\n\n" + section
        budget -= len(section) + 2
    paths.discard("")
    return Knowledge(text=text[:MAX_CHARS], paths=frozenset(paths), external_links=frozenset(links), contacts=contacts)
