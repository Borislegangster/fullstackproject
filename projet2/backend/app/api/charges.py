"""Charges API — Recurring & one-off operating expenses."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import require_comptable, require_staff
from app.database import get_db
from app.models.erp import Charge
from app.services.activity_service import log_activity

router = APIRouter(prefix="/finances/charges", tags=["Finances - Charges"])


from app.utils.time import utcnow_naive as _now


class ChargeCreate(BaseModel):
    category: str
    description: str
    amount: float
    recurring: bool = False
    period: str = "MONTHLY"
    due_date: Optional[datetime] = None
    project_id: Optional[str] = None
    receipt_url: Optional[str] = None
    notes: str = ""


class ChargeUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    recurring: Optional[bool] = None
    period: Optional[str] = None
    due_date: Optional[datetime] = None
    paid: Optional[bool] = None
    notes: Optional[str] = None


def _serialize(c: Charge) -> dict:
    return {
        "id": c.id,
        "category": c.category,
        "description": c.description,
        "amount": c.amount,
        "recurring": c.recurring,
        "period": c.period,
        "due_date": c.due_date,
        "paid": c.paid,
        "paid_at": c.paid_at,
        "project_id": c.project_id,
        "receipt_url": c.receipt_url,
        "notes": c.notes,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }


@router.get("")
async def list_charges(
    category: Optional[str] = None,
    project_id: Optional[str] = None,
    paid: Optional[bool] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    q = select(Charge).where(Charge.deleted_at.is_(None)).order_by(Charge.due_date.desc().nulls_last(), Charge.created_at.desc())
    if category:
        q = q.where(Charge.category == category)
    if project_id:
        q = q.where(Charge.project_id == project_id)
    if paid is not None:
        q = q.where(Charge.paid == paid)
    r = await db.execute(q)
    return [_serialize(c) for c in r.scalars().all()]


@router.post("")
async def create_charge(
    data: ChargeCreate,
    user: User = Depends(require_comptable),
    db: AsyncSession = Depends(get_db),
):
    charge = Charge(**data.model_dump(), recorded_by=user.id)
    db.add(charge)
    await log_activity(db, user.id, "CHARGE_CREATED", "charge", charge.id,
                        new_value={"category": data.category, "amount": data.amount})
    await db.commit()
    await db.refresh(charge)
    return _serialize(charge)


@router.patch("/{charge_id}")
async def update_charge(
    charge_id: str,
    data: ChargeUpdate,
    user: User = Depends(require_comptable),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Charge).where(Charge.id == charge_id, Charge.deleted_at.is_(None)))
    charge = r.scalars().first()
    if not charge:
        raise HTTPException(404, "Charge introuvable")
    updates = data.model_dump(exclude_unset=True)
    was_paid = charge.paid
    for k, v in updates.items():
        if v is not None:
            setattr(charge, k, v)
    if updates.get("paid") and not was_paid:
        charge.paid_at = _now()
    charge.updated_at = _now()
    await db.commit()
    return _serialize(charge)


@router.delete("/{charge_id}")
async def delete_charge(
    charge_id: str,
    user: User = Depends(require_comptable),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Charge).where(Charge.id == charge_id))
    charge = r.scalars().first()
    if not charge:
        raise HTTPException(404, "Charge introuvable")
    charge.deleted_at = _now()
    await db.commit()
    return {"detail": "Charge supprimée"}


@router.get("/summary")
async def charges_summary(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated totals by category, with unpaid count."""
    rows = await db.execute(
        select(Charge.category, func.sum(Charge.amount), func.count(Charge.id))
        .where(Charge.deleted_at.is_(None))
        .group_by(Charge.category)
    )
    by_cat = [
        {"category": cat, "total": float(total or 0), "count": count}
        for cat, total, count in rows.all()
    ]
    unpaid_r = await db.execute(
        select(func.sum(Charge.amount)).where(
            Charge.deleted_at.is_(None), Charge.paid == False  # noqa: E712
        )
    )
    return {
        "by_category": by_cat,
        "unpaid_total": float(unpaid_r.scalar() or 0),
    }
