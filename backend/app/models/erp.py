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
    file_size = Column(String, default="")
    mime_type = Column(String, default="")
    category = Column(String, default="general")
    # architecture, structure, electricite, plomberie, contrat, general
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
