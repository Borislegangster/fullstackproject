"""API SAV (§18) : tickets (client et ERP), SLA, diagnostic, garanties, interventions avec preuves, validation et
satisfaction client, statistiques. Le client ne voit que les tickets de son organisation et les messages publics."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.access import Access, get_access
from app.core.crud import serialize
from app.core.database import get_db
from app.core.downloads import file_response
from app.core.errors import BusinessRuleError, Forbidden, NotFound
from app.core.files import store_private, validate_upload
from app.core.pagination import PageParams, paginate
from app.core.utils import clean_phone, jsonable, utcnow
from app.modules.projects.models import Project
from app.modules.support import service
from app.modules.support.models import Intervention, Ticket, TicketAttachment, TicketMessage, WarrantyClaim
from app.modules.system.models import StoredFile

router = APIRouter(tags=["SAV"])


def _staff(access: Access) -> bool:
    return access.has("support:write")


def _ticket(db: Session, access: Access, ticket_id: uuid.UUID) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise NotFound("Ticket introuvable")
    assigned = (
        ticket.assigned_to_id == access.p.id
        or db.execute(
            select(Intervention.id).where(
                Intervention.ticket_id == ticket.id, Intervention.technician_id == access.p.id
            )
        ).first()
        is not None
    )
    if assigned:
        return ticket
    if _staff(access) or access.has("support:read"):
        if ticket.project_id:
            access.require_project(ticket.project_id)
        return ticket
    if access.p.is_client and (
        ticket.requester_id == access.p.id
        or (ticket.organization_id and ticket.organization_id == access.p.organization_id)
    ):
        return ticket
    raise NotFound("Ticket introuvable")


def _ticket_out(db: Session, ticket: Ticket, access: Access, *, detail: bool = False) -> dict[str, Any]:
    data = serialize(ticket)
    staff = _staff(access) or access.has("support:read")
    if not staff:
        for key in ("ai_draft_reply", "total_cost", "assigned_to_id", "diagnosis"):
            data.pop(key, None)
    if detail:
        stmt = select(TicketMessage).where(TicketMessage.ticket_id == ticket.id)
        if not staff:
            stmt = stmt.where(TicketMessage.internal.is_(False))
        data["messages"] = [serialize(m) for m in db.execute(stmt.order_by(TicketMessage.created_at)).scalars()]
        data["attachments"] = [
            serialize(a)
            for a in db.execute(
                select(TicketAttachment)
                .where(TicketAttachment.ticket_id == ticket.id)
                .order_by(TicketAttachment.created_at)
            ).scalars()
        ]
        data["interventions"] = [
            serialize(i)
            for i in db.execute(
                select(Intervention).where(Intervention.ticket_id == ticket.id).order_by(Intervention.created_at)
            ).scalars()
        ]
        claim = db.execute(select(WarrantyClaim).where(WarrantyClaim.ticket_id == ticket.id)).scalar_one_or_none()
        data["warranty_claim"] = (
            serialize(claim)
            if claim and staff
            else ({"decision": claim.decision, "reason": claim.reason} if claim else None)
        )
    return jsonable(data)


class TicketIn(BaseModel):
    project_id: uuid.UUID | None = None
    category: str = Field(
        default="autre", pattern="^(etancheite|plomberie|electricite|fissure|menuiserie|peinture|equipement|autre)$"
    )
    priority: str = Field(default="normal", pattern="^(low|normal|high|urgent)$")
    subject: str = Field(min_length=3, max_length=250)
    description: str | None = Field(default=None, max_length=8000)
    location: str | None = Field(default=None, max_length=250)
    zone_id: uuid.UUID | None = None
    # Saisie par le SAV pour le compte d'un client (appel, e-mail, WhatsApp) — ignoré pour un client connecté.
    channel: str | None = Field(default=None, pattern="^(phone|email|whatsapp|website)$")
    organization_id: uuid.UUID | None = None
    requester_name: str | None = Field(default=None, max_length=200)
    requester_email: EmailStr | None = None
    requester_phone: str | None = Field(default=None, max_length=40)


_ON_BEHALF = ("channel", "organization_id", "requester_name", "requester_email", "requester_phone")


@router.post("/support/tickets", status_code=201)
def create_ticket(
    data: TicketIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    if not (access.p.has_any("client:portal", "support:write")):
        raise Forbidden("Création de ticket non autorisée", code="PERMISSION_DENIED")
    if data.project_id:
        access.require_project(data.project_id)
    values = data.model_dump()
    extra = {k: values.pop(k) for k in _ON_BEHALF}
    requester, organization_id = access.p.user, None
    if not access.p.is_client and (extra["requester_name"] or extra["organization_id"]):
        # Ticket ouvert pour un client : c'est lui le demandeur (et son organisation voit le ticket dans son espace).
        requester = None
        values.update(
            requester_name=extra["requester_name"],
            requester_email=str(extra["requester_email"]).lower() if extra["requester_email"] else None,
            requester_phone=clean_phone(extra["requester_phone"]) if extra["requester_phone"] else None,
        )
        organization_id = extra["organization_id"]
        if organization_id is None and data.project_id:
            project = db.get(Project, data.project_id)
            organization_id = project.client_organization_id if project else None
    channel = "portal" if access.p.is_client else (extra["channel"] or "phone")
    ticket = service.create_ticket(db, data=values, requester=requester, channel=channel)
    if organization_id is not None:
        ticket.organization_id = organization_id
    db.commit()
    return _ticket_out(db, ticket, access, detail=True)


@router.get("/support/tickets")
def list_tickets(
    params: PageParams = Depends(),
    status: str | None = None,
    project_id: uuid.UUID | None = None,
    category: str | None = None,
    priority: str | None = None,
    mine: bool = False,
    breached: bool | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    stmt = select(Ticket)
    if _staff(access) or access.has("support:read"):
        stmt = access.filter_by_project(stmt, Ticket.project_id)
        if mine:
            stmt = stmt.where(Ticket.assigned_to_id == access.p.id)
    elif access.p.is_client:
        stmt = stmt.where((Ticket.requester_id == access.p.id) | (Ticket.organization_id == access.p.organization_id))
    else:
        raise Forbidden("Accès SAV refusé", code="PERMISSION_DENIED")
    for col, value in (
        (Ticket.status, status),
        (Ticket.project_id, project_id),
        (Ticket.category, category),
        (Ticket.priority, priority),
    ):
        if value:
            stmt = stmt.where(col == value)
    if breached is not None:
        stmt = stmt.where((Ticket.response_breached | Ticket.resolution_breached) == breached)
    return paginate(
        db,
        stmt,
        params,
        default_sort=Ticket.created_at.desc(),
        search_columns=[Ticket.number, Ticket.subject],
        transform=lambda t: _ticket_out(db, t, access),
    )


@router.get("/support/tickets/{ticket_id}")
def get_ticket(
    ticket_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    return _ticket_out(db, _ticket(db, access, ticket_id), access, detail=True)


class AssignIn(BaseModel):
    assignee_id: uuid.UUID


@router.post("/support/tickets/{ticket_id}/assign")
def assign(
    ticket_id: uuid.UUID, data: AssignIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("support:write")
    ticket = service.assign(db, _ticket(db, access, ticket_id), assignee_id=data.assignee_id, user_id=access.p.id)
    db.commit()
    return _ticket_out(db, ticket, access, detail=True)


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=8000)
    internal: bool = False


@router.post("/support/tickets/{ticket_id}/messages", status_code=201)
def message(
    ticket_id: uuid.UUID, data: MessageIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    ticket = _ticket(db, access, ticket_id)
    service.add_message(
        db, ticket, author=access.p.user, body=data.body, internal=data.internal, from_staff=_staff(access)
    )
    db.commit()
    return _ticket_out(db, ticket, access, detail=True)


@router.post("/support/tickets/{ticket_id}/attachments", status_code=201)
async def attach(
    ticket_id: uuid.UUID,
    kind: str = Form("photo", pattern="^(photo|document|before|after)$"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    ticket = _ticket(db, access, ticket_id)
    upload = validate_upload(file.filename or "photo", await file.read(), category="media")
    stored = store_private(db, upload, purpose="support", classification="internal", uploaded_by_id=access.p.id)
    db.add(TicketAttachment(ticket_id=ticket.id, file_id=stored.id, kind=kind, uploaded_by_id=access.p.id))
    db.commit()
    return jsonable({"file_id": stored.id, "kind": kind})


@router.get("/support/attachments/{attachment_id}")
def attachment(
    attachment_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    row = db.get(TicketAttachment, attachment_id)
    if row is None:
        raise NotFound("Pièce introuvable")
    _ticket(db, access, row.ticket_id)
    return file_response(db.get(StoredFile, row.file_id))


class DiagnosisIn(BaseModel):
    diagnosis: str = Field(min_length=5, max_length=8000)


@router.post("/support/tickets/{ticket_id}/diagnosis")
def diagnosis(
    ticket_id: uuid.UUID, data: DiagnosisIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("support:write")
    ticket = service.diagnose(db, _ticket(db, access, ticket_id), diagnosis=data.diagnosis, user_id=access.p.id)
    db.commit()
    return _ticket_out(db, ticket, access, detail=True)


class WarrantyIn(BaseModel):
    decision: str = Field(pattern="^(covered|not_covered|partial)$")
    reason: str = Field(min_length=5, max_length=4000)
    responsible_party: str | None = Field(default=None, pattern="^(globus|sous_traitant|fournisseur|client)$")
    responsible_party_id: uuid.UUID | None = None


@router.post("/support/tickets/{ticket_id}/warranty")
def warranty(
    ticket_id: uuid.UUID, data: WarrantyIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("support:write")
    ticket = _ticket(db, access, ticket_id)
    service.decide_warranty(
        db,
        ticket,
        decision=data.decision,
        reason=data.reason,
        responsible_party=data.responsible_party,
        responsible_party_id=data.responsible_party_id,
        user_id=access.p.id,
    )
    db.commit()
    return _ticket_out(db, ticket, access, detail=True)


class InterventionIn(BaseModel):
    technician_id: uuid.UUID | None = None
    scheduled_at: datetime


@router.post("/support/tickets/{ticket_id}/interventions", status_code=201)
def schedule(
    ticket_id: uuid.UUID, data: InterventionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("support:write")
    ticket = _ticket(db, access, ticket_id)
    service.schedule_intervention(
        db, ticket, technician_id=data.technician_id, scheduled_at=data.scheduled_at, user_id=access.p.id
    )
    db.commit()
    return _ticket_out(db, ticket, access, detail=True)


def _intervention(db: Session, access: Access, intervention_id: uuid.UUID) -> tuple[Intervention, Ticket]:
    intervention = db.get(Intervention, intervention_id)
    if intervention is None:
        raise NotFound("Intervention introuvable")
    ticket = _ticket(db, access, intervention.ticket_id)
    if not _staff(access) and intervention.technician_id != access.p.id:
        raise Forbidden("Intervention d'un autre technicien")
    return intervention, ticket


@router.post("/support/interventions/{intervention_id}/start")
def start(
    intervention_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    intervention, ticket = _intervention(db, access, intervention_id)
    service.start_intervention(db, intervention, ticket)
    db.commit()
    return jsonable(serialize(intervention))


class FinishIn(BaseModel):
    report: str = Field(min_length=5, max_length=8000)
    time_spent_hours: Decimal = Field(default=Decimal("0"), ge=0, le=500)
    materials: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    labor_cost: Decimal = Field(default=Decimal("0"), ge=0)
    material_cost: Decimal = Field(default=Decimal("0"), ge=0)
    proof_file_ids: list[uuid.UUID] = Field(default_factory=list, max_length=30)


@router.post("/support/interventions/{intervention_id}/finish")
def finish(
    intervention_id: uuid.UUID, data: FinishIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    intervention, ticket = _intervention(db, access, intervention_id)
    for fid in data.proof_file_ids:
        attached = db.execute(
            select(TicketAttachment.id).where(TicketAttachment.ticket_id == ticket.id, TicketAttachment.file_id == fid)
        ).first()
        if not attached:
            raise BusinessRuleError("Preuve non rattachée au ticket")
    service.finish_intervention(
        db,
        intervention,
        ticket,
        report=data.report,
        hours=data.time_spent_hours,
        materials=jsonable(data.materials),
        labor_cost=data.labor_cost,
        material_cost=data.material_cost,
        proof_file_ids=[str(f) for f in data.proof_file_ids],
        user_id=access.p.id,
    )
    db.commit()
    return _ticket_out(db, ticket, access, detail=True)


class ValidateIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=4000)


@router.post("/support/tickets/{ticket_id}/validate")
def validate(
    ticket_id: uuid.UUID, data: ValidateIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Validation de l'intervention et satisfaction par le client."""
    ticket = _ticket(db, access, ticket_id)
    if not access.p.is_client and not _staff(access):
        raise Forbidden("Validation réservée au client")
    service.client_validate(db, ticket, rating=data.rating, comment=data.comment, user_id=access.p.id)
    db.commit()
    return _ticket_out(db, ticket, access, detail=True)


class ReopenIn(BaseModel):
    reason: str = Field(min_length=5, max_length=4000)


@router.post("/support/tickets/{ticket_id}/reopen")
def reopen(
    ticket_id: uuid.UUID, data: ReopenIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    ticket = service.reopen(db, _ticket(db, access, ticket_id), reason=data.reason, user_id=access.p.id)
    db.commit()
    return _ticket_out(db, ticket, access, detail=True)


@router.post("/support/tickets/{ticket_id}/ai-draft")
def ai_draft(
    ticket_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Brouillon de réponse assisté par IA (relu par un humain avant envoi)."""
    access.require("support:write", "ai:use")
    ticket = _ticket(db, access, ticket_id)
    from app.modules.ai.service import support_draft

    ticket.ai_draft_reply = support_draft(db, ticket, user_id=access.p.id)
    db.commit()
    return {"draft": ticket.ai_draft_reply}


@router.get("/support/statistics")
def statistics(days: int = 90, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("support:read")
    return jsonable(service.statistics(db, since=utcnow() - timedelta(days=max(1, min(days, 730)))))
