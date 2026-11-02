"""Shared pytest fixtures for the Globus BTP backend tests.

Each test session uses its own ephemeral SQLite DB so the global app state
stays clean between runs. Two ready-to-use clients are provided:

    admin_headers: bearer-authenticated as an ADMIN user
    client_headers: bearer-authenticated as a CLIENT user
"""
from __future__ import annotations

import asyncio
import os
import secrets

import pytest
from fastapi.testclient import TestClient

# ── Environment isolation BEFORE importing app ───────────────
os.environ.setdefault("DEBUG", "True")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_session.db")
os.environ.setdefault("SMTP_USER", "")
os.environ.setdefault("SMTP_PASS", "")
os.environ.setdefault("JWT_SECRET_KEY", "test-" + secrets.token_urlsafe(48))
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "test-" + secrets.token_urlsafe(48))
# Disable rate limits in tests
os.environ["RATE_LIMITS_DISABLED"] = "1"


@pytest.fixture(scope="session")
def app_fixture():
    """Boot the FastAPI app & seed an ADMIN + CLIENT user once."""
    # Recreate the test DB from scratch
    if os.path.exists("./test_session.db"):
        try:
            os.remove("./test_session.db")
        except Exception:
            pass

    from app.database import engine, Base, AsyncSessionLocal
    import app.auth.models, app.models.cms, app.models.media, app.models.erp  # noqa: F401
    from app.auth.models import User
    from app.auth.service import hash_password

    async def init():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        async with AsyncSessionLocal() as db:
            db.add(User(
                email="admin@test.com", password_hash=hash_password("Admin123!"),
                first_name="Admin", last_name="Test", role="ADMIN",
                is_active=True, must_change_password=False,
            ))
            db.add(User(
                email="client@test.com", password_hash=hash_password("Client123!"),
                first_name="Jean", last_name="Talla", role="CLIENT",
                is_active=True, must_change_password=False,
            ))
            await db.commit()

    asyncio.run(init())

    from app.main import app as fastapi_app
    yield fastapi_app

    if os.path.exists("./test_session.db"):
        try:
            os.remove("./test_session.db")
        except Exception:
            pass


@pytest.fixture(scope="session")
def client(app_fixture) -> TestClient:
    return TestClient(app_fixture)


def _login(client: TestClient, email: str, password: str) -> str:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_token(client) -> str:
    return _login(client, "admin@test.com", "Admin123!")


@pytest.fixture(scope="session")
def client_token(client) -> str:
    return _login(client, "client@test.com", "Client123!")


@pytest.fixture()
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def admin_auth(admin_token):
    """Session-scoped admin headers — usable from module-scoped fixtures
    (function-scoped `admin_headers` would raise a ScopeMismatch there)."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture()
def client_headers(client_token):
    return {"Authorization": f"Bearer {client_token}"}


# ── Shared entities for integration tests (Phase 17) ─────────

@pytest.fixture(scope="session")
def client_user_id(client, client_token) -> str:
    """The seeded CLIENT user's id (resolved via /auth/me)."""
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {client_token}"})
    assert r.status_code == 200, r.text
    return r.json()["id"]


@pytest.fixture(scope="session")
def sample_project(client, admin_token, client_user_id) -> dict:
    """A real project owned by the seeded client — reused as FK target by
    invoicing / planning / sav / equipment integration tests."""
    h = {"Authorization": f"Bearer {admin_token}"}
    r = client.post("/api/v1/projects", headers=h, json={
        "name": "Projet Test Pyramide",
        "project_type": "construction",
        "location": "Douala",
        "client_id": client_user_id,
        "budget_initial": 5_000_000,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    return {"id": body["id"], "code": body.get("code"), "client_id": client_user_id}
