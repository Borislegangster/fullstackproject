"""Paiements (§16.1) : encaissement client (MTN MoMo, Orange Money, cartes / Mobile Money via prestataires),
paiements sortants après contrôle et validation (matrice d'approbation) exécutés manuellement avec preuve ou par
transfert prestataire (MTN MoMo Disbursements, Flutterwave), notifications authentifiées et idempotentes,
re-vérification serveur systématique, échec → statut d'échec + motif + tâche finance (aucune clôture automatique),
reçus PDF."""

from __future__ import annotations

import hashlib
import hmac
import logging
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.errors import BusinessRuleError, Conflict, NotFound
from app.core.events import emit
from app.core.numbering import next_number
from app.core.utils import money, utcnow
from app.modules.finance.models import FundsCall, Payment, PaymentAllocation, PaymentTransaction
from app.modules.system.models import ActionItem, InboundWebhookEvent
from app.providers.base import ProviderError
from app.providers.payments import (
    PROVIDERS,
    CheckoutRequest,
    InvalidWebhookSignature,
    PaymentStatus,
    PayoutRequest,
    callback_signature,
    get_payment_provider,
    normalize_msisdn,
)

log = logging.getLogger("globus.payments")
FINAL_STATUSES = ("succeeded", "failed", "cancelled", "expired")


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def notify_url(provider_name: str, reference: str) -> str:
    """URL de notification signée propre à la transaction (authentifie les rappels non signés des opérateurs)."""
    base = f"{settings.API_PUBLIC_URL.rstrip('/')}{settings.API_PREFIX}/payments/webhooks/{provider_name}"
    return f"{base}?ref={reference}&sig={callback_signature(provider_name, reference)}"


def instructions_for(tx: PaymentTransaction) -> str | None:
    """Consigne affichée au payeur pendant la confirmation (validation sur téléphone pour MTN MoMo)."""
    if tx.kind != "collection" or tx.status != "pending":
        return None
    if tx.provider == "mtn_momo":
        phone = tx.customer_phone or ""
        masked = f"{phone[:5]}•••{phone[-2:]}" if len(phone) > 7 else phone
        return (
            f"Une demande de paiement a été envoyée au {masked}. Validez-la sur votre téléphone (notification MTN "
            "MoMo ou menu *126#) en saisissant votre code secret."
        )
    if tx.provider == "orange_money":
        return "Finalisez le paiement sur la page Orange Money (code temporaire via #150*4*4#)."
    return None


def _target(db: Session, target_type: str, target_id: uuid.UUID) -> Any:
    from app.modules.billing.models import ClientInvoice, SupplierInvoice
    from app.modules.referrals.models import Referral
    from app.modules.subcontracting.models import SubcontractorInvoice

    model = {
        "funds_call": FundsCall,
        "client_invoice": ClientInvoice,
        "supplier_invoice": SupplierInvoice,
        "subcontractor_invoice": SubcontractorInvoice,
        "referral_reward": Referral,
    }.get(target_type)
    if model is None:
        raise BusinessRuleError("Type de cible de paiement inconnu")
    obj = db.get(model, target_id)
    if obj is None:
        raise NotFound("Pièce à payer introuvable")
    return obj


def outstanding(obj: Any) -> Decimal:
    if isinstance(obj, FundsCall):
        return money(Decimal(obj.amount) - Decimal(obj.amount_paid))
    total = Decimal(getattr(obj, "total", None) or getattr(obj, "amount", 0) or 0)
    credited = Decimal(getattr(obj, "amount_credited", 0) or 0)
    frozen = Decimal(getattr(obj, "amount_frozen", 0) or 0)
    return money(total - Decimal(obj.amount_paid or 0) - credited - frozen)


# ---------------------------------------------------------------------------- encaissement client en ligne
def start_client_checkout(
    db: Session,
    *,
    user: Any,
    target_type: str,
    target_id: uuid.UUID,
    provider_name: str,
    method: str,
    amount: Decimal | None,
    idempotency_key: str,
    payer_phone: str | None = None,
    return_url: str | None = None,
    cancel_url: str | None = None,
) -> dict[str, Any]:
    if target_type not in ("funds_call", "client_invoice"):
        raise BusinessRuleError("Seuls les appels de fonds et factures clients sont payables en ligne")
    obj = _target(db, target_type, target_id)
    due = outstanding(obj)
    if due <= 0:
        raise Conflict("Rien à régler sur cette pièce", code="NOTHING_DUE")
    pay_amount = money(amount) if amount else due
    if pay_amount <= 0 or pay_amount > due:
        raise BusinessRuleError(f"Montant invalide (maximum {due})", code="INVALID_AMOUNT")
    provider = get_payment_provider(provider_name)
    if method not in provider.methods:
        raise BusinessRuleError("Moyen de paiement non proposé par ce prestataire")
    phone = normalize_msisdn(payer_phone or user.phone)
    if provider.flow == "push" and not phone:
        raise BusinessRuleError(
            "Numéro Mobile Money requis pour recevoir la demande de paiement", code="PAYER_PHONE_REQUIRED"
        )
    payment = Payment(
        number=next_number(db, "payment"),
        direction="in",
        counterparty_type="client",
        counterparty_id=getattr(obj, "organization_id", None),
        counterparty_label=user.full_name,
        project_id=getattr(obj, "project_id", None),
        amount=pay_amount,
        currency=obj.currency,
        method=method,
        provider=provider_name,
        status="processing",
        initiated_by_id=user.id,
        idempotency_key=f"checkout:{idempotency_key}",
    )
    payment.allocations.append(PaymentAllocation(target_type=target_type, target_id=obj.id, amount=pay_amount))
    db.add(payment)
    try:
        db.flush()
    except IntegrityError as exc:
        raise Conflict("Paiement déjà initié pour cette clé", code="DUPLICATE_PAYMENT") from exc
    tx = PaymentTransaction(
        payment_id=payment.id,
        kind="collection",
        provider=provider_name,
        amount=pay_amount,
        currency=obj.currency,
        customer_email=user.email,
        customer_phone=phone or user.phone,
        status="created",
    )
    db.add(tx)
    db.flush()
    base = settings.PUBLIC_BASE_URL.rstrip("/")
    label = getattr(obj, "label", None) or getattr(obj, "title", None) or obj.number
    session = provider.create_checkout(
        CheckoutRequest(
            reference=str(tx.id),
            amount=pay_amount,
            currency=obj.currency,
            description=f"{obj.number} — {label}",
            return_url=(return_url or f"{base}/espace-client/finances/paiement/{{transaction_id}}").replace(
                "{transaction_id}", str(tx.id)
            ),
            cancel_url=cancel_url or f"{base}/espace-client/finances",
            notify_url=notify_url(provider_name, str(tx.id)),
            customer_email=user.email,
            customer_phone=phone or user.phone,
            customer_name=user.full_name,
            method=method,
            payer_phone=phone,
            metadata={"payment": payment.number, "target": f"{target_type}:{obj.id}"},
        ),
        idempotency_key,
    )
    tx.provider_session_id = session.session_id
    tx.checkout_url = session.checkout_url
    tx.expires_at = session.expires_at
    tx.webhook_token_hash = _token_hash(session.webhook_token) if session.webhook_token else None
    tx.status = "pending"
    audit.record(
        db,
        family="business",
        module="payments",
        action="CHECKOUT",
        resource_type="payment",
        resource_id=payment.id,
        project_id=payment.project_id,
        diff={"amount": str(pay_amount), "provider": provider_name, "target": f"{target_type}:{obj.id}"},
    )
    return {
        "payment_id": str(payment.id),
        "transaction_id": str(tx.id),
        "checkout_url": session.checkout_url,
        "provider": provider_name,
        "flow": session.flow,
        "instructions": session.instructions,
        "amount": str(pay_amount),
        "currency": obj.currency,
    }


# ---------------------------------------------------------------------------- encaissement client hors ligne
OFFLINE_METHODS = ("bank_transfer", "cash", "cheque", "mobile_money")
RECEIVABLE_STATUSES = {
    "funds_call": ("issued", "partially_paid", "overdue"),
    "client_invoice": ("validated", "sent", "partially_paid", "overdue"),
}


def pending_receipts(db: Session, target_type: str, target_id: uuid.UUID) -> Decimal:
    """Encaissements hors ligne saisis sur la pièce et encore en attente d'approbation."""
    total = db.execute(
        select(func.coalesce(func.sum(PaymentAllocation.amount), 0))
        .join(Payment, Payment.id == PaymentAllocation.payment_id)
        .where(
            PaymentAllocation.target_type == target_type,
            PaymentAllocation.target_id == target_id,
            Payment.direction == "in",
            Payment.status == "awaiting_approval",
        )
    ).scalar_one()
    return money(Decimal(total))


def receivable_target(db: Session, target_type: str, target_id: uuid.UUID) -> tuple[str, Any]:
    """Pièce client à encaisser ; la facture générée par un appel de fonds est réglée via l'appel (qui la solde)."""
    from app.modules.billing.models import ClientInvoice

    if target_type not in RECEIVABLE_STATUSES:
        raise BusinessRuleError("Encaissement : appel de fonds ou facture client attendu")
    obj = _target(db, target_type, target_id)
    if isinstance(obj, ClientInvoice):
        if obj.deleted_at is not None:
            raise NotFound("Facture introuvable")
        call = db.execute(select(FundsCall).where(FundsCall.client_invoice_id == obj.id)).scalars().first()
        if call is not None:
            return "funds_call", call
    return target_type, obj


def record_offline_receipt(
    db: Session,
    *,
    user_id: uuid.UUID,
    target_type: str,
    target_id: uuid.UUID,
    amount: Decimal | None,
    method: str,
    value_date: date,
    reference: str | None,
    proof_file_id: uuid.UUID | None,
    notes: str | None,
) -> Payment:
    """Règlement client reçu hors plateforme (virement, espèces, chèque, Mobile Money direct) : saisi avec preuve,
    il reste « à approuver » jusqu'à la validation par une autre personne (double regard)."""
    from app.core.pdf import fmt_money
    from app.modules.identity.models import Organization
    from app.modules.projects.models import Project

    target_type, obj = receivable_target(db, target_type, target_id)
    if obj.status not in RECEIVABLE_STATUSES[target_type]:
        raise BusinessRuleError(
            "Pièce non encaissable : appel de fonds émis ou facture validée attendus, non soldés", code="NOT_RECEIVABLE"
        )
    if method not in OFFLINE_METHODS:
        raise BusinessRuleError("Mode de règlement invalide")
    if not proof_file_id:
        raise BusinessRuleError(
            "Preuve de l'encaissement (avis de crédit, bordereau, copie du chèque, reçu Mobile Money) obligatoire",
            code="PROOF_REQUIRED",
        )
    reference = (reference or "").strip() or None
    if method != "cash" and not reference:
        raise BusinessRuleError(
            "Référence obligatoire : n° de virement, de chèque ou de transaction Mobile Money",
            code="REFERENCE_REQUIRED",
        )
    if value_date > date.today():
        raise BusinessRuleError("La date de valeur ne peut pas être dans le futur", code="INVALID_VALUE_DATE")
    pending = pending_receipts(db, target_type, obj.id)
    due = money(outstanding(obj) - pending)
    if due <= 0:
        raise Conflict("Rien à encaisser : pièce soldée ou encaissements en attente d'approbation", code="NOTHING_DUE")
    pay_amount = money(amount) if amount else due
    if pay_amount <= 0 or pay_amount > due:
        waiting = f", hors {fmt_money(pending, obj.currency)} déjà saisis en attente d'approbation" if pending else ""
        raise BusinessRuleError(
            f"Montant supérieur au reste dû ({fmt_money(due, obj.currency)}{waiting})", code="INVALID_AMOUNT"
        )
    if reference:
        twin = (
            db.execute(
                select(Payment.number).where(
                    Payment.direction == "in",
                    Payment.method == method,
                    func.lower(Payment.provider_reference) == reference.lower(),
                    Payment.status.in_(("awaiting_approval", "pending", "processing", "succeeded")),
                )
            )
            .scalars()
            .first()
        )
        if twin:
            raise Conflict(f"Référence déjà enregistrée sur l'encaissement {twin}", code="DUPLICATE_REFERENCE")
    project = db.get(Project, obj.project_id) if obj.project_id else None
    org_id = getattr(obj, "organization_id", None) or (project.client_organization_id if project else None)
    org = db.get(Organization, org_id) if org_id else None
    payment = Payment(
        number=next_number(db, "payment"),
        direction="in",
        counterparty_type="client",
        counterparty_id=org_id,
        counterparty_label=org.name if org else (project.name if project else None),
        project_id=obj.project_id,
        amount=pay_amount,
        currency=obj.currency,
        method=method,
        provider="manual",
        provider_reference=reference,
        status="awaiting_approval",
        initiated_by_id=user_id,
        proof_file_id=proof_file_id,
        value_date=value_date,
        notes=notes,
    )
    payment.allocations.append(PaymentAllocation(target_type=target_type, target_id=obj.id, amount=pay_amount))
    db.add(payment)
    db.flush()
    emit(
        db,
        "payment.awaiting_approval",
        {
            "id": payment.id,
            "number": payment.number,
            "amount": payment.amount,
            "counterparty": payment.counterparty_label,
        },
        aggregate_type="payment",
        aggregate_id=payment.id,
        project_id=payment.project_id,
    )
    audit.record(
        db,
        family="business",
        module="payments",
        action="RECORD_RECEIPT",
        resource_type="payment",
        resource_id=payment.id,
        project_id=payment.project_id,
        diff={
            "amount": str(pay_amount),
            "method": method,
            "reference": reference,
            "value_date": value_date.isoformat(),
            "target": f"{target_type}:{obj.id}",
        },
        criticality="MEDIUM",
    )
    return payment


def _offline_receipt(payment: Payment) -> None:
    if payment.direction != "in" or payment.provider != "manual" or payment.status != "awaiting_approval":
        raise BusinessRuleError("Encaissement non en attente d'approbation")


def approve_offline_receipt(db: Session, payment: Payment, *, principal: Any) -> Payment:
    """Double regard : une autre personne que l'auteur de la saisie confirme l'encaissement ; mêmes effets qu'un
    paiement en ligne confirmé (pièce réglée, séquestre, reçu PDF, notification client, événements)."""
    from app.core.pdf import fmt_money
    from app.core.sod import require_other_person

    _offline_receipt(payment)
    require_other_person(
        db,
        principal,
        payment.initiated_by_id,
        "Double regard : l'encaissement doit être approuvé par une autre personne que celle qui l'a saisi",
        resource_type="payment",
        resource_id=payment.id,
        project_id=payment.project_id,
    )
    for allocation in payment.allocations:
        obj = _target(db, allocation.target_type, allocation.target_id)
        if obj.status in ("cancelled", "credited"):
            raise BusinessRuleError("Pièce annulée depuis la saisie : refusez l'encaissement", code="NOT_RECEIVABLE")
        remaining = outstanding(obj)
        if Decimal(allocation.amount) > remaining:
            raise BusinessRuleError(
                f"Montant supérieur au reste dû ({fmt_money(remaining, payment.currency)}) : la pièce a été réglée "
                "entre-temps",
                code="INVALID_AMOUNT",
            )
    payment.approved_by_id = principal.id
    payment.approved_at = utcnow()
    tx = PaymentTransaction(
        payment_id=payment.id,
        kind="collection",
        provider="manual",
        amount=payment.amount,
        currency=payment.currency,
        status="pending",
    )
    db.add(tx)
    db.flush()
    audit.record(
        db,
        family="business",
        module="payments",
        action="APPROVE",
        resource_type="payment",
        resource_id=payment.id,
        project_id=payment.project_id,
        criticality="HIGH",
    )
    apply_transaction_status(
        db, tx, "succeeded", provider_transaction_id=payment.provider_reference, reason=None, confirmed_by="manual"
    )
    return payment


def reject_offline_receipt(db: Session, payment: Payment, *, reason: str) -> Payment:
    """Refus (preuve illisible, fonds non reçus…) ou retrait d'une saisie erronée : la pièce reste due."""
    _offline_receipt(payment)
    payment.status = "cancelled"
    payment.failure_reason = reason.strip()
    audit.record(
        db,
        family="business",
        module="payments",
        action="REJECT",
        resource_type="payment",
        resource_id=payment.id,
        project_id=payment.project_id,
        reason=payment.failure_reason,
        criticality="MEDIUM",
    )
    return payment


def _resolve_transaction(db: Session, event: Any) -> PaymentTransaction | None:
    tx = None
    if event.reference:
        try:
            tx = db.get(PaymentTransaction, uuid.UUID(str(event.reference)))
        except ValueError:
            tx = None
    if tx is None and event.session_id:
        tx = db.execute(
            select(PaymentTransaction).where(PaymentTransaction.provider_session_id == event.session_id)
        ).scalar_one_or_none()
    return tx


def verify_with_provider(tx: PaymentTransaction, *, provider_transaction_id: str | None = None) -> PaymentStatus:
    """Relecture du statut auprès du prestataire (source de vérité) + contrôle montant / devise."""
    provider: Any = get_payment_provider(tx.provider)
    if tx.kind == "payout":
        verified = provider.fetch_transfer_status(
            reference=str(tx.id), provider_transaction_id=tx.provider_transaction_id or provider_transaction_id
        )
    else:
        verified = provider.fetch_status(
            reference=str(tx.id),
            session_id=tx.provider_session_id,
            provider_transaction_id=provider_transaction_id or tx.provider_transaction_id,
            amount=Decimal(tx.amount),
        )
    if verified.status == "succeeded" and (
        verified.amount is None
        or Decimal(verified.amount) < Decimal(tx.amount)
        or (verified.currency and verified.currency.upper() != tx.currency.upper())
    ):
        return PaymentStatus(
            status="failed",
            provider_transaction_id=verified.provider_transaction_id,
            reason="Montant ou devise incohérents à la vérification",
        )
    return verified


def process_webhook(
    db: Session, provider_name: str, headers: dict[str, str], body: bytes, query: dict[str, str] | None = None
) -> dict[str, Any]:
    """Notification : authentifiée (signature prestataire, URL signée, jeton de transaction), idempotente par
    (prestataire, événement), statut systématiquement relu auprès du prestataire avant application."""
    from app.core import metrics

    provider = get_payment_provider(provider_name)
    event = provider.parse_webhook(headers, body, query)
    tx = _resolve_transaction(db, event)
    if tx is not None and tx.provider != provider_name:
        raise InvalidWebhookSignature(provider_name)
    if event.token is not None and (
        tx is None
        or not tx.webhook_token_hash
        or not hmac.compare_digest(tx.webhook_token_hash, _token_hash(event.token))
    ):
        raise InvalidWebhookSignature(provider_name)
    existing = db.execute(
        select(InboundWebhookEvent).where(
            InboundWebhookEvent.provider == provider_name, InboundWebhookEvent.event_id == event.event_id
        )
    ).scalar_one_or_none()
    if existing is not None:
        metrics.webhook_events.labels(provider_name, "duplicate").inc()
        return {"status": "duplicate"}
    record = InboundWebhookEvent(
        provider=provider_name,
        event_id=event.event_id,
        event_type=event.event_type,
        signature_valid=True,
        payload={"reference": event.reference, **event.raw},
        status="received",
    )
    db.add(record)
    db.flush()
    if tx is None:
        record.status = "ignored"
        record.error = "Transaction inconnue"
        metrics.webhook_events.labels(provider_name, "ignored").inc()
        return {"status": "ignored"}
    verified = verify_with_provider(tx, provider_transaction_id=event.provider_transaction_id)
    tx.last_checked_at = utcnow()
    apply_transaction_status(
        db,
        tx,
        verified.status,
        provider_transaction_id=verified.provider_transaction_id,
        reason=verified.reason,
        confirmed_by="webhook",
    )
    record.status = "processed"
    record.processed_at = utcnow()
    metrics.webhook_events.labels(provider_name, "processed").inc()
    return {"status": "processed", "payment_status": verified.status}


def refresh_transaction(db: Session, tx: PaymentTransaction, *, min_interval_s: int = 8, confirmed_by: str) -> str:
    """Relecture du statut d'une opération en attente (paiement validé sur téléphone, rappel manqué).

    Limité à une interrogation par `min_interval_s` et par opération ; verrou de ligne sans attente pour éviter
    les doubles applications concurrentes."""
    if tx.status != "pending" or tx.provider == "manual":
        return tx.status
    now = utcnow()
    if tx.last_checked_at and tx.last_checked_at > now - timedelta(seconds=min_interval_s):
        return tx.status
    locked = db.execute(
        select(PaymentTransaction).where(PaymentTransaction.id == tx.id).with_for_update(skip_locked=True)
    ).scalar_one_or_none()
    if locked is None or locked.status != "pending":
        return tx.status
    locked.last_checked_at = now
    try:
        verified = verify_with_provider(locked)
    except ProviderError as exc:
        log.warning("payment_refresh_failed", extra={"transaction": str(tx.id), "error": str(exc)[:200]})
        return locked.status
    if verified.status in FINAL_STATUSES:
        apply_transaction_status(
            db,
            locked,
            verified.status,
            provider_transaction_id=verified.provider_transaction_id,
            reason=verified.reason,
            confirmed_by=confirmed_by,
        )
    elif locked.expires_at and locked.expires_at < now:
        reason = (
            "Demande non validée sur le téléphone dans le délai imparti"
            if locked.provider == "mtn_momo"
            else "Session de paiement expirée"
        )
        apply_transaction_status(
            db, locked, "expired", provider_transaction_id=None, reason=reason, confirmed_by=confirmed_by
        )
    return locked.status


def apply_transaction_status(
    db: Session,
    tx: PaymentTransaction,
    status: str,
    *,
    provider_transaction_id: str | None,
    reason: str | None,
    confirmed_by: str,
) -> None:
    payment = db.get(Payment, tx.payment_id)
    if payment is None:
        return
    if payment.status in ("succeeded", "refunded") or tx.status in FINAL_STATUSES:
        return  # idempotent : une opération confirmée ou close ne régresse pas
    tx.raw_status = status
    tx.provider_transaction_id = provider_transaction_id or tx.provider_transaction_id
    if status == "succeeded":
        tx.status = "succeeded"
        tx.completed_at = utcnow()
        payment.status = "succeeded"
        payment.paid_at = utcnow()
        payment.provider_reference = tx.provider_transaction_id
        payment.confirmed_by = confirmed_by
        _allocate(db, payment)
        _receipt(db, payment)
        emit(
            db,
            "payment.succeeded",
            {
                "id": payment.id,
                "number": payment.number,
                "amount": payment.amount,
                "counterparty": payment.counterparty_label,
            },
            aggregate_type="payment",
            aggregate_id=payment.id,
            project_id=payment.project_id,
        )
        if payment.direction == "in" and payment.project_id:
            from app.modules.projects.models import Project

            project = db.get(Project, payment.project_id)
            emit(
                db,
                "client_payment.received",
                {
                    "id": payment.id,
                    "number": payment.number,
                    "amount": payment.amount,
                    "project_name": project.name if project else "",
                    "paid_at": payment.paid_at,
                    "method": payment.method,
                },
                aggregate_type="payment",
                aggregate_id=payment.id,
                project_id=payment.project_id,
            )
        audit.record(
            db,
            family="business",
            module="payments",
            action="CONFIRM",
            resource_type="payment",
            resource_id=payment.id,
            project_id=payment.project_id,
            actor_type="system",
            diff={"status": "succeeded", "by": confirmed_by, "provider_ref": tx.provider_transaction_id},
            criticality="HIGH",
        )
    elif status in ("failed", "cancelled", "expired"):
        tx.status = status
        tx.failure_reason = reason
        payment.status = "failed"
        payment.failure_reason = reason or status
        db.add(
            ActionItem(
                title=f"Paiement {payment.number} en échec",
                description=payment.failure_reason,
                module="finance",
                entity_type="payment",
                entity_id=str(payment.id),
                project_id=payment.project_id,
                assignee_role="FINANCE",
                priority="high",
                source="system",
            )
        )
        emit(
            db,
            "payment.failed",
            {"id": payment.id, "number": payment.number, "amount": payment.amount, "reason": payment.failure_reason},
            aggregate_type="payment",
            aggregate_id=payment.id,
            project_id=payment.project_id,
        )
        audit.record(
            db,
            family="business",
            module="payments",
            action="FAIL",
            resource_type="payment",
            resource_id=payment.id,
            project_id=payment.project_id,
            actor_type="system",
            result="FAIL",
            reason=payment.failure_reason,
            criticality="MEDIUM",
        )
    else:
        tx.status = "pending"


def _allocate(db: Session, payment: Payment) -> None:
    from app.modules.billing.models import ClientInvoice, SupplierInvoice
    from app.modules.subcontracting.models import SubcontractorInvoice

    for allocation in payment.allocations:
        obj = _target(db, allocation.target_type, allocation.target_id)
        obj.amount_paid = money(Decimal(obj.amount_paid or 0) + Decimal(allocation.amount))
        remaining = outstanding(obj)
        if isinstance(obj, FundsCall):
            obj.status = "paid" if remaining <= 0 else "partially_paid"
            from app.modules.escrow.service import on_funds_call_payment

            on_funds_call_payment(db, obj, Decimal(allocation.amount), payment.id)  # séquestre par jalon (R1)
            if obj.client_invoice_id:
                invoice = db.get(ClientInvoice, obj.client_invoice_id)
                if invoice:
                    invoice.amount_paid = money(Decimal(invoice.amount_paid or 0) + Decimal(allocation.amount))
                    invoice.status = "paid" if outstanding(invoice) <= 0 else "partially_paid"
        elif isinstance(obj, (ClientInvoice, SupplierInvoice, SubcontractorInvoice)):
            obj.status = "paid" if remaining <= 0 else "partially_paid"
        elif allocation.target_type == "referral_reward" and remaining <= 0:
            from app.modules.referrals.service import mark_paid

            mark_paid(db, obj)
        if isinstance(obj, (SupplierInvoice, SubcontractorInvoice)) and remaining <= 0:
            _close_after_payment(db, obj)
        paid_invoice = obj if isinstance(obj, ClientInvoice) else None
        if isinstance(obj, FundsCall) and obj.client_invoice_id:
            paid_invoice = db.get(ClientInvoice, obj.client_invoice_id)
        if paid_invoice is not None and paid_invoice.status == "paid":
            from app.modules.documents.deliverables import deliver_for_invoice

            deliver_for_invoice(db, paid_invoice)  # facture d'études réglée : remise des livrables


def _close_after_payment(db: Session, invoice: Any) -> None:
    """Clôture du cycle achat / sous-traitance une fois la facture soldée (§8.1 étape 42, §9 étape 60)."""
    from app.modules.billing.models import SupplierInvoice
    from app.modules.procurement.models import PurchaseOrder
    from app.modules.subcontracting.models import Situation, SubcontractorInvoice

    if isinstance(invoice, SupplierInvoice) and invoice.purchase_order_id:
        po = db.get(PurchaseOrder, invoice.purchase_order_id)
        if (
            po
            and po.status in ("invoiced", "received")
            and all(Decimal(line.quantity_invoiced) >= Decimal(line.quantity_accepted) for line in po.lines)
        ):
            po.status = "closed"
            po.closed_at = utcnow()
    if isinstance(invoice, SubcontractorInvoice) and invoice.situation_id:
        situation = db.get(Situation, invoice.situation_id)
        if situation:
            situation.status = "paid"


METHOD_LABELS = {
    "card": "Carte bancaire",
    "mobile_money": "Mobile Money",
    "bank_transfer": "Virement bancaire",
    "cheque": "Chèque",
    "cash": "Espèces",
}
TARGET_LABELS = {
    "funds_call": "Appel de fonds",
    "client_invoice": "Facture",
    "supplier_invoice": "Facture fournisseur",
    "subcontractor_invoice": "Facture sous-traitant",
    "referral_reward": "Prime de parrainage",
}


def _provider_label(name: str | None) -> str:
    cls = PROVIDERS.get(name or "")
    return cls.label if cls else "Saisie manuelle (preuve jointe)"


def _allocation_text(db: Session, allocation: PaymentAllocation) -> str:
    try:
        obj = _target(db, allocation.target_type, allocation.target_id)
    except (BusinessRuleError, NotFound):
        return TARGET_LABELS.get(allocation.target_type, allocation.target_type)
    reference = getattr(obj, "supplier_reference", None) or getattr(obj, "reference", None)
    label = f"{TARGET_LABELS.get(allocation.target_type, allocation.target_type)} {obj.number}"
    return f"{label} ({reference})" if reference else label


def _counterparty_lines(db: Session, payment: Payment) -> list[str]:
    """Coordonnées du payeur (ou du bénéficiaire) : organisation du client, fournisseur ou sous-traitant si connue."""
    from app.core.pdf import organization_lines
    from app.modules.identity.models import Organization

    org = None
    if payment.counterparty_id and payment.counterparty_type == "client":
        org = db.get(Organization, payment.counterparty_id)
    elif payment.counterparty_id and payment.counterparty_type in ("supplier", "subcontractor"):
        from app.modules.suppliers.models import Supplier

        supplier = db.get(Supplier, payment.counterparty_id)
        org = db.get(Organization, supplier.organization_id) if supplier and supplier.organization_id else None
    lines = organization_lines(org) if org else []
    return lines or [f"<b>{payment.counterparty_label or '—'}</b>"]


def _receipt(db: Session, payment: Payment) -> None:
    from app.core.files import store_generated
    from app.core.pdf import PdfDocument, amount_in_words, company_party, fmt_date, fmt_money, project_label
    from app.modules.documents.seals import sealed_pdf
    from app.modules.projects.models import Project

    offline = payment.direction == "in" and payment.provider == "manual"
    incoming = payment.direction == "in"
    project = db.get(Project, payment.project_id) if payment.project_id else None
    meta = [
        ("Montant", fmt_money(payment.amount, payment.currency)),
        ("Moyen de paiement", METHOD_LABELS.get(payment.method, payment.method)),
        ("Prestataire", "Encaissement vérifié par GLOBUS" if offline else _provider_label(payment.provider)),
        ("Référence", payment.provider_reference or "—"),
        ("Date du paiement", fmt_date(payment.paid_at)),
    ]
    if payment.value_date:
        meta.append(("Date de valeur", fmt_date(payment.value_date)))
    if project is not None:
        meta.append(("Projet", project_label(project)))
    party = ("Reçu de" if incoming else "Bénéficiaire", _counterparty_lines(db, payment))
    doc = PdfDocument(
        title="REÇU DE PAIEMENT" if incoming else "AVIS DE PAIEMENT",
        number=payment.number,
        issued_on=(payment.paid_at or utcnow()).date(),
        parties=[party, company_party()] if incoming else [company_party("Payeur"), party],
        meta=meta,
        columns=["Pièce réglée", "Montant"],
        rows=[[_allocation_text(db, a), fmt_money(a.amount, payment.currency)] for a in payment.allocations],
        col_widths=[130 * 2.83465, 50 * 2.83465],
        totals=[("Total réglé", fmt_money(payment.amount, payment.currency))],
        amount_words=amount_in_words(payment.amount, payment.currency),
        amount_words_label="Reçu la somme de" if incoming else "Payé la somme de",
        signature_blocks=["Pour GLOBUS ENGINEERING — le Service financier"],
        footer_note="Reçu émis automatiquement après confirmation du paiement — à conserver comme justificatif.",
    )
    data = sealed_pdf(
        db,
        doc,
        kind="receipt" if incoming else "payment_notice",
        entity_type="payment",
        entity_id=payment.id,
        reference=payment.number,
        title=doc.title.capitalize(),
        issued_on=doc.issued_on,
        amount=payment.amount,
        currency=payment.currency,
        party=payment.counterparty_label,
    )
    stored = store_generated(
        db,
        data,
        filename=f"recu-{payment.number}.pdf",
        mime="application/pdf",
        purpose="receipts",
        classification="confidential",
    )
    payment.receipt_file_id = stored.id


# ---------------------------------------------------------------------------- paiements sortants
def required_approval_role(db: Session, amount: Decimal) -> str | None:
    from app.modules.procurement.models import ApprovalRule

    rules = (
        db.execute(
            select(ApprovalRule)
            .where(ApprovalRule.entity == "payment", ApprovalRule.is_active.is_(True))
            .order_by(ApprovalRule.min_amount.desc())
        )
        .scalars()
        .all()
    )
    for rule in rules:
        if amount >= Decimal(rule.min_amount) and (rule.max_amount is None or amount <= Decimal(rule.max_amount)):
            return rule.approver_role
    return None


def create_outgoing(
    db: Session,
    *,
    user_id: uuid.UUID,
    target_type: str,
    target_id: uuid.UUID,
    amount: Decimal | None,
    method: str,
    idempotency_key: str,
    notes: str | None,
) -> Payment:
    if target_type not in ("supplier_invoice", "subcontractor_invoice", "referral_reward"):
        raise BusinessRuleError("Paiement sortant : facture fournisseur, sous-traitant ou prime de parrainage attendue")
    obj = _target(db, target_type, target_id)
    if target_type == "referral_reward" and obj.status != "approved":
        raise BusinessRuleError("Prime de parrainage non validée par la Direction commerciale", code="NOT_APPROVED")
    if target_type == "supplier_invoice" and obj.status not in ("approved_for_payment", "partially_paid"):
        raise BusinessRuleError("Facture non validée par la finance (contrôle 3 pièces requis)", code="NOT_APPROVED")
    if target_type == "subcontractor_invoice" and obj.status not in (
        "approved_for_payment",
        "validated",
        "partially_paid",
    ):
        raise BusinessRuleError("Facture sous-traitant non validée", code="NOT_APPROVED")
    due = outstanding(obj)
    pay_amount = money(amount) if amount else due
    if pay_amount <= 0 or pay_amount > due:
        raise BusinessRuleError(f"Montant invalide (reste à payer {due})", code="INVALID_AMOUNT")
    if Decimal(getattr(obj, "amount_frozen", 0) or 0) > 0 and pay_amount > due:
        raise BusinessRuleError("Montant gelé par un litige", code="AMOUNT_FROZEN")
    counterparty_id = next(
        (getattr(obj, k) for k in ("supplier_id", "subcontractor_id", "ambassador_id") if getattr(obj, k, None)), None
    )
    payment = Payment(
        number=next_number(db, "payment"),
        direction="out",
        counterparty_type={"supplier_invoice": "supplier", "referral_reward": "ambassador"}.get(
            target_type, "subcontractor"
        ),
        counterparty_id=counterparty_id,
        counterparty_label=_counterparty_label(db, obj),
        project_id=getattr(obj, "project_id", None),
        amount=pay_amount,
        currency=getattr(obj, "currency", "XAF"),
        method=method,
        provider="manual",
        status="awaiting_approval",
        initiated_by_id=user_id,
        idempotency_key=f"out:{idempotency_key}",
        notes=notes,
    )
    payment.allocations.append(PaymentAllocation(target_type=target_type, target_id=obj.id, amount=pay_amount))
    db.add(payment)
    try:
        db.flush()
    except IntegrityError as exc:
        raise Conflict("Paiement déjà créé pour cette clé", code="DUPLICATE_PAYMENT") from exc
    emit(
        db,
        "payment.awaiting_approval",
        {
            "id": payment.id,
            "number": payment.number,
            "amount": payment.amount,
            "counterparty": payment.counterparty_label,
        },
        aggregate_type="payment",
        aggregate_id=payment.id,
        project_id=payment.project_id,
    )
    audit.record(
        db,
        family="business",
        module="payments",
        action="CREATE",
        resource_type="payment",
        resource_id=payment.id,
        project_id=payment.project_id,
        diff={"amount": str(pay_amount)},
    )
    return payment


def _counterparty_label(db: Session, obj: Any) -> str:
    from app.modules.subcontracting.models import Subcontractor
    from app.modules.suppliers.models import Supplier

    if getattr(obj, "supplier_id", None):
        s = db.get(Supplier, obj.supplier_id)
        return s.legal_name if s else ""
    if getattr(obj, "subcontractor_id", None):
        s = db.get(Subcontractor, obj.subcontractor_id)
        return s.legal_name if s else ""
    if getattr(obj, "ambassador_id", None):
        from app.modules.referrals.models import Ambassador

        a = db.get(Ambassador, obj.ambassador_id)
        return a.full_name if a else ""
    return ""


def approve_outgoing(db: Session, payment: Payment, *, principal: Any, override_reason: str | None = None) -> Payment:
    if payment.status != "awaiting_approval":
        raise BusinessRuleError("Paiement non en attente d'approbation")
    role = required_approval_role(db, Decimal(payment.amount))
    if role and role not in principal.roles and "ADMIN" not in principal.roles:
        raise BusinessRuleError(f"Approbation réservée au rôle {role}", code="APPROVAL_ROLE_REQUIRED")
    from app.core.sod import require_other_person

    require_other_person(
        db,
        principal,
        payment.initiated_by_id,
        "Séparation des tâches : l'initiateur ne peut pas approuver son paiement",
        resource_type="payment",
        resource_id=payment.id,
        project_id=payment.project_id,
    )
    from app.modules.ai.controls import clear_payment

    clear_payment(db, payment, principal=principal, override_reason=override_reason)  # contrôle interne (A5)
    payment.status = "pending"
    payment.approved_by_id = principal.id
    payment.approved_at = utcnow()
    audit.record(
        db,
        family="business",
        module="payments",
        action="APPROVE",
        resource_type="payment",
        resource_id=payment.id,
        project_id=payment.project_id,
        criticality="HIGH",
    )
    return payment


def execute_outgoing(
    db: Session,
    payment: Payment,
    *,
    principal: Any,
    proof_file_id: uuid.UUID | None,
    bank_reference: str | None,
    provider_name: str | None = None,
) -> Payment:
    """Exécution : virement / Mobile Money manuel avec preuve, ou transfert via un prestataire
    (MTN MoMo Disbursements, Flutterwave) suivi jusqu'à confirmation."""
    if payment.status != "pending" or payment.direction != "out":
        raise BusinessRuleError("Paiement non approuvé ou déjà exécuté")
    if provider_name:
        provider: Any = get_payment_provider(provider_name)
        if not getattr(provider, "payouts", False):
            raise BusinessRuleError("Ce prestataire n'exécute pas de paiements sortants")
        account, bank_code = _beneficiary(db, payment, provider_name)
        tx = PaymentTransaction(
            payment_id=payment.id,
            kind="payout",
            provider=provider_name,
            amount=payment.amount,
            currency=payment.currency,
            customer_phone=account if provider_name == "mtn_momo" else None,
            status="created",
        )
        db.add(tx)
        db.flush()
        result = provider.transfer(
            PayoutRequest(
                reference=str(tx.id),
                amount=Decimal(payment.amount),
                currency=payment.currency,
                account=account,
                bank_code=bank_code,
                beneficiary_name=payment.counterparty_label or "",
                narration=f"GLOBUS {payment.number}",
                notify_url=notify_url(provider_name, str(tx.id)),
            )
        )
        tx.provider_session_id = str(tx.id)
        tx.provider_transaction_id = result.provider_transaction_id
        tx.status = "pending"
        tx.expires_at = utcnow() + timedelta(hours=24)
        payment.provider = provider_name
        payment.status = "processing"
    else:
        if not proof_file_id:
            raise BusinessRuleError(
                "Preuve de paiement (ordre de virement, reçu Mobile Money) obligatoire", code="PROOF_REQUIRED"
            )
        payment.proof_file_id = proof_file_id
        payment.provider_reference = bank_reference
        tx = PaymentTransaction(
            payment_id=payment.id,
            kind="payout",
            provider="manual",
            amount=payment.amount,
            currency=payment.currency,
            status="pending",
        )
        db.add(tx)
        db.flush()
        apply_transaction_status(
            db, tx, "succeeded", provider_transaction_id=bank_reference, reason=None, confirmed_by="manual"
        )
    audit.record(
        db,
        family="business",
        module="payments",
        action="EXECUTE",
        resource_type="payment",
        resource_id=payment.id,
        project_id=payment.project_id,
        criticality="HIGH",
        diff={"provider": provider_name or "manual", "reference": bank_reference},
    )
    return payment


def _beneficiary(db: Session, payment: Payment, provider_name: str) -> tuple[str, str | None]:
    """Compte du bénéficiaire pour un transfert prestataire : (numéro / compte, code banque)."""
    from app.modules.referrals.models import Ambassador
    from app.modules.subcontracting.models import Subcontractor
    from app.modules.suppliers.models import Supplier

    model = {"supplier": Supplier, "ambassador": Ambassador}.get(payment.counterparty_type, Subcontractor)
    party = db.get(model, payment.counterparty_id) if payment.counterparty_id else None
    if party is None:
        raise BusinessRuleError("Bénéficiaire introuvable")
    if isinstance(party, Ambassador):  # prime de parrainage : Mobile Money uniquement
        msisdn = normalize_msisdn(party.momo_number)
        if not msisdn:
            raise BusinessRuleError("Numéro Mobile Money de l'ambassadeur manquant ou invalide", code="PAYEE_MISSING")
        return (msisdn, None) if provider_name == "mtn_momo" else (msisdn, "FMM")
    if provider_name == "mtn_momo":
        msisdn = normalize_msisdn(party.mobile_money_number)
        if not msisdn:
            raise BusinessRuleError("Numéro Mobile Money du bénéficiaire manquant ou invalide", code="PAYEE_MISSING")
        return msisdn, None
    if party.mobile_money_number:
        return party.mobile_money_number, "FMM"
    if not party.bank_account:
        raise BusinessRuleError("Coordonnées de paiement du bénéficiaire manquantes", code="PAYEE_MISSING")
    return party.bank_account, getattr(party, "bank_name", None) or ""


def reconcile_pending(db: Session) -> dict[str, Any]:
    """Job : relit auprès des prestataires les opérations en attente (rappel manqué, transfert en cours)."""
    count = 0
    rows = (
        db.execute(
            select(PaymentTransaction)
            .where(
                PaymentTransaction.status == "pending",
                PaymentTransaction.provider.in_(list(PROVIDERS)),
                PaymentTransaction.created_at < utcnow() - timedelta(minutes=2),
            )
            .order_by(PaymentTransaction.created_at)
            .limit(100)
        )
        .scalars()
        .all()
    )
    for tx in rows:
        if tx.provider not in settings.PAYMENT_PROVIDERS:
            continue
        before = tx.status
        if refresh_transaction(db, tx, min_interval_s=60, confirmed_by="reconciliation") != before:
            count += 1
    return {"items": count}
