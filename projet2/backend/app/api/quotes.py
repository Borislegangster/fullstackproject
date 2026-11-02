"""Quotes API — Devis CRM (create, send, accept/refuse, convert to invoice)."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import require_staff, require_comptable
from app.database import get_db
from app.models.erp import Quote, Invoice
from app.services.activity_service import log_activity
from app.services.pdf_service import render_pdf

router = APIRouter(prefix="/quotes", tags=["Quotes"])


from app.utils.time import utcnow_naive as _now


class QuoteCreate(BaseModel):
    client_name: str = ""
    project_label: str = ""
    amount: float = 0.0
    lines: list = []
    lead_id: Optional[str] = None
    valid_until: Optional[datetime] = None
    notes: str = ""


class QuoteUpdate(BaseModel):
    client_name: Optional[str] = None
    project_label: Optional[str] = None
    amount: Optional[float] = None
    lines: Optional[list] = None
    status: Optional[str] = None
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None


class QuoteRevise(BaseModel):
    """Payload for creating a new revision of an existing quote."""
    client_name: Optional[str] = None
    project_label: Optional[str] = None
    amount: Optional[float] = None
    lines: Optional[list] = None
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    version_note: str = ""  # description of what changed


VALID_STATUSES = {"EN_REDACTION", "ENVOYE", "ACCEPTE", "REFUSE"}


def _serialize(q: Quote) -> dict:
    return {
        "id": q.id, "code": q.code, "lead_id": q.lead_id,
        "client_name": q.client_name, "project_label": q.project_label,
        "amount": q.amount, "lines": q.lines or [], "status": q.status,
        "valid_until": q.valid_until, "notes": q.notes,
        "converted_invoice_id": q.converted_invoice_id,
        "version": q.version, "version_note": q.version_note or "",
        "parent_quote_id": q.parent_quote_id,
        "created_at": q.created_at,
    }


@router.get("")
async def list_quotes(
    status_filter: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    q = select(Quote).where(
        Quote.deleted_at.is_(None),
        Quote.parent_quote_id.is_(None),  # only latest versions
    ).order_by(Quote.created_at.desc())
    if status_filter:
        q = q.where(Quote.status == status_filter)
    r = await db.execute(q)
    return [_serialize(x) for x in r.scalars().all()]


@router.post("")
async def create_quote(
    data: QuoteCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    count_r = await db.execute(select(func.count(Quote.id)))
    count = count_r.scalar() or 0
    code = f"DEV-{_now().strftime('%Y')}-{count + 1:03d}"
    quote = Quote(code=code, **data.model_dump())
    db.add(quote)
    await log_activity(db, user.id, "QUOTE_CREATED", "quote", quote.id, new_value={"code": code})
    await db.commit()
    await db.refresh(quote)
    return {"id": quote.id, "code": code}


@router.patch("/{quote_id}")
async def update_quote(
    quote_id: str,
    data: QuoteUpdate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Quote).where(Quote.id == quote_id, Quote.deleted_at.is_(None)))
    quote = r.scalars().first()
    if not quote:
        raise HTTPException(404, "Devis introuvable")
    updates = data.model_dump(exclude_unset=True)
    if "status" in updates and updates["status"] not in VALID_STATUSES:
        raise HTTPException(400, f"Statut invalide. Attendu : {', '.join(sorted(VALID_STATUSES))}")
    for k, v in updates.items():
        if v is not None:
            setattr(quote, k, v)
    quote.updated_at = _now()
    await db.commit()
    return {"detail": "Devis mis à jour"}


@router.post("/{quote_id}/revise")
async def revise_quote(
    quote_id: str,
    data: QuoteRevise,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Create a new revision of an existing quote.

    The current quote becomes archived (parent_quote_id is set on the OLD
    record, pointing to nothing visible). The NEW record inherits the code
    with an incremented version number.
    """
    r = await db.execute(select(Quote).where(Quote.id == quote_id, Quote.deleted_at.is_(None)))
    old = r.scalars().first()
    if not old:
        raise HTTPException(404, "Devis introuvable")
    if old.status in ("ACCEPTE", "REFUSE"):
        raise HTTPException(400, "Impossible de réviser un devis accepté ou refusé")

    new_version = old.version + 1
    # Build the new revision, inheriting unchanged fields from the old one.
    new_quote = Quote(
        code=old.code,  # same commercial code
        lead_id=old.lead_id,
        client_name=data.client_name if data.client_name is not None else old.client_name,
        project_label=data.project_label if data.project_label is not None else old.project_label,
        amount=data.amount if data.amount is not None else old.amount,
        lines=data.lines if data.lines is not None else (old.lines or []),
        status="EN_REDACTION",
        valid_until=data.valid_until if data.valid_until is not None else old.valid_until,
        notes=data.notes if data.notes is not None else old.notes,
        version=new_version,
        version_note=data.version_note or f"Révision V{new_version}",
    )
    # The old quote's code must be freed for the unique constraint.
    old.code = f"{old.code}__v{old.version}"
    # Archive old: mark it as a parent (child points to nothing; old gets parent link)
    old.parent_quote_id = new_quote.id
    old.updated_at = _now()

    db.add(new_quote)
    await db.flush()  # get new_quote.id
    old.parent_quote_id = new_quote.id

    await log_activity(db, user.id, "QUOTE_REVISED", "quote", new_quote.id,
                       old_value={"version": old.version, "amount": old.amount},
                       new_value={"version": new_version, "amount": new_quote.amount,
                                  "version_note": new_quote.version_note})
    await db.commit()
    await db.refresh(new_quote)
    return {"id": new_quote.id, "code": new_quote.code, "version": new_version}


@router.get("/{quote_id}/versions")
async def list_quote_versions(
    quote_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """List all versions of a quote (current + all ancestors)."""
    r = await db.execute(select(Quote).where(Quote.id == quote_id, Quote.deleted_at.is_(None)))
    current = r.scalars().first()
    if not current:
        raise HTTPException(404, "Devis introuvable")

    # Collect all versions that share the base code (strip __vN suffix)
    base_code = current.code.split("__v")[0]
    r2 = await db.execute(
        select(Quote).where(
            Quote.code.startswith(base_code),
            Quote.deleted_at.is_(None),
        ).order_by(Quote.version.desc())
    )
    return [_serialize(v) for v in r2.scalars().all()]


@router.post("/{quote_id}/convert")
async def convert_quote_to_invoice(
    quote_id: str,
    project_id: str,
    client_id: str,
    user: User = Depends(require_comptable),
    db: AsyncSession = Depends(get_db),
):
    """Turn an accepted quote into a draft invoice."""
    r = await db.execute(select(Quote).where(Quote.id == quote_id, Quote.deleted_at.is_(None)))
    quote = r.scalars().first()
    if not quote:
        raise HTTPException(404, "Devis introuvable")
    if quote.converted_invoice_id:
        raise HTTPException(400, "Ce devis a déjà été converti en facture")

    count_r = await db.execute(select(func.count(Invoice.id)))
    count = count_r.scalar() or 0
    inv_code = f"FAC-{_now().strftime('%Y')}-{count + 1:03d}"
    invoice = Invoice(
        code=inv_code, project_id=project_id, client_id=client_id,
        invoice_type="FACTURE", lines=quote.lines or [],
        subtotal=quote.amount, total=quote.amount,
        notes=f"Issu du devis {quote.code}",
    )
    db.add(invoice)
    await db.flush()
    quote.converted_invoice_id = invoice.id
    quote.status = "ACCEPTE"
    quote.updated_at = _now()
    await log_activity(db, user.id, "QUOTE_CONVERTED", "quote", quote.id,
                       new_value={"invoice_code": inv_code})
    await db.commit()
    return {"invoice_id": invoice.id, "invoice_code": inv_code}


@router.get("/{quote_id}/pdf")
async def quote_pdf(
    quote_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Render the quote (devis) as a downloadable PDF."""
    r = await db.execute(select(Quote).where(Quote.id == quote_id, Quote.deleted_at.is_(None)))
    quote = r.scalars().first()
    if not quote:
        raise HTTPException(404, "Devis introuvable")

    pdf_bytes = render_pdf(
        "quote.html",
        {
            "quote": {
                "code": quote.code, "client_name": quote.client_name,
                "project_label": quote.project_label, "amount": quote.amount,
                "lines": quote.lines or [], "status": quote.status,
                "valid_until": quote.valid_until, "notes": quote.notes,
                "version": quote.version,
                "created_at": quote.created_at,
            },
            "generated_at": _now(),
        },
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="devis-{quote.code}.pdf"'},
    )


@router.delete("/{quote_id}")
async def delete_quote(
    quote_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Quote).where(Quote.id == quote_id))
    quote = r.scalars().first()
    if not quote:
        raise HTTPException(404, "Devis introuvable")
    quote.deleted_at = _now()
    await db.commit()
    return {"detail": "Devis supprimé"}
