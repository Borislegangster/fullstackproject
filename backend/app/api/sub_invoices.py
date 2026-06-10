"""Subcontractors — Received invoices (≠ client invoices)."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import require_comptable, require_staff
from app.database import get_db
from app.models.erp import Project, SubContractor, SubContractorInvoice
from app.services.activity_service import log_activity

router = APIRouter(prefix="/subcontractors/invoices", tags=["Subcontractors - Invoices"])


from app.utils.time import utcnow_naive as _now


class InvoiceCreate(BaseModel):
    subcontractor_id: str
    project_id: Optional[str] = None
    contract_id: Optional[str] = None
    amount: float
    due_date: Optional[datetime] = None
    file_url: str = ""
    notes: str = ""


class InvoiceStatusUpdate(BaseModel):
    status: str  # A_VALIDER, VALIDEE, PAYEE, REFUSEE


async def _enrich(db: AsyncSession, inv: SubContractorInvoice) -> dict:
    sub_r = await db.execute(select(SubContractor).where(SubContractor.id == inv.subcontractor_id))
    sub = sub_r.scalars().first()
    proj_name = ""
    if inv.project_id:
        p_r = await db.execute(select(Project).where(Project.id == inv.project_id))
        p = p_r.scalars().first()
        proj_name = p.name if p else ""
    return {
        "id": inv.id,
        "code": inv.code,
        "subcontractor_id": inv.subcontractor_id,
        "subcontractor_name": sub.company_name if sub else "",
        "project_id": inv.project_id,
        "project_name": proj_name,
        "contract_id": inv.contract_id,
        "amount": inv.amount,
        "status": inv.status,
        "issue_date": inv.issue_date,
        "due_date": inv.due_date,
        "paid_at": inv.paid_at,
        "file_url": inv.file_url,
        "notes": inv.notes,
    }


@router.get("")
async def list_invoices(
    status_filter: Optional[str] = None,
    subcontractor_id: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    q = select(SubContractorInvoice).where(SubContractorInvoice.deleted_at.is_(None)).order_by(
        SubContractorInvoice.issue_date.desc()
    )
    if status_filter:
        q = q.where(SubContractorInvoice.status == status_filter)
    if subcontractor_id:
        q = q.where(SubContractorInvoice.subcontractor_id == subcontractor_id)
    r = await db.execute(q)
    items = r.scalars().all()
    return [await _enrich(db, inv) for inv in items]


@router.post("")
async def create_invoice(
    data: InvoiceCreate,
    user: User = Depends(require_comptable),
    db: AsyncSession = Depends(get_db),
):
    count_r = await db.execute(select(func.count(SubContractorInvoice.id)))
    count = count_r.scalar() or 0
    code = f"F-ST-{_now().strftime('%Y')}-{count + 1:03d}"
    inv = SubContractorInvoice(code=code, **data.model_dump())
    db.add(inv)
    await log_activity(db, user.id, "SUB_INVOICE_RECEIVED", "subcontractor_invoice",
                        new_value={"code": code, "amount": data.amount})
    await db.commit()
    await db.refresh(inv)
    return await _enrich(db, inv)


@router.patch("/{inv_id}/status")
async def update_status(
    inv_id: str,
    data: InvoiceStatusUpdate,
    user: User = Depends(require_comptable),
    db: AsyncSession = Depends(get_db),
):
    if data.status not in ("A_VALIDER", "VALIDEE", "PAYEE", "REFUSEE"):
        raise HTTPException(400, "Statut invalide")
    r = await db.execute(select(SubContractorInvoice).where(SubContractorInvoice.id == inv_id, SubContractorInvoice.deleted_at.is_(None)))
    inv = r.scalars().first()
    if not inv:
        raise HTTPException(404, "Facture introuvable")
    inv.status = data.status
    if data.status in ("VALIDEE", "REFUSEE"):
        inv.validated_by = user.id
        inv.validated_at = _now()
    if data.status == "PAYEE":
        inv.paid_at = _now()
    inv.updated_at = _now()
    await log_activity(db, user.id, "SUB_INVOICE_STATUS_CHANGED", "subcontractor_invoice", inv_id,
                        new_value={"status": data.status})
    await db.commit()
    return {"detail": "Statut mis à jour"}


@router.delete("/{inv_id}")
async def delete_invoice(
    inv_id: str,
    user: User = Depends(require_comptable),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(SubContractorInvoice).where(SubContractorInvoice.id == inv_id))
    inv = r.scalars().first()
    if not inv:
        raise HTTPException(404, "Facture introuvable")
    inv.deleted_at = _now()
    await db.commit()
    return {"detail": "Facture supprimée"}
