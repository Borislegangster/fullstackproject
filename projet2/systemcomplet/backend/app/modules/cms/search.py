"""Recherche plein texte du site vitrine.

Indexe uniquement le contenu publié et public : pages (titre, résumé, sections et blocs, corps HTML), univers,
offres, expertises, services, réalisations, articles, aide publique et FAQ. Insensible à la casse, aux accents et
au pluriel simple ; tous les mots significatifs de la requête doivent figurer dans le résultat. L'index est
reconstruit à la volée quand le contenu change (empreinte des tables) et au plus tard après ``TTL_SECONDS``.
"""

from __future__ import annotations

import html
import re
import threading
import time
import unicodedata
from dataclasses import dataclass
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.cms import models as m
from app.modules.cms import service

TTL_SECONDS = 30
MAX_RESULTS = 40


def _words(*lines: str) -> frozenset[str]:
    return frozenset(word for line in lines for word in line.split())


STOPWORDS = _words(
    "a au aux avec ce ces cet cette dans de des du elle en et il je la le les leur leurs ma mais me mes",
    "mon ne nos notre nous on ou par pas pour qu que qui sa se ses son sur ta te tes ton tu un une",
    "vos votre vous y d l j s c n est sont the of and",
)
# Clés de blocs CMS qui ne contiennent pas de texte destiné au lecteur.
_SKIP_KEYS = _words(
    "id ids key keys kind slug url href link src icon style layout variant accent color anchor",
    "target rel type provider embed image background align theme size form form_key collection",
    "sort filter mime focal width height media hero cover poster",
)
_SKIP_SUFFIXES = ("_id", "_ids", "_url", "_key", "_media", "_style")
_TAG_RE = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"\s+")
_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


@dataclass
class Entry:
    type: str
    title: str
    path: str
    summary: str
    body: str
    n_title: str
    n_summary: str
    n_body: str
    body_map: list[int]


# ---------------------------------------------------------------------------- normalisation
def _fold(char: str) -> str:
    base = unicodedata.normalize("NFKD", char)
    out = "".join(c for c in base if not unicodedata.combining(c)).lower()
    return {"œ": "oe", "æ": "ae", "ß": "ss", "’": "'"}.get(out, out)


def normalize(text: str) -> str:
    return "".join(_fold(c) for c in text)


def _normalize_with_map(text: str) -> tuple[str, list[int]]:
    """Texte normalisé + position d'origine de chaque caractère (extraits surlignés sur le texte réel)."""
    chars: list[str] = []
    positions: list[int] = []
    for index, char in enumerate(text):
        for folded in _fold(char):
            chars.append(folded)
            positions.append(index)
    return "".join(chars), positions


def _clean(text: str | None) -> str:
    if not text:
        return ""
    return _SPACE_RE.sub(" ", html.unescape(_TAG_RE.sub(" ", text))).strip()


# Terminaisons retirées (racinisation légère) : « études » trouve « étude », « visualiser » trouve « visualisée ».
_SUFFIXES = (
    "ements", "ement", "ations", "ation", "ables", "able", "euses", "euse", "eurs", "eur",
    "ees", "ee", "es", "er", "ez", "e", "s", "x",
)  # fmt: skip


def stem(word: str) -> str:
    if len(word) <= 4 or word.isdigit():
        return word
    for suffix in _SUFFIXES:
        if word.endswith(suffix) and len(word) - len(suffix) >= 4:
            return word[: -len(suffix)]
    return word


def query_terms(query: str) -> list[str]:
    words = [w for w in re.split(r"[^0-9a-z]+", normalize(query)) if w]
    significant = [w for w in words if w not in STOPWORDS and len(w) >= 2] or [w for w in words if len(w) >= 2]
    terms: list[str] = []
    for word in significant:
        root = stem(word)
        if root not in terms:
            terms.append(root)
    return terms[:8]


# ---------------------------------------------------------------------------- extraction du texte
def _strings(value: Any, key: str = "") -> list[str]:
    if key in _SKIP_KEYS or key.endswith(_SKIP_SUFFIXES):
        return []
    if isinstance(value, str):
        text = value.strip()
        if not text or _UUID_RE.match(text) or text.startswith(("http://", "https://", "/", "#", "data:")):
            return []
        return [_clean(text)]
    if isinstance(value, dict):
        if "href" in value and "label" in value:  # bouton / lien d'appel à l'action : pas du contenu
            return []
        return [s for k, v in value.items() for s in _strings(v, str(k))]
    if isinstance(value, list):
        return [s for v in value for s in _strings(v, key)]
    return []


def _join(*parts: Any) -> str:
    return " · ".join(p for p in (_clean(x) if isinstance(x, str) else " ".join(_strings(x)) for x in parts) if p)


def _entry(kind: str, title: str, path: str | None, summary: str | None, body: str) -> Entry | None:
    if not path or not title:
        return None
    clean_summary = _clean(summary)
    n_body, body_map = _normalize_with_map(body)
    return Entry(
        kind, _clean(title), path, clean_summary, body, normalize(title), normalize(clean_summary), n_body, body_map
    )


def _live(model: Any) -> list[Any]:
    filters = service.live_filter(model)
    if hasattr(model, "deleted_at"):
        filters.append(model.deleted_at.is_(None))
    return filters


def _build(db: Session) -> list[Entry]:
    entries: list[Entry | None] = []
    for page in db.execute(select(m.CmsPage).where(*_live(m.CmsPage))).scalars():
        parts: list[Any] = []
        for section in page.sections:
            if not section.visible:
                continue
            parts.append(section.title or "")
            parts.extend(block.data for block in section.blocks if block.visible)
        parts.append(page.body or "")
        entries.append(_entry("page", page.title, page.path, page.summary, _join(*parts)))

    universes = {u.id: u for u in db.execute(select(m.Universe).where(*_live(m.Universe))).scalars()}
    for u in universes.values():
        body = _join(u.promise, u.target, u.description, u.prospect_wants, u.funnel, u.body_blocks)
        entries.append(_entry("universes", u.name, service.public_path(db, "universes", u), u.tagline, body))
    for o in db.execute(select(m.Offer).where(*_live(m.Offer))).scalars():
        if o.universe_id not in universes:
            continue
        body = _join(o.description, o.ideal_for, o.price_hint, o.duration_hint, o.deliverables, o.steps, o.body_blocks)
        entries.append(_entry("offers", o.name, service.public_path(db, "offers", o), o.summary, body))
    for e in db.execute(select(m.Expertise).where(*_live(m.Expertise))).scalars():
        body = _join(e.description, e.body_blocks)
        entries.append(_entry("expertises", e.name, service.public_path(db, "expertises", e), e.summary, body))
    for s in db.execute(select(m.Service).where(*_live(m.Service))).scalars():
        body = _join(s.category, s.deliverables, s.body_blocks)
        entries.append(_entry("services", s.name, service.public_path(db, "services", s), s.summary, body))
    for p in db.execute(select(m.PortfolioProject).where(*_live(m.PortfolioProject))).scalars():
        body = _join(p.city, p.country, p.category, p.client_type, p.challenge, p.solution, p.results)
        entries.append(_entry("projects", p.title, service.public_path(db, "projects", p), p.summary, body))
    for b in db.execute(select(m.BlogPost).where(*_live(m.BlogPost))).scalars():
        body = _join(b.tags, b.body_blocks)
        entries.append(_entry("blog_posts", b.title, service.public_path(db, "blog_posts", b), b.excerpt, body))
    for h in db.execute(
        select(m.HelpArticle).where(*_live(m.HelpArticle), m.HelpArticle.audience == "public")
    ).scalars():
        body = _join(h.keywords, h.body_blocks)
        entries.append(_entry("help_articles", h.title, service.public_path(db, "help_articles", h), h.summary, body))
    for f in db.execute(select(m.FaqItem).where(*_live(m.FaqItem))).scalars():
        entries.append(_entry("faq", f.question, "/faq", None, _clean(f.answer)))
    return [e for e in entries if e is not None]


# ---------------------------------------------------------------------------- index en cache
_INDEXED = (m.CmsPage, m.Universe, m.Offer, m.Expertise, m.Service, m.PortfolioProject, m.BlogPost, m.HelpArticle)
_lock = threading.Lock()
_cache: dict[str, Any] = {"signature": None, "at": 0.0, "entries": []}


def _signature(db: Session) -> tuple[Any, ...]:
    parts: list[Any] = []
    for model in (*_INDEXED, m.FaqItem):
        parts.append(tuple(db.execute(select(func.count(), func.max(model.updated_at)).select_from(model)).one()))
    parts.append(db.execute(select(func.count()).select_from(m.CmsBlock)).scalar_one())
    return tuple(parts)


def index(db: Session) -> list[Entry]:
    signature = _signature(db)
    with _lock:
        fresh = time.monotonic() - _cache["at"] < TTL_SECONDS
        if fresh and _cache["signature"] == signature:
            return _cache["entries"]
    entries = _build(db)
    with _lock:
        _cache.update(signature=signature, at=time.monotonic(), entries=entries)
    return entries


def reset_cache() -> None:
    with _lock:
        _cache.update(signature=None, at=0.0, entries=[])


# ---------------------------------------------------------------------------- recherche
def _excerpt(entry: Entry, terms: list[str], size: int = 220) -> tuple[str, list[list[int]]]:
    """Extrait du corps autour de la première occurrence, avec les positions des termes trouvés (surlignage)."""
    hits = [h for h in (entry.n_body.find(t) for t in terms) if h >= 0]
    if hits:
        first = entry.body_map[min(hits)]
        start = max(0, first - 70)
        if start:
            space = entry.body.rfind(" ", 0, start + 1)
            if space >= 0 and first - space < 120:
                start = space + 1
        end = min(len(entry.body), start + size)
        if end < len(entry.body):
            space = entry.body.rfind(" ", start, end)
            if space > start + 60:
                end = space
        prefix = "… " if start else ""
        suffix = " …" if end < len(entry.body) else ""
        source = entry.body[start:end]
    else:
        prefix, suffix = "", ""
        source = entry.summary or entry.body[:size]
    folded, positions = _normalize_with_map(source)
    marks: list[list[int]] = []
    for term in terms:
        pos = folded.find(term)
        while pos >= 0 and len(marks) < 16:
            end = positions[pos + len(term) - 1] + 1
            while end < len(source) and source[end].isalnum():  # surligne le mot entier, pas seulement sa racine
                end += 1
            marks.append([positions[pos], end])
            pos = folded.find(term, pos + len(term))
    merged: list[list[int]] = []
    for a, b in sorted(marks):
        if merged and a <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    shift = len(prefix)
    return prefix + source + suffix, [[a + shift, b + shift] for a, b in merged]


def _score(entry: Entry, terms: list[str], phrase: str) -> tuple[int, float]:
    """(nombre de termes trouvés, pertinence) : titre > résumé > contenu, bonus expression exacte."""
    found, score = 0, 0.0
    for term in terms:
        in_title = term in entry.n_title
        in_summary = term in entry.n_summary
        count = entry.n_body.count(term)
        if in_title or in_summary or count:
            found += 1
            score += 6 * in_title + 3 * in_summary + min(count, 5) * 0.4 + (1 if count else 0)
    if found and len(terms) > 1:
        if phrase in entry.n_title:
            score += 8
        elif phrase in entry.n_body:
            score += 3
    if found and entry.n_title.startswith(terms[0]):
        score += 2
    return found, score


def search(db: Session, query: str, limit: int = MAX_RESULTS) -> tuple[list[dict[str, Any]], bool]:
    """Résultats contenant tous les mots ; à défaut, les plus proches (``partial`` vrai)."""
    terms = query_terms(query)
    if not terms:
        return [], False
    phrase = normalize(_SPACE_RE.sub(" ", query.strip()))
    scored = [(found, score, entry) for entry in index(db) for found, score in [_score(entry, terms, phrase)] if found]
    complete = [(score, entry) for found, score, entry in scored if found == len(terms)]
    strong = [t for t in terms if len(t) >= 3]  # « id », « 3d »… trop courts pour un résultat approchant seul
    partial = not complete and len(terms) > 1 and bool(strong)
    if partial:
        ranked = [(_score(entry, strong, phrase), entry) for _, _, entry in scored]
        best = max((found for (found, _), _ in ranked), default=0)
        complete = [(score, entry) for (found, score), entry in ranked if found == best and best >= 1]
    complete.sort(key=lambda item: (-item[0], item[1].title))
    results: list[dict[str, Any]] = []
    for _score_value, entry in complete[:limit]:
        excerpt, marks = _excerpt(entry, terms)
        results.append(
            {"type": entry.type, "title": entry.title, "path": entry.path, "excerpt": excerpt or None, "marks": marks}
        )
    return results, partial
