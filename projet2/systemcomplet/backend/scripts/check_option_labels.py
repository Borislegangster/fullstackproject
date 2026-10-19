"""Contrôle : toute valeur d'énumération de l'API (statuts, types, catégories…) a un libellé français.

Sources analysées : Literal[...] et motifs « ^(a|b|c)$ » des schémas, tuples / listes de constantes nommées
*_STATUSES, *_TYPES, *_KINDS, *_CATEGORIES, *_STAGES, *_SOURCES, *_CHANNELS, *_METHODS, *_LEVELS, *_PRIORITIES…
Libellés : OPTION_LABELS (apps/web/src/lib/labels.ts) et STATUS_LABELS (apps/web/src/lib/format.ts).

Usage : python scripts/check_option_labels.py [--list]
"""

from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT.parent / "apps/web/src/lib"
NAMED = re.compile(
    r"(STATUSES|STATES|TYPES|KINDS|CATEGORIES|STAGES|SOURCES|CHANNELS|METHODS|LEVELS|PRIORITIES|SEVERITIES|"
    r"UNIVERSES|TIMELINES|URGENCIES|MODES|ROLES|DECISIONS|OUTCOMES|RESULTS|REASONS|PHASES|TRADES|DISCIPLINES)$"
)
CODE = re.compile(r"^[a-z][a-z0-9_]{1,40}$|^[A-Z][A-Z0-9_]{1,40}$")
IGNORED = {"asc", "desc", "json", "csv", "xlsx", "pdf", "png", "jpg", "jpeg", "webp", "svg", "mp4", "true", "false"}


def _keys(path: Path, marker: str) -> set[str]:
    src = path.read_text(encoding="utf-8")
    start = src.index(marker)
    end = src.index("\n};", start)
    return set(re.findall(r'^\s+"?([A-Za-z0-9_\-]+)"?\s*:', src[start:end], re.M))


def collect() -> dict[str, set[str]]:
    found: dict[str, set[str]] = {}

    def add(value: str, where: str) -> None:
        if CODE.match(value) and value.lower() not in IGNORED:
            found.setdefault(value, set()).add(where)

    for file in (ROOT / "app").rglob("*.py"):
        rel = file.relative_to(ROOT).as_posix()
        if "/seeds/" in rel:
            continue
        src = file.read_text(encoding="utf-8")
        for m in re.finditer(r'pattern\s*=\s*r?"\^\(([^)"]+)\)\$"', src):
            for v in m.group(1).split("|"):
                add(v, rel)
        tree = ast.parse(src)
        for node in ast.walk(tree):
            if isinstance(node, ast.Subscript) and getattr(node.value, "id", None) == "Literal":
                elts = node.slice.elts if isinstance(node.slice, ast.Tuple) else [node.slice]
                for e in elts:
                    if isinstance(e, ast.Constant) and isinstance(e.value, str):
                        add(e.value, rel)
            if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
                name = node.targets[0].id
                if NAMED.search(name) and isinstance(node.value, (ast.Tuple, ast.List, ast.Set)):
                    for e in node.value.elts:
                        if isinstance(e, ast.Constant) and isinstance(e.value, str):
                            add(e.value, rel)
    return found


def main() -> int:
    labels = _keys(WEB / "labels.ts", "export const OPTION_LABELS") | _keys(WEB / "format.ts", "STATUS_LABELS")
    found = collect()
    missing = {v: w for v, w in found.items() if v not in labels}
    if "--list" in sys.argv:
        for v in sorted(missing):
            print(f"{v}\t{', '.join(sorted(missing[v]))[:110]}")
    print(f"Valeurs d'énumération : {len(found)} ; sans libellé français : {len(missing)}")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
