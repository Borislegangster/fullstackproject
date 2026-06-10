"""Phase 13 — Project team assignments CRUD + RBAC."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def project_id(client: TestClient, admin_token):
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    r = client.post(
        "/api/v1/projects",
        headers=admin_headers,
        json={"name": "Team Project", "project_type": "Villa", "location": "Douala"},
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_create_and_list_assignment(client: TestClient, admin_headers, project_id):
    create = client.post(
        "/api/v1/projects/team-assignments",
        headers=admin_headers,
        json={"project_id": project_id, "member_name": "Paul Mbarga",
              "role": "Chef de chantier", "hours": 45, "status": "Sur site"},
    )
    assert create.status_code == 200, create.text
    aid = create.json()["id"]

    lst = client.get("/api/v1/projects/team-assignments", headers=admin_headers)
    assert lst.status_code == 200
    rows = lst.json()
    mine = next(a for a in rows if a["id"] == aid)
    assert mine["member_name"] == "Paul Mbarga"
    assert mine["role"] == "Chef de chantier"
    assert mine["project_name"] == "Team Project"  # name resolved
    assert mine["hours"] == 45


def test_list_filtered_by_project(client: TestClient, admin_headers, project_id):
    r = client.get(
        f"/api/v1/projects/team-assignments?project_id={project_id}",
        headers=admin_headers,
    )
    assert r.status_code == 200
    assert all(a["project_id"] == project_id for a in r.json())


def test_remove_assignment(client: TestClient, admin_headers, project_id):
    create = client.post(
        "/api/v1/projects/team-assignments",
        headers=admin_headers,
        json={"project_id": project_id, "member_name": "À Retirer", "role": "Maçon"},
    )
    aid = create.json()["id"]
    # Present before removal
    before = client.get("/api/v1/projects/team-assignments", headers=admin_headers).json()
    assert any(a["id"] == aid for a in before)
    # Remove
    rem = client.delete(f"/api/v1/projects/team-assignments/{aid}", headers=admin_headers)
    assert rem.status_code == 200
    # Gone from the active list
    after = client.get("/api/v1/projects/team-assignments", headers=admin_headers).json()
    assert not any(a["id"] == aid for a in after)


def test_create_invalid_project_404(client: TestClient, admin_headers):
    r = client.post(
        "/api/v1/projects/team-assignments",
        headers=admin_headers,
        json={"project_id": "ghost", "member_name": "X"},
    )
    assert r.status_code == 404


def test_team_assignments_rbac(client: TestClient, client_headers, project_id):
    assert client.get("/api/v1/projects/team-assignments", headers=client_headers).status_code == 403
    assert client.post("/api/v1/projects/team-assignments", headers=client_headers,
                       json={"project_id": project_id, "member_name": "Hack"}).status_code == 403


def test_route_ordering_not_shadowed(client: TestClient, admin_headers):
    """`/projects/team-assignments` must NOT be captured by `/projects/{id}`."""
    r = client.get("/api/v1/projects/team-assignments", headers=admin_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
