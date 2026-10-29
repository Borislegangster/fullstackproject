"""Prestataires de paiement réels (§16.1) : Orange Money Web Payment (page Orange, notification à jeton par
transaction, statut relu), MTN MoMo (expiration d'une demande non validée), MTN MoMo Disbursements (paiement
sortant fournisseur suivi jusqu'à confirmation), configuration stricte des prestataires."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

import pytest
from sqlalchemy import select

from tests.conftest import as_role
from tests.test_client_portal import _setup

API = "/api/v1"


def _funds_call(client: Any, env: dict[str, Any], amount: int = 750000) -> dict[str, Any]:
    call = client.post(
        f"{API}/funds-calls",
        headers=env["fh"],
        json={
            "project_id": env["project"]["id"],
            "label": "Acompte second œuvre",
            "amount": amount,
            "due_date": (date.today() + timedelta(days=10)).isoformat(),
        },
    ).json()
    issued = client.post(f"{API}/funds-calls/{call['id']}/issue", headers=env["vh"], json={})
    assert issued.status_code == 200, issued.text
    return call


def _checkout(client: Any, env: dict[str, Any], call: dict[str, Any], **extra: Any) -> dict[str, Any]:
    resp = client.post(
        f"{API}/client/checkout",
        headers={**env["custh"], "Idempotency-Key": uuid.uuid4().hex},
        json={"target_type": "funds_call", "target_id": call["id"], "method": "mobile_money", **extra},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _notify_url(provider: str, reference: str) -> str:
    from app.providers.payments import callback_signature

    return f"{API}/payments/webhooks/{provider}?ref={reference}&sig={callback_signature(provider, reference)}"


def test_orange_money_web_payment(client: Any, db: Any, operators: Any) -> None:
    from app.modules.finance.models import Payment, PaymentTransaction
    from app.modules.system.models import ActionItem

    env = _setup(client, db)
    orange = operators.orange
    call = _funds_call(client, env)
    session = _checkout(client, env, call, provider="orange_money")
    assert session["flow"] == "redirect" and session["checkout_url"].startswith("https://mpayment.orange-money.com/")
    reference = session["transaction_id"]
    order_id = reference.replace("-", "")
    order = orange.orders[order_id]
    assert order["amount"] == 750000 and reference in order["notif_url"]

    # Notification au jeton erroné (ou URL non signée) : rejetée, rien n'est appliqué.
    url = _notify_url("orange_money", reference)
    forged = client.post(url, json={"status": "SUCCESS", "notif_token": "nt_inconnu", "txnid": "MP1"})
    assert forged.status_code == 401
    unsigned = client.post(
        f"{API}/payments/webhooks/orange_money?ref={reference}&sig=00",
        json={"status": "SUCCESS", "notif_token": order["notif_token"], "txnid": "MP1"},
    )
    assert unsigned.status_code == 401

    # Notification authentique annonçant un succès que l'opérateur ne confirme pas : la relecture fait foi.
    orange.complete(order_id, "FAILED")
    contradicted = client.post(url, json={"status": "SUCCESS", "notif_token": order["notif_token"], "txnid": "MP1"})
    assert contradicted.status_code == 200 and contradicted.json()["payment_status"] == "failed"
    tx = db.get(PaymentTransaction, uuid.UUID(reference))
    db.refresh(tx)
    payment = db.get(Payment, tx.payment_id)
    db.refresh(payment)
    assert payment.status == "failed" and payment.failure_reason
    assert db.execute(select(ActionItem).where(ActionItem.entity_id == str(payment.id))).scalar_one_or_none()

    # Nouveau paiement confirmé : notification + relecture → appel de fonds soldé, reçu émis.
    second = _checkout(client, env, call, provider="orange_money")
    second_ref = second["transaction_id"]
    second_order = second_ref.replace("-", "")
    orange.complete(second_order, "SUCCESS")
    done = client.post(
        _notify_url("orange_money", second_ref),
        json={"status": "SUCCESS", "notif_token": orange.orders[second_order]["notif_token"], "txnid": "MP2"},
    )
    assert done.status_code == 200 and done.json()["payment_status"] == "succeeded", done.text
    finances = client.get(f"{API}/client/projects/{env['project']['id']}/finances", headers=env["custh"]).json()
    paid = next(c for c in finances["funds_calls"] if c["id"] == call["id"])
    assert paid["status"] == "paid"


def test_momo_request_expires_when_not_validated(client: Any, db: Any, operators: Any) -> None:
    from app.core.utils import utcnow
    from app.modules.finance.models import PaymentTransaction

    env = _setup(client, db)
    call = _funds_call(client, env, amount=150000)
    session = _checkout(client, env, call, provider="mtn_momo", payer_phone="+237 677 00 00 02")
    reference = session["transaction_id"]
    assert operators.momo.requests[reference]["status"] == "PENDING"
    tx = db.get(PaymentTransaction, uuid.UUID(reference))
    tx.expires_at = utcnow() - timedelta(minutes=1)
    tx.last_checked_at = None
    db.commit()
    status = client.get(f"{API}/payments/transactions/{reference}", headers=env["custh"]).json()
    assert status["status"] == "expired" and "délai" in (status["failure_reason"] or "")

    # Payeur qui refuse sur son téléphone : échec motivé, aucune clôture de l'appel de fonds.
    refused = _checkout(client, env, call, provider="mtn_momo", payer_phone="677000003")
    operators.momo.complete(refused["transaction_id"], "REJECTED")
    result = client.get(f"{API}/payments/transactions/{refused['transaction_id']}", headers=env["custh"]).json()
    assert result["status"] == "failed" and result["failure_reason"] == "Refusé par le payeur"
    finances = client.get(f"{API}/client/projects/{env['project']['id']}/finances", headers=env["custh"]).json()
    assert next(c for c in finances["funds_calls"] if c["id"] == call["id"])["status"] != "paid"


def test_supplier_payout_through_momo_disbursement(client: Any, db: Any, operators: Any) -> None:
    from app.modules.billing.models import SupplierInvoice
    from app.modules.suppliers.models import Supplier

    _initiator, ih = as_role(client, db, "FINANCE")
    _approver, aph = as_role(client, db, "FINANCE")
    supplier = Supplier(
        code=f"F-{uuid.uuid4().hex[:6]}", legal_name="Quincaillerie du Wouri", mobile_money_number="670112233"
    )
    db.add(supplier)
    db.flush()
    invoice = SupplierInvoice(
        number=f"FF-T-{uuid.uuid4().hex[:6]}",
        supplier_reference="QW-2026-118",
        supplier_id=supplier.id,
        invoice_date=date.today(),
        subtotal=Decimal("420000"),
        tax_amount=Decimal("80850"),
        total=Decimal("500850"),
        status="approved_for_payment",
    )
    db.add(invoice)
    db.commit()

    providers = client.get(f"{API}/payments/payout-providers", headers=ih).json()
    assert {"provider": "mtn_momo", "label": "MTN Mobile Money"} in providers
    payment = client.post(
        f"{API}/payments/outgoing",
        headers={**ih, "Idempotency-Key": uuid.uuid4().hex},
        json={"target_type": "supplier_invoice", "target_id": str(invoice.id), "method": "mobile_money"},
    ).json()
    assert client.post(f"{API}/payments/{payment['id']}/approve", headers=aph).status_code == 200
    executed = client.post(f"{API}/payments/{payment['id']}/execute", headers=ih, data={"provider": "mtn_momo"})
    assert executed.status_code == 200 and executed.json()["status"] == "processing", executed.text
    ((reference, transfer),) = operators.momo.transfers.items()
    assert transfer["payee"] == {"partyIdType": "MSISDN", "partyId": "237670112233"}
    assert transfer["amount"] == "500850" and transfer["externalId"] == reference

    still = client.post(f"{API}/payments/{payment['id']}/refresh", headers=ih).json()
    assert still["status"] == "processing"
    operators.momo.complete(reference, "SUCCESSFUL", transfer=True)
    paid = client.post(f"{API}/payments/{payment['id']}/refresh", headers=ih).json()
    assert paid["status"] == "succeeded" and paid["receipt_file_id"]
    db.refresh(invoice)
    assert invoice.status == "paid"


def test_payment_provider_configuration_is_strict() -> None:
    from app.core.config import Settings

    with pytest.raises(ValueError, match="sandbox"):
        Settings(PAYMENT_PROVIDERS=["sandbox"])
    with pytest.raises(ValueError, match="inconnu"):
        Settings(PAYMENT_PROVIDERS=["paypalx"])
