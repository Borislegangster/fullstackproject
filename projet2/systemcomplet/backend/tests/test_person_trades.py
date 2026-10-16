"""Métier des personnes (salariés RH, utilisateurs, équipes) : liste fermée partagée avec la sous-traitance (mêmes codes)
et complétée des métiers de chantier ; codes historiques conservés ; concordance avec la liste et les libellés du web."""

from __future__ import annotations

import re
import uuid
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from app.modules.subcontracting.trades import CREW_TRADES, PERSON_TRADES, TRADES, trade_label
from tests.conftest import as_role, login, make_user

API = "/api/v1"
LABELS_TS = Path(__file__).resolve().parents[2] / "apps" / "web" / "src" / "lib" / "labels.ts"


def _admin(client: Any, db: Any) -> dict[str, str]:
    admin = make_user(db, email=f"admin-metiers-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    return login(client, admin.email)


def _unknown(res: Any) -> bool:
    return res.status_code == 422 and res.json()["error"]["code"] == "UNKNOWN_TRADE"


def test_reference_extends_subcontracting_trades() -> None:
    assert set(TRADES) <= set(PERSON_TRADES)
    assert not set(CREW_TRADES) & set(TRADES), "un métier de chantier ne doit pas doubler un corps de métier"
    # Valeurs déjà stockées (démo, tests) : toutes dans le référentiel.
    for code in ("maconnerie", "ferraillage", "coffrage", "electricite", "carrelage"):
        assert code in PERSON_TRADES
    assert trade_label("manoeuvre") == "Manœuvre"
    assert trade_label("boiseur") == "boiseur"
    assert trade_label(None) is None


def test_employee_trade_restricted(client: Any, db: Any) -> None:
    _rh, rh = as_role(client, db, "RH")
    base = {"first_name": "Daniel", "last_name": "Ewane", "job_title": "Manœuvre", "hire_date": str(date.today())}

    assert _unknown(client.post(f"{API}/hr/employees", headers=rh, json={**base, "trade": "Maçon"}))

    created = client.post(f"{API}/hr/employees", headers=rh, json={**base, "trade": "manoeuvre"})
    assert created.status_code == 201, created.text
    eid = created.json()["id"]
    assert created.json()["trade"] == "manoeuvre"

    listed = client.get(f"{API}/hr/employees", headers=rh, params={"trade": "manoeuvre"}).json()
    assert eid in [r["id"] for r in listed["items"]]

    assert _unknown(client.patch(f"{API}/hr/employees/{eid}", headers=rh, json={"trade": "aide maçon"}))
    res = client.patch(f"{API}/hr/employees/{eid}", headers=rh, json={"trade": "conduite_engins"})
    assert res.status_code == 200 and res.json()["trade"] == "conduite_engins", res.text
    res = client.patch(f"{API}/hr/employees/{eid}", headers=rh, json={"trade": None})
    assert res.status_code == 200 and res.json()["trade"] is None, res.text


def test_employee_legacy_trade_kept(client: Any, db: Any) -> None:
    from app.modules.hr.models import Employee

    _rh, rh = as_role(client, db, "RH")
    legacy = Employee(
        matricule=f"M-{uuid.uuid4().hex[:5]}",
        first_name="Paul",
        last_name="Ancien",
        job_title="Boiseur",
        trade="boiseur",
        hire_date=date(2020, 1, 6),
        badge_token=uuid.uuid4().hex,
    )
    db.add(legacy)
    db.commit()

    # Le code historique déjà enregistré reste accepté (formulaire renvoyé tel quel) ; un nouveau code doit être connu.
    res = client.patch(f"{API}/hr/employees/{legacy.id}", headers=rh, json={"trade": "boiseur", "phone": "690112233"})
    assert res.status_code == 200 and res.json()["trade"] == "boiseur", res.text
    assert _unknown(client.patch(f"{API}/hr/employees/{legacy.id}", headers=rh, json={"trade": "staff"}))


def test_user_trade_restricted(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    body = {
        "email": f"chef-{uuid.uuid4().hex[:6]}@example.com",
        "first_name": "Marc",
        "last_name": "Nkou",
        "role_codes": ["CHEF_CHANTIER"],
        "send_invitation": False,
    }
    assert _unknown(client.post(f"{API}/users", headers=ah, json={**body, "trade": "Électricien"}))

    created = client.post(f"{API}/users", headers=ah, json={**body, "trade": "electricite"})
    assert created.status_code == 201, created.text
    uid = created.json()["id"]
    assert created.json()["trade"] == "electricite"

    assert _unknown(client.patch(f"{API}/users/{uid}", headers=ah, json={"trade": "électricien bâtiment"}))
    res = client.patch(f"{API}/users/{uid}", headers=ah, json={"trade": "grutier"})
    assert res.status_code == 200 and res.json()["trade"] == "grutier", res.text

    from app.modules.identity.models import User

    user = db.get(User, uuid.UUID(uid))
    user.trade = "boiseur"
    db.commit()
    res = client.patch(f"{API}/users/{uid}", headers=ah, json={"trade": "boiseur", "job_title": "Chef d'équipe"})
    assert res.status_code == 200 and res.json()["trade"] == "boiseur", res.text


def test_team_trade_restricted(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    member = make_user(db, roles=["TECHNICIEN"])
    assert _unknown(client.post(f"{API}/teams", headers=ah, json={"name": "Équipe libre", "trade": "maçons"}))

    created = client.post(
        f"{API}/teams",
        headers=ah,
        json={"name": "Équipe gros œuvre", "trade": "maconnerie", "member_ids": [str(member.id)]},
    )
    assert created.status_code == 201, created.text
    tid = created.json()["id"]
    assert created.json()["trade"] == "maconnerie"

    # Le formulaire « Modifier » n'envoie que les champs changés : nom et membres sont conservés.
    res = client.patch(f"{API}/teams/{tid}", headers=ah, json={"trade": "grutier"})
    assert res.status_code == 200, res.text
    assert res.json()["trade"] == "grutier"
    assert res.json()["name"] == "Équipe gros œuvre"
    assert res.json()["member_ids"] == [str(member.id)]
    res = client.patch(f"{API}/teams/{tid}", headers=ah, json={"name": None, "trade": None})
    assert res.status_code == 200 and res.json()["name"] == "Équipe gros œuvre" and res.json()["trade"] is None

    from app.modules.identity.models import Team

    team = db.get(Team, uuid.UUID(tid))
    team.trade = "boiseur"
    db.commit()
    # Fiche renvoyée telle quelle : le code historique passe, un code libre nouveau est refusé.
    res = client.patch(f"{API}/teams/{tid}", headers=ah, json={"name": "Équipe coffrage bois", "trade": "boiseur"})
    assert res.status_code == 200 and res.json()["trade"] == "boiseur", res.text
    assert _unknown(client.patch(f"{API}/teams/{tid}", headers=ah, json={"trade": "bois"}))
    res = client.patch(f"{API}/teams/{tid}", headers=ah, json={"name": "Équipe coffrage", "trade": "coffrage"})
    assert res.status_code == 200 and res.json()["trade"] == "coffrage", res.text
    assert res.json()["member_ids"] == [str(member.id)]


def _ts_list(source: str, name: str) -> list[str]:
    start = source.index(f"export const {name}")
    block = source[start : source.index("];", start)]
    return re.findall(r'"([a-z_]+)"', block)


@pytest.mark.skipif(not LABELS_TS.exists(), reason="application web absente")
def test_web_person_trades_match_backend() -> None:
    source = LABELS_TS.read_text(encoding="utf-8")
    assert _ts_list(source, "CREW_TRADES") == list(CREW_TRADES)
    assert "...SUBCONTRACTING_TRADES" in source[source.index("export const PERSON_TRADES") :].split("\n", 1)[0]
    start = source.index("export const OPTION_LABELS")
    options = source[start : source.index("\n};", start)]
    for code, label in PERSON_TRADES.items():
        found = re.findall(rf'^\s+{code}: "([^"]+)",', options, re.MULTILINE)
        assert len(found) == 1, f"libellé web manquant ou en double pour {code}"
        assert found[0] == label, f"{code} : « {found[0]} » côté web, « {label} » côté serveur"
