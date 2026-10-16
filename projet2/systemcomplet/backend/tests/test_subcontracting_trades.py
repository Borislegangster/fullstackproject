"""Corps de métier de la sous-traitance : référentiel unique (codes stockés inchangés), refus des codes hors liste,
codes historiques conservés, décennale exigée selon le corps d'état, concordance avec la liste et les libellés du web."""

from __future__ import annotations

import re
import uuid
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pytest

from app.modules.subcontracting.trades import DECENNALE_TRADES, TRADES
from tests.conftest import login, make_user

API = "/api/v1"
LABELS_TS = Path(__file__).resolve().parents[2] / "apps" / "web" / "src" / "lib" / "labels.ts"
CRITERIA = {"references": 4, "capacite": 4, "securite": 4, "finances": 3, "qualite": 4}


def _admin(client: Any, db: Any) -> dict[str, str]:
    admin = make_user(db, email=f"admin-trades-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    return login(client, admin.email)


def test_trades_restricted_to_reference_list(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    bad = client.post(f"{API}/subcontractors", headers=ah, json={"legal_name": "Libre Sarl", "trades": ["Maçon"]})
    assert bad.status_code == 422, bad.text
    assert bad.json()["error"]["code"] == "UNKNOWN_TRADE"

    sub = client.post(
        f"{API}/subcontractors",
        headers=ah,
        json={"legal_name": "Réseaux Sarl", "trades": ["vrd", "assainissement", "vrd"]},
    )
    assert sub.status_code == 201, sub.text
    sid = sub.json()["id"]
    assert sub.json()["trades"] == ["vrd", "assainissement"]

    listed = client.get(f"{API}/subcontractors", headers=ah, params={"trade": "assainissement"}).json()
    assert sid in [r["id"] for r in listed["items"]]

    res = client.patch(f"{API}/subcontractors/{sid}", headers=ah, json={"trades": ["vrd", "plomberie sanitaire"]})
    assert res.status_code == 422 and res.json()["error"]["code"] == "UNKNOWN_TRADE"

    res = client.post(
        f"{API}/subcontractors/{sid}/qualifications",
        headers=ah,
        json={"trade": "voirie", "criteria": CRITERIA, "decision": "pending"},
    )
    assert res.status_code == 422 and res.json()["error"]["code"] == "UNKNOWN_TRADE"


def test_legacy_trade_codes_are_kept(client: Any, db: Any) -> None:
    from app.modules.subcontracting.models import Subcontractor

    ah = _admin(client, db)
    legacy = Subcontractor(code=f"ST-LEG-{uuid.uuid4().hex[:5]}", legal_name="Ancien Sarl", trades=["staff_decor"])
    db.add(legacy)
    db.commit()

    # Le code historique déjà enregistré reste accepté (formulaire renvoyé tel quel) ; un nouveau code doit être connu.
    res = client.patch(f"{API}/subcontractors/{legacy.id}", headers=ah, json={"trades": ["staff_decor", "peinture"]})
    assert res.status_code == 200, res.text
    assert res.json()["trades"] == ["staff_decor", "peinture"]

    res = client.post(
        f"{API}/subcontractors/{legacy.id}/qualifications",
        headers=ah,
        json={"trade": "staff_decor", "criteria": CRITERIA, "decision": "pending"},
    )
    assert res.status_code == 201, res.text
    assert res.json()["trade"] == "staff_decor"


def test_decennale_required_by_trade(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    rc_only = {"insurance_rc_until": str(date.today() + timedelta(days=200))}
    sub = client.post(
        f"{API}/subcontractors", headers=ah, json={"legal_name": "Toitures Sarl", "trades": ["couverture"], **rc_only}
    ).json()

    res = client.post(
        f"{API}/subcontractors/{sub['id']}/qualifications",
        headers=ah,
        json={"trade": "couverture", "criteria": CRITERIA, "decision": "approved"},
    )
    assert res.status_code == 422 and res.json()["error"]["code"] == "INSURANCE_EXPIRED"

    res = client.post(
        f"{API}/subcontractors/{sub['id']}/qualifications",
        headers=ah,
        json={"trade": "peinture", "criteria": CRITERIA, "decision": "approved"},
    )
    assert res.status_code == 201, res.text
    detail = client.get(f"{API}/subcontractors/{sub['id']}", headers=ah).json()
    assert detail["trades"] == ["couverture", "peinture"]


def _ts_list(source: str, name: str) -> list[str]:
    start = source.index(f"export const {name}")
    block = source[start : source.index("];", start)]
    return re.findall(r'"([a-z_]+)"', block)


@pytest.mark.skipif(not LABELS_TS.exists(), reason="application web absente")
def test_web_reference_list_matches_backend() -> None:
    source = LABELS_TS.read_text(encoding="utf-8")
    assert _ts_list(source, "SUBCONTRACTING_TRADES") == list(TRADES)
    assert set(_ts_list(source, "DECENNALE_TRADES")) == set(DECENNALE_TRADES)
    options = source[source.index("export const OPTION_LABELS") :]
    for code, label in TRADES.items():
        found = re.search(rf'^\s+{code}: "([^"]+)",', options, re.MULTILINE)
        assert found, f"libellé web manquant pour {code}"
        assert found.group(1) == label, f"{code} : « {found.group(1)} » côté web, « {label} » côté serveur"
