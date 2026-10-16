"""Collaboration : messagerie (règles de mise en relation, idempotence hors ligne, non-lus, temps réel WebSocket),
appels audio/vidéo + partage d'écran + consentement d'enregistrement (V4-CALL-17/18/19), notifications (V4-NOTIF-39)."""

from __future__ import annotations

import uuid
from typing import Any

from tests.conftest import as_role, login, make_user

API = "/api/v1"


def test_messaging_rules_and_realtime(client: Any, db: Any) -> None:
    from app.modules.identity.models import Organization

    admin = make_user(db, email=f"admin-c-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    chef, cph = as_role(client, db, "CHEF_PROJET")
    archi, arh = as_role(client, db, "ARCHITECTE")
    client_org = Organization(name="Famille Ndongo", kind="client")
    supplier_org = Organization(name="Quincaillerie X", kind="supplier")
    db.add_all([client_org, supplier_org])
    db.commit()
    customer, custh = as_role(client, db, "CLIENT", org_id=client_org.id)
    supplier_user, _sh = as_role(client, db, "FOURNISSEUR", org_id=supplier_org.id)
    project = client.post(
        f"{API}/projects",
        headers=ah,
        json={"name": "Duplex Ndongo", "client_organization_id": str(client_org.id), "status": "execution"},
    ).json()
    client.post(
        f"{API}/projects/{project['id']}/members",
        headers=ah,
        json={"user_id": str(chef.id), "project_role": "chef_projet"},
    )

    # Interne ↔ interne
    conv = client.post(f"{API}/conversations/direct", headers=cph, json={"user_id": str(archi.id)})
    assert conv.status_code == 200, conv.text
    conv = conv.json()
    ticket = client.post(f"{API}/auth/ws-ticket", headers=arh).json()["ticket"]
    with client.websocket_connect(f"/ws?ticket={ticket}") as ws:
        assert ws.receive_json()["type"] == "ready"
        ws.send_json({"type": "join", "data": {"room": f"conversation:{conv['id']}"}})
        assert ws.receive_json()["type"] == "joined"
        body = {"body": "Plans R+1 validés ?", "client_message_id": "mobile-msg-1"}
        sent = client.post(f"{API}/conversations/{conv['id']}/messages", headers=cph, json=body)
        assert sent.status_code == 201, sent.text
        event = ws.receive_json()
        assert event["type"] == "message.new" and event["data"]["body"] == "Plans R+1 validés ?"
    replay = client.post(f"{API}/conversations/{conv['id']}/messages", headers=cph, json=body)
    assert replay.json()["id"] == sent.json()["id"], "renvoi hors ligne sans doublon"
    listed = client.get(f"{API}/conversations", headers=arh).json()
    assert listed[0]["unread"] == 1 and listed[0]["title"] == chef.full_name
    client.post(f"{API}/conversations/{conv['id']}/read", headers=arh, json={})
    assert client.get(f"{API}/conversations", headers=arh).json()[0]["unread"] == 0
    forbidden_ws = client.post(f"{API}/conversations/{conv['id']}/messages", headers=custh, json={"body": "intrusion"})
    assert forbidden_ws.status_code == 404

    # Client ↔ chef de projet de son projet : autorisé ; client ↔ fournisseur : interdit
    assert client.post(f"{API}/conversations/direct", headers=custh, json={"user_id": str(chef.id)}).status_code == 200
    denied = client.post(f"{API}/conversations/direct", headers=custh, json={"user_id": str(supplier_user.id)})
    assert denied.status_code == 403 and denied.json()["error"]["code"] == "CONTACT_FORBIDDEN"
    assert client.post(f"{API}/conversations/direct", headers=custh, json={"user_id": str(archi.id)}).status_code == 403

    # Canal client du projet : équipe + client
    channel = client.post(
        f"{API}/conversations/project-channel", headers=cph, json={"project_id": project["id"], "client_channel": True}
    ).json()
    member_ids = {m["user_id"] for m in channel["members"]}
    assert str(customer.id) in member_ids and str(chef.id) in member_ids


def test_calls_screen_share_and_recording_consent(client: Any, db: Any) -> None:
    _chef, cph = as_role(client, db, "CHEF_PROJET")
    archi, arh = as_role(client, db, "ARCHITECTE")
    _supplier, sh = as_role(client, db, "FOURNISSEUR")

    ice = client.get(f"{API}/calls/ice-servers", headers=cph).json()
    assert ice["ice_servers"][0]["urls"] and ice["turn"] is False
    assert client.get(f"{API}/calls/ice-servers", headers=sh).status_code == 403

    call = client.post(
        f"{API}/calls", headers=cph, json={"kind": "video", "participant_ids": [str(archi.id)], "title": "Revue façade"}
    )
    assert call.status_code == 201, call.text
    call = call.json()
    assert call["status"] == "ringing" and call["topology"] == "mesh"
    incoming = client.get(f"{API}/calls", headers=arh).json()
    assert incoming[0]["id"] == call["id"]
    joined = client.post(f"{API}/calls/{call['id']}/join", headers=arh, json={"video": True}).json()
    assert joined["status"] == "active"
    shared = client.post(f"{API}/calls/{call['id']}/screen-share", headers=cph, json={"active": True}).json()
    assert shared["had_screen_share"] is True
    client.post(f"{API}/calls/{call['id']}/recording/consent", headers=cph, json={"consent": True})
    partial = client.get(f"{API}/calls/{call['id']}", headers=cph).json()
    assert partial["recording_allowed"] is False, "consentement de tous requis"
    full = client.post(f"{API}/calls/{call['id']}/recording/consent", headers=arh, json={"consent": True}).json()
    assert full["recording_allowed"] is True
    left = client.post(f"{API}/calls/{call['id']}/leave", headers=arh).json()
    assert left["status"] == "ended" and left["duration_seconds"] is not None


def test_notification_center_and_preferences(client: Any, db: Any) -> None:
    _user, uh = as_role(client, db, "CHEF_PROJET")
    test = client.post(f"{API}/push/test", headers=uh)
    assert test.status_code == 200 and test.json()["notifications"] == 1
    listing = client.get(f"{API}/notifications", headers=uh).json()
    assert listing["unread_count"] == 1 and listing["items"][0]["title"] == "Notification de test"
    client.post(f"{API}/notifications/read", headers=uh, json={})
    assert client.get(f"{API}/notifications/unread-count", headers=uh).json()["unread"] == 0
    prefs = client.put(
        f"{API}/notifications/preferences",
        headers=uh,
        json={"items": [{"category": "chat", "channel": "push", "enabled": False}]},
    ).json()
    assert prefs["matrix"]["chat"]["push"] is False and prefs["matrix"]["chat"]["in_app"] is True
    refused = client.put(
        f"{API}/notifications/preferences",
        headers=uh,
        json={"items": [{"category": "security", "channel": "in_app", "enabled": False}]},
    )
    assert refused.status_code == 422
    bad = client.post(f"{API}/push/subscriptions", headers=uh, json={"endpoint": "http://insecure.example.com/x"})
    assert bad.status_code == 422
    sub = client.post(
        f"{API}/push/subscriptions",
        headers=uh,
        json={
            "endpoint": f"https://fcm.googleapis.com/fcm/send/{uuid.uuid4().hex}",
            "p256dh": "BOrkey",
            "auth": "authkey",
            "application": "web",
        },
    )
    assert sub.status_code == 201
