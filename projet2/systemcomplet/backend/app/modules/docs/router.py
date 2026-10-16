"""API de la documentation intégrée : sommaire, page, recherche et aide contextuelle, filtrés selon les espaces,
permissions et rôles de l'utilisateur connecté (contrôle côté serveur, rien n'est envoyé sans autorisation)."""

from __future__ import annotations

from typing import Any
from urllib.parse import parse_qsl, urlsplit

from fastapi import APIRouter, Depends, Query

from app.core.deps import Principal, get_principal
from app.core.errors import NotFound
from app.modules.docs import engine

router = APIRouter(prefix="/documentation", tags=["Documentation"])


def viewer_of(principal: Principal) -> engine.Viewer:
    from app.modules.identity.service import features_for, spaces_for

    spaces = spaces_for(principal.user, set(principal.permissions))
    return engine.Viewer(
        permissions=frozenset(principal.permissions),
        roles=frozenset(principal.roles),
        spaces=frozenset(spaces),
        features=frozenset(features_for(principal.user, spaces)),
    )


@router.get("")
def summary(principal: Principal = Depends(get_principal)) -> dict[str, Any]:
    """Sommaire : seules les pages que l'utilisateur est autorisé à lire."""
    viewer = viewer_of(principal)
    docs = engine.visible_docs(viewer)
    spaces = [s for s in engine.SPACES if any(d.space == s for d in docs)]
    return {
        "spaces": [{"key": s, "label": engine.SPACE_LABELS[s]} for s in spaces],
        "items": [
            {
                "id": d.id,
                "title": d.title,
                "space": d.space,
                "section": d.section,
                "summary": d.summary,
                "route": d.routes[0] if d.routes else None,
            }
            for d in docs
        ],
    }


@router.get("/search")
def search(q: str = Query(min_length=2, max_length=120), principal: Principal = Depends(get_principal)) -> list[dict]:
    return engine.search(viewer_of(principal), q)


@router.get("/route")
def for_route(
    path: str = Query(min_length=1, max_length=500), principal: Principal = Depends(get_principal)
) -> dict[str, Any]:
    """Aide contextuelle : la page de documentation de l'écran ``path`` (requête « ?onglet=… » comprise)."""
    parts = urlsplit(path)
    doc = engine.doc_for_route(viewer_of(principal), parts.path, dict(parse_qsl(parts.query)))
    if doc is None:
        raise NotFound("Aucune page de documentation pour cet écran")
    return {"id": doc.id, "title": doc.title}


@router.get("/{doc_id}")
def read(doc_id: str, principal: Principal = Depends(get_principal)) -> dict[str, Any]:
    viewer = viewer_of(principal)
    doc = engine.all_docs().get(doc_id)
    # Même réponse pour une page inexistante ou non autorisée : son existence n'est pas révélée.
    if doc is None or not engine.can_read(doc, viewer):
        raise NotFound("Page de documentation introuvable")
    return engine.render(doc, viewer)
