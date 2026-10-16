"""Charge le contenu éditorial initial de la vitrine (idempotent).

Usage : python scripts/seed_content.py [--publish]
Sans --publish, les contenus sont créés en brouillon (circuit de validation CMS) ; c'est le comportement à
utiliser en production. Aucun chiffre, projet, témoignage ou média n'est inventé.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--publish", action="store_true", help="publier directement (hors production uniquement)")
    args = parser.parse_args()
    from app.core.config import settings
    from app.core.database import SessionLocal
    from app.modules.system.bootstrap import bootstrap
    from app.seeds.content import seed_content

    if args.publish and settings.is_production:
        print("Publication directe interdite en production : utiliser le circuit de validation du CMS.")
        return 2
    with SessionLocal() as db:
        bootstrap(db)
        created = seed_content(db, publish=args.publish)
        db.commit()
    print("Contenu éditorial :", ", ".join(f"{k}={v}" for k, v in created.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
