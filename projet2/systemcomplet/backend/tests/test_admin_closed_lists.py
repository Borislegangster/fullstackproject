"""Aucune valeur technique saisie par les administrateurs : disciplines en liste fermée (profil utilisateur, membres de
projet), clé des calques BIM et code des rôles dérivés du nom, métier des canaux de messagerie contrôlé, fiche d'équipe
sans identifiant, profil utilisateur modifiable sans vider un champ obligatoire."""

from __future__ import annotations

import re
import uuid
from pathlib import Path
from typing import Any

import pytest

from app.core.permissions import PERMISSIONS
from tests.conftest import login, make_user

API = "/api/v1"
ADMIN_USERS_TSX = (
    Path(__file__).resolve().parents[2] / "apps" / "web" / "src" / "components" / "erp" / "admin-users.tsx"
)


def _admin(client: Any, db: Any) -> dict[str, str]:
    admin = make_user(db, email=f"admin-listes-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    return login(client, admin.email)


def _project(client: Any, ah: dict[str, str]) -> dict[str, Any]:
    res = client.post(f"{API}/projects", headers=ah, json={"name": "Villa Bonapriso", "status": "execution"})
    assert res.status_code == 201, res.text
    return res.json()


def _code(res: Any) -> str:
    return res.json()["error"]["code"]


def test_user_disciplines_from_reference(client: Any, db: Any) -> None:
    from app.modules.bim.models import DisciplineLayer

    ah = _admin(client, db)
    # Ligne globale en double (l'unicité ne joue pas quand project_id est NULL) : une seule case par discipline.
    db.add(DisciplineLayer(project_id=None, key="structure", name="Structure", sort_order=1))
    db.commit()
    reference = client.get(f"{API}/bim/disciplines", headers=ah).json()
    keys = [d["key"] for d in reference]
    assert {"architecture", "structure", "electricite"} <= set(keys)
    assert len(keys) == len(set(keys))
    assert all(d["name"] for d in reference)

    body = {"first_name": "Ines", "last_name": "Mbarga", "role_codes": ["INGENIEUR"], "send_invitation": False}
    bad = client.post(f"{API}/users", headers=ah, json={**body, "email": "ines1@example.com", "disciplines": ["Archi"]})
    assert bad.status_code == 422 and _code(bad) == "UNKNOWN_DISCIPLINE"
    org_id = client.get(f"{API}/organizations", headers=ah).json()["items"][0]["id"]
    created = client.post(
        f"{API}/users",
        headers=ah,
        json={**body, "email": "ines2@example.com", "disciplines": ["structure"], "organization_id": org_id},
    )
    assert created.status_code == 201, created.text
    uid = created.json()["id"]
    # « Modifier » est prérempli avec l'organisation ; son libellé se lit par identifiant.
    assert created.json()["organization_id"] == org_id
    org = client.get(f"{API}/organizations/{org_id}", headers=ah)
    assert org.status_code == 200 and org.json()["name"], org.text
    assert client.get(f"{API}/organizations/{uuid.uuid4()}", headers=ah).status_code == 404

    res = client.patch(f"{API}/users/{uid}", headers=ah, json={"disciplines": ["structure", "plomberie"]})
    assert res.status_code == 200 and res.json()["disciplines"] == ["structure", "plomberie"], res.text
    res = client.patch(f"{API}/users/{uid}", headers=ah, json={"disciplines": ["charpente_bois"]})
    assert res.status_code == 422 and _code(res) == "UNKNOWN_DISCIPLINE"

    # Valeur historique conservée ; champs obligatoires jamais vidés par un formulaire partiel.
    from app.modules.identity.models import User

    user = db.get(User, uuid.UUID(uid))
    user.disciplines = ["facades"]
    db.commit()
    res = client.patch(f"{API}/users/{uid}", headers=ah, json={"disciplines": ["facades", "vrd"], "first_name": None})
    assert res.status_code == 200, res.text
    assert res.json()["disciplines"] == ["facades", "vrd"] and res.json()["first_name"] == "Ines"
    assert client.patch(f"{API}/users/{uid}", headers=ah, json={"last_name": ""}).status_code == 422


def test_project_member_disciplines_from_project_layers(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    project = _project(client, ah)
    engineer = make_user(db, roles=["INGENIEUR"])
    members = f"{API}/projects/{project['id']}/members"

    bad = client.post(members, headers=ah, json={"user_id": str(engineer.id), "disciplines": ["electricity"]})
    assert bad.status_code == 422 and _code(bad) == "UNKNOWN_DISCIPLINE"

    # Calque propre au projet : clé dérivée du nom, aucune saisie technique.
    layer = client.put(
        f"{API}/projects/{project['id']}/bim/disciplines", headers=ah, json={"name": "Façades & bardage"}
    )
    assert layer.status_code == 200, layer.text
    assert "facades_bardage" in [d["key"] for d in layer.json()]
    again = client.put(f"{API}/projects/{project['id']}/bim/disciplines", headers=ah, json={"name": "Façades bardage"})
    assert again.status_code == 409 and _code(again) == "DISCIPLINE_EXISTS"
    renamed = client.put(
        f"{API}/projects/{project['id']}/bim/disciplines",
        headers=ah,
        json={"key": "facades_bardage", "name": "Façades et bardage", "color": "#112233"},
    )
    assert renamed.status_code == 200
    assert next(d for d in renamed.json() if d["key"] == "facades_bardage")["name"] == "Façades et bardage"

    ok = client.post(
        members, headers=ah, json={"user_id": str(engineer.id), "disciplines": ["structure", "facades_bardage"]}
    )
    assert ok.status_code == 201, ok.text
    listed = client.get(members, headers=ah).json()
    assert next(m for m in listed if m["user_id"] == str(engineer.id))["disciplines"] == [
        "structure",
        "facades_bardage",
    ]


def test_role_code_derived_from_name(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    first = client.post(
        f"{API}/roles", headers=ah, json={"name": "Conducteur d'engins", "permissions": ["projects:read"]}
    )
    assert first.status_code == 201, first.text
    assert first.json()["code"] == "CONDUCTEUR_D_ENGINS"
    second = client.post(f"{API}/roles", headers=ah, json={"name": "Conducteur d’engins", "permissions": []})
    assert second.status_code == 201 and second.json()["code"] == "CONDUCTEUR_D_ENGINS_2", second.text
    digits = client.post(f"{API}/roles", headers=ah, json={"name": "2e équipe", "permissions": []})
    assert digits.status_code == 201 and digits.json()["code"] == "ROLE_2E_EQUIPE", digits.text


def test_trade_channel_checked_and_labelled(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    project = _project(client, ah)
    channel = f"{API}/conversations/project-channel"
    bad = client.post(channel, headers=ah, json={"project_id": project["id"], "trade": "maçons"})
    assert bad.status_code == 422 and _code(bad) == "UNKNOWN_TRADE"
    ok = client.post(channel, headers=ah, json={"project_id": project["id"], "trade": "maconnerie"})
    assert ok.status_code == 200, ok.text
    assert ok.json()["title"] == "Villa Bonapriso — Maçonnerie"
    again = client.post(channel, headers=ah, json={"project_id": project["id"], "trade": "maconnerie"})
    assert again.json()["id"] == ok.json()["id"]


def test_team_out_has_readable_names(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    leader = make_user(db, roles=["CHEF_CHANTIER"], first_name="Paul", last_name="Ngando")
    worker = make_user(db, roles=["TECHNICIEN"], first_name="Aline", last_name="Ebode")
    team = client.post(
        f"{API}/teams",
        headers=ah,
        json={"name": "Équipe VRD", "leader_id": str(leader.id), "member_ids": [str(leader.id), str(worker.id)]},
    )
    assert team.status_code == 201, team.text
    data = team.json()
    assert data["leader_name"] == "Paul Ngando"
    assert data["member_names"] == ["Aline Ebode", "Paul Ngando"]
    assert data["member_ids"] == [str(worker.id), str(leader.id)]


def test_global_disciplines_seeded_once_and_deduplicated(db: Any) -> None:
    from sqlalchemy import delete, func, select

    from app.modules.bim.models import DisciplineLayer
    from app.modules.system.bootstrap import ensure_reference_data

    def counts() -> dict[str, int]:
        rows = db.execute(
            select(DisciplineLayer.key, func.count())
            .where(DisciplineLayer.project_id.is_(None))
            .group_by(DisciplineLayer.key)
        ).all()
        return dict(rows)

    # Base vierge : le démarrage sème chaque discipline une seule fois (session sans autoflush).
    db.execute(delete(DisciplineLayer).where(DisciplineLayer.project_id.is_(None)))
    ensure_reference_data(db)
    db.flush()
    assert counts() and set(counts().values()) == {1}

    # Doublons hérités : supprimés au démarrage suivant.
    db.add(DisciplineLayer(project_id=None, key="structure", name="Structure", sort_order=1))
    db.flush()
    assert counts()["structure"] == 2
    ensure_reference_data(db)
    db.flush()
    assert set(counts().values()) == {1}


@pytest.mark.skipif(not ADMIN_USERS_TSX.exists(), reason="application web absente")
def test_every_permission_module_has_a_french_label() -> None:
    source = ADMIN_USERS_TSX.read_text(encoding="utf-8")
    start = source.index("const PERMISSION_MODULES")
    labelled = set(re.findall(r"^\s+([a-z_]+): \"", source[start : source.index("};", start)], re.MULTILINE))
    modules = {p.code.split(":", 1)[0] for p in PERMISSIONS}
    assert modules <= labelled, f"modules sans libellé dans la matrice des rôles : {sorted(modules - labelled)}"
