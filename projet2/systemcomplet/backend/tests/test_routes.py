"""Table de routage : une même paire (méthode, chemin) déclarée par deux routeurs rend la seconde inatteignable
(la première l'emporte) et écrase son schéma dans l'OpenAPI, donc dans les formulaires générés du web et du mobile."""

from __future__ import annotations

import re
from collections import Counter
from collections.abc import Iterable, Iterator
from typing import Any

from fastapi.routing import APIRoute


def _routes(routes: Iterable[Any]) -> Iterator[tuple[Any, str]]:
    """Routes effectives (chemin complet, préfixes compris), y compris celles des routeurs inclus (FastAPI ≥ 0.140)."""
    for route in routes:
        if hasattr(route, "effective_route_contexts"):
            for ctx in route.effective_route_contexts():
                yield ctx.original_route, ctx.path
        else:
            yield route, getattr(route, "path", "")


def test_no_method_and_path_declared_twice() -> None:
    from app.main import app

    seen: Counter[tuple[str, str]] = Counter()
    api_routes = 0
    for route, path in _routes(app.routes):
        api_routes += isinstance(route, APIRoute)
        # {equipment_id} et {id} désignent le même segment : seule la forme du chemin compte pour le routage
        shape = re.sub(r"\{[^}]*\}", "{}", path)
        for method in getattr(route, "methods", None) or {"WEBSOCKET"}:
            seen[(method, shape)] += 1
    assert api_routes > 500, "parcours de la table de routage incomplet"
    assert [key for key, count in seen.items() if count > 1] == []
