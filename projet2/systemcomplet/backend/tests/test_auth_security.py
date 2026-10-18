"""Authentification, MFA, sessions, RBAC, audit (V4-SEC-03, V4-SEC-04, V4-AUDIT-34)."""

from __future__ import annotations

import pyotp
import pytest
from sqlalchemy import select, text

from tests.conftest import PASSWORD, as_role, login, make_user


def test_health(client):
    assert client.get("/health/live").json()["status"] == "ok"
    ready = client.get("/health/ready")
    assert ready.status_code == 200, ready.text
    assert ready.json()["checks"]["database"] == "ok"


def test_login_me_and_correlation_id(client, db):
    user = make_user(db, email="chef@example.com", roles=["CHEF_PROJET"])
    headers = login(client, user.email)
    resp = client.get("/api/v1/auth/me", headers={**headers, "X-Request-ID": "corr-test-123456"})
    assert resp.status_code == 200
    assert resp.headers["x-request-id"] == "corr-test-123456"
    me = resp.json()
    assert me["roles"] == ["CHEF_PROJET"]
    assert "projects:read" in me["permissions"]
    assert "erp" in me["spaces"]


def test_bad_password_and_lockout(client, db):
    user = make_user(db, email="lock@example.com", roles=["TECHNICIEN"])
    for _ in range(5):
        r = client.post("/api/v1/auth/login", json={"email": user.email, "password": "mauvais"})
        assert r.status_code == 401
    r = client.post("/api/v1/auth/login", json={"email": user.email, "password": PASSWORD})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "ACCOUNT_LOCKED"


def test_rbac_forbidden(client, db):
    _, headers = as_role(client, db, "TECHNICIEN")
    resp = client.get("/api/v1/users", headers=headers)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "PERMISSION_DENIED"


def test_mfa_totp_flow(client, db):
    user = make_user(db, email="dg@example.com", roles=["ADMIN"])
    headers = login(client, user.email)
    setup = client.post("/api/v1/auth/mfa/totp/setup", headers=headers).json()
    totp = pyotp.TOTP(setup["secret"])
    codes = client.post("/api/v1/auth/mfa/totp/confirm", headers=headers, json={"code": totp.now()})
    assert codes.status_code == 200, codes.text
    recovery = codes.json()["codes"]
    assert len(recovery) == 10
    # La connexion exige désormais le second facteur.
    first = client.post("/api/v1/auth/login", json={"email": user.email, "password": PASSWORD}).json()
    assert first["mfa_required"] is True
    bad = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": first["mfa_token"], "code": "000000"})
    assert bad.status_code == 401
    ok = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": first["mfa_token"], "recovery_code": recovery[0]})
    assert ok.status_code == 200, ok.text
    assert ok.json()["access_token"]
    # Un code de secours n'est utilisable qu'une fois.
    again = client.post("/api/v1/auth/login", json={"email": user.email, "password": PASSWORD}).json()
    reuse = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": again["mfa_token"], "recovery_code": recovery[0]})
    assert reuse.status_code == 401


def test_mfa_step_up_for_sensitive_operations(client, db, monkeypatch):
    """Session ouverte avant l'activation du MFA : activation = session confirmée ; sinon confirmation par code."""
    from app.core.config import settings
    from app.modules.identity.models import UserSession

    monkeypatch.setattr(settings, "MFA_ENFORCEMENT", "enforce")
    user = make_user(db, email="stepup@example.com", roles=["ADMIN"])
    headers = login(client, user.email)
    secret = {"value": "valeur-de-test-0001"}
    assert client.put("/api/v1/admin/secrets/STT_HTTP_TOKEN", headers=headers, json=secret).status_code == 403
    setup = client.post("/api/v1/auth/mfa/totp/setup", headers=headers).json()
    totp = pyotp.TOTP(setup["secret"])
    confirm = client.post("/api/v1/auth/mfa/totp/confirm", headers=headers, json={"code": totp.now()})
    assert confirm.status_code == 200, confirm.text
    recovery = confirm.json()["codes"]
    # Le facteur vient d'être prouvé : la session en cours est confirmée, l'opération sensible passe.
    ok = client.put("/api/v1/admin/secrets/STT_HTTP_TOKEN", headers=headers, json=secret)
    assert ok.status_code == 200, ok.text
    # Session non confirmée (ex. ouverte avant l'activation) : refus explicite puis confirmation par code.
    for session in db.execute(select(UserSession).where(UserSession.user_id == user.id)).scalars():
        session.mfa_verified_at = None
    db.commit()
    denied = client.put("/api/v1/admin/secrets/STT_HTTP_TOKEN", headers=headers, json=secret)
    assert denied.status_code == 403 and denied.json()["error"]["code"] == "MFA_REQUIRED"
    bad = client.post("/api/v1/auth/mfa/step-up", headers=headers, json={"code": "000000"})
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "INVALID_MFA_CODE"
    step = client.post("/api/v1/auth/mfa/step-up", headers=headers, json={"recovery_code": recovery[0]})
    assert step.status_code == 200, step.text
    assert step.json()["method"] == "recovery"
    again = client.put("/api/v1/admin/secrets/STT_HTTP_TOKEN", headers=headers, json=secret)
    assert again.status_code == 200, again.text
    assert db.execute(text("select count(*) from audit_events where action = 'MFA_STEP_UP'")).scalar_one() >= 1


def test_refresh_rotation_and_reuse_detection(client, db):
    user = make_user(db, email="rot@example.com", roles=["COMMERCIAL"])
    data = client.post("/api/v1/auth/login", json={"email": user.email, "password": PASSWORD}).json()
    first_refresh = data["refresh_token"]
    rotated = client.post("/api/v1/auth/refresh", json={"refresh_token": first_refresh})
    assert rotated.status_code == 200
    second_refresh = rotated.json()["refresh_token"]
    assert second_refresh != first_refresh
    # Réutilisation de l'ancien jeton → famille révoquée.
    reuse = client.post("/api/v1/auth/refresh", json={"refresh_token": first_refresh})
    assert reuse.status_code == 401
    revoked = client.post("/api/v1/auth/refresh", json={"refresh_token": second_refresh})
    assert revoked.status_code == 401


def test_web_cookies_and_csrf(web_client, db):
    user = make_user(db, email="web@example.com", roles=["MARKETING"])
    resp = web_client.post("/api/v1/auth/login", json={"email": user.email, "password": PASSWORD})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" not in body  # jamais exposé au JavaScript côté web
    assert "globus_access" in web_client.cookies
    csrf = web_client.cookies.get("globus_csrf")
    me = web_client.get("/api/v1/auth/me")
    assert me.status_code == 200
    no_csrf = web_client.patch("/api/v1/auth/me", json={"job_title": "Éditeur"})
    assert no_csrf.status_code == 403 and no_csrf.json()["error"]["code"] == "CSRF_FAILED"
    ok = web_client.patch("/api/v1/auth/me", json={"job_title": "Éditeur"}, headers={"X-CSRF-Token": csrf})
    assert ok.status_code == 200 and ok.json()["job_title"] == "Éditeur"


def test_logout_revokes_session(client, db):
    user = make_user(db, email="out@example.com", roles=["RH"])
    headers = login(client, user.email)
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_password_reset_flow(client, db):
    from app.modules.identity.models import UserToken

    user = make_user(db, email="reset@example.com", roles=["FINANCE"])
    assert client.post("/api/v1/auth/password/forgot", json={"email": user.email}).status_code == 202
    assert client.post("/api/v1/auth/password/forgot", json={"email": "inconnu@example.com"}).status_code == 202
    token_row = db.execute(select(UserToken).where(UserToken.purpose == "reset")).scalar_one()
    assert token_row.user_id == user.id
    weak = client.post("/api/v1/auth/password/reset", json={"token": "x" * 20, "new_password": "court"})
    assert weak.status_code in (400, 422)


def test_audit_chain_and_append_only(client, db):
    from app.core.audit import verify_chain

    make_user(db, email="aud@example.com", roles=["ADMIN"])
    login(client, "aud@example.com")
    login(client, "aud@example.com")
    result = verify_chain(db)
    assert result["valid"] is True and result["checked"] >= 2
    with pytest.raises(Exception):
        db.execute(text("UPDATE audit_events SET action = 'X'"))
        db.commit()
    db.rollback()
    families = set(db.execute(text("SELECT DISTINCT family FROM audit_events")).scalars())
    assert "security" in families


def test_user_admin_create_and_role_change(client, db, admin_headers):
    resp = client.post(
        "/api/v1/users",
        headers=admin_headers,
        json={
            "email": "nouveau@example.com",
            "first_name": "Nouveau",
            "last_name": "Compte",
            "role_codes": ["CHEF_CHANTIER"],
            "send_invitation": True,
        },
    )
    assert resp.status_code == 201, resp.text
    uid = resp.json()["id"]
    upd = client.patch(f"/api/v1/users/{uid}", headers=admin_headers, json={"role_codes": ["CHEF_PROJET"]})
    assert upd.status_code == 200 and upd.json()["role_codes"] == ["CHEF_PROJET"]
    roles = client.get("/api/v1/roles", headers=admin_headers).json()
    assert any(r["code"] == "CLIENT" for r in roles)
