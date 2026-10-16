"""Contrôle CI : les migrations Alembic s'appliquent sur une base vide et sont synchrones avec les modèles.

Usage : python scripts/check_migrations.py  (PostgreSQL embarqué ou DATABASE_URL_ADMIN)
Échoue (code 1) si `alembic upgrade head` échoue ou si `alembic check` détecte un écart modèles ↔ schéma.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from regen_initial_migration import ROOT, server_url


def main() -> int:
    from sqlalchemy import create_engine, text

    base = server_url()
    name = "globus_migcheck"
    admin = create_engine(f"{base}/postgres", isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{name}"'))
    env = {**os.environ, "ENV": "development", "DATABASE_URL": f"{base}/{name}", "PYTHONPATH": str(Path(ROOT))}
    try:
        for args in (["upgrade", "head"], ["check"]):
            result = subprocess.run([sys.executable, "-m", "alembic", *args], cwd=ROOT, env=env, check=False)
            if result.returncode != 0:
                print(f"Échec : alembic {' '.join(args)}")
                return 1
    finally:
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
    print("Migrations OK : schéma synchrone avec les modèles.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
