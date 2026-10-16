"""Politique d'accès : aucune auto-inscription ; comptes créés par l'administration ou automatiquement après la
validation du parcours commercial (contrat signé → projet) ; accès sur invitation à usage unique (e-mail et/ou
WhatsApp), mot de passe choisi à l'activation, double authentification imposée aux clients."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select

from tests.conftest import PASSWORD, as_role, login, make_user

API = "/api/v1"


def _deliveries(db: Any, recipient: str) -> list[str]:
    from app.modules.notifications.models import NotificationDelivery

    db.expire_all()
    rows = db.execute(select(NotificationDelivery).where(NotificationDelivery.recipient == recipient)).scalars()
    return sorted(r.channel for r in rows)


def test_no_public_self_registration(client: Any) -> None:
    resp = client.post(
        f"{API}/auth/register",
        json={"first_name": "A", "last_name": "B", "email": "a@b.cm", "password": "Tres-Long-Secret-2026"},
    )
    assert resp.status_code in (404, 405)


def test_admin_invites_client_by_email_and_whatsapp(client: Any, db: Any) -> None:
    from app.modules.identity.models import Invitation, User

    admin = make_user(db, roles=["ADMIN"])
    ah = login(client, admin.email)
    email = f"client-{uuid.uuid4().hex[:6]}@example.com"
    created = client.post(
        f"{API}/users",
        headers=ah,
        json={
            "email": email,
            "first_name": "Aïcha",
            "last_name": "Mballa",
            "whatsapp": "+237 690 11 22 33",
            "role_codes": ["CLIENT"],
            "invitation_channels": ["email", "whatsapp"],
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["invitation_id"]
    assert _deliveries(db, email) == ["email"]
    assert _deliveries(db, "+237690112233") == ["whatsapp"]
    user = db.execute(select(User).where(User.email == email)).scalar_one()
    assert user.mfa_required is True and not user.password_hash
    invitation = db.execute(select(Invitation).where(Invitation.email == email)).scalar_one()
    assert invitation.accepted_at is None


def test_invitation_activation_imposes_mfa_for_clients(client: Any, db: Any) -> None:
    from app.modules.identity.models import User
    from app.modules.identity.service import invite_user

    inviter = make_user(db, roles=["ADMIN"])
    email = f"invite-{uuid.uuid4().hex[:6]}@example.com"
    _invitation, token = invite_user(
        db,
        inviter=inviter,
        email=email,
        first_name="Paul",
        last_name="Ekotto",
        role_codes=["CLIENT"],
        organization_id=None,
        project_ids=[],
        message=None,
    )
    db.commit()
    info = client.get(f"{API}/auth/invitations/{token}")
    assert info.status_code == 200 and info.json()["email"] == email
    accepted = client.post(f"{API}/auth/invitations/accept", json={"token": token, "password": PASSWORD})
    assert accepted.status_code == 200, accepted.text
    me = accepted.json()["user"]
    assert me["mfa_required"] is True and me["mfa_enabled"] is False and "client" in me["spaces"]
    user = db.execute(select(User).where(User.email == email)).scalar_one()
    assert user.mfa_required is True
    reused = client.post(f"{API}/auth/invitations/accept", json={"token": token, "password": PASSWORD})
    assert reused.status_code == 400 and reused.json()["error"]["code"] == "INVALID_INVITATION"


def test_first_admin_bootstrap_by_invitation_without_any_password_in_transit(client: Any, db: Any) -> None:
    """Mise en service : le premier administrateur reçoit un lien d'activation (aucun invitant, aucun mot de passe
    transmis) ; il choisit son mot de passe à l'activation."""
    from app.modules.identity.models import Invitation
    from app.modules.identity.service import invite_user

    email = f"admin-{uuid.uuid4().hex[:6]}@example.com"
    invitation, token = invite_user(
        db,
        inviter=None,
        email=email,
        first_name="Boris",
        last_name="Admin",
        role_codes=["ADMIN"],
        organization_id=None,
        project_ids=[],
        message=None,
    )
    db.commit()
    assert invitation.invited_by_id is None and _deliveries(db, email) == ["email"]
    row = db.execute(select(Invitation).where(Invitation.email == email)).scalar_one()
    assert row.token_hash != token
    accepted = client.post(f"{API}/auth/invitations/accept", json={"token": token, "password": PASSWORD})
    assert accepted.status_code == 200, accepted.text
    assert "ADMIN" in accepted.json()["user"]["roles"]


def test_signed_contract_opens_client_access_automatically(client: Any, db: Any) -> None:
    from app.modules.crm.models import Contact, Contract
    from app.modules.identity.models import Invitation, Organization
    from app.modules.projects.models import ProjectMember

    _commercial, ch = as_role(client, db, "DIRECTION")
    org = Organization(name=f"Famille Ndzana {uuid.uuid4().hex[:4]}", kind="client")
    db.add(org)
    db.flush()
    email = f"ndzana-{uuid.uuid4().hex[:6]}@example.com"
    contact = Contact(
        organization_id=org.id, first_name="Brice", last_name="Ndzana", email=email, whatsapp="+237 677 55 44 33"
    )
    db.add(contact)
    db.flush()
    contract = Contract(
        number=f"CT-T-{uuid.uuid4().hex[:6]}",
        organization_id=org.id,
        contact_id=contact.id,
        title="Villa R+1 Logpom",
        status="signed",
    )
    db.add(contract)
    db.commit()
    resp = client.post(f"{API}/crm/contracts/{contract.id}/project", headers=ch, json={})
    assert resp.status_code == 201, resp.text
    project_id = uuid.UUID(resp.json()["project_id"])
    invitation = db.execute(select(Invitation).where(Invitation.email == email)).scalar_one()
    assert invitation.role_codes == ["CLIENT"] and invitation.project_ids == [str(project_id)]
    assert _deliveries(db, email) == ["email"] and _deliveries(db, "+237677554433") == ["whatsapp"]

    # Client déjà titulaire d'un compte actif : simplement rattaché au nouveau projet (pas de nouvelle invitation).
    returning = make_user(db, email=f"retour-{uuid.uuid4().hex[:6]}@example.com", roles=["CLIENT"], org_kind="client")
    contact2 = Contact(organization_id=org.id, first_name="Ruth", last_name="Ndzana", email=returning.email)
    db.add(contact2)
    db.flush()
    contract2 = Contract(
        number=f"CT-T-{uuid.uuid4().hex[:6]}",
        organization_id=org.id,
        contact_id=contact2.id,
        title="Extension",
        status="signed",
    )
    db.add(contract2)
    db.commit()
    second = client.post(f"{API}/crm/contracts/{contract2.id}/project", headers=ch, json={})
    assert second.status_code == 201, second.text
    member = db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == uuid.UUID(second.json()["project_id"]), ProjectMember.user_id == returning.id
        )
    ).scalar_one()
    assert member.project_role == "client"
