"""Auth router — login, forgot/reset password, change password, sessions, 2FA."""


def test_login_success(client):
    r = client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "Admin123!"})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["user"]["role"] == "ADMIN"


def test_login_wrong_password(client):
    r = client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "wrong-password"})
    assert r.status_code == 401


def test_login_unknown_email(client):
    r = client.post("/api/v1/auth/login", json={"email": "unknown@test.com", "password": "x"})
    assert r.status_code == 401


def test_get_me(client, admin_headers):
    r = client.get("/api/v1/auth/me", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["email"] == "admin@test.com"


def test_get_me_requires_auth(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code in (401, 403)


def test_patch_me(client, admin_headers):
    r = client.patch("/api/v1/auth/me", headers=admin_headers, json={"phone": "+237 111 222 333"})
    assert r.status_code == 200
    assert r.json()["phone"] == "+237 111 222 333"


def test_forgot_password_anti_enumeration(client):
    r = client.post("/api/v1/auth/forgot-password", json={"email": "never-existed@test.com"})
    assert r.status_code == 200
    assert "detail" in r.json()


def test_reset_password_invalid_token(client):
    r = client.post("/api/v1/auth/reset-password", json={"token": "bad", "new_password": "Whatever123!"})
    assert r.status_code == 400


def test_sessions_list(client, admin_headers):
    r = client.get("/api/v1/auth/sessions", headers=admin_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_2fa_status_disabled(client, admin_headers):
    r = client.get("/api/v1/auth/2fa/status", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["enabled"] is False


def test_2fa_enroll_returns_uri(client, admin_headers):
    r = client.post("/api/v1/auth/2fa/enroll", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert "otp_uri" in data
    assert data["otp_uri"].startswith("otpauth://")
    assert "secret" in data
