"""Génère une migration Alembic par comparaison modèles ↔ schéma (base temporaire, PostgreSQL embarqué).

Usage : python scripts/make_migration.py <identifiant> "<message>"
  ex.   python scripts/make_migration.py 0007 "Indice de confiance, preuves, avis vérifiés"

La base temporaire est créée, migrée jusqu'à la tête, puis supprimée ; relire le fichier généré avant de valider.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from regen_initial_migration import ROOT, server_url


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    rev_id, message = sys.argv[1], sys.argv[2]
    from sqlalchemy import create_engine, text

    base = server_url()
    name = "globus_makemig"
    admin = create_engine(f"{base}/postgres", isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{name}"'))
    env = {**os.environ, "ENV": "development", "DATABASE_URL": f"{base}/{name}", "PYTHONPATH": str(Path(ROOT))}
    try:
        steps = (["upgrade", "head"], ["revision", "--autogenerate", "--rev-id", rev_id, "-m", message])
        for args in steps:
            result = subprocess.run([sys.executable, "-m", "alembic", *args], cwd=ROOT, env=env, check=False)
            if result.returncode != 0:
                print(f"Échec : alembic {' '.join(args)}")
                return 1
    finally:
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
    print("Migration générée : relisez-la dans alembic/versions/.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
