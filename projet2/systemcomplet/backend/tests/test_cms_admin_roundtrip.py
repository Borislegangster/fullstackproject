"""CMS : ce que l'éditeur relit se réenregistre tel quel (menus) ; identifiants techniques déduits du titre."""

from __future__ import annotations

from typing import Any

from app.modules.cms import models as m
from tests.conftest import as_role

API = "/api/v1"


def _menu(client: Any, headers: dict[str, str], key: str) -> dict[str, Any]:
    menus = client.get(f"{API}/cms/navigation", headers=headers).json()
    return next(mn for mn in menus if mn["key"] == key)


def test_navigation_round_trip_with_new_items_and_children(client: Any, db: Any) -> None:
    _editor, eh = as_role(client, db, "MARKETING")
    for key in ("header", "mobile", "header_actions", "footer_main", "footer_services", "footer_legal"):
        first = {
            "title": f"Menu {key}",
            "items": [
                {"label": "Accueil", "link_type": "page", "page_route_key": "home"},
                {
                    "label": "Services",
                    "link_type": "path",
                    "url": "/services",
                    "children": [{"label": "Contact", "link_type": "anchor", "url": "#contact"}],
                },
            ],
        }
        assert client.put(f"{API}/cms/navigation/{key}", json=first, headers=eh).status_code == 200
        # Relecture (identifiants compris) puis ajout d'un élément : renvoyé tel quel par l'éditeur.
        menu = _menu(client, eh, key)
        assert menu["items"][0]["id"] and menu["items"][1]["children"][0]["id"]
        items = [*menu["items"], {"label": "Écrire", "link_type": "url", "url": "mailto:contact@example.com"}]
        saved = client.put(f"{API}/cms/navigation/{key}", json={"title": menu["title"], "items": items}, headers=eh)
        assert saved.status_code == 200, saved.text
        again = _menu(client, eh, key)
        assert [i["label"] for i in again["items"]] == ["Accueil", "Services", "Écrire"]
        assert again["items"][1]["children"][0]["url"] == "#contact"


def test_navigation_errors_are_readable(client: Any, db: Any) -> None:
    _editor, eh = as_role(client, db, "MARKETING")
    no_page = client.put(
        f"{API}/cms/navigation/header",
        json={"title": "En-tête", "items": [{"label": "Offres", "link_type": "page"}]},
        headers=eh,
    )
    assert no_page.status_code == 422 and "« Offres »" in no_page.text
    bad_url = client.put(
        f"{API}/cms/navigation/header",
        json={"title": "En-tête", "items": [{"label": "Blog", "link_type": "path", "url": "blog"}]},
        headers=eh,
    )
    assert bad_url.status_code == 422 and "« Blog »" in bad_url.text and "commençant par" in bad_url.text


def test_collection_slug_generated_unique_and_protected(client: Any, db: Any) -> None:
    _editor, eh = as_role(client, db, "MARKETING")
    first = client.post(f"{API}/cms/expertises", json={"name": "Études géotechniques"}, headers=eh)
    assert first.status_code == 201, first.text
    assert first.json()["slug"] == "etudes-geotechniques"
    second = client.post(f"{API}/cms/expertises", json={"name": "Études géotechniques", "slug": ""}, headers=eh)
    assert second.status_code == 201 and second.json()["slug"] == "etudes-geotechniques-2"
    typed = client.post(f"{API}/cms/expertises", json={"name": "Topographie", "slug": "Relevés Topo 2026"}, headers=eh)
    assert typed.json()["slug"] == "releves-topo-2026"
    clash = client.post(f"{API}/cms/expertises", json={"name": "Autre", "slug": "releves-topo-2026"}, headers=eh)
    assert clash.status_code == 409 and "déjà utilisée" in clash.json()["error"]["message"]

    item_id = first.json()["id"]
    kept = client.patch(f"{API}/cms/expertises/{item_id}", json={"slug": "", "summary": "Sols."}, headers=eh)
    assert kept.status_code == 200 and kept.json()["slug"] == "etudes-geotechniques"
    taken = client.patch(f"{API}/cms/expertises/{item_id}", json={"slug": "releves-topo-2026"}, headers=eh)
    assert taken.status_code == 409
    renamed = client.patch(f"{API}/cms/expertises/{item_id}", json={"slug": "Géotechnique"}, headers=eh)
    assert renamed.json()["slug"] == "geotechnique"


def test_published_slug_change_still_redirects(client: Any, db: Any) -> None:
    item = m.Expertise(slug="ancienne-adresse", name="Structure", status="published")
    db.add(item)
    db.commit()
    _admin, ah = as_role(client, db, "ADMIN")
    response = client.patch(f"{API}/cms/expertises/{item.id}", json={"slug": "nouvelle adresse"}, headers=ah)
    assert response.status_code == 200, response.text
    assert response.json()["slug"] == "nouvelle-adresse"
    redirect = db.query(m.Redirect).filter(m.Redirect.source_path == "/expertises/ancienne-adresse").one()
    assert redirect.target_path == "/expertises/nouvelle-adresse"


def test_taxonomy_banner_and_universe_identifiers(client: Any, db: Any) -> None:
    _editor, eh = as_role(client, db, "MARKETING")
    category = client.post(f"{API}/cms/blog-categories", json={"name": "Chantiers & Méthodes"}, headers=eh)
    assert category.status_code == 201, category.text
    assert category.json()["slug"] == "chantiers-methodes"
    author = client.post(f"{API}/cms/blog-authors", json={"name": "Awa Ngono"}, headers=eh)
    assert author.status_code == 201 and author.json()["slug"] == "awa-ngono"
    banner = client.post(f"{API}/cms/banners", json={"title": "Portes ouvertes"}, headers=eh)
    assert banner.status_code == 201, banner.text
    assert banner.json()["key"] == "portes-ouvertes"
    universe = client.post(f"{API}/cms/universes", json={"name": "Industrie lourde"}, headers=eh)
    assert universe.status_code == 201, universe.text
    assert universe.json()["key"] == "INDUSTRIE_LOURDE" and universe.json()["slug"] == "industrie-lourde"


def _page(client: Any, headers: dict[str, str], route_key: str, path: str, title: str = "Page") -> Any:
    body = {"route_key": route_key, "path": path, "title": title, "body": "<p>Contenu.</p>"}
    return client.post(f"{API}/cms/pages", json=body, headers=headers)


def _publish_page(client: Any, headers: dict[str, str], page_id: str) -> None:
    for target in ("in_review", "validated", "published"):
        response = client.post(f"{API}/cms/pages/{page_id}/transition", json={"target": target}, headers=headers)
        assert response.status_code == 200, response.text


def test_page_addresses_reserved_unique_and_system_pages_fixed(client: Any, db: Any) -> None:
    _admin, ah = as_role(client, db, "ADMIN")
    home = _page(client, ah, "home", "/", "Accueil")
    assert home.status_code == 201, home.text
    assert home.json()["system"] is True
    for path in ("/", "/offres/promo", "/blog", "/erp/x", "/espace-client"):
        refused = _page(client, ah, "promo", path)
        assert refused.status_code == 400 and refused.json()["error"]["code"] == "PATH_RESERVED", path
    assert _page(client, ah, "offers", "/nos-offres").json()["error"]["code"] == "SYSTEM_PAGE"

    ours = _page(client, ah, "nos-engagements", "/nos-engagements", "Nos engagements")
    assert ours.status_code == 201 and ours.json()["system"] is False
    same_path = _page(client, ah, "autre", "/nos-engagements")
    assert same_path.status_code == 409 and "« Nos engagements »" in same_path.json()["error"]["message"]
    other = _page(client, ah, "valeurs", "/valeurs", "Valeurs").json()
    taken = client.put(
        f"{API}/cms/pages/{other['id']}",
        json={"route_key": "valeurs", "path": "/nos-engagements", "title": "Valeurs"},
        headers=ah,
    )
    assert taken.status_code == 409

    moved = client.put(
        f"{API}/cms/pages/{home.json()['id']}",
        json={"route_key": "home", "path": "/accueil", "title": "Accueil"},
        headers=ah,
    )
    assert moved.status_code == 400 and moved.json()["error"]["code"] == "SYSTEM_PAGE"
    retitled = client.put(
        f"{API}/cms/pages/{home.json()['id']}",
        json={"route_key": "home", "path": "/", "title": "Bienvenue"},
        headers=ah,
    )
    assert retitled.status_code == 200
    assert client.delete(f"{API}/cms/pages/{home.json()['id']}", headers=ah).json()["error"]["code"] == "SYSTEM_PAGE"


def test_page_key_rename_keeps_menu_links(client: Any, db: Any) -> None:
    _admin, ah = as_role(client, db, "ADMIN")
    page = _page(client, ah, "equipe", "/equipe", "Équipe").json()
    menu = {"title": "En-tête", "items": [{"label": "Équipe", "link_type": "page", "page_route_key": "equipe"}]}
    assert client.put(f"{API}/cms/navigation/header", json=menu, headers=ah).status_code == 200
    renamed = client.put(
        f"{API}/cms/pages/{page['id']}",
        json={"route_key": "notre-equipe", "path": "/equipe", "title": "Équipe"},
        headers=ah,
    )
    assert renamed.status_code == 200, renamed.text
    assert _menu(client, ah, "header")["items"][0]["page_route_key"] == "notre-equipe"


def test_moving_back_to_previous_address_never_loops(client: Any, db: Any) -> None:
    _admin, ah = as_role(client, db, "ADMIN")
    page = _page(client, ah, "promo", "/promo-2026", "Promo").json()
    _publish_page(client, ah, page["id"])
    body = {"route_key": "promo", "title": "Promo", "body": "<p>Contenu.</p>"}
    assert client.put(f"{API}/cms/pages/{page['id']}", json={**body, "path": "/promo"}, headers=ah).status_code == 200
    assert (
        client.put(f"{API}/cms/pages/{page['id']}", json={**body, "path": "/promo-2026"}, headers=ah).status_code == 200
    )
    db.expire_all()
    rules = {r.source_path: r.target_path for r in db.query(m.Redirect).filter(m.Redirect.is_active.is_(True))}
    assert rules == {"/promo": "/promo-2026"}
    resolved = client.get(f"{API}/public/resolve", params={"path": "/promo-2026"}).json()
    assert resolved["type"] == "page"

    # Une redirection manuelle depuis une adresse est levée quand un contenu y est publié.
    db.add(m.Redirect(source_path="/campagne", target_path="/promo-2026", status_code=301))
    db.commit()
    campaign = _page(client, ah, "campagne", "/campagne", "Campagne").json()
    _publish_page(client, ah, campaign["id"])
    assert client.get(f"{API}/public/resolve", params={"path": "/campagne"}).json()["type"] == "page"


def test_universe_slug_change_redirects_its_offers(client: Any, db: Any) -> None:
    universe = m.Universe(key="HOME", slug="maison", name="Maison", status="published")
    db.add(universe)
    db.flush()
    db.add(m.Offer(universe_id=universe.id, slug="villa", name="Villa", status="published"))
    db.commit()
    _admin, ah = as_role(client, db, "ADMIN")
    response = client.patch(f"{API}/cms/universes/{universe.id}", json={"slug": "habitat"}, headers=ah)
    assert response.status_code == 200, response.text
    db.expire_all()
    rules = {r.source_path: r.target_path for r in db.query(m.Redirect)}
    assert rules == {"/offres/maison": "/offres/habitat", "/offres/maison/villa": "/offres/habitat/villa"}


def test_staff_reply_publishes_pending_comment_thread(client: Any, db: Any) -> None:
    post = m.BlogPost(slug="article-avis", title="Article", status="published", allow_comments=True)
    db.add(post)
    db.flush()
    pending = m.BlogComment(post_id=post.id, author_name="Awa", content="Merci pour l'article.", status="pending")
    refused = m.BlogComment(post_id=post.id, author_name="Bot", content="Promo !!!", status="spam")
    db.add_all([pending, refused])
    db.commit()
    _editor, eh = as_role(client, db, "MARKETING")
    body = {"author_name": "GLOBUS", "content": "Merci Awa !"}
    assert client.post(f"{API}/cms/blog-comments/{refused.id}/reply", json=body, headers=eh).status_code == 400
    assert client.post(f"{API}/cms/blog-comments/{pending.id}/reply", json=body, headers=eh).status_code == 201
    shown = client.get(f"{API}/public/blog/posts/article-avis").json()
    thread = shown["comments"]
    assert [c["author_name"] for c in thread] == ["Awa"] and thread[0]["replies"][0]["content"] == "Merci Awa !"


def test_manual_redirects_are_safe(client: Any, db: Any) -> None:
    _admin, ah = as_role(client, db, "ADMIN")

    def create(source: str, target: str | None, code: int = 301) -> Any:
        body = {"source_path": source, "target_path": target, "status_code": code}
        return client.post(f"{API}/cms/redirects", json=body, headers=ah)

    first = create("/ancienne-offre/", "/offres/")
    assert first.status_code == 201, first.text
    assert (first.json()["source_path"], first.json()["target_path"]) == ("/ancienne-offre", "/offres")
    assert create("/ancienne-offre", "/blog").status_code == 409
    assert create("/b", "/c").status_code == 201
    loop = create("/c", "/b")
    assert loop.status_code == 400 and loop.json()["error"]["code"] == "REDIRECT_LOOP"
    assert create("/", "/accueil").json()["error"]["code"] == "INVALID_REDIRECT"
    assert create("/erp/ancien", "/erp").json()["error"]["code"] == "INVALID_REDIRECT"
    assert create("/promo", "www.exemple.com").json()["error"]["code"] == "INVALID_REDIRECT"
    assert create("/retire", None, 410).status_code == 201
    assert create("/vers-site", "https://exemple.com/page").status_code == 201
