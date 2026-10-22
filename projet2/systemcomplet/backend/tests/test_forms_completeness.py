"""Formulaires complets : chaque information utile se saisit dès la création (organisation extranet d'un fournisseur ou
d'un sous-traitant, offre / étiquettes / commercial d'un lead, demandeur d'un ticket SAV saisi pour un client, étape et
date de décision d'une conversion, justificatif d'une dépense, pièces du DCE d'une consultation)."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from tests.conftest import as_role, login, make_user

API = "/api/v1"


def _org(db: Any, kind: str, name: str | None = None) -> Any:
    from app.modules.identity.models import Organization

    org = Organization(name=name or f"Org {kind} {uuid.uuid4().hex[:6]}", kind=kind)
    db.add(org)
    db.commit()
    return org


def _admin(client: Any, db: Any) -> dict[str, str]:
    admin = make_user(db, email=f"admin-forms-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    return login(client, admin.email)


def test_supplier_is_linked_to_its_extranet_organization_at_creation(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    org = _org(db, "supplier", "TEST Quincaillerie du Wouri")
    created = client.post(
        f"{API}/suppliers",
        headers=ah,
        json={"legal_name": "TEST Quincaillerie du Wouri", "organization_id": str(org.id), "categories": ["ciment"]},
    )
    assert created.status_code == 201, created.text
    assert created.json()["organization_id"] == str(org.id)

    # Une organisation ne sert qu'une fiche (l'extranet retrouve la fiche par l'organisation du compte).
    twice = client.post(f"{API}/suppliers", headers=ah, json={"legal_name": "Doublon", "organization_id": str(org.id)})
    assert twice.status_code == 409 and twice.json()["error"]["code"] == "ORGANIZATION_TAKEN"

    # Mauvais type d'organisation : refusé avec un message clair.
    client_org = _org(db, "client")
    wrong = client.post(
        f"{API}/suppliers", headers=ah, json={"legal_name": "Mauvais type", "organization_id": str(client_org.id)}
    )
    assert wrong.status_code == 422 and wrong.json()["error"]["code"] == "ORGANIZATION_KIND"

    # La fiche garde son organisation à la modification (pas de faux doublon avec elle-même).
    same = client.patch(
        f"{API}/suppliers/{created.json()['id']}", headers=ah, json={"organization_id": str(org.id), "city": "Douala"}
    )
    assert same.status_code == 200, same.text

    # Le compte de l'organisation ouvre l'extranet de cette fiche.
    _user, fh = as_role(client, db, "FOURNISSEUR", org_id=org.id)
    me = client.get(f"{API}/extranet/supplier/profile", headers=fh)
    if me.status_code != 404:  # route de profil présente
        assert me.status_code == 200, me.text


def test_subcontractor_organization_must_be_a_subcontractor(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    supplier_org = _org(db, "supplier")
    refused = client.post(
        f"{API}/subcontractors",
        headers=ah,
        json={
            "legal_name": "TEST Électricité Akwa",
            "trades": ["electricite"],
            "organization_id": str(supplier_org.id),
        },
    )
    assert refused.status_code == 422 and refused.json()["error"]["code"] == "ORGANIZATION_KIND"
    org = _org(db, "subcontractor")
    ok = client.post(
        f"{API}/subcontractors",
        headers=ah,
        json={"legal_name": "TEST Électricité Akwa", "trades": ["electricite"], "organization_id": str(org.id)},
    )
    assert ok.status_code == 201, ok.text
    assert ok.json()["organization_id"] == str(org.id) and ok.json()["status"] == "prospect"


def test_manual_lead_keeps_offer_tags_and_chosen_commercial(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    commercial = make_user(db, roles=["COMMERCIAL"], first_name="Jordan")
    created = client.post(
        f"{API}/crm/leads",
        headers=ah,
        json={
            "first_name": "Paul",
            "last_name": "TEST-MBALLA",
            "phone": "690112233",
            "universe": "HOME",
            "offer_slug": "villa-cle-en-main",
            "preferred_channel": "whatsapp",
            "tags": ["salon", "décisionnaire"],
            "assigned_to_id": str(commercial.id),
        },
    )
    assert created.status_code == 201, created.text
    lead = created.json()
    assert lead["offer_slug"] == "villa-cle-en-main"
    assert {"salon", "décisionnaire"} <= set(lead["tags"])
    assert lead["assigned_to_id"] == str(commercial.id)
    assert lead["preferred_channel"] == "whatsapp"

    # Un commercial sans droit d'affectation ne choisit pas le titulaire.
    _assistant, xh = as_role(client, db, "MARKETING")
    denied = client.post(
        f"{API}/crm/leads",
        headers=xh,
        json={"first_name": "Autre", "phone": "690000001", "assigned_to_id": str(commercial.id)},
    )
    assert denied.status_code in (403, 422), denied.text

    # Coordonnées corrigées après coup (numéro WhatsApp communiqué plus tard, pays de résidence).
    patched = client.patch(
        f"{API}/crm/leads/{lead['id']}",
        headers=ah,
        json={"whatsapp": "677 88 99 00", "country": "France", "city": "Lyon", "land_status": "titre_foncier"},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["whatsapp"].endswith("677889900")
    assert patched.json()["is_diaspora"] is True

    # Conversion : étape et date de décision choisies.
    decision = (date.today() + timedelta(days=15)).isoformat()
    converted = client.post(
        f"{API}/crm/leads/{lead['id']}/convert",
        headers=ah,
        json={"amount": 25000000, "stage": "discovery", "expected_close_date": decision},
    )
    assert converted.status_code == 200, converted.text
    opp = client.get(f"{API}/crm/opportunities/{converted.json()['opportunity_id']}", headers=ah).json()
    assert opp["stage"] == "discovery" and opp["expected_close_date"] == decision


def test_ticket_taken_by_phone_is_recorded_for_the_client(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    customer_org = _org(db, "client", "Famille TEST-MBALLA")
    project = client.post(
        f"{API}/projects",
        headers=ah,
        json={
            "name": "TEST — Villa Mballa",
            "client_organization_id": str(customer_org.id),
            "status": "execution",
            "start_planned": (date.today() - timedelta(days=30)).isoformat(),
            "end_planned": (date.today() + timedelta(days=300)).isoformat(),
        },
    ).json()
    created = client.post(
        f"{API}/support/tickets",
        headers=ah,
        json={
            "project_id": project["id"],
            "subject": "Fuite sous la fenêtre du séjour",
            "category": "etancheite",
            "channel": "email",
            "requester_name": "Paul TEST-MBALLA",
            "requester_email": "Paul.Mballa@Example.com",
            "requester_phone": "690112233",
        },
    )
    assert created.status_code == 201, created.text
    ticket = created.json()
    assert ticket["requester_name"] == "Paul TEST-MBALLA"
    assert ticket["requester_email"] == "paul.mballa@example.com"
    assert ticket["channel"] == "email"
    assert ticket["organization_id"] == str(customer_org.id)  # le client le voit dans son espace

    _customer, ch = as_role(client, db, "CLIENT", org_id=customer_org.id)
    mine = client.get(f"{API}/support/tickets", headers=ch).json()["items"]
    assert any(t["id"] == ticket["id"] for t in mine)

    # Un client connecté reste le demandeur, quoi qu'il envoie.
    own = client.post(
        f"{API}/support/tickets",
        headers=ch,
        json={"project_id": project["id"], "subject": "Porte qui frotte", "requester_name": "Quelqu'un d'autre"},
    )
    assert own.status_code == 201, own.text
    assert own.json()["requester_name"] != "Quelqu'un d'autre" and own.json()["channel"] == "portal"


def test_expense_receipt_is_uploaded_then_downloadable(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    project = client.post(
        f"{API}/projects",
        headers=ah,
        json={
            "name": "Projet dépenses",
            "start_planned": date.today().isoformat(),
            "end_planned": (date.today() + timedelta(days=90)).isoformat(),
        },
    ).json()
    pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
    uploaded = client.post(f"{API}/finance/files", headers=ah, files={"file": ("ticket.pdf", pdf, "application/pdf")})
    assert uploaded.status_code == 201, uploaded.text
    expense = client.post(
        f"{API}/expenses",
        headers=ah,
        json={
            "project_id": project["id"],
            "label": "Ciment d'appoint",
            "amount": 52000,
            "expense_date": date.today().isoformat(),
            "file_id": uploaded.json()["file_id"],
        },
    )
    assert expense.status_code == 201, expense.text
    assert expense.json()["source_type"] == "manual"
    got = client.get(f"{API}/expenses/{expense.json()['id']}/file", headers=ah)
    assert got.status_code == 200 and got.content.startswith(b"%PDF")


def test_contract_penalty_cap_is_set_at_creation() -> None:
    from app.modules.subcontracting.router import ContractIn

    field = ContractIn.model_fields["penalty_cap_pct"]
    assert str(field.default) == "10"


def test_tender_lists_its_dce_pieces(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    project = client.post(
        f"{API}/projects",
        headers=ah,
        json={
            "name": "Projet DCE",
            "start_planned": date.today().isoformat(),
            "end_planned": (date.today() + timedelta(days=90)).isoformat(),
        },
    ).json()
    pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
    doc = client.post(
        f"{API}/documents",
        headers=ah,
        data={"title": "Plan électricité RDC", "doc_type": "plan", "project_id": project["id"]},
        files={"file": ("plan-elec.pdf", pdf, "application/pdf")},
    )
    assert doc.status_code == 201, doc.text
    version_id = doc.json()["current_version"]["id"]
    tender = client.post(
        f"{API}/tenders",
        headers=ah,
        json={
            "project_id": project["id"],
            "title": "Lot électricité",
            "deadline": (datetime.now(UTC) + timedelta(hours=2)).isoformat(),
            "document_version_ids": [version_id],
            "quality_criteria": [
                {"key": "prix", "weight": 60},
                {"key": "delai", "weight": 20},
                {"key": "technique", "weight": 10},
                {"key": "historique", "weight": 10},
            ],
            "lots": [{"code": "ELEC", "name": "Électricité", "items": [{"designation": "Tableau", "quantity": 1}]}],
        },
    )
    assert tender.status_code == 201, tender.text
    out = tender.json()
    assert [d["title"] for d in out["documents"]] == ["Plan électricité RDC"]
    assert {c["key"]: c["weight"] for c in out["quality_criteria"]}["prix"] == 60


def test_too_long_text_is_a_clear_field_error_not_a_server_error(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    resp = client.post(
        f"{API}/cash-forecast-entries",
        headers=ah,
        json={"label": "Encaissement", "direction": "entrée prévue", "amount": 1000, "expected_date": "2026-12-01"},
    )
    assert resp.status_code == 422, resp.text
    fields = {f["field"] for f in resp.json()["error"]["details"]}
    assert "direction" in fields
