"""Module Facturation : brouillon modifiable puis figé, envoi notifié, annulation (avant émission) ou avoir,
relances d'échéance automatiques (paliers, idempotence, escalade finance) et manuelles, avoir fournisseur,
balance âgée, synthèse, export comptable CSV."""

from __future__ import annotations

import csv
import io
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import select

from tests.conftest import as_role, login, make_user

API = "/api/v1"


def _project_and_client(client: Any, db: Any) -> tuple[dict[str, Any], dict[str, str], Any]:
    from app.modules.identity.models import Organization

    admin = make_user(db, roles=["ADMIN"])
    ah = login(client, admin.email)
    org = Organization(name=f"SCI Bonapriso {uuid.uuid4().hex[:4]}", kind="client")
    db.add(org)
    db.commit()
    project = client.post(
        f"{API}/projects",
        headers=ah,
        json={
            "name": "Résidence Bonapriso",
            "city": "Douala",
            "status": "execution",
            "client_organization_id": str(org.id),
        },
    ).json()
    return project, ah, org


def _invoice(client: Any, headers: dict[str, str], project: dict[str, Any], org: Any, **extra: Any) -> dict[str, Any]:
    resp = client.post(
        f"{API}/client-invoices",
        headers=headers,
        json={
            "project_id": project["id"],
            "organization_id": str(org.id),
            "title": "Situation n°2 — élévation R+1",
            "issue_date": date.today().isoformat(),
            "due_date": (date.today() + timedelta(days=30)).isoformat(),
            "lines": [{"designation": "Élévation murs R+1", "unit": "m2", "quantity": 100, "unit_price": 10000}],
            **extra,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_client_invoice_lifecycle_and_cancellation(client: Any, db: Any) -> None:
    from app.modules.system.models import OutboxEvent

    project, _ah, org = _project_and_client(client, db)
    _finance, fh = as_role(client, db, "FINANCE")
    invoice = _invoice(client, fh, project, org)
    assert invoice["status"] == "draft" and Decimal(invoice["total"]) == Decimal("1192500.00")

    # Brouillon modifiable (lignes recalculées)
    updated = client.patch(
        f"{API}/client-invoices/{invoice['id']}",
        headers=fh,
        json={
            "title": "Situation n°2 — élévation R+1 et R+2",
            "lines": [{"designation": "Élévation", "unit": "m2", "quantity": 150, "unit_price": 10000}],
        },
    )
    assert updated.status_code == 200 and Decimal(updated.json()["subtotal"]) == Decimal("1500000.00"), updated.text
    assert client.post(f"{API}/client-invoices/{invoice['id']}/send", headers=fh).status_code == 422

    validated = client.post(f"{API}/client-invoices/{invoice['id']}/validate", headers=fh)
    assert validated.status_code == 200 and validated.json()["status"] == "validated"
    frozen = client.patch(f"{API}/client-invoices/{invoice['id']}", headers=fh, json={"title": "Modifiée"})
    assert frozen.status_code == 422, "une facture validée se corrige par un avoir"

    sent = client.post(f"{API}/client-invoices/{invoice['id']}/send", headers=fh)
    assert sent.status_code == 200 and sent.json()["status"] == "sent"
    events = db.execute(select(OutboxEvent).where(OutboxEvent.event_type == "client_invoice.sent")).scalars().all()
    assert any(e.payload.get("number") == invoice["number"] for e in events)
    refused = client.post(
        f"{API}/client-invoices/{invoice['id']}/cancel", headers=fh, json={"reason": "Erreur de saisie"}
    )
    assert refused.status_code == 422 and refused.json()["error"]["code"] == "CREDIT_NOTE_REQUIRED"

    # Facture non émise : annulation tracée
    other = _invoice(client, fh, project, org, title="Acompte erroné")
    cancelled = client.post(
        f"{API}/client-invoices/{other['id']}/cancel", headers=fh, json={"reason": "Doublon de saisie"}
    )
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "cancelled"


def test_payment_reminders_stages_and_escalation(client: Any, db: Any) -> None:
    from app.modules.billing.lifecycle import send_payment_reminders
    from app.modules.billing.models import ClientInvoice, PaymentReminder
    from app.modules.system.models import ActionItem

    project, _ah, org = _project_and_client(client, db)
    _finance, fh = as_role(client, db, "FINANCE")
    invoice = _invoice(client, fh, project, org)
    client.post(f"{API}/client-invoices/{invoice['id']}/validate", headers=fh)
    client.post(f"{API}/client-invoices/{invoice['id']}/send", headers=fh)
    row = db.get(ClientInvoice, uuid.UUID(invoice["id"]))
    due = row.due_date

    def stages() -> list[str]:
        db.expire_all()
        return [
            r.stage for r in db.execute(select(PaymentReminder).where(PaymentReminder.target_id == row.id)).scalars()
        ]

    assert send_payment_reminders(db, today=due - timedelta(days=10))["reminders"] == 0
    send_payment_reminders(db, today=due - timedelta(days=3))
    send_payment_reminders(db, today=due - timedelta(days=2))  # palier déjà envoyé : rien
    send_payment_reminders(db, today=due)  # jour de l'échéance : aucun palier
    assert stages() == ["before_3"]
    send_payment_reminders(db, today=due + timedelta(days=16))  # retard : seul le palier courant (J+15)
    assert sorted(stages()) == ["after_15", "before_3"]
    task = db.execute(select(ActionItem).where(ActionItem.entity_id == str(row.id))).scalar_one()
    assert task.assignee_role == "FINANCE" and "Relance téléphonique" in task.title

    # Relance manuelle : une par jour
    first = client.post(f"{API}/client-invoices/{invoice['id']}/remind", headers=fh)
    assert first.status_code == 201, first.text
    again = client.post(f"{API}/client-invoices/{invoice['id']}/remind", headers=fh)
    assert again.status_code == 409 and again.json()["error"]["code"] == "ALREADY_REMINDED"
    history = client.get(f"{API}/client-invoices/{invoice['id']}/reminders", headers=fh).json()
    assert len(history) == 3

    # Facture soldée par avoir : plus aucune relance
    client.post(
        f"{API}/client-invoices/{invoice['id']}/credit-notes",
        headers=fh,
        json={"amount": invoice["total"], "reason": "Annulation de la situation"},
    )
    db.expire_all()
    assert send_payment_reminders(db, today=due + timedelta(days=31))["reminders"] == 0


def test_supplier_credit_note_aging_summary_and_export(client: Any, db: Any) -> None:
    from app.modules.billing.models import ClientInvoice, SupplierInvoice
    from app.modules.suppliers.models import Supplier

    project, _ah, org = _project_and_client(client, db)
    _finance, fh = as_role(client, db, "FINANCE")
    _site, sh = as_role(client, db, "CHEF_CHANTIER")

    late = _invoice(client, fh, project, org, title="Situation n°1")
    client.post(f"{API}/client-invoices/{late['id']}/validate", headers=fh)
    client.post(f"{API}/client-invoices/{late['id']}/send", headers=fh)
    row = db.get(ClientInvoice, uuid.UUID(late["id"]))
    row.due_date = date.today() - timedelta(days=45)
    supplier = Supplier(code=f"F-{uuid.uuid4().hex[:6]}", legal_name="Ciments du Littoral")
    db.add(supplier)
    db.flush()
    supplier_invoice = SupplierInvoice(
        number=f"FF-B-{uuid.uuid4().hex[:6]}",
        supplier_reference="CL-0091",
        supplier_id=supplier.id,
        project_id=uuid.UUID(project["id"]),
        invoice_date=date.today() - timedelta(days=5),
        due_date=date.today() + timedelta(days=25),
        subtotal=Decimal("500000"),
        tax_amount=Decimal("96250"),
        total=Decimal("596250"),
        status="approved_for_payment",
    )
    db.add(supplier_invoice)
    db.commit()

    note = client.post(
        f"{API}/supplier-invoices/{supplier_invoice.id}/credit-notes",
        headers=fh,
        json={"amount": 96250, "reason": "Retour de 10 sacs endommagés", "supplier_reference": "AV-CL-12"},
    )
    assert note.status_code == 201 and note.json()["side"] == "supplier", note.text
    too_much = client.post(
        f"{API}/supplier-invoices/{supplier_invoice.id}/credit-notes",
        headers=fh,
        json={"amount": 900000, "reason": "Avoir supérieur au reste dû"},
    )
    assert too_much.status_code == 422

    aging = client.get(f"{API}/billing/aging", headers=fh, params={"side": "client"}).json()
    assert Decimal(aging["totals"]["d31_60"]) >= Decimal("1192500.00")
    assert any(r["party"] == org.name for r in aging["rows"])
    payables = client.get(f"{API}/billing/aging", headers=fh, params={"side": "supplier"}).json()
    assert Decimal(payables["totals"]["not_due"]) >= Decimal("500000.00")

    summary = client.get(f"{API}/billing/summary", headers=fh).json()
    assert summary["overdue_count"] >= 1 and Decimal(summary["receivables"]) >= Decimal("1192500.00")

    params = {
        "kind": "client",
        "date_from": (date.today() - timedelta(days=60)).isoformat(),
        "date_to": date.today().isoformat(),
    }
    assert client.get(f"{API}/billing/export", headers=sh, params=params).status_code == 403, "export réservé"
    export = client.get(f"{API}/billing/export", headers=fh, params=params)
    assert export.status_code == 200 and export.headers["content-type"].startswith("text/csv")
    rows = list(csv.reader(io.StringIO(export.content.decode("utf-8-sig")), delimiter=";"))
    assert rows[0][:3] == ["Date", "Numéro", "Client"] and any(r[1] == late["number"] for r in rows[1:])
