"""API Programme ambassadeurs (I6) : espace client (adhésion, lien, suivi), équipe commerciale, page publique."""

from __future__ import annotations

import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.access import Access, get_access
from app.core.database import get_db
from app.core.errors import NotFound
from app.core.ratelimit import rate_limit
from app.modules.referrals import service
from app.modules.referrals.models import Ambassador, Referral

router = APIRouter(tags=["Programme ambassadeurs"])
public = APIRouter(prefix="/public/referrals", tags=["Parrainage (public)"])

Operator = Literal["mtn", "orange"]
PUBLIC_RULES = ("reward_type", "reward_pct", "reward_fixed", "reward_cap", "min_contract_amount", "referee_benefit")


# ---------------------------------------------------------------------------- espace client
def _mine(db: Session, access: Access) -> Ambassador | None:
    return db.execute(select(Ambassador).where(Ambassador.user_id == access.p.id)).scalar_one_or_none()


@router.get("/client/referral")
def my_referral(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("client:portal")
    rules = service.policy(db)
    ambassador = _mine(db, access)
    if not rules["enabled"] and ambassador is None:
        return {"enabled": False, "enrolled": False}  # programme fermé : rien à présenter
    out: dict[str, Any] = {
        "enabled": rules["enabled"],
        "enrolled": ambassador is not None,
        "rules": {k: rules[k] for k in PUBLIC_RULES},
    }
    if ambassador is not None:
        rows = db.execute(
            select(Referral).where(Referral.ambassador_id == ambassador.id).order_by(Referral.created_at.desc())
        ).scalars()
        out["ambassador"] = service.ambassador_out(db, ambassador, internal=False)
        out["referrals"] = [service.referral_out(r, internal=False) for r in rows]
    return out


class EnrollIn(BaseModel):
    accept_terms: bool
    momo_number: str | None = Field(default=None, max_length=30)
    momo_operator: Operator | None = None


@router.post("/client/referral", status_code=201)
def join(data: EnrollIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """Adhésion au programme (acceptation du règlement) — le code personnel est créé immédiatement."""
    from app.core.errors import BusinessRuleError

    access.require("client:portal")
    if not data.accept_terms:
        raise BusinessRuleError("Acceptez le règlement du programme pour continuer", code="TERMS_REQUIRED")
    user = access.p.user
    ambassador = service.enroll(
        db,
        kind="client",
        full_name=f"{user.first_name} {user.last_name}",
        email=user.email,
        phone=user.phone,
        user=user,
        momo_number=data.momo_number,
        momo_operator=data.momo_operator,
        actor_id=user.id,
    )
    db.commit()
    return service.ambassador_out(db, ambassador, internal=False)


class PayoutIn(BaseModel):
    momo_number: str = Field(min_length=8, max_length=30)
    momo_operator: Operator


@router.put("/client/referral/payout")
def my_payout(data: PayoutIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("client:portal")
    ambassador = _mine(db, access)
    if ambassador is None:
        raise NotFound("Vous n'êtes pas encore ambassadeur")
    service.update_payout(
        db, ambassador, momo_number=data.momo_number, momo_operator=data.momo_operator, actor_id=access.p.id
    )
    db.commit()
    return service.ambassador_out(db, ambassador, internal=False)


# ---------------------------------------------------------------------------- équipe
class ProgramIn(BaseModel):
    enabled: bool | None = None
    reward_type: Literal["percent", "fixed"] | None = None
    reward_pct: float | None = Field(default=None, ge=0, le=20)
    reward_fixed: int | None = Field(default=None, ge=0, le=100_000_000)
    reward_cap: int | None = Field(default=None, ge=0, le=1_000_000_000)
    min_contract_amount: int | None = Field(default=None, ge=0, le=100_000_000_000)
    attribution_days: int | None = Field(default=None, ge=1, le=730)
    signature_window_days: int | None = Field(default=None, ge=1, le=1095)
    referee_benefit: str | None = Field(default=None, max_length=300)


@router.get("/ambassadors/program")
def program(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """État du programme (ouvert / fermé) et règles de prime."""
    access.require("crm:read")
    return service.policy(db)


@router.put("/ambassadors/program")
def update_program(
    data: ProgramIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Ouvrir / fermer le programme (visibilité du menu « Parrainage » côté client) et régler les primes."""
    access.require("settings:write")
    values = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    rules = service.update_policy(db, values, actor_id=access.p.id)
    db.commit()
    return rules


@router.get("/ambassadors")
def ambassadors(
    q: str | None = None, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require("crm:read")
    stmt = select(Ambassador).order_by(Ambassador.created_at.desc()).limit(500)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(Ambassador.full_name.ilike(like) | Ambassador.code.ilike(like))
    return [service.ambassador_out(db, a, internal=True) for a in db.execute(stmt).scalars()]


class AmbassadorIn(BaseModel):
    kind: Literal["partner", "employee", "client"] = "partner"
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    momo_number: str | None = Field(default=None, max_length=30)
    momo_operator: Operator | None = None
    notes: str | None = Field(default=None, max_length=2000)


@router.post("/ambassadors", status_code=201)
def create_ambassador(
    data: AmbassadorIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Partenaire prescripteur (architecte, notaire, agent immobilier, relais diaspora…) inscrit par l'équipe."""
    access.require("crm:write")
    ambassador = service.enroll(
        db,
        kind=data.kind,
        full_name=data.full_name,
        email=str(data.email) if data.email else None,
        phone=data.phone,
        momo_number=data.momo_number,
        momo_operator=data.momo_operator,
        actor_id=access.p.id,
    )
    ambassador.notes = data.notes
    db.commit()
    return service.ambassador_out(db, ambassador, internal=True)


class AmbassadorPatch(BaseModel):
    status: Literal["active", "suspended"] | None = None
    phone: str | None = Field(default=None, max_length=30)
    momo_number: str | None = Field(default=None, max_length=30)
    momo_operator: Operator | None = None
    notes: str | None = Field(default=None, max_length=2000)


@router.patch("/ambassadors/{ambassador_id}")
def update_ambassador(
    ambassador_id: uuid.UUID, data: AmbassadorPatch, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.core import audit
    from app.core.utils import clean_phone

    access.require("crm:write")
    ambassador = db.get(Ambassador, ambassador_id)
    if ambassador is None:
        raise NotFound("Ambassadeur introuvable")
    values = data.model_dump(exclude_unset=True)
    if values.get("momo_number"):
        service.update_payout(
            db,
            ambassador,
            momo_number=values["momo_number"],
            momo_operator=values.get("momo_operator", ambassador.momo_operator),
            actor_id=access.p.id,
        )
    if values.get("status"):
        ambassador.status = values["status"]
    if "phone" in values:
        ambassador.phone = clean_phone(values["phone"])
    if "notes" in values:
        ambassador.notes = values["notes"]
    audit.record(
        db,
        family="business",
        module="referrals",
        action="UPDATE",
        resource_type="ambassador",
        resource_id=ambassador.id,
        diff={k: ("***" if k == "momo_number" else str(v)) for k, v in values.items()},
    )
    db.commit()
    return service.ambassador_out(db, ambassador, internal=True)


@router.get("/referrals")
def referrals(
    status: str | None = None,
    ambassador_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    access.require("crm:read")
    stmt = select(Referral, Ambassador).join(Ambassador, Ambassador.id == Referral.ambassador_id)
    if status:
        stmt = stmt.where(Referral.status == status)
    if ambassador_id:
        stmt = stmt.where(Referral.ambassador_id == ambassador_id)
    rows = db.execute(stmt.order_by(Referral.created_at.desc()).limit(500)).all()
    return [service.referral_out(r, internal=True, ambassador=a) for r, a in rows]


@router.post("/referrals/{referral_id}/approve")
def approve_referral(
    referral_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Validation commerciale de la prime ; le paiement suit le circuit finance (paiement sortant « prime »)."""
    access.require("crm:contracts")
    referral = service.approve(db, service.get_referral(db, referral_id), principal=access.p)
    db.commit()
    return service.referral_out(referral, internal=True, ambassador=db.get(Ambassador, referral.ambassador_id))


class RejectIn(BaseModel):
    reason: str = Field(min_length=5, max_length=1000)


@router.post("/referrals/{referral_id}/reject")
def reject_referral(
    referral_id: uuid.UUID, data: RejectIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("crm:contracts")
    referral = service.reject(db, service.get_referral(db, referral_id), reason=data.reason, user_id=access.p.id)
    db.commit()
    return service.referral_out(referral, internal=True, ambassador=db.get(Ambassador, referral.ambassador_id))


# ---------------------------------------------------------------------------- public
@public.get("/{code}", dependencies=[Depends(rate_limit("referral", "60/minute"))])
def referral_landing(code: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    return service.landing(db, code)
