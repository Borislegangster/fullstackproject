"""Documentation intégrée (ERP, espace client, extranet).

Le contenu est versionné avec le code (``content/<espace>/*.md``) : en-tête ``---`` (identifiant, titre, espace,
rubrique, écrans couverts, permissions d'accès) puis un Markdown restreint. Les procédures réservées sont entourées
de blocs gardés, retirés côté serveur pour qui n'y a pas droit — rien n'est envoyé au navigateur sans autorisation ::

    ::: perm finance:approve, finance:pay     (l'une des permissions)
    ### Approuver un paiement
    1. ...
    :::

Gardes disponibles : ``perm`` (l'une des permissions), ``role`` (l'un des rôles), ``space`` (l'un des espaces :
erp, client, extranet_supplier, extranet_subcontractor). Les blocs s'imbriquent (conditions cumulées).

Lecture : un utilisateur interne lit la documentation ERP selon ses permissions ; le personnel en relation avec les
clients ou les partenaires (``SUPPORT_PERMISSIONS``) lit aussi leurs guides en « vue support » (gardes propres à ces
espaces levées) pour les accompagner. Un client ne lit que le guide client ; un partenaire, que les pages extranet
de son type (fournisseur / sous-traitant).
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

CONTENT_DIR = Path(__file__).parent / "content"
SPACES = ("erp", "client", "extranet")
SPACE_LABELS = {"erp": "ERP", "client": "Espace client", "extranet": "Extranet partenaires"}
SECTION_ORDER: dict[str, list[str]] = {
    "erp": [
        "Prise en main",
        "Pilotage",
        "Projets",
        "Chantier (fiche projet)",
        "Achats et logistique",
        "Sous-traitance",
        "Finance",
        "Commercial",
        "RH et QHSE",
        "Site web",
        "Communication",
        "Administration",
    ],
    "client": ["Bienvenue", "Mon projet", "Immersion", "Échanges et services"],
    "extranet": ["Bienvenue", "Sous-traitance", "Fournitures", "Facturation", "Échanges et compte"],
}
GATE_KINDS = ("perm", "role", "space")
# Permissions internes donnant accès aux guides client / extranet (accompagnement, assistance).
SUPPORT_PERMISSIONS: dict[str, frozenset[str]] = {
    "client": frozenset({"projects:publish_client", "crm:read", "support:write", "billing:read", "users:write"}),
    "extranet": frozenset(
        {"procurement:read", "suppliers:read", "deliveries:read", "subcontracting:read", "disputes:read", "users:write"}
    ),
}


class DocFormatError(ValueError):
    """Fichier de documentation mal formé (détecté au chargement et par les tests)."""


# ---------------------------------------------------------------------------- modèle
@dataclass(frozen=True)
class Gate:
    kind: str  # perm / role / space
    values: tuple[str, ...]


@dataclass
class Block:
    type: str  # h2, h3, p, ul, ol, note, warning, tip, table, gate
    text: str = ""
    items: list[str] = field(default_factory=list)
    rows: list[list[str]] = field(default_factory=list)
    gate: Gate | None = None
    children: list[Block] = field(default_factory=list)


@dataclass
class Doc:
    id: str
    title: str
    space: str
    section: str
    order: int
    summary: str
    routes: list[str]
    perms: tuple[str, ...]
    roles: tuple[str, ...]
    spaces: tuple[str, ...]
    features: tuple[str, ...]
    keywords: list[str]
    related: list[str]
    blocks: list[Block]
    source: str


@dataclass(frozen=True)
class Viewer:
    permissions: frozenset[str]
    roles: frozenset[str]
    spaces: frozenset[str]
    features: frozenset[str] = frozenset()  # modules optionnels activés (ex. « referrals »)

    @property
    def internal(self) -> bool:
        return "erp" in self.spaces


# ---------------------------------------------------------------------------- analyse
_LIST_RE = re.compile(r"^\s*(?:-|\*)\s+(.*)$")
_OL_RE = re.compile(r"^\s*\d+[.)]\s+(.*)$")


def _front_matter(text: str, source: str) -> tuple[dict[str, Any], str]:
    if not text.startswith("---"):
        raise DocFormatError(f"{source} : en-tête --- manquant")
    end = text.find("\n---", 3)
    if end < 0:
        raise DocFormatError(f"{source} : en-tête non refermé")
    meta: dict[str, Any] = {}
    for raw in text[3:end].strip().splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if ":" not in raw:
            raise DocFormatError(f"{source} : ligne d'en-tête invalide « {raw} »")
        key, value = raw.split(":", 1)
        value = value.strip()
        if value.startswith("[") and value.endswith("]"):
            meta[key.strip()] = [v.strip() for v in value[1:-1].split(",") if v.strip()]
        else:
            meta[key.strip()] = value
    return meta, text[end + 4 :]


def _parse_blocks(body: str, source: str) -> list[Block]:
    root: list[Block] = []
    stack: list[list[Block]] = [root]
    lines = body.splitlines()
    i = 0
    paragraph: list[str] = []

    def flush() -> None:
        if paragraph:
            stack[-1].append(Block("p", text=" ".join(s.strip() for s in paragraph)))
            paragraph.clear()

    while i < len(lines):
        line = lines[i].rstrip()
        stripped = line.strip()
        if stripped.startswith(":::"):
            flush()
            spec = stripped[3:].strip()
            if not spec:
                if len(stack) == 1:
                    raise DocFormatError(f"{source}:{i + 1} : « ::: » fermant sans bloc ouvert")
                stack.pop()
            else:
                kind, _, rest = spec.partition(" ")
                values = tuple(v.strip() for v in rest.replace("|", ",").split(",") if v.strip())
                if kind not in GATE_KINDS or not values:
                    raise DocFormatError(f"{source}:{i + 1} : garde inconnue « {spec} »")
                block = Block("gate", gate=Gate(kind, values))
                stack[-1].append(block)
                stack.append(block.children)
            i += 1
            continue
        if not stripped:
            flush()
            i += 1
            continue
        if stripped.startswith("### ") or stripped.startswith("## "):
            flush()
            level = "h3" if stripped.startswith("### ") else "h2"
            stack[-1].append(Block(level, text=stripped.lstrip("#").strip()))
            i += 1
            continue
        if stripped.startswith(">"):
            flush()
            quote: list[str] = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip()[1:].strip())
                i += 1
            kind = "note"
            if quote and re.match(r"^\[!(NOTE|WARNING|TIP)\]$", quote[0], re.I):
                kind = {"NOTE": "note", "WARNING": "warning", "TIP": "tip"}[quote[0][2:-1].upper()]
                quote = quote[1:]
            stack[-1].append(Block(kind, text=" ".join(q for q in quote if q)))
            continue
        if stripped.startswith("|"):
            flush()
            rows: list[list[str]] = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{3,}:?", c) for c in cells):
                    rows.append(cells)
                i += 1
            stack[-1].append(Block("table", rows=rows))
            continue
        list_match = _LIST_RE.match(line) or _OL_RE.match(line)
        if list_match:
            flush()
            ordered = bool(_OL_RE.match(line))
            items: list[str] = []
            while i < len(lines):
                current = lines[i]
                m = (_OL_RE if ordered else _LIST_RE).match(current)
                if m:
                    items.append(m.group(1).strip())
                elif current.startswith("   ") and current.strip() and items:
                    items[-1] += " " + current.strip()
                else:
                    break
                i += 1
            stack[-1].append(Block("ol" if ordered else "ul", items=items))
            continue
        paragraph.append(stripped)
        i += 1
    flush()
    if len(stack) != 1:
        raise DocFormatError(f"{source} : bloc « ::: » non refermé")
    return root


def parse_doc(text: str, source: str) -> Doc:
    meta, body = _front_matter(text, source)
    for key in ("id", "title", "space", "section", "order", "summary"):
        if not meta.get(key):
            raise DocFormatError(f"{source} : champ « {key} » requis")
    if meta["space"] not in SPACES:
        raise DocFormatError(f"{source} : espace inconnu « {meta['space']} »")
    if meta["section"] not in SECTION_ORDER[meta["space"]]:
        raise DocFormatError(f"{source} : rubrique inconnue « {meta['section']} » pour {meta['space']}")
    routes = meta.get("routes", [])
    if isinstance(routes, str):
        routes = [routes]
    if meta.get("route"):
        routes = [meta["route"], *routes]

    def listed(key: str) -> tuple[str, ...]:
        value = meta.get(key, [])
        return tuple([value] if isinstance(value, str) else value)

    return Doc(
        id=meta["id"],
        title=meta["title"],
        space=meta["space"],
        section=meta["section"],
        order=int(meta["order"]),
        summary=meta["summary"],
        routes=list(routes),
        perms=listed("perms"),
        roles=listed("roles"),
        spaces=listed("spaces"),
        features=listed("features"),
        keywords=list(listed("keywords")),
        related=list(listed("related")),
        blocks=_parse_blocks(body, source),
        source=source,
    )


def _signature() -> tuple[tuple[str, float], ...]:
    return tuple(sorted((str(p), p.stat().st_mtime) for p in CONTENT_DIR.rglob("*.md")))


@lru_cache(maxsize=4)
def _load(signature: tuple[tuple[str, float], ...]) -> dict[str, Doc]:
    docs: dict[str, Doc] = {}
    for path, _mtime in signature:
        doc = parse_doc(Path(path).read_text(encoding="utf-8"), Path(path).relative_to(CONTENT_DIR).as_posix())
        if doc.id in docs:
            raise DocFormatError(f"identifiant en double « {doc.id} » ({docs[doc.id].source}, {doc.source})")
        docs[doc.id] = doc
    return docs


def all_docs() -> dict[str, Doc]:
    """Documentation chargée (rechargée automatiquement si un fichier change)."""
    return _load(_signature())


# ---------------------------------------------------------------------------- droits
def support_view(viewer: Viewer, doc_space: str) -> bool:
    """Utilisateur interne habilité à accompagner les clients / partenaires : il lit leur guide en entier."""
    return viewer.internal and bool(SUPPORT_PERMISSIONS.get(doc_space, frozenset()) & viewer.permissions)


def gate_open(gate: Gate, viewer: Viewer, doc_space: str) -> bool:
    if support_view(viewer, doc_space):
        return True
    if gate.kind == "perm":
        return any(p in viewer.permissions for p in gate.values)
    if gate.kind == "role":
        return any(r in viewer.roles for r in gate.values)
    return any(s in viewer.spaces for s in gate.values)


def can_read(doc: Doc, viewer: Viewer) -> bool:
    if doc.space == "erp":
        allowed = viewer.internal
    elif doc.space == "client":
        allowed = "client" in viewer.spaces or support_view(viewer, "client")
    else:
        allowed = bool({"extranet_supplier", "extranet_subcontractor"} & viewer.spaces) or support_view(
            viewer, "extranet"
        )
    if not allowed:
        return False
    # Module optionnel désactivé par l'administration : sa page d'aide est masquée (sauf vue support).
    if doc.features and not support_view(viewer, doc.space) and not set(doc.features) <= viewer.features:
        return False
    return all(
        gate_open(gate, viewer, doc.space)
        for gate in (Gate("perm", doc.perms), Gate("role", doc.roles), Gate("space", doc.spaces))
        if gate.values
    )


def visible_docs(viewer: Viewer) -> list[Doc]:
    docs = [d for d in all_docs().values() if can_read(d, viewer)]
    return sorted(
        docs, key=lambda d: (SPACES.index(d.space), SECTION_ORDER[d.space].index(d.section), d.order, d.title)
    )


# ---------------------------------------------------------------------------- rendu filtré
_INLINE_RE = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`")


def inline(text: str, readable: set[str]) -> list[dict[str, str]]:
    """Texte enrichi : gras, code, liens (écran, autre page de documentation, site externe)."""
    spans: list[dict[str, str]] = []
    pos = 0
    for m in _INLINE_RE.finditer(text):
        if m.start() > pos:
            spans.append({"t": "text", "v": text[pos : m.start()]})
        if m.group(1) is not None:
            label, href = m.group(1), m.group(2)
            if href.startswith("doc:"):
                target = href[4:]
                spans.append({"t": "doc", "v": label, "id": target} if target in readable else {"t": "b", "v": label})
            elif href.startswith("/"):
                spans.append({"t": "route", "v": label, "href": href})
            elif href.startswith("https://"):
                spans.append({"t": "ext", "v": label, "href": href})
            else:
                spans.append({"t": "text", "v": label})
        elif m.group(3) is not None:
            spans.append({"t": "b", "v": m.group(3)})
        else:
            spans.append({"t": "code", "v": m.group(4)})
        pos = m.end()
    if pos < len(text):
        spans.append({"t": "text", "v": text[pos:]})
    return spans


def slug(text: str) -> str:
    base = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", base).strip("-") or "section"


def _render(blocks: list[Block], viewer: Viewer, doc_space: str, readable: set[str]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for block in blocks:
        if block.type == "gate":
            if block.gate and gate_open(block.gate, viewer, doc_space):
                out.extend(_render(block.children, viewer, doc_space, readable))
            continue
        if block.type in ("h2", "h3"):
            out.append({"type": block.type, "text": block.text, "anchor": slug(block.text)})
        elif block.type in ("ul", "ol"):
            out.append({"type": block.type, "items": [inline(item, readable) for item in block.items]})
        elif block.type == "table":
            out.append({"type": "table", "rows": [[inline(cell, readable) for cell in row] for row in block.rows]})
        else:
            out.append({"type": block.type, "spans": inline(block.text, readable)})
    # Un intertitre sans contenu (procédures toutes masquées) n'est pas affiché ; répété jusqu'à stabilité
    # (un h2 dont tous les h3 ont disparu disparaît à son tour).
    rank = {"h2": 2, "h3": 3}
    while True:
        cleaned: list[dict[str, Any]] = []
        for idx, item in enumerate(out):
            if item["type"] in rank:
                nxt = out[idx + 1] if idx + 1 < len(out) else None
                if nxt is None or (nxt["type"] in rank and rank[nxt["type"]] <= rank[item["type"]]):
                    continue
            cleaned.append(item)
        if len(cleaned) == len(out):
            return cleaned
        out = cleaned


def render(doc: Doc, viewer: Viewer, readable: set[str] | None = None) -> dict[str, Any]:
    readable = readable if readable is not None else {d.id for d in visible_docs(viewer)}
    blocks = _render(doc.blocks, viewer, doc.space, readable)
    return {
        "id": doc.id,
        "title": doc.title,
        "space": doc.space,
        "space_label": SPACE_LABELS[doc.space],
        "section": doc.section,
        "summary": doc.summary,
        "route": doc.routes[0] if doc.routes else None,
        "blocks": blocks,
        "toc": [{"text": b["text"], "anchor": b["anchor"]} for b in blocks if b["type"] == "h2"],
        "related": [{"id": r, "title": all_docs()[r].title} for r in doc.related if r in readable],
    }


# ---------------------------------------------------------------------------- recherche
def _norm(text: str) -> str:
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()


def _plain(blocks: list[dict[str, Any]]) -> list[tuple[str, str]]:
    """(intertitre courant, texte) pour chaque bloc rendu."""
    heading = ""
    out: list[tuple[str, str]] = []
    for b in blocks:
        if b["type"] in ("h2", "h3"):
            heading = b["text"]
            out.append((heading, b["text"]))
        elif "spans" in b:
            out.append((heading, "".join(s["v"] for s in b["spans"])))
        elif "items" in b:
            out.extend((heading, "".join(s["v"] for s in item)) for item in b["items"])
        elif "rows" in b:
            out.extend((heading, " ".join("".join(s["v"] for s in cell) for cell in row)) for row in b["rows"])
    return out


def search(viewer: Viewer, query: str, limit: int = 30) -> list[dict[str, Any]]:
    terms = [t for t in re.split(r"\W+", _norm(query)) if len(t) >= 2]
    if not terms:
        return []
    hits: list[tuple[int, dict[str, Any]]] = []
    docs = visible_docs(viewer)
    readable = {d.id for d in docs}
    for doc in docs:
        rendered = render(doc, viewer, readable)
        chunks = _plain(rendered["blocks"])
        haystack = _norm(" ".join([doc.title, doc.summary, " ".join(doc.keywords), *[c for _, c in chunks]]))
        if not all(t in haystack for t in terms):
            continue
        score = sum(5 for t in terms if t in _norm(doc.title)) + sum(
            2 for t in terms if t in _norm(" ".join(doc.keywords))
        )
        best_heading, best_text, best = "", doc.summary, -1
        for heading, text in chunks:
            n = _norm(text)
            matched = sum(1 for t in terms if t in n) + sum(1 for t in terms if t in _norm(heading))
            if matched > best:
                best_heading, best_text, best = heading, text, matched
        score += max(best, 0)
        hits.append(
            (
                score,
                {
                    "id": doc.id,
                    "title": doc.title,
                    "space": doc.space,
                    "section": doc.section,
                    "heading": best_heading or None,
                    "anchor": slug(best_heading) if best_heading else None,
                    "snippet": best_text[:220],
                },
            )
        )
    hits.sort(key=lambda h: -h[0])
    return [h for _, h in hits[:limit]]


# ---------------------------------------------------------------------------- aide contextuelle
def _route_score(pattern: str, path: str, query: dict[str, str]) -> int:
    pat_path, _, pat_query = pattern.partition("?")
    pat_parts = [p for p in pat_path.split("/") if p]
    parts = [p for p in path.split("/") if p]
    if len(parts) < len(pat_parts):
        return -1
    for expected, actual in zip(pat_parts, parts, strict=False):
        if expected != "*" and expected != actual:
            return -1
    score = sum(2 for p in pat_parts if p != "*") + len(pat_parts)
    if pat_query:
        for pair in pat_query.split("&"):
            key, _, value = pair.partition("=")
            if query.get(key) != value:
                return -1
            score += 3
    if len(parts) == len(pat_parts):
        score += 1
    return score


def doc_for_route(viewer: Viewer, path: str, query: dict[str, str] | None = None) -> Doc | None:
    """Page de documentation la plus précise pour l'écran ``path`` (préfixe le plus long, onglet compris)."""
    best: tuple[int, Doc] | None = None
    for doc in visible_docs(viewer):
        for pattern in doc.routes:
            score = _route_score(pattern, path, query or {})
            if score >= 0 and (best is None or score > best[0]):
                best = (score, doc)
    return best[1] if best else None


__all__ = [
    "SECTION_ORDER",
    "SPACES",
    "SPACE_LABELS",
    "Doc",
    "DocFormatError",
    "Viewer",
    "all_docs",
    "can_read",
    "doc_for_route",
    "parse_doc",
    "render",
    "search",
    "visible_docs",
]
