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


def test_staff_gets_the_company_and_partners_need_their_organization(client: Any, db: Any) -> None:
    from app.modules.identity.models import Organization, User

    ah = _admin(client, db)
    staff = client.post(
        f"{API}/users",
        headers=ah,
        json={
            "email": f"grace-{uuid.uuid4().hex[:5]}@example.com",
            "first_name": "Grâce",
            "last_name": "TEST-EWANE",
            "role_codes": ["DIRECTION"],
            "send_invitation": False,
        },
    )
    assert staff.status_code == 201, staff.text
    user = db.get(User, uuid.UUID(staff.json()["id"]))
    org = db.get(Organization, user.organization_id)
    assert org is not None and org.kind == "internal"

    missing = client.post(
        f"{API}/users",
        headers=ah,
        json={
            "email": f"martin-{uuid.uuid4().hex[:5]}@example.com",
            "first_name": "Martin",
            "last_name": "TEST-KAMGA",
            "role_codes": ["FOURNISSEUR"],
            "send_invitation": False,
        },
    )
    assert missing.status_code == 422 and missing.json()["error"]["code"] == "ORGANIZATION_REQUIRED"
    supplier_org = _org(db, "supplier")
    ok = client.post(
        f"{API}/users",
        headers=ah,
        json={
            "email": f"martin-{uuid.uuid4().hex[:5]}@example.com",
            "first_name": "Martin",
            "last_name": "TEST-KAMGA",
            "role_codes": ["FOURNISSEUR"],
            "organization_id": str(supplier_org.id),
            "send_invitation": False,
        },
    )
    assert ok.status_code == 201, ok.text


def test_staff_account_without_organization_is_still_internal(db: Any) -> None:
    from app.core.deps import org_kind_of

    user = make_user(db, roles=["CHEF_PROJET"])
    user.organization_id = None
    db.commit()
    db.refresh(user)
    assert org_kind_of(user) == "internal"


def test_a_budget_is_approved_by_someone_else_than_its_author(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    project = client.post(
        f"{API}/projects",
        headers=ah,
        json={"name": "Projet budget", "start_planned": date.today().isoformat()},
    ).json()
    budget = client.post(
        f"{API}/budgets",
        headers=ah,
        json={
            "project_id": project["id"],
            "label": "Budget de référence",
            "lines": [{"label": "Gros œuvre", "amount": 1000000}],
        },
    )
    assert budget.status_code == 201, budget.text
    own = client.post(f"{API}/budgets/{budget.json()['id']}/approve", headers=ah)
    assert own.status_code == 422 and own.json()["error"]["code"] == "SEGREGATION_OF_DUTIES"
    _director, dh = as_role(client, db, "DIRECTION")
    other = client.post(f"{API}/budgets/{budget.json()['id']}/approve", headers=dh)
    assert other.status_code == 200, other.text


def test_petty_cash_category_is_checked_and_lands_in_a_budget_cost_category(db: Any) -> None:
    """Rubriques de petite caisse (transport, carburant…) : liste fermée, ventilée dans les catégories du budget."""
    from decimal import Decimal

    import pytest

    from app.core.errors import BusinessRuleError
    from app.modules.finance.models import COST_CATEGORIES, PETTY_CASH_CATEGORIES, PettyCashFund
    from app.modules.finance.service import petty_cash_movement

    assert set(PETTY_CASH_CATEGORIES.values()) <= set(COST_CATEGORIES)
    user = make_user(db, email=f"caisse-{uuid.uuid4().hex[:6]}@example.com", roles=["FINANCE"])
    fund = PettyCashFund(name="Caisse test", ceiling=Decimal("100000"), balance=Decimal("50000"))
    db.add(fund)
    db.flush()
    common = {"kind": "in", "amount": Decimal("1000"), "purpose": "Appoint", "lot_id": None, "receipt_file_id": None}
    with pytest.raises(BusinessRuleError):
        petty_cash_movement(db, fund, category="cadeaux", user_id=user.id, transaction_date=date.today(), **common)
    tx = petty_cash_movement(db, fund, category="carburant", user_id=user.id, transaction_date=date.today(), **common)
    assert tx.category == "carburant" and PETTY_CASH_CATEGORIES[tx.category] == "frais_generaux"


def test_change_order_cost_impact_is_the_total_of_its_priced_lines(client: Any, db: Any) -> None:
    """Avenant chiffré : l'impact coût est le total des lignes (aucune recopie manuelle à oublier)."""
    from decimal import Decimal

    from app.modules.projects.models import Project

    headers = _admin(client, db)
    project = Project(code=f"AV-{uuid.uuid4().hex[:6]}", name="Projet avenant", status="active")
    db.add(project)
    db.commit()
    res = client.post(
        f"{API}/change-orders",
        headers=headers,
        json={
            "project_id": str(project.id),
            "title": "Carrelage supplémentaire",
            "cost_impact": 0,
            "lines": [
                {"designation": "Carrelage séjour", "quantity": 20, "unit": "m²", "unit_price": 15000},
                {"designation": "Plinthes", "quantity": 1, "unit": "forfait", "unit_price": 50000},
            ],
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert Decimal(body["cost_impact"]) == Decimal("350000")
    assert [Decimal(line["amount"]) for line in body["lines"]] == [Decimal("300000"), Decimal("50000")]


def test_petty_cash_custodian_declares_without_finance_rights_and_cannot_validate(client: Any, db: Any) -> None:
    """Ma petite caisse : le gestionnaire (chef de chantier, sans droit finance) voit sa caisse, y déclare une
    dépense avec reçu ; il ne la valide pas ; un autre utilisateur sans droit ne voit rien."""
    from decimal import Decimal

    from app.modules.finance.models import PettyCashFund

    keeper = make_user(db, email=f"gestionnaire-{uuid.uuid4().hex[:6]}@example.com", roles=["CHEF_CHANTIER"])
    other = make_user(db, email=f"autre-{uuid.uuid4().hex[:6]}@example.com", roles=["CHEF_CHANTIER"])
    fund = PettyCashFund(
        name="Caisse gestionnaire", custodian_id=keeper.id, ceiling=Decimal("100000"), balance=Decimal("50000")
    )
    db.add(fund)
    db.commit()
    kh, oh = login(client, keeper.email), login(client, other.email)

    me = client.get(f"{API}/auth/me", headers=kh).json()
    assert "petty_cash" in me["features"]
    assert "petty_cash" not in client.get(f"{API}/auth/me", headers=oh).json()["features"]
    mine = client.get(f"{API}/petty-cash/me", headers=kh).json()
    assert [f["id"] for f in mine] == [str(fund.id)] and mine[0]["pending_count"] == 0
    assert client.get(f"{API}/petty-cash/me", headers=oh).json() == []

    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
    form = {"kind": "out", "amount": "15000", "purpose": "Carburant", "category": "carburant"}
    no_receipt = client.post(
        f"{API}/petty-cash-funds/{fund.id}/transactions",
        headers=kh,
        data={**form, "transaction_date": date.today().isoformat()},
    )
    assert no_receipt.status_code == 422 and no_receipt.json()["error"]["code"] == "RECEIPT_REQUIRED"
    tx = client.post(
        f"{API}/petty-cash-funds/{fund.id}/transactions",
        headers=kh,
        data={**form, "transaction_date": date.today().isoformat()},
        files={"receipt": ("ticket.png", png, "image/png")},
    )
    assert tx.status_code == 201, tx.text
    listed = client.get(f"{API}/petty-cash-funds/{fund.id}/transactions", headers=kh).json()
    assert [t["status"] for t in listed["items"]] == ["pending"]
    assert client.get(f"{API}/petty-cash-funds/{fund.id}/transactions", headers=oh).status_code == 403
    assert (
        client.post(
            f"{API}/petty-cash-transactions/{tx.json()['id']}/validate", headers=kh, json={"approve": True}
        ).status_code
        == 403
    )
