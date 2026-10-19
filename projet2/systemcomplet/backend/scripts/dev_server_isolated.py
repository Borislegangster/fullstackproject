"""Serveur de développement sur une instance PostgreSQL embarquée distincte (tests de bout en bout des applications).

Usage : python scripts/dev_server_isolated.py [--pgdata DOSSIER] [options de dev_server.py]
  --pgdata  dossier de l'instance (défaut : %TEMP%/globus_pgdata_e2e) ; les autres options sont transmises à
            dev_server.py (--seed, --port, --web-port, --reset).
Utile quand l'instance partagée %TEMP%/globus_pgdata est occupée ou endommagée.
"""

from __future__ import annotations

import os
import runpy
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    args = sys.argv[1:]
    pgdata = Path(tempfile.gettempdir()) / "globus_pgdata_e2e"
    if "--pgdata" in args:
        i = args.index("--pgdata")
        pgdata = Path(args[i + 1])
        del args[i : i + 2]
    import pgserver

    server = pgserver.get_server(str(pgdata), cleanup_mode=None)
    os.environ["DATABASE_URL_ADMIN"] = server.get_uri().replace("postgresql://", "postgresql+psycopg://")
    sys.argv = [str(ROOT / "scripts" / "dev_server.py"), *args]
    runpy.run_path(sys.argv[0], run_name="__main__")


if __name__ == "__main__":
    main()
