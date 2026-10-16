"""Environnement local autonome : PostgreSQL embarqué (pgserver) + migrations + jeu de démo + API.

Usage : python scripts/dev_server.py [--port 8010] [--web-port 3010] [--seed] [--reset]
  --seed   charge le jeu de démonstration (comptes : scripts/DEMO_ACCOUNTS.md) si la base est vide
  --reset  recrée la base « globus_dev » (toutes les données locales sont perdues)

Aucun Docker ni PostgreSQL installé n'est nécessaire : la base vit dans %TEMP%/globus_pgdata (instance partagée avec
les tests, base distincte). Réservé au développement : refusé si ENV=production.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

DB_NAME = "globus_dev"


def _prepare_database(base: str, *, reset: bool) -> bool:
    """Crée la base si besoin ; retourne True si elle vient d'être créée."""
    from sqlalchemy import create_engine, text

    admin = create_engine(f"{base}/postgres", isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        if reset:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{DB_NAME}" WITH (FORCE)'))
        exists = conn.execute(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": DB_NAME}).first()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{DB_NAME}"'))
    admin.dispose()
    return not exists


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8010)
    parser.add_argument("--web-port", type=int, default=3010)
    parser.add_argument("--seed", action="store_true")
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()
    if os.environ.get("ENV") == "production":
        print("Refusé : environnement local uniquement.")
        return 2

    from regen_initial_migration import server_url

    base = server_url()
    created = _prepare_database(base, reset=args.reset)
    storage = ROOT / "storage-dev"
    web = f"http://localhost:{args.web_port}"
    os.environ.update(
        {
            "ENV": "development",
            "DATABASE_URL": f"{base}/{DB_NAME}",
            "PUBLIC_BASE_URL": web,
            "API_PUBLIC_URL": f"http://localhost:{args.port}",  # WebSocket et liens publics directs vers l'API
            "CORS_ORIGINS": f"{web},http://127.0.0.1:{args.web_port}",
            "WEB_INTERNAL_URL": web,
            "WORKER_INLINE": "true",
            # Paiements réels uniquement : renseigner PAYMENT_PROVIDERS (ex. mtn_momo,orange_money) et les clés de
            # test des prestataires (bac à sable MTN MoMo : scripts/momo_sandbox_user.py).
            "PAYMENT_PROVIDERS": os.environ.get("PAYMENT_PROVIDERS", ""),
            "PUBLIC_MEDIA_DIR": str(storage / "public_media"),
            "PRIVATE_STORAGE_DIR": str(storage / "private"),
            "BACKUP_DIR": str(storage / "backups"),
            "LOG_JSON": "false",
        }
    )
    env = {**os.environ, "PYTHONPATH": str(ROOT)}
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=ROOT, env=env, check=True)
    if args.seed and (created or args.reset or not _has_users()):
        subprocess.run([sys.executable, str(ROOT / "scripts" / "seed_demo.py")], cwd=ROOT, env=env, check=True)
    elif args.seed:
        # base déjà chargée : mise à niveau idempotente des visuels de démonstration
        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "seed_demo.py"), "--visuals"], cwd=ROOT, env=env, check=False
        )

    import uvicorn

    print(f"API GLOBUS : http://127.0.0.1:{args.port}/api/v1/docs  —  base {DB_NAME} (PostgreSQL embarqué)")
    # keep-alive > celui du proxy Next (sinon « socket hang up » lors de la réutilisation d'une connexion fermée)
    uvicorn.run(
        "app.main:app", host="127.0.0.1", port=args.port, app_dir=str(ROOT), log_level="info", timeout_keep_alive=75
    )
    return 0


def _has_users() -> bool:
    from sqlalchemy import create_engine, text

    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with engine.connect() as conn:
            return bool(conn.execute(text("SELECT count(*) FROM users WHERE email LIKE '%@globus.demo'")).scalar())
    finally:
        engine.dispose()


if __name__ == "__main__":
    os.chdir(ROOT)
    sys.exit(main())
