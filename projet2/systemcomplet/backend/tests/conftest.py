"""Harnais de tests : PostgreSQL réel (service CI via TEST_DATABASE_URL, sinon PostgreSQL embarqué
`pgserver`), base dédiée créée par les migrations Alembic, purge entre chaque test."""

from __future__ import annotations

import os
import sys
import tempfile
import uuid
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def _server_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if url:
        return url.rsplit("/", 1)[0]
    import pgserver

    data_dir = os.environ.get("GLOBUS_PGDATA") or str(Path(tempfile.gettempdir()) / "globus_pgdata")
    server = pgserver.get_server(data_dir, cleanup_mode=None)
    return server.get_uri().replace("postgresql://", "postgresql+psycopg://").rsplit("/", 1)[0]


_BASE_URL = _server_url()
_DB_NAME = f"globus_test_{os.getpid()}"
_TMP = Path(tempfile.mkdtemp(prefix="globus_test_storage_"))

os.environ.update(
    {
        "ENV": "test",
        "DATABASE_URL": f"{_BASE_URL}/{_DB_NAME}",
        "WORKER_INLINE": "false",
        "PUBLIC_MEDIA_DIR": str(_TMP / "public"),
        "PRIVATE_STORAGE_DIR": str(_TMP / "private"),
        "BACKUP_DIR": str(_TMP / "backups"),
        # Prestataires réels exercés contre les API opérateurs reproduites (tests/operator_apis.py).
        "PAYMENT_PROVIDERS": "mtn_momo,orange_money",
        "MTN_MOMO_COLLECTION_USER_ID": "9f2c6d1e-4b8a-4c1f-9e3d-2a7b5c8d0e1f",
        "MTN_MOMO_COLLECTION_API_KEY": "collection-api-key",
        "MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY": "collection-subscription",
        "MTN_MOMO_DISBURSEMENT_USER_ID": "9f2c6d1e-4b8a-4c1f-9e3d-2a7b5c8d0e1f",
        "MTN_MOMO_DISBURSEMENT_API_KEY": "collection-api-key",
        "MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY": "disbursement-subscription",
        "ORANGE_OM_AUTHORIZATION": "Basic b20tY2xpZW50Om9tLXNlY3JldA==",
        "ORANGE_OM_MERCHANT_KEY": "om-merchant-key",
        "LOG_JSON": "false",
        "LOG_LEVEL": "WARNING",
        "MFA_ENFORCEMENT": "warn",
        "REDIS_URL": "",
    }
)
os.environ.pop("REDIS_URL", None)

from sqlalchemy import create_engine, text  # noqa: E402

_admin_engine = create_engine(f"{_BASE_URL}/postgres", isolation_level="AUTOCOMMIT")
with _admin_engine.connect() as conn:
    conn.execute(text(f'DROP DATABASE IF EXISTS "{_DB_NAME}"'))
    conn.execute(text(f'CREATE DATABASE "{_DB_NAME}"'))


def _migrate() -> None:
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "alembic"))
    command.upgrade(cfg, "head")


_migrate()

from app.core.database import SessionLocal, engine  # noqa: E402


def _baseline() -> None:
    from app.modules.system.bootstrap import bootstrap

    with SessionLocal() as session:
        bootstrap(session)


_baseline()


@pytest.fixture(scope="session", autouse=True)
def _drop_database_at_end() -> Iterator[None]:
    yield
    engine.dispose()
    with _admin_engine.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{_DB_NAME}" WITH (FORCE)'))


@pytest.fixture(autouse=True)
def _isolated_transaction() -> Iterator[None]:
    """Chaque test s'exécute dans une transaction externe annulée à la fin (commits = savepoints)."""
    from app.core import secrets
    from app.modules.admin import state

    connection = engine.connect()
    transaction = connection.begin()
    SessionLocal.configure(bind=connection, join_transaction_mode="create_savepoint")
    secrets.invalidate()
    state.invalidate()
    try:
        yield
    finally:
        SessionLocal.configure(bind=engine, join_transaction_mode="conservative_savepoint")
        transaction.rollback()
        connection.close()
        secrets.invalidate()
        state.invalidate()


@pytest.fixture
def db() -> Iterator[Any]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client() -> Iterator[Any]:
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app, headers={"X-Client-App": "desktop"}) as c:
        yield c


@pytest.fixture
def web_client() -> Iterator[Any]:
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app, headers={"X-Client-App": "web"}) as c:
        yield c


PASSWORD = "Globus!Test2026"


def make_user(
    db: Any,
    *,
    email: str | None = None,
    roles: list[str] | None = None,
    org_kind: str = "internal",
    org_id: uuid.UUID | None = None,
    first_name: str = "Test",
    last_name: str = "Utilisateur",
    phone: str | None = "+237690000000",
) -> Any:
    from sqlalchemy import select

    from app.core.security import hash_password
    from app.modules.identity.models import Organization, User
    from app.modules.identity.service import assign_roles

    if org_id is None:
        org = db.execute(select(Organization).where(Organization.kind == org_kind)).scalars().first()
        if org is None:
            org = Organization(name=f"Org {org_kind}", kind=org_kind)
            db.add(org)
            db.flush()
        org_id = org.id
    user = User(
        email=email or f"user-{uuid.uuid4().hex[:8]}@example.com",
        first_name=first_name,
        last_name=last_name,
        password_hash=hash_password(PASSWORD),
        organization_id=org_id,
        phone=phone,
        whatsapp=phone,
    )
    db.add(user)
    db.flush()
    assign_roles(db, user, roles or ["ADMIN"], granted_by=None)
    db.commit()
    return user


def login(client: Any, email: str, password: str = PASSWORD) -> dict[str, str]:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data, data
    return {"Authorization": f"Bearer {data['access_token']}"}


@pytest.fixture
def admin_headers(client: Any, db: Any) -> dict[str, str]:
    user = make_user(db, email="admin@example.com", roles=["ADMIN"])
    return login(client, user.email)


def as_role(client: Any, db: Any, role: str, **kwargs: Any) -> tuple[Any, dict[str, str]]:
    user = make_user(db, roles=[role], **kwargs)
    return user, login(client, user.email)


@pytest.fixture
def operators() -> Iterator[Any]:
    """API MTN MoMo et Orange Money reproduites (réseau remplacé, code prestataire réel)."""
    import httpx

    from app.core.config import settings
    from app.providers import payments as providers
    from tests.operator_apis import MomoApi, OrangeApi, transport

    momo = MomoApi(
        user_id=settings.MTN_MOMO_COLLECTION_USER_ID or "",
        api_key="collection-api-key",
        subscriptions={"collection": "collection-subscription", "disbursement": "disbursement-subscription"},
    )
    orange = OrangeApi(authorization="Basic b20tY2xpZW50Om9tLXNlY3JldA==", merchant_key="om-merchant-key")
    providers.tokens.clear()
    providers.use_http_client(httpx.Client(transport=transport(momo, orange)))
    try:
        yield type("Operators", (), {"momo": momo, "orange": orange})
    finally:
        providers.use_http_client(None)
        providers.tokens.clear()


def drain_outbox() -> int:
    from app.workers.outbox import drain

    return drain()
