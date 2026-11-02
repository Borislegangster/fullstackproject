"""Phase 17 — Invoicing integration tests (CRUD + lifecycle + stats)."""
import pytest

API = "/api/v1"


@pytest.fixture(scope="module")
def invoice_id(client, admin_auth, sample_project):
    r = client.post(f"{API}/invoices", headers=admin_auth, json={
        "project_id": sample_project["id"],
        "client_id": sample_project["client_id"],
        "invoice_type": "FACTURE",
        "subtotal": 500000,
        "total": 500000,
        "notes": "Facture de test",
    })
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_list_invoices_returns_list(client, admin_headers):
    r = client.get(f"{API}/invoices", headers=admin_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_then_get_invoice(client, admin_headers, invoice_id):
    g = client.get(f"{API}/invoices/{invoice_id}", headers=admin_headers)
    assert g.status_code == 200, g.text
    body = g.json()
    assert body["total"] == 500000
    assert body["status"] in ("BROUILLON", "ENVOYEE", "EN_RETARD", "PAYEE")
    assert body["code"]


def test_send_invoice(client, admin_headers, invoice_id):
    r = client.patch(f"{API}/invoices/{invoice_id}/send", headers=admin_headers)
    assert r.status_code == 200, r.text
    g = client.get(f"{API}/invoices/{invoice_id}", headers=admin_headers)
    assert g.json()["status"] in ("ENVOYEE", "EN_RETARD")


def test_mark_invoice_paid(client, admin_headers, invoice_id):
    r = client.patch(f"{API}/invoices/{invoice_id}/mark-paid", headers=admin_headers)
    assert r.status_code == 200, r.text
    g = client.get(f"{API}/invoices/{invoice_id}", headers=admin_headers)
    assert g.json()["status"] == "PAYEE"


def test_invoice_summary_stats(client, admin_headers):
    r = client.get(f"{API}/invoices/stats/summary", headers=admin_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "total_paid" in body


def test_invoice_aging_stats(client, admin_headers):
    r = client.get(f"{API}/invoices/stats/aging", headers=admin_headers)
    assert r.status_code == 200, r.text
    assert "buckets" in r.json()


def test_get_unknown_invoice_404(client, admin_headers):
    r = client.get(f"{API}/invoices/nope-xxxx", headers=admin_headers)
    assert r.status_code == 404


def test_invoices_require_auth(client):
    r = client.get(f"{API}/invoices")
    assert r.status_code in (401, 403)


def test_client_cannot_create_invoice(client, client_headers, sample_project):
    r = client.post(f"{API}/invoices", headers=client_headers, json={
        "project_id": sample_project["id"],
        "client_id": sample_project["client_id"],
        "total": 1000,
    })
    assert r.status_code in (401, 403)
