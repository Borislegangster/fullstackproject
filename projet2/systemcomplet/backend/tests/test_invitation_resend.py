"""Renvoi d'une invitation : lien expiré, perdu ou révoqué par erreur → nouveau lien, l'ancien devient inutilisable ;
refusé pour un compte déjà activé ou désactivé ; aussi pour un client invité à la création de son projet (sans compte)."""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

import pytest
from sqlalchemy import select

from tests.conftest import PASSWORD, as_role, login, make_user

API = "/api/v1"


@pytest.fixture
def fixed_tokens(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Jetons d'invitation prévisibles (sinon seul l'e-mail les connaît)."""
    from app.modules.identity import service

    issued: list[str] = []

    def token(_size: int = 32) -> str:
        issued.append(f"jeton-test-{uuid.uuid4().hex}")
        return issued[-1]

    monkeypatch.setattr(service, "random_token", token)
    return issued


def _invitations(client: Any, headers: dict[str, str], email: str) -> list[dict[str, Any]]:
    rows = client.get(f"{API}/invitations", headers=headers).json()
    return [r for r in rows if r["email"] == email]


def test_expired_invitation_is_resent_from_the_user(client: Any, db: Any, fixed_tokens: list[str]) -> None:
    from app.core.utils import utcnow
    from app.modules.identity.models import Invitation

    admin = make_user(db, roles=["ADMIN"])
    ah = login(client, admin.email)
    email = f"chantier-{uuid.uuid4().hex[:6]}@example.com"
    created = client.post(
        f"{API}/users",
        headers=ah,
        json={"email": email, "first_name": "Ernest", "last_name": "Tchoua", "role_codes": ["CHEF_CHANTIER"]},
    )
    assert created.status_code == 201, created.text
    user_id = created.json()["id"]
    assert created.json()["activated"] is False
    first_token = fixed_tokens[-1]
    old = db.execute(select(Invitation).where(Invitation.email == email)).scalar_one()
    old.expires_at = utcnow() - timedelta(days=1)
    db.commit()
    expired = client.post(f"{API}/auth/invitations/accept", json={"token": first_token, "password": PASSWORD})
    assert expired.status_code == 400 and expired.json()["error"]["code"] == "INVALID_INVITATION"
    assert _invitations(client, ah, email)[0]["resendable"] is True

    resent = client.post(f"{API}/users/{user_id}/invitation", headers=ah, json={"channels": ["email"]})
    assert resent.status_code == 201, resent.text
    new_token = fixed_tokens[-1]
    assert new_token != first_token
    listed = _invitations(client, ah, email)
    assert [r["resendable"] for r in listed] == [True, False]  # la plus récente seule
    db.expire_all()
    assert db.get(Invitation, old.id).revoked_at is not None

    accepted = client.post(f"{API}/auth/invitations/accept", json={"token": new_token, "password": PASSWORD})
    assert accepted.status_code == 200, accepted.text
    assert "CHEF_CHANTIER" in accepted.json()["user"]["roles"]
    assert client.get(f"{API}/users/{user_id}", headers=ah).json()["activated"] is True
    assert not any(r["resendable"] for r in _invitations(client, ah, email))
    again = client.post(f"{API}/users/{user_id}/invitation", headers=ah, json={"channels": ["email"]})
    assert again.status_code == 409 and again.json()["error"]["code"] == "ALREADY_ACTIVATED"


def test_pending_link_is_replaced_and_old_one_stops_working(client: Any, db: Any, fixed_tokens: list[str]) -> None:
    admin = make_user(db, roles=["ADMIN"])
    ah = login(client, admin.email)
    email = f"achat-{uuid.uuid4().hex[:6]}@example.com"
    created = client.post(
        f"{API}/users",
        headers=ah,
        json={"email": email, "first_name": "Linda", "last_name": "Mbarga", "role_codes": ["ACHETEUR"]},
    )
    first_token = fixed_tokens[-1]
    invitation_id = _invitations(client, ah, email)[0]["id"]
    resent = client.post(f"{API}/invitations/{invitation_id}/resend", headers=ah, json={"message": "Nouveau lien"})
    assert resent.status_code == 201, resent.text
    stale = client.post(f"{API}/auth/invitations/accept", json={"token": first_token, "password": PASSWORD})
    assert stale.status_code == 400
    fresh = client.post(f"{API}/auth/invitations/accept", json={"token": fixed_tokens[-1], "password": PASSWORD})
    assert fresh.status_code == 200, fresh.text
    assert created.json()["id"] == fresh.json()["user"]["id"]


def test_client_invited_with_project_can_get_a_new_link(client: Any, db: Any, fixed_tokens: list[str]) -> None:
    """Client invité automatiquement (contrat signé → projet) : pas encore de compte, la dernière invitation fait foi
    (rôle client, projet) ; le nouveau lien ouvre bien le projet."""
    from app.core.utils import utcnow
    from app.modules.identity.models import Invitation
    from app.modules.identity.service import invite_user
    from app.modules.projects.models import Project, ProjectMember

    admin = make_user(db, roles=["ADMIN"])
    project = Project(code=f"PRJ-T-{uuid.uuid4().hex[:5]}", name="Villa test", status="etude")
    db.add(project)
    db.flush()
    email = f"client-{uuid.uuid4().hex[:6]}@example.com"
    invitation, _token = invite_user(
        db,
        inviter=admin,
        email=email,
        first_name="Paul",
        last_name="Mballa",
        role_codes=["CLIENT"],
        organization_id=None,
        project_ids=[project.id],
        message=None,
    )
    invitation.expires_at = utcnow() - timedelta(days=2)
    db.commit()
    ah = login(client, admin.email)
    resent = client.post(f"{API}/invitations/{invitation.id}/resend", headers=ah, json={"channels": ["email"]})
    assert resent.status_code == 201, resent.text
    db.expire_all()
    renewed = db.get(Invitation, uuid.UUID(resent.json()["invitation_id"]))
    assert renewed.role_codes == ["CLIENT"] and renewed.project_ids == [str(project.id)]
    accepted = client.post(f"{API}/auth/invitations/accept", json={"token": fixed_tokens[-1], "password": PASSWORD})
    assert accepted.status_code == 200, accepted.text
    member = db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == uuid.UUID(accepted.json()["user"]["id"]),
        )
    ).scalar_one()
    assert member.project_role == "client"
    used = client.post(f"{API}/invitations/{renewed.id}/resend", headers=ah, json={"channels": ["email"]})
    assert used.status_code == 409


def test_resend_is_guarded(client: Any, db: Any) -> None:
    admin = make_user(db, roles=["ADMIN"])
    ah = login(client, admin.email)
    email = f"tech-{uuid.uuid4().hex[:6]}@example.com"
    user_id = client.post(
        f"{API}/users",
        headers=ah,
        json={"email": email, "first_name": "Moussa", "last_name": "Bello", "role_codes": ["TECHNICIEN"]},
    ).json()["id"]
    _cdp, ph = as_role(client, db, "CHEF_PROJET")
    forbidden = client.post(f"{API}/users/{user_id}/invitation", headers=ph, json={"channels": ["email"]})
    assert forbidden.status_code == 403
    assert client.patch(f"{API}/users/{user_id}", headers=ah, json={"is_active": False}).status_code == 200
    disabled = client.post(f"{API}/users/{user_id}/invitation", headers=ah, json={"channels": ["email"]})
    assert disabled.status_code == 422 and disabled.json()["error"]["code"] == "ACCOUNT_DISABLED"
    active = make_user(db, roles=["TECHNICIEN"])
    done = client.post(f"{API}/users/{active.id}/invitation", headers=ah, json={"channels": ["email"]})
    assert done.status_code == 409 and done.json()["error"]["code"] == "ALREADY_ACTIVATED"
