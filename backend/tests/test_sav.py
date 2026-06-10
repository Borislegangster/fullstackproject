"""Phase 17 — SAV (after-sales) integration tests."""
import pytest

API = "/api/v1"


@pytest.fixture(scope="module")
def ticket_id(client, admin_auth, sample_project):
    r = client.post(f"{API}/sav/tickets", headers=admin_auth, json={
        "project_id": sample_project["id"], "subject": "Fuite toiture",
        "description": "Infiltration salon", "priority": "HAUTE",
    })
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_list_tickets(client, admin_headers):
    r = client.get(f"{API}/sav/tickets", headers=admin_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_get_ticket(client, admin_headers, ticket_id):
    r = client.get(f"{API}/sav/tickets/{ticket_id}", headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["subject"] == "Fuite toiture"


def test_resolve_ticket(client, admin_headers, ticket_id):
    r = client.patch(f"{API}/sav/tickets/{ticket_id}/resolve", headers=admin_headers)
    assert r.status_code == 200, r.text


def test_sav_stats(client, admin_headers):
    assert client.get(f"{API}/sav/stats", headers=admin_headers).status_code == 200
    assert client.get(f"{API}/sav/stats/by-category", headers=admin_headers).status_code == 200


def test_client_can_list_own_tickets(client, client_headers):
    r = client.get(f"{API}/client/sav/tickets", headers=client_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_sav_requires_auth(client):
    assert client.get(f"{API}/sav/tickets").status_code in (401, 403)
