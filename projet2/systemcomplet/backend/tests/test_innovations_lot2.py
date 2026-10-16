"""Innovations lot 2 : assistant WhatsApp (A1), devis instantané par IA (A2), time-lapse et caméras (R2), achats
prédictifs (A3), planning intelligent (A4), visites immersives partagées (R5)."""

from __future__ import annotations

import io
import json
import time
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from PIL import Image
from sqlalchemy import select

from tests.conftest import as_role, drain_outbox, login, make_user
from tests.test_client_portal import _setup

API = "/api/v1"


def _jpeg(color: tuple[int, int, int], size: tuple[int, int] = (320, 240)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="JPEG", quality=80)
    return buf.getvalue()


def _events(db: Any, event_type: str) -> list[Any]:
    from app.modules.system.models import OutboxEvent

    db.expire_all()
    return list(
        db.execute(
            select(OutboxEvent).where(OutboxEvent.event_type == event_type).order_by(OutboxEvent.created_at)
        ).scalars()
    )


# ============================================================================ A1 — assistant WhatsApp
def _wa(client: Any, sender: str, text: str, name: str = "Jean Mballa") -> None:
    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "contacts": [{"wa_id": sender, "profile": {"name": name}}],
                            "messages": [
                                {
                                    "id": f"wamid.{uuid.uuid4().hex}",
                                    "from": sender,
                                    "type": "text",
                                    "text": {"body": text},
                                }
                            ],
                        }
                    }
                ]
            }
        ]
    }
    r = client.post(
        f"{API}/webhooks/whatsapp", content=json.dumps(payload), headers={"Content-Type": "application/json"}
    )
    assert r.status_code == 200 and r.json()["processed"] == 1, r.text
    drain_outbox()


def _sent_to(number: str) -> list[dict[str, Any]]:
    from app.providers.messaging import DEV_WHATSAPP_OUTBOX

    return [m for m in DEV_WHATSAPP_OUTBOX if m["to"].lstrip("+") == number.lstrip("+")]


def test_whatsapp_prospect_gets_answers_and_callback_only_after_explicit_yes(client: Any, db: Any) -> None:
    from app.modules.assistant.models import AssistantConversation
    from app.modules.crm.models import Lead
    from app.providers.messaging import DEV_WHATSAPP_OUTBOX

    DEV_WHATSAPP_OUTBOX.clear()
    number = "237677450011"
    _wa(client, number, "Bonjour, je vis en France et je veux construire à Douala")
    replies = _sent_to(number)
    assert (replies and "diaspora" in replies[-1]["content"]["body"].lower()) or "distance" in replies[-1]["content"][
        "body"
    ]
    _wa(client, number, "Je veux parler à un conseiller")
    assert "Répondez *OUI*" in _sent_to(number)[-1]["content"]["body"]
    assert db.execute(select(Lead).where(Lead.source == "whatsapp")).first() is None, "pas de lead sans « oui »"
    _wa(client, number, "Oui")
    lead = db.execute(select(Lead).where(Lead.source == "whatsapp")).scalar_one()
    assert lead.first_name == "Jean" and lead.whatsapp_consent and lead.phone == "+237677450011"
    assert "Conversation" in lead.message and lead.number in _sent_to(number)[-1]["content"]["body"]
    conversation = db.execute(
        select(AssistantConversation).where(AssistantConversation.channel == "whatsapp")
    ).scalar_one()
    assert conversation.status == "lead" and conversation.contact_phone == "+237677450011"
    assert conversation.contact_hash and "237677450011" not in conversation.contact_hash


def test_whatsapp_client_progress_pay_link_receipt_handoff_and_agent_takeover(client: Any, db: Any) -> None:
    from app.modules.identity.models import User
    from app.providers.messaging import DEV_WHATSAPP_OUTBOX

    DEV_WHATSAPP_OUTBOX.clear()
    env = _setup(client, db)
    customer = db.get(User, env["customer"].id)
    customer.whatsapp = "+237677990011"
    db.commit()
    call = client.post(
        f"{API}/funds-calls",
        headers=env["fh"],
        json={
            "project_id": env["project"]["id"],
            "label": "Acompte toiture",
            "amount": 1200000,
            "due_date": (date.today() + timedelta(days=7)).isoformat(),
        },
    ).json()
    assert client.post(f"{API}/funds-calls/{call['id']}/issue", headers=env["fh"], json={}).status_code == 200
    drain_outbox()
    DEV_WHATSAPP_OUTBOX.clear()  # notifications d'appel de fonds déjà parties : on ne garde que la conversation

    number = "237677990011"
    _wa(client, number, "Bonjour")
    assert (
        "1️⃣" in _sent_to(number)[-1]["content"]["body"]
        and env["project"]["name"] in _sent_to(number)[-1]["content"]["body"]
    )
    _wa(client, number, "1")
    progress = _sent_to(number)[-1]["content"]["body"]
    assert "Avancement global" in progress and "/espace-client/dashboard" in progress
    _wa(client, number, "2")
    dues = _sent_to(number)[-1]["content"]["body"]
    assert call["number"] in dues and "/payer/" in dues and "1 200 000 FCFA" in dues
    _wa(client, number, "3")
    assert "Aucun reçu" in _sent_to(number)[-1]["content"]["body"]
    _wa(client, number, "Je voudrais parler à mon chef de projet")
    handoff = _events(db, "assistant.handoff")[-1].payload
    assert handoff["reason"] == "conseiller" and handoff["project_name"] == env["project"]["name"]
    assert handoff["phone"].endswith("011") and "•" in handoff["phone"]

    # Boîte de réception : un commercial reprend la main, l'assistant se tait
    _sales, sh = as_role(client, db, "COMMERCIAL")
    inbox = client.get(f"{API}/assistant/conversations?channel=whatsapp", headers=sh)
    assert inbox.status_code == 200, inbox.text
    conv = inbox.json()[0]
    assert conv["status"] == "handoff" and "•" in conv["contact_phone"]
    detail = client.get(f"{API}/assistant/conversations/{conv['id']}", headers=sh).json()
    assert detail["contact_phone"] == "+237677990011" and len(detail["messages"]) >= 10
    answer = client.post(
        f"{API}/assistant/conversations/{conv['id']}/reply",
        headers=sh,
        json={"message": "Bonjour, je vous appelle à 15 h."},
    )
    assert answer.status_code == 200 and answer.json()["mode"] == "human", answer.text
    assert _sent_to(number)[-1]["content"]["body"] == "Bonjour, je vous appelle à 15 h."
    count = len(_sent_to(number))
    _wa(client, number, "Merci, à tout à l'heure")
    assert len(_sent_to(number)) == count, "reprise humaine : pas de réponse automatique"
    assert _events(db, "assistant.message")[-1].payload["excerpt"] == "Merci, à tout à l'heure"
    released = client.post(f"{API}/assistant/conversations/{conv['id']}/release", headers=sh)
    assert released.json()["human_until"] is None
    _viewer, vh = as_role(client, db, "CHEF_CHANTIER")
    assert (
        client.post(f"{API}/assistant/conversations/{conv['id']}/reply", headers=vh, json={"message": "x"}).status_code
        == 403
    )


def test_agent_reply_refused_outside_whatsapp_window(client: Any, db: Any) -> None:
    from app.modules.assistant.models import AssistantConversation

    _wa(client, "237699000777", "Bonjour")
    conversation = (
        db.execute(select(AssistantConversation).where(AssistantConversation.channel == "whatsapp")).scalars().first()
    )
    old = (datetime.now(UTC) - timedelta(hours=30)).isoformat()
    conversation.messages = [{**m, "at": old} for m in conversation.messages]
    db.commit()
    _sales, sh = as_role(client, db, "COMMERCIAL")
    late = client.post(
        f"{API}/assistant/conversations/{conversation.id}/reply", headers=sh, json={"message": "Bonjour !"}
    )
    assert late.status_code == 422 and late.json()["error"]["code"] == "WHATSAPP_WINDOW_CLOSED"


# ============================================================================ A2 — devis instantané par IA
def test_instant_estimate_vision_merge_adjustment_lead_and_engineer_validation(
    client: Any, db: Any, monkeypatch: Any
) -> None:
    from app.modules.ai import service as ai_service
    from app.modules.ai.models import AIRequest
    from app.modules.crm.models import Lead, ProjectBrief
    from app.modules.system.models import Setting

    db.add(
        Setting(
            key="estimator",
            value={"rates": {"HOME": {"standard": 250000}}, "margin_pct": 15, "adjustments": {"slope_strong": 8}},
        )
    )
    db.commit()
    seen: dict[str, Any] = {}

    def fake_json(feature: str, *, system: str, prompt: str, schema: dict, effort: str = "low", attachments=None):
        seen.update(feature=feature, attachments=len(attachments or []), prompt=prompt)
        data = {
            "project_type": "villa",
            "surface_m2": 150,
            "levels": 2,
            "rooms": 6,
            "standing": "standard",
            "slope": "forte",
            "access": "facile",
            "observations": ["Terrain en pente vers la rue", "Croquis : séjour double hauteur"],
            "assumptions": ["Fondations superficielles"],
            "to_verify": ["Étude de sol"],
            "confidence": "moyenne",
        }
        return data, None, None

    monkeypatch.setattr(ai_service, "_json", fake_json)
    resp = client.post(
        f"{API}/public/instant-estimate",
        data={
            "first_name": "Aïcha",
            "last_name": "Ngo",
            "email": "aicha@example.com",
            "consent_contact": "true",
            "universe": "HOME",
            "levels": "2",
            "description": "Villa familiale avec 4 chambres, terrain à Logbessou.",
            "transcript": "Je voudrais une grande terrasse.",
            "rendered_at": str(int(time.time()) - 60),
        },
        files=[
            ("images", ("terrain.jpg", _jpeg((120, 160, 90)), "image/jpeg")),
            ("images", ("croquis.png", _jpeg((240, 240, 240)), "image/jpeg")),
        ],
    )
    assert resp.status_code == 201, resp.text
    result = resp.json()
    assert seen["feature"] == "instant_estimate" and seen["attachments"] == 2 and "terrasse" in seen["prompt"]
    # 150 m² (déduit) × 250 000 × (1 + 8 % par niveau supplémentaire) = 40,5 M ± 15 %, puis +8 % (forte pente)
    assert Decimal(result["estimate"]["min"]) == Decimal("37179000.00")
    assert Decimal(result["estimate"]["max"]) == Decimal("50301000.00")
    assert result["parameters"]["surface_m2"] == 150 and result["parameters"]["levels"] == 2
    assert "Étude de sol" in result["to_verify"] and result["estimate"]["adjustments"]
    lead = db.execute(select(Lead).where(Lead.number == result["reference"])).scalar_one()
    brief = db.execute(select(ProjectBrief).where(ProjectBrief.lead_id == lead.id)).scalar_one()
    assert lead.source == "instant_estimate" and len(brief.file_ids) == 2
    assert brief.answers["instant_estimate"]["validated"] is False
    assert (
        db.execute(select(AIRequest).where(AIRequest.feature == "instant_estimate")).scalar_one().validation_status
        == "pending"
    )

    no_files = client.post(
        f"{API}/public/instant-estimate",
        data={
            "first_name": "X",
            "email": "x@example.com",
            "consent_contact": "true",
            "rendered_at": str(int(time.time()) - 60),
        },
    )
    assert no_files.status_code == 422

    _sales, sh = as_role(client, db, "COMMERCIAL")
    detail = client.get(f"{API}/crm/leads/{lead.id}/instant-estimate", headers=sh)
    assert detail.status_code == 200 and len(detail.json()["files"]) == 2
    validated = client.post(
        f"{API}/crm/leads/{lead.id}/instant-estimate/validate",
        headers=sh,
        json={"min": "39000000", "max": "47000000", "note": "Prévoir un mur de soutènement."},
    )
    assert validated.status_code == 200, validated.text
    db.refresh(brief)
    assert brief.estimate_min == Decimal("39000000.00") and brief.answers["instant_estimate"]["validated"] is True
    sends = [
        e for e in _events(db, "notification.dispatch") if e.payload.get("email_template") == "lead.estimate_validated"
    ]
    assert sends and "39 000 000 FCFA" in sends[-1].payload["context"]["range"]


def test_instant_estimate_without_ai_uses_declared_values(client: Any, db: Any) -> None:
    from app.modules.system.models import Setting

    db.add(Setting(key="estimator", value={"rates": {"HOME": {"confort": 300000}}, "margin_pct": 10}))
    db.commit()
    resp = client.post(
        f"{API}/public/instant-estimate",
        data={
            "first_name": "Paul",
            "phone": "+237655000123",
            "consent_contact": "true",
            "universe": "HOME",
            "surface_m2": "100",
            "levels": "1",
            "standing": "confort",
            "description": "Maison de plain-pied",
            "rendered_at": str(int(time.time()) - 60),
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["ai_used"] is False and Decimal(data["estimate"]["min"]) == Decimal("27000000.00")


# ============================================================================ R2 — time-lapse et caméras
def test_weekly_timelapse_from_published_photos_and_camera_ingestion(client: Any, db: Any) -> None:
    from app.modules.identity.models import User
    from app.modules.projects.models import SiteMedia
    from app.modules.timelapse.service import last_week
    from app.providers.messaging import DEV_WHATSAPP_OUTBOX

    DEV_WHATSAPP_OUTBOX.clear()
    env = _setup(client, db)
    pid = env["project"]["id"]
    customer = db.get(User, env["customer"].id)
    customer.whatsapp = "+237677330022"
    db.commit()
    start, _end = last_week()
    for i in range(5):
        taken = datetime.combine(start + timedelta(days=i), datetime.min.time(), tzinfo=UTC) + timedelta(hours=10)
        up = client.post(
            f"{API}/projects/{pid}/media",
            headers=env["ah"],
            files={"file": (f"j{i}.jpg", _jpeg((30 * i, 120, 200 - 20 * i)), "image/jpeg")},
            data={"publish": "true", "taken_at": taken.isoformat()},
        )
        assert up.status_code == 201, up.text
    client.post(
        f"{API}/projects/{pid}/media",
        headers=env["ah"],
        files={"file": ("interne.jpg", _jpeg((0, 0, 0)), "image/jpeg")},
        data={"publish": "false", "taken_at": (datetime.combine(start, datetime.min.time(), tzinfo=UTC)).isoformat()},
    )
    made = client.post(f"{API}/projects/{pid}/timelapses", headers=env["cph"], json={"send": True})
    assert made.status_code == 201, made.text
    timelapse = made.json()
    assert timelapse["status"] == "ready" and timelapse["frames"] == 5, "photo interne non publiée exclue"
    assert timelapse["source"] == "photos" and timelapse["video_url"] and timelapse["poster_url"]
    video = client.get(timelapse["video_url"])
    assert video.status_code == 200 and video.content[4:8] == b"ftyp"
    mine = client.get(f"{API}/client/projects/{pid}/timelapses", headers=env["custh"]).json()
    assert [t["id"] for t in mine] == [timelapse["id"]]
    assert _events(db, "timelapse.ready")[-1].payload["frames"] == 5
    template = [m for m in DEV_WHATSAPP_OUTBOX if m["kind"] == "template"][-1]
    assert template["content"]["name"] == "globus_timelapse_hebdo" and template["content"]["video"]["link"].startswith(
        "http"
    )

    empty = client.post(
        f"{API}/projects/{pid}/timelapses",
        headers=env["cph"],
        json={"period_end": (start - timedelta(days=30)).isoformat()},
    )
    assert empty.status_code == 422 and empty.json()["error"]["code"] == "NOT_ENOUGH_FRAMES"

    camera = client.post(f"{API}/projects/{pid}/cameras", headers=env["cph"], json={"name": "Mât nord"})
    assert camera.status_code == 201, camera.text
    token = camera.json()["token"]
    assert "token" not in client.get(f"{API}/projects/{pid}/cameras", headers=env["cph"]).json()[0]
    snap = client.post(
        f"{API}/devices/cameras/snapshots",
        headers={"X-Camera-Token": token},
        files={"file": ("cam.jpg", _jpeg((90, 90, 90)), "image/jpeg")},
    )
    assert snap.status_code == 201, snap.text
    media = db.get(SiteMedia, uuid.UUID(snap.json()["id"]))
    assert "camera" in media.tags and media.published_to_client is False
    bad = client.post(
        f"{API}/devices/cameras/snapshots",
        headers={"X-Camera-Token": "cam_faux"},
        files={"file": ("c.jpg", _jpeg((1, 1, 1)), "image/jpeg")},
    )
    assert bad.status_code == 401
    client.delete(f"{API}/cameras/{camera.json()['id']}", headers=env["cph"])
    revoked = client.post(
        f"{API}/devices/cameras/snapshots",
        headers={"X-Camera-Token": token},
        files={"file": ("c.jpg", _jpeg((1, 1, 1)), "image/jpeg")},
    )
    assert revoked.status_code == 401


# ============================================================================ A3 — achats prédictifs
def test_price_index_trend_and_early_purchase_recommendation(client: Any, db: Any) -> None:
    from app.modules.market.models import PriceObservation
    from app.modules.market.service import DEFAULT_BASKET, classify, daily_job
    from app.modules.procurement.models import PurchaseOrder, PurchaseOrderLine, PurchaseRequest, PurchaseRequestLine
    from app.modules.suppliers.models import Supplier

    assert classify(DEFAULT_BASKET, "Ciment CPJ 42.5 (sac 50 kg)", "sacs")[0]["key"] == "ciment"
    family, factor = classify(DEFAULT_BASKET, "Ciment en vrac", "tonne")
    assert family["key"] == "ciment" and factor == Decimal("0.05")
    assert classify(DEFAULT_BASKET, "Fer HA10 barre 12m", "barre")[0]["key"] == "fer_ha10"
    assert classify(DEFAULT_BASKET, "Peinture glycéro", "l") is None

    env = _setup(client, db)
    pid = uuid.UUID(env["project"]["id"])
    supplier = Supplier(code=f"F-{uuid.uuid4().hex[:6]}", legal_name="Cimenterie du Littoral")
    db.add(supplier)
    db.flush()
    today = date.today()
    for week in range(10, 0, -1):  # hausse régulière : 5 000 → 5 900 FCFA le sac
        sent = datetime.combine(today - timedelta(weeks=week), datetime.min.time(), tzinfo=UTC)
        po = PurchaseOrder(
            number=f"BC-P-{uuid.uuid4().hex[:6]}",
            project_id=pid,
            supplier_id=supplier.id,
            status="received",
            sent_at=sent,
        )
        unit, price = (
            ("t", Decimal(5000 + 100 * (10 - week)) * 20) if week == 5 else ("sac", Decimal(5000 + 100 * (10 - week)))
        )
        po.lines.append(
            PurchaseOrderLine(description="Ciment CPJ 42.5", quantity=Decimal("50"), unit=unit, unit_price=price)
        )
        db.add(po)
    request = PurchaseRequest(number=f"DA-P-{uuid.uuid4().hex[:6]}", project_id=pid, status="approved")
    request.lines.append(PurchaseRequestLine(description="Ciment pour dalle R+1", quantity=Decimal("300"), unit="sac"))
    db.add(request)
    db.commit()

    result = daily_job(db)
    db.commit()
    assert result["items"] == 10 and result["recommendations"] == 1
    converted = db.execute(select(PriceObservation).where(PriceObservation.raw_unit == "t")).scalar_one()
    assert converted.unit == "sac" and converted.unit_price == Decimal("5500.0000")
    assert daily_job(db)["items"] == 0, "collecte idempotente"

    _buyer, bh = as_role(client, db, "ACHETEUR")
    index = {f["key"]: f for f in client.get(f"{API}/market/index", headers=bh).json()}
    cement = index["ciment"]
    assert cement["current"] == 5900.0 and cement["series"][0]["index"] == 100.0
    assert cement["trend_4w_pct"] > 0 and cement["forecast_pct"] > 3
    recs = client.get(f"{API}/market/recommendations", headers=bh).json()
    assert len(recs) == 1 and recs[0]["family"] == "ciment" and Decimal(recs[0]["quantity"]) == Decimal("300")
    assert Decimal(recs[0]["expected_saving"]) > 0 and recs[0]["requests"][0]["number"] == request.number
    assert _events(db, "procurement.price_alert")[-1].payload["family"] == "Ciment (sac de 50 kg)"
    no_reason = client.post(f"{API}/market/recommendations/{recs[0]['id']}/dismiss", headers=bh, json={})
    assert no_reason.status_code == 422
    accepted = client.post(
        f"{API}/market/recommendations/{recs[0]['id']}/accept", headers=bh, json={"note": "Commande groupée"}
    )
    assert accepted.status_code == 200 and accepted.json()["status"] == "accepted"


# ============================================================================ A4 — planning intelligent
def test_schedule_risks_weather_supply_absence_dependency_and_cascade(client: Any, db: Any, monkeypatch: Any) -> None:
    from app.core.config import settings
    from app.modules.hr.models import Employee, LeaveRequest
    from app.modules.procurement.models import PurchaseOrder
    from app.modules.projects.models import Milestone, Project, Task, TaskAssignment, TaskDependency
    from app.modules.scheduling.service import scan_project
    from app.modules.suppliers.models import Supplier
    from app.providers import weather

    today = date.today()
    rainy = {today + timedelta(days=d) for d in range(2, 7)}

    class _Resp:
        status_code = 200

        @staticmethod
        def json() -> dict[str, Any]:
            days = [today + timedelta(days=i) for i in range(14)]
            return {
                "daily": {
                    "time": [d.isoformat() for d in days],
                    "precipitation_sum": [25.0 if d in rainy else 0.5 for d in days],
                    "precipitation_probability_max": [90 if d in rainy else 10 for d in days],
                }
            }

    monkeypatch.setattr(settings, "WEATHER_PROVIDER", "open-meteo")
    monkeypatch.setattr(weather.httpx, "get", lambda *a, **k: _Resp())

    env = _setup(client, db)
    project = db.get(Project, uuid.UUID(env["project"]["id"]))
    project.city, project.latitude, project.longitude = "Douala", 4.05, 9.7
    milestone = Milestone(project_id=project.id, name="Hors d'eau", due_date=today + timedelta(days=12))
    db.add(milestone)
    db.flush()
    slab = Task(
        project_id=project.id,
        title="Coulage dalle haute RDC",
        start_planned=today + timedelta(days=3),
        end_planned=today + timedelta(days=5),
        duration_days=3,
    )
    roof = Task(
        project_id=project.id,
        title="Charpente et couverture",
        start_planned=today + timedelta(days=6),
        end_planned=today + timedelta(days=10),
        duration_days=5,
        milestone_id=milestone.id,
    )
    tiling = Task(
        project_id=project.id,
        title="Carrelage intérieur",
        start_planned=today + timedelta(days=1),
        end_planned=today + timedelta(days=2),
        duration_days=2,
    )
    plaster = Task(
        project_id=project.id,
        title="Plâtrerie intérieure",
        start_planned=today - timedelta(days=6),
        end_planned=today - timedelta(days=1),
        duration_days=6,
        status="in_progress",
        progress_pct=Decimal("50"),
    )
    db.add_all([slab, roof, tiling, plaster])
    db.flush()
    db.add_all(
        [
            TaskDependency(project_id=project.id, predecessor_id=slab.id, successor_id=roof.id),
            TaskDependency(project_id=project.id, predecessor_id=plaster.id, successor_id=tiling.id),
        ]
    )
    supplier = Supplier(code=f"F-{uuid.uuid4().hex[:6]}", legal_name="Bois du Moungo")
    db.add(supplier)
    db.flush()
    db.add(
        PurchaseOrder(
            number=f"BC-S-{uuid.uuid4().hex[:6]}",
            project_id=project.id,
            supplier_id=supplier.id,
            status="confirmed",
            expected_date=today + timedelta(days=9),
        )
    )
    worker = make_user(db, roles=["CHEF_CHANTIER"])
    employee = Employee(
        matricule=f"M-{uuid.uuid4().hex[:5]}",
        user_id=worker.id,
        first_name="Eric",
        last_name="Tchoua",
        job_title="Carreleur",
        trade="carrelage",
        hire_date=today - timedelta(days=400),
        badge_token=uuid.uuid4().hex,
    )
    db.add(employee)
    db.flush()
    tiling.assignments.append(TaskAssignment(user_id=worker.id))
    db.add(
        LeaveRequest(
            employee_id=employee.id,
            start_date=today + timedelta(days=1),
            end_date=today + timedelta(days=3),
            status="approved",
        )
    )
    db.commit()

    summary = scan_project(db, project)
    db.commit()
    assert summary["created"] >= 4
    risks = {r["kind"]: r for r in client.get(f"{API}/projects/{project.id}/schedule-risks", headers=env["cph"]).json()}
    assert {"weather", "supply", "absence", "dependency"} <= set(risks)
    weather_risk = risks["weather"]
    assert weather_risk["task_title"] == "Coulage dalle haute RDC" and weather_risk["severity"] == "high"
    assert weather_risk["suggestion"]["new_start"] == (today + timedelta(days=7)).isoformat()
    assert risks["supply"]["suggestion"]["new_start"] == (today + timedelta(days=10)).isoformat()
    assert risks["dependency"]["task_title"] == "Carrelage intérieur"
    # plâtrerie à 50 % : 3 jours restants → fin estimée J+2, carrelage au plus tôt J+3
    assert risks["dependency"]["suggestion"]["new_start"] == (today + timedelta(days=3)).isoformat()
    assert _events(db, "planning.risk_detected")[-1].payload["count"] >= 4

    applied = client.post(
        f"{API}/schedule-risks/{weather_risk['id']}/apply", headers=env["cph"], json={"note": "Pluies"}
    )
    assert applied.status_code == 200, applied.text
    body = applied.json()
    moved = {m["title"]: m for m in body["moved"]}
    assert moved["Coulage dalle haute RDC"]["start"] == (today + timedelta(days=7)).isoformat()
    assert moved["Charpente et couverture"]["start"] == (today + timedelta(days=10)).isoformat(), "successeur décalé"
    assert body["milestones"][0]["milestone"] == "Hors d'eau" and "Hors d'eau" in body["client_message"]
    again = client.post(f"{API}/schedule-risks/{weather_risk['id']}/apply", headers=env["cph"], json={})
    assert again.status_code == 422
    notice = client.post(
        f"{API}/schedule-risks/{weather_risk['id']}/notify-client",
        headers=env["cph"],
        json={"message": body["client_message"]},
    )
    assert (
        notice.status_code == 200
        and _events(db, "planning.client_notice")[-1].payload["message"] == body["client_message"]
    )
    no_note = client.post(f"{API}/schedule-risks/{risks['absence']['id']}/dismiss", headers=env["cph"], json={})
    assert no_note.status_code == 422
    dismissed = client.post(
        f"{API}/schedule-risks/{risks['absence']['id']}/dismiss", headers=env["cph"], json={"note": "Remplacé par Paul"}
    )
    assert dismissed.json()["status"] == "dismissed"
    scan_project(db, project)  # un risque écarté n'est pas rouvert
    db.commit()
    assert all(
        r["kind"] != "absence"
        for r in client.get(f"{API}/projects/{project.id}/schedule-risks", headers=env["cph"]).json()
    )


# ============================================================================ R5 — visites immersives partagées
def test_immersive_share_pin_views_expiry_and_revocation(client: Any, db: Any) -> None:
    from app.core.files import store_private, validate_upload
    from app.modules.projects.models import ImmersiveContent

    env = _setup(client, db)
    pid = uuid.UUID(env["project"]["id"])
    upload = validate_upload("panorama.jpg", _jpeg((10, 140, 220), (800, 400)), category="image")
    stored = store_private(db, upload, purpose="immersive", classification="internal")
    pano = ImmersiveContent(
        project_id=pid, kind="photo_360", title="Séjour — vue 360°", file_id=stored.id, published_to_client=True
    )
    hidden = ImmersiveContent(
        project_id=pid, kind="photo_360", title="Interne", file_id=stored.id, published_to_client=False
    )
    db.add_all([pano, hidden])
    db.commit()

    refused = client.post(
        f"{API}/client/projects/{pid}/visits", headers=env["custh"], json={"content_id": str(hidden.id)}
    )
    assert refused.status_code == 404, "contenu non publié : non partageable par le client"
    created = client.post(
        f"{API}/client/projects/{pid}/visits",
        headers=env["custh"],
        json={"content_id": str(pano.id), "days": 7, "pin": "2468", "max_views": 3, "message": "Bienvenue chez nous !"},
    )
    assert created.status_code == 201, created.text
    token = created.json()["url"].rsplit("/", 1)[-1]
    assert "token" not in json.dumps(
        client.get(f"{API}/client/projects/{pid}/visits", headers=env["custh"]).json()
    ).lower().replace("token_hint", "")
    preview = client.get(f"{API}/public/visits/{token}").json()
    assert preview["requires_pin"] is True and preview["kind"] == "photo_360" and "url" not in preview
    wrong = client.post(f"{API}/public/visits/{token}/open", json={"pin": "0000"})
    assert wrong.status_code == 403
    opened = client.post(f"{API}/public/visits/{token}/open", json={"pin": "2468"})
    assert opened.status_code == 200, opened.text
    media = client.get(opened.json()["url"])
    assert media.status_code == 200 and media.content[:2] == b"\xff\xd8"
    client.post(f"{API}/public/visits/{token}/open", json={"pin": "2468"})
    client.post(f"{API}/public/visits/{token}/open", json={"pin": "2468"})
    assert client.get(f"{API}/public/visits/{token}").status_code == 404, "nombre de vues atteint"

    second = client.post(
        f"{API}/client/projects/{pid}/visits",
        headers=env["custh"],
        json={"content_id": str(pano.id), "days": 1, "pin": "1357"},
    ).json()
    token2 = second["url"].rsplit("/", 1)[-1]
    for _ in range(5):
        client.post(f"{API}/public/visits/{token2}/open", json={"pin": "9999"})
    locked = client.post(f"{API}/public/visits/{token2}/open", json={"pin": "1357"})
    assert locked.status_code == 423 and locked.json()["error"]["code"] == "VISIT_LOCKED"
    third = client.post(
        f"{API}/client/projects/{pid}/visits", headers=env["custh"], json={"content_id": str(pano.id), "days": 30}
    ).json()
    token3 = third["url"].rsplit("/", 1)[-1]
    assert client.post(f"{API}/public/visits/{token3}/open", json={}).status_code == 200
    stranger = client.post(f"{API}/visits/{third['id']}/revoke", headers=env["strh"])
    assert stranger.status_code in (403, 404)
    assert client.post(f"{API}/visits/{third['id']}/revoke", headers=env["custh"]).status_code == 200
    assert client.get(f"{API}/public/visits/{token3}").status_code == 404
    too_long = client.post(
        f"{API}/client/projects/{pid}/visits", headers=env["custh"], json={"content_id": str(pano.id), "days": 365}
    )
    assert too_long.status_code == 422
    assert login is not None
