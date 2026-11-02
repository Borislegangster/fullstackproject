"""Phase 17 — Planning (Gantt) integration tests."""
import pytest

API = "/api/v1"


@pytest.fixture(scope="module")
def task_id(client, admin_auth, sample_project):
    r = client.post(f"{API}/planning/tasks", headers=admin_auth, json={
        "project_id": sample_project["id"], "name": "Fondations",
        "start_date": "2026-03-01T00:00:00", "end_date": "2026-03-15T00:00:00",
        "duration_days": 14,
    })
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_list_tasks(client, admin_headers):
    r = client.get(f"{API}/planning/tasks", headers=admin_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_then_update_task(client, admin_headers, task_id):
    r = client.patch(f"{API}/planning/tasks/{task_id}", headers=admin_headers,
                     json={"name": "Fondations renforcées"})
    assert r.status_code == 200, r.text


def test_dependencies_list(client, admin_headers):
    r = client.get(f"{API}/planning/dependencies", headers=admin_headers)
    assert r.status_code == 200


def test_delete_task(client, admin_headers, task_id):
    r = client.delete(f"{API}/planning/tasks/{task_id}", headers=admin_headers)
    assert r.status_code == 200


def test_planning_requires_auth(client):
    assert client.get(f"{API}/planning/tasks").status_code in (401, 403)
