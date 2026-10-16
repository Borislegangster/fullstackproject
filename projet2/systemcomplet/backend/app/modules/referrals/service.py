"""Programme ambassadeurs (innovation I6).

Parcours : l'ambassadeur partage son lien `/parrainage/{code}` (ou son code) → le prospect dépose une demande (le
code suit la visite 90 jours) → le lead porte la recommandation → à la signature du contrat, la prime est calculée
selon la politique en vigueur (instantané conservé) → validation commerciale → paiement sortant standard (approbation
finance, contrôle interne A5, Mobile Money) → l'ambassadeur suit tout depuis son espace.

Anti-fraude : pas d'auto-parrainage (même e-mail / téléphone que l'ambassadeur), pas de prime sur un contact déjà
connu (client, prospect actif dans les 12 derniers mois), une seule recommandation par lead, ambassadeur suspendu =
aucun nouveau parrainage, validation humaine obligatoire avant tout paiement.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.errors import BusinessRuleError, Conflict, NotFound
from app.core.events import emit
from app.core.numbering import next_number
from app.core.utils import clean_phone, jsonable, money, utcnow
from app.modules.referrals.models import Ambassador, Referral

ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
DEFAULTS: dict[str, Any] = {
    # Fermé par défaut : la Direction l'ouvre depuis l'ERP (Commercial › Ambassadeurs) ; tant qu'il est fermé, le
    # menu « Parrainage » n'apparaît pas dans l'espace client et aucune adhésion / attribution n'est possible.
    "enabled": False,
    "reward_type": "percent",  # percent / fixed
    "reward_pct": 1.0,  # % du montant du contrat signé
    "reward_fixed": 100000,
    "reward_cap": 500000,
    "min_contract_amount": 1000000,
    "attribution_days": 90,  # durée de suivi du lien côté navigateur
    "signature_window_days": 365,  # le contrat doit être signé dans l'année qui suit la recommandation
    "referee_benefit": "Étude de faisabilité offerte pour toute demande recommandée",
}


def policy(db: Session) -> dict[str, Any]:
    from app.modules.system.models import Setting

    row = db.get(Setting, "referrals")
    return {**DEFAULTS, **(row.value if row and isinstance(row.value, dict) else {})}


def update_policy(db: Session, values: dict[str, Any], *, actor_id: uuid.UUID | None) -> dict[str, Any]:
    """Ouverture / fermeture du programme et règles de prime (paramètre « referrals », audité)."""
    from app.modules.system.models import Setting

    before = policy(db)
    after = {**before, **values}
    if after["reward_type"] not in ("percent", "fixed"):
        raise BusinessRuleError("Type de prime inconnu", code="INVALID_RULE")
    row = db.get(Setting, "referrals")
    if row is None:
        row = Setting(key="referrals", category="commercial", description="Programme ambassadeurs (parrainage)")
        db.add(row)
    row.value = {k: after[k] for k in DEFAULTS}
    row.updated_by_id = actor_id
    changed = {k: [before[k], after[k]] for k in DEFAULTS if before[k] != after[k]}
    if changed:
        audit.record(
            db,
            family="business",
            module="referrals",
            action="UPDATE",
            resource_type="setting",
            resource_id="referrals",
            actor_id=actor_id,
            diff=changed,
            criticality="HIGH" if "enabled" in changed else "MEDIUM",
        )
    db.flush()
    return policy(db)


def _new_code(db: Session) -> str:
    while True:
        code = "G" + "".join(secrets.choice(ALPHABET) for _ in range(6))
        if db.execute(select(Ambassador.id).where(Ambassador.code == code)).first() is None:
            return code


def share_url(ambassador: Ambassador) -> str:
    return f"{settings.PUBLIC_BASE_URL.rstrip('/')}/parrainage/{ambassador.code}"


def _momo_audit(db: Session, ambassador: Ambassador, before: str | None, actor_id: uuid.UUID | None) -> None:
    """Toute saisie / modification du numéro de paiement est tracée : le contrôle interne (A5) bloque un paiement
    vers des coordonnées modifiées depuis moins de 30 jours."""
    audit.record(
        db,
        family="security",
        module="referrals",
        action="UPDATE",
        resource_type="ambassador",
        resource_id=ambassador.id,
        actor_id=actor_id,
        diff={"mobile_money_number": "***modifié" if before else "***ajouté"},
        criticality="HIGH",
    )


def enroll(
    db: Session,
    *,
    kind: str,
    full_name: str,
    email: str | None,
    phone: str | None,
    user: Any = None,
    momo_number: str | None = None,
    momo_operator: str | None = None,
    actor_id: uuid.UUID | None = None,
) -> Ambassador:
    if not policy(db)["enabled"]:
        raise BusinessRuleError("Programme ambassadeurs fermé", code="REFERRALS_DISABLED")
    if user is not None:
        existing = db.execute(select(Ambassador).where(Ambassador.user_id == user.id)).scalar_one_or_none()
        if existing is not None:
            return existing
    ambassador = Ambassador(
        code=_new_code(db),
        kind=kind,
        user_id=user.id if user is not None else None,
        full_name=full_name.strip()[:200],
        email=(email or "").strip().lower() or None,
        phone=clean_phone(phone),
        momo_operator=momo_operator,
        terms_accepted_at=utcnow() if user is not None else None,
        created_by_id=actor_id,
    )
    db.add(ambassador)
    db.flush()
    if momo_number:
        ambassador.momo_number = clean_phone(momo_number)
        _momo_audit(db, ambassador, None, actor_id)
    audit.record(
        db,
        family="business",
        module="referrals",
        action="CREATE",
        resource_type="ambassador",
        resource_id=ambassador.id,
        actor_id=actor_id,
        diff={"kind": kind, "code": ambassador.code},
    )
    return ambassador


def update_payout(
    db: Session, ambassador: Ambassador, *, momo_number: str, momo_operator: str | None, actor_id: uuid.UUID | None
) -> None:
    number = clean_phone(momo_number)
    if not number:
        raise BusinessRuleError("Numéro Mobile Money invalide", code="INVALID_PHONE")
    before = ambassador.momo_number
    if number == before and momo_operator == ambassador.momo_operator:
        return
    ambassador.momo_number = number
    ambassador.momo_operator = momo_operator
    _momo_audit(db, ambassador, before, actor_id)


def by_code(db: Session, code: str) -> Ambassador | None:
    code = (code or "").strip().upper()
    if not code or len(code) > 20:
        return None
    return db.execute(
        select(Ambassador).where(Ambassador.code == code, Ambassador.status == "active")
    ).scalar_one_or_none()


def landing(db: Session, code: str) -> dict[str, Any]:
    """Données publiques minimales : prénom + initiale de l'ambassadeur, avantage filleul."""
    ambassador = by_code(db, code)
    if ambassador is None or not policy(db)["enabled"]:
        raise NotFound("Code de parrainage inconnu ou expiré")
    first, _, last = ambassador.full_name.partition(" ")
    return {
        "code": ambassador.code,
        "ambassador": f"{first} {last[:1]}." if last else first,
        "benefit": policy(db)["referee_benefit"],
        "attribution_days": policy(db)["attribution_days"],
    }


def _same_person(ambassador: Ambassador, user_email: str | None, lead: Any) -> bool:
    emails = {e for e in (ambassador.email, user_email) if e}
    phones = {p for p in (ambassador.phone, clean_phone(ambassador.momo_number)) if p}
    return bool((lead.email and lead.email in emails) or (lead.phone and lead.phone in phones))


def _already_known(db: Session, lead: Any) -> str | None:
    from app.modules.crm.models import Contact, Lead
    from app.modules.identity.models import User

    keys_lead = []
    keys_contact = []
    if lead.email:
        keys_lead.append(Lead.email == lead.email)
        keys_contact.append(Contact.email == lead.email)
        if db.execute(select(User.id).where(func.lower(User.email) == lead.email)).first() is not None:
            return "Le filleul a déjà un compte GLOBUS"
    if lead.phone:
        keys_lead.append(Lead.phone == lead.phone)
        keys_contact.append(Contact.phone == lead.phone)
    if not keys_lead:
        return None
    if db.execute(select(Contact.id).where(or_(*keys_contact))).first() is not None:
        return "Contact déjà connu de GLOBUS (client ou prospect)"
    earlier = db.execute(
        select(Lead.id).where(or_(*keys_lead), Lead.id != lead.id, Lead.created_at >= utcnow() - timedelta(days=365))
    ).first()
    if earlier is not None:
        return "Demande déjà reçue de ce contact dans les 12 derniers mois"
    return None


def capture(db: Session, lead: Any, code: str, *, via: str = "link") -> Referral | None:
    """Rattache un lead à un ambassadeur (appelé à la création du lead). Code inconnu : ignoré silencieusement."""
    from app.modules.identity.models import User

    if not policy(db)["enabled"]:
        return None
    ambassador = by_code(db, code)
    if ambassador is None:
        return None
    if db.execute(select(Referral.id).where(Referral.lead_id == lead.id)).first() is not None:
        return None
    user = db.get(User, ambassador.user_id) if ambassador.user_id else None
    referral = Referral(
        number=next_number(db, "referral"),
        ambassador_id=ambassador.id,
        lead_id=lead.id,
        referee_name=" ".join(x for x in (lead.first_name, lead.last_name) if x)[:200] or "Prospect",
        captured_via=via,
    )
    if _same_person(ambassador, user.email.lower() if user else None, lead):
        referral.status, referral.rejection_reason = "rejected", "Auto-parrainage"
    else:
        reason = _already_known(db, lead)
        if reason:
            referral.status, referral.rejection_reason = "rejected", reason
    db.add(referral)
    db.flush()
    lead.tags = sorted({*(lead.tags or []), "parrainage"})
    emit(
        db,
        "referral.captured",
        {
            "id": referral.id,
            "number": referral.number,
            "ambassador_user_id": ambassador.user_id,
            "ambassador_name": ambassador.full_name,
            "referee": _public_name(referral.referee_name),
            "status": referral.status,
            "lead_number": lead.number,
        },
        aggregate_type="referral",
        aggregate_id=referral.id,
    )
    return referral


def _public_name(name: str) -> str:
    first, _, last = (name or "").partition(" ")
    return f"{first} {last[:1]}." if last else first


def _reward(db: Session, contract_amount: Decimal) -> tuple[Decimal, dict[str, Any]]:
    rules = policy(db)
    basis = {k: rules[k] for k in ("reward_type", "reward_pct", "reward_fixed", "reward_cap", "min_contract_amount")}
    if contract_amount < Decimal(str(rules["min_contract_amount"])):
        return Decimal("0"), basis
    if rules["reward_type"] == "fixed":
        amount = Decimal(str(rules["reward_fixed"]))
    else:
        amount = (contract_amount * Decimal(str(rules["reward_pct"])) / 100).quantize(Decimal("1"), ROUND_HALF_UP)
    cap = Decimal(str(rules["reward_cap"] or 0))
    if cap > 0:
        amount = min(amount, cap)
    return money(amount), basis


def _referral_for_contract(db: Session, contract: Any) -> Referral | None:
    from app.modules.crm.models import Opportunity, Quote

    opportunity_id = contract.opportunity_id
    if opportunity_id is None and contract.quote_id:
        quote = db.get(Quote, contract.quote_id)
        opportunity_id = quote.opportunity_id if quote else None
    if opportunity_id is None:
        return None
    opportunity = db.get(Opportunity, opportunity_id)
    if opportunity is None or opportunity.lead_id is None:
        return None
    return db.execute(select(Referral).where(Referral.lead_id == opportunity.lead_id)).scalar_one_or_none()


def on_contract_signed(db: Session, contract: Any) -> Referral | None:
    referral = _referral_for_contract(db, contract)
    if referral is None or referral.status != "captured":
        return None
    ambassador = db.get(Ambassador, referral.ambassador_id)
    rules = policy(db)
    referral.contract_id = contract.id
    referral.project_id = contract.project_id
    referral.contract_amount = money(contract.amount)
    referral.signed_at = contract.signed_at or utcnow()
    if referral.created_at and referral.signed_at - referral.created_at > timedelta(
        days=int(rules["signature_window_days"])
    ):
        referral.status, referral.rejection_reason = "rejected", "Contrat signé hors délai de recommandation"
        return referral
    if ambassador is None or ambassador.status != "active":
        referral.status, referral.rejection_reason = "rejected", "Ambassadeur suspendu"
        return referral
    amount, basis = _reward(db, Decimal(contract.amount))
    referral.reward_basis = basis
    if amount <= 0:
        referral.status, referral.rejection_reason = "rejected", "Montant minimum du contrat non atteint"
        return referral
    referral.amount = amount
    referral.status = "signed"
    emit(
        db,
        "referral.reward_pending",
        {
            "id": referral.id,
            "number": referral.number,
            "ambassador_user_id": ambassador.user_id,
            "ambassador_name": ambassador.full_name,
            "referee": _public_name(referral.referee_name),
            "amount": referral.amount,
            "contract_number": contract.number,
        },
        aggregate_type="referral",
        aggregate_id=referral.id,
    )
    return referral


def approve(db: Session, referral: Referral, *, principal: Any) -> Referral:
    if referral.status != "signed":
        raise BusinessRuleError("Prime non validable (statut)", code="REFERRAL_STATUS")
    ambassador = db.get(Ambassador, referral.ambassador_id)
    if ambassador and ambassador.user_id == principal.id:
        raise BusinessRuleError("Séparation des tâches : un ambassadeur ne valide pas sa propre prime")
    referral.status = "approved"
    referral.approved_by_id = principal.id
    referral.approved_at = utcnow()
    audit.record(
        db,
        family="business",
        module="referrals",
        action="APPROVE",
        resource_type="referral",
        resource_id=referral.id,
        project_id=referral.project_id,
        diff={"amount": str(referral.amount)},
        criticality="HIGH",
    )
    emit(
        db,
        "referral.approved",
        {
            "id": referral.id,
            "number": referral.number,
            "ambassador_user_id": ambassador.user_id if ambassador else None,
            "amount": referral.amount,
            "referee": _public_name(referral.referee_name),
        },
        aggregate_type="referral",
        aggregate_id=referral.id,
    )
    return referral


def reject(db: Session, referral: Referral, *, reason: str, user_id: uuid.UUID) -> Referral:
    if referral.status in ("paid", "rejected") or Decimal(referral.amount_paid or 0) > 0:
        raise BusinessRuleError("Recommandation déjà soldée", code="REFERRAL_STATUS")
    referral.status = "rejected"
    referral.rejection_reason = reason
    audit.record(
        db,
        family="business",
        module="referrals",
        action="REJECT",
        resource_type="referral",
        resource_id=referral.id,
        actor_id=user_id,
        reason=reason,
    )
    return referral


def mark_paid(db: Session, referral: Referral) -> None:
    """Appelé par l'allocation du paiement sortant (finance) quand la prime est intégralement réglée."""
    referral.status = "paid"
    referral.paid_at = utcnow()
    ambassador = db.get(Ambassador, referral.ambassador_id)
    emit(
        db,
        "referral.paid",
        {
            "id": referral.id,
            "number": referral.number,
            "ambassador_user_id": ambassador.user_id if ambassador else None,
            "amount": referral.amount,
        },
        aggregate_type="referral",
        aggregate_id=referral.id,
    )


def ambassador_out(db: Session, ambassador: Ambassador, *, internal: bool) -> dict[str, Any]:
    rows = db.execute(
        select(Referral.status, func.count(), func.coalesce(func.sum(Referral.amount), 0))
        .where(Referral.ambassador_id == ambassador.id)
        .group_by(Referral.status)
    ).all()
    by_status = {s: {"count": c, "amount": a} for s, c, a in rows}
    out: dict[str, Any] = {
        "id": ambassador.id,
        "code": ambassador.code,
        "kind": ambassador.kind,
        "full_name": ambassador.full_name,
        "status": ambassador.status,
        "share_url": share_url(ambassador),
        "has_payout": bool(ambassador.momo_number),
        "momo_operator": ambassador.momo_operator,
        "momo_hint": f"•••• {ambassador.momo_number[-3:]}" if ambassador.momo_number else None,
        "stats": {
            "referrals": sum(v["count"] for v in by_status.values()),
            "signed": sum(by_status.get(s, {}).get("count", 0) for s in ("signed", "approved", "paid")),
            "earned": sum((Decimal(by_status.get(s, {}).get("amount", 0)) for s in ("approved", "paid")), Decimal("0")),
            "pending": Decimal(by_status.get("signed", {}).get("amount", 0)),
            "paid": Decimal(by_status.get("paid", {}).get("amount", 0)),
        },
        "created_at": ambassador.created_at,
    }
    if internal:
        out.update({"email": ambassador.email, "phone": ambassador.phone, "user_id": ambassador.user_id})
    return jsonable(out)


def referral_out(referral: Referral, *, internal: bool, ambassador: Ambassador | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": referral.id,
        "number": referral.number,
        "referee": referral.referee_name if internal else _public_name(referral.referee_name),
        "status": referral.status,
        "amount": referral.amount,
        "amount_paid": referral.amount_paid,
        "rejection_reason": referral.rejection_reason,
        "created_at": referral.created_at,
        "signed_at": referral.signed_at,
        "paid_at": referral.paid_at,
    }
    if internal:
        out.update(
            {
                "lead_id": referral.lead_id,
                "contract_id": referral.contract_id,
                "project_id": referral.project_id,
                "contract_amount": referral.contract_amount,
                "reward_basis": referral.reward_basis,
                "captured_via": referral.captured_via,
                "approved_at": referral.approved_at,
                "ambassador": {"id": ambassador.id, "name": ambassador.full_name, "code": ambassador.code}
                if ambassador
                else None,
            }
        )
    return jsonable(out)


def get_referral(db: Session, referral_id: uuid.UUID) -> Referral:
    referral = db.get(Referral, referral_id)
    if referral is None:
        raise NotFound("Recommandation introuvable")
    return referral


def ensure_unique_user(db: Session, user_id: uuid.UUID) -> None:
    if db.execute(select(Ambassador.id).where(Ambassador.user_id == user_id)).first() is not None:
        raise Conflict("Cet utilisateur est déjà ambassadeur", code="AMBASSADOR_EXISTS")


__all__ = [
    "approve",
    "by_code",
    "capture",
    "enroll",
    "landing",
    "mark_paid",
    "on_contract_signed",
    "policy",
    "reject",
    "update_payout",
]
