"""LOT B + C — Bureau d'Études: WS project-membership security + review PDFs
(snapshot + session summary) archived in the GED."""
import pytest

API = "/api/v1"


def _admin_id(client, admin_headers):
    return client.get(f"{API}/auth/me", headers=admin_headers).json()["id"]


def _ged_docs(client, admin_headers, project_id):
    return client.get(f"{API}/ged/documents/{project_id}", headers=admin_headers).json()


def test_snapshot_and_summary_archived_in_ged(client, admin_headers, sample_project):
    # Create a collaboration session on the project
    sess = client.post(f"{API}/collaboration/sessions", headers=admin_headers, json={
        "project_id": sample_project["id"], "plan_urn": "urn:test",
    })
    assert sess.status_code == 200, sess.text
    sid = sess.json()["session_id"]

    before = len(_ged_docs(client, admin_headers, sample_project["id"]))

    # Snapshot → returns a GED document id
    snap = client.post(f"{API}/collaboration/sessions/{sid}/snapshot", headers=admin_headers, json={
        "image_url": "data:image/png;base64,iVBORw0KGgo=", "notes": "Zone à revoir",
        "shared_with_client": True,
    })
    assert snap.status_code == 200, snap.text
    assert snap.json().get("document_id"), snap.json()

    # End session → returns a summary GED document id
    end = client.post(f"{API}/collaboration/sessions/{sid}/end", headers=admin_headers)
    assert end.status_code == 200, end.text
    assert end.json().get("summary_document_id"), end.json()

    docs = _ged_docs(client, admin_headers, sample_project["id"])
    assert len(docs) >= before + 2
    revue = [d for d in docs if d.get("category") == "revue"]
    assert len(revue) >= 2, docs


def test_ws_rejects_user_outside_project(client, admin_headers, client_token):
    # Session on a project owned by the ADMIN (so the seeded CLIENT is NOT a member)
    admin_id = _admin_id(client, admin_headers)
    proj = client.post(f"{API}/projects", headers=admin_headers, json={
        "name": "Projet Revue Privée", "project_type": "construction",
        "location": "Douala", "client_id": admin_id, "budget_initial": 1_000_000,
    }).json()
    sess = client.post(f"{API}/collaboration/sessions", headers=admin_headers, json={
        "project_id": proj["id"], "plan_urn": "urn:test",
    }).json()
    sid = sess["session_id"]

    # The seeded client (not a member of this project) must be refused.
    rejected = False
    try:
        with client.websocket_connect(
            f"{API}/collaboration/ws/{sid}?token={client_token}"
        ) as ws:
            # If somehow connected, no SESSION_STATE should arrive.
            data = ws.receive_json()
            rejected = data.get("type") != "SESSION_STATE"
    except Exception:
        rejected = True
    assert rejected


def test_binary_cursor_relay(client, admin_headers, admin_token, client_token, sample_project):
    """LOT E-1 — the compact binary cursor frame is relayed slot-tagged."""
    import struct
    # sample_project is owned by the seeded client → both admin & client may join.
    sid = client.post(f"{API}/collaboration/sessions", headers=admin_headers, json={
        "project_id": sample_project["id"], "plan_urn": "urn:test",
    }).json()["session_id"]

    ws_admin = f"{API}/collaboration/ws/{sid}?token={admin_token}"
    ws_client = f"{API}/collaboration/ws/{sid}?token={client_token}"
    with client.websocket_connect(ws_admin) as wa, client.websocket_connect(ws_client) as wc:
        assert wa.receive_json()["type"] == "SESSION_STATE"
        assert wc.receive_json()["type"] == "SESSION_STATE"
        # Admin moves cursor → binary frame [x,y,z]
        wa.send_bytes(struct.pack("<fff", 0.5, 0.25, 0.0))
        # Client receives the relayed [slot,x,y,z]
        data = wc.receive_bytes()
        slot, x, y, z = struct.unpack("<Bfff", data)
        assert abs(x - 0.5) < 1e-5 and abs(y - 0.25) < 1e-5
        assert 0 <= slot <= 255


def test_ice_servers_endpoint(client, admin_headers):
    r = client.get(f"{API}/collaboration/ice-servers", headers=admin_headers)
    assert r.status_code == 200
    servers = r.json()["iceServers"]
    assert any("stun:" in (s.get("urls") or "") for s in servers)


def test_recording_upload(client, admin_headers, sample_project):
    sid = client.post(f"{API}/collaboration/sessions", headers=admin_headers, json={
        "project_id": sample_project["id"], "plan_urn": "urn:test",
    }).json()["session_id"]
    r = client.post(
        f"{API}/collaboration/sessions/{sid}/recording",
        headers=admin_headers,
        files={"file": ("rec.webm", b"\x1aE\xdf\xa3 fake webm", "video/webm")},
    )
    assert r.status_code == 200, r.text
    assert r.json().get("recording_url")
