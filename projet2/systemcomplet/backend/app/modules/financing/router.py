"""API Financement intégré (I5) : simulateur public, dossiers du client, portail d'instruction des partenaires,
gestion des partenaires par la finance."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.database import get_db
from app.core.errors import BusinessRuleError, NotFound
from app.core.middleware import client_ip
from app.core.ratelimit import rate_limit
from app.modules.financing import service
from app.modules.financing.models import FinancingApplication, FinancingPartner, FinancingShare

router = APIRouter(tags=["Financement"])
public = APIRouter(prefix="/public/financing", tags=["Financement (public)"])


class SimulateIn(BaseModel):
    amount: Decimal = Field(gt=0, le=Decimal("100000000000"))
    down_payment: Decimal = Field(default=Decimal("0"), ge=0)
    duration_months: int = Field(default=120, ge=6, le=360)
    monthly_income: Decimal | None = Field(default=None, ge=0)
    other_monthly_debts: Decimal = Field(default=Decimal("0"), ge=0)
    rate: Decimal | None = Field(default=None, ge=0, le=30, description="Taux annuel hypothétique (%)")


@public.get("/partners")
def partners_public(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    rows = db.execute(
        select(FinancingPartner).where(FinancingPartner.active.is_(True)).order_by(FinancingPartner.sort_order)
    ).scalars()
    return [service.partner_out(p, internal=False) for p in rows]


@public.post("/simulate", dependencies=[Depends(rate_limit("financing", "60/hour"))])
def simulate_public(data: SimulateIn, db: Session = Depends(get_db)) -> dict[str, Any]:
    if data.down_payment >= data.amount:
        raise BusinessRuleError("L'apport couvre déjà le projet")
    return service.simulate(db, **data.model_dump())


# ---------------------------------------------------------------------------- client
def _application(db: Session, access: Access, application_id: uuid.UUID) -> FinancingApplication:
    access.require("client:portal")
    application = db.get(FinancingApplication, application_id)
    if application is None or application.user_id != access.p.id:
        raise NotFound("Dossier introuvable")
    return application


@router.get("/financing/program")
def program(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """Ouverture du module « Financement » dans l'espace client et taux de référence du simulateur."""
    access.require("finance:read")
    return {"client_portal": service.portal_enabled(db), "reference_rate": str(service.reference_rate(db))}


class ProgramIn(BaseModel):
    client_portal: bool | None = None
    reference_rate: Decimal | None = Field(default=None, ge=0, le=30)


@router.put("/financing/program")
def update_program(
    data: ProgramIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("settings:write")
    values = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    out = service.update_program(db, values, actor_id=access.p.id)
    db.commit()
    return out


@public.get("/status")
def public_status(db: Session = Depends(get_db)) -> dict[str, bool]:
    """Le simulateur public est toujours disponible ; le dossier en ligne dépend de l'ouverture du module client."""
    return {"client_portal": service.portal_enabled(db)}


@router.get("/client/financing")
def my_applications(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    access.require("client:portal")
    rows = db.execute(
        select(FinancingApplication)
        .where(FinancingApplication.user_id == access.p.id)
        .order_by(FinancingApplication.created_at.desc())
    ).scalars()
    return [service.application_out(db, a) for a in rows]


class ApplicationIn(SimulateIn):
    project_id: uuid.UUID | None = None


@router.post("/client/financing/applications", status_code=201)
def create_application(
    data: ApplicationIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.projects.models import Project

    access.require("client:portal")
    if not service.portal_enabled(db):
        raise BusinessRuleError("Le financement en ligne n'est pas ouvert", code="FINANCING_DISABLED")
    project = None
    if data.project_id:
        access.require_project(data.project_id)
        project = db.get(Project, data.project_id)
    values = data.model_dump(exclude={"project_id"})
    values["monthly_income"] = values.get("monthly_income") or Decimal("0")
    application = service.create(db, user=access.p.user, project=project, values=values)
    db.commit()
    return service.application_out(db, application)


@router.post("/client/financing/applications/{application_id}/documents")
async def upload_document(
    application_id: uuid.UUID,
    kind: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    application = _application(db, access, application_id)
    service.add_document(db, application, kind=kind, filename=file.filename or "piece.pdf", data=await file.read())
    db.commit()
    return service.application_out(db, application)


class SubmitIn(BaseModel):
    partner_ids: list[uuid.UUID] = Field(min_length=1, max_length=10)
    consent: bool = False


@router.post("/client/financing/applications/{application_id}/submit")
def submit_application(
    application_id: uuid.UUID,
    data: SubmitIn,
    request: Request,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    """Transmission aux établissements choisis (accord explicite, tracé) — liens d'instruction nominatifs."""
    application = _application(db, access, application_id)
    service.submit(
        db,
        application,
        partner_ids=data.partner_ids,
        consent=data.consent,
        ip=client_ip(request.scope),
        user_agent=request.headers.get("user-agent"),
    )
    db.commit()
    return service.application_out(db, application)


@router.post("/client/financing/applications/{application_id}/withdraw")
def withdraw_application(
    application_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    application = _application(db, access, application_id)
    service.withdraw(db, application)
    db.commit()
    return service.application_out(db, application)


@router.post("/client/financing/applications/{application_id}/offers/{share_id}/otp")
def offer_otp(
    application_id: uuid.UUID,
    share_id: uuid.UUID,
    channel: str = "email",
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    from app.modules.identity.service import issue_otp

    application = _application(db, access, application_id)
    share = db.get(FinancingShare, share_id)
    if share is None or share.application_id != application.id or share.status != "offer":
        raise NotFound("Offre introuvable")
    result = issue_otp(
        db,
        access.p.user,
        purpose="financing_offer",
        channel=channel if channel in ("email", "sms", "whatsapp") else "email",
        payload={"share_id": str(share.id), "label": f"Acceptation de l'offre de financement {application.number}"},
    )
    db.commit()
    return result


class AcceptIn(BaseModel):
    otp_token: str = Field(min_length=10, max_length=200)
    code: str = Field(min_length=4, max_length=10)


@router.post("/client/financing/applications/{application_id}/offers/{share_id}/accept")
def accept_offer(
    application_id: uuid.UUID,
    share_id: uuid.UUID,
    data: AcceptIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    from app.modules.identity.service import verify_otp

    application = _application(db, access, application_id)
    share = db.get(FinancingShare, share_id)
    if share is None:
        raise NotFound("Offre introuvable")
    proof = verify_otp(db, access.p.user, purpose="financing_offer", otp_token=data.otp_token, code=data.code)
    if proof["payload"].get("share_id") != str(share.id):
        raise BusinessRuleError("Code émis pour une autre offre", code="OTP_INVALID")
    service.accept(db, application, share, proof={"verified_at": proof["verified_at"], "channel": proof["channel"]})
    db.commit()
    return service.application_out(db, application)


# ---------------------------------------------------------------------------- portail partenaire (lien nominatif)
@public.get("/dossiers/{token}", dependencies=[Depends(rate_limit("financing_portal", "60/minute"))])
def partner_dossier(token: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    share = service.resolve_share(db, token)
    data = service.share_view(db, share)
    db.commit()
    return data


class RespondIn(BaseModel):
    status: Literal["in_review", "offer", "declined"]
    responder_name: str = Field(min_length=2, max_length=150)
    rate: Decimal | None = Field(default=None, ge=0, le=100)
    amount: Decimal | None = Field(default=None, gt=0)
    duration_months: int | None = Field(default=None, ge=6, le=360)
    monthly_payment: Decimal | None = Field(default=None, gt=0)
    conditions: str | None = Field(default=None, max_length=3000)
    valid_until: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


@public.post("/dossiers/{token}/respond", dependencies=[Depends(rate_limit("financing_portal", "30/minute"))])
def partner_respond(token: str, data: RespondIn, db: Session = Depends(get_db)) -> dict[str, Any]:
    share = service.resolve_share(db, token)
    offer = (
        {k: v for k, v in data.model_dump(exclude={"status", "responder_name"}).items() if v is not None}
        if data.status == "offer"
        else None
    )
    if data.status == "offer" and not (data.rate is not None and data.amount and data.duration_months):
        raise BusinessRuleError("Taux, montant et durée requis pour une offre")
    service.respond(db, share, status=data.status, offer=offer, responder=data.responder_name)
    db.commit()
    return {"status": share.status}


# ---------------------------------------------------------------------------- équipe
@router.get("/financing/partners")
def partners(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    access.require("finance:read")
    rows = db.execute(select(FinancingPartner).order_by(FinancingPartner.sort_order, FinancingPartner.name)).scalars()
    return [service.partner_out(p, internal=True) for p in rows]


class PartnerIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    kind: Literal["bank", "microfinance", "diaspora"] = "bank"
    description: str | None = Field(default=None, max_length=2000)
    rate_min: Decimal = Field(ge=0, le=100)
    rate_max: Decimal = Field(ge=0, le=100)
    max_years: int = Field(default=15, ge=1, le=30)
    min_down_payment_pct: Decimal = Field(default=Decimal("20"), ge=0, le=100)
    max_debt_ratio_pct: Decimal = Field(default=Decimal("33"), ge=1, le=100)
    fees_pct: Decimal = Field(default=Decimal("1"), ge=0, le=20)
    requirements: list[str] = Field(default_factory=list, max_length=20)
    contact_name: str | None = Field(default=None, max_length=150)
    contact_email: str | None = Field(default=None, max_length=254)
    active: bool = True
    sort_order: int = 0


@router.post("/financing/partners", status_code=201)
def create_partner(
    data: PartnerIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("finance:write")
    if data.rate_max < data.rate_min:
        raise BusinessRuleError("Taux maximal inférieur au taux minimal")
    partner = FinancingPartner(**data.model_dump())
    db.add(partner)
    db.flush()
    audit.record(
        db,
        family="business",
        module="financing",
        action="PARTNER_CREATE",
        resource_type="financing_partner",
        resource_id=partner.id,
    )
    db.commit()
    return service.partner_out(partner, internal=True)


@router.patch("/financing/partners/{partner_id}")
def update_partner(
    partner_id: uuid.UUID, data: dict[str, Any], db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("finance:write")
    partner = db.get(FinancingPartner, partner_id)
    if partner is None:
        raise NotFound("Partenaire introuvable")
    values = PartnerIn.model_validate({**service.partner_out(partner, internal=True), **data}).model_dump()
    for key, value in values.items():
        setattr(partner, key, value)
    db.commit()
    return service.partner_out(partner, internal=True)


@router.get("/financing/applications")
def applications(
    status: str | None = None, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require("finance:read")
    stmt = select(FinancingApplication)
    if status:
        stmt = stmt.where(FinancingApplication.status == status)
    rows = db.execute(stmt.order_by(FinancingApplication.created_at.desc()).limit(300)).scalars()
    return [service.application_out(db, a, internal=True) for a in rows]
