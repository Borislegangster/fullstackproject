"""Outil de développement : régénère la migration initiale (0001) depuis les modèles.

Usage : python scripts/regen_initial_migration.py  (PostgreSQL embarqué ou DATABASE_URL_ADMIN)
À n'utiliser qu'avant la première mise en production ; ensuite, créer des migrations incrémentales.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def server_url() -> str:
    url = os.environ.get("DATABASE_URL_ADMIN")
    if url:
        return url.rsplit("/", 1)[0]
    import pgserver

    srv = pgserver.get_server(str(Path(tempfile.gettempdir()) / "globus_pgdata"), cleanup_mode=None)
    return srv.get_uri().replace("postgresql://", "postgresql+psycopg://").rsplit("/", 1)[0]


def main() -> None:
    from sqlalchemy import create_engine, text

    base = server_url()
    name = "globus_autogen"
    admin = create_engine(f"{base}/postgres", isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{name}"'))
    versions = ROOT / "alembic" / "versions"
    target = versions / "0001_initial.py"
    if target.exists():
        target.unlink()
    parked = [p for p in versions.glob("*.py") if p.name != "0001_initial.py"]
    stash = ROOT / "alembic" / "_stash"
    stash.mkdir(exist_ok=True)
    for p in parked:
        p.rename(stash / p.name)
    try:
        env = {**os.environ, "ENV": "development", "DATABASE_URL": f"{base}/{name}", "PYTHONPATH": str(ROOT)}
        subprocess.run(
            [sys.executable, "-m", "alembic", "revision", "--autogenerate", "-m", "initial", "--rev-id", "0001"],
            cwd=ROOT,
            env=env,
            check=True,
        )
    finally:
        for p in stash.glob("*.py"):
            p.rename(versions / p.name)
        stash.rmdir()
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
    print(f"Migration régénérée : {target}")


if __name__ == "__main__":
    main()
