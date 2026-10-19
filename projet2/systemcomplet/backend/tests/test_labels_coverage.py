"""Libellés français complets (web et applications mobiles) : aucun nom de champ ni code d'énumération de l'API ne
doit apparaître brut à l'écran (« Won le », « Created le », « ordered », « rapport »…)."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LABELS = ROOT.parent / "apps/web/src/lib/labels.ts"


def _block_keys(marker: str) -> set[str]:
    src = LABELS.read_text(encoding="utf-8")
    start = src.index(marker)
    end = src.index("\n};", start) if marker != "export const HIDDEN_FIELDS" else src.index("\n];", start)
    pattern = r'^\s+"?([A-Za-z0-9_\-]+)"?\s*[:,]'
    return set(re.findall(pattern, src[start:end], re.M))


def test_every_visible_column_has_a_french_label():
    import app.models_registry as registry

    labels = _block_keys("export const FIELD_LABELS")
    hidden = _block_keys("export const HIDDEN_FIELDS")
    missing = sorted(
        {
            column.name
            for table in registry.metadata.tables.values()
            for column in table.columns
            if column.name not in labels
            and column.name not in hidden
            and not re.search(r"(_id|_ids|_hash|_token)$", column.name)
        }
    )
    assert not missing, f"Champs sans libellé français (apps/web/src/lib/labels.ts, FIELD_LABELS) : {missing}"


def test_every_enumeration_value_has_a_french_label():
    sys.path.insert(0, str(ROOT / "scripts"))
    import check_option_labels

    labels = check_option_labels._keys(LABELS, "export const OPTION_LABELS") | check_option_labels._keys(
        LABELS.parent / "format.ts", "STATUS_LABELS"
    )
    missing = sorted(v for v in check_option_labels.collect() if v not in labels)
    assert not missing, f"Valeurs sans libellé français (OPTION_LABELS ou STATUS_LABELS) : {missing}"
