"""Circuits de validation (double regard, exception du super administrateur), sceaux d'authenticité des documents
(QR), catégories de factures (proforma, définitive, avoir), archives de chantiers restaurables, confidentialité
financière de la fiche projet."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import select

from tests.conftest import as_role
from tests.test_client_portal import _setup
from tests.test_offline_receipts import _receipt
from tests.test_payment_providers import _funds_call

API = "/api/v1"


def _seal(db: Any, entity_type: str, entity_id: str, kind: str) -> Any:
    from app.modules.documents.models import DocumentSeal

    return db.execute(
        select(DocumentSeal).where(
            DocumentSeal.entity_type == entity_type,
            DocumentSeal.entity_id == uuid.UUID(entity_id),
            DocumentSeal.kind == kind,
        )
    ).scalar_one()


def test_admin_alone_records_and_approves_others_follow_the_circuit(client: Any, db: Any) -> None:
    from app.modules.system.models import AuditEvent

    env = _setup(client, db)
    call = _funds_call(client, env, amount=600000)
    path = f"/funds-calls/{call['id']}/payments"

    # Super administrateur : saisit puis approuve lui-même (tracé au journal d'audit).
    mine = _receipt(client, env["ah"], path, reference="VIR-ADM-001", amount=200000)
    assert mine.status_code == 201, mine.text
    approved = client.post(f"{API}/payments/{mine.json()['id']}/approve", headers=env["ah"], json={})
    assert approved.status_code == 200 and approved.json()["status"] == "succeeded", approved.text
    assert db.execute(
        select(AuditEvent).where(
            AuditEvent.action == "ADMIN_SELF_APPROVAL", AuditEvent.resource_id == mine.json()["id"]
        )
    ).scalar_one_or_none()

    # Tout autre profil suit le circuit : la saisie est approuvée par une autre personne.
    other = _receipt(client, env["fh"], path, reference="VIR-FIN-002", amount=100000)
    assert other.status_code == 201, other.text
    own = client.post(f"{API}/payments/{other.json()['id']}/approve", headers=env["fh"], json={})
    assert own.status_code == 422 and own.json()["error"]["code"] == "SEGREGATION_OF_DUTIES"
    assert client.post(f"{API}/payments/{other.json()['id']}/approve", headers=env["vh"], json={}).status_code == 200

    # Le reçu porte un QR d'authenticité : la vérification publique affiche ses données et son statut à jour.
    seal = _seal(db, "payment", mine.json()["id"], "receipt")
    verified = client.get(f"{API}/public/verify/{seal.token}").json()
    assert verified["valid"] is True and verified["type"] == "sealed" and verified["kind_label"] == "Reçu de paiement"
    assert verified["number"] == approved.json()["number"] and Decimal(verified["amount"]) == Decimal("200000")
    assert verified["status"] == "succeeded" and len(verified["sha256"]) == 64
    assert client.get(f"{API}/public/verify/inconnu-0000").json()["valid"] is False


def test_invoice_categories_proforma_definitive_credit_note(client: Any, db: Any) -> None:
    from app.core.pdf import extract_text

    env = _setup(client, db)
    project = env["project"]
    invoice = client.post(
        f"{API}/client-invoices",
        headers=env["fh"],
        json={
            "project_id": project["id"],
            "organization_id": str(env["org"].id),
            "kind": "deposit",
            "title": "Acompte gros œuvre",
            "issue_date": date.today().isoformat(),
            "due_date": (date.today() + timedelta(days=15)).isoformat(),
            "tax_rate": 19.25,
            "lines": [{"designation": "Acompte 30 %", "unit": "forfait", "quantity": 1, "unit_price": 1000000}],
        },
    )
    assert invoice.status_code == 201, invoice.text
    invoice = invoice.json()

    # Brouillon = facture PROFORMA : PDF provisoire scellé ; le client ne voit pas les brouillons.
    proforma = client.get(f"{API}/client-invoices/{invoice['id']}/pdf", headers=env["fh"])
    assert proforma.status_code == 200 and proforma.content[:4] == b"%PDF"
    text, _pages = extract_text(proforma.content)
    assert "FACTURE PROFORMA D'ACOMPTE" in text and "PROFORMA" in text
    assert client.get(f"{API}/client-invoices/{invoice['id']}/pdf", headers=env["custh"]).status_code == 404
    proforma_seal = _seal(db, "client_invoice", invoice["id"], "proforma")
    pending = client.get(f"{API}/public/verify/{proforma_seal.token}").json()
    assert pending["kind"] == "proforma" and "sans valeur comptable" in pending["note"]

    # Validation par une autre personne : facture définitive (titre selon la catégorie, montant en lettres, QR).
    validated = client.post(f"{API}/client-invoices/{invoice['id']}/validate", headers=env["vh"])
    assert validated.status_code == 200, validated.text
    definitive = client.get(f"{API}/client-invoices/{invoice['id']}/pdf", headers=env["fh"])
    text, _pages = extract_text(definitive.content)
    assert "FACTURE D'ACOMPTE" in text and "PROFORMA" not in text and "Arrêtée la présente facture" in text
    assert "remplacée" in client.get(f"{API}/public/verify/{proforma_seal.token}").json()["note"]

    # Facture d'avoir (note de crédit) : PDF scellé, accessible au client, listé dans ses finances.
    note = client.post(
        f"{API}/client-invoices/{invoice['id']}/credit-notes",
        headers=env["vh"],
        json={"amount": 100000, "reason": "Remise commerciale accordée"},
    )
    assert note.status_code == 201, note.text
    note = note.json()
    assert note["file_id"]
    pdf = client.get(f"{API}/credit-notes/{note['id']}/pdf", headers=env["custh"])
    assert pdf.status_code == 200 and "FACTURE D'AVOIR" in extract_text(pdf.content)[0]
    sealed = client.get(f"{API}/public/verify/{_seal(db, 'credit_note', note['id'], 'credit_note').token}").json()
    assert sealed["kind_label"] == "Facture d'avoir" and Decimal(sealed["amount"]) == Decimal("100000")
    client.post(f"{API}/client-invoices/{invoice['id']}/send", headers=env["fh"])
    finances = client.get(f"{API}/client/projects/{project['id']}/finances", headers=env["custh"]).json()
    assert [n["number"] for n in finances["credit_notes"]] == [note["number"]]
    assert finances["invoices"][0]["kind"] == "deposit"


def test_archived_project_is_listed_and_can_be_restored(client: Any, db: Any) -> None:
    env = _setup(client, db)
    pid = env["project"]["id"]
    short = client.post(f"{API}/projects/{pid}/archive", headers=env["ah"], json={"reason": "court"})
    assert short.status_code == 422
    archived = client.post(
        f"{API}/projects/{pid}/archive", headers=env["ah"], json={"reason": "Chantier suspendu à la demande du client"}
    )
    assert archived.status_code == 200
    assert client.get(f"{API}/projects/{pid}", headers=env["ah"]).status_code == 404
    rows = client.get(f"{API}/projects/archived", headers=env["ah"]).json()
    row = next(r for r in rows if r["id"] == pid)
    assert (
        row["archive_reason"] == "Chantier suspendu à la demande du client"
        and row["archived_by"]
        and row["can_restore"]
    )

    assert client.post(f"{API}/projects/{pid}/restore", headers=env["ah"], json={"reason": "court"}).status_code == 422
    restored = client.post(
        f"{API}/projects/{pid}/restore", headers=env["ah"], json={"reason": "Reprise des travaux en novembre"}
    )
    assert restored.status_code == 200, restored.text
    assert client.get(f"{API}/projects/{pid}", headers=env["ah"]).status_code == 200
    assert all(r["id"] != pid for r in client.get(f"{API}/projects/archived", headers=env["ah"]).json())


def test_project_finance_is_hidden_without_finance_rights(client: Any, db: Any) -> None:
    env = _setup(client, db)
    pid = env["project"]["id"]
    site_manager, sh = as_role(client, db, "CHEF_CHANTIER")
    client.post(
        f"{API}/projects/{pid}/members",
        headers=env["ah"],
        json={"user_id": str(site_manager.id), "project_role": "chef_chantier"},
    )
    seen = client.get(f"{API}/projects/{pid}", headers=sh)
    assert seen.status_code == 200, seen.text
    seen = seen.json()
    assert (
        "contract_amount" not in seen and "gross_margin" not in seen["kpis"] and "approved_changes" not in seen["kpis"]
    )
    assert "progress_pct" in seen["kpis"]
    full = client.get(f"{API}/projects/{pid}", headers=env["ah"]).json()
    assert Decimal(full["contract_amount"]) == Decimal("85000000") and "gross_margin" in full["kpis"]


def test_change_order_and_leave_follow_the_circuit(client: Any, db: Any) -> None:
    from app.modules.hr.models import Employee, LeaveRequest
    from app.modules.projects.models import ChangeOrder
    from app.modules.projects.service import transition_change_order

    env = _setup(client, db)
    # Avenant établi par la direction (qui a aussi le droit d'approuver) : approuvé par une autre personne.
    _director, dh = as_role(client, db, "DIRECTION")
    co = client.post(
        f"{API}/change-orders",
        headers=dh,
        json={"project_id": env["project"]["id"], "title": "Garde-corps terrasse", "cost_impact": 300000},
    )
    assert co.status_code == 201, co.text
    co = co.json()
    client.post(f"{API}/change-orders/{co['id']}/transition", headers=dh, json={"target": "submitted"})
    transition_change_order(
        db, db.get(ChangeOrder, uuid.UUID(co["id"])), "client_approved", user_id=env["customer"].id, client=True
    )
    db.commit()
    own = client.post(f"{API}/change-orders/{co['id']}/transition", headers=dh, json={"target": "approved"})
    assert own.status_code == 422 and own.json()["error"]["code"] == "SEGREGATION_OF_DUTIES"
    ok = client.post(f"{API}/change-orders/{co['id']}/transition", headers=env["vh"], json={"target": "approved"})
    assert ok.status_code == 200, ok.text

    # Congé : décidé par une autre personne que le salarié, même s'il a le droit RH.
    hr_user, rh = as_role(client, db, "RH")
    _other, rh2 = as_role(client, db, "RH")
    employee = Employee(
        matricule=f"EMP-{uuid.uuid4().hex[:6]}",
        user_id=hr_user.id,
        first_name="Linda",
        last_name="Mbarga",
        job_title="Assistante RH",
        hire_date=date(2026, 1, 5),
        badge_token=uuid.uuid4().hex,
    )
    db.add(employee)
    db.flush()
    leave = LeaveRequest(
        employee_id=employee.id,
        kind="conge",
        start_date=date.today() + timedelta(days=7),
        end_date=date.today() + timedelta(days=8),
    )
    db.add(leave)
    db.commit()
    own_leave = client.post(f"{API}/hr/leaves/{leave.id}/decision", headers=rh, json={"approve": True})
    assert own_leave.status_code == 422 and own_leave.json()["error"]["code"] == "SEGREGATION_OF_DUTIES"
    assert client.post(f"{API}/hr/leaves/{leave.id}/decision", headers=rh2, json={"approve": True}).status_code == 200
