"""
ERP Core Models — All operational tables for the Globus BTP ERP.

Conventions:
  - All IDs are UUID strings (SQLite compatible, easy PostgreSQL migration).
  - All mutable entities have `updated_at` (auto-set on update).
  - All deletable entities have `deleted_at` (soft delete — never hard-delete).
  - Statuses stored as plain strings (not Enum) for SQLite compatibility.
"""
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey, JSON,
)
from sqlalchemy.orm import relationship
from app.database import Base
import uuid


def _uuid():
    return str(uuid.uuid4())


# ═══════════════════════════════════════════════════════════════
# PROJECT TEMPLATES
# ═══════════════════════════════════════════════════════════════

class ProjectTemplate(Base):
    __tablename__ = "project_templates"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False, unique=True)  # "Villa R+1"
    description = Column(Text, default="")
    phases = Column(JSON, default=list)
    # phases: [{"name": "Terrassement", "duration_days": 30}, ...]
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════
# CRM — LEADS
# ═══════════════════════════════════════════════════════════════

class Lead(Base):
    __tablename__ = "leads"

    id = Column(String, primary_key=True, default=_uuid)
    # Source: ContactPage form or manual admin entry
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, nullable=False, index=True)
    phone = Column(String, default="")
    company = Column(String, default="")
    project_type = Column(String, default="")  # "Villa R+1", free text
    message = Column(Text, default="")
    location = Column(String, default="")

    # Pipeline
    status = Column(String, default="NOUVEAU", index=True)
    # NOUVEAU → QUALIFICATION → DEVIS → NEGOCIATION → GAGNE → PERDU
    pipeline_notes = Column(Text, default="")
    quote_amount = Column(Float, nullable=True)  # Montant devis

    # Conversion tracking
    converted_project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    converted_at = Column(DateTime, nullable=True)

    # Metadata
    assigned_to = Column(String, ForeignKey("users.id"), nullable=True)
    source = Column(String, default="website")  # website, referral, manual
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


# ═══════════════════════════════════════════════════════════════
# PROJECTS / CHANTIERS
# ═══════════════════════════════════════════════════════════════

class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String, unique=True, nullable=False, index=True)  # "PRJ-2026-001"
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    location = Column(String, default="")
    project_type = Column(String, default="")  # Villa R+1, etc.

    # Relationships
    client_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    chef_projet_id = Column(String, ForeignKey("users.id"), nullable=True)
    lead_id = Column(String, ForeignKey("leads.id"), nullable=True)

    # Budget
    budget_initial = Column(Float, default=0.0)
    budget_spent = Column(Float, default=0.0)

    # Status & Progress
    status = Column(String, default="EN_COURS", index=True)
    # EN_COURS, EN_RETARD, SUSPENDU, TERMINE, ARCHIVE
    progress = Column(Integer, default=0)  # 0-100, recalculated from phases

    # Dates
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    estimated_end_date = Column(DateTime, nullable=True)

    # BIM integration
    bim_urn = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    phases = relationship("ProjectPhase", back_populates="project", order_by="ProjectPhase.sort_order")
    media = relationship("ProjectMedia", back_populates="project")


class ProjectPhase(Base):
    __tablename__ = "project_phases"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    status = Column(String, default="EN_ATTENTE")
    # EN_ATTENTE, EN_COURS, TERMINE, BLOQUE
    progress = Column(Integer, default=0)  # 0-100
    duration_days = Column(Integer, default=0)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    sort_order = Column(Integer, default=0)
    validated_by = Column(String, ForeignKey("users.id"), nullable=True)
    validated_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="phases")


class ProjectMedia(Base):
    __tablename__ = "project_media"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    phase_id = Column(String, ForeignKey("project_phases.id"), nullable=True)
    url = Column(String, nullable=False)
    storage_key = Column(String, nullable=True)  # AWS S3 / Cloudflare R2 object key
    thumbnail = Column(String, default="")
    caption = Column(String, default="")
    media_type = Column(String, default="photo")  # photo, video
    uploaded_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="media")


# ═══════════════════════════════════════════════════════════════
# INVOICING & FINANCES
# ═══════════════════════════════════════════════════════════════

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String, unique=True, nullable=False)  # "FAC-2026-001"
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    client_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)

    invoice_type = Column(String, default="FACTURE")  # FACTURE, PROFORMA, APPEL_FONDS
    status = Column(String, default="BROUILLON", index=True)
    # BROUILLON → ENVOYEE → PAYEE → EN_RETARD → ANNULEE

    # Amounts
    subtotal = Column(Float, default=0.0)
    tax_rate = Column(Float, default=0.0)  # percentage
    tax_amount = Column(Float, default=0.0)
    total = Column(Float, default=0.0)
    amount_paid = Column(Float, default=0.0)

    # Content
    lines = Column(JSON, default=list)
    # [{"designation": "...", "qty": 1, "unit_price": 1000, "total": 1000}]
    notes = Column(Text, default="")

    # Linked phase (for call-for-funds)
    phase_id = Column(String, ForeignKey("project_phases.id"), nullable=True)

    # Dates
    issue_date = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True, default=_uuid)
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    method = Column(String, default="virement")  # virement, mobile_money, cash, cheque
    reference = Column(String, default="")
    notes = Column(Text, default="")
    paid_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class PettyCash(Base):
    """Caisse chantier — small field expenses."""
    __tablename__ = "petty_cash"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    description = Column(String, nullable=False)
    category = Column(String, default="")
    receipt_url = Column(String, nullable=True)
    recorded_by = Column(String, ForeignKey("users.id"), nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════
# GED — DOCUMENT MANAGEMENT
# ═══════════════════════════════════════════════════════════════

class GEDFolder(Base):
    __tablename__ = "ged_folders"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    parent_id = Column(String, ForeignKey("ged_folders.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    folder_id = Column(String, ForeignKey("ged_folders.id"), nullable=True)
    name = Column(String, nullable=False)
    file_url = Column(String, nullable=False)
    storage_key = Column(String, nullable=True)  # AWS S3 / Cloudflare R2 object key
    file_size = Column(String, default="")
    mime_type = Column(String, default="")
    category = Column(String, default="general")
    # architecture, structure, electricite, plomberie, contrat, general
    version_note = Column(Text, default="")  # Note attached to this version upload
    version = Column(Integer, default=1)
    parent_document_id = Column(String, ForeignKey("documents.id"), nullable=True)
    # For versioning: V2 points to V1

    shared_with_client = Column(Boolean, default=False)
    uploaded_by = Column(String, ForeignKey("users.id"), nullable=True)

    # Signing
    signed_at = Column(DateTime, nullable=True)
    signed_by = Column(String, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class MaterialChoice(Base):
    """Client material/finish selections."""
    __tablename__ = "material_choices"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    category = Column(String, nullable=False)  # Carrelage, Peinture, etc.
    options = Column(JSON, default=list)  # [{name, image_url, price}]
    selected = Column(String, nullable=True)  # Client's choice
    selected_by = Column(String, ForeignKey("users.id"), nullable=True)
    selected_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════
# MESSAGING
# ═══════════════════════════════════════════════════════════════

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    subject = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    participants = relationship("ConversationParticipant", back_populates="conversation")
    messages = relationship("Message", back_populates="conversation", order_by="Message.created_at")


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"

    id = Column(String, primary_key=True, default=_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    last_read_at = Column(DateTime, nullable=True)

    conversation = relationship("Conversation", back_populates="participants")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False, index=True)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    is_system = Column(Boolean, default=False)  # Auto-generated welcome messages
    attachment_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")


# ═══════════════════════════════════════════════════════════════
# SAV / SUPPORT TICKETS
# ═══════════════════════════════════════════════════════════════

class SAVTicket(Base):
    __tablename__ = "sav_tickets"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String, unique=True, nullable=False)  # "SAV-2026-001"
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    client_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    subject = Column(String, nullable=False)
    description = Column(Text, default="")
    category = Column(String, default="general")
    # plomberie, electricite, structure, finitions, general
    priority = Column(String, default="NORMALE")  # BASSE, NORMALE, HAUTE, URGENTE
    status = Column(String, default="OUVERT", index=True)
    # OUVERT → EN_COURS → RESOLU → FERME
    assigned_to = Column(String, ForeignKey("users.id"), nullable=True)
    rating = Column(Integer, nullable=True)  # Client satisfaction 1-5
    rating_comment = Column(Text, default="")  # Optional review left with the rating

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)

    replies = relationship("SAVTicketReply", back_populates="ticket", order_by="SAVTicketReply.created_at")


class SAVTicketReply(Base):
    __tablename__ = "sav_ticket_replies"

    id = Column(String, primary_key=True, default=_uuid)
    ticket_id = Column(String, ForeignKey("sav_tickets.id"), nullable=False, index=True)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    attachment_url = Column(String, nullable=True)
    is_internal = Column(Boolean, default=False)  # Internal note vs client-visible reply
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("SAVTicket", back_populates="replies")


# ═══════════════════════════════════════════════════════════════
# APPOINTMENTS / AGENDA
# ═══════════════════════════════════════════════════════════════

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    location = Column(String, default="")
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(String, default="PENDING")
    # PENDING → CONFIRMED → COMPLETED → CANCELLED
    requested_by = Column(String, ForeignKey("users.id"), nullable=False)
    attendees = Column(JSON, default=list)  # [user_id, ...]

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


# ═══════════════════════════════════════════════════════════════
# HR — EMPLOYEES & PAYROLL
# ═══════════════════════════════════════════════════════════════

class Employee(Base):
    __tablename__ = "employees"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    employee_code = Column(String, unique=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, default="")
    phone = Column(String, default="")
    position = Column(String, default="")
    department = Column(String, default="")
    contract_type = Column(String, default="CDI")  # CDI, CDD
    base_salary = Column(Float, default=0.0)
    hire_date = Column(DateTime, nullable=True)
    photo_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class TempWorker(Base):
    __tablename__ = "temp_workers"

    id = Column(String, primary_key=True, default=_uuid)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    phone = Column(String, default="")
    speciality = Column(String, default="")  # Maçon, Ferrailleur, etc.
    daily_rate = Column(Float, default=0.0)
    rating = Column(Float, default=0.0)  # 0-5 stars
    qr_code_data = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(String, primary_key=True, default=_uuid)
    worker_type = Column(String, nullable=False)  # "employee" or "temp_worker"
    worker_id = Column(String, nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    date = Column(DateTime, nullable=False)
    status = Column(String, default="PRESENT")  # PRESENT, RETARD, ABSENT
    check_in = Column(DateTime, nullable=True)
    check_out = Column(DateTime, nullable=True)
    notes = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Payroll(Base):
    __tablename__ = "payroll"

    id = Column(String, primary_key=True, default=_uuid)
    worker_type = Column(String, nullable=False)  # "employee" or "temp_worker"
    worker_id = Column(String, nullable=False, index=True)
    period = Column(String, nullable=False)  # "2026-05"
    days_worked = Column(Integer, default=0)
    base_amount = Column(Float, default=0.0)
    bonuses = Column(Float, default=0.0)
    deductions = Column(Float, default=0.0)
    advances = Column(Float, default=0.0)
    net_amount = Column(Float, default=0.0)
    status = Column(String, default="BROUILLON")  # BROUILLON, VALIDE, PAYE
    paid_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════
# PROCUREMENT — PURCHASES & STOCK
# ═══════════════════════════════════════════════════════════════

class PurchaseRequest(Base):
    __tablename__ = "purchase_requests"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String, unique=True, nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    requested_by = Column(String, ForeignKey("users.id"), nullable=False)
    description = Column(Text, nullable=False)
    items = Column(JSON, default=list)
    # [{"designation": "Ciment CEM II", "qty": 50, "unit": "sacs", "est_price": 5000}]
    estimated_total = Column(Float, default=0.0)
    status = Column(String, default="EN_ATTENTE")
    # EN_ATTENTE → VALIDEE → REFUSEE
    validated_by = Column(String, ForeignKey("users.id"), nullable=True)
    validated_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, default="")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String, unique=True, nullable=False)
    purchase_request_id = Column(String, ForeignKey("purchase_requests.id"), nullable=True)
    supplier = Column(String, default="")
    items = Column(JSON, default=list)
    total = Column(Float, default=0.0)
    status = Column(String, default="EN_COURS")
    # EN_COURS → LIVRE → ANNULE
    delivery_date = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class StockItem(Base):
    __tablename__ = "stock_items"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    category = Column(String, default="")
    unit = Column(String, default="pcs")
    quantity = Column(Float, default=0.0)
    alert_threshold = Column(Float, default=10.0)
    location = Column(String, default="")  # Warehouse/site

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(String, primary_key=True, default=_uuid)
    stock_item_id = Column(String, ForeignKey("stock_items.id"), nullable=False, index=True)
    movement_type = Column(String, nullable=False)  # IN, OUT
    quantity = Column(Float, nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    reference = Column(String, default="")
    notes = Column(String, default="")
    recorded_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════
# EQUIPMENT — VEHICLES & MACHINERY
# ═══════════════════════════════════════════════════════════════

class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, default="")  # Engin, Véhicule, Outil
    brand = Column(String, default="")
    model = Column(String, default="")
    serial_number = Column(String, default="")
    status = Column(String, default="DISPONIBLE")
    # DISPONIBLE, EN_UTILISATION, EN_MAINTENANCE, HORS_SERVICE
    current_project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    photo_url = Column(String, nullable=True)
    purchase_date = Column(DateTime, nullable=True)
    next_maintenance = Column(DateTime, nullable=True)
    maintenance_history = Column(JSON, default=list)
    # [{"date": "...", "type": "préventive", "description": "...", "cost": 50000}]

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


# ═══════════════════════════════════════════════════════════════
# SUBCONTRACTORS
# ═══════════════════════════════════════════════════════════════

class SubContractor(Base):
    __tablename__ = "subcontractors"

    id = Column(String, primary_key=True, default=_uuid)
    company_name = Column(String, nullable=False)
    contact_name = Column(String, default="")
    email = Column(String, default="")
    phone = Column(String, default="")
    speciality = Column(String, default="")
    tax_id = Column(String, default="")
    rating = Column(Float, default=0.0)  # Average evaluation
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    contracts = relationship("SubContract", back_populates="subcontractor")
    evaluations = relationship("SubContractorEvaluation", back_populates="subcontractor")


class SubContract(Base):
    __tablename__ = "subcontracts"

    id = Column(String, primary_key=True, default=_uuid)
    subcontractor_id = Column(String, ForeignKey("subcontractors.id"), nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    description = Column(Text, default="")
    amount = Column(Float, default=0.0)
    status = Column(String, default="ACTIF")  # ACTIF, TERMINE, RESILIE
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    amount_paid = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    subcontractor = relationship("SubContractor", back_populates="contracts")


class SubContractorEvaluation(Base):
    __tablename__ = "subcontractor_evaluations"

    id = Column(String, primary_key=True, default=_uuid)
    subcontractor_id = Column(String, ForeignKey("subcontractors.id"), nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    evaluated_by = Column(String, ForeignKey("users.id"), nullable=False)
    quality_score = Column(Integer, default=3)  # 1-5
    timeliness_score = Column(Integer, default=3)
    communication_score = Column(Integer, default=3)
    comments = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    subcontractor = relationship("SubContractor", back_populates="evaluations")


# ═══════════════════════════════════════════════════════════════
# QHSE — QUALITY, HEALTH, SAFETY, ENVIRONMENT
# ═══════════════════════════════════════════════════════════════

class QHSEIncident(Base):
    __tablename__ = "qhse_incidents"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    severity = Column(String, default="MINEUR")  # MINEUR, MODERE, GRAVE, CRITIQUE
    category = Column(String, default="")  # Chute, Électrique, Incendie, etc.
    location = Column(String, default="")
    reported_by = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="OUVERT")  # OUVERT, EN_COURS, CLOTURE
    corrective_action = Column(Text, default="")
    photos = Column(JSON, default=list)

    incident_date = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class QHSEAudit(Base):
    __tablename__ = "qhse_audits"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    audit_type = Column(String, default="SECURITE")  # SECURITE, QUALITE, ENVIRONNEMENT
    auditor = Column(String, ForeignKey("users.id"), nullable=False)
    score = Column(Float, nullable=True)  # 0-100
    findings = Column(JSON, default=list)
    # [{"item": "Port du casque", "status": "conforme/non_conforme", "comment": "..."}]
    status = Column(String, default="PLANIFIE")  # PLANIFIE, EN_COURS, TERMINE
    audit_date = Column(DateTime, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════
# NOTIFICATIONS & ACTIVITY LOG
# ═══════════════════════════════════════════════════════════════

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, default="info")
    # info, success, warning, error, invoice, message, sav, project, appointment
    title = Column(String, nullable=False)
    message = Column(Text, default="")
    entity_type = Column(String, nullable=True)  # "project", "invoice", "sav_ticket", etc.
    entity_id = Column(String, nullable=True)
    is_read = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(String, primary_key=True, default=_uuid)
    actor_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    action = Column(String, nullable=False)
    # LEAD_CREATED, LEAD_CONVERTED, PROJECT_CREATED, PHASE_VALIDATED,
    # INVOICE_SENT, DOCUMENT_SHARED, TICKET_CREATED, USER_CREATED, etc.
    entity_type = Column(String, nullable=True)  # "lead", "project", "invoice", etc.
    entity_id = Column(String, nullable=True)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    description = Column(Text, default="")
    ip_address = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════
# COLLABORATION — BUREAU D'ÉTUDES VIRTUEL
# ═══════════════════════════════════════════════════════════════

class CollaborationSession(Base):
    __tablename__ = "collaboration_sessions"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    plan_urn = Column(String, nullable=False)  # Autodesk APS URN
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="ACTIVE")  # ACTIVE, ENDED
    mode = Column(String, default="FREE")  # FREE, PRESENTER
    presenter_id = Column(String, ForeignKey("users.id"), nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    recording_url = Column(String, nullable=True)


class SessionAnnotation(Base):
    __tablename__ = "session_annotations"

    id = Column(String, primary_key=True, default=_uuid)
    session_id = Column(String, ForeignKey("collaboration_sessions.id"), nullable=False, index=True)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    author_role = Column(String, nullable=False)  # ARCHITECTE, ELECTRICIEN, etc.
    layer = Column(String, nullable=False)  # architecture, structure, electricite, plomberie, decisions
    markup_data = Column(JSON, nullable=False)  # Serialized SVG/Canvas data
    is_validated = Column(Boolean, default=False)
    validated_by = Column(String, ForeignKey("users.id"), nullable=True)
    validated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SessionSnapshot(Base):
    __tablename__ = "session_snapshots"

    id = Column(String, primary_key=True, default=_uuid)
    session_id = Column(String, ForeignKey("collaboration_sessions.id"), nullable=False, index=True)
    captured_by = Column(String, ForeignKey("users.id"), nullable=False)
    image_url = Column(String, nullable=False)  # Screenshot with annotations
    annotations_state = Column(JSON, nullable=True)  # Complete state of all layers
    notes = Column(Text, default="")
    shared_with_client = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Charge(Base):
    """Recurring or one-off operating expense (rent, utilities, insurances...)."""
    __tablename__ = "charges"

    id = Column(String, primary_key=True, default=_uuid)
    category = Column(String, nullable=False)
    # loyer, utilities, assurance, salaires, fournitures, autre
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    recurring = Column(Boolean, default=False)
    period = Column(String, default="MONTHLY")  # MONTHLY, QUARTERLY, ANNUAL, ONE_OFF
    due_date = Column(DateTime, nullable=True)
    paid = Column(Boolean, default=False)
    paid_at = Column(DateTime, nullable=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    receipt_url = Column(String, nullable=True)
    notes = Column(Text, default="")
    recorded_by = Column(String, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


# ── Equipment — Assignments & movements ──────────────────────

class EquipmentAssignment(Base):
    """Active or historical assignment of a piece of equipment to a project."""
    __tablename__ = "equipment_assignments"

    id = Column(String, primary_key=True, default=_uuid)
    equipment_id = Column(String, ForeignKey("equipment.id"), nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    responsible_id = Column(String, ForeignKey("users.id"), nullable=True)
    assigned_from = Column(DateTime, nullable=False, default=datetime.utcnow)
    assigned_to = Column(DateTime, nullable=True)
    status = Column(String, default="ACTIVE")  # ACTIVE, RETURNED
    notes = Column(Text, default="")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class EquipmentMovement(Base):
    """Movement log: site A → site B / warehouse → maintenance bay."""
    __tablename__ = "equipment_movements"

    id = Column(String, primary_key=True, default=_uuid)
    equipment_id = Column(String, ForeignKey("equipment.id"), nullable=False, index=True)
    from_location = Column(String, default="")
    to_location = Column(String, nullable=False)
    from_project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    to_project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    reason = Column(String, default="")  # transfer, maintenance, return, repair
    recorded_by = Column(String, ForeignKey("users.id"), nullable=True)
    moved_at = Column(DateTime, default=datetime.utcnow)


class MaintenanceTicket(Base):
    """Maintenance ticket for equipment (curative or preventive)."""
    __tablename__ = "maintenance_tickets"

    id = Column(String, primary_key=True, default=_uuid)
    equipment_id = Column(String, ForeignKey("equipment.id"), nullable=False, index=True)
    code = Column(String, unique=True, nullable=False)  # MAINT-2026-001
    maintenance_type = Column(String, default="CURATIVE")  # CURATIVE, PREVENTIVE
    description = Column(Text, nullable=False)
    cost = Column(Float, default=0.0)
    status = Column(String, default="PLANNED", index=True)
    # PLANNED, IN_PROGRESS, DONE, CANCELLED
    scheduled_for = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    technician = Column(String, default="")
    reported_by = Column(String, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


# ── Subcontractors — Received invoices ───────────────────────

class SubContractorInvoice(Base):
    """Invoices RECEIVED FROM a subcontractor (≠ Invoice which is to clients)."""
    __tablename__ = "subcontractor_invoices"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String, unique=True, nullable=False)  # F-ST-2026-001
    subcontractor_id = Column(String, ForeignKey("subcontractors.id"), nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    contract_id = Column(String, ForeignKey("subcontracts.id"), nullable=True)
    amount = Column(Float, nullable=False)
    status = Column(String, default="A_VALIDER", index=True)
    # A_VALIDER, VALIDEE, PAYEE, REFUSEE
    issue_date = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    file_url = Column(String, default="")
    notes = Column(Text, default="")
    validated_by = Column(String, ForeignKey("users.id"), nullable=True)
    validated_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


# ── Planning — Gantt-style tasks ─────────────────────────────

class PlanningTask(Base):
    """Granular task (Gantt cell) for a project. Independent from ProjectPhase
    which groups them at a coarser level."""
    __tablename__ = "planning_tasks"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    phase_id = Column(String, ForeignKey("project_phases.id"), nullable=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    duration_days = Column(Integer, default=1)
    progress = Column(Integer, default=0)  # 0-100
    status = Column(String, default="PLANNED", index=True)
    # PLANNED, IN_PROGRESS, DONE, LATE, BLOCKED
    priority = Column(String, default="NORMAL")  # LOW, NORMAL, HIGH
    assignee_id = Column(String, ForeignKey("users.id"), nullable=True)
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class PlanningDependency(Base):
    """Dependency between two planning tasks (finish-to-start by default)."""
    __tablename__ = "planning_dependencies"

    id = Column(String, primary_key=True, default=_uuid)
    predecessor_id = Column(String, ForeignKey("planning_tasks.id"), nullable=False, index=True)
    successor_id = Column(String, ForeignKey("planning_tasks.id"), nullable=False, index=True)
    dep_type = Column(String, default="FS")  # FS (finish-to-start), SS, FF, SF
    lag_days = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── QHSE — EPI distribution ──────────────────────────────────

class EPIDistribution(Base):
    """Record of personal protective equipment given to a worker."""
    __tablename__ = "epi_distributions"

    id = Column(String, primary_key=True, default=_uuid)
    worker_type = Column(String, nullable=False)  # employee or temp_worker
    worker_id = Column(String, nullable=False, index=True)
    equipment_type = Column(String, nullable=False)
    # Casque, Gilet, Chaussures, Gants, Lunettes, Masque, Harnais, Combinaison
    quantity = Column(Integer, default=1)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    signed = Column(Boolean, default=False)
    signature_url = Column(String, nullable=True)  # Photo or signed PDF
    notes = Column(Text, default="")
    distributed_by = Column(String, ForeignKey("users.id"), nullable=True)
    distributed_at = Column(DateTime, default=datetime.utcnow)


# ── Documents — Templates & generated ────────────────────────

class DocumentTemplate(Base):
    """Template for generating recurring documents (payslip, contract, etc.)."""
    __tablename__ = "document_templates"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False, unique=True)
    description = Column(Text, default="")
    category = Column(String, default="general")
    # paie, contrat, note_frais, attestation, bon_sortie, ordre_mission
    icon_key = Column(String, default="FileTextIcon")
    template_body = Column(Text, default="")  # Jinja2 HTML
    placeholders = Column(JSON, default=list)  # List of {key, label, type}
    is_active = Column(Boolean, default=True)
    generated_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GeneratedDocument(Base):
    """A document instance produced from a template."""
    __tablename__ = "generated_documents"

    id = Column(String, primary_key=True, default=_uuid)
    template_id = Column(String, ForeignKey("document_templates.id"), nullable=True)
    name = Column(String, nullable=False)
    category = Column(String, default="general")
    target_type = Column(String, default="")  # employee, project, client, supplier
    target_id = Column(String, nullable=True)
    file_url = Column(String, nullable=False)
    generated_by = Column(String, ForeignKey("users.id"), nullable=True)
    payload = Column(JSON, default=dict)  # values used to render
    created_at = Column(DateTime, default=datetime.utcnow)


# ── 2FA secrets ──────────────────────────────────────────────

class TwoFactorSecret(Base):
    """TOTP secret per user (one row per user). Created on enrollment."""
    __tablename__ = "two_factor_secrets"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    secret = Column(String, nullable=False)  # base32 TOTP secret
    enabled = Column(Boolean, default=False)
    backup_codes = Column(JSON, default=list)  # Hashed backup codes
    confirmed_at = Column(DateTime, nullable=True)
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Weather snapshots (per project) ──────────────────────────

class WeatherSnapshot(Base):
    """Cached weather data per project location (1-hour TTL)."""
    __tablename__ = "weather_snapshots"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    temperature = Column(Float, default=0.0)
    feels_like = Column(Float, default=0.0)
    humidity = Column(Integer, default=0)
    wind_speed = Column(Float, default=0.0)
    condition = Column(String, default="")  # clear, clouds, rain, storm
    description = Column(String, default="")
    icon = Column(String, default="")
    fetched_at = Column(DateTime, default=datetime.utcnow)


# ── Tags (cross-entity) ──────────────────────────────────────

class Tag(Base):
    __tablename__ = "tags"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False, unique=True)
    color = Column(String, default="#3b82f6")
    created_at = Column(DateTime, default=datetime.utcnow)


class EntityTag(Base):
    """Many-to-many between Tag and any entity (polymorphic via entity_type)."""
    __tablename__ = "entity_tags"

    id = Column(String, primary_key=True, default=_uuid)
    tag_id = Column(String, ForeignKey("tags.id"), nullable=False, index=True)
    entity_type = Column(String, nullable=False, index=True)  # lead, project, document, etc.
    entity_id = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Comments (cross-entity discussion threads) ───────────────

class Comment(Base):
    """Generic comment attachable to any entity."""
    __tablename__ = "comments"

    id = Column(String, primary_key=True, default=_uuid)
    entity_type = Column(String, nullable=False, index=True)
    entity_id = Column(String, nullable=False, index=True)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    attachment_url = Column(String, nullable=True)
    is_internal = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


# ── User preferences (notification settings, theme, etc.) ────

class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    notif_email = Column(JSON, default=dict)  # {chantier: true, finances: true, ...}
    notif_sms = Column(JSON, default=dict)
    notif_push = Column(JSON, default=dict)
    theme = Column(String, default="light")  # light, dark, system
    locale = Column(String, default="fr")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Scheduled reports ────────────────────────────────────────

class ScheduledReport(Base):
    """Periodic auto-generation of a report (weekly summary, monthly P&L...)."""
    __tablename__ = "scheduled_reports"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    report_type = Column(String, nullable=False)
    # dashboard_summary, project_progress, revenue, profitability, sav_stats
    frequency = Column(String, default="WEEKLY")  # DAILY, WEEKLY, MONTHLY
    recipients = Column(JSON, default=list)  # [email]
    is_active = Column(Boolean, default=True)
    last_run_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


# ── Project expenses (granular, distinct from PettyCash) ─────

class ProjectExpense(Base):
    """Detailed expense line attached to a project — for cost tracking."""
    __tablename__ = "project_expenses"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    phase_id = Column(String, ForeignKey("project_phases.id"), nullable=True)
    category = Column(String, default="materials")
    # materials, labor, subcontractor, logistics, equipment, misc
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    receipt_url = Column(String, nullable=True)
    supplier_invoice_id = Column(String, ForeignKey("subcontractor_invoices.id"), nullable=True)
    recorded_by = Column(String, ForeignKey("users.id"), nullable=True)
    expense_date = Column(DateTime, default=datetime.utcnow)

    created_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class Warranty(Base):
    """Project warranty (garantie parfait achèvement / biennale / décennale)."""
    __tablename__ = "warranties"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    duration = Column(String, default="")
    description = Column(Text, default="")
    starts_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    status = Column(String, default="ACTIVE")  # ACTIVE / EXPIREE
    created_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class ProjectGuest(Base):
    """Family/guest access a client grants to let someone follow their project."""
    __tablename__ = "project_guests"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True, index=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    email = Column(String, nullable=False)
    name = Column(String, default="")
    role = Column(String, default="READ_ONLY")  # READ_ONLY / EDIT
    status = Column(String, default="PENDING")  # PENDING / ACTIVE
    created_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class Quote(Base):
    """A commercial quote (devis), optionally linked to a CRM lead."""
    __tablename__ = "quotes"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String, unique=True, nullable=False)  # DEV-2026-001
    lead_id = Column(String, ForeignKey("leads.id"), nullable=True)
    parent_quote_id = Column(String, ForeignKey("quotes.id"), nullable=True)  # revision chain
    version = Column(Integer, default=1)
    version_note = Column(Text, default="")
    client_name = Column(String, default="")
    project_label = Column(String, default="")  # free-text project description
    amount = Column(Float, default=0.0)
    lines = Column(JSON, default=list)
    # [{"designation": "...", "qty": 1, "unit_price": 1000, "total": 1000}]
    status = Column(String, default="EN_REDACTION", index=True)
    # EN_REDACTION → ENVOYE → ACCEPTE → REFUSE
    valid_until = Column(DateTime, nullable=True)
    notes = Column(Text, default="")
    converted_invoice_id = Column(String, ForeignKey("invoices.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class DocumentSignature(Base):
    """Finalised signature record — what proves a user signed a document."""
    __tablename__ = "document_signatures"

    id = Column(String, primary_key=True, default=_uuid)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, index=True)
    signer_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    document_hash = Column(String, nullable=False)  # SHA-256 of the file content
    signed_at = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String, default="")
    user_agent = Column(String, default="")
    method = Column(String, default="OTP_EMAIL")  # OTP_EMAIL, OTP_SMS, manual
    audit_meta = Column(JSON, default=dict)


class DocumentSignatureOTP(Base):
    """Short-lived OTP issued to a user for signing a specific document."""
    __tablename__ = "document_signature_otps"

    id = Column(String, primary_key=True, default=_uuid)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    code_hash = Column(String, nullable=False)  # SHA-256 of the 6-digit code
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)
    attempts = Column(Integer, default=0)
    requested_ip = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class ProjectAssignment(Base):
    """A person assigned to a project's team (chef, maçon, électricien…).

    `member_name` is a free-text label so the UI can assign quickly; the
    optional worker_type/worker_id link it to an Employee/TempWorker record.
    """
    __tablename__ = "project_assignments"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    member_name = Column(String, nullable=False)
    role = Column(String, default="")
    worker_type = Column(String, default="")  # employee | temp_worker (optional)
    worker_id = Column(String, nullable=True)
    hours = Column(Integer, default=0)         # hours/week
    status = Column(String, default="Sur site")  # Sur site | Bureau | Congé
    assigned_at = Column(DateTime, default=datetime.utcnow)
    removed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)




class SafetyBriefing(Base):
    """A safety toolbox talk (briefing sécurité) with signature tracking."""
    __tablename__ = "safety_briefings"

    id = Column(String, primary_key=True, default=_uuid)
    title = Column(String, nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    site_label = Column(String, default="")  # free-text site if no project link
    animator = Column(String, default="")
    signed_count = Column(Integer, default=0)
    total_count = Column(Integer, default=0)
    status = Column(String, default="EN_COURS")  # EN_COURS | TERMINE
    briefing_date = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, default="")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class PaymentTransaction(Base):
    """A payment attempt via the Flutterwave gateway (one row per checkout)."""
    __tablename__ = "payment_transactions"

    id = Column(String, primary_key=True, default=_uuid)
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    tx_ref = Column(String, unique=True, nullable=False, index=True)
    amount = Column(Float, default=0.0)
    currency = Column(String, default="XAF")
    status = Column(String, default="PENDING", index=True)  # PENDING/SUCCESS/FAILED
    payment_type = Column(String, default="")
    checkout_url = Column(String, default="")
    flw_ref = Column(String, default="")
    flw_transaction_id = Column(String, default="")
    flw_metadata = Column(JSON, default=dict)
    ip_address = Column(String, default="")
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SubcontractorSituation(Base):
    """A subcontractor's progress statement (situation de travaux) for a project."""
    __tablename__ = "subcontractor_situations"

    id = Column(String, primary_key=True, default=_uuid)
    subcontractor_id = Column(String, ForeignKey("subcontractors.id"), nullable=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True, index=True)
    description = Column(Text, default="")
    progress_pct = Column(Integer, default=0)
    amount = Column(Float, default=0.0)
    status = Column(String, default="SOUMISE", index=True)  # SOUMISE/VALIDEE/REFUSEE
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
