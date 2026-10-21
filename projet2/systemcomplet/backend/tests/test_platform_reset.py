"""Remise à zéro des données d'exploitation : sauvegarde préalable, comptes / projets / données métier supprimés,
site, CMS, médiathèque, paramètres et intégrations conservés, journal d'audit repartant de l'opération, nouvel
administrateur invité ; réservée à l'administrateur avec accès d'urgence « purge »."""

from __future__ import annotations

import uuid
from typing import Any

import pyotp
from sqlalchemy import func, select

from tests.conftest import as_role, login, make_user

API = "/api/v1"


def _admin_with_mfa(client: Any, db: Any) -> tuple[Any, dict[str, str], list[str]]:
    admin = make_user(db, email=f"admin-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    headers = login(client, admin.email)
    setup = client.post(f"{API}/auth/mfa/totp/setup", headers=headers).json()
    confirm = client.post(
        f"{API}/auth/mfa/totp/confirm", headers=headers, json={"code": pyotp.TOTP(setup["secret"]).now()}
    )
    assert confirm.status_code == 200, confirm.text
    return admin, headers, confirm.json()["codes"]


def _count(db: Any, model: Any) -> int:
    return int(db.scalar(select(func.count()).select_from(model)) or 0)


def test_reset_keeps_site_and_settings_and_wipes_operations(client: Any, db: Any) -> None:
    from app.core import audit
    from app.modules.bim.models import DisciplineLayer
    from app.modules.cms import models as cms
    from app.modules.crm.models import Lead
    from app.modules.identity.models import Invitation, Organization, User
    from app.modules.projects.models import Project, WorkCalendar
    from app.modules.system.models import AuditEvent, BackupJob, NumberSequence, Setting

    admin, ah, recovery = _admin_with_mfa(client, db)
    # À conserver : contenu du site, média, paramètre, calendrier et discipline généraux, organisation interne.
    page = cms.CmsPage(route_key="reset-test", path="/reset-test", title="Page conservée", created_by_id=admin.id)
    media = cms.MediaAsset(kind="image", title="Logo conservé", author_id=admin.id)
    internal = Organization(name="GLOBUS ENGINEERING (test)", kind="internal")
    db.add_all([page, media, internal])
    db.add(Setting(key="test.reset.kept", value={"v": 1}, category="test"))
    company_calendar = WorkCalendar(name="Calendrier entreprise")
    global_layer = DisciplineLayer(key="arch-test", name="Architecture test")
    db.add_all([company_calendar, global_layer])
    # À supprimer : projet (et ses référentiels propres), prospect, client, autre compte.
    project = Project(code="PRJ-TEST-RESET", name="Projet à supprimer", status="etude")
    db.add(project)
    db.flush()
    project_calendar = WorkCalendar(name="Calendrier du projet", project_id=project.id)
    project_layer = DisciplineLayer(key="arch-prj", name="Architecture projet", project_id=project.id)
    client_org = Organization(name="Client à supprimer", kind="client")
    db.add_all([project_calendar, project_layer, client_org])
    db.add(Lead(number="L-TEST-1", first_name="Paul", last_name="Prospect", email="paul@example.com"))
    db.add(NumberSequence(key="project", next_value=42))
    db.commit()
    ids = {
        "page": page.id,
        "media": media.id,
        "internal": internal.id,
        "client_org": client_org.id,
        "company_calendar": company_calendar.id,
        "project_calendar": project_calendar.id,
        "global_layer": global_layer.id,
        "project_layer": project_layer.id,
    }
    _other, oh = as_role(client, db, "CHEF_PROJET")

    preview = client.get(f"{API}/admin/reset/preview", headers=ah)
    assert preview.status_code == 200, preview.text
    assert preview.json()["confirmation"] == "REMETTRE A ZERO"
    deleted = {g["label"]: g["count"] for g in preview.json()["deleted"]}
    assert deleted["Comptes et accès"] >= 2 and deleted["Projets et chantiers"] >= 1
    assert client.get(f"{API}/admin/reset/preview", headers=oh).status_code == 403

    grant = client.post(
        f"{API}/admin/break-glass",
        headers=ah,
        json={"scope": "purge", "justification": "Remise à zéro avant la recette", "code": recovery[0]},
    )
    assert grant.status_code == 201, grant.text
    body = {"break_glass_id": grant.json()["id"], "confirmation": "REMETTRE A ZERO"}
    wrong = client.post(
        f"{API}/admin/reset", headers=ah, json={**body, "confirmation": "oui"} | {"admin_email": "x@y.cm"}
    )
    assert wrong.status_code == 422
    done = client.post(
        f"{API}/admin/reset", headers=ah, json={**body, "admin_email": "contact@globus-engineering-sarl.com"}
    )
    assert done.status_code == 200, done.text
    result = done.json()
    assert result["admin_email"] == "contact@globus-engineering-sarl.com" and result["deleted_rows"] > 0

    db.expire_all()
    users = db.execute(select(User)).scalars().all()
    assert [u.email for u in users] == ["contact@globus-engineering-sarl.com"]
    assert users[0].password_hash is None and users[0].mfa_required is True and "ADMIN" in users[0].role_codes
    invitation = db.execute(select(Invitation)).scalar_one()
    assert invitation.email == "contact@globus-engineering-sarl.com" and invitation.role_codes == ["ADMIN"]
    assert _count(db, Project) == 0 and _count(db, Lead) == 0 and _count(db, NumberSequence) == 0
    kept_page = db.get(cms.CmsPage, ids["page"])
    assert kept_page is not None and kept_page.created_by_id is None
    assert db.get(cms.MediaAsset, ids["media"]) is not None
    assert db.execute(select(Setting).where(Setting.key == "test.reset.kept")).scalar_one().value == {"v": 1}
    assert (
        db.get(WorkCalendar, ids["company_calendar"]) is not None
        and db.get(WorkCalendar, ids["project_calendar"]) is None
    )
    assert (
        db.get(DisciplineLayer, ids["global_layer"]) is not None
        and db.get(DisciplineLayer, ids["project_layer"]) is None
    )
    assert db.get(Organization, ids["internal"]) is not None and db.get(Organization, ids["client_org"]) is None
    assert users[0].organization_id is not None
    backup = db.get(BackupJob, uuid.UUID(result["backup_id"]))
    assert backup is not None and backup.status == "success" and backup.kind == "pre_destructive"
    actions = [e.action for e in db.execute(select(AuditEvent).order_by(AuditEvent.seq)).scalars()]
    assert actions[-1] == "DATA_RESET" and len(actions) <= 3
    assert audit.verify_chain(db)["valid"] is True
    # Les anciennes sessions (dont celle de l'administrateur qui a lancé l'opération) sont fermées.
    assert client.get(f"{API}/auth/me", headers=ah).status_code == 401


def test_reset_requires_admin_purge_grant(client: Any, db: Any) -> None:
    _admin, ah, _codes = _admin_with_mfa(client, db)
    no_grant = client.post(
        f"{API}/admin/reset",
        headers=ah,
        json={
            "break_glass_id": str(uuid.uuid4()),
            "confirmation": "REMETTRE A ZERO",
            "admin_email": "contact@globus-engineering-sarl.com",
        },
    )
    assert no_grant.status_code == 403 and no_grant.json()["error"]["code"] == "BREAK_GLASS_INVALID"
    _fin, fh = as_role(client, db, "FINANCE")
    refused = client.post(
        f"{API}/admin/reset",
        headers=fh,
        json={
            "break_glass_id": str(uuid.uuid4()),
            "confirmation": "REMETTRE A ZERO",
            "admin_email": "contact@globus-engineering-sarl.com",
        },
    )
    assert refused.status_code == 403
