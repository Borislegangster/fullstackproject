"""Security tests for the Flutterwave payment integration.

Focus areas:
  • IDOR — a client can only pay their OWN invoices
  • Only sent/overdue invoices are payable online (no drafts/proformas)
  • Webhook is fail-closed without a valid `verif-hash`
  • The success path credits the invoice once and is idempotent (no double credit)
  • The redirect callback NEVER credits a payment from client-supplied params
"""
import pytest

from app.services.flutterwave_service import FlutterwaveService

API = "/api/v1"


def _admin_id(client, admin_headers) -> str:
    return client.get(f"{API}/auth/me", headers=admin_headers).json()["id"]


def _make_invoice(client, admin_headers, project, client_id, total=100_000, send=True):
    r = client.post(f"{API}/invoices", headers=admin_headers, json={
        "project_id": project["id"], "client_id": client_id,
        "invoice_type": "FACTURE", "total": total, "subtotal": total,
    })
    assert r.status_code == 200, r.text
    inv_id = r.json()["id"]
    if send:
        s = client.patch(f"{API}/invoices/{inv_id}/send", headers=admin_headers)
        assert s.status_code == 200, s.text
    return inv_id


# ── IDOR: a client cannot pay someone else's invoice ─────────────

def test_initiate_idor_blocked(client, admin_headers, client_headers):
    # Invoice owned by the ADMIN user (not the client) → client must get 404.
    other_owner = _admin_id(client, admin_headers)
    inv_id = _make_invoice(client, admin_headers, _project(client, admin_headers, other_owner),
                           other_owner, send=True)
    r = client.post(f"{API}/payments/initiate", headers=client_headers,
                    json={"invoice_id": inv_id})
    assert r.status_code == 404, r.text  # no IDOR, no enumeration


def test_initiate_unknown_invoice_404(client, client_headers):
    r = client.post(f"{API}/payments/initiate", headers=client_headers,
                    json={"invoice_id": "does-not-exist"})
    assert r.status_code == 404


# ── Only payable invoices (no drafts) ────────────────────────────

def test_initiate_rejects_draft(client, admin_headers, client_headers, client_user_id, sample_project):
    # Owned by the client but still BROUILLON (not sent) → 400, not payable.
    inv_id = _make_invoice(client, admin_headers, sample_project, client_user_id, send=False)
    r = client.post(f"{API}/payments/initiate", headers=client_headers,
                    json={"invoice_id": inv_id})
    assert r.status_code == 400, r.text
    assert "payable" in r.json()["detail"].lower()


# ── Webhook fail-closed without a valid signature ────────────────

def test_webhook_rejects_missing_signature(client):
    r = client.post(f"{API}/payments/flutterwave/webhook",
                    json={"event": "charge.completed", "data": {"tx_ref": "x", "id": 1}})
    assert r.status_code == 401


def test_webhook_rejects_wrong_signature(client):
    r = client.post(f"{API}/payments/flutterwave/webhook",
                    headers={"verif-hash": "not-the-secret"},
                    json={"event": "charge.completed", "data": {"tx_ref": "x", "id": 1}})
    assert r.status_code == 401


# ── Success path + idempotency (Flutterwave calls mocked) ────────

def test_webhook_credits_once_and_is_idempotent(
    client, admin_headers, client_headers, client_user_id, sample_project, monkeypatch
):
    inv_id = _make_invoice(client, admin_headers, sample_project, client_user_id,
                           total=50_000, send=True)

    # Mock the gateway: no real network, signature OK, verify returns success.
    async def fake_init(self, **kw):
        return {"status": "success", "data": {"link": "https://checkout.flw/fake", "id": "999"}}

    async def fake_verify(self, txid):
        return {"status": "success", "data": {
            "status": "successful", "amount": 50_000, "currency": "XAF",
            "tx_ref": self._last_ref, "flw_ref": "FLW-REF-1",
            "payment_type": "mobilemoneycm", "id": txid,
        }}

    monkeypatch.setattr(FlutterwaveService, "initialize_payment", fake_init)
    monkeypatch.setattr(FlutterwaveService, "validate_webhook_signature", lambda self, h: True)

    # initiate → PENDING transaction
    init = client.post(f"{API}/payments/initiate", headers=client_headers,
                       json={"invoice_id": inv_id})
    assert init.status_code == 200, init.text
    tx_ref = init.json()["tx_ref"]

    # bind tx_ref into the verify mock
    FlutterwaveService._last_ref = tx_ref
    monkeypatch.setattr(FlutterwaveService, "verify_transaction", fake_verify)

    payload = {"event": "charge.completed",
               "data": {"tx_ref": tx_ref, "id": 123456, "status": "successful"}}

    r1 = client.post(f"{API}/payments/flutterwave/webhook",
                     headers={"verif-hash": "ok"}, json=payload)
    assert r1.status_code == 200 and r1.json()["status"] == "success", r1.text

    # Invoice now fully paid
    inv = client.get(f"{API}/invoices/{inv_id}", headers=admin_headers).json()
    assert inv["status"] == "PAYEE"
    assert float(inv["amount_paid"]) == 50_000

    # The payer (client) is notified in-app of the confirmed payment.
    client_notifs = client.get(f"{API}/client/notifications", headers=client_headers).json()
    assert any(n.get("type") == "payment" and "confirmé" in (n.get("title", "").lower())
               for n in client_notifs), client_notifs

    # Finance staff (admin) is notified in-app on the ERP side.
    admin_notifs = client.get(f"{API}/notifications", headers=admin_headers).json()
    assert any(n.get("type") == "payment" and "reçu en ligne" in n.get("title", "").lower()
               for n in admin_notifs), admin_notifs

    # Replay the SAME webhook → idempotent, no double credit
    r2 = client.post(f"{API}/payments/flutterwave/webhook",
                     headers={"verif-hash": "ok"}, json=payload)
    assert r2.json()["status"] == "already_processed", r2.text
    inv2 = client.get(f"{API}/invoices/{inv_id}", headers=admin_headers).json()
    assert float(inv2["amount_paid"]) == 50_000  # unchanged


# ── Callback never credits from client params ────────────────────

def test_callback_does_not_credit(client, admin_headers, client_headers, client_user_id, sample_project):
    inv_id = _make_invoice(client, admin_headers, sample_project, client_user_id,
                           total=75_000, send=True)
    # Forge a "successful" callback — it must only redirect, never mark paid.
    r = client.get(f"{API}/payments/callback",
                   params={"status": "successful", "tx_ref": "FLW-FAKE", "transaction_id": "1"},
                   follow_redirects=False)
    assert r.status_code == 302
    inv = client.get(f"{API}/invoices/{inv_id}", headers=admin_headers).json()
    assert inv["status"] != "PAYEE"
    assert float(inv["amount_paid"]) == 0


# ── helper to mint a project owned by an arbitrary client id ─────

def _project(client, admin_headers, client_id):
    r = client.post(f"{API}/projects", headers=admin_headers, json={
        "name": "Projet Paiement IDOR", "project_type": "construction",
        "location": "Douala", "client_id": client_id, "budget_initial": 1_000_000,
    })
    assert r.status_code == 200, r.text
    return {"id": r.json()["id"]}
