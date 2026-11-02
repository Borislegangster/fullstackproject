"""Client portal endpoints (read-only smoke + create paths)."""


def test_get_profile(client, client_headers):
    r = client.get("/api/v1/client/profile", headers=client_headers)
    assert r.status_code == 200
    assert r.json()["email"] == "client@test.com"


def test_get_project_404_when_no_project(client, client_headers):
    """Without a Project linked to the CLIENT user, /client/project returns 404."""
    r = client.get("/api/v1/client/project", headers=client_headers)
    assert r.status_code == 404


def test_get_notifications(client, client_headers):
    r = client.get("/api/v1/client/notifications", headers=client_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_client_cannot_list_admin_users(client, client_headers):
    """CLIENT must not access /admin/users."""
    r = client.get("/api/v1/admin/users", headers=client_headers)
    assert r.status_code == 403
