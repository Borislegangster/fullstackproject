"""Financement intégré (innovation I5).

• Simulateur : mensualité (amortissement constant), coût total, taux d'endettement ; partenaires éligibles selon
  leurs critères (apport minimal, durée maximale, endettement maximal) avec fourchette de mensualités.
• Dossier : montant, apport, durée, revenus, charges, pièces (identité, revenus, relevés, titre foncier, devis /
  contrat joint par GLOBUS) ; transmission aux partenaires choisis seulement après consentement explicite (tracé).
• Partenaire : lien d'instruction nominatif (expire en 30 jours, révocable si le client retire son accord), pièces
  filigranées « transmis à <partenaire> », réponse en ligne (étude, offre, refus) sans compte à créer.
• Client : compare les offres et accepte la sienne par code à usage unique.
"""

from __future__ import annotations

import logging
import uuid
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.errors import BusinessRuleError, NotFound
from app.core.events import emit
from app.core.numbering import next_number
from app.core.security import random_token, sha256_hex
from app.core.utils import jsonable, money, utcnow
from app.modules.financing.models import FinancingApplication, FinancingPartner, FinancingShare

log = logging.getLogger("globus.financing")

DOCUMENT_KINDS = {
    "identite": "Pièce d'identité",
    "revenus": "Justificatifs de revenus",
    "releves": "Relevés bancaires (3 mois)",
    "titre_foncier": "Titre foncier / attestation",
    "devis": "Devis ou contrat GLOBUS",
    "autre": "Autre pièce",
}
SHARE_DAYS = 30
REFERENCE_RATE = Decimal("11")  # hypothèse par défaut du simulateur, modifiable (Setting « financing »)


def _settings(db: Session) -> dict[str, Any]:
    from app.modules.system.models import Setting

    row = db.get(Setting, "financing")
    return dict(row.value) if row and isinstance(row.value, dict) else {}


def portal_enabled(db: Session) -> bool:
    """Module « Financement » de l'espace client : désactivé par défaut, ouvert par l'administration."""
    return bool(_settings(db).get("client_portal", False))


def update_program(db: Session, values: dict[str, Any], *, actor_id: uuid.UUID | None) -> dict[str, Any]:
    from app.core import audit
    from app.modules.system.models import Setting

    before = {"client_portal": portal_enabled(db), "reference_rate": str(reference_rate(db))}
    row = db.get(Setting, "financing")
    if row is None:
        row = Setting(
            key="financing", category="finance", description="Financement intégré (simulateur, espace client)"
        )
        db.add(row)
    value = dict(row.value) if isinstance(row.value, dict) else {}
    if "client_portal" in values:
        value["client_portal"] = bool(values["client_portal"])
    if "reference_rate" in values:
        value["reference_rate"] = str(values["reference_rate"])
    row.value = value
    row.updated_by_id = actor_id
    db.flush()
    after = {"client_portal": portal_enabled(db), "reference_rate": str(reference_rate(db))}
    changed = {k: [before[k], after[k]] for k in before if before[k] != after[k]}
    if changed:
        audit.record(
            db,
            family="business",
            module="financing",
            action="UPDATE",
            resource_type="setting",
            resource_id="financing",
            actor_id=actor_id,
            diff=changed,
            criticality="HIGH" if "client_portal" in changed else "MEDIUM",
        )
    return after


def reference_rate(db: Session) -> Decimal:
    from app.modules.system.models import Setting

    row = db.get(Setting, "financing")
    value = (row.value or {}).get("reference_rate") if row and isinstance(row.value, dict) else None
    try:
        return Decimal(str(value)) if value is not None else REFERENCE_RATE
    except ArithmeticError:
        return REFERENCE_RATE


def payment(principal: Decimal, annual_rate_pct: Decimal, months: int) -> Decimal:
    """Mensualité d'un prêt à amortissement constant (taux nul : capital / durée)."""
    if months <= 0 or principal <= 0:
        return Decimal("0")
    r = Decimal(annual_rate_pct) / Decimal("1200")
    if r == 0:
        return money(principal / months)
    factor = (1 + r) ** months
    return (principal * r * factor / (factor - 1)).quantize(Decimal("1"), ROUND_HALF_UP)


def simulate(
    db: Session,
    *,
    amount: Decimal,
    down_payment: Decimal,
    duration_months: int,
    monthly_income: Decimal | None,
    other_monthly_debts: Decimal,
    rate: Decimal | None = None,
) -> dict[str, Any]:
    if amount <= 0:
        raise BusinessRuleError("Montant du projet requis")
    principal = max(Decimal("0"), amount - down_payment)
    down_pct = (down_payment / amount * 100) if amount else Decimal("0")
    hypothesis = rate if rate is not None else reference_rate(db)
    monthly = payment(principal, hypothesis, duration_months)
    reference = {
        "rate": hypothesis,
        "monthly": monthly,
        "total_interest": money(max(Decimal("0"), monthly * duration_months - principal)),
        "debt_ratio_pct": ((monthly + other_monthly_debts) / monthly_income * 100).quantize(Decimal("0.1"))
        if monthly_income and monthly_income > 0
        else None,
    }
    offers = []
    for partner in db.execute(
        select(FinancingPartner).where(FinancingPartner.active.is_(True)).order_by(FinancingPartner.sort_order)
    ).scalars():
        low = payment(principal, Decimal(partner.rate_min), duration_months)
        high = payment(principal, Decimal(partner.rate_max), duration_months)
        reasons = []
        if down_pct < Decimal(partner.min_down_payment_pct):
            reasons.append(f"apport minimal {partner.min_down_payment_pct:.0f} %")
        if duration_months > partner.max_years * 12:
            reasons.append(f"durée maximale {partner.max_years} ans")
        ratio = None
        if monthly_income and monthly_income > 0:
            ratio = ((high + other_monthly_debts) / monthly_income * 100).quantize(Decimal("0.1"))
            if ratio > Decimal(partner.max_debt_ratio_pct):
                reasons.append(f"endettement maximal {partner.max_debt_ratio_pct:.0f} % (estimé {ratio} %)")
        offers.append(
            {
                "partner_id": partner.id,
                "name": partner.name,
                "kind": partner.kind,
                "rate_min": partner.rate_min,
                "rate_max": partner.rate_max,
                "monthly_min": low,
                "monthly_max": high,
                "total_cost_max": money(
                    high * duration_months - principal + principal * Decimal(partner.fees_pct) / 100
                ),
                "debt_ratio_pct": ratio,
                "eligible": not reasons,
                "reasons": reasons,
                "requirements": partner.requirements,
            }
        )
    return jsonable(
        {
            "amount": amount,
            "down_payment": down_payment,
            "down_payment_pct": round(float(down_pct), 1),
            "principal": principal,
            "duration_months": duration_months,
            "reference": reference,
            "offers": offers,
            "disclaimer": "Simulation indicative : taux, éligibilité et conditions fixés par chaque établissement.",
        }
    )


# ---------------------------------------------------------------------------- dossier client
def create(db: Session, *, user: Any, project: Any | None, values: dict[str, Any]) -> FinancingApplication:
    values = dict(values)
    rate = values.pop("rate", None)
    application = FinancingApplication(
        number=next_number(db, "financing"),
        project_id=project.id if project else None,
        user_id=user.id,
        applicant_name=user.full_name,
        applicant_email=user.email,
        applicant_phone=user.phone,
        **values,
    )
    application.simulation = simulate(
        db,
        amount=Decimal(values["amount"]),
        down_payment=Decimal(values.get("down_payment") or 0),
        duration_months=int(values["duration_months"]),
        monthly_income=Decimal(values.get("monthly_income") or 0) or None,
        other_monthly_debts=Decimal(values.get("other_monthly_debts") or 0),
        rate=Decimal(rate) if rate is not None else None,
    )
    db.add(application)
    db.flush()
    if project is not None and project.contract_id:  # le contrat signé est joint d'office (pièce du dossier)
        from app.modules.crm.models import Contract

        contract = db.get(Contract, project.contract_id)
        evidence = (contract.signature_proof or {}).get("evidence_file_id") if contract else None
        if evidence:
            application.documents = [{"kind": "devis", "file_id": str(evidence), "name": f"Contrat {contract.number}"}]
    return application


def add_document(db: Session, application: FinancingApplication, *, kind: str, filename: str, data: bytes) -> None:
    from app.core.files import store_private, validate_upload

    if application.status not in ("draft", "submitted"):
        raise BusinessRuleError("Dossier clos")
    if kind not in DOCUMENT_KINDS:
        raise BusinessRuleError("Type de pièce inconnu")
    upload = validate_upload(filename, data, category="document", max_mb=20)
    stored = store_private(db, upload, purpose="financing", classification="confidential")
    application.documents = [
        *application.documents,
        {"kind": kind, "file_id": str(stored.id), "name": upload.filename, "uploaded_at": utcnow().isoformat()},
    ]


def submit(
    db: Session,
    application: FinancingApplication,
    *,
    partner_ids: list[uuid.UUID],
    consent: bool,
    ip: str | None,
    user_agent: str | None,
) -> list[tuple[FinancingShare, str]]:
    """Transmission aux partenaires choisis (consentement explicite) : un lien d'instruction nominatif chacun."""
    from app.modules.crm.service import record_consent
    from app.modules.notifications.service import queue_external

    if application.status not in ("draft", "submitted"):
        raise BusinessRuleError("Dossier clos")
    if not consent:
        raise BusinessRuleError(
            "Votre accord est nécessaire pour transmettre le dossier aux établissements choisis",
            code="CONSENT_REQUIRED",
        )
    partners = [db.get(FinancingPartner, pid) for pid in dict.fromkeys(partner_ids)]
    partners = [p for p in partners if p is not None and p.active]
    if not partners:
        raise BusinessRuleError("Choisissez au moins un établissement partenaire")
    if not any(d["kind"] == "identite" for d in application.documents):
        raise BusinessRuleError("Pièce d'identité requise avant transmission", code="DOCUMENTS_MISSING")
    consent_row = record_consent(
        db,
        subject_type="financing",
        subject_ref=str(application.id),
        purposes={"share_with_partners": True, "partners": [str(p.id) for p in partners]},
        source="espace_client:financement",
        ip=ip,
        user_agent=user_agent,
    )
    application.consent_at = utcnow()
    application.consent_record_id = consent_row.id
    created = []
    for partner in partners:
        existing = db.execute(
            select(FinancingShare).where(
                FinancingShare.application_id == application.id, FinancingShare.partner_id == partner.id
            )
        ).scalar_one_or_none()
        token = random_token(24)
        share = existing or FinancingShare(application_id=application.id, partner_id=partner.id)
        share.token_hash = sha256_hex(token)
        share.expires_at = utcnow() + timedelta(days=SHARE_DAYS)
        share.revoked_at = None
        if existing is None:
            db.add(share)
        db.flush()
        url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/financement/partenaire/{token}"
        if partner.contact_email:
            queue_external(
                db,
                channel="email",
                recipient=partner.contact_email,
                template_code="financing.partner_dossier",
                context={
                    "partner": partner.name,
                    "contact": partner.contact_name or "",
                    "number": application.number,
                    "amount": str(application.amount),
                    "link": url,
                    "title": f"Dossier de financement {application.number}",
                    "body": f"Un client GLOBUS vous transmet son dossier de financement ({application.number}).",
                },
            )
        created.append((share, url))
    application.partner_ids = sorted({*application.partner_ids, *[str(p.id) for p in partners]})
    application.status = "submitted"
    application.submitted_at = application.submitted_at or utcnow()
    emit(
        db,
        "financing.submitted",
        {
            "id": application.id,
            "number": application.number,
            "applicant": application.applicant_name,
            "amount": application.amount,
            "partners": ", ".join(p.name for p in partners),
            "link": "/erp/finances/financements",
        },
        aggregate_type="financing_application",
        aggregate_id=application.id,
        project_id=application.project_id,
    )
    audit.record(
        db,
        family="security",
        module="financing",
        action="SHARE",
        resource_type="financing_application",
        resource_id=application.id,
        project_id=application.project_id,
        diff={"partners": [p.name for p in partners]},
    )
    return created


def withdraw(db: Session, application: FinancingApplication) -> None:
    """Retrait de l'accord : tous les liens partenaires cessent immédiatement de fonctionner."""
    now = utcnow()
    for share in db.execute(select(FinancingShare).where(FinancingShare.application_id == application.id)).scalars():
        share.revoked_at = share.revoked_at or now
    application.status = "withdrawn"
    application.decided_at = now
    audit.record(
        db,
        family="security",
        module="financing",
        action="CONSENT_WITHDRAWN",
        resource_type="financing_application",
        resource_id=application.id,
        project_id=application.project_id,
    )


# ---------------------------------------------------------------------------- portail partenaire
def resolve_share(db: Session, token: str) -> FinancingShare:
    share = db.execute(
        select(FinancingShare).where(FinancingShare.token_hash == sha256_hex(token))
    ).scalar_one_or_none()
    if share is None or share.revoked_at is not None:
        raise NotFound("Lien d'instruction inconnu ou révoqué par le client")
    if share.expires_at < utcnow():
        raise NotFound("Lien d'instruction expiré : demandez une nouvelle transmission au client")
    return share


def share_view(db: Session, share: FinancingShare) -> dict[str, Any]:
    from app.core.downloads import signed_url
    from app.modules.projects.models import Project

    application = db.get(FinancingApplication, share.application_id)
    partner = db.get(FinancingPartner, share.partner_id)
    project = db.get(Project, application.project_id) if application.project_id else None
    if share.viewed_at is None:
        share.viewed_at = utcnow()
        if share.status == "sent":
            share.status = "viewed"
    mark = f"Transmis à {partner.name} le {utcnow():%d/%m/%Y} — instruction de crédit uniquement"
    return jsonable(
        {
            "partner": partner.name,
            "number": application.number,
            "status": share.status,
            "applicant": {
                "name": application.applicant_name,
                "email": application.applicant_email,
                "phone": application.applicant_phone,
            },
            "project": {"name": project.name, "city": project.city, "contract_amount": project.contract_amount}
            if project
            else None,
            "amount": application.amount,
            "down_payment": application.down_payment,
            "duration_months": application.duration_months,
            "monthly_income": application.monthly_income,
            "other_monthly_debts": application.other_monthly_debts,
            "documents": [
                {
                    "kind": DOCUMENT_KINDS.get(d["kind"], d["kind"]),
                    "name": d["name"],
                    "url": signed_url(uuid.UUID(d["file_id"]), user_id=None, ttl=3600, watermark_text=mark),
                }
                for d in application.documents
            ],
            "offer": share.offer or None,
            "expires_at": share.expires_at,
            "consent_at": application.consent_at,
        }
    )


def respond(db: Session, share: FinancingShare, *, status: str, offer: dict[str, Any] | None, responder: str) -> None:
    application = db.get(FinancingApplication, share.application_id)
    partner = db.get(FinancingPartner, share.partner_id)
    if application.status in ("accepted", "withdrawn"):
        raise BusinessRuleError("Dossier clos par le client")
    share.status = status
    share.responder_name = responder[:150]
    share.responded_at = utcnow()
    if status == "offer":
        if not offer:
            raise BusinessRuleError("Détail de l'offre requis")
        share.offer = jsonable({**offer, "partner": partner.name})
        application.status = "offer"
    emit(
        db,
        "financing.partner_response",
        {
            "id": application.id,
            "number": application.number,
            "partner": partner.name,
            "status": status,
            "user_id": application.user_id,
            "link": "/espace-client/financement",
        },
        aggregate_type="financing_application",
        aggregate_id=application.id,
        project_id=application.project_id,
    )


def accept(db: Session, application: FinancingApplication, share: FinancingShare, *, proof: dict[str, Any]) -> None:
    if share.application_id != application.id or share.status != "offer":
        raise BusinessRuleError("Offre introuvable ou non émise")
    application.status = "accepted"
    application.accepted_offer = jsonable({**share.offer, "accepted_at": utcnow().isoformat(), "otp": proof})
    application.decided_at = utcnow()
    emit(
        db,
        "financing.accepted",
        {
            "id": application.id,
            "number": application.number,
            "partner": share.offer.get("partner"),
            "link": "/erp/finances/financements",
        },
        aggregate_type="financing_application",
        aggregate_id=application.id,
        project_id=application.project_id,
    )


def application_out(db: Session, application: FinancingApplication, *, internal: bool = False) -> dict[str, Any]:
    shares = db.execute(select(FinancingShare).where(FinancingShare.application_id == application.id)).scalars().all()
    partners = {p.id: p.name for p in db.execute(select(FinancingPartner)).scalars()}
    return jsonable(
        {
            "id": application.id,
            "number": application.number,
            "project_id": application.project_id,
            "applicant_name": application.applicant_name,
            "amount": application.amount,
            "down_payment": application.down_payment,
            "duration_months": application.duration_months,
            "monthly_income": application.monthly_income,
            "other_monthly_debts": application.other_monthly_debts,
            "simulation": application.simulation,
            "documents": [
                {"kind": d["kind"], "label": DOCUMENT_KINDS.get(d["kind"]), "name": d["name"]}
                for d in application.documents
            ],
            "status": application.status,
            "consent_at": application.consent_at,
            "submitted_at": application.submitted_at,
            "accepted_offer": application.accepted_offer or None,
            "partners": [
                {
                    "share_id": s.id,
                    "partner": partners.get(s.partner_id),
                    "status": s.status,
                    "viewed_at": s.viewed_at,
                    "offer": s.offer or None,
                    "responded_at": s.responded_at,
                    "revoked": s.revoked_at is not None,
                }
                for s in shares
            ],
        }
    )


def partner_out(partner: FinancingPartner, *, internal: bool) -> dict[str, Any]:
    data = {
        "id": partner.id,
        "name": partner.name,
        "kind": partner.kind,
        "description": partner.description,
        "rate_min": partner.rate_min,
        "rate_max": partner.rate_max,
        "max_years": partner.max_years,
        "min_down_payment_pct": partner.min_down_payment_pct,
        "max_debt_ratio_pct": partner.max_debt_ratio_pct,
        "fees_pct": partner.fees_pct,
        "requirements": partner.requirements,
    }
    if internal:
        data.update(
            {
                "contact_name": partner.contact_name,
                "contact_email": partner.contact_email,
                "active": partner.active,
                "sort_order": partner.sort_order,
            }
        )
    return jsonable(data)


__all__ = [
    "DOCUMENT_KINDS",
    "accept",
    "add_document",
    "application_out",
    "create",
    "partner_out",
    "payment",
    "resolve_share",
    "respond",
    "share_view",
    "simulate",
    "submit",
    "withdraw",
]
