"""Exporte le schéma OpenAPI de l'API (utilisé par apps/web/scripts/gen-schemas.mjs pour générer les formulaires).

Usage : python scripts/export_openapi.py [chemin_sortie]
Par défaut : ../apps/web/.openapi.json
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app


def main() -> None:
    target = (
        Path(sys.argv[1])
        if len(sys.argv) > 1
        else Path(__file__).resolve().parents[2] / "apps" / "web" / ".openapi.json"
    )
    target.write_text(json.dumps(app.openapi(), ensure_ascii=False), encoding="utf-8")
    print(f"OpenAPI exporté : {target}")


if __name__ == "__main__":
    main()
