"""Espace client : dashboard, paiement en ligne MTN MoMo (demande validée sur téléphone, rappel signé idempotent,
statut relu chez l'opérateur, reçu), décision OTP irrévocable avec avenant, passeport projet ; configurateur 3D
(delta prix / délai → décision → verrouillage) ; SAV client."""

from __future__ import annotations

import io
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from PIL import Image
from sqlalchemy import select

from tests.conftest import as_role, login, make_user

API = "/api/v1"


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), (56, 90, 166)).save(buf, format="PNG")
    return buf.getvalue()


def _setup(client: Any, db: Any) -> dict[str, Any]:
    from app.modules.identity.models import Organization

    admin = make_user(db, email=f"admin-cp-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    chef, cph = as_role(client, db, "CHEF_PROJET")
    _finance, fh = as_role(client, db, "FINANCE")
    org = Organization(name="Famille Mbappe", kind="client")
    other_org = Organization(name="Autre client", kind="client")
    db.add_all([org, other_org])
    db.commit()
    customer, custh = as_role(client, db, "CLIENT", org_id=org.id)
    _stranger, strh = as_role(client, db, "CLIENT", org_id=other_org.id)
    project = client.post(
        f"{API}/projects",
        headers=ah,
        json={
            "name": "Villa Mbappe — Bonapriso",
            "client_organization_id": str(org.id),
            "status": "execution",
            "contract_amount": 85000000,
            "start_planned": (date.today() - timedelta(days=30)).isoformat(),
            "end_planned": (date.today() + timedelta(days=300)).isoformat(),
            "universe": "PREMIUM",
        },
    ).json()
    client.post(
        f"{API}/projects/{project['id']}/members",
        headers=ah,
        json={"user_id": str(chef.id), "project_role": "chef_projet", "can_view_finance": True},
    )
    return {
        "ah": ah,
        "chef": chef,
        "cph": cph,
        "fh": fh,
        "customer": customer,
        "custh": custh,
        "strh": strh,
        "project": project,
        "org": org,
    }


def test_client_dashboard_payment_decision_passport(client: Any, db: Any, operators: Any) -> None:
    env = _setup(client, db)
    project = env["project"]
    milestone = client.post(
        f"{API}/milestones",
        headers=env["cph"],
        json={
            "project_id": project["id"],
            "name": "Dalle haute RDC coulée",
            "due_date": (date.today() - timedelta(days=2)).isoformat(),
            "client_visible": True,
        },
    )
    assert milestone.status_code == 201, milestone.text

    call = client.post(
        f"{API}/funds-calls",
        headers=env["fh"],
        json={
            "project_id": project["id"],
            "label": "Acompte gros œuvre 30 %",
            "amount": 2500000,
            "due_date": (date.today() + timedelta(days=10)).isoformat(),
        },
    ).json()
    issued = client.post(f"{API}/funds-calls/{call['id']}/issue", headers=env["fh"], json={})
    assert issued.status_code == 200, issued.text

    dashboard = client.get(f"{API}/client/projects/{project['id']}/dashboard", headers=env["custh"])
    assert dashboard.status_code == 200, dashboard.text
    dashboard = dashboard.json()
    assert Decimal(dashboard["finance"]["due"]) == Decimal("2500000.00")
    assert any(a["kind"] == "milestone_late" for a in dashboard["alerts"])
    assert client.get(f"{API}/client/projects/{project['id']}/dashboard", headers=env["strh"]).status_code in (403, 404)

    # Paiement en ligne MTN MoMo : demande de paiement → validation sur le téléphone → rappel signé → reçu
    momo = operators.momo
    key = {"Idempotency-Key": uuid.uuid4().hex}
    body = {
        "target_type": "funds_call",
        "target_id": call["id"],
        "provider": "mtn_momo",
        "method": "mobile_money",
        "payer_phone": "6 70 00 00 01",
    }
    methods = client.get(f"{API}/client/projects/{project['id']}/finances", headers=env["custh"]).json()
    assert {
        "provider": "mtn_momo",
        "method": "mobile_money",
        "label": "MTN Mobile Money",
        "flow": "push",
        "requires_phone": True,
    } in methods["payment_methods"]
    inactive = client.post(
        f"{API}/client/checkout",
        headers={**env["custh"], "Idempotency-Key": uuid.uuid4().hex},
        json={**body, "payer_phone": "650000000"},
    )
    assert inactive.status_code == 422 and inactive.json()["error"]["code"] == "PROVIDER_REJECTED", inactive.text
    checkout = client.post(f"{API}/client/checkout", headers={**env["custh"], **key}, json=body)
    assert checkout.status_code == 201, checkout.text
    checkout = checkout.json()
    assert checkout["flow"] == "push" and "237670000001" in checkout["instructions"]
    again = client.post(f"{API}/client/checkout", headers={**env["custh"], **key}, json=body)
    assert again.json()["payment_id"] == checkout["payment_id"]
    reference = checkout["transaction_id"]
    sent = momo.requests[reference]
    assert sent["payer"] == {"partyIdType": "MSISDN", "partyId": "237670000001"}
    assert sent["amount"] == "2500000" and sent["currency"] == "EUR" and sent["externalId"] == reference
    pending = client.get(f"{API}/payments/transactions/{reference}", headers=env["custh"]).json()
    assert pending["status"] == "pending" and pending["flow"] == "push" and pending["instructions"]

    momo.complete(reference, "SUCCESSFUL")
    from app.providers.payments import callback_signature

    callback = f"{API}/payments/webhooks/mtn_momo?ref={reference}&sig={callback_signature('mtn_momo', reference)}"
    notice = {"externalId": reference, "status": "SUCCESSFUL", "financialTransactionId": "1234567890"}
    completed = client.put(callback, json=notice)
    assert completed.status_code == 200 and completed.json()["payment_status"] == "succeeded", completed.text
    duplicate = client.put(callback, json=notice)
    assert duplicate.json()["status"] == "duplicate", "rappel rejoué sans double encaissement"
    forged = client.put(f"{API}/payments/webhooks/mtn_momo?ref={reference}&sig=faux", json=notice)
    assert forged.status_code == 401
    finances = client.get(f"{API}/client/projects/{project['id']}/finances", headers=env["custh"]).json()
    assert finances["funds_calls"][0]["status"] == "paid"
    assert finances["payments"][0]["status"] == "succeeded" and finances["payments"][0]["receipt_url"]
    status = client.get(f"{API}/client/payments/{checkout['payment_id']}", headers=env["custh"]).json()
    assert status["status"] == "succeeded"

    # Décision client OTP (irrévocable, empreinte, avenant si impact)
    decision = client.post(
        f"{API}/decisions",
        headers=env["cph"],
        json={
            "project_id": project["id"],
            "kind": "option",
            "title": "Carrelage séjour",
            "options": [
                {"label": "Grès cérame standard", "price_impact": 0, "delay_impact_days": 0},
                {"label": "Marbre de Carrare", "price_impact": 1850000, "delay_impact_days": 12},
            ],
        },
    ).json()
    otp = client.post(f"{API}/client/decisions/{decision['id']}/otp", headers=env["custh"]).json()
    bad = client.post(
        f"{API}/client/decisions/{decision['id']}/validate",
        headers=env["custh"],
        json={"otp_token": otp["otp_token"], "code": "000000", "selected_option": "Marbre de Carrare"},
    )
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "OTP_INVALID"
    validated = client.post(
        f"{API}/client/decisions/{decision['id']}/validate",
        headers=env["custh"],
        json={"otp_token": otp["otp_token"], "code": otp["test_code"], "selected_option": "Marbre de Carrare"},
    )
    assert validated.status_code == 200, validated.text
    validated = validated.json()
    assert validated["status"] == "validated" and validated["content_hash"] and validated["change_order_id"]
    replay = client.post(
        f"{API}/client/decisions/{decision['id']}/validate",
        headers=env["custh"],
        json={"otp_token": otp["otp_token"], "code": otp["test_code"]},
    )
    assert replay.status_code in (400, 409), "décision figée : pas de seconde validation"

    passport = client.get(f"{API}/client/projects/{project['id']}/passport", headers=env["custh"]).json()
    assert passport["identity"]["name"] == "Villa Mbappe — Bonapriso"
    assert passport["payments"][0]["amount"] == "2500000.00"
    assert passport["validation_journal"][0]["hash"] == validated["content_hash"]
    assert passport["change_orders"][0]["cost_impact"] == "1850000.00"


def test_configurator_scenario_to_locked_decision(client: Any, db: Any) -> None:
    from app.modules.configurator.models import MaterialCategory

    env = _setup(client, db)
    project = env["project"]
    category = db.execute(select(MaterialCategory).where(MaterialCategory.key == "sol")).scalar_one()
    _admin_like, mh = as_role(client, db, "ARCHITECTE")
    client.post(
        f"{API}/projects/{project['id']}/members",
        headers=env["ah"],
        json={"user_id": str(_admin_like.id), "project_role": "architecte"},
    )
    base = client.post(
        f"{API}/configurator/materials",
        headers=mh,
        json={
            "category_id": str(category.id),
            "name": "Grès cérame 60x60",
            "unit": "m2",
            "unit_price": 12000,
            "lead_time_days": 3,
            "tier": "standard",
        },
    )
    assert base.status_code == 201, base.text
    premium = client.post(
        f"{API}/configurator/materials",
        headers=mh,
        json={
            "category_id": str(category.id),
            "name": "Marbre poli",
            "unit": "m2",
            "unit_price": 45000,
            "lead_time_days": 25,
            "availability": "on_order",
            "tier": "premium",
        },
    ).json()
    model = client.post(
        f"{API}/configurator/models",
        headers=mh,
        json={
            "project_id": project["id"],
            "name": "Séjour & cuisine",
            "source": "parametric",
            "parameters": {"levels": 1},
            "zones": [
                {
                    "key": "sol_sejour",
                    "label": "Sol du séjour",
                    "category_key": "sol",
                    "quantity": 48,
                    "unit": "m2",
                    "default_material_id": base.json()["id"],
                    "mesh_names": ["Floor_Living"],
                }
            ],
        },
    )
    assert model.status_code == 201, model.text
    model = model.json()
    assert client.get(f"{API}/configurator/models/{model['id']}", headers=env["custh"]).status_code == 404
    client.post(f"{API}/configurator/models/{model['id']}/publish", headers=env["cph"], json={"published": True})
    zone_id = model["zones"][0]["id"]

    scenario = client.post(
        f"{API}/configurator/models/{model['id']}/scenarios", headers=env["custh"], json={"name": "Version luxe"}
    )
    assert scenario.status_code == 201, scenario.text
    scenario = scenario.json()
    chosen = client.put(
        f"{API}/configurator/scenarios/{scenario['id']}/choices",
        headers=env["custh"],
        json={"zone_id": zone_id, "material_id": premium["id"]},
    ).json()
    assert Decimal(chosen["price_delta"]) == Decimal("1584000.00")  # 48 m² × (45 000 − 12 000)
    assert chosen["delay_delta_days"] == 25
    submitted = client.post(f"{API}/configurator/scenarios/{scenario['id']}/submit", headers=env["custh"]).json()
    assert submitted["status"] == "submitted"
    decision_id = submitted["decision"]["id"]
    otp = client.post(f"{API}/client/decisions/{decision_id}/otp", headers=env["custh"]).json()
    client.post(
        f"{API}/client/decisions/{decision_id}/validate",
        headers=env["custh"],
        json={"otp_token": otp["otp_token"], "code": otp["test_code"]},
    )
    locked = client.get(f"{API}/configurator/models/{model['id']}/scenarios", headers=env["custh"]).json()[0]
    assert locked["status"] == "locked" and locked["change_order_id"]
    blocked = client.put(
        f"{API}/configurator/scenarios/{scenario['id']}/choices",
        headers=env["custh"],
        json={"zone_id": zone_id, "material_id": base.json()["id"]},
    )
    assert blocked.status_code == 409 and blocked.json()["error"]["code"] == "SCENARIO_LOCKED"


def test_after_sales_ticket_lifecycle(client: Any, db: Any) -> None:
    env = _setup(client, db)
    project = env["project"]
    _sav, savh = as_role(client, db, "DIRECTION")
    technician, techh = as_role(client, db, "TECHNICIEN")
    client.post(
        f"{API}/warranties",
        headers=env["ah"],
        json={
            "project_id": project["id"],
            "kind": "parfait_achevement",
            "start_date": (date.today() - timedelta(days=10)).isoformat(),
            "end_date": (date.today() + timedelta(days=355)).isoformat(),
        },
    )
    ticket = client.post(
        f"{API}/support/tickets",
        headers=env["custh"],
        json={
            "project_id": project["id"],
            "category": "plomberie",
            "priority": "high",
            "subject": "Fuite sous l'évier",
            "description": "Goutte à goutte permanent",
        },
    )
    assert ticket.status_code == 201, ticket.text
    ticket = ticket.json()
    assert ticket["within_warranty"] is True and ticket["response_due_at"]
    client.post(f"{API}/support/tickets/{ticket['id']}/assign", headers=savh, json={"assignee_id": str(technician.id)})
    client.post(
        f"{API}/support/tickets/{ticket['id']}/messages",
        headers=savh,
        json={"body": "Note interne : vérifier le siphon", "internal": True},
    )
    client.post(
        f"{API}/support/tickets/{ticket['id']}/messages",
        headers=savh,
        json={"body": "Un technicien passe jeudi matin."},
    )
    seen = client.get(f"{API}/support/tickets/{ticket['id']}", headers=env["custh"]).json()
    assert [m["body"] for m in seen["messages"]] == ["Un technicien passe jeudi matin."]
    client.post(
        f"{API}/support/tickets/{ticket['id']}/interventions",
        headers=savh,
        json={"technician_id": str(technician.id), "scheduled_at": (datetime.now(UTC) + timedelta(days=1)).isoformat()},
    )
    detail = client.get(f"{API}/support/tickets/{ticket['id']}", headers=savh).json()
    intervention = detail["interventions"][0]
    proof = client.post(
        f"{API}/support/tickets/{ticket['id']}/attachments",
        headers=techh,
        data={"kind": "after"},
        files={"file": ("apres.png", _png(), "image/png")},
    )
    assert proof.status_code == 201, proof.text
    no_proof = client.post(
        f"{API}/support/interventions/{intervention['id']}/finish", headers=techh, json={"report": "Joint remplacé"}
    )
    assert no_proof.json()["error"]["code"] == "PROOF_REQUIRED"
    done = client.post(
        f"{API}/support/interventions/{intervention['id']}/finish",
        headers=techh,
        json={
            "report": "Joint du siphon remplacé, test d'étanchéité OK",
            "time_spent_hours": 1.5,
            "proof_file_ids": [proof.json()["file_id"]],
        },
    )
    assert done.json()["status"] == "resolved"
    closed = client.post(
        f"{API}/support/tickets/{ticket['id']}/validate",
        headers=env["custh"],
        json={"rating": 5, "comment": "Rapide et propre"},
    ).json()
    assert closed["status"] == "closed" and closed["satisfaction_rating"] == 5
    draft = client.post(f"{API}/support/tickets/{ticket['id']}/ai-draft", headers=savh)
    assert draft.status_code == 200 and ticket["number"] in draft.json()["draft"]


def test_client_appointment_request_confirm_move_cancel(client: Any, db: Any) -> None:
    """« Mes rendez-vous » : le client demande un créneau, l'équipe du projet est prévenue et le confirme ; un
    nouveau créneau proposé par le client repasse en attente ; l'annulation prévient l'équipe."""
    from app.modules.notifications.models import Notification

    env = _setup(client, db)
    project, chef, custh = env["project"], env["chef"], env["custh"]
    start = (datetime.now(UTC) + timedelta(days=3)).replace(microsecond=0)
    body = {
        "project_id": project["id"],
        "kind": "site_visit",
        "subject": "Visite des fondations",
        "starts_at": start.isoformat(),
        "duration_minutes": 90,
        "message": "Je souhaite voir le ferraillage avant coulage.",
    }
    # Projet sans chef de projet ni conducteur de travaux : demande refusée avec un message clair.
    orphan = client.post(
        f"{API}/projects",
        headers=env["ah"],
        json={"name": "Annexe Mbappe", "client_organization_id": str(env["org"].id), "status": "execution"},
    ).json()
    none = client.post(f"{API}/agenda/requests", headers=custh, json={**body, "project_id": orphan["id"]})
    assert none.status_code == 422 and "Aucun interlocuteur" in none.json()["error"]["message"]

    too_soon = client.post(
        f"{API}/agenda/requests", headers=custh, json={**body, "starts_at": datetime.now(UTC).isoformat()}
    )
    assert too_soon.status_code == 422
    stranger = client.post(f"{API}/agenda/requests", headers=env["strh"], json=body)
    assert stranger.status_code in (403, 404)

    created = client.post(f"{API}/agenda/requests", headers=custh, json=body)
    assert created.status_code == 201, created.text
    event = created.json()
    assert event["status"] == "tentative" and event["client_visible"] is True and event["kind"] == "site_visit"
    assert {a["user_id"] for a in event["attendees"]} == {str(env["customer"].id), str(chef.id)}
    assert datetime.fromisoformat(event["ends_at"]) - datetime.fromisoformat(event["starts_at"]) == timedelta(
        minutes=90
    )
    asked = (
        db.execute(
            select(Notification).where(Notification.user_id == chef.id, Notification.event_type == "agenda.invitation")
        )
        .scalars()
        .all()
    )
    assert any(n.title == "Demande de rendez-vous : Visite des fondations" for n in asked)

    # Le client ne peut pas confirmer lui-même ; l'équipe confirme.
    self_confirm = client.patch(f"{API}/agenda/events/{event['id']}", headers=custh, json={"status": "confirmed"})
    assert self_confirm.status_code == 403
    confirmed = client.post(f"{API}/agenda/events/{event['id']}/confirm", headers=env["cph"])
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "confirmed"
    assert client.post(f"{API}/agenda/events/{event['id']}/confirm", headers=env["cph"]).status_code == 422
    told = (
        db.execute(
            select(Notification).where(
                Notification.user_id == env["customer"].id, Notification.event_type == "agenda.confirmed"
            )
        )
        .scalars()
        .all()
    )
    assert told and told[0].link == f"/agenda/{event['id']}"

    # Nouveau créneau demandé par le client : de nouveau en attente, l'équipe est prévenue.
    later = start + timedelta(days=1)
    moved = client.patch(
        f"{API}/agenda/events/{event['id']}",
        headers=custh,
        json={"starts_at": later.isoformat(), "ends_at": (later + timedelta(hours=1)).isoformat()},
    )
    assert moved.status_code == 200 and moved.json()["status"] == "tentative"
    assert (
        db.execute(
            select(Notification).where(Notification.user_id == chef.id, Notification.event_type == "agenda.moved")
        )
        .scalars()
        .first()
    )

    listed = client.get(
        f"{API}/agenda/events",
        headers=custh,
        params={
            "start": datetime.now(UTC).isoformat(),
            "end": (datetime.now(UTC) + timedelta(days=10)).isoformat(),
            "project_id": project["id"],
        },
    )
    assert [e["id"] for e in listed.json()] == [event["id"]]

    cancelled = client.patch(f"{API}/agenda/events/{event['id']}", headers=custh, json={"status": "cancelled"})
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "cancelled"
    assert (
        db.execute(
            select(Notification).where(Notification.user_id == chef.id, Notification.event_type == "agenda.cancelled")
        )
        .scalars()
        .first()
    )
