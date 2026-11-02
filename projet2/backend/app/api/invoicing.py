"""Invoicing API — Invoices, Payments, Call for Funds."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Response
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.models import User
from app.auth.service import require_staff, require_admin, require_comptable, get_current_user
from app.models.erp import Invoice, Payment, Project
from app.services.activity_service import log_activity
from app.services.notification_service import create_notification
from app.services.email_service import send_invoice_notification, send_overdue_invoice_reminder
from app.services.pdf_service import render_pdf

router = APIRouter(prefix="/invoices", tags=["Invoicing"])


from app.utils.time import utcnow_naive as _now


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
async def create_invoice(
    data: InvoiceCreate,
    user: User = Depends(require_comptable),
    db: AsyncSession = Depends(get_db),
):
    count_r = await db.execute(select(func.count(Invoice.id)))
    count = count_r.scalar() or 0
    prefix = "FAC" if data.invoice_type == "FACTURE" else ("PRO" if data.invoice_type == "PROFORMA" else "AF")
    code = f"{prefix}-{_now().strftime('%Y')}-{count + 1:03d}"

    invoice = Invoice(code=code, **data.model_dump())
    db.add(invoice)
    await log_activity(db, user.id, "INVOICE_CREATED", "invoice", invoice.id, new_value={"code": code})
    await db.commit()
    await db.refresh(invoice)
    return {"id": invoice.id, "code": code}


@router.patch("/{invoice_id}")
async def update_invoice(
    invoice_id: str,
    data: InvoiceUpdate,
    user: User = Depends(require_comptable),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.deleted_at.is_(None)))
    inv = r.scalars().first()
    if not inv:
        raise HTTPException(404, "Facture introuvable")
    if inv.status != "BROUILLON":
        raise HTTPException(400, "Seules les factures en brouillon peuvent être modifiées")
    updates = data.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(inv, k, v)
    inv.updated_at = _now()
    await db.commit()
    return {"detail": "Facture mise à jour"}


@router.patch("/{invoice_id}/send")
async def send_invoice(
    invoice_id: str,
    bg: BackgroundTasks,
    user: User = Depends(require_comptable),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.deleted_at.is_(None)))
    inv = r.scalars().first()
    if not inv:
        raise HTTPException(404, "Facture introuvable")
    if inv.status != "BROUILLON":
        raise HTTPException(400, "Cette facture a déjà été envoyée")

    inv.status = "ENVOYEE"
    inv.sent_at = _now()
    inv.updated_at = _now()

    # Notify client
    client_r = await db.execute(select(User).where(User.id == inv.client_id))
    client = client_r.scalars().first()
    if client:
        await create_notification(db, client.id, title=f"Nouvelle facture {inv.code}",
                                  message=f"Montant: {inv.total:,.0f} FCFA", type="invoice",
                                  entity_type="invoice", entity_id=inv.id)
        bg.add_task(send_invoice_notification, client.email, inv.code, inv.total, client.first_name)

    await log_activity(db, user.id, "INVOICE_SENT", "invoice", inv.id)
    await db.commit()
    return {"detail": "Facture envoyée"}


@router.patch("/{invoice_id}/mark-paid")
async def mark_paid(
    invoice_id: str,
    user: User = Depends(require_comptable),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.deleted_at.is_(None)))
    inv = r.scalars().first()
    if not inv:
        raise HTTPException(404, "Facture introuvable")
    now = _now()
    remaining = float(inv.total or 0) - float(inv.amount_paid or 0)
    inv.status = "PAYEE"
    inv.paid_at = now
    inv.amount_paid = inv.total
    inv.updated_at = now
    # Record the collection as a Payment so cash-basis revenue and the cashflow
    # report capture it too (not just the accrual/PAYEE figure).
    if remaining > 0:
        db.add(Payment(
            invoice_id=inv.id, amount=remaining, method="manual",
            reference=inv.code, notes="Facture marquée comme payée", paid_at=now,
        ))
    await log_activity(db, user.id, "INVOICE_PAID", "invoice", inv.id)
    await db.commit()
    return {"detail": "Facture marquée comme payée"}


@router.post("/{invoice_id}/remind")
async def remind_invoice(
    invoice_id: str,
    bg: BackgroundTasks,
    user: User = Depends(require_comptable),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.deleted_at.is_(None)))
    inv = r.scalars().first()
    if not inv:
        raise HTTPException(404, "Facture introuvable")
    client_r = await db.execute(select(User).where(User.id == inv.client_id))
    client = client_r.scalars().first()
    if client:
        bg.add_task(send_overdue_invoice_reminder, client.email, inv.code, inv.total, client.first_name)
    return {"detail": "Relance envoyée"}


@router.post("/payments")
async def create_payment(
    data: PaymentCreate,
    user: User = Depends(require_comptable),
    db: AsyncSession = Depends(get_db),
):
    payment = Payment(**data.model_dump())
    db.add(payment)
    # Update invoice amount_paid
    inv_r = await db.execute(select(Invoice).where(Invoice.id == data.invoice_id))
    inv = inv_r.scalars().first()
    if inv:
        inv.amount_paid = (inv.amount_paid or 0) + data.amount
        if inv.amount_paid >= inv.total:
            inv.status = "PAYEE"
            inv.paid_at = _now()
        inv.updated_at = _now()
    await log_activity(db, user.id, "PAYMENT_RECORDED", "invoice", data.invoice_id,
                       new_value={"amount": data.amount, "method": data.method})
    await db.commit()
    return {"detail": "Paiement enregistré"}


@router.get("/payments")
async def list_payments(
    invoice_id: Optional[str] = None,
    user: User = Depends(require_comptable),
    db: AsyncSession = Depends(get_db),
):
    """List payments, optionally filtered by invoice."""
    q = select(Payment).order_by(Payment.paid_at.desc())
    if invoice_id:
        q = q.where(Payment.invoice_id == invoice_id)
    r = await db.execute(q)
    return [
        {
            "id": p.id, "invoice_id": p.invoice_id, "amount": p.amount,
            "method": p.method, "reference": p.reference,
            "notes": p.notes, "paid_at": p.paid_at,
        }
        for p in r.scalars().all()
    ]


@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.deleted_at.is_(None)))
    i = r.scalars().first()
    if not i:
        raise HTTPException(404, "Facture introuvable")
    return {
        "id": i.id, "code": i.code, "project_id": i.project_id,
        "client_id": i.client_id, "invoice_type": i.invoice_type,
        "status": i.status, "subtotal": i.subtotal, "tax_rate": i.tax_rate,
        "tax_amount": i.tax_amount, "total": i.total, "amount_paid": i.amount_paid,
        "lines": i.lines, "notes": i.notes, "phase_id": i.phase_id,
        "issue_date": i.issue_date, "due_date": i.due_date,
        "sent_at": i.sent_at, "paid_at": i.paid_at,
    }


@router.get("/{invoice_id}/pdf")
async def invoice_pdf(
    invoice_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Render the invoice as a PDF.

    Clients can download their own invoice; staff can download any.
    """
    r = await db.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.deleted_at.is_(None)))
    inv = r.scalars().first()
    if not inv:
        raise HTTPException(404, "Facture introuvable")
    if user.role == "CLIENT" and inv.client_id != user.id:
        raise HTTPException(403, "Accès interdit")

    proj_r = await db.execute(select(Project).where(Project.id == inv.project_id))
    project = proj_r.scalars().first()
    client_r = await db.execute(select(User).where(User.id == inv.client_id))
    client = client_r.scalars().first()

    pdf_bytes = render_pdf(
        "invoice.html",
        {
            "invoice": {
                "code": inv.code, "invoice_type": inv.invoice_type, "status": inv.status,
                "issue_date": inv.issue_date, "due_date": inv.due_date,
                "subtotal": inv.subtotal, "tax_rate": inv.tax_rate,
                "tax_amount": inv.tax_amount, "total": inv.total,
                "amount_paid": inv.amount_paid, "lines": inv.lines or [],
                "notes": inv.notes,
            },
            "client": {
                "full_name": client.full_name if client else "",
                "email": client.email if client else "",
                "phone": client.phone if client else "",
            },
            "project": {
                "code": project.code if project else "",
                "name": project.name if project else "",
                "location": project.location if project else "",
            },
            "generated_at": _now(),
        },
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="facture-{inv.code}.pdf"'},
    )


@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: str,
    user: User = Depends(require_comptable),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    inv = r.scalars().first()
    if not inv:
        raise HTTPException(404, "Facture introuvable")
    if inv.status != "BROUILLON":
        raise HTTPException(400, "Seules les factures en brouillon peuvent être supprimées")
    inv.deleted_at = _now()
    await db.commit()
    return {"detail": "Facture supprimée"}


# ── Stats endpoint ──────────────────────────────────────────

@router.get("/stats/summary")
async def invoicing_stats(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    paid_r = await db.execute(
        select(func.sum(Invoice.total)).where(Invoice.status == "PAYEE", Invoice.deleted_at.is_(None))
    )
    pending_r = await db.execute(
        select(func.sum(Invoice.total)).where(Invoice.status == "ENVOYEE", Invoice.deleted_at.is_(None))
    )
    overdue_r = await db.execute(
        select(func.sum(Invoice.total)).where(
            Invoice.status == "ENVOYEE",
            Invoice.due_date < _now(),
            Invoice.deleted_at.is_(None),
        )
    )
    count_r = await db.execute(
        select(func.count(Invoice.id)).where(Invoice.deleted_at.is_(None))
    )
    return {
        "total_paid": float(paid_r.scalar() or 0),
        "total_pending": float(pending_r.scalar() or 0),
        "total_overdue": float(overdue_r.scalar() or 0),
        "invoice_count": count_r.scalar() or 0,
    }


@router.get("/stats/aging")
async def invoicing_aging(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Aged receivables balance — outstanding amount bucketed by days overdue.

    Considers sent / overdue invoices that aren't fully paid. The outstanding
    amount is `total - amount_paid`. Buckets: not yet due, 0-30, 31-60, 61-90, 90+.
    """
    now = _now()
    buckets = {
        "not_due": {"label": "Non échu", "amount": 0.0, "count": 0},
        "0_30": {"label": "0-30 jours", "amount": 0.0, "count": 0},
        "31_60": {"label": "31-60 jours", "amount": 0.0, "count": 0},
        "61_90": {"label": "61-90 jours", "amount": 0.0, "count": 0},
        "90_plus": {"label": "90+ jours", "amount": 0.0, "count": 0},
    }
    r = await db.execute(
        select(Invoice).where(
            Invoice.status.in_(["ENVOYEE", "EN_RETARD"]),
            Invoice.deleted_at.is_(None),
        )
    )
    total_outstanding = 0.0
    for inv in r.scalars().all():
        outstanding = float(inv.total or 0) - float(inv.amount_paid or 0)
        if outstanding <= 0:
            continue
        total_outstanding += outstanding
        if not inv.due_date or inv.due_date >= now:
            key = "not_due"
        else:
            days = (now - inv.due_date).days
            if days <= 30:
                key = "0_30"
            elif days <= 60:
                key = "31_60"
            elif days <= 90:
                key = "61_90"
            else:
                key = "90_plus"
        buckets[key]["amount"] = round(buckets[key]["amount"] + outstanding, 2)
        buckets[key]["count"] += 1

    return {
        "total_outstanding": round(total_outstanding, 2),
        "buckets": [
            {"bucket": k, **v} for k, v in buckets.items()
        ],
    }
