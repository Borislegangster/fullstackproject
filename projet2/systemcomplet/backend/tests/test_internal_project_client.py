"""Projet interne (sans client) → client associé ensuite : invitation automatique à l'espace client, contrat ou
opportunité rattachés au projet existant, appels de fonds préparés depuis les jalons de paiement, aucune facture
émise sans client."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from tests.conftest import as_role, login, make_user

API = "/api/v1"


def _client_org(db: Any, label: str) -> tuple[Any, Any]:
    from app.modules.crm.models import Contact
    from app.modules.identity.models import Organization

    org = Organization(name=f"Client {label} {uuid.uuid4().hex[:5]}", kind="client")
    db.add(org)
    db.flush()
    contact = Contact(
        organization_id=org.id,
        first_name="Awa",
        last_name=label,
        email=f"awa-{label.lower()}-{uuid.uuid4().hex[:6]}@example.com",
    )
    db.add(contact)
    db.commit()
    return org, contact


def _invitations(db: Any, email: str, project_id: str) -> int:
    from app.modules.identity.models import Invitation

    db.expire_all()
    return sum(1 for inv in db.query(Invitation).filter(Invitation.email == email) if project_id in inv.project_ids)


def _signed_contract(client: Any, ah: dict[str, str], body: dict[str, Any]) -> dict[str, Any]:
    quote = client.post(f"{API}/crm/quotes", headers=ah, json=body)
    assert quote.status_code == 201, quote.text
    quote = quote.json()
    token = client.post(f"{API}/crm/quotes/{quote['id']}/send", headers=ah).json()["public_url"].rsplit("/", 1)[-1]
    otp = client.post(f"{API}/public/quotes/{token}/otp").json()
    accepted = client.post(
        f"{API}/public/quotes/{token}/accept",
        json={"full_name": "Awa Client", "otp_token": otp["otp_token"], "code": otp["test_code"], "accept_terms": True},
    )
    assert accepted.status_code == 200, accepted.text
    contract = client.post(f"{API}/crm/quotes/{quote['id']}/contract", headers=ah).json()
    scan = client.post(
        f"{API}/crm/files", headers=ah, files={"file": ("contrat.pdf", b"%PDF-1.4 contrat %%EOF", "application/pdf")}
    ).json()
    signed = client.post(
        f"{API}/crm/contracts/{contract['id']}/sign",
        headers=ah,
        json={"signed_by_name": "Awa Client", "method": "manuscrite_scannee", "evidence_file_id": scan["file_id"]},
    )
    assert signed.status_code == 200, signed.text
    return {**contract, "quote_total": quote["total"]}


def test_internal_project_then_client_contract_and_funds_calls(client: Any, db: Any) -> None:
    admin = make_user(db, email=f"admin-interne-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    _f1, fh = as_role(client, db, "FINANCE")
    _f2, fh2 = as_role(client, db, "FINANCE")

    # 1. Projet interne, sans client : aucun accès client, aucune facture ni appel de fonds émis
    created = client.post(f"{API}/projects", headers=ah, json={"name": "Prototype maison modulaire"})
    assert created.status_code == 201, created.text
    project_id = created.json()["id"]
    assert created.json()["client_organization_id"] is None and created.json()["client_access"] is None
    call = client.post(
        f"{API}/funds-calls", headers=fh, json={"project_id": project_id, "label": "Essai", "amount": 1000}
    ).json()
    refused = client.post(f"{API}/funds-calls/{call['id']}/issue", headers=fh2, json={})
    assert refused.status_code == 422 and refused.json()["error"]["code"] == "PROJECT_WITHOUT_CLIENT", refused.text
    invoice = client.post(
        f"{API}/client-invoices",
        headers=fh,
        json={
            "project_id": project_id,
            "kind": "studies",
            "title": "Études internes",
            "issue_date": date.today().isoformat(),
            "lines": [{"designation": "Études", "quantity": 1, "unit_price": 1000}],
        },
    ).json()
    refused = client.post(f"{API}/client-invoices/{invoice['id']}/validate", headers=fh2)
    assert refused.status_code == 422 and refused.json()["error"]["code"] == "PROJECT_WITHOUT_CLIENT", refused.text

    # 2. Devis et contrat de travaux pour un client, rattachés au projet interne existant
    org, contact = _client_org(db, "Interne")
    contract = _signed_contract(
        client,
        ah,
        {
            "title": "Travaux maison modulaire",
            "organization_id": str(org.id),
            "contact_id": str(contact.id),
            "payment_schedule": [
                {"label": "Acompte", "pct": 30, "due_date": (date.today() + timedelta(days=10)).isoformat()},
                {"label": "Gros œuvre", "pct": 70},
            ],
            "lines": [
                {
                    "lot_code": "GO",
                    "section": "Gros œuvre",
                    "designation": "Fondations",
                    "quantity": 1,
                    "unit_price": 10000000,
                }
            ],
        },
    )
    attached = client.post(f"{API}/crm/contracts/{contract['id']}/project", headers=ah, json={"project_id": project_id})
    assert attached.status_code == 201 and attached.json()["project_id"] == project_id, attached.text
    project = client.get(f"{API}/projects/{project_id}", headers=ah).json()
    assert project["client_organization_id"] == str(org.id) and project["contract_id"] == contract["id"]
    assert Decimal(project["contract_amount"]) == Decimal(contract["quote_total"])
    assert _invitations(db, contact.email, project_id) == 1  # le contact du client est invité, une seule fois
    client.patch(f"{API}/projects/{project_id}", headers=ah, json={"name": "Maison modulaire Awa"})
    assert _invitations(db, contact.email, project_id) == 1

    # 3. Appels de fonds préparés depuis les jalons (30 % / 70 %), sans doublon ; émission par une autre personne
    generated = client.post(f"{API}/projects/{project_id}/funds-calls/from-milestones", headers=fh)
    assert generated.status_code == 201, generated.text
    calls = generated.json()["created"]
    total = Decimal(contract["quote_total"])
    assert [Decimal(c["amount"]) for c in calls] == [total * Decimal("0.3"), total * Decimal("0.7")]
    assert all(c["status"] == "draft" and c["milestone_id"] for c in calls)
    assert calls[0]["due_date"] == (date.today() + timedelta(days=10)).isoformat()
    again = client.post(f"{API}/projects/{project_id}/funds-calls/from-milestones", headers=fh).json()
    assert again["created"] == [] and again["skipped"] == 2
    issued = client.post(f"{API}/funds-calls/{calls[0]['id']}/issue", headers=fh2, json={})
    assert issued.status_code == 200 and issued.json()["status"] == "issued", issued.text

    # 4. Un autre client ne peut pas reprendre ce projet
    other_org, other_contact = _client_org(db, "Autre")
    other = _signed_contract(
        client,
        ah,
        {
            "title": "Autre client",
            "organization_id": str(other_org.id),
            "contact_id": str(other_contact.id),
            "lines": [{"designation": "Travaux", "quantity": 1, "unit_price": 1000}],
        },
    )
    clash = client.post(f"{API}/crm/contracts/{other['id']}/project", headers=ah, json={"project_id": project_id})
    assert clash.status_code == 422 and clash.json()["error"]["code"] == "PROJECT_CLIENT_MISMATCH", clash.text


def test_client_chosen_on_internal_project_is_invited(client: Any, db: Any) -> None:
    admin = make_user(db, email=f"admin-choix-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    _f1, fh = as_role(client, db, "FINANCE")
    project = client.post(
        f"{API}/projects", headers=ah, json={"name": "Bureau interne", "client_visible": False}
    ).json()
    org, contact = _client_org(db, "Choix")

    # Projet masqué au client : rien n'est envoyé
    hidden = client.patch(f"{API}/projects/{project['id']}", headers=ah, json={"client_organization_id": str(org.id)})
    assert hidden.status_code == 200 and hidden.json()["client_access"]["status"] == "hidden", hidden.text
    assert _invitations(db, contact.email, project["id"]) == 0
    # Rendu visible : le contact du client est invité, une seule fois
    shown = client.patch(f"{API}/projects/{project['id']}", headers=ah, json={"client_visible": True})
    assert shown.json()["client_access"]["status"] == "invited", shown.text
    assert shown.json()["client_access"]["email"] == contact.email
    assert _invitations(db, contact.email, project["id"]) == 1
    client.patch(f"{API}/projects/{project['id']}", headers=ah, json={"client_visible": False})
    again = client.patch(f"{API}/projects/{project['id']}", headers=ah, json={"client_visible": True})
    assert again.json()["client_access"]["status"] == "pending"
    assert _invitations(db, contact.email, project["id"]) == 1
    # Projet sans jalon de paiement ni montant : message clair
    empty = client.post(f"{API}/projects/{project['id']}/funds-calls/from-milestones", headers=fh)
    assert empty.status_code == 422 and empty.json()["error"]["code"] == "NO_CONTRACT_AMOUNT", empty.text


def test_opportunity_takes_over_internal_project(client: Any, db: Any) -> None:
    from app.modules.crm.models import Opportunity

    admin = make_user(db, email=f"admin-opp-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    project = client.post(f"{API}/projects", headers=ah, json={"name": "Immeuble interne"}).json()
    org, contact = _client_org(db, "Opportunite")
    opp = Opportunity(
        number=f"OPP-T-{uuid.uuid4().hex[:6]}",
        title="Immeuble",
        organization_id=org.id,
        contact_id=contact.id,
        owner_id=admin.id,
    )
    db.add(opp)
    db.commit()

    started = client.post(
        f"{API}/crm/opportunities/{opp.id}/start-studies", headers=ah, json={"project_id": project["id"]}
    )
    assert started.status_code == 201 and started.json()["project_id"] == project["id"], started.text
    data = client.get(f"{API}/projects/{project['id']}", headers=ah).json()
    assert data["client_organization_id"] == str(org.id) and data["opportunity_id"] == str(opp.id)
    assert data["commercial_id"] == str(admin.id)
    assert _invitations(db, contact.email, project["id"]) == 1
    again = client.post(f"{API}/crm/opportunities/{opp.id}/start-studies", headers=ah, json={})
    assert again.json()["project_id"] == project["id"]  # idempotent
    assert _invitations(db, contact.email, project["id"]) == 1
