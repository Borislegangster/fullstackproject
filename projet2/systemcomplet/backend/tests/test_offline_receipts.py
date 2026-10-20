"""Encaissements clients hors ligne (virement, espèces, chèque, Mobile Money direct) : saisie avec preuve, double
regard (refus d'auto-approbation), appel de fonds partiellement payé puis payé, reçu PDF, visibilité client,
notification, refus d'une saisie et rapprochement bancaire par référence."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import select

from tests.conftest import as_role, drain_outbox
from tests.test_client_portal import _png, _setup
from tests.test_payment_providers import _funds_call

API = "/api/v1"


def _receipt(client: Any, headers: dict[str, str], path: str, *, proof: bool = True, **fields: Any) -> Any:
    data = {"method": "bank_transfer", "value_date": (date.today() - timedelta(days=1)).isoformat(), **fields}
    files = {"proof": ("avis-de-credit.png", _png(), "image/png")} if proof else None
    return client.post(f"{API}{path}", headers=headers, data={k: str(v) for k, v in data.items()}, files=files)


def test_offline_receipt_double_check_to_paid_funds_call(client: Any, db: Any) -> None:
    from app.modules.notifications.models import Notification

    env = _setup(client, db)
    fh = env["fh"]
    _second, fh2 = as_role(client, db, "FINANCE", first_name="Awa", last_name="Ngono")
    call = _funds_call(client, env, amount=1000000)
    path = f"/funds-calls/{call['id']}/payments"

    # Saisie : preuve, référence (hors espèces) et montant ≤ reste dû obligatoires
    assert _receipt(client, fh, path, proof=False, reference="VIR-1", amount=400000).status_code == 422
    no_ref = _receipt(client, fh, path, amount=400000)
    assert no_ref.status_code == 422 and no_ref.json()["error"]["code"] == "REFERENCE_REQUIRED"
    too_much = _receipt(client, fh, path, reference="VIR-1", amount=1500000)
    assert too_much.status_code == 422 and too_much.json()["error"]["code"] == "INVALID_AMOUNT"
    future = _receipt(client, fh, path, reference="VIR-1", value_date=(date.today() + timedelta(days=2)).isoformat())
    assert future.status_code == 422 and future.json()["error"]["code"] == "INVALID_VALUE_DATE"
    assert _receipt(client, env["custh"], path, reference="VIR-1").status_code == 403

    first = _receipt(client, fh, path, reference="VIR-2026-0042", amount=400000, notes="Virement BICEC")
    assert first.status_code == 201, first.text
    first = first.json()
    assert first["status"] == "awaiting_approval" and first["direction"] == "in" and first["provider"] == "manual"
    assert first["value_date"] == (date.today() - timedelta(days=1)).isoformat() and first["proof_file_id"]
    assert first["counterparty_label"] == "Famille Mbappe"
    assert first["allocations"][0]["target_type"] == "funds_call"

    # Le montant en attente d'approbation est réservé ; une même référence n'est pas saisie deux fois
    over = _receipt(client, fh, path, reference="VIR-2026-0050", amount=700000)
    assert over.status_code == 422 and "en attente d'approbation" in over.json()["error"]["message"]
    twin = _receipt(client, fh, path, reference="vir-2026-0042", amount=100000)
    assert twin.status_code == 409 and twin.json()["error"]["code"] == "DUPLICATE_REFERENCE"

    detail = client.get(f"{API}/funds-calls/{call['id']}", headers=fh).json()
    assert Decimal(detail["pending_receipts"]) == Decimal("400000.00") and detail["payments"][0]["number"]
    waiting = client.get(f"{API}/payments", headers=fh2, params={"direction": "in", "status": "awaiting_approval"})
    assert [p["id"] for p in waiting.json()["items"]] == [first["id"]]

    # Non approuvé : invisible pour le client, rien n'est payé
    finances = client.get(f"{API}/client/projects/{env['project']['id']}/finances", headers=env["custh"]).json()
    assert finances["payments"] == [] and Decimal(finances["summary"]["paid"]) == 0

    # Double regard : l'auteur de la saisie ne peut pas approuver ; une seconde personne le peut
    own = client.post(f"{API}/payments/{first['id']}/approve", headers=fh)
    assert own.status_code == 422 and own.json()["error"]["code"] == "SEGREGATION_OF_DUTIES"
    approved = client.post(f"{API}/payments/{first['id']}/approve", headers=fh2)
    assert approved.status_code == 200, approved.text
    approved = approved.json()
    assert approved["status"] == "succeeded" and approved["confirmed_by"] == "manual" and approved["receipt_file_id"]
    assert approved["provider_reference"] == "VIR-2026-0042"
    again = client.post(f"{API}/payments/{first['id']}/approve", headers=fh2)
    assert again.status_code == 422, "approbation unique"
    payment = client.get(f"{API}/payments/{first['id']}", headers=fh).json()
    assert payment["initiated_by_label"] and payment["approved_by_label"] == "Awa Ngono"

    detail = client.get(f"{API}/funds-calls/{call['id']}", headers=fh).json()
    assert detail["status"] == "partially_paid" and Decimal(detail["amount_paid"]) == Decimal("400000.00")
    invoice = client.get(f"{API}/client-invoices/{detail['client_invoice_id']}", headers=fh).json()
    assert invoice["status"] == "partially_paid" and Decimal(invoice["balance_due"]) == Decimal("600000.00")
    assert [p["number"] for p in invoice["payments"]] == [approved["number"]]

    # Le client voit le paiement approuvé et télécharge son reçu
    finances = client.get(f"{API}/client/projects/{env['project']['id']}/finances", headers=env["custh"]).json()
    assert [p["status"] for p in finances["payments"]] == ["succeeded"] and finances["payments"][0]["receipt_url"]
    assert Decimal(finances["summary"]["paid"]) == Decimal("400000.00")
    pdf = client.get(f"{API}/payments/{first['id']}/receipt", headers=env["custh"])
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert client.get(f"{API}/payments/{first['id']}/receipt", headers=env["strh"]).status_code in (403, 404)

    # Saisie erronée sur la facture de l'appel : refusée par l'approbateur, la pièce reste due
    via_invoice = f"/client-invoices/{detail['client_invoice_id']}/payments"
    wrong = _receipt(client, fh, via_invoice, method="cheque", reference="CHQ-778812", amount=600000)
    assert wrong.status_code == 201, wrong.text
    wrong = wrong.json()
    assert wrong["allocations"][0]["target_type"] == "funds_call", "imputé sur l'appel de fonds (qui solde la facture)"
    assert client.post(f"{API}/payments/{wrong['id']}/reject", headers=fh2, json={"reason": "x"}).status_code == 422
    rejected = client.post(
        f"{API}/payments/{wrong['id']}/reject", headers=fh2, json={"reason": "Chèque non reçu à la banque"}
    )
    assert rejected.status_code == 200 and rejected.json()["status"] == "cancelled"
    assert client.post(f"{API}/payments/{wrong['id']}/approve", headers=fh2).status_code == 422

    # Solde en espèces (montant omis = reste dû), approuvé par la seconde personne : appel et facture payés
    cash = _receipt(client, fh, via_invoice, method="cash")
    assert cash.status_code == 201, cash.text
    cash = cash.json()
    assert Decimal(cash["amount"]) == Decimal("600000.00") and cash["provider_reference"] is None
    assert client.post(f"{API}/payments/{cash['id']}/approve", headers=fh2).json()["status"] == "succeeded"
    detail = client.get(f"{API}/funds-calls/{call['id']}", headers=fh).json()
    assert detail["status"] == "paid" and Decimal(detail["balance_due"]) == 0
    invoice = client.get(f"{API}/client-invoices/{detail['client_invoice_id']}", headers=fh).json()
    assert invoice["status"] == "paid"
    closed = _receipt(client, fh, path, reference="VIR-2026-0099", amount=1000)
    assert closed.status_code == 422 and closed.json()["error"]["code"] == "NOT_RECEIVABLE"

    finances = client.get(f"{API}/client/projects/{env['project']['id']}/finances", headers=env["custh"]).json()
    assert finances["funds_calls"][0]["status"] == "paid"
    assert Decimal(finances["summary"]["paid"]) == Decimal("1000000.00")
    assert sorted(p["number"] for p in finances["payments"]) == sorted([approved["number"], cash["number"]])
    assert all(p["receipt_url"] for p in finances["payments"])

    # Notification « Paiement reçu » au client pour chaque encaissement approuvé
    drain_outbox()
    received = (
        db.execute(
            select(Notification).where(
                Notification.user_id == env["customer"].id, Notification.event_type == "client_payment.received"
            )
        )
        .scalars()
        .all()
    )
    assert len(received) == 2

    # Rapprochement bancaire : la ligne de relevé est reliée à l'encaissement par sa référence
    account = client.post(f"{API}/bank-accounts", headers=fh, json={"name": "BICEC Douala", "bank_name": "BICEC"})
    assert account.status_code == 201, account.text
    statement = (
        "date;libelle;reference;montant\n"
        f"{(date.today() - timedelta(days=1)).strftime('%d/%m/%Y')};VIR RECU FAMILLE MBAPPE;VIR-2026-0042;400000\n"
    )
    imported = client.post(
        f"{API}/bank-accounts/{account.json()['id']}/import",
        headers=fh,
        files={"file": ("releve.csv", statement.encode(), "text/csv")},
    )
    assert imported.status_code == 200 and imported.json()["matched"] == 1, imported.text
    payment = client.get(f"{API}/payments/{first['id']}", headers=fh).json()
    assert [b["reference"] for b in payment["bank_matches"]] == ["VIR-2026-0042"]
