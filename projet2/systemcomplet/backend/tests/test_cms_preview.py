"""Aperçu fidèle des collections CMS (brouillons compris) et annuaire des rôles pour les formulaires."""

from __future__ import annotations

from typing import Any

from app.modules.cms import models as m
from tests.conftest import as_role

API = "/api/v1"


def test_draft_preview_renders_public_page_and_card(client: Any, db: Any) -> None:
    draft = m.Expertise(slug="t-geotechnique", name="Géotechnique", summary="Sols et fondations.", status="draft")
    quote = m.Testimonial(author_name="Awa N.", quote="Chantier livré à l'heure.", status="draft")
    db.add_all([draft, quote])
    db.commit()
    _editor, eh = as_role(client, db, "MARKETING")

    preview = client.get(f"{API}/cms/collections/expertises/{draft.id}/preview", headers=eh).json()
    assert preview["path"] == "/expertises/t-geotechnique" and preview["status"] == "draft"
    assert preview["card"]["kind"] == "expertises" and preview["card"]["item"]["name"] == "Géotechnique"
    token = preview["token"]
    # La page publique refuse le brouillon ; le jeton d'aperçu en donne le rendu exact (même charge utile).
    assert client.get(f"{API}/public/expertises/t-geotechnique").status_code == 404
    shown = client.get(f"{API}/public/preview/{token}")
    assert shown.status_code == 200 and shown.headers["cache-control"] == "no-store"
    assert shown.json()["kind"] == "expertises" and shown.json()["detail"]["slug"] == "t-geotechnique"
    assert client.get(f"{API}/public/preview/{token[:-3]}abc").status_code == 404
    assert client.get(f"{API}/public/preview/nimporte.quoi").status_code == 404

    card_only = client.get(f"{API}/cms/collections/testimonials/{quote.id}/preview", headers=eh).json()
    assert card_only["token"] is None and card_only["path"] is None
    assert card_only["card"]["kind"] == "testimonials" and card_only["card"]["item"]["quote"].startswith("Chantier")

    _client_user, ch = as_role(client, db, "CLIENT", org_kind="client")
    assert client.get(f"{API}/cms/collections/expertises/{draft.id}/preview", headers=ch).status_code == 403


def test_roles_directory_for_internal_users_only(client: Any, db: Any) -> None:
    _tech, th = as_role(client, db, "TECHNICIEN")
    roles = client.get(f"{API}/directory/roles", headers=th).json()
    codes = {r["code"] for r in roles}
    assert {"COMMERCIAL", "DIRECTION"} <= codes and "CLIENT" not in codes
    assert all(set(r) == {"code", "name", "description"} for r in roles)
    _client_user, ch = as_role(client, db, "CLIENT", org_kind="client")
    assert client.get(f"{API}/directory/roles", headers=ch).status_code == 403


def test_form_definition_saved_from_visual_editor(client: Any, db: Any, admin_headers: dict[str, str]) -> None:
    body = {
        "key": "devis-toiture",
        "title": "Devis toiture",
        "fields": [
            {"name": "first_name", "label": "Prénom", "type": "text", "required": True},
            {"name": "email", "label": "E-mail", "type": "email", "required": True},
            {"name": "timeline", "label": "Délai souhaité", "type": "select", "options": ["Moins de 3 mois"]},
        ],
        "consents": [{"key": "contact", "label": "J'accepte d'être recontacté(e).", "required": True}],
        "destination": "crm_lead",
        "notify_roles": ["COMMERCIAL", "DIRECTION"],
        "min_fill_seconds": 4,
        "is_active": True,
    }
    created = client.post(f"{API}/cms/forms", headers=admin_headers, json=body)
    assert created.status_code == 201, created.text
    assert created.json()["notify_roles"] == ["COMMERCIAL", "DIRECTION"]
    public = client.get(f"{API}/public/forms/devis-toiture").json()
    assert [f["name"] for f in public["fields"]] == ["first_name", "email", "timeline"]
    assert "notify_roles" not in public  # la configuration interne n'est pas exposée
