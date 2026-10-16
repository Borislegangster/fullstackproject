"""Recouvrement automatique (innovation A6) : liens de paiement en un clic (MTN MoMo, Orange Money, carte) joints
aux relances, et échéanciers (demande client → validation finance → acceptation par code à usage unique), avec
relances par échéance. Les paiements passent par les prestataires réels configurés : aucun paiement simulé."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_DOWN, Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.errors import BusinessRuleError, Conflict, NotFound
from app.core.events import emit
from app.core.numbering import next_number
from app.core.security import random_token, sha256_hex
from app.core.utils import jsonable, money, utcnow
from app.modules.billing.models import PayLink, PaymentPlan, PaymentReminder

PLAN_DEFAULTS: dict[str, Any] = {
    "max_installments": 4,
    "max_days": 120,
    "min_first_pct": 25,
    "interval_days": 30,
    "auto_approve": False,
    "auto_approve_max_amount": 0,
    "late_tolerance_days": 15,
    "link_days": 30,
}
ACTIVE_PLAN = ("active",)


def plan_policy(db: Session) -> dict[str, Any]:
    from app.modules.system.models import Setting

    row = db.get(Setting, "payment_plans")
    return {**PLAN_DEFAULTS, **(row.value if row and isinstance(row.value, dict) else {})}


def _target(db: Session, target_type: str, target_id: uuid.UUID) -> Any:
    from app.modules.finance.payments import _target as load

    if target_type not in ("client_invoice", "funds_call"):
        raise BusinessRuleError("Seules les factures clients et appels de fonds sont concernés")
    return load(db, target_type, target_id)


def _due(obj: Any) -> Decimal:
    from app.modules.finance.payments import outstanding

    return outstanding(obj)


def _label(obj: Any) -> str:
    return getattr(obj, "title", None) or getattr(obj, "label", None) or obj.number


# ============================================================================ liens de paiement
def create_pay_link(
    db: Session,
    *,
    target_type: str,
    target_id: uuid.UUID,
    channel: str = "manual",
    plan: PaymentPlan | None = None,
    installment_index: int | None = None,
    amount: Decimal | None = None,
    created_by_id: uuid.UUID | None = None,
) -> tuple[PayLink, str]:
    obj = _target(db, target_type, target_id)
    token = random_token(24)
    link = PayLink(
        token_hash=sha256_hex(token),
        target_type=target_type,
        target_id=obj.id,
        plan_id=plan.id if plan else None,
        installment_index=installment_index,
        amount=money(amount) if amount else None,
        project_id=getattr(obj, "project_id", None),
        channel=channel,
        expires_at=utcnow() + timedelta(days=int(plan_policy(db)["link_days"])),
        created_by_id=created_by_id,
    )
    db.add(link)
    db.flush()
    return link, f"{settings.PUBLIC_BASE_URL.rstrip('/')}/payer/{token}"


def resolve_pay_link(db: Session, token: str) -> PayLink:
    link = db.execute(select(PayLink).where(PayLink.token_hash == sha256_hex(token))).scalar_one_or_none()
    if link is None or link.revoked_at is not None:
        raise NotFound("Lien de paiement inconnu ou révoqué")
    if link.expires_at < utcnow():
        raise NotFound("Lien de paiement expiré : demandez-en un nouveau à notre service comptable")
    return link


def _link_amount(db: Session, link: PayLink, obj: Any) -> Decimal:
    due = _due(obj)
    if link.plan_id and link.installment_index is not None:
        plan = db.get(PaymentPlan, link.plan_id)
        if plan is not None:
            refresh_plan(db, plan)
            item = next((i for i in plan.installments if i["index"] == link.installment_index), None)
            if item is not None:
                return min(due, money(Decimal(str(item.get("remaining", item["amount"])))))
    if link.amount:
        return min(due, money(link.amount))
    return due


def pay_link_view(db: Session, link: PayLink) -> dict[str, Any]:
    from app.modules.cms.models import SiteSettings
    from app.modules.projects.models import Project
    from app.providers.payments import available_payment_methods

    obj = _target(db, link.target_type, link.target_id)
    project = db.get(Project, obj.project_id) if getattr(obj, "project_id", None) else None
    site = db.execute(select(SiteSettings)).scalars().first()
    amount = _link_amount(db, link, obj)
    plan = db.get(PaymentPlan, link.plan_id) if link.plan_id else None
    return jsonable(
        {
            "company": getattr(site, "company_name", None) or "GLOBUS ENGINEERING",
            "kind": "Facture" if link.target_type == "client_invoice" else "Appel de fonds",
            "number": obj.number,
            "label": _label(obj),
            "project_name": project.name if project else None,
            "currency": obj.currency,
            "amount_due": amount,
            "balance_due": _due(obj),
            "due_date": getattr(obj, "due_date", None),
            "installment": (
                {"index": link.installment_index, "count": len(plan.installments), "plan": plan.number}
                if plan and link.installment_index is not None
                else None
            ),
            "paid": amount <= 0,
            "methods": available_payment_methods(),
            "expires_at": link.expires_at,
        }
    )


@dataclass
class Payer:
    """Payeur d'un lien de paiement (sans compte requis)."""

    full_name: str
    email: str | None
    phone: str | None
    id: uuid.UUID | None = None


def pay_with_link(
    db: Session,
    link: PayLink,
    *,
    provider: str,
    method: str,
    payer: Payer,
    idempotency_key: str,
) -> dict[str, Any]:
    from app.modules.finance.payments import start_client_checkout

    if provider not in settings.PAYMENT_PROVIDERS:
        raise BusinessRuleError("Prestataire de paiement non disponible")
    obj = _target(db, link.target_type, link.target_id)
    amount = _link_amount(db, link, obj)
    if amount <= 0:
        raise Conflict("Rien à régler : cette pièce est soldée — merci !", code="NOTHING_DUE")
    base = settings.PUBLIC_BASE_URL.rstrip("/")
    result = start_client_checkout(
        db,
        user=payer,
        target_type=link.target_type,
        target_id=link.target_id,
        provider_name=provider,
        method=method,
        amount=amount,
        idempotency_key=f"paylink:{idempotency_key}",
        payer_phone=payer.phone,
        return_url=f"{base}/payer/retour/{{transaction_id}}",
        cancel_url=f"{base}/",
    )
    link.uses += 1
    link.last_used_at = utcnow()
    return result


# ============================================================================ échéanciers
def _split(total: Decimal, count: int, first_pct: Decimal) -> list[Decimal]:
    total = money(total)
    first = money(max(total * first_pct / 100, total / count))
    rest = total - first
    if count == 1:
        return [total]
    each = (rest / (count - 1)).quantize(Decimal("1"), rounding=ROUND_DOWN)
    parts = [first] + [each] * (count - 1)
    parts[-1] += total - sum(parts)
    return [money(p) for p in parts]


def _schedule(total: Decimal, count: int, policy: dict[str, Any], start: date | None = None) -> list[dict[str, Any]]:
    start = start or date.today() + timedelta(days=7)
    amounts = _split(total, count, Decimal(str(policy["min_first_pct"])))
    return [
        {
            "index": i + 1,
            "due_date": (start + timedelta(days=int(policy["interval_days"]) * i)).isoformat(),
            "amount": str(amount),
            "status": "pending",
        }
        for i, amount in enumerate(amounts)
    ]


def _open_plan(db: Session, target_type: str, target_id: uuid.UUID) -> PaymentPlan | None:
    return (
        db.execute(
            select(PaymentPlan).where(
                PaymentPlan.target_type == target_type,
                PaymentPlan.target_id == target_id,
                PaymentPlan.status.in_(["requested", "proposed", "active"]),
            )
        )
        .scalars()
        .first()
    )


def has_active_plan(db: Session, target_type: str, target_id: uuid.UUID) -> bool:
    plan = _open_plan(db, target_type, target_id)
    return plan is not None and plan.status == "active"


def request_plan(
    db: Session, *, target_type: str, target_id: uuid.UUID, user: Any, count: int, reason: str | None
) -> PaymentPlan:
    """Demande d'échelonnement par le client (proposition calculée selon la politique ; validation finance)."""
    policy = plan_policy(db)
    obj = _target(db, target_type, target_id)
    due = _due(obj)
    if due <= 0:
        raise Conflict("Rien à échelonner : la pièce est soldée", code="NOTHING_DUE")
    if not 2 <= count <= int(policy["max_installments"]):
        raise BusinessRuleError(f"Entre 2 et {policy['max_installments']} échéances", code="PLAN_POLICY")
    if _open_plan(db, target_type, obj.id) is not None:
        raise Conflict("Un échéancier est déjà en cours pour cette pièce", code="PLAN_EXISTS")
    plan = PaymentPlan(
        number=next_number(db, "payment_plan"),
        target_type=target_type,
        target_id=obj.id,
        project_id=getattr(obj, "project_id", None),
        total_amount=due,
        installments=_schedule(due, count, policy),
        status="requested",
        reason=(reason or "").strip()[:2000] or None,
        requested_by_id=user.id,
    )
    if policy["auto_approve"] and due <= Decimal(str(policy["auto_approve_max_amount"] or 0)):
        plan.status = "proposed"
        plan.decision_note = "Proposition automatique conforme à la politique d'échelonnement"
        plan.decided_at = utcnow()
    db.add(plan)
    db.flush()
    emit(
        db,
        "payment_plan.requested" if plan.status == "requested" else "payment_plan.proposed",
        {
            "id": plan.id,
            "number": plan.number,
            "target": obj.number,
            "amount": due,
            "count": count,
            "client": user.full_name,
        },
        aggregate_type="payment_plan",
        aggregate_id=plan.id,
        project_id=plan.project_id,
    )
    return plan


def _validate_installments(
    plan: PaymentPlan, installments: list[dict[str, Any]], policy: dict[str, Any]
) -> list[dict[str, Any]]:
    if not 1 <= len(installments) <= int(policy["max_installments"]):
        raise BusinessRuleError("Nombre d'échéances hors politique", code="PLAN_POLICY")
    rows = []
    previous: date | None = None
    for index, item in enumerate(installments):
        due_date = date.fromisoformat(str(item["due_date"]))
        amount = money(Decimal(str(item["amount"])))
        if amount <= 0:
            raise BusinessRuleError("Montant d'échéance invalide")
        if previous and due_date <= previous:
            raise BusinessRuleError("Dates d'échéance strictement croissantes")
        if (due_date - date.today()).days > int(policy["max_days"]):
            raise BusinessRuleError(f"Dernière échéance au plus tard à {policy['max_days']} jours", code="PLAN_POLICY")
        previous = due_date
        rows.append({"index": index + 1, "due_date": due_date.isoformat(), "amount": str(amount), "status": "pending"})
    if sum(Decimal(r["amount"]) for r in rows) != money(plan.total_amount):
        raise BusinessRuleError("La somme des échéances doit égaler le montant restant dû", code="PLAN_TOTAL")
    return rows


def propose_plan(
    db: Session, plan: PaymentPlan, *, user_id: uuid.UUID, installments: list[dict[str, Any]] | None, note: str | None
) -> PaymentPlan:
    if plan.status not in ("requested", "proposed"):
        raise BusinessRuleError("Échéancier déjà traité")
    if installments:
        plan.installments = _validate_installments(plan, installments, plan_policy(db))
    plan.status = "proposed"
    plan.decided_by_id = user_id
    plan.decided_at = utcnow()
    plan.decision_note = note
    audit.record(
        db,
        family="business",
        module="billing",
        action="PLAN_PROPOSE",
        resource_type="payment_plan",
        resource_id=plan.id,
        project_id=plan.project_id,
        actor_id=user_id,
        diff={"installments": plan.installments},
    )
    emit(
        db,
        "payment_plan.proposed",
        {"id": plan.id, "number": plan.number, "count": len(plan.installments), "amount": plan.total_amount},
        aggregate_type="payment_plan",
        aggregate_id=plan.id,
        project_id=plan.project_id,
    )
    return plan


def reject_plan(db: Session, plan: PaymentPlan, *, user_id: uuid.UUID, note: str) -> PaymentPlan:
    if plan.status not in ("requested", "proposed"):
        raise BusinessRuleError("Échéancier déjà traité")
    plan.status = "rejected"
    plan.decided_by_id = user_id
    plan.decided_at = utcnow()
    plan.decision_note = note
    emit(
        db,
        "payment_plan.rejected",
        {"id": plan.id, "number": plan.number, "note": note},
        aggregate_type="payment_plan",
        aggregate_id=plan.id,
        project_id=plan.project_id,
    )
    return plan


def accept_plan(db: Session, plan: PaymentPlan, *, user: Any, otp: dict[str, Any], ip: str | None) -> PaymentPlan:
    """Acceptation par le client (code à usage unique) : l'échéancier devient l'engagement de paiement."""
    if plan.status != "proposed":
        raise BusinessRuleError("Aucune proposition à accepter", code="PLAN_NOT_PROPOSED")
    obj = _target(db, plan.target_type, plan.target_id)
    plan.status = "active"
    plan.accepted_at = utcnow()
    plan.paid_baseline = money(Decimal(obj.amount_paid or 0))
    plan.acceptance_proof = jsonable({"otp": otp, "ip": ip, "accepted_by": user.full_name})
    audit.record(
        db,
        family="business",
        module="billing",
        action="PLAN_ACCEPT",
        resource_type="payment_plan",
        resource_id=plan.id,
        project_id=plan.project_id,
        actor_id=user.id,
        criticality="MEDIUM",
    )
    emit(
        db,
        "payment_plan.accepted",
        {"id": plan.id, "number": plan.number, "client": user.full_name, "target": obj.number},
        aggregate_type="payment_plan",
        aggregate_id=plan.id,
        project_id=plan.project_id,
    )
    return plan


def refresh_plan(db: Session, plan: PaymentPlan, today: date | None = None) -> PaymentPlan:
    """Rapproche les règlements reçus depuis l'activation des échéances (dans l'ordre) ; retard et défaut."""
    if plan.status not in ("active", "defaulted"):
        return plan
    today = today or date.today()
    obj = _target(db, plan.target_type, plan.target_id)
    available = money(Decimal(obj.amount_paid or 0) - Decimal(plan.paid_baseline or 0))
    tolerance = int(plan_policy(db)["late_tolerance_days"])
    updated = []
    defaulted = False
    for item in plan.installments:
        amount = Decimal(str(item["amount"]))
        covered = min(amount, max(Decimal("0"), available))
        available -= covered
        remaining = money(amount - covered)
        due_date = date.fromisoformat(item["due_date"])
        if remaining <= 0:
            status = "paid"
        elif due_date < today:
            status = "late"
            defaulted = defaulted or (today - due_date).days > tolerance
        else:
            status = "pending"
        updated.append({**item, "status": status, "remaining": str(remaining)})
    plan.installments = updated
    if all(i["status"] == "paid" for i in updated) or _due(obj) <= 0:
        plan.status = "completed"
    elif defaulted and plan.status != "defaulted":
        plan.status = "defaulted"
        emit(
            db,
            "payment_plan.defaulted",
            {"id": plan.id, "number": plan.number, "target": obj.number},
            aggregate_type="payment_plan",
            aggregate_id=plan.id,
            project_id=plan.project_id,
        )
    return plan


PLAN_STAGES: list[tuple[str, int, str]] = [
    ("b3", -3, "échéance dans 3 jours"),
    ("a1", 1, "échéance dépassée"),
    ("a7", 7, "7 jours de retard"),
]


def send_plan_reminders(db: Session, today: date | None = None) -> dict[str, Any]:
    """Job quotidien : rappels par échéance (J-3, J+1, J+7) avec lien de paiement du montant de l'échéance."""
    today = today or date.today()
    sent = 0
    plans = db.execute(select(PaymentPlan).where(PaymentPlan.status.in_(["active", "defaulted"]))).scalars().all()
    for plan in plans:
        refresh_plan(db, plan, today)
        if plan.status == "completed":
            continue
        obj = _target(db, plan.target_type, plan.target_id)
        for item in plan.installments:
            if item["status"] == "paid":
                continue
            days = (today - date.fromisoformat(item["due_date"])).days
            current = [(code, label) for code, offset, label in PLAN_STAGES if days >= offset]
            if not current or (days >= 0 and current[-1][0] == "b3"):
                continue
            code, label = current[-1]
            stage = f"i{item['index']}-{code}"
            if db.execute(
                select(PaymentReminder.id).where(
                    PaymentReminder.target_type == "payment_plan",
                    PaymentReminder.target_id == plan.id,
                    PaymentReminder.stage == stage,
                )
            ).first():
                continue
            remaining = money(Decimal(str(item.get("remaining", item["amount"]))))
            db.add(PaymentReminder(target_type="payment_plan", target_id=plan.id, stage=stage, amount_due=remaining))
            _, url = create_pay_link(
                db,
                target_type=plan.target_type,
                target_id=plan.target_id,
                channel="reminder",
                plan=plan,
                installment_index=item["index"],
            )
            emit(
                db,
                "billing.installment_reminder",
                {
                    "id": plan.id,
                    "number": plan.number,
                    "target": obj.number,
                    "label": _label(obj),
                    "index": item["index"],
                    "count": len(plan.installments),
                    "amount": remaining,
                    "due_date": item["due_date"],
                    "stage_label": label,
                    "pay_link": url,
                    "link": "/espace-client/finances",
                },
                aggregate_type="payment_plan",
                aggregate_id=plan.id,
                project_id=plan.project_id,
            )
            sent += 1
    db.flush()
    return {"items": sent}


def plan_out(db: Session, plan: PaymentPlan) -> dict[str, Any]:
    obj = _target(db, plan.target_type, plan.target_id)
    return jsonable(
        {
            "id": plan.id,
            "number": plan.number,
            "target_type": plan.target_type,
            "target_id": plan.target_id,
            "target_number": obj.number,
            "target_label": _label(obj),
            "project_id": plan.project_id,
            "total_amount": plan.total_amount,
            "currency": obj.currency,
            "installments": plan.installments,
            "status": plan.status,
            "reason": plan.reason,
            "decision_note": plan.decision_note,
            "created_at": plan.created_at,
            "decided_at": plan.decided_at,
            "accepted_at": plan.accepted_at,
        }
    )


__all__ = [
    "Payer",
    "accept_plan",
    "create_pay_link",
    "has_active_plan",
    "pay_link_view",
    "pay_with_link",
    "plan_out",
    "plan_policy",
    "propose_plan",
    "refresh_plan",
    "reject_plan",
    "request_plan",
    "resolve_pay_link",
    "send_plan_reminders",
]
