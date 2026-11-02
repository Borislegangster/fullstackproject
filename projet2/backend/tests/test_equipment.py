"""Phase 17 — Equipment / fleet integration tests (CRUD, assignment, maintenance)."""
import uuid

import pytest

API = "/api/v1"


@pytest.fixture(scope="module")
def equipment_id(client, admin_auth):
    r = client.post(f"{API}/equipment", headers=admin_auth, json={
        "name": f"Bétonnière-{uuid.uuid4().hex[:6]}", "category": "Engin", "brand": "Bosch",
    })
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_list_equipment(client, admin_headers):
    r = client.get(f"{API}/equipment", headers=admin_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_then_get_equipment(client, admin_headers, equipment_id):
    r = client.get(f"{API}/equipment/{equipment_id}", headers=admin_headers)
    assert r.status_code == 200, r.text


def test_assign_then_return(client, admin_headers, equipment_id, sample_project):
    a = client.post(f"{API}/equipment/assignments", headers=admin_headers, json={
        "equipment_id": equipment_id, "project_id": sample_project["id"],
    })
    assert a.status_code == 200, a.text
    aid = a.json()["id"]
    r = client.patch(f"{API}/equipment/assignments/{aid}/return", headers=admin_headers)
    assert r.status_code == 200, r.text


def test_maintenance_create_then_complete(client, admin_headers, equipment_id):
    m = client.post(f"{API}/equipment/maintenance", headers=admin_headers, json={
        "equipment_id": equipment_id, "description": "Vidange",
        "maintenance_type": "PREVENTIVE",
    })
    assert m.status_code == 200, m.text
    mid = m.json()["id"]
    c = client.patch(f"{API}/equipment/maintenance/{mid}/complete", headers=admin_headers)
    assert c.status_code == 200, c.text


def test_equipment_sublists(client, admin_headers):
    for path in ("assignments", "maintenance", "movements"):
        r = client.get(f"{API}/equipment/{path}", headers=admin_headers)
        assert r.status_code == 200, f"{path}: {r.text}"


def test_equipment_requires_auth(client):
    assert client.get(f"{API}/equipment").status_code in (401, 403)
