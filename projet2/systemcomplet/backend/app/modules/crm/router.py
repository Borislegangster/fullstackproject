"""API CRM : formulaires publics, « Décrire mon projet », estimateur, devis en ligne (consultation et
acceptation OTP), et ERP CRM (leads, contacts, opportunités, devis, contrats, activités, règles, SLA, KPI)."""

from __future__ import annotations

import time
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.context import get_context
from app.core.crud import make_crud_router, serialize
from app.core.database import get_db
from app.core.deps import Principal, require
from app.core.downloads import file_response
from app.core.errors import AppError, BusinessRuleError, NotFound
from app.core.files import read_private, store_private, validate_upload
from app.core.middleware import client_ip
from app.core.numbering import next_number
from app.core.pagination import PageParams, paginate
from app.core.ratelimit import rate_limit
from app.core.security import generate_numeric_code, random_token, sha256_hex
from app.core.utils import clean_phone, jsonable, utcnow
from app.modules.crm import service
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
from app.modules.identity.models import User, UserToken
from app.modules.system.models import StoredFile

public = APIRouter(prefix="/public", tags=["CRM (public)"])
router = APIRouter(prefix="/crm", tags=["CRM"])


# ============================================================================ public
class FormSubmitIn(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)
    consents: dict[str, bool] = Field(default_factory=dict)
    utm: dict[str, str] = Field(default_factory=dict)
    landing_page: str | None = Field(default=None, max_length=500)
    referrer: str | None = Field(default=None, max_length=500)
    session_id: str | None = Field(default=None, max_length=64)
    rendered_at: int | None = None
    website: str | None = Field(default=None, max_length=200)  # pot de miel
    referral_code: str | None = Field(default=None, pattern=r"^[A-Za-z0-9]{4,20}$")  # programme ambassadeurs


class DescribeProjectIn(BaseModel):
    universe: str | None = Field(default=None, pattern="^(HOME|BUSINESS|PREMIUM|DIASPORA|ENGINEERING)$")
    offer_slug: str | None = Field(default=None, max_length=120)
    project_type: str | None = Field(default=None, max_length=60)
    project_location: str | None = Field(default=None, max_length=250)
    has_land: bool | None = None
    land_status: str | None = Field(default=None, max_length=30)
    land_surface_m2: Decimal | None = Field(default=None, ge=0)
    surface_m2: Decimal | None = Field(default=None, ge=0, le=1_000_000)
    levels: int | None = Field(default=None, ge=0, le=100)
    rooms: int | None = Field(default=None, ge=0, le=500)
    style: str | None = Field(default=None, max_length=80)
    standing: str | None = Field(default=None, pattern="^(standard|confort|premium)$")
    budget_min: Decimal | None = Field(default=None, ge=0)
    budget_max: Decimal | None = Field(default=None, ge=0)
    budget_currency: str = Field(default="XAF", pattern="^(XAF|EUR|USD)$")
    timeline: str | None = Field(default=None, pattern="^(immediate|3_months|6_months|12_months|undetermined)$")
    financing: str | None = Field(default=None, max_length=60)
    priorities: list[str] = Field(default_factory=list, max_length=10)
    services_needed: list[str] = Field(default_factory=list, max_length=15)
    description: str | None = Field(default=None, max_length=5000)
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str | None = Field(default=None, max_length=120)
    company: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    whatsapp: str | None = Field(default=None, max_length=40)
    country: str | None = Field(default=None, max_length=80)
    city: str | None = Field(default=None, max_length=120)
    preferred_channel: str = Field(default="whatsapp", pattern="^(email|phone|whatsapp)$")
    consents: dict[str, bool] = Field(default_factory=dict)
    utm: dict[str, str] = Field(default_factory=dict)
    landing_page: str | None = Field(default=None, max_length=500)
    referrer: str | None = Field(default=None, max_length=500)
    session_id: str | None = Field(default=None, max_length=64)
    rendered_at: int | None = None
    website: str | None = Field(default=None, max_length=200)
    referral_code: str | None = Field(default=None, pattern=r"^[A-Za-z0-9]{4,20}$")  # programme ambassadeurs


def _anti_bot(website: str | None, rendered_at: int | None, min_seconds: int) -> bool:
    if website:
        return True
    return bool(rendered_at and time.time() - rendered_at < min_seconds)


@public.post(
    "/forms/{key}/submit",
    status_code=201,
    dependencies=[Depends(rate_limit("forms", settings.RATE_LIMIT_PUBLIC_FORMS))],
)
def submit_form(key: str, payload: FormSubmitIn, request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    from app.modules.analytics.service import record_server_event
    from app.modules.cms.models import FormDefinition, FormSubmission

    form = db.execute(
        select(FormDefinition).where(FormDefinition.key == key, FormDefinition.is_active.is_(True))
    ).scalar_one_or_none()
    if form is None:
        raise NotFound("Formulaire indisponible")
    ip = client_ip(request.scope)
    import hashlib

    ip_hash = hashlib.sha256(("f:" + (ip or "")).encode()).hexdigest()
    if _anti_bot(payload.website, payload.rendered_at, form.min_fill_seconds):
        db.add(FormSubmission(form_key=key, data={}, status="spam", ip_hash=ip_hash))
        db.commit()
        return {"status": "received", "message": form.success_message}
    missing = [f["name"] for f in form.fields if f.get("required") and not str(payload.data.get(f["name"], "")).strip()]
    required_consents = [c["key"] for c in form.consents if c.get("required") and not payload.consents.get(c["key"])]
    if missing or required_consents:
        raise AppError(
            "Champs requis manquants",
            code="VALIDATION_ERROR",
            details={"fields": missing, "consents": required_consents},
        )
    allowed = {f["name"] for f in form.fields} | {
        "universe",
        "offer_slug",
        "service_slug",
        "subject",
        "company",
        "city",
        "country",
        "whatsapp",
    }
    data = {k: (str(v)[:5000] if isinstance(v, str) else v) for k, v in payload.data.items() if k in allowed}
    if payload.referral_code:
        data["referral_code"] = payload.referral_code
    submission = FormSubmission(
        form_key=key,
        data=data,
        ip_hash=ip_hash,
        user_agent=request.headers.get("user-agent"),
        utm=payload.utm,
        analytics_session_id=payload.session_id,
    )
    db.add(submission)
    result: dict[str, Any] = {"status": "received", "message": form.success_message}
    if form.destination == "crm_lead":
        lead = service.create_lead(
            db,
            data=data,
            source=key if key in ("callback",) else "website_form",
            form_key=key,
            consents=payload.consents,
            ip=ip,
            user_agent=request.headers.get("user-agent"),
            utm=payload.utm,
            landing_page=payload.landing_page,
            referrer=payload.referrer,
            analytics_session_id=payload.session_id,
        )
        submission.lead_id = lead.id
        submission.consent_record_id = lead.consent_record_id
        result["reference"] = lead.number
    elif form.destination == "newsletter":
        from app.modules.newsletter.service import subscribe

        email = str(data.get("email", "")).strip()
        if not email:
            raise AppError("E-mail requis")
        consent = service.record_consent(
            db,
            subject_type="subscriber",
            subject_ref=email.lower(),
            purposes={"newsletter": True},
            source=f"form:{key}",
            ip=ip,
            user_agent=request.headers.get("user-agent"),
        )
        subscribe(
            db,
            email=email,
            first_name=data.get("first_name"),
            source="website",
            interests=[],
            consent_record_id=consent.id,
            ip=ip,
            user_agent=request.headers.get("user-agent"),
        )
    record_server_event(
        db,
        "conversion",
        path=payload.landing_page,
        target=f"form:{key}",
        session_id=payload.session_id if payload.session_id and _session_exists(db, payload.session_id) else None,
    )
    db.commit()
    return result


def _session_exists(db: Session, session_id: str) -> bool:
    from app.modules.analytics.models import AnalyticsSession

    return db.get(AnalyticsSession, session_id) is not None


@public.post(
    "/describe-project",
    status_code=201,
    dependencies=[Depends(rate_limit("describe", settings.RATE_LIMIT_PUBLIC_FORMS))],
)
def describe_project(payload: DescribeProjectIn, request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    from app.modules.analytics.service import record_server_event

    if _anti_bot(payload.website, payload.rendered_at, 5):
        return {"status": "received"}
    answers = payload.model_dump(
        mode="json",
        exclude={
            "consents",
            "utm",
            "landing_page",
            "referrer",
            "session_id",
            "rendered_at",
            "website",
            "referral_code",
            "first_name",
            "last_name",
            "email",
            "phone",
            "whatsapp",
            "company",
        },
    )
    data = payload.model_dump(mode="json")
    message = payload.description or None
    data["message"] = message
    lead = service.create_lead(
        db,
        data=data,
        source="describe_project",
        form_key="describe_project",
        consents=payload.consents,
        ip=client_ip(request.scope),
        user_agent=request.headers.get("user-agent"),
        utm=payload.utm,
        landing_page=payload.landing_page,
        referrer=payload.referrer,
        analytics_session_id=payload.session_id,
        brief_answers=answers,
    )
    brief = db.execute(select(ProjectBrief).where(ProjectBrief.lead_id == lead.id)).scalars().first()
    record_server_event(
        db,
        "describe_project_submit",
        path="/decrire-mon-projet",
        target=payload.universe,
        session_id=payload.session_id if payload.session_id and _session_exists(db, payload.session_id) else None,
    )
    db.commit()
    return {
        "status": "received",
        "reference": lead.number,
        "estimate": {"min": brief.estimate_min, "max": brief.estimate_max} if brief and brief.estimate_min else None,
        "next_steps": [
            "Un expert GLOBUS analyse votre projet",
            "Vous êtes recontacté(e) par le canal choisi",
            "Rendez-vous de cadrage (visite ou visio)",
        ],
    }


@public.post("/estimate")
def public_estimate(
    payload: dict[str, Any], db: Session = Depends(get_db), _: None = Depends(rate_limit("estimate", "60/hour"))
) -> dict[str, Any]:
    estimate = service.estimate_budget(db, payload.get("universe"), payload)
    if estimate is None:
        return {
            "available": False,
            "message": "L'estimation en ligne n'est pas disponible : décrivez votre projet pour "
            "recevoir une estimation personnalisée.",
        }
    return {"available": True, **jsonable(estimate)}


# ---------------------------------------------------------------------------- devis en ligne
def _quote_by_token(db: Session, token: str) -> Quote:
    quote = db.execute(
        select(Quote).where(Quote.public_token_hash == sha256_hex(token), Quote.deleted_at.is_(None))
    ).scalar_one_or_none()
    if quote is None:
        raise NotFound("Devis introuvable ou lien expiré")
    return quote


@public.get("/quotes/{token}")
def public_quote(token: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    quote = _quote_by_token(db, token)
    if quote.status == "sent":
        quote.status = "viewed"
        quote.viewed_at = utcnow()
        db.commit()
    return jsonable(
        {
            "number": quote.number,
            "revision": quote.revision,
            "title": quote.title,
            "introduction": quote.introduction,
            "terms": quote.terms,
            "status": quote.status,
            "currency": quote.currency,
            "valid_until": quote.valid_until,
            "subtotal": quote.subtotal,
            "discount_amount": quote.discount_amount,
            "tax_rate": quote.tax_rate,
            "tax_amount": quote.tax_amount,
            "total": quote.total,
            "payment_schedule": quote.payment_schedule,
            "accepted_at": quote.accepted_at,
            "lines": [
                {
                    "section": li.section,
                    "designation": li.designation,
                    "description": li.description,
                    "unit": li.unit,
                    "quantity": li.quantity,
                    "unit_price": li.unit_price,
                    "total": li.total,
                }
                for li in quote.lines
            ],
        }
    )


@public.get("/quotes/{token}/pdf")
def public_quote_pdf(token: str, db: Session = Depends(get_db)) -> Response:
    quote = _quote_by_token(db, token)
    data = read_private(db.get(StoredFile, quote.pdf_file_id)) if quote.pdf_file_id else service.quote_pdf(db, quote)
    return Response(
        data, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="{quote.number}.pdf"'}
    )


@public.post("/quotes/{token}/otp", dependencies=[Depends(rate_limit("quote_otp", "10/hour"))])
def public_quote_otp(token: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    from app.modules.notifications.service import queue_external

    quote = _quote_by_token(db, token)
    contact = db.get(Contact, quote.contact_id) if quote.contact_id else None
    if contact is None or not contact.email:
        raise BusinessRuleError("Aucun e-mail de contact pour la validation", code="NO_CONTACT_EMAIL")
    code = generate_numeric_code(6)
    otp_token = random_token(24)
    db.add(
        UserToken(
            email=contact.email,
            purpose="otp_quote",
            token_hash=sha256_hex(otp_token),
            payload={"quote_id": str(quote.id), "code_hash": sha256_hex(f"{otp_token}:{code}")},
            expires_at=utcnow() + timedelta(minutes=10),
            ip=get_context().ip,
        )
    )
    queue_external(
        db,
        channel="email",
        recipient=contact.email,
        template_code="auth.otp",
        context={
            "first_name": contact.first_name,
            "code": code,
            "ttl_minutes": 10,
            "purpose": f"acceptation du devis {quote.number}",
        },
    )
    db.commit()
    result: dict[str, Any] = {"otp_token": otp_token, "sent_to": contact.email[:3] + "•••" + contact.email[-6:]}
    if settings.ENV == "test":
        result["test_code"] = code
    return result


class QuoteAcceptIn(BaseModel):
    full_name: str = Field(min_length=3, max_length=200)
    otp_token: str = Field(max_length=100)
    code: str = Field(min_length=6, max_length=6)
    accept_terms: bool


@public.post("/quotes/{token}/accept")
def public_quote_accept(
    token: str,
    data: QuoteAcceptIn,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit("quote_accept", "20/hour")),
) -> dict[str, Any]:
    if not data.accept_terms:
        raise BusinessRuleError("L'acceptation des conditions est requise")
    quote = _quote_by_token(db, token)
    row = db.execute(
        select(UserToken).where(UserToken.purpose == "otp_quote", UserToken.token_hash == sha256_hex(data.otp_token))
    ).scalar_one_or_none()
    if (
        row is None
        or row.used_at
        or row.expires_at < utcnow()
        or row.payload.get("quote_id") != str(quote.id)
        or row.attempts >= 5
    ):
        raise AppError("Code expiré, demandez-en un nouveau", code="OTP_EXPIRED")
    if sha256_hex(f"{data.otp_token}:{data.code}") != row.payload.get("code_hash"):
        row.attempts += 1
        db.commit()
        raise AppError("Code incorrect", code="OTP_INVALID")
    row.used_at = utcnow()
    from app.core.files import read_private as _read

    pdf = _read(db.get(StoredFile, quote.pdf_file_id)) if quote.pdf_file_id else service.quote_pdf(db, quote)
    proof = {
        "method": "otp_email",
        "email": row.email,
        "otp_verified_at": row.used_at.isoformat(),
        "ip": client_ip(request.scope),
        "user_agent": request.headers.get("user-agent", "")[:300],
        "document_sha256": sha256_hex(pdf),
        "total": str(quote.total),
        "revision": quote.revision,
    }
    service.accept_quote(db, quote, accepted_by_name=data.full_name, proof=proof)
    db.commit()
    return {"status": "accepted", "accepted_at": quote.accepted_at}


# ============================================================================ ERP — leads
def _lead_out(lead: Lead) -> dict[str, Any]:
    return jsonable({c.key: getattr(lead, c.key) for c in Lead.__table__.columns} | {"name": service._lead_name(lead)})


@router.get("/leads")
def list_leads(
    params: PageParams = Depends(),
    status: str | None = None,
    universe: str | None = None,
    source: str | None = None,
    temperature: str | None = None,
    assigned_to_id: uuid.UUID | None = None,
    mine: bool = False,
    overdue: bool = False,
    principal: Principal = Depends(require("crm:read")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(Lead).where(Lead.deleted_at.is_(None))
    for col, value in (
        (Lead.status, status),
        (Lead.universe, universe),
        (Lead.source, source),
        (Lead.temperature, temperature),
        (Lead.assigned_to_id, assigned_to_id),
    ):
        if value:
            stmt = stmt.where(col == value)
    if mine:
        stmt = stmt.where(Lead.assigned_to_id == principal.id)
    if overdue:
        stmt = stmt.where(Lead.first_response_at.is_(None), Lead.response_due_at < utcnow())
    return paginate(
        db,
        stmt,
        params,
        sort_fields={"created_at": Lead.created_at, "score": Lead.score, "response_due_at": Lead.response_due_at},
        default_sort=Lead.created_at.desc(),
        search_columns=[Lead.first_name, Lead.last_name, Lead.email, Lead.phone, Lead.number, Lead.company],
        transform=_lead_out,
    )


@router.get("/leads/{lead_id}")
def get_lead(
    lead_id: uuid.UUID, principal: Principal = Depends(require("crm:read")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    lead = service.get_lead(db, lead_id)
    brief = db.execute(select(ProjectBrief).where(ProjectBrief.lead_id == lead.id)).scalars().first()
    activities = (
        db.execute(select(CrmActivity).where(CrmActivity.lead_id == lead.id).order_by(CrmActivity.created_at.desc()))
        .scalars()
        .all()
    )
    return {
        **_lead_out(lead),
        "brief": serialize(brief) if brief else None,
        "activities": jsonable([serialize(a) for a in activities]),
    }


class LeadUpdate(BaseModel):
    status: str | None = Field(default=None, pattern="^(new|contacted|qualified|nurturing|unqualified|lost)$")
    lost_reason: str | None = Field(default=None, max_length=1000)
    # Coordonnées (correction d'une saisie, numéro WhatsApp communiqué plus tard…)
    first_name: str | None = Field(default=None, min_length=1, max_length=120)
    last_name: str | None = Field(default=None, max_length=120)
    company: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    whatsapp: str | None = Field(default=None, max_length=40)
    country: str | None = Field(default=None, max_length=80)
    city: str | None = Field(default=None, max_length=120)
    preferred_channel: str | None = Field(default=None, pattern="^(email|phone|whatsapp)$")
    project_type: str | None = Field(default=None, max_length=120)
    project_location: str | None = Field(default=None, max_length=200)
    has_land: bool | None = None
    land_status: str | None = Field(default=None, pattern="^(titre_foncier|en_cours|acte_vente|coutumier|a_verifier)$")
    universe: str | None = None
    offer_slug: str | None = None
    budget_min: Decimal | None = None
    budget_max: Decimal | None = None
    timeline: str | None = None
    urgency: str | None = Field(default=None, pattern="^(normal|urgent)$")
    tags: list[str] | None = None
    assigned_to_id: uuid.UUID | None = None


@router.patch("/leads/{lead_id}")
def update_lead(
    lead_id: uuid.UUID,
    data: LeadUpdate,
    principal: Principal = Depends(require("crm:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    lead = service.get_lead(db, lead_id)
    values = data.model_dump(exclude_unset=True)
    if values.get("email"):
        values["email"] = str(values["email"]).strip().lower()
    for key in ("phone", "whatsapp"):
        if values.get(key):
            values[key] = clean_phone(values[key])
    if "first_name" in values and not values["first_name"]:
        raise BusinessRuleError("Prénom requis")
    if "country" in values:
        country = str(values["country"] or "").strip().lower()
        values["is_diaspora"] = bool(country) and country not in ("cameroun", "cameroon", "cm")
    if "assigned_to_id" in values:
        principal.require("crm:assign")
    if values.get("status") == "lost" and not values.get("lost_reason") and not lead.lost_reason:
        raise BusinessRuleError("Motif de perte requis")
    before = audit.snapshot(lead, list(values))
    for key, value in values.items():
        setattr(lead, key, value)
    if values.get("status") in ("contacted", "qualified"):
        service.mark_first_response(db, lead)
    if values.get("assigned_to_id"):
        lead.assigned_at = utcnow()
        from app.core.events import emit

        emit(
            db,
            "lead.assigned",
            {
                "id": lead.id,
                "number": lead.number,
                "name": service._lead_name(lead),
                "assigned_to_id": lead.assigned_to_id,
                "response_due_at": lead.response_due_at,
            },
            aggregate_type="lead",
            aggregate_id=lead.id,
        )
    lead.score, lead.score_details = service.rule_score(lead)
    lead.temperature = service.temperature_for(lead.score)
    audit.record(
        db,
        family="business",
        module="crm",
        action="UPDATE",
        resource_type="lead",
        resource_id=lead.id,
        diff=audit.diff_dicts(before, values),
    )
    db.commit()
    return _lead_out(lead)


class LeadManualIn(BaseModel):
    """Saisie manuelle d'un lead (téléphone, salon, recommandation) : un e-mail ou un téléphone est requis."""

    source: str = Field(
        default="phone",
        pattern="^(website|describe_project|estimator|phone|whatsapp|email|salon|referral|walk_in|chatbot|social|other)$",
    )
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str | None = Field(default=None, max_length=120)
    company: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=40)
    whatsapp: str | None = Field(default=None, max_length=40)
    country: str | None = Field(default=None, max_length=80)
    city: str | None = Field(default=None, max_length=120)
    universe: str | None = Field(default=None, pattern="^(HOME|BUSINESS|PREMIUM|DIASPORA|ENGINEERING)$")
    offer_slug: str | None = Field(default=None, max_length=160)
    project_type: str | None = Field(default=None, max_length=120)
    project_location: str | None = Field(default=None, max_length=200)
    budget_min: Decimal | None = Field(default=None, ge=0)
    budget_max: Decimal | None = Field(default=None, ge=0)
    timeline: str | None = Field(default=None, pattern="^(immediate|3_months|6_months|12_months|undetermined)$")
    urgency: str = Field(default="normal", pattern="^(normal|urgent)$")
    preferred_channel: str | None = Field(default=None, pattern="^(email|phone|whatsapp)$")
    message: str | None = Field(default=None, max_length=5000)
    tags: list[str] = Field(default_factory=list, max_length=20)
    # Commercial choisi à la saisie (droit crm:assign) ; sinon règles d'affectation automatiques.
    assigned_to_id: uuid.UUID | None = None
    marketing_consent: bool = False
    whatsapp_consent: bool = False


@router.post("/leads", status_code=201)
def create_lead_manual(
    data: LeadManualIn, principal: Principal = Depends(require("crm:write")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Saisie manuelle (téléphone, salon, recommandation) — consentement de contact attesté par le commercial."""
    values = data.model_dump(exclude_none=True)
    source = values.pop("source", "phone")
    if data.assigned_to_id:
        principal.require("crm:assign")
        assignee = db.get(User, data.assigned_to_id)
        if assignee is None or not assignee.is_active or assignee.deleted_at is not None:
            raise BusinessRuleError("Commercial introuvable ou inactif", code="ASSIGNEE_INVALID")
    lead = service.create_lead(
        db,
        data=values,
        source=source,
        form_key=None,
        consents={
            "contact": True,
            "marketing": data.marketing_consent,
            "whatsapp": data.whatsapp_consent,
        },
        ip=None,
        user_agent=None,
        created_by=principal.id,
    )
    db.commit()
    return _lead_out(lead)


class ConvertIn(BaseModel):
    title: str | None = Field(default=None, max_length=250)
    amount: Decimal | None = Field(default=None, ge=0)
    stage: str = Field(default="qualification", pattern="^(qualification|discovery|proposal|negotiation)$")
    expected_close_date: date | None = None  # date de décision attendue du client
    create_organization: bool = True


@router.post("/leads/{lead_id}/convert")
def convert(
    lead_id: uuid.UUID,
    data: ConvertIn,
    principal: Principal = Depends(require("crm:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    lead = service.get_lead(db, lead_id)
    opp = service.convert_lead(
        db,
        lead,
        user_id=principal.id,
        title=data.title,
        amount=data.amount,
        stage=data.stage,
        expected_close_date=data.expected_close_date,
        create_organization=data.create_organization,
    )
    db.commit()
    return {
        "opportunity_id": opp.id,
        "opportunity_number": opp.number,
        "contact_id": lead.contact_id,
        "organization_id": opp.organization_id,
    }


class ActivityIn(BaseModel):
    kind: str = Field(pattern="^(call|email|meeting|whatsapp|sms|note|visit|task|follow_up)$")
    subject: str = Field(min_length=2, max_length=250)
    body: str | None = None
    due_at: datetime | None = None
    done: bool = False
    direction: str | None = Field(default=None, pattern="^(in|out)$")
    outcome: str | None = Field(default=None, max_length=250)
    lead_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    opportunity_id: uuid.UUID | None = None


@router.post("/activities", status_code=201)
def create_activity(
    data: ActivityIn, principal: Principal = Depends(require("crm:write")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    if not (data.lead_id or data.contact_id or data.opportunity_id):
        raise BusinessRuleError("Rattachez l'activité à un lead, un contact ou une opportunité")
    activity = service.log_activity(
        db,
        kind=data.kind,
        subject=data.subject,
        body=data.body,
        owner_id=principal.id,
        lead_id=data.lead_id,
        contact_id=data.contact_id,
        opportunity_id=data.opportunity_id,
        due_at=data.due_at,
        done=data.done,
        direction=data.direction,
        outcome=data.outcome,
    )
    audit.record(
        db,
        family="business",
        module="crm",
        action="CREATE",
        resource_type="crm_activity",
        resource_id=activity.id,
        diff={"kind": data.kind},
    )
    db.commit()
    return jsonable(serialize(activity))


@router.post("/activities/{activity_id}/done")
def complete_activity(
    activity_id: uuid.UUID,
    data: dict[str, str] | None = None,
    principal: Principal = Depends(require("crm:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    activity = db.get(CrmActivity, activity_id)
    if activity is None:
        raise NotFound("Activité introuvable")
    activity.status = "done"
    activity.done_at = utcnow()
    activity.outcome = (data or {}).get("outcome") or activity.outcome
    if activity.lead_id:
        lead = db.get(Lead, activity.lead_id)
        if lead:
            service.mark_first_response(db, lead)
    db.commit()
    return jsonable(serialize(activity))


@router.get("/activities")
def list_activities(
    params: PageParams = Depends(),
    mine: bool = True,
    status: str | None = None,
    due_before: datetime | None = None,
    principal: Principal = Depends(require("crm:read")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(CrmActivity)
    if mine:
        stmt = stmt.where(CrmActivity.owner_id == principal.id)
    if status:
        stmt = stmt.where(CrmActivity.status == status)
    if due_before:
        stmt = stmt.where(CrmActivity.due_at <= due_before)
    return paginate(
        db,
        stmt,
        params,
        sort_fields={"due_at": CrmActivity.due_at, "created_at": CrmActivity.created_at},
        default_sort=CrmActivity.due_at.asc().nullslast(),
        transform=lambda a: jsonable(serialize(a)),
    )


@router.get("/funnel")
def crm_funnel(
    start: date | None = None,
    end: date | None = None,
    principal: Principal = Depends(require("crm:read")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return jsonable(service.funnel(db, start, end))


# ---------------------------------------------------------------------------- contacts / opportunités
router.include_router(
    make_crud_router(
        Contact,
        prefix="/contacts",
        tags=["CRM"],
        module="crm",
        read_perm="crm:read",
        write_perm="crm:write",
        label="Contact",
        search=["first_name", "last_name", "email", "phone"],
        sort=["last_name", "created_at"],
        filters=["organization_id", "owner_id", "is_diaspora"],
    )
)
router.include_router(
    make_crud_router(
        Opportunity,
        prefix="/opportunities",
        tags=["CRM"],
        module="crm",
        read_perm="crm:read",
        write_perm="crm:write",
        label="Opportunité",
        search=["title", "number"],
        sort=["created_at", "amount_estimated", "expected_close_date"],
        filters=["stage", "owner_id", "universe", "organization_id"],
        exclude_in={"number", "won_at", "lost_at", "project_id"},
        before_create=lambda db, obj, access, values: setattr(obj, "number", next_number(db, "opportunity")),
    )
)
router.include_router(
    make_crud_router(
        AssignmentRule,
        prefix="/assignment-rules",
        tags=["CRM"],
        module="crm",
        read_perm="crm:read",
        write_perm="crm:assign",
        label="Règle d'affectation",
        sort=["priority"],
        default_sort="priority",
    )
)
router.include_router(
    make_crud_router(
        SlaPolicy,
        prefix="/sla-policies",
        tags=["CRM"],
        module="crm",
        read_perm="crm:read",
        write_perm="settings:write",
        label="Politique SLA",
        filters=["entity", "priority"],
    )
)


class StageIn(BaseModel):
    stage: str = Field(pattern="^(qualification|discovery|proposal|negotiation|won|lost)$")
    lost_reason: str | None = None


@router.post("/opportunities/{opp_id}/stage")
def opportunity_stage(
    opp_id: uuid.UUID,
    data: StageIn,
    principal: Principal = Depends(require("crm:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    opp = db.get(Opportunity, opp_id)
    if opp is None or opp.deleted_at:
        raise NotFound("Opportunité introuvable")
    if data.stage == "lost" and not data.lost_reason:
        raise BusinessRuleError("Motif de perte requis")
    previous = opp.stage
    opp.stage = data.stage
    opp.probability = {"qualification": 20, "discovery": 35, "proposal": 50, "negotiation": 75, "won": 100, "lost": 0}[
        data.stage
    ]
    # Retour à une étape en cours : les dates de gain / perte et le motif de perte ne s'appliquent plus.
    opp.won_at = utcnow() if data.stage == "won" else None
    opp.lost_at = utcnow() if data.stage == "lost" else None
    opp.lost_reason = data.lost_reason if data.stage == "lost" else None
    audit.record(
        db,
        family="business",
        module="crm",
        action="STAGE",
        resource_type="opportunity",
        resource_id=opp.id,
        diff={"stage": [previous, data.stage]},
    )
    db.commit()
    return jsonable(serialize(opp))


# ---------------------------------------------------------------------------- devis
class QuoteLineIn(BaseModel):
    section: str | None = Field(default=None, max_length=150)
    lot_code: str | None = Field(default=None, max_length=30)
    designation: str = Field(min_length=1, max_length=300)
    description: str | None = None
    unit: str = Field(default="u", max_length=20)
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)
    discount_pct: Decimal = Field(default=Decimal("0"), ge=0, le=100)


class QuoteIn(BaseModel):
    title: str = Field(min_length=2, max_length=250)
    nature: Literal["travaux", "etudes"] = "travaux"
    opportunity_id: uuid.UUID | None = None
    organization_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    introduction: str | None = None
    terms: str | None = None
    discount_amount: Decimal = Field(default=Decimal("0"), ge=0)
    tax_rate: Decimal = Field(default=Decimal("19.25"), ge=0, le=100)
    currency: str = Field(default="XAF", pattern="^(XAF|EUR|USD)$")
    valid_until: date | None = None
    payment_schedule: list[dict[str, Any]] = Field(default_factory=list)
    lines: list[QuoteLineIn] = Field(default_factory=list, max_length=500)


def _quote_out(quote: Quote) -> dict[str, Any]:
    data = serialize(quote)
    data["lines"] = [serialize(line) for line in quote.lines]
    data.pop("public_token_hash", None)
    return jsonable(data)


def _check_schedule(schedule: list[dict[str, Any]]) -> None:
    if schedule:
        total = sum(Decimal(str(s.get("pct", 0))) for s in schedule)
        if total != Decimal("100"):
            raise BusinessRuleError("L'échéancier doit totaliser 100 %", code="SCHEDULE_NOT_100")


@router.get("/quotes")
def list_quotes(
    params: PageParams = Depends(),
    status: str | None = None,
    opportunity_id: uuid.UUID | None = None,
    principal: Principal = Depends(require("crm:read")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(Quote).where(Quote.deleted_at.is_(None))
    if status:
        stmt = stmt.where(Quote.status == status)
    if opportunity_id:
        stmt = stmt.where(Quote.opportunity_id == opportunity_id)
    return paginate(
        db,
        stmt,
        params,
        sort_fields={"created_at": Quote.created_at, "total": Quote.total},
        default_sort=Quote.created_at.desc(),
        search_columns=[Quote.number, Quote.title],
        transform=lambda q: {k: v for k, v in _quote_out(q).items() if k != "lines"},
    )


@router.post("/quotes", status_code=201)
def create_quote(
    data: QuoteIn, principal: Principal = Depends(require("crm:write")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    _check_schedule(data.payment_schedule)
    values = data.model_dump(exclude={"lines"})
    opp = db.get(Opportunity, data.opportunity_id) if data.opportunity_id else None
    if opp:
        values["contact_id"] = values["contact_id"] or opp.contact_id
        values["organization_id"] = values["organization_id"] or opp.organization_id
        # Études déjà lancées : le devis (de travaux) se rattache au projet né des études.
        values["project_id"] = values["project_id"] or opp.project_id
    quote = Quote(number=next_number(db, "quote"), status="draft", created_by_id=principal.id, **values)
    for index, line in enumerate(data.lines):
        quote.lines.append(QuoteLine(sort_order=index, **line.model_dump()))
    service.compute_quote(quote)
    db.add(quote)
    db.flush()
    audit.record(
        db,
        family="business",
        module="crm",
        action="CREATE",
        resource_type="quote",
        resource_id=quote.id,
        diff={"total": str(quote.total)},
    )
    db.commit()
    return _quote_out(quote)


def _get_quote(db: Session, quote_id: uuid.UUID) -> Quote:
    quote = db.get(Quote, quote_id)
    if quote is None or quote.deleted_at:
        raise NotFound("Devis introuvable")
    return quote


@router.get("/quotes/{quote_id}")
def get_quote(
    quote_id: uuid.UUID, principal: Principal = Depends(require("crm:read")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    return _quote_out(_get_quote(db, quote_id))


@router.put("/quotes/{quote_id}")
def update_quote(
    quote_id: uuid.UUID,
    data: QuoteIn,
    principal: Principal = Depends(require("crm:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    quote = _get_quote(db, quote_id)
    if quote.status != "draft":
        raise BusinessRuleError("Seul un devis en brouillon est modifiable : créez une révision", code="QUOTE_LOCKED")
    _check_schedule(data.payment_schedule)
    for key, value in data.model_dump(exclude={"lines"}).items():
        setattr(quote, key, value)
    quote.lines.clear()
    db.flush()
    for index, line in enumerate(data.lines):
        quote.lines.append(QuoteLine(sort_order=index, **line.model_dump()))
    service.compute_quote(quote)
    audit.record(
        db,
        family="business",
        module="crm",
        action="UPDATE",
        resource_type="quote",
        resource_id=quote.id,
        diff={"total": str(quote.total)},
    )
    db.commit()
    return _quote_out(quote)


@router.post("/quotes/{quote_id}/send")
def send_quote(
    quote_id: uuid.UUID, principal: Principal = Depends(require("crm:write")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    quote = _get_quote(db, quote_id)
    token = service.send_quote(db, quote, user_id=principal.id)
    db.commit()
    return {**_quote_out(quote), "public_url": f"{settings.PUBLIC_BASE_URL.rstrip('/')}/devis/{token}"}


@router.post("/quotes/{quote_id}/revise", status_code=201)
def revise_quote(
    quote_id: uuid.UUID, principal: Principal = Depends(require("crm:write")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    new = service.revise_quote(db, _get_quote(db, quote_id), user_id=principal.id)
    db.commit()
    return _quote_out(new)


class QuoteRejectIn(BaseModel):
    reason: str | None = Field(default=None, max_length=1000)


@router.post("/quotes/{quote_id}/reject")
def reject_quote(
    quote_id: uuid.UUID,
    data: QuoteRejectIn,
    principal: Principal = Depends(require("crm:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    quote = _get_quote(db, quote_id)
    if quote.status not in ("sent", "viewed"):
        raise BusinessRuleError("Statut incompatible")
    quote.status = "rejected"
    quote.rejected_at = utcnow()
    quote.rejected_reason = data.reason
    audit.record(
        db,
        family="business",
        module="crm",
        action="REJECT",
        resource_type="quote",
        resource_id=quote.id,
        reason=quote.rejected_reason,
    )
    db.commit()
    return _quote_out(quote)


@router.get("/quotes/{quote_id}/pdf")
def quote_pdf(
    quote_id: uuid.UUID, principal: Principal = Depends(require("crm:read")), db: Session = Depends(get_db)
) -> Response:
    quote = _get_quote(db, quote_id)
    data = read_private(db.get(StoredFile, quote.pdf_file_id)) if quote.pdf_file_id else service.quote_pdf(db, quote)
    return Response(
        data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{quote.number}-r{quote.revision}.pdf"'},
    )


@router.post("/quotes/{quote_id}/contract", status_code=201)
def contract_from_quote(
    quote_id: uuid.UUID, principal: Principal = Depends(require("crm:contracts")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    contract = service.contract_from_quote(db, _get_quote(db, quote_id), user_id=principal.id)
    db.commit()
    return jsonable(serialize(contract))


# ---------------------------------------------------------------------------- contrats
@router.get("/contracts")
def list_contracts(
    params: PageParams = Depends(),
    status: str | None = None,
    principal: Principal = Depends(require("crm:read")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(Contract).where(Contract.deleted_at.is_(None))
    if status:
        stmt = stmt.where(Contract.status == status)
    return paginate(
        db,
        stmt,
        params,
        sort_fields={"created_at": Contract.created_at, "amount": Contract.amount},
        default_sort=Contract.created_at.desc(),
        search_columns=[Contract.number, Contract.title],
        transform=lambda c: jsonable(serialize(c)),
    )


@router.get("/contracts/{contract_id}")
def get_contract(
    contract_id: uuid.UUID, principal: Principal = Depends(require("crm:read")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    from app.modules.identity.models import Organization
    from app.modules.projects.models import Project

    contract = db.get(Contract, contract_id)
    if contract is None or contract.deleted_at:
        raise NotFound("Contrat introuvable")
    quote = db.get(Quote, contract.quote_id) if contract.quote_id else None
    org = db.get(Organization, contract.organization_id) if contract.organization_id else None
    contact = db.get(Contact, contract.contact_id) if contract.contact_id else None
    project = db.get(Project, contract.project_id) if contract.project_id else None
    return jsonable(
        {
            **serialize(contract),
            "quote": {k: v for k, v in _quote_out(quote).items() if k != "lines"} if quote else None,
            "organization": {"id": org.id, "name": org.name} if org else None,
            "contact": {
                "id": contact.id,
                "name": " ".join(filter(None, [contact.first_name, contact.last_name])),
                "email": contact.email,
                "phone": contact.phone,
            }
            if contact
            else None,
            "project": {
                "id": project.id,
                "code": project.code,
                "name": project.name,
                "contract_id": project.contract_id,
                "status": project.status,
            }
            if project
            else None,
        }
    )


@router.get("/contracts/{contract_id}/evidence")
def contract_evidence(
    contract_id: uuid.UUID, principal: Principal = Depends(require("crm:read")), db: Session = Depends(get_db)
) -> Response:
    """Preuve de signature (contrat signé scanné) jointe lors de l'enregistrement de la signature."""
    contract = db.get(Contract, contract_id)
    file_id = (contract.signature_proof or {}).get("evidence_file_id") if contract else None
    stored = db.get(StoredFile, uuid.UUID(file_id)) if file_id else None
    if stored is None:
        raise NotFound("Preuve indisponible")
    return file_response(stored)


@router.post("/files", status_code=201)
async def upload_crm_file(
    file: UploadFile = File(...), principal: Principal = Depends(require("crm:write")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Pièce CRM privée (contrat signé scanné, cahier des charges client…) : renvoie l'identifiant à référencer."""
    upload = validate_upload(file.filename or "document.pdf", await file.read(), category="media")
    stored = store_private(db, upload, purpose="crm", classification="confidential", uploaded_by_id=principal.id)
    audit.record(
        db,
        family="business",
        module="crm",
        action="UPLOAD",
        resource_type="stored_file",
        resource_id=stored.id,
    )
    db.commit()
    return jsonable({"file_id": stored.id, "filename": stored.original_name})


class SignContractIn(BaseModel):
    signed_by_name: str = Field(min_length=3, max_length=200)
    method: str = Field(default="manuscrite_scannee", pattern="^(manuscrite_scannee|otp|electronique)$")
    evidence_file_id: uuid.UUID | None = None
    signed_on: date | None = None


@router.post("/contracts/{contract_id}/sign")
def sign_contract(
    contract_id: uuid.UUID,
    data: SignContractIn,
    principal: Principal = Depends(require("crm:contracts")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    contract = db.get(Contract, contract_id)
    if contract is None:
        raise NotFound("Contrat introuvable")
    if data.method == "manuscrite_scannee" and not data.evidence_file_id:
        raise BusinessRuleError("Joignez le contrat signé scanné comme preuve", code="EVIDENCE_REQUIRED")
    proof = {
        "method": data.method,
        "evidence_file_id": str(data.evidence_file_id) if data.evidence_file_id else None,
        "recorded_by": str(principal.id),
        "signed_on": (data.signed_on or date.today()).isoformat(),
    }
    service.sign_contract(db, contract, signed_by_name=data.signed_by_name, proof=proof, user_id=principal.id)
    db.commit()
    return jsonable(serialize(contract))


class StartStudiesIn(BaseModel):
    name: str | None = Field(default=None, max_length=250)
    manager_id: uuid.UUID | None = None
    invite_client_email: EmailStr | None = None


@router.post("/opportunities/{opportunity_id}/start-studies", status_code=201)
def start_studies(
    opportunity_id: uuid.UUID,
    data: StartStudiesIn,
    principal: Principal = Depends(require("crm:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Démarrer les études : projet au statut « Étude » et espace client ouvert, avant tout devis de travaux (passation
    du commercial au chef de projet désigné)."""
    opp = db.get(Opportunity, opportunity_id)
    if opp is None or opp.deleted_at is not None:
        raise NotFound("Opportunité introuvable")
    project = service.start_studies(
        db,
        opp,
        user_id=principal.id,
        name=data.name,
        manager_id=data.manager_id,
        auto_invite=not data.invite_client_email,
    )
    invitation_id = None
    if data.invite_client_email:
        from app.modules.identity.models import User
        from app.modules.identity.service import invite_user

        contact = db.get(Contact, opp.contact_id) if opp.contact_id else None
        invitation, _ = invite_user(
            db,
            inviter=db.get(User, principal.id),
            email=data.invite_client_email,
            first_name=contact.first_name if contact else None,
            last_name=contact.last_name if contact else None,
            role_codes=["CLIENT"],
            organization_id=opp.organization_id,
            project_ids=[project.id],
            message="Votre espace client GLOBUS est prêt : suivez et validez les études de votre projet.",
            channels=["email", "whatsapp"] if contact and (contact.whatsapp or contact.phone) else ["email"],
            phone=(contact.whatsapp or contact.phone) if contact else None,
        )
        invitation_id = invitation.id
    db.commit()
    return {"project_id": project.id, "project_code": project.code, "invitation_id": invitation_id}


class ProjectFromContractIn(BaseModel):
    name: str | None = Field(default=None, max_length=250)
    manager_id: uuid.UUID | None = None
    client_user_ids: list[uuid.UUID] = Field(default_factory=list)
    invite_client_email: EmailStr | None = None


@router.post("/contracts/{contract_id}/project", status_code=201)
def project_from_contract(
    contract_id: uuid.UUID,
    data: ProjectFromContractIn,
    principal: Principal = Depends(require("crm:contracts")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    principal.require("projects:write")
    contract = db.get(Contract, contract_id)
    if contract is None:
        raise NotFound("Contrat introuvable")
    project = service.project_from_contract(
        db,
        contract,
        user_id=principal.id,
        name=data.name,
        manager_id=data.manager_id,
        client_user_ids=data.client_user_ids,
        auto_invite=not data.invite_client_email,
    )
    invitation_id = None
    if data.invite_client_email:
        from app.modules.identity.models import User
        from app.modules.identity.service import invite_user

        inviter = db.get(User, principal.id)
        contact = db.get(Contact, contract.contact_id) if contract.contact_id else None
        invitation, _ = invite_user(
            db,
            inviter=inviter,
            email=data.invite_client_email,
            first_name=contact.first_name if contact else None,
            last_name=contact.last_name if contact else None,
            role_codes=["CLIENT"],
            organization_id=contract.organization_id,
            project_ids=[project.id],
            message="Votre espace client GLOBUS est prêt : suivez votre projet en temps réel.",
            channels=["email", "whatsapp"] if contact and (contact.whatsapp or contact.phone) else ["email"],
            phone=(contact.whatsapp or contact.phone) if contact else None,
        )
        invitation_id = invitation.id
    db.commit()
    return {"project_id": project.id, "project_code": project.code, "invitation_id": invitation_id}


# ============================================================================ devis instantané par IA (A2)
@public.post(
    "/instant-estimate",
    status_code=201,
    dependencies=[Depends(rate_limit("instant_estimate", "6/hour"))],
)
async def instant_estimate(
    request: Request,
    first_name: str = Form(..., min_length=1, max_length=120),
    last_name: str | None = Form(None, max_length=120),
    email: EmailStr | None = Form(None),
    phone: str | None = Form(None, max_length=40),
    whatsapp: str | None = Form(None, max_length=40),
    city: str | None = Form(None, max_length=120),
    country: str | None = Form(None, max_length=80),
    consent_contact: bool = Form(False),
    consent_whatsapp: bool = Form(False),
    universe: str | None = Form(None, pattern="^(HOME|BUSINESS|PREMIUM|DIASPORA|ENGINEERING)$"),
    project_type: str | None = Form(None, max_length=60),
    surface_m2: float | None = Form(None, ge=0, le=1_000_000),
    levels: int | None = Form(None, ge=0, le=100),
    rooms: int | None = Form(None, ge=0, le=500),
    standing: str | None = Form(None, pattern="^(standard|confort|premium)$"),
    location: str | None = Form(None, max_length=250),
    description: str | None = Form(None, max_length=5000),
    transcript: str | None = Form(None, max_length=5000),
    referral_code: str | None = Form(None, pattern=r"^[A-Za-z0-9]{4,20}$"),
    rendered_at: int | None = Form(None),
    website: str | None = Form(None, max_length=200),
    images: list[UploadFile] = File(default=[]),
    audio: UploadFile | None = File(None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Photo du terrain, croquis et / ou note vocale → fourchette indicative immédiate, validée ensuite par un
    ingénieur (aucun prix inventé : barèmes internes uniquement)."""
    from app.modules.crm import instant

    if _anti_bot(website, rendered_at, 5):
        return {"status": "received"}
    if not (description or transcript or images or audio or surface_m2):
        raise BusinessRuleError("Ajoutez au moins une photo, un croquis, une note vocale ou une description")
    files = []
    for upload in images[: instant.MAX_IMAGES + 1]:
        data = await upload.read(instant.MAX_IMAGE_MB * 1024 * 1024 + 1)
        files.append((upload.filename or "image", data, upload.content_type or ""))
    voice = None
    if audio is not None and audio.filename:
        voice = (audio.filename, await audio.read(instant.MAX_AUDIO_MB * 1024 * 1024 + 1), audio.content_type or "")
    result = instant.submit(
        db,
        contact={
            "first_name": first_name,
            "last_name": last_name,
            "email": str(email) if email else None,
            "phone": phone,
            "whatsapp": whatsapp,
            "city": city,
            "country": country,
        },
        consents={"contact": consent_contact, "whatsapp": consent_whatsapp},
        declared={
            "universe": universe,
            "project_type": project_type,
            "surface_m2": surface_m2,
            "levels": levels,
            "rooms": rooms,
            "standing": standing,
            "location": location,
        },
        description=description or "",
        images=files,
        audio=voice,
        transcript=transcript,
        ip=client_ip(request.scope),
        user_agent=request.headers.get("user-agent"),
        referral_code=referral_code,
    )
    db.commit()
    return result


@router.get("/leads/{lead_id}/instant-estimate")
def instant_estimate_detail(
    lead_id: uuid.UUID, principal: Principal = Depends(require("crm:read")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    from app.modules.crm import instant

    return instant.detail(db, service.get_lead(db, lead_id), user_id=principal.id)


class EstimateValidateIn(BaseModel):
    min: Decimal = Field(gt=0)
    max: Decimal = Field(gt=0)
    note: str | None = Field(default=None, max_length=2000)
    notify: bool = True


@router.post("/leads/{lead_id}/instant-estimate/validate")
def instant_estimate_validate(
    lead_id: uuid.UUID,
    data: EstimateValidateIn,
    principal: Principal = Depends(require("crm:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Validation (ou ajustement) de la fourchette par un ingénieur ; le prospect est informé."""
    from app.modules.crm import instant

    result = instant.validate(
        db,
        service.get_lead(db, lead_id),
        user=principal.user,
        minimum=data.min,
        maximum=data.max,
        note=data.note,
        notify=data.notify,
    )
    db.commit()
    return result
