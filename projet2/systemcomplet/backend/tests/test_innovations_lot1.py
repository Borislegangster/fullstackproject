"""Innovations lot 1 : indice de confiance (R3), preuves opposables (R4), avis vérifiés (R6), contrôle interne (A5),
recouvrement — liens de paiement et échéanciers (A6), rapport de direction (A7), panneau de chantier connecté (I4),
programme ambassadeurs (I6)."""

from __future__ import annotations

import hashlib
import io
import time
import uuid
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from PIL import Image
from sqlalchemy import select

from tests.conftest import as_role, drain_outbox, login, make_user
from tests.test_billing import _invoice, _project_and_client
from tests.test_client_portal import _setup

API = "/api/v1"


def _png(color: tuple[int, int, int]) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (16, 16), color).save(buf, format="PNG")
    return buf.getvalue()


def _events(db: Any, event_type: str) -> list[Any]:
    from app.modules.system.models import OutboxEvent

    db.expire_all()
    return list(
        db.execute(
            select(OutboxEvent).where(OutboxEvent.event_type == event_type).order_by(OutboxEvent.created_at)
        ).scalars()
    )


# ============================================================================ R3 — indice de confiance
def test_trust_index_components_client_view_history_and_alert(client: Any, db: Any) -> None:
    from app.modules.projects.models import Project, TrustSnapshot
    from app.modules.projects.trust import snapshot_project

    env = _setup(client, db)
    pid = env["project"]["id"]
    late = client.post(
        f"{API}/milestones",
        headers=env["cph"],
        json={
            "project_id": pid,
            "name": "Dalle haute RDC",
            "due_date": (date.today() - timedelta(days=5)).isoformat(),
            "client_visible": True,
        },
    )
    assert late.status_code == 201, late.text

    internal = client.get(f"{API}/projects/{pid}/trust", headers=env["cph"])
    assert internal.status_code == 200, internal.text
    internal = internal.json()
    components = {c["key"]: c for c in internal["components"]}
    # délais 0 (jalon manqué), qualité 60 (aucun contrôle), transparence 0 (rien publié) ; budget / réactivité absents
    assert components["delais"]["score"] == 0 and components["delais"]["details"]["milestones_due"] == 1
    assert components["budget"]["score"] is None and components["reactivite"]["score"] is None
    assert internal["score"] == 20.0 and internal["level"] == "critique"
    assert sum(c["weight"] for c in internal["components"]) == 100

    mine = client.get(f"{API}/client/projects/{pid}/trust", headers=env["custh"])
    assert mine.status_code == 200, mine.text
    assert all("details" not in c for c in mine.json()["components"]), "aucune mesure interne côté client"
    assert any("jalon" in fact for c in mine.json()["components"] for fact in c["facts"])
    assert client.get(f"{API}/client/projects/{pid}/trust", headers=env["strh"]).status_code in (403, 404)

    # Historique : chute de 80 à 20 en une semaine → alerte Direction / chef de projet, tendance affichée
    project = db.get(Project, uuid.UUID(pid))
    db.add(
        TrustSnapshot(
            project_id=project.id,
            as_of=date.today() - timedelta(days=8),
            score=Decimal("80"),
            level="bon",
            components=[],
        )
    )
    db.commit()
    snapshot_project(db, project)
    db.commit()
    alerts = _events(db, "project.trust_alert")
    assert len(alerts) == 1 and alerts[0].payload["project_name"] == project.name
    assert Decimal(str(alerts[0].payload["previous"])) == Decimal("80")
    again = client.get(f"{API}/projects/{pid}/trust", headers=env["cph"]).json()
    assert again["trend_7d"] == -60.0 and len(again["history"]) == 2
    snapshot_project(db, project)  # même jour : pas de nouvelle alerte
    db.commit()
    assert len(_events(db, "project.trust_alert")) == 1


# ============================================================================ R4 — preuves opposables
def test_merkle_root_vectors() -> None:
    from app.modules.proofs.service import canonical_sha256, merkle_root

    a, b, c = (hashlib.sha256(x).hexdigest() for x in (b"a", b"b", b"c"))
    assert merkle_root([a]) == a
    ab = hashlib.sha256(bytes.fromhex(a) + bytes.fromhex(b)).digest()
    assert merkle_root([a, b]) == ab.hex()
    cc = hashlib.sha256(bytes.fromhex(c) + bytes.fromhex(c)).digest()
    assert merkle_root([a, b, c]) == hashlib.sha256(ab + cc).hexdigest()
    assert canonical_sha256({"b": 1, "a": "é"}) == hashlib.sha256('{"a":"é","b":1}'.encode()).hexdigest()


def test_photo_day_proof_verification_revocation_and_client_list(client: Any, db: Any) -> None:
    from app.modules.proofs.models import Proof
    from app.modules.proofs.service import certify_photo_day, merkle_root

    env = _setup(client, db)
    pid = env["project"]["id"]
    contents = [_png((10, 20, 30)), _png((200, 10, 10))]
    for i, data in enumerate(contents):
        up = client.post(
            f"{API}/projects/{pid}/media",
            headers=env["ah"],
            files={"file": (f"photo-{i}.png", data, "image/png")},
            data={"publish": "true", "caption": f"Vue {i}"},
        )
        assert up.status_code == 201, up.text
    proof = certify_photo_day(db, uuid.UUID(pid), date.today())
    db.commit()
    expected = merkle_root([hashlib.sha256(d).hexdigest() for d in contents])
    assert proof.sha256 == expected and proof.algorithm == "merkle-sha256" and len(proof.leaves) == 2
    assert proof.client_visible is True

    # Le lot du jour grossit : même preuve, nouvelle racine (chaque photo reste vérifiable individuellement)
    third = _png((0, 160, 90))
    client.post(
        f"{API}/projects/{pid}/media",
        headers=env["ah"],
        files={"file": ("photo-2.png", third, "image/png")},
        data={"publish": "true"},
    )
    certified = client.post(
        f"{API}/proofs/certify",
        headers=env["ah"],
        json={"subject_type": "photo_day", "subject_id": f"{pid}:{date.today().isoformat()}"},
    )
    assert certified.status_code == 201, certified.text
    certified = certified.json()
    assert certified["id"] == str(proof.id) and len(certified["leaves"]) == 3
    assert certified["sha256"] == merkle_root([hashlib.sha256(d).hexdigest() for d in [*contents, third]])
    nothing = client.post(
        f"{API}/proofs/certify",
        headers=env["ah"],
        json={"subject_type": "photo_day", "subject_id": f"{pid}:2001-01-01"},
    )
    assert nothing.status_code == 422 and nothing.json()["error"]["code"] == "NOTHING_TO_CERTIFY"

    code = certified["public_code"]
    public = client.get(f"{API}/public/verify/{code}").json()
    assert public["type"] == "proof" and public["valid"] is True and public["sha256"] == certified["sha256"]
    assert {leaf["sha256"] for leaf in public["leaves"]} == {hashlib.sha256(third).hexdigest()} | {
        hashlib.sha256(d).hexdigest() for d in contents
    }
    pdf = client.get(f"{API}/public/proofs/{code}/certificate.pdf")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert client.get(f"{API}/public/proofs/{code}/ots").status_code == 404  # ancrage non activé

    mine = client.get(f"{API}/client/projects/{pid}/proofs", headers=env["custh"])
    assert mine.status_code == 200 and [p["number"] for p in mine.json()] == [certified["number"]]
    assert "anchor_error" not in mine.json()[0]

    short = client.post(f"{API}/proofs/{proof.id}/revoke", headers=env["ah"], json={"reason": "erreur"})
    assert short.status_code == 422
    revoked = client.post(
        f"{API}/proofs/{proof.id}/revoke", headers=env["ah"], json={"reason": "Photo d'un autre chantier publiée"}
    )
    assert revoked.status_code == 200, revoked.text
    after = client.get(f"{API}/public/verify/{code}").json()
    assert after["valid"] is False and after["revoked"] is True
    assert db.execute(select(Proof).where(Proof.public_code == code)).scalar_one().revoked_reason


def test_validated_decision_is_certified_and_anchored(client: Any, db: Any, monkeypatch: Any) -> None:
    from app.core.config import settings
    from app.core.events import emit
    from app.core.utils import utcnow
    from app.modules.projects.models import Decision
    from app.modules.proofs import service as proofs
    from app.modules.proofs.models import Proof
    from app.providers import anchoring

    monkeypatch.setattr(settings, "ANCHORING_ENABLED", True)
    calendar_reply = b"\xf0\x10" + b"\x01" * 16 + b"\x08\x00\x83\xdf\xe3\x0d\x2e\xf9\x0c\x8e"
    posted: list[bytes] = []

    class _Reply:
        status_code = 200
        content = calendar_reply

    def fake_post(url: str, *, content: bytes, **_: Any) -> _Reply:
        posted.append(content)
        return _Reply()

    monkeypatch.setattr(anchoring.httpx, "post", fake_post)

    env = _setup(client, db)
    decision = Decision(
        number=f"DEC-T-{uuid.uuid4().hex[:6]}",
        project_id=uuid.UUID(env["project"]["id"]),
        title="Carrelage séjour",
        selected_option="Grès cérame 60x60",
        price_impact=Decimal("350000"),
        status="validated",
        validated_at=utcnow(),
        validated_by_id=env["customer"].id,
        validation_method="otp",
        content_hash="a" * 64,
    )
    db.add(decision)
    db.flush()
    emit(db, "decision.validated", {"id": decision.id}, aggregate_type="decision", aggregate_id=decision.id)
    db.commit()
    drain_outbox()
    proof = db.execute(
        select(Proof).where(Proof.subject_type == "decision", Proof.subject_id == str(decision.id))
    ).scalar_one()
    assert proof.client_visible and proof.anchor_status == "queued"
    assert proofs.anchor_pending(db)["items"] >= 1
    db.commit()
    db.refresh(proof)
    assert proof.anchor_status == "pending" and bytes.fromhex(proof.sha256) in posted
    ots = client.get(f"{API}/public/proofs/{proof.public_code}/ots")
    assert ots.status_code == 200
    assert ots.content.startswith(proofs.OTS_MAGIC + b"\x01\x08" + bytes.fromhex(proof.sha256))
    assert ots.content.endswith(calendar_reply)
    # même sujet, même empreinte : idempotent
    assert proofs.certify_decision(db, decision.id).id == proof.id


# ============================================================================ R6 — avis clients vérifiés
def test_verified_reviews_from_handover_to_public_summary(client: Any, db: Any) -> None:
    from app.modules.cms.models import Testimonial
    from app.modules.reviews.models import ReviewInvitation

    env = _setup(client, db)
    pid = env["project"]["id"]
    early = client.post(
        f"{API}/client/projects/{pid}/review",
        headers=env["custh"],
        data={"rating": "5", "comment": "Très bonne expérience jusqu'ici, bravo."},
    )
    assert early.status_code == 422 and early.json()["error"]["code"] == "REVIEW_NOT_YET"

    # Remise des clés → invitation automatique (événement project.status_changed)
    moved = client.patch(f"{API}/projects/{pid}", headers=env["ah"], json={"status": "reception"})
    assert moved.status_code == 200, moved.text
    drain_outbox()
    listed = client.get(f"{API}/review-invitations?project_id={pid}", headers=env["ah"])
    assert listed.status_code == 200 and len(listed.json()) == 1
    assert "token" not in listed.text and "/avis/" not in listed.text, "le lien n'est jamais montré à l'équipe"

    # Le lien nominatif part directement au client (e-mail + WhatsApp), jamais dans un événement métier
    sends = [e for e in _events(db, "notification.dispatch") if e.payload.get("email_template") == "review.invited"]
    assert len(sends) == 2
    link = sends[0].payload["context"]["link"]
    assert "/avis/" in link
    assert all("/avis/" not in str(e.payload) for e in _events(db, "review.invited"))
    token = link.rsplit("/", 1)[-1]

    info = client.get(f"{API}/public/reviews/{token}")
    assert info.status_code == 200 and info.json()["first_name"] == env["customer"].first_name
    too_short = client.post(f"{API}/public/reviews/{token}", data={"rating": "5", "comment": "Bien."})
    assert too_short.status_code == 422
    submitted = client.post(
        f"{API}/public/reviews/{token}",
        data={
            "rating": "5",
            "comment": "Chantier tenu, équipe à l'écoute et délais respectés.",
            "display": "initials",
            "consent_publish": "true",
            "location": "Douala",
        },
        files={"photo": ("maison.png", _png((90, 140, 200)), "image/png")},
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["published_after_review"] is True
    twice = client.post(
        f"{API}/public/reviews/{token}",
        data={"rating": "1", "comment": "Je change d'avis après coup, finalement."},
    )
    assert twice.status_code in (404, 409)

    invitation = db.execute(select(ReviewInvitation).where(ReviewInvitation.project_id == uuid.UUID(pid))).scalar_one()
    testimonial = db.get(Testimonial, invitation.testimonial_id)
    assert testimonial.verified is True and testimonial.status == "in_review" and testimonial.rating == 5
    assert str(testimonial.project_id) == pid
    assert client.get(f"{API}/public/reviews/summary").json()["count"] == 0, "rien de publié avant modération"
    testimonial.status = "published"
    db.commit()
    summary = client.get(f"{API}/public/reviews/summary").json()
    assert summary == {"count": 1, "average": 5.0, "distribution": {"5": 1}}
    assert _events(db, "review.submitted")[-1].payload["consent_publish"] is True


# ============================================================================ A5 — contrôle interne
def test_split_orders_near_duplicate_and_backdated_invoices(client: Any, db: Any) -> None:
    from app.modules.ai.controls import invoices_before_order, near_duplicate_invoices, split_orders
    from app.modules.ai.models import Anomaly
    from app.modules.billing.models import SupplierInvoice
    from app.modules.procurement.models import PurchaseOrder
    from app.modules.suppliers.models import Supplier

    project, _ah, _org = _project_and_client(client, db)
    supplier = Supplier(code=f"F-{uuid.uuid4().hex[:6]}", legal_name="Ciments du Littoral")
    db.add(supplier)
    db.flush()
    orders = []
    for i in range(2):  # deux BC de 300 000 sous le seuil de 500 000 : cumul au-dessus
        po = PurchaseOrder(
            number=f"BC-T-{uuid.uuid4().hex[:6]}",
            project_id=uuid.UUID(project["id"]),
            supplier_id=supplier.id,
            status="sent",
            subtotal=Decimal("300000"),
            total=Decimal("300000"),
        )
        db.add(po)
        orders.append(po)
    db.flush()
    for ref in ("FA-0042", "fa 42"):
        db.add(
            SupplierInvoice(
                number=f"FF-T-{uuid.uuid4().hex[:6]}",
                supplier_reference=ref,
                supplier_id=supplier.id,
                purchase_order_id=orders[0].id,
                invoice_date=date.today() - timedelta(days=10),
                subtotal=Decimal("300000"),
                total=Decimal("300000"),
                status="received",
            )
        )
    db.commit()

    assert split_orders(db) == 1
    assert near_duplicate_invoices(db) == 1
    assert invoices_before_order(db) == 2
    db.commit()
    assert (split_orders(db), near_duplicate_invoices(db), invoices_before_order(db)) == (0, 0, 0), "idempotent"
    kinds = {a.kind: a for a in db.execute(select(Anomaly)).scalars()}
    assert {"split_orders", "invoice_near_duplicate", "invoice_before_order"} <= set(kinds)
    assert kinds["split_orders"].severity == "high" and "600 000" in kinds["split_orders"].description


def test_bank_details_change_blocks_payment_until_direction_override(client: Any, db: Any) -> None:
    from app.modules.ai.models import Anomaly
    from app.modules.billing.models import SupplierInvoice
    from app.modules.system.models import AuditEvent

    admin = make_user(db, roles=["ADMIN"])
    ah = login(client, admin.email)
    created = client.post(
        f"{API}/suppliers", headers=ah, json={"legal_name": "Fer & Acier SARL", "mobile_money_number": "670112233"}
    )
    assert created.status_code == 201, created.text
    supplier_id = created.json()["id"]

    def invoice(total: str) -> SupplierInvoice:
        row = SupplierInvoice(
            number=f"FF-T-{uuid.uuid4().hex[:6]}",
            supplier_reference=f"FA-{uuid.uuid4().hex[:6]}",
            supplier_id=uuid.UUID(supplier_id),
            invoice_date=date.today(),
            subtotal=Decimal(total),
            total=Decimal(total),
            status="approved_for_payment",
        )
        db.add(row)
        db.commit()
        return row

    _initiator, ih = as_role(client, db, "FINANCE")

    def outgoing(target: SupplierInvoice) -> dict[str, Any]:
        resp = client.post(
            f"{API}/payments/outgoing",
            headers={**ih, "Idempotency-Key": uuid.uuid4().hex},
            json={"target_type": "supplier_invoice", "target_id": str(target.id), "method": "mobile_money"},
        )
        assert resp.status_code == 201, resp.text
        return resp.json()

    # Première saisie des coordonnées : pas un changement → paiement approuvable
    first = outgoing(invoice("400000"))
    _approver, aph = as_role(client, db, "FINANCE")
    assert client.post(f"{API}/payments/{first['id']}/approve", headers=aph).status_code == 200

    # Modification du numéro Mobile Money → les paiements suivants sont bloqués
    changed = client.patch(f"{API}/suppliers/{supplier_id}", headers=ah, json={"mobile_money_number": "699887766"})
    assert changed.status_code == 200, changed.text
    small = outgoing(invoice("500000"))
    blocked = client.post(
        f"{API}/payments/{small['id']}/approve",
        headers=aph,
        json={"override_reason": "Le fournisseur m'a appelé, c'est bon."},
    )
    assert blocked.status_code == 422 and blocked.json()["error"]["code"] == "CONTROL_BLOCK", blocked.text
    assert blocked.json()["error"]["details"]["anomalies"][0]["kind"] == "bank_details_changed"

    big = outgoing(invoice("3000000"))  # > 2 000 000 : approbation Direction
    _director, dh = as_role(client, db, "DIRECTION")
    refused = client.post(f"{API}/payments/{big['id']}/approve", headers=dh, json={"override_reason": "OK"})
    assert refused.status_code == 422 and refused.json()["error"]["code"] == "CONTROL_BLOCK"
    reason = "Numéro confirmé par contre-appel au gérant sur le numéro du contrat"
    approved = client.post(f"{API}/payments/{big['id']}/approve", headers=dh, json={"override_reason": reason})
    assert approved.status_code == 200, approved.text
    db.expire_all()
    anomaly = db.execute(
        select(Anomaly).where(Anomaly.kind == "bank_details_changed", Anomaly.entity_id == big["id"])
    ).scalar_one()
    assert anomaly.status == "dismissed" and reason in anomaly.review_note
    override = db.execute(select(AuditEvent).where(AuditEvent.action == "CONTROL_OVERRIDE")).scalar_one()
    assert override.reason == reason and override.resource_id == big["id"]


# ============================================================================ A6 — recouvrement
def test_pay_link_public_page_and_mobile_money_checkout(client: Any, db: Any, operators: Any) -> None:
    from app.modules.billing.models import ClientInvoice

    project, _ah, org = _project_and_client(client, db)
    _finance, fh = as_role(client, db, "FINANCE")
    invoice = _invoice(client, fh, project, org)
    client.post(f"{API}/client-invoices/{invoice['id']}/validate", headers=fh)
    client.post(f"{API}/client-invoices/{invoice['id']}/send", headers=fh)
    created = client.post(
        f"{API}/pay-links", headers=fh, json={"target_type": "client_invoice", "target_id": invoice["id"]}
    )
    assert created.status_code == 201, created.text
    token = created.json()["url"].rsplit("/", 1)[-1]
    view = client.get(f"{API}/public/pay/{token}")
    assert view.status_code == 200, view.text
    view = view.json()
    assert view["number"] == invoice["number"] and Decimal(view["amount_due"]) == Decimal(invoice["total"])
    assert view["paid"] is False and any(m["provider"] == "mtn_momo" for m in view["methods"])
    assert client.get(f"{API}/public/pay/{uuid.uuid4().hex}").status_code == 404

    body = {"provider": "mtn_momo", "method": "mobile_money", "payer_name": "Jean Kamga", "payer_phone": "670000001"}
    assert client.post(f"{API}/public/pay/{token}/checkout", json=body).status_code in (400, 422, 428)
    started = client.post(
        f"{API}/public/pay/{token}/checkout", headers={"Idempotency-Key": uuid.uuid4().hex}, json=body
    )
    assert started.status_code == 201, started.text
    tx = started.json()["transaction_id"]
    assert operators.momo.requests[tx]["payer"]["partyId"] == "237670000001"
    operators.momo.complete(tx, "SUCCESSFUL")
    status = client.get(f"{API}/public/pay/{token}/transactions/{tx}")
    assert status.status_code == 200 and status.json()["status"] == "succeeded", status.text
    db.expire_all()
    assert db.get(ClientInvoice, uuid.UUID(invoice["id"])).status == "paid"
    assert client.get(f"{API}/public/pay/{token}").json()["paid"] is True
    again = client.post(f"{API}/public/pay/{token}/checkout", headers={"Idempotency-Key": uuid.uuid4().hex}, json=body)
    assert again.status_code == 409 and again.json()["error"]["code"] == "NOTHING_DUE"


def test_payment_plan_request_finance_proposal_otp_acceptance_and_reminders(client: Any, db: Any) -> None:
    from app.modules.billing.collections import refresh_plan, send_plan_reminders
    from app.modules.billing.lifecycle import send_payment_reminders
    from app.modules.billing.models import ClientInvoice, PaymentPlan, PaymentReminder

    project, _ah, org = _project_and_client(client, db)
    _finance, fh = as_role(client, db, "FINANCE")
    _customer, custh = as_role(client, db, "CLIENT", org_id=org.id)
    invoice = _invoice(client, fh, project, org)  # 1 192 500 FCFA TTC
    client.post(f"{API}/client-invoices/{invoice['id']}/validate", headers=fh)
    client.post(f"{API}/client-invoices/{invoice['id']}/send", headers=fh)
    target = {"target_type": "client_invoice", "target_id": invoice["id"]}

    beyond = client.post(f"{API}/client/payment-plans", headers=custh, json={**target, "count": 6})
    assert beyond.status_code == 422 and beyond.json()["error"]["code"] == "PLAN_POLICY"
    requested = client.post(
        f"{API}/client/payment-plans", headers=custh, json={**target, "count": 3, "reason": "Décalage de trésorerie"}
    )
    assert requested.status_code == 201, requested.text
    plan = requested.json()
    assert plan["status"] == "requested" and len(plan["installments"]) == 3
    assert sum(Decimal(i["amount"]) for i in plan["installments"]) == Decimal(invoice["total"])
    duplicate = client.post(f"{API}/client/payment-plans", headers=custh, json={**target, "count": 2})
    assert duplicate.status_code == 409 and duplicate.json()["error"]["code"] == "PLAN_EXISTS"
    assert _events(db, "payment_plan.requested")[-1].payload["count"] == 3

    first_due = date.today() + timedelta(days=10)
    dates = [first_due, first_due + timedelta(days=30), first_due + timedelta(days=60)]
    wrong = client.post(
        f"{API}/payment-plans/{plan['id']}/propose",
        headers=fh,
        json={"installments": [{"due_date": d.isoformat(), "amount": "100000"} for d in dates]},
    )
    assert wrong.status_code == 422 and wrong.json()["error"]["code"] == "PLAN_TOTAL"
    proposed = client.post(
        f"{API}/payment-plans/{plan['id']}/propose",
        headers=fh,
        json={
            "installments": [
                {"due_date": dates[0].isoformat(), "amount": "400000"},
                {"due_date": dates[1].isoformat(), "amount": "400000"},
                {"due_date": dates[2].isoformat(), "amount": "392500"},
            ],
            "note": "Échéances alignées sur vos encaissements",
        },
    )
    assert proposed.status_code == 200 and proposed.json()["status"] == "proposed", proposed.text

    otp = client.post(f"{API}/client/payment-plans/{plan['id']}/otp", headers=custh)
    assert otp.status_code == 200, otp.text
    bad = client.post(
        f"{API}/client/payment-plans/{plan['id']}/accept",
        headers=custh,
        json={"otp_token": otp.json()["otp_token"], "code": "000000"},
    )
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "OTP_INVALID"
    accepted = client.post(
        f"{API}/client/payment-plans/{plan['id']}/accept",
        headers=custh,
        json={"otp_token": otp.json()["otp_token"], "code": otp.json()["test_code"]},
    )
    assert accepted.status_code == 200 and accepted.json()["status"] == "active", accepted.text
    row = db.get(PaymentPlan, uuid.UUID(plan["id"]))
    db.refresh(row)
    assert row.acceptance_proof["otp"]["channel"] and row.accepted_at is not None

    # Les relances de facture s'effacent devant l'échéancier actif ; rappel par échéance avec lien de paiement
    inv = db.get(ClientInvoice, uuid.UUID(invoice["id"]))
    send_payment_reminders(db, today=inv.due_date + timedelta(days=16))
    db.flush()
    assert not db.execute(select(PaymentReminder).where(PaymentReminder.target_id == inv.id)).scalars().all()
    assert send_plan_reminders(db, today=first_due - timedelta(days=3))["items"] == 1
    assert send_plan_reminders(db, today=first_due - timedelta(days=2))["items"] == 0, "un rappel par palier"
    db.commit()
    reminder = _events(db, "billing.installment_reminder")[-1].payload
    assert reminder["index"] == 1 and Decimal(str(reminder["amount"])) == Decimal("400000")
    pay_token = reminder["pay_link"].rsplit("/", 1)[-1]
    view = client.get(f"{API}/public/pay/{pay_token}").json()
    assert Decimal(view["amount_due"]) == Decimal("400000") and view["installment"]["index"] == 1

    # Échéance impayée au-delà de la tolérance : défaut signalé à la finance
    refresh_plan(db, row, today=first_due + timedelta(days=16))
    db.commit()
    assert row.status == "defaulted" and _events(db, "payment_plan.defaulted")

    stranger_org_user, sh = as_role(client, db, "CLIENT")
    assert stranger_org_user is not None
    assert client.get(f"{API}/client/payment-plans", headers=sh).json() == []


# ============================================================================ A7 — rapport de direction
def test_executive_report_rules_narrative_pdf_and_weekly_dispatch(client: Any, db: Any) -> None:
    from app.core.utils import utcnow
    from app.modules.crm.service import create_lead
    from app.modules.reports.executive import last_week, weekly_job
    from app.modules.reports.models import ExecutiveReport

    start, end = last_week()
    lead = create_lead(
        db,
        data={"first_name": "Aline", "email": "aline@example.com", "message": "Projet de duplex"},
        source="website_form",
        form_key=None,
        consents={"contact": True},
        ip=None,
        user_agent=None,
    )
    lead.created_at = utcnow().replace(year=start.year, month=start.month, day=start.day, hour=10)
    db.commit()

    _director, dh = as_role(client, db, "DIRECTION")
    _sales, sh = as_role(client, db, "COMMERCIAL")
    assert client.post(f"{API}/reports/executive/generate", headers=sh).status_code == 403
    future = client.post(
        f"{API}/reports/executive/generate?period_end={(date.today() + timedelta(days=8)).isoformat()}", headers=dh
    )
    assert future.status_code == 422
    generated = client.post(f"{API}/reports/executive/generate", headers=dh)
    assert generated.status_code == 201, generated.text
    report = generated.json()
    assert report["period_start"] == start.isoformat() and report["period_end"] == end.isoformat()
    assert report["ai_generated"] is False and report["has_pdf"] is True
    assert report["data"]["commercial"]["leads"] >= 1
    narrative = report["narrative"]
    assert narrative["headline"] and narrative["highlights"] and narrative["decisions"] and narrative["outlook"]
    assert any("leads" in h for h in narrative["highlights"])

    listing = client.get(f"{API}/reports/executive", headers=dh).json()
    assert [r["id"] for r in listing] == [report["id"]]
    pdf = client.get(f"{API}/reports/executive/{report['id']}/pdf", headers=dh)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert client.get(f"{API}/reports/executive/{report['id']}", headers=sh).status_code == 403

    # Job du lundi : même semaine → même rapport, diffusé une seule fois
    assert weekly_job(db)["report"] == report["number"]
    db.commit()
    weekly_job(db)
    db.commit()
    assert len(_events(db, "executive_report.ready")) == 1
    assert db.execute(select(ExecutiveReport)).scalars().one().sent_at is not None


# ============================================================================ I4 — panneau de chantier connecté
def _jpeg_with_metadata() -> bytes:
    img = Image.new("RGB", (64, 48), (200, 120, 40))
    exif = Image.Exif()
    exif[0x010F] = "ACME"
    exif[0x0110] = "GlobusCam 3000"
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif.tobytes())
    return buf.getvalue()


def test_site_panel_publication_public_page_photos_messages_and_print(client: Any, db: Any) -> None:
    from app.modules.crm.models import Lead
    from app.modules.panels.models import SitePanelMessage

    env = _setup(client, db)
    pid = env["project"]["id"]
    first = client.get(f"{API}/projects/{pid}/panel", headers=env["cph"])
    assert first.status_code == 200 and first.json()["configured"] is False
    slug = first.json()["suggestion"]["slug"]
    saved = client.put(
        f"{API}/projects/{pid}/panel",
        headers=env["cph"],
        json={
            "title": "Villa Mbappe — Bonapriso",
            "location_label": "Bonapriso, Douala",
            "owner_label": "Famille M.",
            "permit_number": "PC-0457/2026",
            "permit_date": "2026-03-02",
            "permit_authority": "Commune de Douala 1er",
            "works_description": "Construction d'une villa R+1 avec piscine",
            "contact_phone": "6 99 00 11 22",
            "hiring_open": True,
            "hiring_text": "maçons et ferrailleurs du quartier",
        },
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["enabled"] is False and saved.json()["slug"] == slug
    assert client.get(f"{API}/public/chantiers/{slug}").status_code == 404, "non publié"

    up = client.post(
        f"{API}/projects/{pid}/media",
        headers=env["ah"],
        files={"file": ("dalle.jpg", _jpeg_with_metadata(), "image/jpeg")},
        data={"caption": "Coulage de la dalle"},
    )
    assert up.status_code == 201, up.text
    photos = client.put(
        f"{API}/projects/{pid}/panel/photos", headers=env["cph"], json={"site_media_ids": [up.json()["id"]]}
    )
    assert photos.status_code == 200, photos.text
    public_media = photos.json()["photos"][0]["media_id"]
    original = client.get(f"{API}/public/media/{public_media}/original")
    assert original.status_code == 200
    assert b"GlobusCam" not in original.content and not Image.open(io.BytesIO(original.content)).getexif()

    published = client.put(f"{API}/projects/{pid}/panel", headers=env["cph"], json={"enabled": True})
    assert published.status_code == 200 and published.json()["enabled"] is True
    page = client.get(f"{API}/public/chantiers/{slug}?src=qr")
    assert page.status_code == 200, page.text
    page = page.json()
    assert page["permit"]["number"] == "PC-0457/2026" and page["hiring"]["open"] is True
    assert page["photos"][0]["caption"] == "Coulage de la dalle" and "progress" in page
    assert "address" not in page and "contract_amount" not in page
    assert any(c["slug"] == slug for c in client.get(f"{API}/public/chantiers").json())
    stats = client.get(f"{API}/projects/{pid}/panel", headers=env["cph"]).json()["panel"]
    assert stats["scans"] == 1 and stats["views"] == 1

    rendered = int(time.time()) - 60
    base = {"name": "Jean Voisin", "phone": "677112233", "consent": True, "rendered_at": rendered}
    devis = client.post(
        f"{API}/public/chantiers/{slug}/messages",
        json={**base, "kind": "devis", "message": "Je voudrais le même type de villa sur mon terrain."},
    )
    assert devis.status_code == 201, devis.text
    riverain = client.post(
        f"{API}/public/chantiers/{slug}/messages",
        json={**base, "kind": "riverain", "message": "Poussière importante le matin devant le portail."},
    )
    assert riverain.status_code == 201
    no_consent = client.post(
        f"{API}/public/chantiers/{slug}/messages",
        json={**base, "consent": False, "kind": "info", "message": "Quand finissez-vous les travaux ?"},
    )
    assert no_consent.status_code == 422
    bot = client.post(
        f"{API}/public/chantiers/{slug}/messages",
        json={**base, "kind": "info", "message": "Message automatique de robot.", "website": "http://spam"},
    )
    assert bot.status_code == 201
    messages = client.get(f"{API}/projects/{pid}/panel/messages", headers=env["cph"]).json()
    assert sorted(m["kind"] for m in messages) == ["devis", "riverain"]
    lead = db.get(Lead, uuid.UUID(next(m for m in messages if m["kind"] == "devis")["lead_id"]))
    assert lead.source == "panneau_chantier"
    kinds = [e.payload["kind"] for e in _events(db, "site_panel.message")]
    assert sorted(kinds) == ["devis", "riverain"]
    handled = client.post(
        f"{API}/projects/{pid}/panel/messages/{messages[0]['id']}/handle",
        headers=env["cph"],
        json={"note": "Rappelé, arrosage du chantier prévu"},
    )
    assert handled.status_code == 200 and handled.json()["status"] == "handled"
    assert db.get(SitePanelMessage, uuid.UUID(messages[0]["id"])).handled_at is not None

    pdf = client.get(f"{API}/projects/{pid}/panel/print.pdf", headers=env["cph"])
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    qr = client.get(f"{API}/projects/{pid}/panel/qr.png", headers=env["cph"])
    assert qr.status_code == 200 and qr.content.startswith(b"\x89PNG")

    other = client.post(f"{API}/projects", headers=env["ah"], json={"name": "Immeuble Akwa", "status": "execution"})
    taken = client.put(
        f"{API}/projects/{other.json()['id']}/panel", headers=env["ah"], json={"title": "Immeuble Akwa", "slug": slug}
    )
    assert taken.status_code == 409 and taken.json()["error"]["code"] == "SLUG_TAKEN"


# ============================================================================ I6 — programme ambassadeurs
def _describe(client: Any, *, email: str, phone: str, first: str, last: str, code: str) -> None:
    resp = client.post(
        f"{API}/public/describe-project",
        json={
            "universe": "HOME",
            "project_type": "construction_neuve",
            "project_location": "Yaoundé, Odza",
            "surface_m2": 220,
            "levels": 2,
            "budget_max": 85000000,
            "timeline": "3_months",
            "description": "Villa familiale recommandée par un ami.",
            "first_name": first,
            "last_name": last,
            "email": email,
            "phone": phone,
            "consents": {"contact": True},
            "rendered_at": int(time.time()) - 60,
            "referral_code": code,
        },
    )
    assert resp.status_code == 201, resp.text


def test_referral_capture_antifraud_reward_approval_and_momo_payout(client: Any, db: Any, operators: Any) -> None:
    from app.modules.crm.models import Contract, Lead
    from app.modules.identity.models import Organization
    from app.modules.referrals.models import Referral
    from app.modules.system.models import AuditEvent

    org = Organization(name="Famille Ndongo", kind="client")
    db.add(org)
    db.commit()
    ambassador_user, amh = as_role(client, db, "CLIENT", org_id=org.id, first_name="Brice", last_name="Ndongo")
    _admin, adh = as_role(client, db, "ADMIN")
    assert client.put(f"{API}/ambassadors/program", headers=adh, json={"enabled": True}).status_code == 200
    rules = client.get(f"{API}/client/referral", headers=amh).json()
    assert rules["enrolled"] is False and rules["enabled"] is True
    refused = client.post(f"{API}/client/referral", headers=amh, json={"accept_terms": False})
    assert refused.status_code == 422
    joined = client.post(
        f"{API}/client/referral",
        headers=amh,
        json={"accept_terms": True, "momo_number": "670445566", "momo_operator": "mtn"},
    )
    assert joined.status_code == 201, joined.text
    code = joined.json()["code"]
    assert joined.json()["share_url"].endswith(f"/parrainage/{code}") and joined.json()["momo_hint"].endswith("566")
    landing = client.get(f"{API}/public/referrals/{code.lower()}").json()
    assert landing["ambassador"] == "Brice N." and landing["benefit"]
    assert client.get(f"{API}/public/referrals/GZZZZZZ").status_code == 404

    # Auto-parrainage : enregistré mais rejeté (visible pour l'équipe, aucune prime possible)
    _describe(client, email=ambassador_user.email, phone="+237655000001", first="Brice", last="N", code=code)
    # Vrai filleul
    _describe(client, email="paul.ref@example.com", phone="+237677000123", first="Paul", last="Mbarga", code=code)
    referrals = {r.referee_name: r for r in db.execute(select(Referral)).scalars()}
    assert referrals["Brice N"].status == "rejected" and referrals["Brice N"].rejection_reason == "Auto-parrainage"
    referral = referrals["Paul Mbarga"]
    assert referral.status == "captured"
    lead = db.get(Lead, referral.lead_id)
    assert "parrainage" in lead.tags

    # Chaîne commerciale réelle jusqu'à la signature du contrat
    admin = make_user(db, roles=["ADMIN"])
    ah = login(client, admin.email)
    conv = client.post(f"{API}/crm/leads/{lead.id}/convert", headers=ah, json={}).json()
    quote = client.post(
        f"{API}/crm/quotes",
        headers=ah,
        json={
            "title": "Villa R+1 Odza",
            "opportunity_id": conv["opportunity_id"],
            "lines": [{"designation": "Gros œuvre", "unit": "forfait", "quantity": 1, "unit_price": 20000000}],
        },
    ).json()
    token = client.post(f"{API}/crm/quotes/{quote['id']}/send", headers=ah).json()["public_url"].rsplit("/", 1)[-1]
    otp = client.post(f"{API}/public/quotes/{token}/otp").json()
    accepted = client.post(
        f"{API}/public/quotes/{token}/accept",
        json={
            "full_name": "Paul Mbarga",
            "otp_token": otp["otp_token"],
            "code": otp["test_code"],
            "accept_terms": True,
        },
    )
    assert accepted.status_code == 200, accepted.text
    contract = client.post(f"{API}/crm/quotes/{quote['id']}/contract", headers=ah).json()
    scan = client.post(
        f"{API}/crm/files",
        headers=ah,
        files={"file": ("contrat-signe.pdf", b"%PDF-1.4 contrat signe %%EOF", "application/pdf")},
    ).json()
    signed = client.post(
        f"{API}/crm/contracts/{contract['id']}/sign",
        headers=ah,
        json={"signed_by_name": "Paul Mbarga", "method": "manuscrite_scannee", "evidence_file_id": scan["file_id"]},
    )
    assert signed.status_code == 200, signed.text
    drain_outbox()
    db.expire_all()
    referral = db.get(Referral, referral.id)
    amount = db.get(Contract, uuid.UUID(contract["id"])).amount
    expected = (Decimal(amount) / 100).quantize(Decimal("1"), ROUND_HALF_UP)
    assert referral.status == "signed" and referral.amount == expected, (referral.status, referral.rejection_reason)
    assert referral.reward_basis["reward_pct"] == 1.0
    mine = client.get(f"{API}/client/referral", headers=amh).json()
    assert mine["referrals"][0]["referee"] in ("Paul M.", "Brice N")
    assert {r["status"] for r in mine["referrals"]} == {"signed", "rejected"}
    assert all("lead_id" not in r for r in mine["referrals"])

    # Paiement impossible avant validation commerciale ; l'ambassadeur ne valide pas sa propre prime
    _initiator, ih = as_role(client, db, "FINANCE")
    early = client.post(
        f"{API}/payments/outgoing",
        headers={**ih, "Idempotency-Key": uuid.uuid4().hex},
        json={"target_type": "referral_reward", "target_id": str(referral.id), "method": "mobile_money"},
    )
    assert early.status_code == 422 and early.json()["error"]["code"] == "NOT_APPROVED"
    assert client.post(f"{API}/referrals/{referral.id}/approve", headers=amh).status_code == 403
    _director, dh = as_role(client, db, "DIRECTION")
    approved = client.post(f"{API}/referrals/{referral.id}/approve", headers=dh)
    assert approved.status_code == 200 and approved.json()["status"] == "approved", approved.text

    payment = client.post(
        f"{API}/payments/outgoing",
        headers={**ih, "Idempotency-Key": uuid.uuid4().hex},
        json={"target_type": "referral_reward", "target_id": str(referral.id), "method": "mobile_money"},
    )
    assert payment.status_code == 201, payment.text
    payment = payment.json()
    assert payment["counterparty_type"] == "ambassador" and payment["counterparty_label"] == "Brice Ndongo"
    _approver, aph = as_role(client, db, "FINANCE")
    assert client.post(f"{API}/payments/{payment['id']}/approve", headers=aph).status_code == 200
    executed = client.post(f"{API}/payments/{payment['id']}/execute", headers=ih, data={"provider": "mtn_momo"})
    assert executed.status_code == 200 and executed.json()["status"] == "processing", executed.text
    ((reference, transfer),) = operators.momo.transfers.items()
    assert transfer["payee"] == {"partyIdType": "MSISDN", "partyId": "237670445566"}
    operators.momo.complete(reference, "SUCCESSFUL", transfer=True)
    paid = client.post(f"{API}/payments/{payment['id']}/refresh", headers=ih).json()
    assert paid["status"] == "succeeded"
    db.expire_all()
    referral = db.get(Referral, referral.id)
    assert referral.status == "paid" and referral.amount_paid == referral.amount
    assert _events(db, "referral.paid")[-1].payload["ambassador_user_id"] == str(ambassador_user.id)
    stats = client.get(f"{API}/client/referral", headers=amh).json()["ambassador"]["stats"]
    assert Decimal(stats["paid"]) == referral.amount and stats["signed"] == 1

    # Changement du numéro de paiement : tracé comme modification (contrôle interne A5 sur les primes suivantes)
    client.put(f"{API}/client/referral/payout", headers=amh, json={"momo_number": "699001122", "momo_operator": "mtn"})
    change = db.execute(
        select(AuditEvent)
        .where(AuditEvent.resource_type == "ambassador", AuditEvent.module == "referrals")
        .order_by(AuditEvent.timestamp_utc.desc())
    ).scalars()
    assert any((e.diff or {}).get("mobile_money_number") == "***modifié" for e in change)

    team = client.get(f"{API}/referrals", headers=dh).json()
    assert {r["status"] for r in team} == {"paid", "rejected"}
    assert any(r["referee"] == "Paul Mbarga" and r["ambassador"]["code"] == code for r in team)


def test_referral_program_closed_by_default_and_opened_by_admin(client: Any, db: Any) -> None:
    """Parrainage désactivé par défaut : menu client masqué (features), adhésion refusée ; seule l'administration
    (settings:write) l'ouvre, l'action est auditée."""
    from app.modules.identity.models import Organization
    from app.modules.system.models import AuditEvent

    org = Organization(name="Famille Ateba", kind="client")
    db.add(org)
    db.commit()
    _customer, ch = as_role(client, db, "CLIENT", org_id=org.id)
    me = client.get(f"{API}/auth/me", headers=ch).json()
    assert "referrals" not in me["features"]
    assert client.get(f"{API}/client/referral", headers=ch).json() == {"enabled": False, "enrolled": False}
    closed = client.post(f"{API}/client/referral", headers=ch, json={"accept_terms": True})
    assert closed.status_code == 422 and closed.json()["error"]["code"] == "REFERRALS_DISABLED"

    _sales, sh = as_role(client, db, "COMMERCIAL")
    assert client.get(f"{API}/ambassadors/program", headers=sh).json()["enabled"] is False
    assert client.put(f"{API}/ambassadors/program", headers=sh, json={"enabled": True}).status_code == 403

    _admin, adh = as_role(client, db, "ADMIN")
    opened = client.put(
        f"{API}/ambassadors/program",
        headers=adh,
        json={"enabled": True, "reward_type": "fixed", "reward_fixed": 150000},
    )
    assert opened.status_code == 200 and opened.json()["enabled"] is True and opened.json()["reward_fixed"] == 150000
    assert "referrals" in client.get(f"{API}/auth/me", headers=ch).json()["features"]
    assert client.get(f"{API}/client/referral", headers=ch).json()["rules"]["reward_type"] == "fixed"
    assert client.post(f"{API}/client/referral", headers=ch, json={"accept_terms": True}).status_code == 201
    assert "referrals" not in client.get(f"{API}/auth/me", headers=sh).json()["features"]  # sans espace client
    assert client.put(f"{API}/ambassadors/program", headers=adh, json={"reward_pct": 99}).status_code == 422

    assert client.put(f"{API}/ambassadors/program", headers=adh, json={"enabled": False}).status_code == 200
    assert "referrals" not in client.get(f"{API}/auth/me", headers=ch).json()["features"]
    still = client.get(f"{API}/client/referral", headers=ch).json()  # déjà ambassadeur : suivi conservé
    assert still["enabled"] is False and still["enrolled"] is True
    events = (
        db.execute(select(AuditEvent).where(AuditEvent.module == "referrals", AuditEvent.resource_type == "setting"))
        .scalars()
        .all()
    )
    assert len(events) == 2 and all(e.criticality == "HIGH" for e in events)
