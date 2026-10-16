"""§26.2 — Test critique : sous-traitant devis → contrat → situation → facture → paiement ; V4-SUB-14 (le
sous-traitant soumet devis, situation, facture), V4-SUB-15 (blocage au-delà du marché sans dérogation),
V4-SUB-16 (litige : statut, preuves, chronologie)."""

from __future__ import annotations

import io
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from PIL import Image
from sqlalchemy import select

from tests.conftest import as_role, drain_outbox, login, make_user

API = "/api/v1"


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (12, 12), (251, 140, 67)).save(buf, format="PNG")
    return buf.getvalue()


def _pdf() -> bytes:
    from app.core.pdf import PdfDocument, render

    return render(
        PdfDocument(title="FACTURE", number="ST-TEST", issued_on=date.today(), columns=["Objet"], rows=[["Situation"]])
    )


def _idem() -> dict[str, str]:
    return {"Idempotency-Key": uuid.uuid4().hex}


def test_subcontracting_quote_contract_situation_invoice_payment_dispute(client: Any, db: Any) -> None:
    from app.modules.identity.models import Organization
    from app.modules.notifications.models import Notification
    from app.modules.subcontracting.models import Retention, SubcontractorInvoice
    from app.modules.system.models import ActionItem

    admin = make_user(db, email=f"admin-st-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    chef_projet, cph = as_role(client, db, "CHEF_PROJET")
    chef_chantier, cch = as_role(client, db, "CHEF_CHANTIER")
    _direction, dh = as_role(client, db, "DIRECTION")
    _finance, fh = as_role(client, db, "FINANCE")
    _finance2, fh2 = as_role(client, db, "FINANCE")
    project = client.post(
        f"{API}/projects", headers=ah, json={"name": "Immeuble R+4 Akwa", "city": "Douala", "status": "execution"}
    ).json()
    for user, role in ((chef_projet, "chef_projet"), (chef_chantier, "chef_chantier")):
        client.post(
            f"{API}/projects/{project['id']}/members", headers=ah, json={"user_id": str(user.id), "project_role": role}
        )

    org = Organization(name="BTP Gros Œuvre Sarl", kind="subcontractor")
    db.add(org)
    db.flush()
    db.commit()
    st_user, sth = as_role(client, db, "SOUS_TRAITANT", org_id=org.id)
    sub = client.post(
        f"{API}/subcontractors",
        headers=ah,
        json={
            "legal_name": "BTP Gros Œuvre Sarl",
            "trades": ["gros_oeuvre"],
            "city": "Douala",
            "email": "contact@btpgo.example.com",
            "organization_id": str(org.id),
            "workforce_size": 25,
            "bank_account": "CM21 30005 0000 9876543210 77",
            "insurance_rc_until": (date.today() + timedelta(days=300)).isoformat(),
            "insurance_decennale_until": (date.today() + timedelta(days=300)).isoformat(),
        },
    )
    assert sub.status_code == 201, sub.text
    sub = sub.json()
    assert "bank_account" not in sub and sub["bank_account_masked"].endswith("0 77")

    # 43. Qualification (grille notée) → statut « qualified »
    qualif = client.post(
        f"{API}/subcontractors/{sub['id']}/qualifications",
        headers=ah,
        json={
            "trade": "gros_oeuvre",
            "decision": "approved",
            "criteria": {"references": 4, "capacite": 4, "securite": 4, "finances": 3, "qualite": 4},
        },
    )
    assert qualif.status_code == 201, qualif.text
    assert Decimal(qualif.json()["score"]) == Decimal("77.00") and qualif.json()["subcontractor_status"] == "qualified"

    # 44. Consultation multi-lots (métré, critères, invitations ciblées)
    tender = client.post(
        f"{API}/tenders",
        headers=cph,
        json={
            "project_id": project["id"],
            "title": "Gros œuvre R+4",
            "technical_spec": "Béton C25/30, coffrage bois",
            "deadline": (datetime.now(UTC) + timedelta(hours=2)).isoformat(),
            "lots": [
                {
                    "code": "GO",
                    "name": "Gros œuvre",
                    "estimated_amount": 4500000,
                    "items": [
                        {"designation": "Béton dalle C25/30", "unit": "m3", "quantity": 40},
                        {"designation": "Coffrage dalle", "unit": "m2", "quantity": 200},
                    ],
                }
            ],
        },
    )
    assert tender.status_code == 201, tender.text
    tender = tender.json()
    assert client.post(f"{API}/tenders/{tender['id']}/publish", headers=cph).json()["error"]["code"] == "NO_INVITATION"
    client.post(f"{API}/tenders/{tender['id']}/invitations", headers=cph, json={"subcontractor_ids": [sub["id"]]})
    published = client.post(f"{API}/tenders/{tender['id']}/publish", headers=cph)
    assert published.status_code == 200 and published.json()["status"] == "published"
    drain_outbox()
    assert (
        db.execute(
            select(Notification).where(
                Notification.user_id == st_user.id, Notification.event_type == "tender.published"
            )
        )
        .scalars()
        .first()
    )

    # 45. Le sous-traitant consulte et dépose son devis (V4-SUB-14)
    listed = client.get(f"{API}/extranet/subcontractor/tenders", headers=sth).json()
    assert listed[0]["open"] is True
    detail = client.get(f"{API}/extranet/subcontractor/tenders/{tender['id']}", headers=sth).json()
    lot = detail["lots"][0]
    beton, coffrage = lot["items"]
    incomplete = client.post(
        f"{API}/extranet/subcontractor/tenders/{tender['id']}/bids",
        headers=sth,
        json={
            "tender_lot_id": lot["id"],
            "duration_days": 45,
            "lines": [{"tender_item_id": beton["id"], "unit_price": 85000}],
        },
    )
    assert incomplete.status_code == 422 and incomplete.json()["error"]["code"] == "INCOMPLETE_BID"
    bid = client.post(
        f"{API}/extranet/subcontractor/tenders/{tender['id']}/bids",
        headers=sth,
        json={
            "tender_lot_id": lot["id"],
            "duration_days": 45,
            "exclusions": "Fourniture des aciers",
            "lines": [
                {"tender_item_id": beton["id"], "unit_price": 85000},
                {"tender_item_id": coffrage["id"], "unit_price": 6000},
            ],
        },
    )
    assert bid.status_code == 201, bid.text
    bid = bid.json()
    assert Decimal(bid["amount"]) == Decimal("4600000.00")

    # Pli scellé jusqu'à la date limite, puis comparatif (46)
    sealed = client.get(f"{API}/tenders/{tender['id']}/bids", headers=cph).json()
    assert sealed["sealed"] is True and sealed["count"] == 1 and sealed["bids"] == []
    assert client.get(f"{API}/tenders/{tender['id']}/lots/{lot['id']}/comparison", headers=cph).status_code == 422
    client.post(f"{API}/tenders/{tender['id']}/close", headers=cph)
    comparison = client.get(f"{API}/tenders/{tender['id']}/lots/{lot['id']}/comparison", headers=cph).json()
    assert comparison["bids"][0]["subcontractor"] == "BTP Gros Œuvre Sarl"
    assert comparison["bids"][0]["delta_vs_estimate_pct"] == 2.2

    # 47. Négociation historisée → 48. attribution (rôle habilité) → 49. contrat signé par OTP
    client.post(
        f"{API}/bids/{bid['id']}/negotiations", headers=cph, json={"amount": 4400000, "comment": "Alignement budget"}
    )
    accepted = client.post(f"{API}/extranet/subcontractor/bids/{bid['id']}/negotiations/accept", headers=sth)
    assert Decimal(accepted.json()["final_amount"]) == Decimal("4400000.00")
    award_body = {
        "bid_id": bid["id"],
        "retention_pct": 5,
        "advance_amount": 440000,
        "advance_recovery_pct": 20,
        "penalty_per_day": 25000,
        "start_date": date.today().isoformat(),
        "end_date": (date.today() + timedelta(days=60)).isoformat(),
    }
    assert client.post(f"{API}/tenders/{tender['id']}/award", headers=cph, json=award_body).status_code == 403
    contract = client.post(f"{API}/tenders/{tender['id']}/award", headers=dh, json=award_body)
    assert contract.status_code == 201, contract.text
    contract = contract.json()
    assert Decimal(contract["amount"]) == Decimal("4400000.00") and contract["status"] == "draft"
    client.post(f"{API}/subcontracts/{contract['id']}/send", headers=dh)
    otp = client.post(f"{API}/extranet/subcontractor/subcontracts/{contract['id']}/sign/otp", headers=sth).json()
    signed = client.post(
        f"{API}/extranet/subcontractor/subcontracts/{contract['id']}/sign",
        headers=sth,
        json={
            "otp_token": otp["otp_token"],
            "code": otp["test_code"],
            "signer_name": "Jean Mbarga",
            "accept_terms": True,
        },
    )
    assert signed.status_code == 200, signed.text
    assert signed.json()["status"] == "signed"

    # 50. Mobilisation (accès site + accueil sécurité)
    mob = client.post(
        f"{API}/subcontracts/{contract['id']}/mobilizations",
        headers=cph,
        json={
            "mobilization_date": date.today().isoformat(),
            "team_size": 8,
            "supervisor_name": "Paul Etoa",
            "site_access_granted": True,
            "safety_induction_done": True,
        },
    )
    assert mob.json()["status"] == "mobilized"
    items = {i["designation"]: i for i in mob.json()["items"]}

    # 53. Situation soumise par le sous-traitant : photos probatoires obligatoires
    situation = client.post(
        f"{API}/extranet/subcontractor/subcontracts/{contract['id']}/situations",
        headers=sth,
        json={
            "period_start": date.today().isoformat(),
            "period_end": (date.today() + timedelta(days=14)).isoformat(),
            "lines": [
                {"item_id": items["Béton dalle C25/30"]["id"], "period_quantity": 20},
                {"item_id": items["Coffrage dalle"]["id"], "period_quantity": 100},
            ],
        },
    )
    assert situation.status_code == 201, situation.text
    situation = situation.json()
    assert Decimal(situation["gross_amount"]) == Decimal("2200000.00")
    no_photo = client.post(f"{API}/extranet/subcontractor/situations/{situation['id']}/submit", headers=sth)
    assert no_photo.json()["error"]["code"] == "PROOF_REQUIRED"
    photo = client.post(
        f"{API}/extranet/subcontractor/situations/{situation['id']}/photos",
        headers=sth,
        files={"file": ("dalle.png", _png(), "image/png")},
    ).json()
    own_photo = client.get(
        f"{API}/extranet/subcontractor/situations/{situation['id']}/photos/{photo['file_id']}", headers=sth
    )
    assert own_photo.status_code == 200 and own_photo.headers["content-type"].startswith("image/")
    assert (
        client.post(f"{API}/extranet/subcontractor/situations/{situation['id']}/submit", headers=sth).json()["status"]
        == "submitted"
    )

    # 54. Contrôle terrain (quantité constatée < déclarée) → 55. validation conducteur / chef de projet
    beton_line = next(li for li in situation["lines"] if li["designation"] == "Béton dalle C25/30")
    checked = client.post(
        f"{API}/situations/{situation['id']}/field-check",
        headers=cch,
        json={"checked": {beton_line["id"]: 18}, "notes": "2 m3 non coulés au constat"},
    )
    assert checked.status_code == 200, checked.text
    checked = checked.json()
    gross = Decimal(checked["gross_amount"])
    assert gross == Decimal("2037391.30")
    assert Decimal(checked["advance_recovered"]) == Decimal("407478.26")
    assert Decimal(checked["retention_amount"]) == Decimal("101869.57")
    assert Decimal(checked["net_amount"]) == gross - Decimal("407478.26") - Decimal("101869.57")
    validated = client.post(f"{API}/situations/{situation['id']}/validate", headers=cph)
    assert validated.status_code == 200 and validated.json()["status"] == "validated"
    retention = db.execute(select(Retention).where(Retention.subcontract_id == uuid.UUID(contract["id"]))).scalar_one()
    assert retention.amount_retained == Decimal("101869.57")

    # 56. Facture du sous-traitant (montant = net validé) → 58. paiement (séparation des tâches)
    net = Decimal(checked["net_amount"])
    wrong = client.post(
        f"{API}/extranet/subcontractor/situations/{situation['id']}/invoice",
        headers=sth,
        data={"reference": "F-2026-031", "invoice_date": date.today().isoformat(), "amount": "1700000"},
        files={"file": ("facture.pdf", _pdf(), "application/pdf")},
    )
    assert wrong.status_code == 422 and wrong.json()["error"]["code"] == "INVOICE_AMOUNT_MISMATCH"
    invoice = client.post(
        f"{API}/extranet/subcontractor/situations/{situation['id']}/invoice",
        headers=sth,
        data={"reference": "F-2026-031", "invoice_date": date.today().isoformat(), "amount": str(net)},
        files={"file": ("facture.pdf", _pdf(), "application/pdf")},
    )
    assert invoice.status_code == 201, invoice.text
    invoice = invoice.json()
    assert (
        client.post(f"{API}/subcontractor-invoices/{invoice['id']}/validate", headers=fh).json()["status"]
        == "approved_for_payment"
    )
    payment = client.post(
        f"{API}/payments/outgoing",
        headers={**fh, **_idem()},
        json={"target_type": "subcontractor_invoice", "target_id": invoice["id"]},
    ).json()
    assert Decimal(payment["amount"]) == net
    assert client.post(f"{API}/payments/{payment['id']}/approve", headers=fh).status_code == 422
    client.post(f"{API}/payments/{payment['id']}/approve", headers=fh2)
    executed = client.post(
        f"{API}/payments/{payment['id']}/execute",
        headers=fh,
        data={"bank_reference": "VIR-ST-001"},
        files={"proof": ("ordre.pdf", _pdf(), "application/pdf")},
    )
    assert executed.json()["status"] == "succeeded"
    assert client.get(f"{API}/situations/{situation['id']}", headers=cph).json()["status"] == "paid"
    by_sub = client.get(f"{API}/situations", headers=cph, params={"subcontractor_id": sub["id"]}).json()
    assert situation["id"] in {s["id"] for s in by_sub["items"]}
    other = client.get(f"{API}/situations", headers=cph, params={"subcontractor_id": str(uuid.uuid4())}).json()
    assert other["total"] == 0

    # V4-SUB-15 : situation au-delà du marché → bloquée sans dérogation
    over = client.post(
        f"{API}/extranet/subcontractor/subcontracts/{contract['id']}/situations",
        headers=sth,
        json={
            "period_start": (date.today() + timedelta(days=15)).isoformat(),
            "period_end": (date.today() + timedelta(days=30)).isoformat(),
            "lines": [{"item_id": items["Béton dalle C25/30"]["id"], "period_quantity": 30}],
        },
    ).json()
    assert over["exceeds_contract"] is True
    client.post(
        f"{API}/extranet/subcontractor/situations/{over['id']}/photos",
        headers=sth,
        files={"file": ("dalle2.png", _png(), "image/png")},
    )
    client.post(f"{API}/extranet/subcontractor/situations/{over['id']}/submit", headers=sth)
    client.post(f"{API}/situations/{over['id']}/field-check", headers=cch, json={})
    blocked = client.post(f"{API}/situations/{over['id']}/validate", headers=cph)
    assert blocked.status_code == 422 and blocked.json()["error"]["code"] == "SITUATION_EXCEEDS_CONTRACT"
    assert db.execute(
        select(ActionItem).where(ActionItem.entity_id == over["id"], ActionItem.assignee_role == "DIRECTION")
    ).scalar_one()
    reason = {"reason": "Surépaisseur de dalle imposée par le BET structure (note n°12)"}
    assert client.post(f"{API}/situations/{over['id']}/derogation", headers=cph, json=reason).status_code == 403
    assert client.post(f"{API}/situations/{over['id']}/derogation", headers=dh, json=reason).json()[
        "derogation_granted"
    ]
    assert client.post(f"{API}/situations/{over['id']}/validate", headers=cph).json()["status"] == "validated"

    # V4-SUB-16 : litige sur la facture n°2 → gel, analyse, preuves, négociation, décision, résolution
    over = client.get(f"{API}/situations/{over['id']}", headers=cph).json()
    invoice2 = client.post(
        f"{API}/extranet/subcontractor/situations/{over['id']}/invoice",
        headers=sth,
        data={"reference": "F-2026-044", "invoice_date": date.today().isoformat(), "amount": over["net_amount"]},
        files={"file": ("facture2.pdf", _pdf(), "application/pdf")},
    ).json()
    client.post(f"{API}/subcontractor-invoices/{invoice2['id']}/validate", headers=fh)
    dispute = client.post(
        f"{API}/disputes",
        headers=fh,
        json={
            "party_type": "subcontractor",
            "party_id": sub["id"],
            "related_type": "subcontractor_invoice",
            "related_id": invoice2["id"],
            "title": "Quantités de béton contestées",
            "amount_disputed": 300000,
            "description": "Écart entre bons de livraison béton et quantités facturées",
        },
    )
    assert dispute.status_code == 201, dispute.text
    dispute = dispute.json()
    assert dispute["status"] == "OUVERT" and Decimal(dispute["amount_frozen"]) == Decimal("300000.00")
    frozen_invoice = db.get(SubcontractorInvoice, uuid.UUID(invoice2["id"]))
    db.refresh(frozen_invoice)
    assert frozen_invoice.amount_frozen == Decimal("300000.00")
    evidence = client.post(
        f"{API}/disputes/{dispute['id']}/files",
        headers=fh,
        files={"file": ("bons-livraison.pdf", _pdf(), "application/pdf")},
    ).json()
    client.post(f"{API}/disputes/{dispute['id']}/transition", headers=fh, json={"to_status": "EN_ANALYSE"})
    client.post(
        f"{API}/disputes/{dispute['id']}/events",
        headers=fh,
        json={"kind": "evidence", "content": "Bons de livraison centrale", "file_ids": [evidence["file_id"]]},
    )
    client.post(f"{API}/disputes/{dispute['id']}/transition", headers=fh, json={"to_status": "EN_NEGOCIATION"})
    client.post(
        f"{API}/disputes/{dispute['id']}/events",
        headers=fh,
        json={"kind": "proposal", "amount": 200000, "content": "Nous retenons 200 000"},
    )
    self_accept = client.post(f"{API}/disputes/{dispute['id']}/events", headers=fh, json={"kind": "agreement"})
    assert self_accept.status_code == 422
    client.post(
        f"{API}/extranet/subcontractor/disputes/{dispute['id']}/events",
        headers=sth,
        json={"kind": "counter_proposal", "amount": 250000, "content": "Pertes au coulage justifiées"},
    )
    client.post(f"{API}/disputes/{dispute['id']}/events", headers=fh, json={"kind": "agreement"})
    assert (
        client.post(
            f"{API}/disputes/{dispute['id']}/decision",
            headers=fh,
            json={"amount_accepted": 250000, "amount_refused": 50000, "summary": "Tentative sans habilitation"},
        ).status_code
        == 403
    )
    decided = client.post(
        f"{API}/disputes/{dispute['id']}/decision",
        headers=dh,
        json={
            "amount_accepted": 250000,
            "amount_refused": 50000,
            "summary": "Accord sur 250 000 FCFA ; 50 000 FCFA non justifiés par les bons de livraison",
        },
    )
    assert decided.status_code == 200 and decided.json()["status"] == "DECISION"
    resolved = client.post(f"{API}/disputes/{dispute['id']}/resolve", headers=dh, json={"comment": "Clôture amiable"})
    assert resolved.json()["status"] == "RESOLU"
    db.refresh(frozen_invoice)
    assert frozen_invoice.amount_frozen == 0 and frozen_invoice.amount_credited == Decimal("50000.00")
    chronology = client.get(f"{API}/extranet/subcontractor/disputes/{dispute['id']}", headers=sth).json()
    proof = client.get(
        f"{API}/extranet/subcontractor/disputes/{dispute['id']}/files/{evidence['file_id']}", headers=sth
    )
    assert proof.status_code == 200 and proof.content.startswith(b"%PDF")
    stranger = client.get(
        f"{API}/extranet/subcontractor/disputes/{dispute['id']}/files/{photo['file_id']}", headers=sth
    )
    assert stranger.status_code == 404
    assert "owner_id" not in chronology
    assert [(e["kind"], e["to_status"]) for e in chronology["events"]] == [
        ("status", "OUVERT"),
        ("status", "EN_ANALYSE"),
        ("evidence", None),
        ("status", "EN_NEGOCIATION"),
        ("proposal", None),
        ("counter_proposal", None),
        ("agreement", None),
        ("decision", "DECISION"),
        ("status", "RESOLU"),
    ]
    assert Decimal(chronology["events"][6]["amount"]) == Decimal("250000.00")

    # Cloisonnement : un autre compte sous-traitant ne voit rien
    other_org = Organization(name="Autre ST", kind="subcontractor")
    db.add(other_org)
    db.commit()
    _, other = as_role(client, db, "SOUS_TRAITANT", org_id=other_org.id)
    assert client.get(f"{API}/extranet/subcontractor/subcontracts/{contract['id']}", headers=other).status_code == 403
