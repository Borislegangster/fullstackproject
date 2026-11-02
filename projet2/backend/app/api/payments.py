"""Payments API — Flutterwave secure payment gateway integration.

Endpoints:
- POST /payments/initiate       → Client initiates payment, gets Flutterwave checkout URL
- GET  /payments/{tx_ref}/status → Client polls payment status
- POST /payments/flutterwave/webhook → Flutterwave webhook (public, signature-verified)
- GET  /payments/callback        → Redirect target after Flutterwave checkout

Security:
- Webhook validates verif-hash with timing-safe comparison
- Every webhook payment is double-verified via GET /v3/transactions/{id}/verify
- Amount, currency, and tx_ref are cross-checked
- Each tx_ref is processed exactly once (idempotency)
"""
import logging
import time
from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models.erp import Invoice, Payment, PaymentTransaction
from app.rate_limit import limiter
from app.services.activity_service import log_activity
from app.services.email_service import (
    send_payment_confirmation_client,
    send_payment_received_staff,
)
from app.services.flutterwave_service import FlutterwaveService, FlutterwaveError, get_flutterwave_service
from app.services.notification_service import create_notification

# Invoice statuses for which an online payment may be initiated.
_PAYABLE_STATUSES = ("ENVOYEE", "EN_RETARD")
# Staff roles allowed to act on any invoice / inspect any transaction.
_FINANCE_ROLES = ("ADMIN", "COMPTABLE")

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])


from app.utils.time import utcnow_naive as _now


# ── Schemas ───────────────────────────────────────────────────

class PaymentInitiateRequest(BaseModel):
    invoice_id: str


class PaymentInitiateResponse(BaseModel):
    checkout_url: str
    tx_ref: str
    transaction_id: str  # our PaymentTransaction.id


# ── POST /payments/initiate ───────────────────────────────────

@router.post("/initiate", response_model=PaymentInitiateResponse)
@limiter.limit("10/minute")
async def initiate_payment(
    data: PaymentInitiateRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    flw: FlutterwaveService = Depends(get_flutterwave_service),
):
    """Initiate a Flutterwave payment for a client invoice.

    Creates a PENDING PaymentTransaction, calls Flutterwave to get a
    checkout URL, and returns it for the frontend to redirect the user.
    """
    # 1. Load the invoice. Clients may only pay their OWN invoices — the
    #    ownership filter is applied in the query so a non-owner gets a plain
    #    404 (no IDOR, no enumeration of other clients' invoices/amounts).
    q = select(Invoice).where(
        Invoice.id == data.invoice_id,
        Invoice.deleted_at.is_(None),
    )
    if user.role not in _FINANCE_ROLES:
        q = q.where(Invoice.client_id == user.id)
    invoice = (await db.execute(q)).scalars().first()
    if not invoice:
        raise HTTPException(404, "Facture introuvable")

    if invoice.status == "PAYEE":
        raise HTTPException(400, "Cette facture est déjà payée")
    # Only sent/overdue invoices are payable online (never drafts / proformas).
    if invoice.status not in _PAYABLE_STATUSES:
        raise HTTPException(400, "Cette facture n'est pas payable en ligne")

    # 2. Calculate remaining amount
    amount_remaining = float(invoice.total or 0) - float(invoice.amount_paid or 0)
    if amount_remaining <= 0:
        raise HTTPException(400, "Aucun montant restant à payer")

    # 3. Check for existing PENDING transaction (idempotency)
    existing_r = await db.execute(
        select(PaymentTransaction).where(
            PaymentTransaction.invoice_id == data.invoice_id,
            PaymentTransaction.user_id == user.id,
            PaymentTransaction.status == "PENDING",
        )
    )
    existing = existing_r.scalars().first()
    if existing and existing.checkout_url:
        # Return the existing checkout URL (idempotent)
        return PaymentInitiateResponse(
            checkout_url=existing.checkout_url,
            tx_ref=existing.tx_ref,
            transaction_id=existing.id,
        )

    # 4. Generate unique tx_ref
    tx_ref = f"FLW-{invoice.code}-{int(time.time())}"

    # 5. Build redirect URL
    settings = get_settings()
    redirect_url = f"{settings.FRONTEND_URL}/paiement/callback"

    # 6. Get client IP for audit
    client_ip = request.client.host if request.client else "unknown"

    # 7. Create PENDING transaction
    txn = PaymentTransaction(
        invoice_id=invoice.id,
        user_id=user.id,
        tx_ref=tx_ref,
        amount=amount_remaining,
        currency="XAF",
        status="PENDING",
        ip_address=client_ip,
    )
    db.add(txn)
    await db.flush()

    # 8. Call Flutterwave API
    try:
        flw_response = await flw.initialize_payment(
            tx_ref=tx_ref,
            amount=amount_remaining,
            currency="XAF",
            redirect_url=redirect_url,
            customer_email=user.email,
            customer_name=user.full_name or f"{user.first_name} {user.last_name}".strip(),
            customer_phone=user.phone or "",
            title="Globus BTP — Paiement facture",
            description=f"Paiement facture {invoice.code}",
            meta={"invoice_id": invoice.id, "invoice_code": invoice.code},
        )
    except FlutterwaveError as e:
        txn.status = "FAILED"
        txn.flw_metadata = {"error": str(e), "response": e.response_data}
        await db.commit()
        logger.error("Flutterwave init failed for %s: %s", tx_ref, e)
        raise HTTPException(502, f"Erreur passerelle de paiement: {e}")

    # 9. Update transaction with checkout URL
    checkout_url = flw_response.get("data", {}).get("link", "")
    txn.checkout_url = checkout_url
    txn.flw_metadata = {"init_response": flw_response}
    await db.commit()
    await db.refresh(txn)

    logger.info("Payment initiated: tx_ref=%s invoice=%s amount=%s", tx_ref, invoice.code, amount_remaining)

    return PaymentInitiateResponse(
        checkout_url=checkout_url,
        tx_ref=tx_ref,
        transaction_id=txn.id,
    )


# ── GET /payments/{tx_ref}/status ─────────────────────────────

@router.get("/{tx_ref}/status")
async def get_payment_status(
    tx_ref: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll the status of a payment transaction."""
    r = await db.execute(
        select(PaymentTransaction).where(PaymentTransaction.tx_ref == tx_ref)
    )
    txn = r.scalars().first()
    if not txn:
        raise HTTPException(404, "Transaction introuvable")

    # Security: only the initiating user or finance staff can check
    if txn.user_id != user.id and user.role not in _FINANCE_ROLES:
        raise HTTPException(403, "Accès non autorisé")

    return {
        "tx_ref": txn.tx_ref,
        "status": txn.status,
        "amount": txn.amount,
        "currency": txn.currency,
        "payment_type": txn.payment_type,
        "flw_ref": txn.flw_ref,
        "completed_at": txn.completed_at,
    }


# ── POST /payments/flutterwave/webhook ────────────────────────

@router.post("/flutterwave/webhook")
async def flutterwave_webhook(
    request: Request,
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    flw: FlutterwaveService = Depends(get_flutterwave_service),
):
    """Receive and process Flutterwave webhook notifications.

    Security layers:
    1. Verify `verif-hash` header (timing-safe comparison)
    2. Parse the payload
    3. Find the matching PaymentTransaction by tx_ref
    4. Reject if already processed (idempotency)
    5. Double-verify via GET /v3/transactions/{id}/verify
    6. Cross-check amount, currency, tx_ref
    7. Update PaymentTransaction, create Payment, update Invoice
    """
    # 1. Verify webhook signature
    verif_hash = request.headers.get("verif-hash")
    if not flw.validate_webhook_signature(verif_hash):
        logger.warning("FLW webhook: invalid signature from %s", request.client.host if request.client else "?")
        raise HTTPException(401, "Invalid webhook signature")

    # 2. Parse payload
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON payload")

    event = payload.get("event", "")
    tx_data = payload.get("data", {})
    tx_ref = tx_data.get("tx_ref", "")
    flw_transaction_id = str(tx_data.get("id", ""))

    logger.info("FLW webhook received: event=%s tx_ref=%s flw_id=%s", event, tx_ref, flw_transaction_id)

    # Only process charge.completed events
    if event != "charge.completed":
        logger.info("FLW webhook: ignoring event '%s'", event)
        return {"status": "ignored"}

    # 3. Find our transaction and LOCK the row. The row lock + the PENDING
    #    re-check below serialise concurrent webhook deliveries (Flutterwave
    #    retries), so an invoice can never be credited twice for one tx.
    r = await db.execute(
        select(PaymentTransaction)
        .where(PaymentTransaction.tx_ref == tx_ref)
        .with_for_update()
    )
    txn = r.scalars().first()
    if not txn:
        logger.warning("FLW webhook: no PaymentTransaction found for tx_ref=%s", tx_ref)
        return {"status": "unknown_tx_ref"}

    # 4. Idempotency: already processed? (checked while holding the row lock)
    if txn.status != "PENDING":
        logger.info("FLW webhook: tx_ref=%s already %s, skipping", tx_ref, txn.status)
        return {"status": "already_processed"}

    # 5. Double-verify via Flutterwave API
    try:
        verified = await flw.verify_transaction(flw_transaction_id)
    except FlutterwaveError as e:
        logger.error("FLW verification failed for %s: %s", tx_ref, e)
        txn.flw_metadata = {**txn.flw_metadata, "verify_error": str(e)} if txn.flw_metadata else {"verify_error": str(e)}
        await db.commit()
        return {"status": "verification_failed"}

    # 6. Cross-check amount, currency, tx_ref
    is_valid, reason = FlutterwaveService.validate_payment_data(
        verified,
        expected_amount=txn.amount,
        expected_currency=txn.currency,
        expected_tx_ref=txn.tx_ref,
    )

    verified_tx_data = verified.get("data", {})

    if not is_valid:
        logger.error("FLW validation failed for %s: %s", tx_ref, reason)
        txn.status = "FAILED"
        txn.flw_transaction_id = flw_transaction_id
        txn.flw_metadata = {
            **(txn.flw_metadata or {}),
            "validation_error": reason,
            "verified_response": verified,
        }
        await db.commit()
        return {"status": "validation_failed", "reason": reason}

    # 7. SUCCESS — Update everything
    now = _now()

    # Update PaymentTransaction
    txn.status = "COMPLETED"
    txn.flw_transaction_id = flw_transaction_id
    txn.flw_ref = verified_tx_data.get("flw_ref", "")
    txn.payment_type = verified_tx_data.get("payment_type", "")
    txn.completed_at = now
    txn.flw_metadata = {
        **(txn.flw_metadata or {}),
        "webhook_payload": payload,
        "verified_response": verified,
    }

    # Create the Payment record (legacy system compatibility)
    payment = Payment(
        invoice_id=txn.invoice_id,
        amount=txn.amount,
        method=f"flutterwave_{txn.payment_type or 'online'}",
        reference=txn.tx_ref,
        notes=f"Paiement Flutterwave vérifié — {txn.flw_ref}",
        paid_at=now,
    )
    db.add(payment)

    # Update invoice
    inv_r = await db.execute(select(Invoice).where(Invoice.id == txn.invoice_id))
    invoice = inv_r.scalars().first()
    if invoice:
        invoice.amount_paid = float(invoice.amount_paid or 0) + txn.amount
        if invoice.amount_paid >= float(invoice.total or 0):
            invoice.status = "PAYEE"
            invoice.paid_at = now
        invoice.updated_at = now

        # Log activity
        await log_activity(
            db, txn.user_id, "PAYMENT_RECEIVED_ONLINE", "invoice", invoice.id,
            new_value={
                "amount": txn.amount,
                "method": txn.payment_type,
                "tx_ref": txn.tx_ref,
                "flw_ref": txn.flw_ref,
            },
        )

        # ── Notifications (in-app + email) ──────────────────────────
        method = txn.payment_type or "Flutterwave"

        # Resolve the payer (client) for the confirmation + staff messages.
        payer = (await db.execute(
            select(User).where(User.id == txn.user_id)
        )).scalars().first()
        payer_name = (payer.full_name if payer else "") or "Client"

        # 1) Notify the CLIENT who paid — in-app + email confirmation.
        if payer:
            await create_notification(
                db, payer.id,
                title="✅ Paiement confirmé",
                message=f"Votre paiement de {txn.amount:,.0f} FCFA pour la facture "
                        f"{invoice.code} a bien été reçu.",
                type="payment", entity_type="invoice", entity_id=invoice.id,
            )
            if payer.email:
                bg.add_task(send_payment_confirmation_client,
                            payer.email, invoice.code, txn.amount, payer.first_name or "", method)

        # 2) Notify finance staff (ADMIN + COMPTABLE) and the project chef —
        #    deduped — in-app + email so the ERP side is alerted everywhere.
        from app.models.erp import Project
        recipients: dict[str, User] = {}
        staff_users = (await db.execute(
            select(User).where(
                User.role.in_(["ADMIN", "COMPTABLE"]),
                User.is_active.is_(True),
                User.deleted_at.is_(None),
            )
        )).scalars().all()
        for u in staff_users:
            recipients[u.id] = u
        project = (await db.execute(
            select(Project).where(Project.id == invoice.project_id)
        )).scalars().first()
        if project and project.chef_projet_id and project.chef_projet_id not in recipients:
            chef = (await db.execute(
                select(User).where(User.id == project.chef_projet_id)
            )).scalars().first()
            if chef:
                recipients[chef.id] = chef

        for staff in recipients.values():
            await create_notification(
                db, staff.id,
                title="💳 Paiement reçu en ligne",
                message=f"Facture {invoice.code} — {txn.amount:,.0f} FCFA via {method} "
                        f"(payé par {payer_name})",
                type="payment", entity_type="invoice", entity_id=invoice.id,
            )
            if staff.email:
                bg.add_task(send_payment_received_staff,
                            staff.email, invoice.code, txn.amount, payer_name, method,
                            staff.first_name or "")

    await db.commit()
    logger.info("FLW payment completed: tx_ref=%s amount=%s", tx_ref, txn.amount)

    return {"status": "success"}


# ── GET /payments/callback ────────────────────────────────────

@router.get("/callback")
async def payment_callback(
    status: Optional[str] = None,
    tx_ref: Optional[str] = None,
    transaction_id: Optional[str] = None,
):
    """Redirect target after Flutterwave checkout.

    Flutterwave appends ?status=...&tx_ref=...&transaction_id=... to the
    redirect_url. We redirect the user to the frontend payment result page.
    """
    settings = get_settings()
    frontend_url = settings.FRONTEND_URL

    # Redirect to the FIXED frontend result page (no open redirect — the host is
    # never taken from input). Params are URL-encoded to prevent injection of
    # extra query parameters via crafted values.
    params = {k: v for k, v in (
        ("tx_ref", tx_ref), ("status", status), ("transaction_id", transaction_id),
    ) if v}
    query = f"?{urlencode(params)}" if params else ""
    redirect_target = f"{frontend_url}/paiement/callback{query}"

    return RedirectResponse(url=redirect_target, status_code=302)
