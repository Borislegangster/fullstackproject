"""CRM API — Lead management + atomic conversion to Project."""
import secrets
import string
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from fastapi import status as http_status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.models import User
from app.auth.service import (
    require_admin,
    require_staff,
    hash_password,
    create_invitation_token,
    get_current_user,
)
from app.models.erp import (
    Lead,
    Project,
    ProjectPhase,
    ProjectTemplate,
    GEDFolder,
    Document,
    Conversation,
    ConversationParticipant,
    Message,
    Notification,
)
from app.schemas.crm import LeadCreate, LeadUpdate, LeadOut, ConvertLeadRequest
from app.services.activity_service import log_activity
from app.services.notification_service import create_notification
from app.services.email_service import send_invitation_email
from app.services.lead_service import create_lead as create_lead_record
from app.services.contract_service import generate_contract_pdf
from app.services.storage_service import store_upload
from app.rate_limit import limiter
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crm", tags=["CRM"])


from app.utils.time import utcnow_naive as _now


def _generate_code(prefix: str, seq: int) -> str:
    """Generate a sequential code like PRJ-2026-001."""
    year = _now().strftime("%Y")
    return f"{prefix}-{year}-{seq:03d}"


def _generate_temp_password(length: int = 12) -> str:
    """Generate a secure temporary password."""
    chars = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(chars) for _ in range(length))


# ── CRUD Leads ──────────────────────────────────────────────

@router.post("/leads", response_model=LeadOut)
@limiter.limit("10/minute")
async def create_lead(
    request: Request,
    data: LeadCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new lead. Can be called from ContactPage (public) or admin.
    Rate-limited to 10/min per IP to prevent spam.

    Delegates to the shared `lead_service.create_lead` helper — the single source
    of truth also used by the public `/contact/submit` endpoint.
    """
    return await create_lead_record(db, **data.model_dump())


@router.get("/leads", response_model=list[LeadOut])
async def list_leads(
    status_filter: Optional[str] = None,
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """List all leads, optionally filtered by status."""
    query = select(Lead).where(Lead.deleted_at.is_(None)).order_by(Lead.created_at.desc())
    if status_filter:
        query = query.where(Lead.status == status_filter)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/leads/{lead_id}", response_model=LeadOut)
async def get_lead(
    lead_id: str,
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Get a single lead by ID."""
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.deleted_at.is_(None))
    )
    lead = result.scalars().first()
    if not lead:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Lead introuvable")
    return lead


@router.patch("/leads/{lead_id}", response_model=LeadOut)
async def update_lead(
    lead_id: str,
    data: LeadUpdate,
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Update lead fields (status, pipeline_notes, etc.)."""
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.deleted_at.is_(None))
    )
    lead = result.scalars().first()
    if not lead:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Lead introuvable")

    old_status = lead.status
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(lead, key, value)
    lead.updated_at = _now()
    await db.commit()
    await db.refresh(lead)

    # Log status change
    if "status" in update_data and update_data["status"] != old_status:
        await log_activity(
            db, admin.id, "LEAD_STATUS_CHANGED",
            entity_type="lead", entity_id=lead.id,
            old_value={"status": old_status},
            new_value={"status": lead.status},
        )
        await db.commit()

    return lead


@router.delete("/leads/{lead_id}")
async def delete_lead(
    lead_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a lead."""
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.deleted_at.is_(None))
    )
    lead = result.scalars().first()
    if not lead:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Lead introuvable")
    lead.deleted_at = _now()
    await db.commit()
    return {"detail": "Lead supprimé"}


# ── ATOMIC CONVERSION: Lead → Client + User + Project + GED + Messaging + Email ──

@router.post("/leads/{lead_id}/convert")
async def convert_lead_to_project(
    lead_id: str,
    data: ConvertLeadRequest,
    bg: BackgroundTasks,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    IDEMPOTENT ATOMIC TRANSACTION:
    Lead GAGNE → Create Client User + Project + GED Folders + Welcome Message + Invitation Email

    If already converted, returns the existing project without creating duplicates.
    """
    # 1. Get the lead
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.deleted_at.is_(None))
    )
    lead = result.scalars().first()
    if not lead:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Lead introuvable")

    # IDEMPOTENCE CHECK: If already converted, return existing project
    if lead.converted_project_id:
        return {
            "detail": "Lead déjà converti",
            "project_id": lead.converted_project_id,
            "already_converted": True,
        }

    # 2. Create User (CLIENT)
    temp_password = _generate_temp_password()
    invitation_token = create_invitation_token(lead.email)

    # Check if user already exists (edge case)
    existing_user = await db.execute(
        select(User).where(User.email == lead.email, User.deleted_at.is_(None))
    )
    user = existing_user.scalars().first()
    if not user:
        user = User(
            email=lead.email,
            password_hash=hash_password(temp_password),
            first_name=lead.first_name,
            last_name=lead.last_name,
            phone=lead.phone,
            role="CLIENT",
            is_active=False,
            must_change_password=True,
            invitation_token=invitation_token,
            invitation_sent_at=_now(),
        )
        db.add(user)
        await db.flush()  # Get user.id

    # 3. Generate project code
    count_result = await db.execute(select(func.count(Project.id)))
    project_count = count_result.scalar() or 0
    project_code = _generate_code("PRJ", project_count + 1)

    # 4. Create Project
    project = Project(
        code=project_code,
        name=data.project_name,
        project_type=data.project_type or lead.project_type,
        location=lead.location,
        client_id=user.id,
        chef_projet_id=data.chef_projet_id,
        lead_id=lead.id,
        budget_initial=lead.quote_amount or 0.0,
        status="EN_COURS",
    )
    db.add(project)
    await db.flush()

    # 5. Apply template phases if provided
    template_phases: list = []
    if data.template_id:
        tmpl_result = await db.execute(
            select(ProjectTemplate).where(ProjectTemplate.id == data.template_id)
        )
        template = tmpl_result.scalars().first()
        if template and template.phases:
            template_phases = template.phases
            for idx, phase_data in enumerate(template.phases):
                phase = ProjectPhase(
                    project_id=project.id,
                    name=phase_data["name"],
                    duration_days=phase_data.get("duration_days", 0),
                    sort_order=idx,
                )
                db.add(phase)

    # 6. Create GED folders (capture them to file the auto contract under "Contrats")
    folders: dict[str, GEDFolder] = {}
    for folder_name in ["Contrats", "Plans", "Photos chantier"]:
        f = GEDFolder(project_id=project.id, name=folder_name)
        db.add(f)
        folders[folder_name] = f
    await db.flush()

    # 6b. Auto-generate a pre-filled contract PDF → GED "Contrats" (shared w/ client)
    try:
        pdf_bytes = generate_contract_pdf(
            client_name=f"{lead.first_name} {lead.last_name}".strip(),
            client_email=lead.email,
            client_phone=lead.phone or "",
            project_name=project.name,
            project_code=project_code,
            project_type=project.project_type or "",
            location=lead.location or "",
            budget=lead.quote_amount or 0,
            phases=template_phases,
        )
        url, size_str, storage_key = await store_upload(
            pdf_bytes, f"contrat-{project_code}.pdf", "application/pdf",
            prefix="contracts", public=False,
        )
        contract_doc = Document(
            project_id=project.id, folder_id=folders["Contrats"].id,
            name=f"Contrat {project_code}", file_url=url, storage_key=storage_key,
            file_size=size_str, mime_type="application/pdf", category="contrat",
            shared_with_client=True, uploaded_by=admin.id,
        )
        db.add(contract_doc)
        await db.flush()
        contract_doc.file_url = f"/api/v1/ged/documents/{contract_doc.id}/download"
    except Exception as e:
        logger.warning("Contract PDF generation failed for %s: %s", project_code, e)

    # 7. Create conversation + welcome message
    conv = Conversation(project_id=project.id, subject=f"Projet {project.name}")
    db.add(conv)
    await db.flush()

    # Add participants
    db.add(ConversationParticipant(conversation_id=conv.id, user_id=user.id))
    if data.chef_projet_id:
        db.add(ConversationParticipant(conversation_id=conv.id, user_id=data.chef_projet_id))
    db.add(ConversationParticipant(conversation_id=conv.id, user_id=admin.id))

    # Welcome message
    welcome = Message(
        conversation_id=conv.id,
        sender_id=admin.id,
        content=f"Bienvenue {user.first_name} ! Votre espace projet « {project.name} » est prêt. "
                f"N'hésitez pas à nous écrire ici pour toute question.",
        is_system=True,
    )
    db.add(welcome)

    # 8. Mark lead as converted
    lead.status = "GAGNE"
    lead.converted_project_id = project.id
    lead.converted_at = _now()

    # 9. Create notification for admin
    await create_notification(
        db, admin.id,
        title=f"Lead converti : {lead.first_name} {lead.last_name}",
        message=f"Projet {project_code} créé avec succès.",
        type="success",
        entity_type="project",
        entity_id=project.id,
    )

    # 10. Log activity
    await log_activity(
        db, admin.id, "LEAD_CONVERTED",
        entity_type="project", entity_id=project.id,
        new_value={"lead_id": lead.id, "project_code": project_code, "client_email": lead.email},
        description=f"Lead {lead.first_name} {lead.last_name} converti en projet {project_code}",
    )

    # COMMIT entire transaction
    await db.commit()

    # 11. Send invitation email (non-blocking — does not affect response time)
    bg.add_task(
        send_invitation_email,
        user.email,
        invitation_token,
        temp_password,
        user.first_name,
    )

    return {
        "detail": "Lead converti avec succès",
        "project_id": project.id,
        "project_code": project_code,
        "user_id": user.id,
        "already_converted": False,
    }


@router.post("/leads/{lead_id}/resend-invitation")
async def resend_invitation(
    lead_id: str,
    bg: BackgroundTasks,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Resend invitation email with a fresh token (if the original expired)."""
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.deleted_at.is_(None))
    )
    lead = result.scalars().first()
    if not lead or not lead.converted_project_id:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Lead non converti")

    # Find the user
    user_result = await db.execute(
        select(User).where(User.email == lead.email, User.deleted_at.is_(None))
    )
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Utilisateur introuvable")

    if user.is_active and not user.must_change_password:
        return {"detail": "L'utilisateur a déjà activé son compte"}

    # Generate fresh token
    new_token = create_invitation_token(user.email)
    user.invitation_token = new_token
    user.invitation_sent_at = _now()
    await db.commit()

    from app.services.email_service import send_resend_invitation
    bg.add_task(send_resend_invitation, user.email, new_token, user.first_name)
    return {"detail": "Invitation renvoyée"}
