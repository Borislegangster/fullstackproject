"""Vitrine illustrée : image de fond de section, visuels de blocs (chiffres, preuves, FAQ, citation, formulaire…),
sur-titres et styles de présentation — tout passe par la médiathèque (V4-MEDIA-07) ; identifiants de suivi stricts."""

from __future__ import annotations

from typing import Any

from tests.conftest import login, make_user
from tests.test_lot1_cms_crm import _upload


def _publish(client: Any, headers: dict[str, str], page_id: str) -> None:
    for target in ("in_review", "validated", "published"):
        resp = client.post(f"/api/v1/cms/pages/{page_id}/transition", headers=headers, json={"target": target})
        assert resp.status_code == 200, resp.text


def test_section_background_and_block_visuals_are_resolved(client: Any, db: Any) -> None:
    headers = login(client, make_user(db, roles=["MARKETING"]).email)
    media_id = _upload(client, headers)
    portrait_id = media_id
    page = client.post(
        "/api/v1/cms/pages",
        headers=headers,
        json={
            "route_key": "about",
            "path": "/a-propos",
            "title": "À propos",
            "sections": [
                {
                    "key": "preuves",
                    "settings": {"background": "night", "media_id": media_id},
                    "blocks": [
                        {
                            "data": {
                                "kind": "stats",
                                "eyebrow": "Preuves chiffrées",
                                "title": "En chiffres",
                                "source": "inline",
                                "media_id": media_id,
                                "items": [{"value": 48, "label": "Projets"}],
                            }
                        },
                        {
                            "data": {
                                "kind": "features",
                                "style": "bento",
                                "eyebrow": "Atouts",
                                "items": [{"title": "BIM", "media_id": media_id}],
                            }
                        },
                        {
                            "data": {
                                "kind": "quote",
                                "text": "La maîtrise rassure.",
                                "author": "Direction",
                                "media_id": portrait_id,
                                "background_media_id": media_id,
                            }
                        },
                        {
                            "data": {
                                "kind": "rich_text",
                                "title": "Notre histoire",
                                "html": "<p>Depuis 2012.</p>",
                                "media_id": media_id,
                                "media_position": "left",
                            }
                        },
                        {"data": {"kind": "testimonials", "mode": "latest", "layout": "carousel", "eyebrow": "Avis"}},
                        {
                            "data": {
                                "kind": "comparison",
                                "columns": ["Classique", "GLOBUS"],
                                "highlight_column": 1,
                                "rows": [{"label": "Suivi", "values": ["non", "oui"]}],
                            }
                        },
                    ],
                }
            ],
        },
    )
    assert page.status_code == 201, page.text
    _publish(client, headers, page.json()["id"])
    public = client.get("/api/v1/public/pages/about").json()
    section = public["sections"][0]
    assert section["settings"]["background"] == "night" and section["settings"]["media"]["id"] == media_id
    stats, features, quote, rich, testimonials, comparison = section["blocks"]
    assert stats["media"]["id"] == media_id and stats["eyebrow"] == "Preuves chiffrées"
    assert features["style"] == "bento" and features["items"][0]["media"]["id"] == media_id
    assert quote["background_media"]["id"] == media_id and quote["media"]["id"] == portrait_id
    assert rich["media_position"] == "left" and rich["media"]["url"]
    assert testimonials["layout"] == "carousel" and comparison["highlight_column"] == 1


def test_block_visuals_must_come_from_media_library(client: Any, db: Any) -> None:
    headers = login(client, make_user(db, roles=["MARKETING"]).email)
    resp = client.post(
        "/api/v1/cms/pages",
        headers=headers,
        json={
            "route_key": "contact",
            "path": "/contact",
            "title": "Contact",
            "sections": [
                {
                    "key": "c",
                    "blocks": [
                        {
                            "data": {
                                "kind": "form",
                                "form_key": "contact",
                                "media_id": "7f9c0b1e-0000-4000-8000-000000000000",
                            }
                        }
                    ],
                }
            ],
        },
    )
    assert resp.status_code in (400, 404, 422), resp.text
    bad_style = client.post(
        "/api/v1/cms/pages",
        headers=headers,
        json={
            "route_key": "x",
            "path": "/x",
            "title": "X",
            "sections": [
                {"key": "s", "blocks": [{"data": {"kind": "features", "style": "flashy", "items": [{"title": "A"}]}}]}
            ],
        },
    )
    assert bad_style.status_code == 422


def test_tracking_identifiers_are_strict(client: Any, db: Any) -> None:
    headers = login(client, make_user(db, roles=["ADMIN"]).email)
    ok = client.put(
        "/api/v1/cms/site-settings",
        headers=headers,
        json={"tracking": {"ga4_id": "G-ABC123XYZ", "meta_pixel": "123456789012"}},
    )
    assert ok.status_code == 200, ok.text
    injected = client.put(
        "/api/v1/cms/site-settings", headers=headers, json={"tracking": {"meta_pixel": "1');alert(1);//"}}
    )
    assert injected.status_code == 400 and injected.json()["error"]["code"] == "INVALID_TRACKING"
    unknown = client.put("/api/v1/cms/site-settings", headers=headers, json={"tracking": {"hotjar": "1234"}})
    assert unknown.status_code == 400
