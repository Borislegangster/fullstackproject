"""Finance & facturation : fiche facture client (lignes, avoirs, règlements) et fiche paiement (droits)."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from tests.conftest import as_role, make_user

API = "/api/v1"


def test_client_invoice_and_payment_detail(client: Any, db: Any) -> None:
    from tests.conftest import login

    admin = make_user(db, roles=["ADMIN"])
    ah = login(client, admin.email)
    _finance, fh = as_role(client, db, "FINANCE")
    _site, sh = as_role(client, db, "CHEF_CHANTIER")

    project = client.post(
        f"{API}/projects", headers=ah, json={"name": "Duplex Kotto", "city": "Douala", "status": "execution"}
    ).json()
    created = client.post(
        f"{API}/client-invoices",
        headers=fh,
        json={
            "project_id": project["id"],
            "kind": "progress",
            "title": "Situation n°1 - gros oeuvre",
            "issue_date": date.today().isoformat(),
            "due_date": (date.today() + timedelta(days=30)).isoformat(),
            "lines": [
                {"designation": "Béton armé fondations", "unit": "m3", "quantity": 12, "unit_price": 95000},
                {"designation": "Maçonnerie agglos 15", "unit": "m2", "quantity": 80, "unit_price": 8500},
            ],
        },
    )
    assert created.status_code == 201, created.text
    invoice = created.json()

    detail = client.get(f"{API}/client-invoices/{invoice['id']}", headers=fh)
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert len(body["lines"]) == 2 and body["credit_notes"] == [] and body["payments"] == []
    assert Decimal(body["subtotal"]) == Decimal("1820000.00")

    # Sans droit de lecture facturation : refus explicite
    denied = client.get(f"{API}/client-invoices/{invoice['id']}", headers=sh)
    assert denied.status_code == 403

    missing = client.get(f"{API}/payments/00000000-0000-0000-0000-000000000000", headers=fh)
    assert missing.status_code == 404 and missing.json()["error"]["code"]
