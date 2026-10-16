"""Charge le jeu de données de démonstration complet (tests locaux uniquement — refusé en production).

Usage : python scripts/seed_demo.py [--visuals]
  --visuals  base déjà chargée : ajoute seulement les visuels de démonstration (idempotent)
Les comptes de démonstration sont décrits dans scripts/DEMO_ACCOUNTS.md.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    from app.core.config import settings
    from app.core.database import SessionLocal
    from app.modules.system.bootstrap import bootstrap
    from app.seeds.demo import seed_all
    from app.workers.outbox import drain

    if settings.is_production:
        print("Refusé : le jeu de démonstration ne doit jamais être chargé en production.")
        return 2
    if "--visuals" in sys.argv:
        from app.seeds.demo import upgrade_innovations_demo, upgrade_vitrine_visuals

        with SessionLocal() as db:
            applied = upgrade_vitrine_visuals(db)
            upgrade_innovations_demo(db)
        print("Visuels de démonstration : " + ("ajoutés." if applied else "base de démo absente, rien à faire."))
        return 0
    with SessionLocal() as db:
        bootstrap(db)
        result = seed_all(db)
    processed = drain()
    print(f"Démo chargée : {len(result['users'])} comptes, projets : {', '.join(result['projects'])}.")
    print(f"Événements traités (notifications, webhooks) : {processed}.")
    print("Comptes : voir scripts/DEMO_ACCOUNTS.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
