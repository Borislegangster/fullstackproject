"""Contrôle interne automatique (innovation A5) — règles explicables en complément de `detect_anomalies` :

  • fractionnement de commandes : plusieurs BC d'un même fournisseur en 7 jours, chacun sous un seuil
    d'approbation, dont le cumul le dépasse ;
  • facture quasi-dupliquée : même fournisseur, même montant, numéro identique une fois normalisé ;
  • facture antérieure à la commande ;
  • coordonnées bancaires / Mobile Money modifiées moins de 30 jours avant un paiement sortant ;
  • double paiement d'une même facture.

Le filtrage des paiements est fait EN TEMPS RÉEL à l'approbation : une anomalie grave ouverte bloque le paiement ;
seule la Direction peut passer outre, avec une justification tracée (journal de sécurité).
"""

from __future__ import annotations

import re
import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import BusinessRuleError
from app.core.utils import utcnow
from app.modules.ai.models import Anomaly

BLOCKING_SEVERITIES = ("high", "critical")
OPEN_STATUSES = ("new", "confirmed")


def _anomaly(db: Session, **kwargs: Any) -> bool:
    from app.modules.ai.service import _anomaly as create

    return create(db, **kwargs)


def _approval_thresholds(db: Session) -> list[Decimal]:
    from app.modules.procurement.models import ApprovalRule

    values = {
        Decimal(r.min_amount)
        for r in db.execute(
            select(ApprovalRule).where(
                ApprovalRule.entity.in_(["purchase_request", "purchase_order"]), ApprovalRule.is_active.is_(True)
            )
        ).scalars()
        if Decimal(r.min_amount) > 0
    }
    return sorted(values)


def _norm_ref(reference: str) -> str:
    """« FA-0042 », « fa 42 », « FA/042 » → « FA42 » : casse, séparateurs et zéros de tête de chaque nombre ignorés."""
    tokens = re.findall(r"[A-Z]+|\d+", (reference or "").upper())
    return "".join(t.lstrip("0") or "0" if t.isdigit() else t for t in tokens)


def split_orders(db: Session) -> int:
    from app.modules.procurement.models import PurchaseOrder

    thresholds = _approval_thresholds(db)
    if not thresholds:
        return 0
    since = utcnow() - timedelta(days=30)
    orders = (
        db.execute(
            select(PurchaseOrder)
            .where(
                PurchaseOrder.created_at >= since,
                PurchaseOrder.deleted_at.is_(None),
                PurchaseOrder.status.not_in(["cancelled", "draft"]),
            )
            .order_by(PurchaseOrder.supplier_id, PurchaseOrder.created_at)
        )
        .scalars()
        .all()
    )
    created = 0
    by_supplier: dict[uuid.UUID, list[Any]] = {}
    for po in orders:
        by_supplier.setdefault(po.supplier_id, []).append(po)
    for supplier_id, pos in by_supplier.items():
        for index, first in enumerate(pos):
            window = [p for p in pos[index:] if p.created_at - first.created_at <= timedelta(days=7)]
            if len(window) < 2:
                continue
            total = sum((Decimal(p.total) for p in window), Decimal("0"))
            for threshold in thresholds:
                if all(Decimal(p.total) < threshold for p in window) and total >= threshold:
                    if _anomaly(
                        db,
                        kind="split_orders",
                        entity_type="purchase_order",
                        entity_id=window[-1].id,
                        project_id=window[-1].project_id,
                        description=(
                            f"{len(window)} BC du même fournisseur en 7 jours ({', '.join(p.number for p in window)}),"
                            f" chacun sous le seuil d'approbation de {threshold:,.0f} FCFA, cumul {total:,.0f} FCFA"
                        ).replace(",", " "),
                        evidence={
                            "orders": [str(p.id) for p in window],
                            "threshold": str(threshold),
                            "total": str(total),
                            "supplier_id": str(supplier_id),
                        },
                        amount=total,
                        severity="high",
                        score=0.8,
                    ):
                        created += 1
                    break
    return created


def near_duplicate_invoices(db: Session) -> int:
    from app.modules.billing.models import SupplierInvoice

    since = utcnow() - timedelta(days=90)
    invoices = (
        db.execute(
            select(SupplierInvoice).where(
                SupplierInvoice.created_at >= since,
                SupplierInvoice.deleted_at.is_(None),
                SupplierInvoice.status != "rejected",
            )
        )
        .scalars()
        .all()
    )
    created = 0
    seen: dict[tuple[Any, str, Decimal], Any] = {}
    for invoice in sorted(invoices, key=lambda i: i.created_at):
        key = (invoice.supplier_id, _norm_ref(invoice.supplier_reference), Decimal(invoice.total))
        twin = seen.get(key)
        if twin is not None and _anomaly(
            db,
            kind="invoice_near_duplicate",
            entity_type="supplier_invoice",
            entity_id=invoice.id,
            project_id=invoice.project_id,
            description=f"Facture « {invoice.supplier_reference} » : même fournisseur, même montant et même numéro "
            f"(une fois normalisé) que « {twin.supplier_reference} »",
            evidence={"twin": str(twin.id), "total": str(invoice.total)},
            amount=Decimal(invoice.total),
            severity="high",
            score=0.9,
        ):
            created += 1
        seen.setdefault(key, invoice)
    return created


def invoices_before_order(db: Session) -> int:
    from app.modules.billing.models import SupplierInvoice
    from app.modules.procurement.models import PurchaseOrder

    since = utcnow() - timedelta(days=90)
    rows = db.execute(
        select(SupplierInvoice, PurchaseOrder)
        .join(PurchaseOrder, PurchaseOrder.id == SupplierInvoice.purchase_order_id)
        .where(SupplierInvoice.created_at >= since, SupplierInvoice.deleted_at.is_(None))
    ).all()
    created = 0
    for invoice, po in rows:
        if invoice.invoice_date < po.created_at.date() and _anomaly(
            db,
            kind="invoice_before_order",
            entity_type="supplier_invoice",
            entity_id=invoice.id,
            project_id=invoice.project_id,
            description=f"Facture {invoice.supplier_reference} datée du {invoice.invoice_date:%d/%m/%Y}, avant le "
            f"BC {po.number} ({po.created_at:%d/%m/%Y}) : régularisation a posteriori ?",
            evidence={"purchase_order": str(po.id)},
            amount=Decimal(invoice.total),
            severity="medium",
            score=0.6,
        ):
            created += 1
    return created


def _bank_change(db: Session, payment: Any) -> Any:
    from app.modules.system.models import AuditEvent

    if not payment.counterparty_id:
        return None
    since = (payment.created_at or utcnow()) - timedelta(days=30)
    events = (
        db.execute(
            select(AuditEvent)
            .where(
                AuditEvent.resource_type.in_(["supplier", "subcontractor", "ambassador"]),
                AuditEvent.resource_id == str(payment.counterparty_id),
                AuditEvent.timestamp_utc >= since,
                AuditEvent.action.in_(["UPDATE", "BANK_UPDATE"]),
            )
            .order_by(AuditEvent.timestamp_utc.desc())
        )
        .scalars()
        .all()
    )

    def changed(event: Any) -> bool:
        # une première saisie (« ajouté ») n'est pas un changement : seule la modification de coordonnées existantes
        # (technique classique de détournement de paiement) déclenche le contrôle
        return any(
            (event.diff or {}).get(k) not in (None, "***ajouté") for k in ("bank_account", "mobile_money_number")
        )

    return next((e for e in events if changed(e)), None)


def _duplicate_payment(db: Session, payment: Any) -> Any:
    from app.modules.finance.models import Payment, PaymentAllocation

    targets = [(a.target_type, a.target_id) for a in payment.allocations]
    if not targets:
        return None
    return (
        db.execute(
            select(Payment)
            .join(PaymentAllocation, PaymentAllocation.payment_id == Payment.id)
            .where(
                Payment.id != payment.id,
                Payment.direction == "out",
                Payment.status.not_in(["failed", "cancelled"]),
                Payment.amount == payment.amount,
                or_(*[(PaymentAllocation.target_type == t) & (PaymentAllocation.target_id == i) for t, i in targets]),
            )
        )
        .scalars()
        .first()
    )


def screen_payment(db: Session, payment: Any) -> list[Anomaly]:
    """Filtrage temps réel d'un paiement sortant ; renvoie les anomalies graves ouvertes qui le concernent."""
    change = _bank_change(db, payment)
    if change is not None:
        _anomaly(
            db,
            kind="bank_details_changed",
            entity_type="payment",
            entity_id=payment.id,
            project_id=payment.project_id,
            description=f"Paiement {payment.number} : coordonnées bancaires / Mobile Money du bénéficiaire modifiées "
            f"le {change.timestamp_utc:%d/%m/%Y} — rappeler le bénéficiaire sur un numéro connu avant de payer",
            evidence={"audit_event": str(change.event_id), "changed_by": str(change.actor_id)},
            amount=Decimal(payment.amount),
            severity="high",
            score=0.85,
        )
    twin = _duplicate_payment(db, payment)
    if twin is not None:
        _anomaly(
            db,
            kind="duplicate_payment",
            entity_type="payment",
            entity_id=payment.id,
            project_id=payment.project_id,
            description=f"Paiement {payment.number} : même montant et même facture que le paiement {twin.number}",
            evidence={"twin": str(twin.id)},
            amount=Decimal(payment.amount),
            severity="high",
            score=0.9,
        )
    db.flush()
    entities = [("payment", str(payment.id))] + [(a.target_type, str(a.target_id)) for a in payment.allocations]
    if payment.counterparty_id:
        entities.append(("supplier", str(payment.counterparty_id)))
    return list(
        db.execute(
            select(Anomaly).where(
                or_(*[(Anomaly.entity_type == t) & (Anomaly.entity_id == i) for t, i in entities]),
                Anomaly.status.in_(OPEN_STATUSES),
                Anomaly.severity.in_(BLOCKING_SEVERITIES),
            )
        ).scalars()
    )


def clear_payment(db: Session, payment: Any, *, principal: Any, override_reason: str | None) -> None:
    """Bloque l'approbation tant qu'une anomalie grave est ouverte ; dérogation Direction motivée et tracée."""
    blocking = screen_payment(db, payment)
    if not blocking:
        return
    can_override = bool({"DIRECTION", "ADMIN"} & set(principal.roles))
    if not override_reason or len(override_reason.strip()) < 15 or not can_override:
        raise BusinessRuleError(
            "Paiement bloqué par le contrôle interne : " + " ; ".join(a.description for a in blocking)[:900],
            code="CONTROL_BLOCK",
            details={
                "anomalies": [{"id": str(a.id), "kind": a.kind, "description": a.description} for a in blocking],
                "override": "Direction, avec justification (15 caractères minimum)",
            },
        )
    now = utcnow()
    for anomaly in blocking:
        anomaly.status = "dismissed"
        anomaly.reviewed_by_id = principal.id
        anomaly.reviewed_at = now
        anomaly.review_note = f"Dérogation au paiement {payment.number} : {override_reason.strip()}"
    audit.record(
        db,
        family="security",
        module="controls",
        action="CONTROL_OVERRIDE",
        resource_type="payment",
        resource_id=payment.id,
        project_id=payment.project_id,
        actor_id=principal.id,
        reason=override_reason.strip(),
        diff={"anomalies": [str(a.id) for a in blocking]},
        criticality="HIGH",
    )


def detect_control_anomalies(db: Session) -> int:
    """Règles de contrôle interne exécutées par le job nocturne `anomaly_detection`."""
    from app.modules.finance.models import Payment

    created = split_orders(db) + near_duplicate_invoices(db) + invoices_before_order(db)
    recent = (
        db.execute(
            select(Payment).where(
                Payment.direction == "out",
                Payment.created_at >= utcnow() - timedelta(days=30),
                Payment.status.in_(["awaiting_approval", "pending"]),
            )
        )
        .scalars()
        .all()
    )
    for payment in recent:
        before = db.execute(select(Anomaly.id).where(Anomaly.entity_id == str(payment.id))).all()
        screen_payment(db, payment)
        after = db.execute(select(Anomaly.id).where(Anomaly.entity_id == str(payment.id))).all()
        created += max(0, len(after) - len(before))
    return created


__all__ = ["clear_payment", "detect_control_anomalies", "screen_payment"]
