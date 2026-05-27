"""Invoicing API — Invoices, Payments, Call for Funds."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.models import User
from app.auth.service import require_staff, require_admin, require_comptable
from app.models.erp import Invoice, Payment
from app.services.activity_service import log_activity
from app.services.notification_service import create_notification
from app.services.email_service import send_invoice_notification, send_overdue_invoice_reminder

router = APIRouter(prefix="/invoices", tags=["Invoicing"])


class InvoiceCreate(BaseModel):
    project_id: str
    client_id: str
    invoice_type: str = "FACTURE"
    lines: list = []
    subtotal: float = 0.0
    tax_rate: float = 0.0
    tax_amount: float = 0.0
    total: float = 0.0
    notes: str = ""
    due_date: Optional[datetime] = None
    phase_id: Optional[str] = None

class InvoiceUpdate(BaseModel):
    lines: Optional[list] = None
    subtotal: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_amount: Optional[float] = None
    total: Optional[float] = None
    notes: Optional[str] = None
    due_date: Optional[datetime] = None

class PaymentCreate(BaseModel):
    invoice_id: str
    amount: float
    method: str = "virement"
    reference: str = ""
    notes: str = ""


@router.get("")
async def list_invoices(
    project_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    query = select(Invoice).where(Invoice.deleted_at.is_(None)).order_by(Invoice.created_at.desc())
    if project_id:
        query = query.where(Invoice.project_id == project_id)
    if status_filter:
        query = query.where(Invoice.status == status_filter)
    result = await db.execute(query)
    invoices = result.scalars().all()
    return [
        {
            "id": i.id, "code": i.code, "project_id": i.project_id,
            "client_id": i.client_id, "invoice_type": i.invoice_type,
            "status": i.status, "subtotal": i.subtotal, "tax_rate": i.tax_rate,
            "tax_amount": i.tax_amount, "total": i.total, "amount_paid": i.amount_paid,
            "lines": i.lines, "notes": i.notes, "phase_id": i.phase_id,
            "issue_date": i.issue_date, "due_date": i.due_date,
            "sent_at": i.sent_at, "paid_at": i.paid_at,
            "created_at": i.created_at,
        }
        for i in invoices
    ]


@router.post("")
async def create_invoice(data: InvoiceCreate, user: User = Depends(require_comptable), db: AsyncSession = Depends(get_db)):
    count_r = await db.execute(select(func.count(Invoice.id)))
    count = count_r.scalar() or 0
    prefix = "FAC" if data.invoice_type == "FACTURE" else ("PRO" if data.invoice_type == "PROFORMA" else "AF")
    code = f"{prefix}-{datetime.utcnow().strftime('%Y')}-{count + 1:03d}"

    invoice = Invoice(code=code, **data.model_dump())
    db.add(invoice)
    await log_activity(db, user.id, "INVOICE_CREATED", "invoice", invoice.id, new_value={"code": code})
    await db.commit()
    await db.refresh(invoice)
    return {"id": invoice.id, "code": code}


@router.patch("/{invoice_id}")
async def update_invoice(invoice_id: str, data: InvoiceUpdate, user: User = Depends(require_comptable), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.deleted_at.is_(None)))
    inv = r.scalars().first()
    if not inv:
        raise HTTPException(404, "Facture introuvable")
    if inv.status != "BROUILLON":
        raise HTTPException(400, "Seules les factures en brouillon peuvent être modifiées")
    updates = data.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(inv, k, v)
    inv.updated_at = datetime.utcnow()
    await db.commit()
    return {"detail": "Facture mise à jour"}


@router.patch("/{invoice_id}/send")
async def send_invoice(invoice_id: str, user: User = Depends(require_comptable), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.deleted_at.is_(None)))
    inv = r.scalars().first()
    if not inv:
        raise HTTPException(404, "Facture introuvable")
    if inv.status != "BROUILLON":
        raise HTTPException(400, "Cette facture a déjà été envoyée")

    inv.status = "ENVOYEE"
    inv.sent_at = datetime.utcnow()
    inv.updated_at = datetime.utcnow()

    # Notify client
    client_r = await db.execute(select(User).where(User.id == inv.client_id))
    client = client_r.scalars().first()
    if client:
        await create_notification(db, client.id, title=f"Nouvelle facture {inv.code}",
                                  message=f"Montant: {inv.total:,.0f} FCFA", type="invoice",
                                  entity_type="invoice", entity_id=inv.id)
        try:
            send_invoice_notification(client.email, inv.code, inv.total, client.first_name)
        except Exception:
            pass

    await log_activity(db, user.id, "INVOICE_SENT", "invoice", inv.id)
    await db.commit()
    return {"detail": "Facture envoyée"}


@router.patch("/{invoice_id}/mark-paid")
async def mark_paid(invoice_id: str, user: User = Depends(require_comptable), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.deleted_at.is_(None)))
    inv = r.scalars().first()
    if not inv:
        raise HTTPException(404, "Facture introuvable")
    inv.status = "PAYEE"
    inv.paid_at = datetime.utcnow()
    inv.amount_paid = inv.total
    inv.updated_at = datetime.utcnow()
    await log_activity(db, user.id, "INVOICE_PAID", "invoice", inv.id)
    await db.commit()
    return {"detail": "Facture marquée comme payée"}


@router.post("/{invoice_id}/remind")
async def remind_invoice(invoice_id: str, user: User = Depends(require_comptable), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.deleted_at.is_(None)))
    inv = r.scalars().first()
    if not inv:
        raise HTTPException(404, "Facture introuvable")
    client_r = await db.execute(select(User).where(User.id == inv.client_id))
    client = client_r.scalars().first()
    if client:
        try:
            send_overdue_invoice_reminder(client.email, inv.code, inv.total, client.first_name)
        except Exception:
            pass
    return {"detail": "Relance envoyée"}


@router.post("/payments")
async def create_payment(data: PaymentCreate, user: User = Depends(require_comptable), db: AsyncSession = Depends(get_db)):
    payment = Payment(**data.model_dump())
    db.add(payment)
    # Update invoice amount_paid
    inv_r = await db.execute(select(Invoice).where(Invoice.id == data.invoice_id))
    inv = inv_r.scalars().first()
    if inv:
        inv.amount_paid = (inv.amount_paid or 0) + data.amount
        if inv.amount_paid >= inv.total:
            inv.status = "PAYEE"
            inv.paid_at = datetime.utcnow()
        inv.updated_at = datetime.utcnow()
    await log_activity(db, user.id, "PAYMENT_RECORDED", "invoice", data.invoice_id,
                       new_value={"amount": data.amount, "method": data.method})
    await db.commit()
    return {"detail": "Paiement enregistré"}
