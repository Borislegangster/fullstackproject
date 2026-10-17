"""Innovations lot 3 : passeport du bâtiment et maintenance (I2), énergie & confort (I3), financement intégré (I5),
séquestre par jalon (R1), jumeau numérique de chantier (I1)."""

from __future__ import annotations

import io
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from PIL import Image
from sqlalchemy import select

from tests.conftest import as_role, drain_outbox
from tests.test_client_portal import _setup

API = "/api/v1"


def _jpeg(color: tuple[int, int, int]) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (320, 240), color).save(buf, format="JPEG", quality=80)
    return buf.getvalue()


def _pdf(text: str = "Piece justificative") -> bytes:
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(72, 720, text)
    c.showPage()
    c.save()
    return buf.getvalue()


def _events(db: Any, event_type: str) -> list[Any]:
    from app.modules.system.models import OutboxEvent

    db.expire_all()
    return list(
        db.execute(
            select(OutboxEvent).where(OutboxEvent.event_type == event_type).order_by(OutboxEvent.created_at)
        ).scalars()
    )


# ============================================================================ I2 — passeport du bâtiment
def test_building_equipment_maintenance_plan_reminders_predictive_and_certified_passport(client: Any, db: Any) -> None:
    from app.modules.maintenance.models import MaintenanceTask
    from app.modules.maintenance.service import daily_job, reminders
    from app.modules.support.models import Ticket

    env = _setup(client, db)
    pid = env["project"]["id"]
    created = client.post(
        f"{API}/projects/{pid}/equipment",
        headers=env["cph"],
        json={
            "category": "climatisation",
            "name": "Split séjour 18 000 BTU",
            "brand": "Daikin",
            "model": "FTXM50",
            "location": "Séjour",
            "installed_on": (date.today() - timedelta(days=400)).isoformat(),
            "warranty_until": (date.today() + timedelta(days=30)).isoformat(),
        },
    )
    assert created.status_code == 201, created.text
    equipment = created.json()
    assert equipment["next_task"] and equipment["next_task"]["due_on"] >= date.today().isoformat()
    building = client.get(f"{API}/client/projects/{pid}/building", headers=env["custh"])
    assert building.status_code == 200, building.text
    tasks = {t["title"]: t for t in building.json()["tasks"]}
    assert len(tasks) == 2 and building.json()["equipment"][0]["brand"] == "Daikin"
    filters = tasks["Nettoyer les filtres du climatiseur"]
    done = client.post(
        f"{API}/maintenance-tasks/{filters['id']}/complete", headers=env["custh"], json={"note": "Fait ce matin"}
    )
    assert done.status_code == 200 and done.json()["status"] == "done"
    nxt = db.execute(
        select(MaintenanceTask).where(MaintenanceTask.title == filters["title"], MaintenanceTask.status == "planned")
    ).scalar_one()
    assert nxt.due_on == date.today() + timedelta(days=30)
    service_task = tasks["Entretien complet du climatiseur (gaz, évacuation des condensats)"]
    booked = client.post(
        f"{API}/maintenance-tasks/{service_task['id']}/book", headers=env["custh"], json={"note": "Plutôt le matin"}
    )
    assert booked.status_code == 201, booked.text
    ticket = db.execute(select(Ticket).where(Ticket.number == booked.json()["ticket_number"])).scalar_one()
    assert (
        ticket.category == "equipement"
        and "Daikin" in (ticket.description or "")
        and ticket.project_id == uuid.UUID(pid)
    )

    nxt.due_on = date.today() + timedelta(days=14)
    db.commit()
    assert reminders(db) == 1
    db.commit()
    assert _events(db, "maintenance.due")[-1].payload["title"] == filters["title"]
    for _ in range(2):  # 2 demandes SAV sur la catégorie en 6 mois + garantie qui expire → visite préventive
        db.add(
            Ticket(
                number=f"SAV-T-{uuid.uuid4().hex[:6]}",
                project_id=uuid.UUID(pid),
                category="equipement",
                subject="Clim en panne",
                channel="portal",
            )
        )
    db.commit()
    result = daily_job(db)
    db.commit()
    assert result["alerts"] >= 1
    alert = _events(db, "maintenance.predictive_alert")[-1].payload
    assert "garantie" in alert["summary"] and "demandes SAV" in alert["summary"]

    pdf = client.get(f"{API}/projects/{pid}/building-passport.pdf", headers=env["custh"])
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    code = pdf.headers["X-Proof-Code"]
    verified = client.get(f"{API}/public/verify/{code}").json()
    assert verified["type"] == "proof" and verified["subject"] == "Passeport du bâtiment" and verified["valid"]
    assert client.get(f"{API}/client/projects/{pid}/building", headers=env["strh"]).status_code in (403, 404)


def test_building_equipment_update_manual_and_delete_on_their_own_routes(client: Any, db: Any) -> None:
    """Routes /building-equipment/… : distinctes de /equipment/… (parc matériel), qui les masquait auparavant."""
    from app.modules.maintenance.models import BuildingEquipment

    env = _setup(client, db)
    pid = env["project"]["id"]
    created = client.post(
        f"{API}/projects/{pid}/equipment",
        headers=env["cph"],
        json={"category": "pompe", "name": "Surpresseur", "brand": "Grundfos", "location": "Local technique"},
    )
    assert created.status_code == 201, created.text
    eid = created.json()["id"]

    updated = client.patch(
        f"{API}/building-equipment/{eid}",
        headers=env["cph"],
        json={"location": "Sous-sol", "maintenance_interval_days": 90},
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["location"] == "Sous-sol" and body["maintenance_interval_days"] == 90 and body["brand"] == "Grundfos"
    db.expire_all()
    row = db.get(BuildingEquipment, uuid.UUID(eid))
    assert row.location == "Sous-sol" and row.name == "Surpresseur"
    invalid = client.patch(f"{API}/building-equipment/{eid}", headers=env["cph"], json={"category": "fusee"})
    assert invalid.status_code == 422 and invalid.json()["error"]["details"][0]["field"] == "category"
    forbidden = client.patch(f"{API}/building-equipment/{eid}", headers=env["custh"], json={"name": "Pompe"})
    assert forbidden.status_code == 403

    hidden = client.patch(f"{API}/building-equipment/{eid}", headers=env["cph"], json={"client_visible": False})
    assert hidden.status_code == 200 and hidden.json()["client_visible"] is False
    building = client.get(f"{API}/client/projects/{pid}/building", headers=env["custh"]).json()
    assert all(e["id"] != eid for e in building["equipment"])

    manual = client.post(
        f"{API}/building-equipment/{eid}/manual",
        headers=env["cph"],
        files={"file": ("notice.pdf", _pdf("Notice surpresseur"), "application/pdf")},
    )
    assert manual.status_code == 200, manual.text
    assert manual.json()["manual_url"]

    assert client.delete(f"{API}/building-equipment/{eid}", headers=env["cph"]).json() == {"status": "deleted"}
    gone = client.patch(f"{API}/building-equipment/{eid}", headers=env["cph"], json={"name": "Surpresseur 2"})
    assert gone.status_code == 404 and gone.json()["error"]["message"] == "Équipement introuvable"


# ============================================================================ I3 — énergie & confort
def test_energy_simulation_tiers_measures_lead_and_project_request(client: Any, db: Any) -> None:
    from app.modules.crm.models import Lead
    from app.modules.energy.service import monthly_bill, simulate

    tiers = [[110, 50], [400, 79], [None, 94]]
    assert monthly_bill(100, tiers) == 5000
    assert monthly_bill(500, tiers) == 110 * 50 + 290 * 79 + 100 * 94
    base = simulate({"surface_m2": 200, "levels": 2, "standing": "confort", "ac_units": 4, "region": "littoral"})
    assert base["savings_year"] == 0 and base["investment"] == 0
    full = simulate(
        {"surface_m2": 200, "levels": 2, "standing": "confort", "ac_units": 4, "region": "littoral",
         "measures": ["roof_insulation", "inverter_ac", "led", "solar", "battery"]}
    )  # fmt: skip
    assert full["after"]["bill_year"] < base["before"]["bill_year"] and full["savings_year"] > 0
    assert full["payback_years"] and full["autonomy_hours"] > 0 and full["solar"]["kwp"] >= 1
    assert {m["key"] for m in full["measures"]} == {"roof_insulation", "inverter_ac", "led", "solar", "battery"}
    assert abs(sum(m["saving_year"] for m in full["measures"]) - full["savings_year"]) <= 5

    public = client.post(
        f"{API}/public/energy/simulate", json={"surface_m2": 150, "measures": ["solar"], "region": "nord"}
    )
    assert public.status_code == 200 and public.json()["solar"]["production_kwh_year"] > 0
    lead = client.post(
        f"{API}/public/energy/lead",
        json={
            "simulation": {"surface_m2": 150, "measures": ["solar", "battery"]},
            "first_name": "Inès",
            "email": "ines@example.com",
            "consent": True,
        },
    )
    assert lead.status_code == 201, lead.text
    assert (
        db.execute(select(Lead).where(Lead.number == lead.json()["reference"])).scalar_one().source
        == "energy_simulator"
    )

    env = _setup(client, db)
    pid = env["project"]["id"]
    defaults = client.get(f"{API}/client/projects/{pid}/energy", headers=env["custh"]).json()
    assert defaults["defaults"]["standing"] == "premium" and defaults["studies"] == []
    saved = client.post(
        f"{API}/client/projects/{pid}/energy/studies",
        headers=env["custh"],
        json={
            "title": "Toiture + solaire",
            "simulation": {**defaults["defaults"], "measures": ["roof_insulation", "solar"]},
        },
    )
    assert saved.status_code == 201 and saved.json()["results"]["savings_year"] > 0
    requested = client.post(f"{API}/client/energy/studies/{saved.json()['id']}/request", headers=env["custh"])
    assert requested.status_code == 200 and requested.json()["status"] == "requested"
    assert "Panneaux solaires" in _events(db, "energy.option_requested")[-1].payload["measures"]
    assert (
        client.post(f"{API}/client/energy/studies/{saved.json()['id']}/request", headers=env["custh"]).status_code
        == 422
    )
    staff = client.get(f"{API}/projects/{pid}/energy/studies", headers=env["cph"]).json()
    assert [r["status"] for r in staff] == ["requested"]
    assert client.post(f"{API}/energy/studies/{saved.json()['id']}/quoted", headers=env["custh"]).status_code == 403
    quoted = client.post(f"{API}/energy/studies/{saved.json()['id']}/quoted", headers=env["cph"])
    assert quoted.status_code == 200 and quoted.json()["status"] == "quoted"


# ============================================================================ I5 — financement intégré
def test_financing_simulation_dossier_consent_partner_portal_offer_and_withdrawal(client: Any, db: Any) -> None:
    from app.modules.financing.service import payment

    assert payment(Decimal("1200000"), Decimal("0"), 12) == Decimal("100000.00")
    assert payment(Decimal("10000000"), Decimal("12"), 120) == Decimal("143471")

    _fin, fh = as_role(client, db, "FINANCE")
    bank = client.post(
        f"{API}/financing/partners",
        headers=fh,
        json={"name": "Banque du Littoral", "rate_min": "9", "rate_max": "12", "max_years": 20, "min_down_payment_pct": "20",
              "max_debt_ratio_pct": "33", "contact_email": "credit@banque.example", "requirements": ["Domiciliation des revenus"]},
    )  # fmt: skip
    assert bank.status_code == 201, bank.text
    micro = client.post(
        f"{API}/financing/partners",
        headers=fh,
        json={
            "name": "Microcrédit Habitat",
            "kind": "microfinance",
            "rate_min": "14",
            "rate_max": "18",
            "max_years": 5,
        },
    ).json()
    sim = client.post(
        f"{API}/public/financing/simulate",
        json={"amount": "50000000", "down_payment": "15000000", "duration_months": 180, "monthly_income": "1500000"},
    ).json()
    offers = {o["name"]: o for o in sim["offers"]}
    assert offers["Banque du Littoral"]["eligible"] is True and Decimal(offers["Banque du Littoral"]["monthly_max"]) > 0
    assert (
        offers["Microcrédit Habitat"]["eligible"] is False
        and "durée maximale" in offers["Microcrédit Habitat"]["reasons"][0]
    )
    assert "contact_email" not in client.get(f"{API}/public/financing/partners").json()[0]
    # Hypothèse de taux toujours calculée (même sans partenaire) : 35 M sur 15 ans à 11 % = 397 809 / mois
    assert sim["reference"]["rate"] == "11" and Decimal(sim["reference"]["monthly"]) == Decimal("397809")
    assert Decimal(sim["reference"]["debt_ratio_pct"]) == Decimal("26.5")
    custom = client.post(
        f"{API}/public/financing/simulate",
        json={"amount": "50000000", "down_payment": "15000000", "duration_months": 180, "rate": "0"},
    ).json()
    assert (
        Decimal(custom["reference"]["monthly"]) == Decimal("194444.44")
        and custom["reference"]["debt_ratio_pct"] is None
    )

    env = _setup(client, db)
    # Module client fermé par défaut : aucun dossier possible tant que l'administration ne l'a pas ouvert.
    assert "financing" not in client.get(f"{API}/auth/me", headers=env["custh"]).json()["features"]
    assert client.get(f"{API}/public/financing/status").json() == {"client_portal": False}
    blocked = client.post(
        f"{API}/client/financing/applications",
        headers=env["custh"],
        json={"amount": "35000000", "down_payment": "5000000", "duration_months": 180},
    )
    assert blocked.status_code == 422 and blocked.json()["error"]["code"] == "FINANCING_DISABLED"
    _fin, finh = as_role(client, db, "FINANCE")
    assert client.get(f"{API}/financing/program", headers=finh).json()["client_portal"] is False
    assert client.put(f"{API}/financing/program", headers=finh, json={"client_portal": True}).status_code == 403
    _boss, bossh = as_role(client, db, "DIRECTION")
    opened = client.put(f"{API}/financing/program", headers=bossh, json={"client_portal": True})
    assert opened.status_code == 200 and opened.json()["client_portal"] is True
    assert "financing" in client.get(f"{API}/auth/me", headers=env["custh"]).json()["features"]
    assert client.get(f"{API}/public/financing/status").json() == {"client_portal": True}
    created = client.post(
        f"{API}/client/financing/applications",
        headers=env["custh"],
        json={
            "project_id": env["project"]["id"],
            "amount": "50000000",
            "down_payment": "15000000",
            "duration_months": 180,
            "monthly_income": "1500000",
            "rate": "9.5",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["simulation"]["reference"]["rate"] == "9.5"
    app_id = created.json()["id"]
    no_id = client.post(
        f"{API}/client/financing/applications/{app_id}/submit",
        headers=env["custh"],
        json={"partner_ids": [bank.json()["id"]], "consent": True},
    )
    assert no_id.status_code == 422 and no_id.json()["error"]["code"] == "DOCUMENTS_MISSING"
    up = client.post(
        f"{API}/client/financing/applications/{app_id}/documents",
        headers=env["custh"],
        data={"kind": "identite"},
        files={"file": ("cni.pdf", _pdf("CNI"), "application/pdf")},
    )
    assert up.status_code == 200, up.text
    no_consent = client.post(
        f"{API}/client/financing/applications/{app_id}/submit",
        headers=env["custh"],
        json={"partner_ids": [bank.json()["id"]], "consent": False},
    )
    assert no_consent.status_code == 422 and no_consent.json()["error"]["code"] == "CONSENT_REQUIRED"
    sent = client.post(
        f"{API}/client/financing/applications/{app_id}/submit",
        headers=env["custh"],
        json={"partner_ids": [bank.json()["id"], micro["id"]], "consent": True},
    )
    assert sent.status_code == 200 and sent.json()["status"] == "submitted", sent.text
    mail = [
        e
        for e in _events(db, "notification.dispatch")
        if e.payload.get("email_template") == "financing.partner_dossier"
    ]
    assert len(mail) == 1, "seul le partenaire ayant un contact reçoit l'e-mail"
    token = mail[0].payload["context"]["link"].rsplit("/", 1)[-1]

    dossier = client.get(f"{API}/public/financing/dossiers/{token}")
    assert dossier.status_code == 200, dossier.text
    dossier = dossier.json()
    assert dossier["partner"] == "Banque du Littoral" and dossier["applicant"]["email"] == env["customer"].email
    doc = client.get(dossier["documents"][0]["url"])
    assert doc.status_code == 200 and doc.content.startswith(b"%PDF")
    bad_offer = client.post(
        f"{API}/public/financing/dossiers/{token}/respond", json={"status": "offer", "responder_name": "M. Ekane"}
    )
    assert bad_offer.status_code == 422
    offered = client.post(
        f"{API}/public/financing/dossiers/{token}/respond",
        json={
            "status": "offer",
            "responder_name": "M. Ekane",
            "rate": "10.5",
            "amount": "35000000",
            "duration_months": 180,
            "monthly_payment": "386900",
            "conditions": "Assurance décès-invalidité",
        },
    )
    assert offered.status_code == 200, offered.text
    assert _events(db, "financing.partner_response")[-1].payload["user_id"] == str(env["customer"].id)
    mine = client.get(f"{API}/client/financing", headers=env["custh"]).json()[0]
    share = next(p for p in mine["partners"] if p["partner"] == "Banque du Littoral")
    assert mine["status"] == "offer" and share["offer"]["rate"] == "10.5" and share["viewed_at"]
    otp = client.post(
        f"{API}/client/financing/applications/{app_id}/offers/{share['share_id']}/otp", headers=env["custh"]
    ).json()
    accepted = client.post(
        f"{API}/client/financing/applications/{app_id}/offers/{share['share_id']}/accept",
        headers=env["custh"],
        json={"otp_token": otp["otp_token"], "code": otp["test_code"]},
    )
    assert accepted.status_code == 200 and accepted.json()["status"] == "accepted", accepted.text
    late = client.post(
        f"{API}/public/financing/dossiers/{token}/respond", json={"status": "declined", "responder_name": "M. Ekane"}
    )
    assert late.status_code == 422

    second = client.post(
        f"{API}/client/financing/applications",
        headers=env["custh"],
        json={"amount": "20000000", "down_payment": "5000000", "duration_months": 120},
    ).json()
    client.post(
        f"{API}/client/financing/applications/{second['id']}/documents",
        headers=env["custh"],
        data={"kind": "identite"},
        files={"file": ("cni.pdf", _pdf("CNI 2"), "application/pdf")},
    )
    client.post(
        f"{API}/client/financing/applications/{second['id']}/submit",
        headers=env["custh"],
        json={"partner_ids": [bank.json()["id"]], "consent": True},
    )
    mail2 = [
        e
        for e in _events(db, "notification.dispatch")
        if e.payload.get("email_template") == "financing.partner_dossier"
    ][-1]
    token2 = mail2.payload["context"]["link"].rsplit("/", 1)[-1]
    assert client.get(f"{API}/public/financing/dossiers/{token2}").status_code == 200
    client.post(f"{API}/client/financing/applications/{second['id']}/withdraw", headers=env["custh"])
    assert client.get(f"{API}/public/financing/dossiers/{token2}").status_code == 404, "accord retiré : lien révoqué"
    other = client.get(f"{API}/client/financing", headers=env["strh"]).json()
    assert other == []


# ============================================================================ R1 — séquestre par jalon
def _published_pv(db: Any, project_id: uuid.UUID) -> Any:
    from app.core.files import store_private, validate_upload
    from app.core.security import random_token
    from app.modules.documents.models import Document, DocumentVersion

    upload = validate_upload("pv-dalle.pdf", _pdf("PV de reception du jalon"), category="document")
    stored = store_private(db, upload, purpose="documents", classification="internal")
    doc = Document(
        code=f"PV-{uuid.uuid4().hex[:6]}",
        title="PV dalle haute RDC",
        doc_type="pv",
        project_id=project_id,
        client_visible=True,
    )
    db.add(doc)
    db.flush()
    version = DocumentVersion(
        document_id=doc.id, file_id=stored.id, checksum_sha256=upload.sha256, mime_type=upload.mime,
        original_name=upload.filename, status="published", authenticity_token=random_token(24),
    )  # fmt: skip
    db.add(version)
    db.flush()
    doc.published_version_id = version.id
    db.commit()
    return doc


def test_milestone_escrow_hold_proof_based_release_dual_control_and_dispute(
    client: Any, db: Any, operators: Any
) -> None:
    from app.core.utils import utcnow
    from app.modules.escrow.models import EscrowMovement
    from app.modules.projects.models import Milestone
    from app.modules.proofs.service import certify_photo_day

    env = _setup(client, db)
    pid = env["project"]["id"]
    _fin, fh = as_role(client, db, "FINANCE")
    _fin2, fh2 = as_role(client, db, "FINANCE")
    _dir, dh = as_role(client, db, "DIRECTION")
    setup = client.put(
        f"{API}/projects/{pid}/escrow",
        headers=fh,
        json={"partner_name": "Banque Séquestre SA", "review_days": 7, "terms": "Convention type"},
    )
    assert setup.status_code == 200 and setup.json()["account"]["status"] == "pending_partner", setup.text
    assert client.post(f"{API}/projects/{pid}/escrow/activate", headers=fh).status_code == 422, "Direction uniquement"
    missing_ref = client.post(f"{API}/projects/{pid}/escrow/activate", headers=dh)
    assert missing_ref.status_code == 422 and missing_ref.json()["error"]["code"] == "ESCROW_PARTNER_MISSING"
    client.put(
        f"{API}/projects/{pid}/escrow",
        headers=fh,
        json={"partner_name": "Banque Séquestre SA", "partner_reference": "CONV-2026-042", "review_days": 7},
    )
    assert client.post(f"{API}/projects/{pid}/escrow/activate", headers=dh).json()["account"]["status"] == "active"

    milestones = []
    calls = []
    for label in ("Dalle haute RDC", "Toiture"):
        m = Milestone(project_id=uuid.UUID(pid), name=label, due_date=date.today() + timedelta(days=5))
        db.add(m)
        db.commit()
        milestones.append(m)
        call = client.post(
            f"{API}/funds-calls", headers=env["fh"],
            json={"project_id": pid, "label": f"Appel {label}", "amount": 2000000, "due_date": (date.today() + timedelta(days=10)).isoformat()},
        ).json()  # fmt: skip
        client.post(f"{API}/funds-calls/{call['id']}/issue", headers=env["fh"], json={})
        calls.append(call)
        attached = client.post(
            f"{API}/projects/{pid}/escrow/items",
            headers=fh,
            json={"funds_call_id": call["id"], "milestone_id": str(m.id)},
        )
        assert attached.status_code == 201, attached.text

    for call in calls:  # paiement réel MoMo des deux appels → fonds sous séquestre
        started = client.post(
            f"{API}/client/checkout",
            headers={**env["custh"], "Idempotency-Key": uuid.uuid4().hex},
            json={
                "target_type": "funds_call",
                "target_id": call["id"],
                "provider": "mtn_momo",
                "method": "mobile_money",
                "payer_phone": "670000001",
            },
        ).json()
        operators.momo.complete(started["transaction_id"], "SUCCESSFUL")
        status = client.get(f"{API}/payments/transactions/{started['transaction_id']}", headers=env["custh"])
        assert status.status_code == 200, status.text
    overview = client.get(f"{API}/client/projects/{pid}/escrow", headers=env["custh"]).json()
    assert Decimal(overview["account"]["balance_held"]) == Decimal("4000000.00")
    assert {i["status"] for i in overview["items"]} == {"held"} and overview["account"]["partner_reference"] is None
    item1, item2 = overview["items"]

    pv = _published_pv(db, uuid.UUID(pid))
    early = client.post(
        f"{API}/escrow/items/{item1['id']}/request-release", headers=env["cph"], json={"pv_document_id": str(pv.id)}
    )
    assert early.status_code == 422 and early.json()["error"]["code"] == "MILESTONE_NOT_ACHIEVED"
    milestones[0].status, milestones[0].achieved_at = "achieved", utcnow()
    milestones[1].status, milestones[1].achieved_at = "achieved", utcnow()
    db.commit()
    no_photo = client.post(
        f"{API}/escrow/items/{item1['id']}/request-release", headers=env["cph"], json={"pv_document_id": str(pv.id)}
    )
    assert no_photo.status_code == 422 and no_photo.json()["error"]["code"] == "PHOTO_PROOF_REQUIRED"
    client.post(
        f"{API}/projects/{pid}/media", headers=env["ah"],
        files={"file": ("dalle.jpg", _jpeg((120, 120, 120)), "image/jpeg")}, data={"publish": "true"},
    )  # fmt: skip
    certify_photo_day(db, uuid.UUID(pid), date.today())
    db.commit()
    requested = client.post(
        f"{API}/escrow/items/{item1['id']}/request-release", headers=env["cph"], json={"pv_document_id": str(pv.id)}
    )
    assert requested.status_code == 200, requested.text
    evidence = next(i for i in requested.json()["items"] if i["id"] == item1["id"])["evidence"]
    assert evidence["pv_title"] == "PV dalle haute RDC" and evidence["photo_proofs"][0]["code"]
    assert _events(db, "escrow.release_requested")[-1].payload["milestone"] == "Dalle haute RDC"

    early_release = client.post(f"{API}/escrow/items/{item1['id']}/release", headers=fh, json={})
    assert early_release.status_code == 422, "pas de libération sans accord du client"
    otp = client.post(f"{API}/client/escrow/items/{item1['id']}/otp", headers=env["custh"]).json()
    approved = client.post(
        f"{API}/client/escrow/items/{item1['id']}/approve",
        headers=env["custh"],
        json={"otp_token": otp["otp_token"], "code": otp["test_code"]},
    )
    assert approved.status_code == 200, approved.text
    first = client.post(f"{API}/escrow/items/{item1['id']}/release", headers=fh, json={})
    assert first.status_code == 200 and first.json()["released"] is False
    same = client.post(f"{API}/escrow/items/{item1['id']}/release", headers=fh, json={"reference": "OV-1"})
    assert same.status_code == 422 and same.json()["error"]["code"] == "SEGREGATION_OF_DUTIES"
    no_ref = client.post(f"{API}/escrow/items/{item1['id']}/release", headers=dh, json={})
    assert no_ref.status_code == 422 and no_ref.json()["error"]["code"] == "REFERENCE_REQUIRED"
    released = client.post(f"{API}/escrow/items/{item1['id']}/release", headers=fh2, json={"reference": "OV-2026-0001"})
    assert released.status_code == 200 and released.json()["released"] is True, released.text
    account = released.json()["account"]
    assert Decimal(account["balance_held"]) == Decimal("2000000.00") and Decimal(
        account["balance_released"]
    ) == Decimal("2000000.00")

    # Contestation → médiation Direction → restitution
    client.post(
        f"{API}/escrow/items/{item2['id']}/request-release", headers=env["cph"], json={"pv_document_id": str(pv.id)}
    )
    disputed = client.post(
        f"{API}/client/escrow/items/{item2['id']}/dispute",
        headers=env["custh"],
        json={"reason": "Fuites constatées sur la toiture après la pluie"},
    )
    assert disputed.status_code == 200, disputed.text
    assert "Fuites" in _events(db, "escrow.disputed")[-1].payload["reason"]
    resolved = client.post(
        f"{API}/escrow/items/{item2['id']}/resolve",
        headers=dh,
        json={"decision": "refund", "note": "Reprise de l'étanchéité à nos frais, fonds restitués"},
    )
    assert resolved.status_code == 200, resolved.text
    final = resolved.json()["account"]
    assert Decimal(final["balance_held"]) == 0 and Decimal(final["balance_refunded"]) == Decimal("2000000.00")
    kinds = sorted(m.kind for m in db.execute(select(EscrowMovement)).scalars())
    assert kinds == ["deposit", "deposit", "refund", "release"]
    assert client.get(f"{API}/client/projects/{pid}/escrow", headers=env["strh"]).status_code in (403, 404)
    portfolio = client.get(f"{API}/escrow/portfolio", headers=fh).json()
    row = next(r for r in portfolio if r["project"]["id"] == pid)
    assert row["items_count"] == 2 and row["waiting"] == [] and row["account"]["partner_reference"]
    assert client.get(f"{API}/escrow/portfolio", headers=env["custh"]).status_code == 403


# ============================================================================ I1 — jumeau numérique
def test_progress_twin_requires_ai_measures_photos_and_certifies_validation(
    client: Any, db: Any, monkeypatch: Any
) -> None:
    from app.modules.ai import service as ai_service
    from app.modules.projects.models import ProgressUpdate, Task
    from app.modules.proofs.models import Proof
    from app.providers import ai as ai_provider

    env = _setup(client, db)
    pid = uuid.UUID(env["project"]["id"])
    walls = Task(
        project_id=pid,
        title="Élévation murs RDC",
        start_planned=date.today() - timedelta(days=10),
        end_planned=date.today() + timedelta(days=10),
        duration_days=20,
        progress_pct=Decimal("20"),
        status="in_progress",
    )
    slab = Task(
        project_id=pid,
        title="Coffrage dalle haute",
        start_planned=date.today() - timedelta(days=2),
        end_planned=date.today() + timedelta(days=8),
        duration_days=10,
    )
    db.add_all([walls, slab])
    db.commit()
    no_ai = client.post(f"{API}/projects/{pid}/twin/analyze", headers=env["ah"], json={})
    assert no_ai.status_code == 422 and no_ai.json()["error"]["code"] == "AI_REQUIRED"

    monkeypatch.setattr(ai_provider, "get_ai_provider", lambda: object())
    seen: dict[str, Any] = {}

    def fake_json(feature: str, *, system: str, prompt: str, schema: dict, effort: str = "low", attachments=None):
        seen.update(feature=feature, images=len(attachments or []), prompt=prompt)
        return (
            {
                "tasks": [
                    {
                        "index": 0,
                        "observed_pct": 55,
                        "confidence": "bonne",
                        "evidence": "Murs montés jusqu'au linteau sur 3 façades",
                    },
                    {"index": 1, "observed_pct": 0, "confidence": "moyenne", "evidence": "Aucun coffrage visible"},
                ],
                "summary": "Élévation en avance sur le déclaré.",
                "anomalies": ["Garde-corps provisoire absent côté rue"],
            },
            None,
            None,
        )

    monkeypatch.setattr(ai_service, "_json", fake_json)
    no_photo = client.post(f"{API}/projects/{pid}/twin/analyze", headers=env["ah"], json={})
    assert no_photo.status_code == 422 and no_photo.json()["error"]["code"] == "NO_PHOTOS"
    for i in range(2):
        client.post(
            f"{API}/projects/{pid}/media",
            headers=env["ah"],
            files={"file": (f"m{i}.jpg", _jpeg((80 + i * 40, 90, 100)), "image/jpeg")},
            data={"publish": "false"},
        )
    analyzed = client.post(f"{API}/projects/{pid}/twin/analyze", headers=env["ah"], json={})
    assert analyzed.status_code == 201, analyzed.text
    observation = analyzed.json()
    assert seen["feature"] == "progress_twin" and seen["images"] == 2 and "Élévation murs RDC" in seen["prompt"]
    first = observation["results"][0]
    assert first["observed_pct"] == 55 and first["declared_pct"] == 20.0 and first["flag"] is True
    assert observation["anomalies"] == ["Garde-corps provisoire absent côté rue"]
    assert client.get(f"{API}/client/projects/{pid}/twin", headers=env["custh"]).json() == [], (
        "non validée : invisible client"
    )

    validated = client.post(
        f"{API}/twin/observations/{observation['id']}/validate",
        headers=env["cph"],
        json={"adjustments": {str(walls.id): 50}, "note": "Vérifié sur place"},
    )
    assert validated.status_code == 200 and validated.json()["status"] == "validated", validated.text
    db.expire_all()
    assert db.get(Task, walls.id).progress_pct == Decimal("50.00")
    update = db.execute(select(ProgressUpdate).where(ProgressUpdate.task_id == walls.id)).scalar_one()
    assert update.source == "twin" and len(update.evidence_file_ids) == 2
    proof = db.execute(select(Proof).where(Proof.subject_type == "progress_observation")).scalar_one()
    assert proof.client_visible and len(proof.leaves) == 3 and validated.json()["proof_code"] == proof.public_code
    mine = client.get(f"{API}/client/projects/{pid}/twin", headers=env["custh"]).json()
    assert mine[0]["results"][0] == {
        "title": "Élévation murs RDC",
        "planned_pct": first["planned_pct"],
        "observed_pct": 50,
    }
    assert "summary" not in mine[0] and "anomalies" not in mine[0]
    again = client.post(f"{API}/twin/observations/{observation['id']}/validate", headers=env["cph"], json={})
    assert again.status_code == 422
    assert drain_outbox() >= 0 and datetime.now(UTC)
