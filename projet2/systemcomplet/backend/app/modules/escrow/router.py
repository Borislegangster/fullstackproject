"""API Séquestre par jalon (R1) : compte du projet, rattachement des appels de fonds, demande / validation /
contestation de libération, double validation interne."""

from __future__ import annotations

import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.database import get_db
from app.core.errors import BusinessRuleError, NotFound
from app.modules.escrow import service
from app.modules.escrow.models import EscrowAccount

router = APIRouter(tags=["Séquestre par jalon"])


def _project(db: Session, access: Access, project_id: uuid.UUID, *perms: str) -> Any:
    from app.modules.projects.models import Project

    if perms:
        access.require(*perms)
    access.require_project(project_id)
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise NotFound("Projet introuvable")
    return project


@router.get("/projects/{project_id}/escrow")
def escrow_overview(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    _project(db, access, project_id, "finance:read")
    return service.overview(db, project_id, internal=True)


class AccountIn(BaseModel):
    partner_name: str = Field(min_length=2, max_length=200)
    partner_reference: str | None = Field(default=None, max_length=120)
    review_days: int = Field(default=10, ge=3, le=60)
    terms: str | None = Field(default=None, max_length=4000)


@router.put("/projects/{project_id}/escrow")
def escrow_setup(
    project_id: uuid.UUID, data: AccountIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    project = _project(db, access, project_id, "finance:approve")
    account = service.setup(db, project, **data.model_dump())
    audit.record(
        db,
        family="business",
        module="escrow",
        action="SETUP",
        resource_type="escrow_account",
        resource_id=account.id,
        project_id=project.id,
    )
    db.commit()
    return service.overview(db, project.id, internal=True)


@router.post("/projects/{project_id}/escrow/activate")
def escrow_activate(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Activation après signature de la convention avec le partenaire (Direction)."""
    project = _project(db, access, project_id, "finance:approve")
    if not ({"DIRECTION", "ADMIN"} & set(access.p.roles)):
        raise BusinessRuleError("Activation réservée à la Direction", code="APPROVAL_ROLE_REQUIRED")
    account = service.account_for(db, project.id)
    if account is None:
        raise NotFound("Compte de séquestre non configuré")
    service.activate(db, account, user_id=access.p.id)
    audit.record(
        db,
        family="security",
        module="escrow",
        action="ACTIVATE",
        resource_type="escrow_account",
        resource_id=account.id,
        project_id=project.id,
        criticality="HIGH",
    )
    db.commit()
    return service.overview(db, project.id, internal=True)


class AttachIn(BaseModel):
    funds_call_id: uuid.UUID
    milestone_id: uuid.UUID


@router.post("/projects/{project_id}/escrow/items", status_code=201)
def escrow_attach(
    project_id: uuid.UUID, data: AttachIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.finance.models import FundsCall
    from app.modules.projects.models import Milestone

    project = _project(db, access, project_id, "finance:write")
    account = service.account_for(db, project.id)
    if account is None:
        raise NotFound("Compte de séquestre non configuré")
    call, milestone = db.get(FundsCall, data.funds_call_id), db.get(Milestone, data.milestone_id)
    if call is None or milestone is None:
        raise NotFound("Appel de fonds ou jalon introuvable")
    service.attach(db, account, funds_call=call, milestone=milestone)
    db.commit()
    return service.overview(db, project.id, internal=True)


def _item(db: Session, access: Access, item_id: uuid.UUID, *perms: str) -> Any:
    item = service.get_item(db, item_id)
    _project(db, access, item.project_id, *perms)
    return item


class ReleaseRequestIn(BaseModel):
    pv_document_id: uuid.UUID


@router.post("/escrow/items/{item_id}/request-release")
def escrow_request(
    item_id: uuid.UUID, data: ReleaseRequestIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Jalon atteint : demande de libération appuyée sur le PV et les photos certifiées."""
    item = _item(db, access, item_id, "projects:write")
    service.request_release(db, item, pv_document_id=data.pv_document_id, user_id=access.p.id)
    db.commit()
    return service.overview(db, item.project_id, internal=True)


class ReleaseIn(BaseModel):
    reference: str | None = Field(default=None, max_length=120)


@router.post("/escrow/items/{item_id}/release")
def escrow_release(
    item_id: uuid.UUID, data: ReleaseIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Double validation : 1re validation enregistrée ; la 2e (autre personne) exécute la libération."""
    item = _item(db, access, item_id, "finance:approve")
    done = service.approve_release(db, item, principal=access.p, reference=data.reference)
    db.commit()
    return {**service.overview(db, item.project_id, internal=True), "released": done}


class ResolveIn(BaseModel):
    decision: Literal["release", "refund"]
    note: str = Field(min_length=10, max_length=2000)


@router.post("/escrow/items/{item_id}/resolve")
def escrow_resolve(
    item_id: uuid.UUID, data: ResolveIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    item = _item(db, access, item_id, "finance:approve")
    if not ({"DIRECTION", "ADMIN"} & set(access.p.roles)):
        raise BusinessRuleError("Médiation réservée à la Direction", code="APPROVAL_ROLE_REQUIRED")
    service.resolve_dispute(db, item, decision=data.decision, note=data.note, principal=access.p)
    db.commit()
    return service.overview(db, item.project_id, internal=True)


@router.get("/escrow/portfolio")
def escrow_portfolio(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    """Portefeuille Finance / Direction : comptes de séquestre des projets accessibles, soldes et actions en attente."""
    from app.modules.projects.models import Project

    access.require("finance:read")
    stmt = access.filter_by_project(
        select(Project).join(EscrowAccount, EscrowAccount.project_id == Project.id),
        EscrowAccount.project_id,
        allow_null=False,
    ).where(Project.deleted_at.is_(None))
    out = []
    for project in db.execute(stmt.order_by(Project.code)).scalars():
        data = service.overview(db, project.id, internal=True)
        waiting = [i for i in data["items"] if i["status"] in ("release_requested", "approved", "disputed")]
        out.append(
            {
                "project": {"id": str(project.id), "code": project.code, "name": project.name},
                "account": data["account"],
                "items_count": len(data["items"]),
                "waiting": waiting,
            }
        )
    return out


# ---------------------------------------------------------------------------- client
@router.get("/client/projects/{project_id}/escrow")
def client_escrow(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    _project(db, access, project_id, "client:portal")
    return service.overview(db, project_id, internal=False)


@router.post("/client/escrow/items/{item_id}/otp")
def client_otp(
    item_id: uuid.UUID, channel: str = "email", db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.identity.service import issue_otp

    item = _item(db, access, item_id, "client:decide")
    if item.status != "release_requested":
        raise BusinessRuleError("Aucune demande de libération en attente", code="ESCROW_STATUS")
    result = issue_otp(
        db,
        access.p.user,
        purpose="escrow_release",
        channel=channel if channel in ("email", "sms", "whatsapp") else "email",
        payload={"item_id": str(item.id), "label": f"Libération du séquestre {item.number}"},
    )
    db.commit()
    return result


class OtpIn(BaseModel):
    otp_token: str = Field(min_length=10, max_length=200)
    code: str = Field(min_length=4, max_length=10)


@router.post("/client/escrow/items/{item_id}/approve")
def client_approve(
    item_id: uuid.UUID, data: OtpIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.identity.service import verify_otp

    item = _item(db, access, item_id, "client:decide")
    proof = verify_otp(db, access.p.user, purpose="escrow_release", otp_token=data.otp_token, code=data.code)
    if proof["payload"].get("item_id") != str(item.id):
        raise BusinessRuleError("Code émis pour une autre demande", code="OTP_INVALID")
    service.client_approve(
        db, item, user=access.p.user, proof={"verified_at": proof["verified_at"], "channel": proof["channel"]}
    )
    db.commit()
    return service.overview(db, item.project_id, internal=False)


class DisputeIn(BaseModel):
    reason: str = Field(min_length=15, max_length=2000)


@router.post("/client/escrow/items/{item_id}/dispute")
def client_dispute(
    item_id: uuid.UUID, data: DisputeIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    item = _item(db, access, item_id, "client:decide")
    service.client_dispute(db, item, user=access.p.user, reason=data.reason)
    db.commit()
    return service.overview(db, item.project_id, internal=False)
