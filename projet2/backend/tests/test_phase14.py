"""Phase 14 — Quotes (devis) + Safety briefings CRUD, convert, RBAC."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


# ── Quotes ───────────────────────────────────────────────────

def test_quote_crud_and_status(client: TestClient, admin_headers):
    create = client.post(
        "/api/v1/quotes",
        headers=admin_headers,
        json={"client_name": "M. Tchoupo", "project_label": "Villa 4 chambres",
              "amount": 85_000_000,
              "lines": [{"designation": "Gros œuvre", "qty": 1, "unit_price": 85_000_000, "total": 85_000_000}]},
    )
    assert create.status_code == 200, create.text
    body = create.json()
    qid = body["id"]
    assert body["code"].startswith("DEV-")

    # List shows it, default status EN_REDACTION
    lst = client.get("/api/v1/quotes", headers=admin_headers).json()
    mine = next(q for q in lst if q["id"] == qid)
    assert mine["status"] == "EN_REDACTION"
    assert mine["client_name"] == "M. Tchoupo"
    assert mine["amount"] == 85_000_000

    # Update status → ENVOYE
    upd = client.patch(f"/api/v1/quotes/{qid}", headers=admin_headers, json={"status": "ENVOYE"})
    assert upd.status_code == 200
    lst2 = client.get("/api/v1/quotes?status_filter=ENVOYE", headers=admin_headers).json()
    assert any(q["id"] == qid for q in lst2)

    # Invalid status → 400
    bad = client.patch(f"/api/v1/quotes/{qid}", headers=admin_headers, json={"status": "BOGUS"})
    assert bad.status_code == 400


def test_quote_convert_to_invoice(client: TestClient, admin_headers):
    # Need a project + a client.
    users = client.get("/api/v1/admin/users", headers=admin_headers).json()
    client_id = next(u["id"] for u in users if u["role"] == "CLIENT")
    proj = client.post(
        "/api/v1/projects",
        headers=admin_headers,
        json={"name": "Quote Project", "project_type": "Villa", "location": "Douala"},
    ).json()
    project_id = proj["id"]

    quote = client.post(
        "/api/v1/quotes",
        headers=admin_headers,
        json={"client_name": "ACME", "project_label": "Entrepôt", "amount": 12_000_000,
              "lines": [{"designation": "Dalle", "qty": 1, "unit_price": 12_000_000, "total": 12_000_000}]},
    ).json()
    qid = quote["id"]

    conv = client.post(
        f"/api/v1/quotes/{qid}/convert?project_id={project_id}&client_id={client_id}",
        headers=admin_headers,
    )
    assert conv.status_code == 200, conv.text
    inv_code = conv.json()["invoice_code"]
    assert inv_code.startswith("FAC-")

    # Quote now ACCEPTE + converted
    lst = client.get("/api/v1/quotes", headers=admin_headers).json()
    mine = next(q for q in lst if q["id"] == qid)
    assert mine["status"] == "ACCEPTE"
    assert mine["converted_invoice_id"]

    # Double conversion → 400
    again = client.post(
        f"/api/v1/quotes/{qid}/convert?project_id={project_id}&client_id={client_id}",
        headers=admin_headers,
    )
    assert again.status_code == 400


def test_quote_delete(client: TestClient, admin_headers):
    qid = client.post("/api/v1/quotes", headers=admin_headers,
                      json={"client_name": "X", "amount": 1}).json()["id"]
    assert client.delete(f"/api/v1/quotes/{qid}", headers=admin_headers).status_code == 200
    lst = client.get("/api/v1/quotes", headers=admin_headers).json()
    assert not any(q["id"] == qid for q in lst)


def test_quotes_rbac(client: TestClient, client_headers):
    assert client.get("/api/v1/quotes", headers=client_headers).status_code == 403
    assert client.post("/api/v1/quotes", headers=client_headers, json={"client_name": "h"}).status_code == 403


# ── Safety briefings ─────────────────────────────────────────

def test_briefing_crud(client: TestClient, admin_headers):
    create = client.post(
        "/api/v1/qhse/briefings",
        headers=admin_headers,
        json={"title": "Travail en hauteur", "site_label": "Villa Bonapriso",
              "animator": "Paul Mbarga", "total_count": 15, "signed_count": 0, "status": "EN_COURS"},
    )
    assert create.status_code == 200, create.text
    bid = create.json()["id"]

    lst = client.get("/api/v1/qhse/briefings", headers=admin_headers).json()
    mine = next(b for b in lst if b["id"] == bid)
    assert mine["title"] == "Travail en hauteur"
    assert mine["total_count"] == 15
    assert mine["status"] == "EN_COURS"
    assert mine["briefing_date"]  # auto-set

    # Update signed count + close
    upd = client.patch(f"/api/v1/qhse/briefings/{bid}", headers=admin_headers,
                       json={"signed_count": 15, "status": "TERMINE"})
    assert upd.status_code == 200
    lst2 = client.get("/api/v1/qhse/briefings", headers=admin_headers).json()
    mine2 = next(b for b in lst2 if b["id"] == bid)
    assert mine2["signed_count"] == 15
    assert mine2["status"] == "TERMINE"

    # Delete
    assert client.delete(f"/api/v1/qhse/briefings/{bid}", headers=admin_headers).status_code == 200
    lst3 = client.get("/api/v1/qhse/briefings", headers=admin_headers).json()
    assert not any(b["id"] == bid for b in lst3)


def test_briefing_update_404(client: TestClient, admin_headers):
    assert client.patch("/api/v1/qhse/briefings/ghost", headers=admin_headers,
                       json={"title": "x"}).status_code == 404


def test_briefings_rbac(client: TestClient, client_headers):
    assert client.get("/api/v1/qhse/briefings", headers=client_headers).status_code == 403
    assert client.post("/api/v1/qhse/briefings", headers=client_headers,
                       json={"title": "hack"}).status_code == 403
