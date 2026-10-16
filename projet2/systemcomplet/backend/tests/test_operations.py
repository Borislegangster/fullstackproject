"""Lot 3 opérations : RH (pointage QR géolocalisé hors ligne, paie, bulletins), QHSE (inspection → action
corrective → incident → clôture vérifiée), matériel (affectation, coût d'utilisation, maintenance, incident)."""

from __future__ import annotations

import io
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from PIL import Image
from sqlalchemy import select

from tests.conftest import as_role, drain_outbox, login, make_user

API = "/api/v1"


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), (56, 90, 166)).save(buf, format="PNG")
    return buf.getvalue()


def _project_with_site(
    client: Any, db: Any, ah: dict[str, str], chef_chantier: Any
) -> tuple[dict[str, Any], dict[str, Any]]:
    project = client.post(
        f"{API}/projects", headers=ah, json={"name": "Villa Kribi", "city": "Kribi", "status": "execution"}
    ).json()
    site = client.post(
        f"{API}/sites",
        headers=ah,
        json={
            "project_id": project["id"],
            "code": f"CH-{uuid.uuid4().hex[:6]}",
            "name": "Chantier Kribi",
            "latitude": 2.9500,
            "longitude": 9.9100,
            "geofence_radius_m": 300,
            "site_manager_id": str(chef_chantier.id),
        },
    ).json()
    client.post(
        f"{API}/projects/{project['id']}/members",
        headers=ah,
        json={"user_id": str(chef_chantier.id), "project_role": "chef_chantier"},
    )
    return project, site


def test_hr_attendance_and_payroll(client: Any, db: Any) -> None:
    from app.modules.finance.models import Expense
    from app.modules.hr.models import Attendance, HRDocument

    admin = make_user(db, email=f"admin-hr-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    chef_chantier, cch = as_role(client, db, "CHEF_CHANTIER")
    _rh, rh = as_role(client, db, "RH")
    _finance, fh = as_role(client, db, "FINANCE")
    project, site = _project_with_site(client, db, ah, chef_chantier)

    worker = client.post(
        f"{API}/hr/employees",
        headers=rh,
        json={
            "first_name": "Ali",
            "last_name": "Moussa",
            "job_title": "Maçon",
            "trade": "maconnerie",
            "contract_type": "journalier",
            "pay_frequency": "daily",
            "daily_rate": 5000,
            "hire_date": "2026-01-05",
            "national_id": "CNI-123456789",
            "current_project_id": project["id"],
        },
    )
    assert worker.status_code == 201, worker.text
    worker = worker.json()
    assert "national_id" not in worker and worker["national_id_masked"].endswith("6789")
    clerk_user = make_user(db, roles=["TECHNICIEN"])
    clerk = client.post(
        f"{API}/hr/employees",
        headers=rh,
        json={
            "first_name": "Marie",
            "last_name": "Ngo",
            "job_title": "Assistante administrative",
            "base_salary": 250000,
            "hire_date": "2025-03-01",
            "user_id": str(clerk_user.id),
        },
    ).json()

    badge = client.get(f"{API}/hr/employees/{worker['id']}/badge", headers=rh)
    assert badge.status_code == 200 and badge.headers["content-type"] == "image/png"
    from app.modules.hr.models import Employee

    token = db.get(Employee, uuid.UUID(worker["id"])).badge_token

    # Pointage QR par le chef de chantier : arrivée 07:20, départ 17:20 (heure de Douala) — idempotent hors ligne
    scan_in = {
        "badge": f"GLOBUS:EMP:{token}",
        "site_id": site["id"],
        "latitude": 2.9501,
        "longitude": 9.9102,
        "at": datetime(2026, 9, 15, 6, 20, tzinfo=UTC).isoformat(),
        "client_mutation_id": "offline-in-1",
    }
    first = client.post(f"{API}/hr/attendance/scan", headers=cch, json=scan_in)
    assert first.status_code == 200, first.text
    assert first.json()["scan"] == "in" and first.json()["inside_geofence"] is True
    replay = client.post(f"{API}/hr/attendance/scan", headers=cch, json=scan_in)
    assert replay.json()["scan"] == "replay" and replay.json()["id"] == first.json()["id"]
    out = client.post(
        f"{API}/hr/attendance/scan",
        headers=cch,
        json={
            **scan_in,
            "at": datetime(2026, 9, 15, 16, 20, tzinfo=UTC).isoformat(),
            "client_mutation_id": "offline-out-1",
            "latitude": 4.05,
            "longitude": 9.70,
        },
    )
    assert out.json()["scan"] == "out"
    assert Decimal(out.json()["hours_worked"]) == Decimal("9.00") and Decimal(out.json()["overtime_hours"]) == Decimal(
        "1.00"
    )
    assert out.json()["inside_geofence"] is False, "départ hors périmètre du chantier signalé"
    assert (
        db.execute(select(Attendance).where(Attendance.employee_id == uuid.UUID(worker["id"])))
        .scalars()
        .all()
        .__len__()
        == 1
    )
    foreign = client.post(f"{API}/hr/attendance/scan", headers=cch, json={"badge": "GLOBUS:EMP:inconnu-123456"})
    assert foreign.status_code == 404

    # Paie : RH calcule, la finance valide (paramètres revus obligatoires), bulletins chiffrés, coût projet
    run = client.post(f"{API}/hr/payroll-runs", headers=rh, json={"period": "2026-09"})
    assert run.status_code == 201, run.text
    run = run.json()
    items = {i["matricule"]: i for i in run["items"]}
    daily = items[worker["matricule"]]
    assert Decimal(daily["gross"]) == Decimal("5750.00")
    assert daily["deduction_details"] == {"CNPS_PVID": "241.50", "CFC": "57.50"}
    assert Decimal(daily["net"]) == Decimal("5451.00")
    monthly = items[clerk["matricule"]]
    assert Decimal(monthly["gross"]) == Decimal("250000.00")
    assert monthly["deduction_details"]["IRPP"] == "12283.33" and monthly["deduction_details"]["RAV"] == "3250"
    assert Decimal(monthly["net"]) == Decimal("218738.34")
    assert client.post(f"{API}/hr/payroll-runs/{run['id']}/validate", headers=rh).status_code == 403
    blocked = client.post(f"{API}/hr/payroll-runs/{run['id']}/validate", headers=fh)
    assert blocked.json()["error"]["code"] == "PAYROLL_PARAMETERS_NOT_REVIEWED"
    params = client.get(f"{API}/hr/payroll-parameters", headers=rh).json()
    reviewed = client.put(
        f"{API}/hr/payroll-parameters",
        headers=ah,
        json={"parameters": params, "reviewed": True, "reviewer_note": "Revu par le cabinet"},
    )
    assert reviewed.status_code == 200
    client.post(f"{API}/hr/payroll-runs/{run['id']}/compute", headers=rh)
    validated = client.post(f"{API}/hr/payroll-runs/{run['id']}/validate", headers=fh)
    assert validated.status_code == 200, validated.text
    assert validated.json()["status"] == "validated"
    assert db.execute(select(HRDocument).where(HRDocument.kind == "fiche_paie")).scalars().all().__len__() == 2
    labour = (
        db.execute(
            select(Expense).where(Expense.project_id == uuid.UUID(project["id"]), Expense.category == "main_oeuvre")
        )
        .scalars()
        .all()
    )
    assert len(labour) == 1 and labour[0].amount > Decimal("5750")
    csv = client.get(f"{API}/hr/payroll-runs/{run['id']}/export.csv", headers=rh)
    assert csv.status_code == 200 and worker["matricule"] in csv.text

    # Espace salarié : bulletin consultable par l'intéressé uniquement
    clerk_headers = login(client, clerk_user.email)
    me = client.get(f"{API}/hr/me", headers=clerk_headers).json()
    assert me["employee"]["matricule"] == clerk["matricule"] and len(me["payslips"]) == 1
    payslip = client.get(f"{API}/hr/documents/{me['payslips'][0]['id']}/file", headers=clerk_headers)
    assert payslip.status_code == 200 and payslip.content[:4] == b"%PDF"
    other_doc = db.execute(select(HRDocument).where(HRDocument.employee_id == uuid.UUID(worker["id"]))).scalar_one()
    assert client.get(f"{API}/hr/documents/{other_doc.id}/file", headers=clerk_headers).status_code == 403


def test_qhse_inspection_actions_incident(client: Any, db: Any) -> None:
    from app.modules.notifications.models import Notification
    from app.modules.qhse.models import InspectionTemplate

    admin = make_user(db, email=f"admin-q-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    chef_chantier, cch = as_role(client, db, "CHEF_CHANTIER")
    _qhse, qh = as_role(client, db, "QHSE")
    direction, _dh = as_role(client, db, "DIRECTION")
    project, site = _project_with_site(client, db, ah, chef_chantier)
    template = db.execute(
        select(InspectionTemplate).where(InspectionTemplate.name == "Inspection sécurité chantier")
    ).scalar_one()

    inspection = client.post(
        f"{API}/qhse/inspections",
        headers=qh,
        json={"template_id": str(template.id), "project_id": project["id"], "site_id": site["id"]},
    ).json()
    keys = [r["key"] for r in inspection["results"]]
    incomplete = client.post(
        f"{API}/qhse/inspections/{inspection['id']}/complete",
        headers=qh,
        json={"results": [{"key": keys[0], "status": "ok"}]},
    )
    assert incomplete.json()["error"]["code"] == "INSPECTION_INCOMPLETE"
    results = [
        {
            "key": k,
            "status": "nok" if k == "echafaudages" else "ok",
            "comment": "Garde-corps absent" if k == "echafaudages" else None,
        }
        for k in keys
    ]
    done = client.post(
        f"{API}/qhse/inspections/{inspection['id']}/complete", headers=qh, json={"results": results}
    ).json()
    assert done["status"] == "completed" and Decimal(done["score"]) == Decimal("81.25")
    actions = client.get(f"{API}/qhse/actions", headers=qh, params={"project_id": project["id"]}).json()["items"]
    assert len(actions) == 1 and actions[0]["responsible_id"] == str(chef_chantier.id)
    assert (
        client.post(f"{API}/qhse/inspections/{inspection['id']}/close", headers=qh).json()["error"]["code"]
        == "ACTIONS_PENDING"
    )

    # Incident critique déclaré du terrain (idempotent) → direction alertée
    photo = client.post(
        f"{API}/qhse/files",
        headers=cch,
        files={"file": ("chute.png", _png(), "image/png")},
        data={"latitude": "2.95", "longitude": "9.91"},
    ).json()
    key = {"Idempotency-Key": uuid.uuid4().hex}
    body = {
        "project_id": project["id"],
        "site_id": site["id"],
        "kind": "accident",
        "severity": "critical",
        "occurred_at": datetime.now(UTC).isoformat(),
        "title": "Chute de hauteur depuis l'échafaudage",
        "lost_time_days": 5,
        "photo_file_ids": [photo["file_id"]],
        "source": "mobile",
    }
    incident = client.post(f"{API}/qhse/incidents", headers={**cch, **key}, json=body)
    assert incident.status_code == 201, incident.text
    incident = incident.json()
    again = client.post(f"{API}/qhse/incidents", headers={**cch, **key}, json=body)
    assert again.json()["id"] == incident["id"]
    drain_outbox()
    assert (
        db.execute(
            select(Notification).where(
                Notification.user_id == direction.id, Notification.event_type == "incident.declared"
            )
        )
        .scalars()
        .first()
    )
    assert (
        client.post(f"{API}/qhse/incidents/{incident['id']}/close", headers=qh).json()["error"]["code"]
        == "ROOT_CAUSE_REQUIRED"
    )
    client.post(
        f"{API}/qhse/incidents/{incident['id']}/investigation",
        headers=qh,
        json={"root_cause": "Garde-corps démonté sans consignation", "lost_time_days": 5},
    )
    action = client.post(
        f"{API}/qhse/actions",
        headers=qh,
        json={
            "project_id": project["id"],
            "source_type": "incident",
            "source_id": incident["id"],
            "title": "Reposer les garde-corps et former l'équipe",
            "responsible_id": str(chef_chantier.id),
            "due_date": datetime.now(UTC).date().isoformat(),
        },
    ).json()
    assert client.get(f"{API}/qhse/incidents/{incident['id']}", headers=qh).json()["status"] == "action_plan"
    own = client.get(f"{API}/qhse/actions/{action['id']}", headers=cch)
    assert own.status_code == 200, own.text
    assert own.json()["source"] == {
        "type": "incident",
        "id": incident["id"],
        "number": incident["number"],
        "title": incident["title"],
    }

    # Réalisation avec preuve par le responsable, vérification par une autre personne, clôture
    evidence = client.post(f"{API}/qhse/files", headers=cch, files={"file": ("gc.png", _png(), "image/png")}).json()
    no_proof = client.post(
        f"{API}/qhse/actions/{action['id']}/complete", headers=cch, json={"note": "Fait", "evidence_file_ids": []}
    )
    assert no_proof.status_code == 422
    client.post(
        f"{API}/qhse/actions/{action['id']}/complete",
        headers=cch,
        json={"note": "Garde-corps reposés", "evidence_file_ids": [evidence["file_id"]]},
    )
    assert (
        client.post(f"{API}/qhse/actions/{action['id']}/verify", headers=qh, json={"accept": True}).json()["status"]
        == "verified"
    )
    assert client.post(f"{API}/qhse/incidents/{incident['id']}/close", headers=qh).json()["status"] == "closed"
    stats = client.get(f"{API}/qhse/statistics", headers=qh, params={"project_id": project["id"]}).json()
    assert stats["incidents"] == 1 and stats["lost_days"] == 5 and stats["inspections"] == 1
    assert stats["actions_open"] == 1 and stats["days_without_accident"] == 0


def test_equipment_lifecycle(client: Any, db: Any) -> None:
    from app.modules.finance.models import Expense
    from app.modules.system.models import OutboxEvent

    admin = make_user(db, email=f"admin-eq-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    chef_chantier, cch = as_role(client, db, "CHEF_CHANTIER")
    _mag, mh = as_role(client, db, "MAGASINIER")
    project, site = _project_with_site(client, db, ah, chef_chantier)

    engin = client.post(
        f"{API}/equipment",
        headers=mh,
        json={
            "name": "Mini-pelle 3,5 t",
            "category": "engin",
            "brand": "Kubota",
            "hourly_cost": 15000,
            "daily_cost": 120000,
            "insurance_until": "2027-12-31",
        },
    )
    assert engin.status_code == 201, engin.text
    engin = engin.json()
    assert "qr_token" not in engin
    plan = client.post(
        f"{API}/maintenance-plans",
        headers=mh,
        json={"equipment_id": engin["id"], "title": "Vidange et graissage", "interval_hours": 10},
    )
    assert plan.status_code == 201, plan.text
    assign = client.post(
        f"{API}/equipment/{engin['id']}/assign",
        headers=ah,
        json={"project_id": project["id"], "site_id": site["id"], "operator_id": str(chef_chantier.id)},
    )
    assert assign.status_code == 201, assign.text
    assert (
        client.post(f"{API}/equipment/{engin['id']}/assign", headers=ah, json={"project_id": project["id"]}).json()[
            "error"
        ]["code"]
        == "ALREADY_ASSIGNED"
    )

    usage = client.post(
        f"{API}/equipment/{engin['id']}/usage", headers=cch, json={"hours": 8, "fuel_liters": 40, "fuel_cost": 30000}
    )
    assert usage.status_code == 201, usage.text
    assert Decimal(usage.json()["cost"]) == Decimal("150000.00")
    client.post(f"{API}/equipment/{engin['id']}/usage", headers=cch, json={"hours": 6})
    expenses = (
        db.execute(
            select(Expense).where(Expense.project_id == uuid.UUID(project["id"]), Expense.category == "materiel")
        )
        .scalars()
        .all()
    )
    assert sum(e.amount for e in expenses) == Decimal("240000.00")
    assert (
        db.execute(
            select(OutboxEvent).where(
                OutboxEvent.event_type == "equipment.maintenance_due", OutboxEvent.aggregate_id == engin["id"]
            )
        )
        .scalars()
        .first()
    )

    order = client.post(
        f"{API}/equipment/{engin['id']}/maintenance-orders",
        headers=mh,
        json={"kind": "preventive", "plan_id": plan.json()["id"]},
    ).json()
    client.post(f"{API}/maintenance-orders/{order['id']}/start", headers=mh)
    assert client.get(f"{API}/equipment/{engin['id']}", headers=mh).json()["status"] == "maintenance"
    client.post(
        f"{API}/maintenance-orders/{order['id']}/complete",
        headers=mh,
        json={"cost": 45000, "downtime_hours": 3, "report": "Vidange moteur + filtres"},
    )
    detail = client.get(f"{API}/equipment/{engin['id']}", headers=mh).json()
    assert detail["status"] == "assigned" and Decimal(detail["maintenance_plans"][0]["last_done_hours"]) == Decimal(
        "14.0"
    )

    # Localisation refusée tant que la politique de suivi n'est pas activée
    loc = client.post(
        f"{API}/equipment/{engin['id']}/location", headers=cch, json={"latitude": 2.95, "longitude": 9.91}
    )
    assert loc.json()["error"]["code"] == "TRACKING_DISABLED"

    breakdown = client.post(
        f"{API}/equipment/{engin['id']}/incidents",
        headers=cch,
        json={
            "kind": "breakdown",
            "severity": "high",
            "occurred_at": datetime.now(UTC).isoformat(),
            "description": "Fuite hydraulique bras",
            "cost": 0,
        },
    )
    assert breakdown.status_code == 201
    detail = client.get(f"{API}/equipment/{engin['id']}", headers=mh).json()
    assert detail["status"] == "broken"
    assert any(o["kind"] == "corrective" and o["status"] == "planned" for o in detail["maintenance_orders"])
    report = client.get(f"{API}/equipment/{engin['id']}/costs", headers=mh).json()
    assert Decimal(report["usage_cost"]) == Decimal("240000.00") and Decimal(report["maintenance_cost"]) == Decimal(
        "45000.00"
    )
    returned = client.post(f"{API}/equipment/{engin['id']}/return", headers=ah, json={"condition": "fair"})
    assert returned.status_code == 200 and returned.json()["status"] == "returned"


def test_qhse_ppe_distribution_names(client: Any, db: Any) -> None:
    _qhse, qh = as_role(client, db, "QHSE")
    _rh, rh = as_role(client, db, "RH")
    employee = client.post(
        f"{API}/hr/employees",
        headers=rh,
        json={"first_name": "Paul", "last_name": "Essomba", "job_title": "Ferrailleur", "hire_date": "2026-02-01"},
    ).json()
    item = client.post(
        f"{API}/qhse/ppe-items",
        headers=qh,
        json={"name": "Casque de chantier", "kind": "casque", "size": "M", "lifespan_days": 365, "norm": "EN 397"},
    )
    assert item.status_code == 201, item.text
    given = client.post(
        f"{API}/qhse/ppe-distributions",
        headers=qh,
        json={"ppe_item_id": item.json()["id"], "employee_id": employee["id"], "quantity": 1},
    )
    assert given.status_code == 201, given.text
    rows = client.get(f"{API}/qhse/ppe-distributions", headers=qh, params={"employee_id": employee["id"]}).json()
    assert rows["items"][0]["ppe_item_name"] == "Casque de chantier (M)"
    assert rows["items"][0]["employee_name"] == "Paul Essomba"
    returned = client.post(f"{API}/qhse/ppe-distributions/{given.json()['id']}/return", headers=qh)
    assert returned.status_code == 200 and returned.json()["returned_at"]
