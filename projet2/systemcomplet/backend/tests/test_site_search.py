"""Recherche du site vitrine : contenu des sections indexé, accents / pluriels, contenu non public exclu."""

from __future__ import annotations

from typing import Any

from app.modules.cms import models as m
from app.modules.cms.search import query_terms, reset_cache


def _seed(db: Any) -> None:
    page = m.CmsPage(route_key="t-accueil", path="/t-accueil", title="Accueil test", status="published")
    db.add(page)
    db.flush()
    section = m.CmsSection(page_id=page.id, key="univers", title="Votre projet, votre univers", sort_order=1)
    db.add(section)
    db.flush()
    db.add(
        m.CmsBlock(
            section_id=section.id,
            kind="text",
            data={
                "eyebrow": "Nos univers",
                "text": "<p>Nous réalisons des <strong>études béton armé</strong> à Douala.</p>",
                "media_id": "11111111-2222-3333-4444-555555555555",
                "href": "/contact",
                "cta": {"label": "Être rappelé quartz", "href": "/contact#rappel", "style": "secondary"},
            },
        )
    )
    hidden = m.CmsSection(page_id=page.id, key="cache", title="Section masquée", visible=False, sort_order=2)
    db.add(hidden)
    db.flush()
    db.add(m.CmsBlock(section_id=hidden.id, kind="text", data={"text": "zircon confidentiel"}))
    db.add(m.CmsPage(route_key="t-brouillon", path="/t-brouillon", title="Brouillon zircon", status="draft"))
    universe = m.Universe(key="TST", slug="t-home", name="Univers Maison", tagline="Voir sa maison", status="published")
    db.add(universe)
    db.flush()
    db.add(
        m.Offer(
            universe_id=universe.id,
            slug="t-villa",
            name="Villa clé en main",
            summary="Conception et construction de maisons individuelles.",
            status="published",
        )
    )
    db.add(m.HelpArticle(slug="t-aide", title="Payer en ligne zircon", audience="client", status="published"))
    db.add(m.FaqItem(question="Combien coûte une étude ?", answer="<p>Le devis est gratuit.</p>", status="published"))
    db.commit()
    reset_cache()


def _search(client: Any, q: str) -> dict[str, Any]:
    response = client.get("/api/v1/public/search", params={"q": q})
    assert response.status_code == 200, response.text
    return response.json()


def test_query_terms_fold_accents_stopwords_and_plurals() -> None:
    assert query_terms("Les Études de BÉTON") == ["etud", "beton"]
    assert query_terms("maisons") == ["maison"]
    assert query_terms("de la") == ["de", "la"]  # uniquement des mots vides : conservés
    assert query_terms("!") == []


def test_search_indexes_published_sections_and_collections(client: Any, db: Any) -> None:
    _seed(db)
    data = _search(client, "univers")
    paths = [r["path"] for r in data["results"]]
    assert "/t-accueil" in paths and "/offres/t-home" in paths

    hit = next(r for r in _search(client, "beton arme")["results"] if r["path"] == "/t-accueil")
    marked = [hit["excerpt"][a:b] for a, b in hit["marks"]]
    assert "béton" in marked and "armé" in marked  # surlignage sur le texte réel (accents conservés)
    univers = next(r for r in data["results"] if r["path"] == "/t-accueil")
    assert "univers" in [univers["excerpt"][a:b].lower() for a, b in univers["marks"]]  # mot entier surligné
    assert "<strong>" not in hit["excerpt"]

    offers = _search(client, "Maisons")["results"]
    assert any(r["path"] == "/offres/t-home/t-villa" for r in offers)
    assert any(r["type"] == "faq" for r in _search(client, "etude")["results"])


def test_search_excludes_hidden_draft_and_private_content(client: Any, db: Any) -> None:
    _seed(db)
    data = _search(client, "zircon")
    assert data["results"] == [] and data["total"] == 0  # section masquée, brouillon, aide réservée aux clients
    assert _search(client, "11111111")["results"] == []  # identifiants techniques non indexés
    assert _search(client, "quartz")["results"] == []  # libellés de boutons non indexés
    assert not any("11111111" in (r["excerpt"] or "") for r in _search(client, "univers")["results"])


def test_search_falls_back_to_closest_results(client: Any, db: Any) -> None:
    _seed(db)
    data = _search(client, "villa piscine")
    assert data["partial"] is True
    assert [r["path"] for r in data["results"]] == ["/offres/t-home/t-villa"]
    exact = _search(client, "villa construction")
    assert exact["partial"] is False and exact["results"][0]["path"] == "/offres/t-home/t-villa"
    assert client.get("/api/v1/public/search", params={"q": "a"}).status_code == 422
