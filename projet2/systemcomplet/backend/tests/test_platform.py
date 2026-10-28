"""Plateforme : Hub BIM (V4-BIM-20/21/22/23), synchronisation hors ligne (V4-DATA-32/33), IA en mode règles,
administration (V4-SEC-02, maintenance, audit V4-AUDIT-34, sauvegarde / restauration V4-BACKUP-40/41), rapports,
agenda."""

from __future__ import annotations

import struct
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from tests.conftest import as_role, login, make_user

API = "/api/v1"


def _glb() -> bytes:
    """GLB minimal valide (en-tête glTF binaire + bloc JSON)."""
    payload = b'{"asset":{"version":"2.0"},"scenes":[{"nodes":[]}],"scene":0}'
    payload += b" " * ((4 - len(payload) % 4) % 4)
    chunk = struct.pack("<II", len(payload), 0x4E4F534A) + payload
    return struct.pack("<III", 0x46546C67, 2, 12 + len(chunk)) + chunk


def _project(client: Any, ah: dict[str, str], name: str = "Immeuble Akwa") -> dict[str, Any]:
    return client.post(f"{API}/projects", headers=ah, json={"name": name, "status": "execution"}).json()


def test_bim_hub_versions_annotations_issues_clashes(client: Any, db: Any) -> None:
    admin = make_user(db, email=f"admin-b-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    archi, arh = as_role(client, db, "ARCHITECTE")
    engineer, engh = as_role(client, db, "INGENIEUR")
    project = _project(client, ah)
    for user, role in ((archi, "architecte"), (engineer, "ingenieur")):
        client.post(
            f"{API}/projects/{project['id']}/members", headers=ah, json={"user_id": str(user.id), "project_role": role}
        )

    archi_model = client.post(
        f"{API}/projects/{project['id']}/bim/models",
        headers=arh,
        json={"name": "Architecture R+4", "discipline": "architecture"},
    ).json()
    struct_model = client.post(
        f"{API}/projects/{project['id']}/bim/models",
        headers=engh,
        json={"name": "Structure R+4", "discipline": "structure"},
    ).json()
    v1 = client.post(
        f"{API}/bim/models/{archi_model['id']}/versions",
        headers=arh,
        files={"file": ("archi.glb", _glb(), "model/gltf-binary")},
    )
    assert v1.status_code == 201, v1.text
    v1 = v1.json()
    assert v1["status"] == "ready" and v1["viewer"] == "three" and v1["number"] == 1
    no_reason = client.post(
        f"{API}/bim/models/{archi_model['id']}/versions",
        headers=arh,
        files={"file": ("archi2.glb", _glb() + b" " * 4, "model/gltf-binary")},
    )
    assert no_reason.json()["error"]["code"] == "REVISION_REASON_REQUIRED"
    sv = client.post(
        f"{API}/bim/models/{struct_model['id']}/versions",
        headers=engh,
        files={"file": ("structure.glb", _glb(), "model/gltf-binary")},
    ).json()
    federation = client.get(f"{API}/projects/{project['id']}/bim/federation", headers=arh).json()
    assert {m["discipline"] for m in federation["models"]} == {"architecture", "structure"}  # V4-BIM-20

    # Annotation ancrée à une version précise, concurrence optimiste (pas d'écrasement silencieux)
    ann = client.post(
        f"{API}/bim/versions/{v1['id']}/annotations",
        headers=arh,
        json={"kind": "pin", "geometry": {"position": [1, 2, 3], "db_id": 42}, "content": "Vérifier la trémie"},
    ).json()
    assert ann["version_id"] == v1["id"]  # V4-BIM-21
    ok = client.patch(
        f"{API}/bim/annotations/{ann['id']}",
        headers=arh,
        json={"expected_version": ann["version"], "content": "Trémie à élargir"},
    )
    assert ok.status_code == 200
    stale = client.patch(
        f"{API}/bim/annotations/{ann['id']}",
        headers=arh,
        json={"expected_version": ann["version"], "content": "Écrasement"},
    )
    assert stale.status_code == 409 and stale.json()["error"]["code"] == "VERSION_CONFLICT"

    # Issue assignée → résolue dans une nouvelle version → clôturée (V4-BIM-22)
    issue = client.post(
        f"{API}/projects/{project['id']}/bim/issues",
        headers=arh,
        json={
            "version_id": v1["id"],
            "title": "Poutre traversant la gaine technique",
            "priority": "high",
            "discipline": "structure",
            "assignee_id": str(engineer.id),
            "due_date": (date.today() + timedelta(days=5)).isoformat(),
        },
    ).json()
    assert issue["number"].startswith("ISS-")
    client.post(f"{API}/bim/issues/{issue['id']}/transition", headers=engh, json={"target": "in_progress"})
    v2 = client.post(
        f"{API}/bim/models/{archi_model['id']}/versions",
        headers=arh,
        data={"revision_reason": "Gaine déplacée"},
        files={"file": ("archi-v2.glb", _glb() + b"    ", "model/gltf-binary")},
    ).json()
    resolved = client.post(
        f"{API}/bim/issues/{issue['id']}/transition",
        headers=engh,
        json={"target": "resolved", "note": "Gaine décalée de 40 cm", "resolved_in_version_id": v2["id"]},
    )
    assert resolved.json()["status"] == "resolved"
    closed = client.post(f"{API}/bim/issues/{issue['id']}/transition", headers=arh, json={"target": "closed"})
    assert closed.json()["status"] == "closed"

    # Validation / publication : la version publiée précédente devient obsolète
    client.post(f"{API}/bim/versions/{v1['id']}/validate", headers=arh)
    client.post(f"{API}/bim/versions/{v1['id']}/publish", headers=arh, json={})
    client.post(f"{API}/bim/versions/{v2['id']}/validate", headers=arh)
    client.post(f"{API}/bim/versions/{v2['id']}/publish", headers=arh, json={})
    assert client.get(f"{API}/bim/versions/{v1['id']}", headers=arh).json()["status"] == "obsolete"

    # Conflits assistés (boîtes englobantes, tolérance) + récurrence
    rule = client.post(
        f"{API}/bim/clash-rules",
        headers=arh,
        json={
            "project_id": project["id"],
            "name": "Structure × architecture",
            "discipline_a": "structure",
            "discipline_b": "architecture",
            "clash_type": "hard",
            "tolerance_mm": 10,
            "severity": "high",
            "cost_per_clash": 250000,
        },
    )
    assert rule.status_code == 201, rule.text
    detection = client.post(
        f"{API}/projects/{project['id']}/bim/clash-detection",
        headers=arh,
        json={
            "rule_id": rule.json()["id"],
            "version_a_id": sv["id"],
            "version_b_id": v2["id"],
            "elements_a": [
                {"db_id": 1, "guid": "beam-1", "name": "Poutre P1", "bbox": [0, 0, 3, 5, 0.3, 3.5]},
                {"db_id": 2, "guid": "col-1", "name": "Poteau C1", "bbox": [10, 10, 0, 10.3, 10.3, 3]},
            ],
            "elements_b": [
                {"db_id": 7, "guid": "duct-1", "name": "Gaine G1", "bbox": [2, -0.2, 2.8, 2.5, 0.5, 3.6]},
                {"db_id": 8, "guid": "wall-9", "name": "Mur M9", "bbox": [20, 20, 0, 21, 20.2, 3]},
            ],
        },
    ).json()
    assert detection["created"] == 1
    clashes = client.get(f"{API}/projects/{project['id']}/bim/clashes", headers=arh).json()
    clash_issue = client.post(
        f"{API}/bim/clashes/{clashes[0]['id']}/issue", headers=arh, json={"assignee_id": str(engineer.id)}
    ).json()
    assert clash_issue["kind"] == "clash" and clash_issue["priority"] == "high"
    stats = client.get(f"{API}/projects/{project['id']}/bim/clash-stats", headers=arh).json()
    assert stats["total"] == 1 and stats["by_discipline_pair"] == {"architecture × structure": 1}

    # Temps réel : diffusion de l'annotation aux participants du salon bim:{version}
    ticket = client.post(f"{API}/auth/ws-ticket", headers=engh).json()["ticket"]
    with client.websocket_connect(f"/ws?ticket={ticket}") as ws:
        ws.receive_json()
        ws.send_json({"type": "join", "data": {"room": f"bim:{v2['id']}"}})
        assert ws.receive_json()["type"] == "joined"
        client.post(
            f"{API}/bim/versions/{v2['id']}/annotations",
            headers=arh,
            json={"kind": "text", "geometry": {"position": [0, 0, 0]}, "content": "Nouvelle réserve"},
        )
        event = ws.receive_json()
        while event["type"] == "bim.presence":
            event = ws.receive_json()
        assert event["type"] == "bim.annotation.created" and event["data"]["content"] == "Nouvelle réserve"  # V4-BIM-23


def test_offline_sync_conflicts_and_idempotence(client: Any, db: Any) -> None:
    admin = make_user(db, email=f"admin-s-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    chef, cch = as_role(client, db, "CHEF_CHANTIER")
    project = _project(client, ah, "Résidence Bali")
    client.post(
        f"{API}/projects/{project['id']}/members",
        headers=ah,
        json={"user_id": str(chef.id), "project_role": "chef_chantier"},
    )
    task = client.post(f"{API}/projects/{project['id']}/tasks", headers=ah, json={"title": "Élévation murs RDC"})
    assert task.status_code == 201, task.text
    task = task.json()

    push = client.post(
        f"{API}/sync/push",
        headers=cch,
        json={
            "device_id": "tablette-01",
            "mutations": [
                {
                    "client_mutation_id": "m-progress-0001",
                    "entity": "task_progress",
                    "entity_id": task["id"],
                    "operation": "update",
                    "base_version": task["version"],
                    "payload": {"progress_pct": 40, "note": "Rangs 1 à 8"},
                }
            ],
        },
    ).json()
    assert push["results"][0]["status"] == "applied"
    replay = client.post(
        f"{API}/sync/push",
        headers=cch,
        json={
            "mutations": [
                {
                    "client_mutation_id": "m-progress-0001",
                    "entity": "task_progress",
                    "entity_id": task["id"],
                    "operation": "update",
                    "base_version": task["version"],
                    "payload": {"progress_pct": 40},
                }
            ]
        },
    ).json()
    assert replay["results"][0]["status"] == "applied", "rejeu idempotent sans double application"
    stale = client.post(
        f"{API}/sync/push",
        headers=cch,
        json={
            "mutations": [
                {
                    "client_mutation_id": "m-progress-0002",
                    "entity": "task_progress",
                    "entity_id": task["id"],
                    "operation": "update",
                    "base_version": task["version"],
                    "payload": {"progress_pct": 25},
                }
            ]
        },
    ).json()
    result = stale["results"][0]
    assert result["status"] == "conflict" and result["conflict"]["server_data"]["progress_pct"] == "40.00"  # V4-DATA-32
    tasks = client.get(f"{API}/projects/{project['id']}/tasks", headers=ah).json()
    current = next(t for t in (tasks["items"] if isinstance(tasks, dict) else tasks) if t["id"] == task["id"])
    assert current["progress_pct"] == "40.00", "le serveur n'a pas été écrasé"
    # Fiche de la tâche (application terrain) : même contenu que la ligne de liste.
    detail = client.get(f"{API}/tasks/{task['id']}", headers=cch)
    assert detail.status_code == 200, detail.text
    assert detail.json()["id"] == task["id"] and detail.json()["progress_pct"] == "40.00"
    conflicts = client.get(f"{API}/sync/conflicts", headers=cch).json()
    resolved = client.post(
        f"{API}/sync/conflicts/{conflicts[0]['id']}/resolve",
        headers=cch,
        json={"resolution": "merged", "merged": {"progress_pct": 45, "note": "Fusion terrain/bureau"}},
    )
    assert resolved.json()["status"] == "resolved"
    pulled = client.get(f"{API}/sync/pull", headers=cch, params={"project_ids": [project["id"]]}).json()
    assert any(t["id"] == task["id"] and t["progress_pct"] == "45.00" for t in pulled["tasks"])
    unknown = client.post(
        f"{API}/sync/push",
        headers=cch,
        json={
            "mutations": [
                {"client_mutation_id": "m-unknown-0001", "entity": "salary", "operation": "update", "payload": {}}
            ]
        },
    ).json()
    assert unknown["results"][0]["status"] == "rejected"


def test_ai_rules_mode_voice_and_ocr(client: Any, db: Any) -> None:
    from app.core.pdf import PdfDocument, render

    admin = make_user(db, email=f"admin-ai-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    chef, cch = as_role(client, db, "CHEF_CHANTIER")
    project = _project(client, ah, "Entrepôt Bassa")
    client.post(
        f"{API}/projects/{project['id']}/members",
        headers=ah,
        json={"user_id": str(chef.id), "project_role": "chef_chantier"},
    )
    assert client.get(f"{API}/ai/status", headers=cch).json()["llm"] is False
    audio = b"OggS" + b"\x00" * 200  # flux Ogg minimal (contenu factice détecté comme audio/ogg)
    report = client.post(
        f"{API}/ai/voice-reports",
        headers=cch,
        data={
            "project_id": project["id"],
            "client_mutation_id": "voice-0001",
            "transcript": "Coulage de la dalle terminé. Il manque 20 sacs de ciment. Retard d'une demi-journée à cause de la pluie.",
        },
        files={"file": ("rapport.ogg", audio, "audio/ogg")},
    )
    assert report.status_code == 201, report.text
    report = report.json()
    assert report["status"] == "processed"
    assert report["extracted"]["needs"] and report["extracted"]["delays"]
    listen = client.get(f"{API}/ai/voice-reports/{report['id']}/audio", headers=cch)
    assert listen.status_code == 200 and listen.content.startswith(b"OggS")
    validated = client.post(f"{API}/ai/voice-reports/{report['id']}/validate", headers=cch, json={}).json()
    assert validated["daily_log"]["source"] == "voice_ai" and "ciment" in validated["daily_log"]["needs"]

    # Application Terrain : enregistrement AAC (.m4a, conteneur MP4 reconnu comme « vidéo ») accepté comme audio ;
    # le chef de projet est prévenu qu'un rapport attend sa validation.
    from sqlalchemy import select

    from app.modules.system.models import OutboxEvent

    lead, _lh = as_role(client, db, "CHEF_PROJET")
    client.post(
        f"{API}/projects/{project['id']}/members",
        headers=ah,
        json={"user_id": str(lead.id), "project_role": "chef_projet"},
    )
    m4a = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + b"\x00" * 200
    field = client.post(
        f"{API}/ai/voice-reports",
        headers=cch,
        data={"project_id": project["id"], "client_mutation_id": "voice-0002", "transcript": "Ferraillage posé."},
        files={"file": ("rapport-vocal.m4a", m4a, "audio/mp4")},
    )
    assert field.status_code == 201, field.text
    stored = client.get(f"{API}/ai/voice-reports/{field.json()['id']}/audio", headers=cch)
    assert stored.headers["content-type"].startswith("audio/mp4")
    event = db.execute(
        select(OutboxEvent).where(
            OutboxEvent.event_type == "voice_report.received", OutboxEvent.aggregate_id == field.json()["id"]
        )
    ).scalar_one()
    assert event.payload["author"] == chef.full_name and event.payload["summary"].startswith("Ferraillage")
    from app.modules.notifications.service import handle_event

    assert handle_event(db, event) >= 1
    from app.modules.notifications.models import Notification

    told = db.execute(
        select(Notification).where(Notification.user_id == lead.id, Notification.event_type == "voice_report.received")
    ).scalar_one()
    assert told.title == "Rapport vocal à valider — Entrepôt Bassa" and told.link == "/erp/ia?onglet=vocal"

    pdf = render(
        PdfDocument(
            title="FACTURE",
            number="FQ-2026-77",
            issued_on=date.today(),
            columns=["Désignation"],
            rows=[["Ciment"]],
            paragraphs=[("Réf", "Facture N° FQ-2026-77 — BC-2026-00012 — Total TTC 125 000")],
        )
    )
    _fin, fh = as_role(client, db, "FINANCE")
    ocr = client.post(
        f"{API}/ai/ocr", headers=fh, data={"kind": "invoice"}, files={"file": ("f.pdf", pdf, "application/pdf")}
    )
    assert ocr.status_code == 201, ocr.text
    assert ocr.json()["extracted"]["po_number"] == "BC-2026-00012"
    again = client.get(f"{API}/ai/ocr/{ocr.json()['id']}", headers=fh)
    assert again.status_code == 200 and again.json()["kind"] == "invoice"
    assert client.get(f"{API}/ai/ocr/{ocr.json()['id']}", headers=cch).status_code == 404


def test_admin_security_backup_audit_reports(client: Any, db: Any) -> None:
    from app.modules.system.models import BackupJob

    admin = make_user(db, email=f"admin-x-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    secret = client.put(f"{API}/admin/secrets/ANTHROPIC_API_KEY", headers=ah, json={"value": "sk-ant-test-0123456789"})
    assert secret.status_code == 200 and "value" not in secret.json()
    listing = client.get(f"{API}/admin/secrets", headers=ah).json()
    entry = next(s for s in listing if s["name"] == "ANTHROPIC_API_KEY")
    assert entry["configured"] and "sk-ant" not in str(listing)  # V4-SEC-02
    _rh, rhh = as_role(client, db, "RH")
    assert client.get(f"{API}/admin/secrets", headers=rhh).status_code == 403

    # Mode maintenance : API indisponible pour les utilisateurs, accessible aux administrateurs
    client.put(f"{API}/admin/maintenance", headers=ah, json={"enabled": True, "message": "Mise à jour"})
    assert client.get(f"{API}/notifications/unread-count", headers=rhh).status_code == 503
    assert client.get(f"{API}/admin/maintenance", headers=ah).json()["enabled"] is True
    client.put(f"{API}/admin/maintenance", headers=ah, json={"enabled": False})
    assert client.get(f"{API}/notifications/unread-count", headers=rhh).status_code == 200

    verify = client.get(f"{API}/admin/audit/verify", headers=ah).json()
    assert verify["valid"] is True and verify["checked"] > 0  # V4-AUDIT-34
    families = {
        e["family"] for e in client.get(f"{API}/admin/audit", headers=ah, params={"page_size": 200}).json()["items"]
    }
    assert {"security", "system"} <= families

    # Centre de sécurité : synthèse et sessions actives (security:read), refusé sans permission
    overview = client.get(f"{API}/admin/security/overview", headers=ah)
    assert overview.status_code == 200, overview.text
    ov = overview.json()
    assert ov["users"]["active"] >= 2 and ov["sessions"]["total"] >= 2 and "alerts" in ov
    sessions = client.get(f"{API}/admin/security/sessions", headers=ah).json()
    assert {s["email"] for s in sessions["items"]} >= {admin.email}
    assert client.get(f"{API}/admin/security/overview", headers=rhh).status_code == 403

    # Webhooks : catalogue d'événements publics, refus des événements internes ou inconnus
    catalog = {e["type"] for e in client.get(f"{API}/admin/webhooks/events", headers=ah).json()}
    assert {"*", "lead.created", "payment.succeeded"} <= catalog and "backup.requested" not in catalog
    bad = client.post(
        f"{API}/admin/webhooks",
        headers=ah,
        json={
            "name": "ERP compta",
            "url": "https://hooks.example.com/globus",
            "events": ["backup.requested"],
            "secret": "s" * 24,
        },
    )
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "UNKNOWN_EVENT"

    # Sauvegarde chiffrée signée puis restauration de contrôle dans une base isolée (V4-BACKUP-40)
    from app.modules.admin import backups

    job = BackupJob(kind="database", trigger="manual")
    db.add(job)
    db.commit()
    backups.run_backup(db, job)
    assert job.status == "success", job.error
    assert backups.verify(job)["ok"] is True
    test = backups.restore_test(db, job, user_id=None)
    assert test.status == "success", test.error
    # Les données de test vivent dans une transaction non validée : seules les données validées sont sauvegardées.
    assert set(test.details["counts"]) >= {"users", "projects", "audit_events"}
    assert test.details["audit_chain"]["valid"] is True and test.details["alembic_version"]
    # Restauration en place sans break-glass : refusée (V4-BACKUP-41)
    denied = client.post(
        f"{API}/admin/backups/{job.id}/restore",
        headers=ah,
        json={"break_glass_id": str(uuid.uuid4()), "confirmation": "RESTAURER"},
    )
    assert denied.status_code == 403 and denied.json()["error"]["code"] == "BREAK_GLASS_INVALID"
    no_mfa = client.post(
        f"{API}/admin/break-glass",
        headers=ah,
        json={"scope": "restore", "justification": "Restauration suite à corruption constatée", "code": "123456"},
    )
    assert no_mfa.status_code == 403 and no_mfa.json()["error"]["code"] == "MFA_REQUIRED"

    # Rapports & exports
    _project(client, ah, "Projet export")
    dashboard = client.get(f"{API}/reports/dashboard", headers=ah).json()
    assert dashboard["projects"]["total"] >= 1 and "finance" in dashboard
    xlsx = client.get(f"{API}/reports/export/projects", headers=ah, params={"format": "xlsx"})
    assert xlsx.status_code == 200 and xlsx.content[:2] == b"PK"
    csv = client.get(f"{API}/reports/export/projects", headers=ah, params={"format": "csv"})
    assert "Projet export" in csv.content.decode("utf-8")

    # Agenda : invitation interne + externe (ICS)
    other, oh = as_role(client, db, "CHEF_PROJET")
    event = client.post(
        f"{API}/agenda/events",
        headers=ah,
        json={
            "title": "Revue de projet",
            "starts_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            "ends_at": (datetime.now(UTC) + timedelta(days=1, hours=1)).isoformat(),
            "attendee_ids": [str(other.id)],
            "external": [{"email": "bet@example.com", "name": "BET Structure"}],
        },
    )
    assert event.status_code == 201, event.text
    mine = client.get(
        f"{API}/agenda/events",
        headers=oh,
        params={"start": datetime.now(UTC).isoformat(), "end": (datetime.now(UTC) + timedelta(days=3)).isoformat()},
    ).json()
    assert mine[0]["title"] == "Revue de projet"
    ics = client.get(f"{API}/agenda/events/{event.json()['id']}/ics", headers=oh)
    assert "BEGIN:VCALENDAR" in ics.text and "Revue de projet" in ics.text
