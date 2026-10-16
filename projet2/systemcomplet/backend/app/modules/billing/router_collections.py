"""API Recouvrement (A6) : liens de paiement (équipe, public), échéanciers (client, finance)."""

from __future__ import annotations

import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.database import get_db
from app.core.errors import BusinessRuleError, NotFound
from app.core.idempotency import Idempotency, idempotency
from app.core.middleware import client_ip
from app.core.ratelimit import rate_limit
from app.core.utils import jsonable
from app.modules.billing import collections
from app.modules.billing.models import PaymentPlan

router = APIRouter(tags=["Recouvrement"])
public = APIRouter(prefix="/public/pay", tags=["Paiement par lien (public)"])

TargetType = Literal["client_invoice", "funds_call"]


def _target_project(db: Session, target_type: str, target_id: uuid.UUID) -> Any:
    obj = collections._target(db, target_type, target_id)
    return obj, getattr(obj, "project_id", None)


# ---------------------------------------------------------------------------- équipe
class PayLinkIn(BaseModel):
    target_type: TargetType
    target_id: uuid.UUID


@router.post("/pay-links", status_code=201)
def create_link(data: PayLinkIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict:
    """Lien de paiement à transmettre au client (e-mail, WhatsApp, SMS) — paie le solde restant dû."""
    access.require("billing:write")
    _, project_id = _target_project(db, data.target_type, data.target_id)
    if project_id:
        access.require_project(project_id)
    link, url = collections.create_pay_link(
        db, target_type=data.target_type, target_id=data.target_id, channel="manual", created_by_id=access.p.id
    )
    audit.record(
        db,
        family="business",
        module="billing",
        action="PAY_LINK",
        resource_type=data.target_type,
        resource_id=data.target_id,
        project_id=project_id,
    )
    db.commit()
    return {"url": url, "expires_at": jsonable(link.expires_at)}


def _plan(db: Session, plan_id: uuid.UUID) -> PaymentPlan:
    plan = db.get(PaymentPlan, plan_id)
    if plan is None:
        raise NotFound("Échéancier introuvable")
    return plan


@router.get("/payment-plans")
def list_plans(
    status: str | None = None,
    project_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    access.require("billing:read")
    stmt = access.filter_by_project(select(PaymentPlan), PaymentPlan.project_id)
    if status:
        stmt = stmt.where(PaymentPlan.status == status)
    if project_id:
        stmt = stmt.where(PaymentPlan.project_id == project_id)
    return [collections.plan_out(db, p) for p in db.execute(stmt.order_by(PaymentPlan.created_at.desc())).scalars()]


class InstallmentIn(BaseModel):
    due_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    amount: str = Field(pattern=r"^\d+(\.\d{1,2})?$")


class ProposeIn(BaseModel):
    installments: list[InstallmentIn] | None = Field(default=None, max_length=24)
    note: str | None = Field(default=None, max_length=2000)


@router.post("/payment-plans/{plan_id}/propose")
def propose(
    plan_id: uuid.UUID, data: ProposeIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Validation finance (proposition d'origine ou échéances ajustées) : le client accepte ensuite par OTP."""
    access.require("billing:write")
    plan = _plan(db, plan_id)
    if plan.project_id:
        access.require_project(plan.project_id)
    collections.propose_plan(
        db,
        plan,
        user_id=access.p.id,
        installments=[i.model_dump() for i in data.installments] if data.installments else None,
        note=data.note,
    )
    db.commit()
    return collections.plan_out(db, plan)


class RejectIn(BaseModel):
    note: str = Field(min_length=5, max_length=2000)


@router.post("/payment-plans/{plan_id}/reject")
def reject(
    plan_id: uuid.UUID, data: RejectIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("billing:write")
    plan = _plan(db, plan_id)
    if plan.project_id:
        access.require_project(plan.project_id)
    collections.reject_plan(db, plan, user_id=access.p.id, note=data.note)
    db.commit()
    return collections.plan_out(db, plan)


# ---------------------------------------------------------------------------- client
def _client_plan(db: Session, access: Access, plan_id: uuid.UUID) -> PaymentPlan:
    access.require("client:pay")
    plan = _plan(db, plan_id)
    if plan.project_id is None:
        raise NotFound("Échéancier introuvable")
    access.require_project(plan.project_id)
    return plan


@router.get("/client/payment-plans")
def my_plans(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    access.require("client:portal")
    scope = access.project_scope()
    stmt = select(PaymentPlan)
    if scope is not None:
        stmt = stmt.where(PaymentPlan.project_id.in_(scope or [uuid.uuid4()]))
    rows = db.execute(stmt.order_by(PaymentPlan.created_at.desc())).scalars().all()
    for plan in rows:
        collections.refresh_plan(db, plan)
    db.commit()
    return [collections.plan_out(db, p) for p in rows]


class PlanRequestIn(BaseModel):
    target_type: TargetType
    target_id: uuid.UUID
    count: int = Field(ge=2, le=12)
    reason: str | None = Field(default=None, max_length=2000)


@router.post("/client/payment-plans", status_code=201)
def request_plan(
    data: PlanRequestIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Demande d'échelonnement (validation par notre service comptable, puis acceptation par code)."""
    access.require("client:pay")
    _, project_id = _target_project(db, data.target_type, data.target_id)
    if project_id is None:
        raise NotFound("Pièce introuvable")
    access.require_project(project_id)
    plan = collections.request_plan(
        db,
        target_type=data.target_type,
        target_id=data.target_id,
        user=access.p.user,
        count=data.count,
        reason=data.reason,
    )
    db.commit()
    return collections.plan_out(db, plan)


@router.post("/client/payment-plans/{plan_id}/otp")
def plan_otp(
    plan_id: uuid.UUID, channel: str = "email", db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.identity.service import issue_otp

    plan = _client_plan(db, access, plan_id)
    if plan.status != "proposed":
        raise BusinessRuleError("Aucune proposition à accepter", code="PLAN_NOT_PROPOSED")
    if channel not in ("email", "sms", "whatsapp"):
        raise BusinessRuleError("Canal inconnu")
    result = issue_otp(
        db,
        access.p.user,
        purpose="payment_plan",
        channel=channel,
        payload={"plan_id": str(plan.id), "label": f"Acceptation de l'échéancier {plan.number}"},
    )
    db.commit()
    return result


class AcceptIn(BaseModel):
    otp_token: str = Field(min_length=10, max_length=200)
    code: str = Field(min_length=4, max_length=10)


@router.post("/client/payment-plans/{plan_id}/accept")
def accept(
    plan_id: uuid.UUID,
    data: AcceptIn,
    request: Request,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    from app.modules.identity.service import verify_otp

    plan = _client_plan(db, access, plan_id)
    proof = verify_otp(db, access.p.user, purpose="payment_plan", otp_token=data.otp_token, code=data.code)
    if proof["payload"].get("plan_id") != str(plan.id):
        raise BusinessRuleError("Code émis pour un autre échéancier", code="OTP_INVALID")
    collections.accept_plan(
        db,
        plan,
        user=access.p.user,
        otp={"verified_at": proof["verified_at"], "channel": proof["channel"], "token_id": proof["token_id"]},
        ip=client_ip(request.scope),
    )
    db.commit()
    return collections.plan_out(db, plan)


# ---------------------------------------------------------------------------- public (lien de paiement)
@public.get("/{token}", dependencies=[Depends(rate_limit("paylink", "60/minute"))])
def pay_link(token: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    return collections.pay_link_view(db, collections.resolve_pay_link(db, token))


class PayIn(BaseModel):
    provider: str = Field(min_length=3, max_length=20)
    method: str = Field(min_length=2, max_length=30)
    payer_name: str = Field(min_length=2, max_length=150)
    payer_phone: str | None = Field(default=None, max_length=30)
    payer_email: EmailStr | None = None


@public.post("/{token}/checkout", status_code=201, dependencies=[Depends(rate_limit("paylink_pay", "20/hour"))])
def pay(
    token: str,
    data: PayIn,
    db: Session = Depends(get_db),
    idem: Idempotency = Depends(idempotency(required=True)),
) -> Any:
    if idem.replay is not None:
        return idem.replay
    link = collections.resolve_pay_link(db, token)
    result = collections.pay_with_link(
        db,
        link,
        provider=data.provider,
        method=data.method,
        payer=collections.Payer(full_name=data.payer_name, email=data.payer_email, phone=data.payer_phone),
        idempotency_key=idem.key or "",
    )
    return idem.complete(db, jsonable(result), status_code=201)


@public.get("/{token}/transactions/{transaction_id}", dependencies=[Depends(rate_limit("paylink", "60/minute"))])
def pay_status(token: str, transaction_id: uuid.UUID, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Suivi d'un paiement initié par ce lien (validation MoMo sur le téléphone, retour de la page opérateur)."""
    from app.modules.finance.models import Payment, PaymentAllocation, PaymentTransaction
    from app.modules.finance.payments import refresh_transaction

    link = collections.resolve_pay_link(db, token)
    tx = db.get(PaymentTransaction, transaction_id)
    if tx is None:
        raise NotFound("Paiement introuvable")
    allocation = db.execute(
        select(PaymentAllocation).where(
            PaymentAllocation.payment_id == tx.payment_id,
            PaymentAllocation.target_type == link.target_type,
            PaymentAllocation.target_id == link.target_id,
        )
    ).first()
    if allocation is None:
        raise NotFound("Paiement introuvable")
    if tx.status == "pending":
        refresh_transaction(db, tx, min_interval_s=10, confirmed_by="reconciliation")
    payment = db.get(Payment, tx.payment_id)
    db.commit()
    return jsonable(
        {
            "status": payment.status if payment else tx.status,
            "transaction_status": tx.status,
            "amount": tx.amount,
            "currency": tx.currency,
            "number": payment.number if payment else None,
            "failure_reason": tx.failure_reason,
        }
    )
