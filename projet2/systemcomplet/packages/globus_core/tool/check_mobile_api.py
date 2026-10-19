"""Contrôle statique des applications mobiles contre l'OpenAPI de l'API (apps/web/.openapi.json) :
chaque chemin appelé (fiches, listes, actions, vues) doit exister avec la bonne méthode.

Usage (depuis systemcomplet/) : python packages/globus_core/tool/check_mobile_api.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
# Chemins à segment d'action variable (« /stock-allocations/{id}/$action » : issue, return, consume).
DYNAMIC = {("POST", "/stock-allocations/{}/{}")}
LIT = r"'((?:[^'$\\]|\\.|\$\{[^}]*\}|\$\w+)+)'"


def main() -> int:
    spec = json.loads((ROOT / "apps/web/.openapi.json").read_text(encoding="utf-8"))
    ops: set[tuple[str, str]] = set()
    for path, methods in spec["paths"].items():
        for method in methods:
            ops.add((method.upper(), re.sub(r"\{[^}]+\}", "{}", path.replace("/api/v1", "", 1))))

    def norm(raw: str) -> str:
        return re.sub(r"\$\{[^}]*\}|\$\w+", "{}", raw).split("?")[0]

    problems: list[str] = []
    files = sorted((ROOT / "apps").glob("mobile-*/lib/**/*.dart")) + sorted((ROOT / "packages/globus_core/lib/src").glob("**/*.dart"))
    for file in files:
        if "generated" in file.parts:
            continue
        src = file.read_text(encoding="utf-8")
        rel = file.relative_to(ROOT).as_posix()

        def line(pos: int) -> int:
            return src[:pos].count("\n") + 1

        # Fiches et listes (lecture).
        for m in re.finditer(r"(?:detailPath:\s*\(\w+\)\s*=>\s*|ApiView\(\s*(?:key:[^,]+,\s*)?path:\s*|PagedListView\(\s*(?:key:[^,]+,\s*)?path:\s*|ResourceConfig\([^)]*?\bpath:\s*)" + LIT, src, re.S):
            n = norm(m.group(1))
            if n.startswith("/") and ("GET", n) not in ops:
                problems.append(f"{rel}:{line(m.start())}  GET {n}")
        # Actions à chemin (POST par défaut).
        for m in re.finditer(r"ResourceAction\(", src):
            end = src.find("ResourceAction(", m.end())
            block = src[m.start() : end if end > 0 else len(src)]
            pm = re.search(r"\bpath:\s*\(\w+\)\s*=>\s*" + LIT, block)
            if not pm:
                continue
            meth = re.search(r"method:\s*'(\w+)'", block)
            method = meth.group(1) if meth else "POST"
            n = norm(pm.group(1))
            if n.startswith("/") and (method, n) not in ops:
                problems.append(f"{rel}:{line(m.start())}  {method} {n}")
        # Appels directs du client API : api.get / post / patch / put / delete / request.
        for m in re.finditer(r"\.api\.(get|post|patch|put|delete)\(\s*" + LIT, src):
            n = norm(m.group(2))
            if n.startswith("/") and (m.group(1).upper(), n) not in ops:
                problems.append(f"{rel}:{line(m.start())}  {m.group(1).upper()} {n}")
    problems = [p for p in problems if tuple(p.split("  ", 1)[1].split(" ", 1)) not in DYNAMIC]
    if problems:
        print("Chemins inconnus de l'API :")
        print("\n".join(sorted(set(problems))))
        return 1
    print("Applications mobiles : tous les chemins appelés existent dans l'API.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
