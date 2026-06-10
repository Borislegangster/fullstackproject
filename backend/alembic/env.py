"""Alembic environment — Async-aware Engine wiring for Globus BTP.

Run:
  alembic revision --autogenerate -m "<description>"
  alembic upgrade head
  alembic downgrade -1

The DB URL is taken from the standard `DATABASE_URL` env var consumed by
`app.config.Settings`. Async URLs (sqlite+aiosqlite:// or postgresql+asyncpg://)
are converted to their sync drivers automatically because Alembic needs a
synchronous engine for offline/online generation.
"""
from __future__ import annotations

import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# Make `app.*` importable when running from the project root
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

# Import models so Alembic's autogenerate sees them
from app.database import Base  # noqa: E402
import app.auth.models  # noqa: E402,F401
import app.models.cms  # noqa: E402,F401
import app.models.media  # noqa: E402,F401
import app.models.erp  # noqa: E402,F401

from app.config import get_settings  # noqa: E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _db_url() -> str:
    """Return the runtime URL — async drivers are supported here because we
    use `async_engine_from_config` and run migrations via `connection.run_sync`.
    """
    return get_settings().DATABASE_URL


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no DB connection)."""
    url = _db_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in async/online mode."""
    cfg = config.get_section(config.config_ini_section) or {}
    cfg["sqlalchemy.url"] = _db_url()
    connectable = async_engine_from_config(
        cfg,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
