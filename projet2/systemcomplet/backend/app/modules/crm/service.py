"""CRM prospect (§4.4) : formulaires → consentements → lead → score (règles + IA éventuelle) → auto-réponse
e-mail/WhatsApp → affectation (service, zone, urgence, disponibilité) → SLA et escalade → devis → contrat →
projet (chaîne de conversion §18, V4-CRM-38)."""

from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.errors import AppError, BusinessRuleError, Conflict, NotFound
from app.core.events import emit
from app.core.numbering import next_number
from app.core.security import random_token, sha256_hex
from app.core.utils import clean_phone, money, utcnow
from app.modules.crm.models import (
    AssignmentRule,
    Contact,
    Contract,
    CrmActivity,
    Lead,
    Opportunity,
    ProjectBrief,
    Quote,
    QuoteLine,
    SlaPolicy,
)
from app.modules.identity.models import Organization, Role, User, UserRole
from app.modules.system.models import ConsentRecord

log = logging.getLogger("globus.crm")

TIMELINE_POINTS = {"immediate": 15, "3_months": 15, "6_months": 10, "12_months": 5, "undetermined": 0}
SOURCE_POINTS = {
    "describe_project": 10,
    "referral": 10,
    "estimator": 8,
    "instant_estimate": 10,
    "ads": 5,
    "whatsapp": 5,
    "callback": 8,
    "panneau_chantier": 6,
    "energy_simulator": 7,
    "financing": 8,
}


# ---------------------------------------------------------------------------- consentements
def record_consent(
    db: Session,
    *,
    subject_type: str,
    subject_ref: str,
    purposes: dict[str, bool],
    source: str,
    ip: str | None,
    user_agent: str | None,
    policy_version: str = "1",
    text: str | None = None,
) -> ConsentRecord:
    record = ConsentRecord(
        subject_type=subject_type,
        subject_ref=subject_ref[:200],
        purposes=purposes,
        source=source,
        policy_version=policy_version,
        text_hash=hashlib.sha256((text or "").encode()).hexdigest() if text else None,
        ip_hash=hashlib.sha256(("c:" + (ip or "")).encode()).hexdigest() if ip else None,
        user_agent=(user_agent or "")[:400] or None,
    )
    db.add(record)
    db.flush()
    return record


# ---------------------------------------------------------------------------- scoring
def rule_score(lead: Lead, brief: ProjectBrief | None = None) -> tuple[int, dict[str, int]]:
    details: dict[str, int] = {}
    if lead.email:
        details["email"] = 10
    if lead.phone or lead.whatsapp:
        details["telephone"] = 10
    if lead.message and len(lead.message) > 50:
        details["message_detaille"] = 5
    if lead.project_location or lead.city:
        details["localisation"] = 5
    budget = lead.budget_max or lead.budget_min
    if budget:
        xaf = Decimal(budget) * (Decimal(str(settings.EUR_XAF_RATE)) if lead.budget_currency == "EUR" else 1)
        details["budget"] = 20 if xaf >= 100_000_000 else 15 if xaf >= 30_000_000 else 10 if xaf >= 10_000_000 else 5
    if TIMELINE_POINTS.get(lead.timeline):
        details["delai"] = TIMELINE_POINTS[lead.timeline]
    if lead.has_land:
        details["terrain"] = 10
        if lead.land_status == "titre_foncier":
            details["titre_foncier"] = 10
    if lead.universe in ("PREMIUM", "BUSINESS", "DIASPORA"):
        details["univers"] = 5
    if lead.source in SOURCE_POINTS:
        details["source"] = SOURCE_POINTS[lead.source]
    if brief and brief.completeness:
        details["brief_complet"] = min(10, brief.completeness // 10)
    return min(100, sum(details.values())), details


def temperature_for(score: int) -> str:
    return "hot" if score >= 70 else "warm" if score >= 40 else "cold"


# ---------------------------------------------------------------------------- affectation & SLA
def _rule_matches(rule: AssignmentRule, lead: Lead) -> bool:
    c = rule.criteria or {}
    checks = [
        (not c.get("universes")) or lead.universe in c["universes"],
        (not c.get("countries")) or (lead.country or "") in c["countries"],
        (not c.get("cities")) or (lead.city or "") in c["cities"],
        c.get("diaspora") is None or bool(c["diaspora"]) == lead.is_diaspora,
        (not c.get("sources")) or lead.source in c["sources"],
        (not c.get("urgent")) or lead.urgency == "urgent",
        (not c.get("min_score")) or lead.score >= int(c["min_score"]),
    ]
    return all(checks)


def _active_users(db: Session, ids: list[Any]) -> list[User]:
    uuids = [uuid.UUID(str(i)) for i in ids]
    return list(db.execute(select(User).where(User.id.in_(uuids), User.is_active.is_(True))).scalars())


def _open_load(db: Session, user_id: uuid.UUID) -> int:
    return db.execute(
        select(func.count())
        .select_from(Lead)
        .where(Lead.assigned_to_id == user_id, Lead.status.in_(["new", "contacted", "qualified", "nurturing"]))
    ).scalar_one()


def assign_lead(db: Session, lead: Lead) -> User | None:
    candidates: list[User] = []
    rules = (
        db.execute(select(AssignmentRule).where(AssignmentRule.is_active.is_(True)).order_by(AssignmentRule.priority))
        .scalars()
        .all()
    )
    for rule in rules:
        if _rule_matches(rule, lead):
            users = _active_users(db, rule.assignee_ids or [])
            if not users:
                continue
            if rule.strategy == "least_loaded":
                candidates = sorted(users, key=lambda u: _open_load(db, u.id))
            else:
                index = rule.cursor % len(users)
                rule.cursor = (rule.cursor + 1) % max(1, len(users))
                candidates = users[index:] + users[:index]
            break
    if not candidates:
        commerciaux = (
            db.execute(
                select(User)
                .join(UserRole, UserRole.user_id == User.id)
                .join(Role, Role.id == UserRole.role_id)
                .where(Role.code == "COMMERCIAL", User.is_active.is_(True))
            )
            .scalars()
            .all()
        )
        candidates = sorted(commerciaux, key=lambda u: _open_load(db, u.id))
    if not candidates:
        return None
    user = candidates[0]
    lead.assigned_to_id = user.id
    lead.assigned_at = utcnow()
    return user


def apply_sla(db: Session, lead: Lead) -> None:
    priority = "urgent" if lead.urgency == "urgent" or lead.temperature == "hot" else "normal"
    policy = (
        db.execute(
            select(SlaPolicy).where(
                SlaPolicy.entity == "lead", SlaPolicy.priority == priority, SlaPolicy.is_active.is_(True)
            )
        )
        .scalars()
        .first()
    )
    if policy is None:
        policy = (
            db.execute(select(SlaPolicy).where(SlaPolicy.entity == "lead", SlaPolicy.is_active.is_(True)))
            .scalars()
            .first()
        )
    if policy:
        lead.sla_policy_id = policy.id
        lead.response_due_at = utcnow() + timedelta(minutes=policy.response_minutes)


def monitor_sla(db: Session) -> dict[str, Any]:
    """Job : escalade des leads non pris en charge dans le délai (§4.4 étape 18)."""
    now = utcnow()
    breached = 0
    leads = (
        db.execute(
            select(Lead).where(
                Lead.first_response_at.is_(None),
                Lead.response_due_at.is_not(None),
                Lead.response_due_at < now,
                Lead.status == "new",
                Lead.deleted_at.is_(None),
            )
        )
        .scalars()
        .all()
    )
    for lead in leads:
        policy = db.get(SlaPolicy, lead.sla_policy_id) if lead.sla_policy_id else None
        steps = (policy.escalation if policy else []) or [{"after_minutes": 0, "notify_roles": ["DIRECTION"]}]
        if lead.escalation_level >= len(steps):
            continue
        step = steps[lead.escalation_level]
        overdue_minutes = (now - lead.response_due_at).total_seconds() / 60
        if overdue_minutes < 0 or (lead.escalation_level > 0 and overdue_minutes < int(step.get("after_minutes", 0))):
            continue
        lead.escalation_level += 1
        lead.escalated_at = now
        if step.get("reassign") and lead.assigned_to_id:
            previous = lead.assigned_to_id
            lead.assigned_to_id = None
            if assign_lead(db, lead) is None:
                lead.assigned_to_id = previous
        emit(
            db,
            "lead.sla_breached",
            {
                "id": lead.id,
                "number": lead.number,
                "name": _lead_name(lead),
                "assigned_to_id": lead.assigned_to_id,
                "level": lead.escalation_level,
            },
            aggregate_type="lead",
            aggregate_id=lead.id,
        )
        audit.record(
            db,
            family="business",
            module="crm",
            action="SLA_ESCALATE",
            resource_type="lead",
            resource_id=lead.id,
            actor_type="system",
            diff={"level": lead.escalation_level},
            criticality="MEDIUM",
        )
        breached += 1
    db.flush()
    return {"items": breached}


def _lead_name(lead: Lead) -> str:
    return f"{lead.first_name} {lead.last_name or ''}".strip()


# ---------------------------------------------------------------------------- création de lead
def create_lead(
    db: Session,
    *,
    data: dict[str, Any],
    source: str,
    form_key: str | None,
    consents: dict[str, bool],
    ip: str | None,
    user_agent: str | None,
    utm: dict[str, str] | None = None,
    landing_page: str | None = None,
    referrer: str | None = None,
    analytics_session_id: str | None = None,
    brief_answers: dict[str, Any] | None = None,
    created_by: uuid.UUID | None = None,
) -> Lead:
    email = (data.get("email") or "").strip().lower() or None
    phone = clean_phone(data.get("phone"))
    if not email and not phone:
        raise BusinessRuleError("Un e-mail ou un téléphone est requis pour être recontacté", code="CONTACT_REQUIRED")
    if not consents.get("contact"):
        raise BusinessRuleError("Le consentement au traitement de la demande est obligatoire", code="CONSENT_REQUIRED")
    lead = Lead(
        number=next_number(db, "lead"),
        source=source,
        form_key=form_key,
        utm_source=(utm or {}).get("source"),
        utm_medium=(utm or {}).get("medium"),
        utm_campaign=(utm or {}).get("campaign"),
        utm_content=(utm or {}).get("content"),
        utm_term=(utm or {}).get("term"),
        landing_page=landing_page,
        referrer=referrer,
        analytics_session_id=analytics_session_id,
        universe=data.get("universe"),
        offer_slug=data.get("offer_slug"),
        service_slug=data.get("service_slug"),
        project_type=data.get("project_type"),
        first_name=(data.get("first_name") or "").strip()[:120] or "Prospect",
        last_name=(data.get("last_name") or "").strip()[:120] or None,
        company=data.get("company"),
        email=email,
        phone=phone,
        whatsapp=clean_phone(data.get("whatsapp")) or (phone if consents.get("whatsapp") else None),
        country=data.get("country"),
        city=data.get("city"),
        is_diaspora=bool(data.get("is_diaspora"))
        or (bool(data.get("country")) and str(data.get("country")).lower() not in ("cameroun", "cameroon", "cm")),
        preferred_channel=data.get("preferred_channel") or ("whatsapp" if consents.get("whatsapp") else "email"),
        message=(data.get("message") or data.get("subject") or None),
        budget_min=_dec(data.get("budget_min")),
        budget_max=_dec(data.get("budget_max")),
        budget_currency=(data.get("budget_currency") or "XAF")[:3],
        timeline=data.get("timeline"),
        has_land=data.get("has_land"),
        land_status=data.get("land_status"),
        project_location=data.get("project_location"),
        urgency=data.get("urgency") or "normal",
        marketing_consent=bool(consents.get("marketing")),
        whatsapp_consent=bool(consents.get("whatsapp")),
        status="new",
    )
    if email:
        previous = (
            db.execute(
                select(Lead)
                .where(Lead.email == email, Lead.status.in_(["new", "contacted", "qualified", "nurturing"]))
                .order_by(Lead.created_at.desc())
            )
            .scalars()
            .first()
        )
        if previous is not None:
            lead.tags = ["relance_prospect_existant"]
    if data.get("tags"):
        lead.tags = list(dict.fromkeys([*(lead.tags or []), *(str(t).strip() for t in data["tags"] if str(t).strip())]))
    db.add(lead)
    db.flush()
    consent = record_consent(
        db,
        subject_type="lead",
        subject_ref=email or phone or str(lead.id),
        purposes={k: bool(v) for k, v in consents.items()},
        source=f"form:{form_key or source}",
        ip=ip,
        user_agent=user_agent,
    )
    lead.consent_record_id = consent.id
    brief = None
    if brief_answers is not None:
        brief = ProjectBrief(
            lead_id=lead.id,
            universe=lead.universe,
            project_type=lead.project_type,
            answers=brief_answers,
            surface_m2=_dec(brief_answers.get("surface_m2")),
            levels=_int(brief_answers.get("levels")),
            style=brief_answers.get("style"),
            completeness=_brief_completeness(brief_answers),
            submitted_at=utcnow(),
        )
        estimate = estimate_budget(db, lead.universe, brief_answers)
        if estimate:
            brief.estimate_min, brief.estimate_max = estimate["min"], estimate["max"]
        db.add(brief)
        db.flush()
    lead.score, lead.score_details = rule_score(lead, brief)
    lead.temperature = temperature_for(lead.score)
    if lead.temperature == "hot":
        lead.urgency = "urgent"
    if data.get("assigned_to_id"):  # saisie manuelle : commercial choisi (droit vérifié par l'appelant)
        lead.assigned_to_id = data["assigned_to_id"]
        lead.assigned_at = utcnow()
    else:
        assign_lead(db, lead)
    apply_sla(db, lead)
    db.flush()
    if data.get("referral_code"):
        from app.modules.referrals.service import capture

        capture(db, lead, str(data["referral_code"]))
    _auto_reply(db, lead, form_key)
    emit(
        db,
        "lead.created",
        {
            "id": lead.id,
            "number": lead.number,
            "name": _lead_name(lead),
            "universe": lead.universe,
            "source": lead.source,
            "score": lead.score,
            "temperature": lead.temperature,
        },
        aggregate_type="lead",
        aggregate_id=lead.id,
    )
    if lead.assigned_to_id:
        emit(
            db,
            "lead.assigned",
            {
                "id": lead.id,
                "number": lead.number,
                "name": _lead_name(lead),
                "assigned_to_id": lead.assigned_to_id,
                "response_due_at": lead.response_due_at,
            },
            aggregate_type="lead",
            aggregate_id=lead.id,
        )
    audit.record(
        db,
        family="business",
        module="crm",
        action="CREATE",
        resource_type="lead",
        resource_id=lead.id,
        actor_id=created_by,
        actor_type="user" if created_by else "visitor",
        diff={"source": source, "universe": lead.universe, "score": lead.score},
    )
    if lead.marketing_consent and email:
        from app.modules.newsletter.service import subscribe

        try:
            subscribe(
                db,
                email=email,
                first_name=lead.first_name,
                source=f"lead:{source}",
                interests=[lead.universe] if lead.universe else [],
                consent_record_id=consent.id,
                ip=ip,
                user_agent=user_agent,
                lead_id=lead.id,
                send_confirmation=True,
            )
        except Exception:  # noqa: BLE001
            log.warning("newsletter_subscribe_failed")
    return lead


def _dec(value: Any) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value).replace(" ", "").replace(",", "."))
    except Exception:  # noqa: BLE001
        return None


def _int(value: Any) -> int | None:
    try:
        return int(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


_BRIEF_KEYS = (
    "universe",
    "project_type",
    "project_location",
    "has_land",
    "land_status",
    "surface_m2",
    "levels",
    "rooms",
    "style",
    "budget_max",
    "timeline",
    "financing",
    "priorities",
    "description",
)


def _brief_completeness(answers: dict[str, Any]) -> int:
    filled = sum(1 for k in _BRIEF_KEYS if answers.get(k) not in (None, "", []))
    return int(filled * 100 / len(_BRIEF_KEYS))


def estimate_budget(db: Session, universe: str | None, answers: dict[str, Any]) -> dict[str, Any] | None:
    """Estimation indicative uniquement si les ratios sont paramétrés par GLOBUS (aucun chiffre en dur)."""
    from app.modules.system.models import Setting

    setting = db.get(Setting, "estimator")
    surface = _dec(answers.get("surface_m2"))
    if setting is None or not surface or surface <= 0:
        return None
    rates = (setting.value or {}).get("rates", {})
    standing = answers.get("standing") or "standard"
    rate = (rates.get(universe or "HOME") or rates.get("HOME") or {}).get(standing)
    if not rate:
        return None
    margin = Decimal(str((setting.value or {}).get("margin_pct", 15))) / 100
    base = surface * Decimal(str(rate)) * Decimal(str(1 + 0.08 * max(0, (_int(answers.get("levels")) or 1) - 1)))
    return {
        "min": money(base * (1 - margin)),
        "max": money(base * (1 + margin)),
        "currency": (setting.value or {}).get("currency", "XAF"),
        "disclaimer": (setting.value or {}).get("disclaimer") or "Estimation indicative, non contractuelle.",
    }


def _auto_reply(db: Session, lead: Lead, form_key: str | None) -> None:
    from app.modules.cms.models import AutoReplyTemplate, FormDefinition
    from app.modules.notifications.service import queue_external, render

    form = db.execute(select(FormDefinition).where(FormDefinition.key == (form_key or ""))).scalar_one_or_none()
    code = (form.auto_reply_code if form else None) or "lead.auto_reply"
    policy = db.get(SlaPolicy, lead.sla_policy_id) if lead.sla_policy_id else None
    sla_text = (
        "sous 1 heure ouvrée"
        if policy and policy.response_minutes <= 60
        else f"sous {max(1, (policy.response_minutes if policy else 240) // 60)} heures ouvrées"
    )
    context = {
        "first_name": lead.first_name,
        "number": lead.number,
        "sla_text": sla_text,
        "universe": lead.universe,
        "title": "Nous avons bien reçu votre demande",
    }
    if lead.email:
        custom = db.execute(
            select(AutoReplyTemplate).where(
                AutoReplyTemplate.code == code,
                AutoReplyTemplate.channel == "email",
                AutoReplyTemplate.is_active.is_(True),
            )
        ).scalar_one_or_none()
        if custom:
            context["body"] = render(custom.body, context)
        queue_external(
            db,
            channel="email",
            recipient=lead.email,
            template_code=code if not custom else "generic.notification",
            context={**context, "title": render(custom.subject or "", context) if custom else context["title"]},
        )
    if lead.whatsapp and lead.whatsapp_consent:
        custom_wa = db.execute(
            select(AutoReplyTemplate).where(
                AutoReplyTemplate.code == code,
                AutoReplyTemplate.channel == "whatsapp",
                AutoReplyTemplate.is_active.is_(True),
            )
        ).scalar_one_or_none()
        if custom_wa and custom_wa.whatsapp_template:
            from app.modules.notifications.models import NotificationDelivery

            delivery = NotificationDelivery(
                recipient=lead.whatsapp,
                channel="whatsapp",
                status="queued",
                provider=f"wa_template:{custom_wa.whatsapp_template}",
            )
            db.add(delivery)
            db.flush()
            emit(
                db,
                "whatsapp.template",
                {
                    "delivery_id": str(delivery.id),
                    "template": custom_wa.whatsapp_template,
                    "params": [lead.first_name, lead.number],
                },
            )
    lead.auto_reply_sent_at = utcnow()


def mark_first_response(db: Session, lead: Lead) -> None:
    if lead.first_response_at is None:
        lead.first_response_at = utcnow()
        if lead.status == "new":
            lead.status = "contacted"


# ---------------------------------------------------------------------------- conversion
def convert_lead(
    db: Session,
    lead: Lead,
    *,
    user_id: uuid.UUID,
    title: str | None,
    amount: Decimal | None,
    create_organization: bool = True,
    stage: str = "qualification",
    expected_close_date: date | None = None,
) -> Opportunity:
    if lead.status == "converted" and lead.opportunity_id:
        raise Conflict("Lead déjà converti", code="LEAD_CONVERTED")
    org = None
    if create_organization:
        org = Organization(
            name=lead.company or _lead_name(lead),
            kind="client",
            email=lead.email,
            phone=lead.phone,
            whatsapp=lead.whatsapp,
            city=lead.city,
            country=lead.country,
        )
        db.add(org)
        db.flush()
    contact = Contact(
        organization_id=org.id if org else None,
        first_name=lead.first_name,
        last_name=lead.last_name,
        email=lead.email,
        phone=lead.phone,
        whatsapp=lead.whatsapp,
        city=lead.city,
        country=lead.country,
        is_diaspora=lead.is_diaspora,
        owner_id=lead.assigned_to_id or user_id,
        source_lead_id=lead.id,
    )
    db.add(contact)
    db.flush()
    opp = Opportunity(
        number=next_number(db, "opportunity"),
        title=title or f"Projet {lead.universe or ''} — {_lead_name(lead)}".strip(),
        lead_id=lead.id,
        contact_id=contact.id,
        organization_id=org.id if org else None,
        universe=lead.universe,
        offer_slug=lead.offer_slug,
        amount_estimated=amount or lead.budget_max or Decimal("0"),
        currency=lead.budget_currency or "XAF",
        owner_id=lead.assigned_to_id or user_id,
        stage=stage,
        expected_close_date=expected_close_date,
        probability=30 if lead.temperature == "hot" else 20,
    )
    db.add(opp)
    db.flush()
    brief = db.execute(select(ProjectBrief).where(ProjectBrief.lead_id == lead.id)).scalars().first()
    if brief:
        brief.opportunity_id = opp.id
    lead.contact_id = contact.id
    lead.opportunity_id = opp.id
    lead.status = "converted"
    lead.converted_at = utcnow()
    mark_first_response(db, lead)
    audit.record(
        db,
        family="business",
        module="crm",
        action="CONVERT",
        resource_type="lead",
        resource_id=lead.id,
        diff={"opportunity": opp.number},
    )
    return opp


def compute_quote(quote: Quote) -> None:
    subtotal = Decimal("0")
    for line in quote.lines:
        gross = Decimal(line.quantity) * Decimal(line.unit_price)
        line.total = money(gross * (1 - Decimal(line.discount_pct or 0) / 100))
        subtotal += line.total
    quote.subtotal = money(subtotal)
    base = subtotal - Decimal(quote.discount_amount or 0)
    quote.tax_amount = money(base * Decimal(quote.tax_rate or 0) / 100)
    quote.total = money(base + quote.tax_amount)


def quote_pdf(db: Session, quote: Quote) -> bytes:
    from app.core.pdf import (
        PdfDocument,
        amount_in_words,
        company_party,
        fmt_date,
        fmt_money,
        fmt_qty,
        organization_lines,
        render,
    )

    org = db.get(Organization, quote.organization_id) if quote.organization_id else None
    contact = db.get(Contact, quote.contact_id) if quote.contact_id else None
    person = f"{contact.first_name} {contact.last_name or ''}".strip() if contact else None
    rows = [
        [
            line.designation + (f"<br/><font size=7>{line.description}</font>" if line.description else ""),
            line.unit,
            fmt_qty(line.quantity),
            fmt_money(line.unit_price, quote.currency),
            fmt_money(line.total, quote.currency),
        ]
        for line in quote.lines
    ]
    schedule = "\n".join(
        f"• {s.get('label', 'Échéance')} : {s.get('pct', 0)} %" for s in (quote.payment_schedule or [])
    )
    doc = PdfDocument(
        title="DEVIS",
        number=f"{quote.number} (rév. {quote.revision})",
        issued_on=(quote.sent_at or utcnow()).date(),
        parties=[
            (
                "Client",
                organization_lines(
                    org,
                    person=person,
                    email=contact.email if contact else None,
                    phone=contact.phone if contact else None,
                ),
            ),
            company_party(),
        ],
        meta=[
            ("Objet", quote.title),
            ("Nature", "Études et conception" if getattr(quote, "nature", "travaux") == "etudes" else "Travaux"),
            ("Validité de l'offre", fmt_date(quote.valid_until)),
            ("Devise", "Franc CFA (XAF)" if quote.currency == "XAF" else quote.currency),
        ],
        columns=["Désignation", "Unité", "Qté", "PU", "Total HT"],
        col_widths=[82 * 2.83465, 18 * 2.83465, 18 * 2.83465, 30 * 2.83465, 32 * 2.83465],
        rows=rows,
        totals=[
            ("Total HT", fmt_money(quote.subtotal, quote.currency)),
            ("Remise", fmt_money(quote.discount_amount, quote.currency)),
            (f"TVA {fmt_qty(quote.tax_rate)} %", fmt_money(quote.tax_amount, quote.currency)),
            ("Total TTC", fmt_money(quote.total, quote.currency)),
        ],
        paragraphs=[
            (t, v)
            for t, v in (
                ("Présentation", quote.introduction or ""),
                ("Échéancier", schedule),
                ("Conditions", quote.terms or ""),
            )
            if v
        ],
        signature_blocks=["Pour le client — « Bon pour accord »", "Pour GLOBUS ENGINEERING"],
        amount_words=amount_in_words(quote.total, quote.currency),
        amount_words_label="Arrêté le présent devis à la somme de",
        footer_note=f"Devis valable jusqu'au {fmt_date(quote.valid_until)} — acceptation en ligne depuis le lien reçu.",
    )
    return render(doc)


def send_quote(db: Session, quote: Quote, *, user_id: uuid.UUID) -> str:
    from app.core.files import store_generated
    from app.modules.notifications.service import queue_external

    if quote.status not in ("draft", "sent", "viewed"):
        raise BusinessRuleError("Seul un devis en brouillon ou envoyé peut être (ré)envoyé")
    if not quote.lines:
        raise BusinessRuleError("Le devis ne contient aucune ligne")
    compute_quote(quote)
    quote.sent_at = utcnow()
    token = random_token(32)
    quote.public_token_hash = sha256_hex(token)
    stored = store_generated(
        db,
        quote_pdf(db, quote),
        filename=f"{quote.number}-r{quote.revision}.pdf",
        mime="application/pdf",
        purpose="quotes",
        classification="confidential",
        uploaded_by_id=user_id,
    )
    quote.pdf_file_id = stored.id
    quote.status = "sent"
    contact = db.get(Contact, quote.contact_id) if quote.contact_id else None
    link = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/devis/{token}"
    if contact and contact.email:
        queue_external(
            db,
            channel="email",
            recipient=contact.email,
            template_code="quote.sent",
            context={
                "first_name": contact.first_name,
                "number": quote.number,
                "title": quote.title,
                "total": quote.total,
                "valid_until": quote.valid_until,
                "link": link,
            },
            attachments_file_ids=[str(stored.id)],
        )
    if quote.opportunity_id:
        opp = db.get(Opportunity, quote.opportunity_id)
        if opp and opp.stage in ("qualification", "discovery"):
            opp.stage = "proposal"
    audit.record(
        db,
        family="business",
        module="crm",
        action="SEND",
        resource_type="quote",
        resource_id=quote.id,
        diff={"total": str(quote.total), "revision": quote.revision},
    )
    return token


def revise_quote(db: Session, quote: Quote, *, user_id: uuid.UUID) -> Quote:
    if quote.status in ("accepted",):
        raise BusinessRuleError("Un devis accepté ne peut être révisé : créez un avenant")
    new = Quote(
        number=quote.number,
        revision=quote.revision + 1,
        parent_quote_id=quote.id,
        opportunity_id=quote.opportunity_id,
        organization_id=quote.organization_id,
        contact_id=quote.contact_id,
        project_id=quote.project_id,
        nature=quote.nature,
        title=quote.title,
        introduction=quote.introduction,
        terms=quote.terms,
        discount_amount=quote.discount_amount,
        tax_rate=quote.tax_rate,
        currency=quote.currency,
        valid_until=quote.valid_until,
        payment_schedule=quote.payment_schedule,
        status="draft",
        created_by_id=user_id,
    )
    for line in quote.lines:
        new.lines.append(
            QuoteLine(
                sort_order=line.sort_order,
                section=line.section,
                lot_code=line.lot_code,
                designation=line.designation,
                description=line.description,
                unit=line.unit,
                quantity=line.quantity,
                unit_price=line.unit_price,
                discount_pct=line.discount_pct,
            )
        )
    compute_quote(new)
    quote.status = "superseded"
    db.add(new)
    db.flush()
    audit.record(
        db,
        family="business",
        module="crm",
        action="REVISE",
        resource_type="quote",
        resource_id=new.id,
        diff={"from_revision": quote.revision, "to_revision": new.revision},
    )
    return new


def accept_quote(db: Session, quote: Quote, *, accepted_by_name: str, proof: dict[str, Any]) -> Quote:
    if quote.status not in ("sent", "viewed"):
        raise BusinessRuleError("Ce devis n'est plus valable pour acceptation", code="QUOTE_NOT_ACCEPTABLE")
    if quote.valid_until and quote.valid_until < date.today():
        quote.status = "expired"
        raise BusinessRuleError("Devis expiré", code="QUOTE_EXPIRED")
    quote.status = "accepted"
    quote.accepted_at = utcnow()
    quote.accepted_by_name = accepted_by_name
    quote.acceptance_proof = proof
    if quote.opportunity_id:
        opp = db.get(Opportunity, quote.opportunity_id)
        if opp:
            opp.stage = "negotiation" if opp.stage not in ("won",) else opp.stage
            opp.amount_estimated = quote.total
            emit(
                db,
                "quote.accepted",
                {
                    "id": quote.id,
                    "number": quote.number,
                    "title": quote.title,
                    "total": quote.total,
                    "client": accepted_by_name,
                    "owner_id": opp.owner_id,
                },
                aggregate_type="quote",
                aggregate_id=quote.id,
            )
    audit.record(
        db,
        family="business",
        module="crm",
        action="ACCEPT",
        resource_type="quote",
        resource_id=quote.id,
        actor_type="client",
        actor_label=accepted_by_name,
        diff={"total": str(quote.total)},
        criticality="HIGH",
    )
    return quote


def contract_from_quote(db: Session, quote: Quote, *, user_id: uuid.UUID) -> Contract:
    if quote.status != "accepted":
        raise BusinessRuleError("Le contrat ne peut être établi qu'à partir d'un devis accepté")
    existing = db.execute(
        select(Contract).where(Contract.quote_id == quote.id, Contract.deleted_at.is_(None))
    ).scalar_one_or_none()
    if existing:
        return existing
    contract = Contract(
        number=next_number(db, "contract"),
        quote_id=quote.id,
        opportunity_id=quote.opportunity_id,
        organization_id=quote.organization_id,
        contact_id=quote.contact_id,
        project_id=quote.project_id,
        nature=quote.nature,
        title=quote.title,
        amount=quote.total,
        currency=quote.currency,
        status="draft",
        terms=quote.terms,
        payment_schedule=quote.payment_schedule,
        created_by_id=user_id,
    )
    db.add(contract)
    db.flush()
    audit.record(
        db,
        family="business",
        module="crm",
        action="CREATE",
        resource_type="contract",
        resource_id=contract.id,
        diff={"quote": quote.number, "amount": str(contract.amount)},
    )
    return contract


def sign_contract(
    db: Session, contract: Contract, *, signed_by_name: str, proof: dict[str, Any], user_id: uuid.UUID | None
) -> Contract:
    if contract.status not in ("draft", "sent"):
        raise BusinessRuleError("Contrat déjà signé ou clos")
    contract.status = "signed"
    contract.signed_at = utcnow()
    contract.signed_by_name = signed_by_name
    contract.signature_proof = proof
    if contract.opportunity_id:
        opp = db.get(Opportunity, contract.opportunity_id)
        if opp:
            opp.stage = "won"
            opp.won_at = utcnow()
            opp.probability = 100
    emit(
        db,
        "contract.signed",
        {"id": contract.id, "number": contract.number, "title": contract.title},
        aggregate_type="contract",
        aggregate_id=contract.id,
    )
    audit.record(
        db,
        family="business",
        module="crm",
        action="SIGN",
        resource_type="contract",
        resource_id=contract.id,
        actor_id=user_id,
        actor_label=signed_by_name,
        criticality="HIGH",
    )
    return contract


def project_from_contract(
    db: Session,
    contract: Contract,
    *,
    user_id: uuid.UUID,
    name: str | None,
    manager_id: uuid.UUID | None,
    client_user_ids: list[uuid.UUID],
    auto_invite: bool = True,
) -> Any:
    """Contrat signé → projet (budget initial par lot, jalons et appels de fonds depuis l'échéancier) ; accès
    client ouvert automatiquement au contact signataire (invitation) sauf rattachement explicite."""
    from app.modules.finance.models import Budget, BudgetLine
    from app.modules.projects.models import Lot, Milestone, Project, ProjectMember

    if contract.status not in ("signed", "active"):
        raise BusinessRuleError("Le contrat doit être signé avant de créer le projet")
    opp = db.get(Opportunity, contract.opportunity_id) if contract.opportunity_id else None
    existing_id = contract.project_id or (opp.project_id if opp else None)
    project = db.get(Project, existing_id) if existing_id else None
    if project is not None and (project.contract_id == contract.id or contract.nature == "etudes"):
        if contract.project_id is None:
            contract.project_id = project.id
        return project  # contrat déjà appliqué, ou contrat d'études : le projet existe déjà
    created = project is None
    if project is not None:
        # Projet né de la phase d'études : le contrat de travaux s'y rattache (montant, budget, lots, jalons).
        project.contract_id = contract.id
        project.contract_amount = contract.amount
        project.currency = contract.currency
        if manager_id and not project.manager_id:
            project.manager_id = manager_id
    else:
        project = Project(
            code=next_number(db, "project"),
            name=name or contract.title,
            client_organization_id=contract.organization_id,
            universe=opp.universe if opp else None,
            offer_code=opp.offer_slug if opp else None,
            status="etude",
            contract_amount=contract.amount,
            currency=contract.currency,
            manager_id=manager_id,
            commercial_id=opp.owner_id if opp else None,
            contract_id=contract.id,
            opportunity_id=contract.opportunity_id,
            is_diaspora=bool(opp and opp.lead_id and (db.get(Lead, opp.lead_id) or Lead()).is_diaspora),
        )
        db.add(project)
        db.flush()
    contract.project_id = project.id
    contract.status = "active"
    if opp:
        opp.project_id = project.id
    quote = db.get(Quote, contract.quote_id) if contract.quote_id else None
    previous_versions = db.execute(
        select(func.coalesce(func.max(Budget.version_number), 0)).where(Budget.project_id == project.id)
    ).scalar_one()
    budget = Budget(
        project_id=project.id,
        version_number=int(previous_versions or 0) + 1,
        label="Budget initial (contrat)" if created else "Budget des travaux (contrat)",
        status="draft",
        currency=contract.currency,
        revenue_target=contract.amount,
        created_by_id=user_id,
    )
    db.add(budget)
    db.flush()
    lots: dict[str, Lot] = (
        {}
        if created
        else {lot.code: lot for lot in db.execute(select(Lot).where(Lot.project_id == project.id)).scalars()}
    )
    if quote:
        for line in quote.lines:
            code = line.lot_code or "LOT-00"
            if code not in lots:
                lots[code] = Lot(project_id=project.id, code=code, name=line.section or code, sort_order=len(lots))
                db.add(lots[code])
                db.flush()
            lots[code].budget_amount = Decimal(lots[code].budget_amount or 0) + Decimal(line.total or 0)
            budget.lines.append(
                BudgetLine(lot_id=lots[code].id, category="materiaux", label=line.designation[:250], amount=line.total)
            )
    budget.total = money(sum((Decimal(bl.amount) for bl in budget.lines), Decimal("0")))
    for index, step in enumerate(contract.payment_schedule or []):
        db.add(
            Milestone(
                project_id=project.id,
                name=step.get("label") or f"Échéance {index + 1}",
                due_date=date.fromisoformat(step["due_date"])
                if step.get("due_date")
                else date.today() + timedelta(days=30 * (index + 1)),
                payment_pct=_dec(step.get("pct")),
                sort_order=index,
                client_visible=True,
            )
        )
    already = {
        m for m in db.execute(select(ProjectMember.user_id).where(ProjectMember.project_id == project.id)).scalars()
    }
    if manager_id and manager_id not in already:
        db.add(
            ProjectMember(
                project_id=project.id,
                user_id=manager_id,
                project_role="chef_projet",
                can_view_finance=True,
                added_by_id=user_id,
            )
        )
    for uid in [u for u in client_user_ids if u not in already]:
        db.add(
            ProjectMember(
                project_id=project.id, user_id=uid, project_role="client", can_view_finance=True, added_by_id=user_id
            )
        )
    if created and not client_user_ids and auto_invite:  # projet né des études : le client a déjà son accès
        ensure_client_access(db, project, contract, inviter_id=user_id)
    audit.record(
        db,
        family="business",
        module="projects",
        action="CREATE" if created else "WORKS_CONTRACT_ATTACHED",
        resource_type="project",
        resource_id=project.id,
        project_id=project.id,
        diff={"contract": contract.number, "lots": len(lots)},
    )
    if created:
        emit(
            db,
            "project.created",
            {"id": project.id, "code": project.code, "name": project.name},
            aggregate_type="project",
            aggregate_id=project.id,
            project_id=project.id,
        )
    return project


def start_studies(
    db: Session,
    opp: Opportunity,
    *,
    user_id: uuid.UUID,
    name: str | None,
    manager_id: uuid.UUID | None,
    auto_invite: bool = True,
) -> Any:
    """Phase d'études avant tout devis de travaux : le projet naît au statut « Étude » depuis l'opportunité, le
    client est invité dans son espace pour suivre et valider plans, 3D et options ; les études sont facturées après
    validation, puis le devis de travaux se rattache à ce même projet."""
    from app.modules.projects.models import Project, ProjectMember

    if opp.stage in ("won", "lost"):
        raise BusinessRuleError("Opportunité close : études impossibles")
    if opp.project_id:
        project = db.get(Project, opp.project_id)
        if project is not None:
            return project
    lead = db.get(Lead, opp.lead_id) if opp.lead_id else None
    project = Project(
        code=next_number(db, "project"),
        name=name or opp.title,
        client_organization_id=opp.organization_id,
        universe=opp.universe,
        offer_code=opp.offer_slug,
        status="etude",
        currency=opp.currency,
        manager_id=manager_id,
        commercial_id=opp.owner_id,
        opportunity_id=opp.id,
        city=lead.city if lead else None,
        country=(lead.country if lead and lead.country else None) or "Cameroun",
        is_diaspora=bool(lead and lead.is_diaspora),
    )
    db.add(project)
    db.flush()
    opp.project_id = project.id
    if manager_id:
        db.add(
            ProjectMember(
                project_id=project.id,
                user_id=manager_id,
                project_role="chef_projet",
                can_view_finance=True,
                added_by_id=user_id,
            )
        )
    if auto_invite:
        ensure_client_access(db, project, opp, inviter_id=user_id)
    audit.record(
        db,
        family="business",
        module="projects",
        action="START_STUDIES",
        resource_type="project",
        resource_id=project.id,
        project_id=project.id,
        diff={"opportunity": opp.number},
    )
    emit(
        db,
        "project.created",
        {"id": project.id, "code": project.code, "name": project.name},
        aggregate_type="project",
        aggregate_id=project.id,
        project_id=project.id,
    )
    return project


def log_activity(
    db: Session,
    *,
    kind: str,
    subject: str,
    owner_id: uuid.UUID,
    lead_id: uuid.UUID | None = None,
    contact_id: uuid.UUID | None = None,
    opportunity_id: uuid.UUID | None = None,
    body: str | None = None,
    due_at: Any = None,
    done: bool = False,
    direction: str | None = None,
    outcome: str | None = None,
) -> CrmActivity:
    activity = CrmActivity(
        kind=kind,
        subject=subject,
        body=body,
        owner_id=owner_id,
        lead_id=lead_id,
        contact_id=contact_id,
        opportunity_id=opportunity_id,
        due_at=due_at,
        done_at=utcnow() if done else None,
        status="done" if done else "planned",
        direction=direction,
        outcome=outcome,
    )
    db.add(activity)
    if lead_id and done and kind in ("call", "email", "whatsapp", "meeting", "visit", "sms"):
        lead = db.get(Lead, lead_id)
        if lead:
            mark_first_response(db, lead)
    db.flush()
    return activity


def funnel(db: Session, start: Any = None, end: Any = None) -> dict[str, Any]:
    """KPI : taux de conversion lead → devis → contrat, cycle moyen devis, taux d'acceptation (§23.2)."""
    lead_q = select(func.count()).select_from(Lead).where(Lead.deleted_at.is_(None))
    if start:
        lead_q = lead_q.where(Lead.created_at >= start)
    if end:
        lead_q = lead_q.where(Lead.created_at <= end)
    leads = db.execute(lead_q).scalar_one()
    converted = db.execute(lead_q.where(Lead.status == "converted")).scalar_one()
    quotes_sent = db.execute(
        select(func.count(func.distinct(Quote.number))).where(Quote.sent_at.is_not(None))
    ).scalar_one()
    quotes_accepted = db.execute(select(func.count()).select_from(Quote).where(Quote.status == "accepted")).scalar_one()
    contracts = db.execute(
        select(func.count()).select_from(Contract).where(Contract.signed_at.is_not(None))
    ).scalar_one()
    cycle = db.execute(
        select(func.avg(func.extract("epoch", Quote.accepted_at - Quote.sent_at) / 86400)).where(
            Quote.accepted_at.is_not(None), Quote.sent_at.is_not(None)
        )
    ).scalar()
    by_source = db.execute(
        select(Lead.source, func.count()).where(Lead.deleted_at.is_(None)).group_by(Lead.source)
    ).all()
    by_universe = db.execute(
        select(Lead.universe, func.count()).where(Lead.deleted_at.is_(None)).group_by(Lead.universe)
    ).all()
    by_status = db.execute(
        select(Lead.status, func.count()).where(Lead.deleted_at.is_(None)).group_by(Lead.status)
    ).all()
    sla_ok = db.execute(
        select(func.count())
        .select_from(Lead)
        .where(Lead.first_response_at.is_not(None), Lead.first_response_at <= Lead.response_due_at)
    ).scalar_one()
    responded = db.execute(
        select(func.count()).select_from(Lead).where(Lead.first_response_at.is_not(None))
    ).scalar_one()
    pipeline = db.execute(
        select(Opportunity.stage, func.count(), func.coalesce(func.sum(Opportunity.amount_estimated), 0))
        .where(Opportunity.deleted_at.is_(None))
        .group_by(Opportunity.stage)
    ).all()
    return {
        "leads": leads,
        "converted": converted,
        "quotes_sent": quotes_sent,
        "quotes_accepted": quotes_accepted,
        "contracts_signed": contracts,
        "lead_to_quote_rate": round(quotes_sent * 100 / leads, 1) if leads else 0,
        "quote_acceptance_rate": round(quotes_accepted * 100 / quotes_sent, 1) if quotes_sent else 0,
        "quote_to_contract_rate": round(contracts * 100 / quotes_accepted, 1) if quotes_accepted else 0,
        "lead_to_contract_rate": round(contracts * 100 / leads, 1) if leads else 0,
        "avg_quote_cycle_days": round(float(cycle), 1) if cycle else None,
        "sla_respect_rate": round(sla_ok * 100 / responded, 1) if responded else None,
        "by_source": [{"source": s, "count": c} for s, c in by_source],
        "by_universe": [{"universe": u, "count": c} for u, c in by_universe],
        "by_status": [{"status": s, "count": c} for s, c in by_status],
        "pipeline": [{"stage": s, "count": c, "amount": a} for s, c, a in pipeline],
    }


def get_lead(db: Session, lead_id: uuid.UUID) -> Lead:
    lead = db.get(Lead, lead_id)
    if lead is None or lead.deleted_at is not None:
        raise NotFound("Lead introuvable")
    return lead


def ensure_valid_transition(current: str, target: str, allowed: dict[str, set[str]]) -> None:
    if target not in allowed.get(current, set()):
        raise AppError(f"Transition {current} → {target} interdite", code="INVALID_TRANSITION")


def ensure_client_access(db: Session, project: Any, contract: Any, *, inviter_id: uuid.UUID) -> dict[str, Any]:
    """Accès client automatique une fois le parcours commercial validé (devis accepté → contrat signé → projet) :
    le contact signataire est rattaché au projet ; s'il n'a pas encore de compte, une invitation à usage unique
    lui est envoyée par e-mail et WhatsApp (mot de passe choisi à l'activation, double authentification imposée)."""
    from app.modules.identity.models import User
    from app.modules.identity.service import invite_user, user_by_email
    from app.modules.projects.models import ProjectMember

    contact = db.get(Contact, contract.contact_id) if contract.contact_id else None
    if contact is None or not contact.email:
        return {"status": "no_contact"}
    existing = user_by_email(db, contact.email)
    if existing is not None and existing.password_hash:
        if not db.execute(
            select(ProjectMember.id).where(ProjectMember.project_id == project.id, ProjectMember.user_id == existing.id)
        ).first():
            db.add(
                ProjectMember(
                    project_id=project.id,
                    user_id=existing.id,
                    project_role="client",
                    can_view_finance=True,
                    added_by_id=inviter_id,
                )
            )
        emit(
            db,
            "project.client_access",
            {"id": project.id, "code": project.code, "name": project.name, "user_id": existing.id},
            aggregate_type="project",
            aggregate_id=project.id,
            project_id=project.id,
        )
        return {"status": "linked", "user_id": str(existing.id)}
    inviter = db.get(User, inviter_id)
    if inviter is None:
        return {"status": "no_inviter"}
    channels = ["email"] + (["whatsapp"] if (contact.whatsapp or contact.phone) else [])
    invitation, _token = invite_user(
        db,
        inviter=inviter,
        email=contact.email,
        first_name=contact.first_name,
        last_name=contact.last_name,
        role_codes=["CLIENT"],
        organization_id=contract.organization_id or contact.organization_id,
        project_ids=[project.id],
        message=f"Votre espace client du projet « {project.name} » est prêt : suivi, documents, paiements, décisions.",
        channels=channels,
        phone=contact.whatsapp or contact.phone,
    )
    return {"status": "invited", "invitation_id": str(invitation.id)}
