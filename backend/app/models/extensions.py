"""
Extension Models — Additional entities for existing domains.
Project: Lot, Site, Risk, ChangeOrder, Milestone
Subcontracting: Tender, Bid, Dispute, Retention
Inventory: Warehouse, MaterialBatch, Allocation
HR: HRDocument
Support: SLA, WarrantyClaim
CMS: CMSRedirect, CMSOffer, CMSExpertise
"""
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey, JSON,
)
from app.database import Base
import uuid


def _uuid():
    return str(uuid.uuid4())


# ═══════════════════════════════════════════════════════════════
# PROJECT EXTENSIONS
# ═══════════════════════════════════════════════════════════════

class Site(Base):
    __tablename__ = "sites"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    address = Column(Text, default="")
    city = Column(String, default="")
    coordinates = Column(JSON, default=dict)  # {lat, lng}
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    area_m2 = Column(Float, default=0.0)
    description = Column(Text, default="")
    access_instructions = Column(Text, default="")
    status = Column(String, default="ACTIF")  # ACTIF/SUSPENDU/CLOTURE
    site_manager_id = Column(String, ForeignKey("users.id"), nullable=True)
    weather_station_id = Column(String, default="")
    photos = Column(JSON, default=list)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class Lot(Base):
    __tablename__ = "lots"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    discipline = Column(String, default="")
    description = Column(Text, default="")
    budget = Column(Float, default=0.0)
    actual_cost = Column(Float, default=0.0)
    subcontractor_id = Column(String, ForeignKey("subcontractors.id"), nullable=True)
    site_id = Column(String, ForeignKey("sites.id"), nullable=True)
    status = Column(String, default="EN_ATTENTE")
    # EN_ATTENTE/EN_COURS/TERMINE/SUSPENDU
    progress = Column(Float, default=0.0)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class Milestone(Base):
    __tablename__ = "milestones"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    phase_id = Column(String, ForeignKey("project_phases.id"), nullable=True)
    lot_id = Column(String, ForeignKey("lots.id"), nullable=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    due_date = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String, default="A_VENIR")  # A_VENIR/EN_COURS/COMPLETE/EN_RETARD
    is_client_visible = Column(Boolean, default=True)
    is_payment_milestone = Column(Boolean, default=False)
    payment_percentage = Column(Float, default=0.0)
    deliverables = Column(JSON, default=list)
    validated_by = Column(String, ForeignKey("users.id"), nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class Risk(Base):
    __tablename__ = "project_risks"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String, unique=True, nullable=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    lot_id = Column(String, ForeignKey("lots.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    category = Column(String, default="")  # technique, financier, planning, securite
    probability = Column(String, default="MOYEN")  # FAIBLE/MOYEN/ELEVE/CRITIQUE
    impact = Column(String, default="MOYEN")
    risk_score = Column(Integer, default=0)
    mitigation_plan = Column(Text, default="")
    actual_impact = Column(Text, default="")
    owner_id = Column(String, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="IDENTIFIE")  # IDENTIFIE/SURVEILLE/ATTENUER/RESOLU/ACCEPTE
    identified_date = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class ChangeOrder(Base):
    __tablename__ = "change_orders"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String, unique=True, nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    reason = Column(Text, default="")
    reason = Column(Text, default="")
    requested_by = Column(String, default="")
    submitted_by = Column(String, ForeignKey("users.id"), nullable=True)
    approved_by = Column(String, ForeignKey("users.id"), nullable=True)

    cost_impact = Column(Float, default=0.0)
    time_impact_days = Column(Integer, default=0)
    scope_changes = Column(JSON, default=list)
    documents = Column(JSON, default=list)
    decision_notes = Column(Text, default="")

    status = Column(String, default="SOUMIS", index=True)
    # SOUMIS/EN_REVUE/APPROUVE/REFUSE/ANNULE
    client_validated = Column(Boolean, default=False)
    client_validated_at = Column(DateTime, nullable=True)

    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


# ═══════════════════════════════════════════════════════════════
# SUBCONTRACTING EXTENSIONS
# ═══════════════════════════════════════════════════════════════

class SubcontractorQualification(Base):
    __tablename__ = "subcontractor_qualifications"

    id = Column(String, primary_key=True, default=_uuid)
    subcontractor_id = Column(String, ForeignKey("subcontractors.id"), nullable=False, index=True)
    qualification_type = Column(String, default="")  # certification, experience, reference
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    document_url = Column(String, default="")
    valid_until = Column(DateTime, nullable=True)
    verified = Column(Boolean, default=False)
    verified_by = Column(String, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Tender(Base):
    """Appel d'offres / Consultation sous-traitant."""
    __tablename__ = "tenders"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String, unique=True, nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    lot_id = Column(String, ForeignKey("lots.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    scope_of_work = Column(Text, default="")
    technical_specs = Column(Text, default="")
    quantities = Column(JSON, default=list)
    plans_versions = Column(JSON, default=list)
    quality_criteria = Column(JSON, default=list)
    deadline = Column(DateTime, nullable=True)

    status = Column(String, default="OUVERTE", index=True)
    # OUVERTE/EN_COURS/EVALUEE/ATTRIBUEE/ANNULEE

    invited_subcontractors = Column(JSON, default=list)
    allow_variants = Column(Boolean, default=True)
    exclusions = Column(Text, default="")
    estimated_budget = Column(Float, default=0.0)

    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    awarded_to = Column(String, ForeignKey("subcontractors.id"), nullable=True)
    awarded_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class Bid(Base):
    """Réponse à un appel d'offres par un sous-traitant."""
    __tablename__ = "bids"

    id = Column(String, primary_key=True, default=_uuid)
    tender_id = Column(String, ForeignKey("tenders.id"), nullable=False, index=True)
    subcontractor_id = Column(String, ForeignKey("subcontractors.id"), nullable=False, index=True)

    amount = Column(Float, default=0.0)
    duration_days = Column(Integer, default=0)
    lines = Column(JSON, default=list)
    technical_proposal = Column(Text, default="")
    variants = Column(JSON, default=list)
    exclusions = Column(Text, default="")
    conditions = Column(Text, default="")
    documents = Column(JSON, default=list)

    status = Column(String, default="SOUMIS", index=True)
    # SOUMIS/EN_EVALUATION/RETENU/NON_RETENU/RETIRE

    score_technique = Column(Float, default=0.0)
    score_prix = Column(Float, default=0.0)
    score_global = Column(Float, default=0.0)
    evaluation_notes = Column(Text, default="")

    submitted_at = Column(DateTime, default=datetime.utcnow)
    evaluated_at = Column(DateTime, nullable=True)
    evaluated_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Dispute(Base):
    """Litige avec un sous-traitant."""
    __tablename__ = "disputes"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String, unique=True, nullable=False, index=True)
    subcontractor_id = Column(String, ForeignKey("subcontractors.id"), nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True, index=True)
    contract_id = Column(String, ForeignKey("subcontracts.id"), nullable=True)
    situation_id = Column(String, ForeignKey("subcontractor_situations.id"), nullable=True)

    title = Column(String, nullable=False)
    description = Column(Text, default="")
    disputed_amount = Column(Float, default=0.0)
    accepted_amount = Column(Float, default=0.0)

    status = Column(String, default="OUVERT", index=True)
    # OUVERT/EN_ANALYSE/EN_NEGOCIATION/DECISION/RESOLU/ESCALADE

    evidence = Column(JSON, default=list)
    proposals = Column(JSON, default=list)
    # [{date, from, amount, description, accepted}]
    decision = Column(Text, default="")
    decision_by = Column(String, ForeignKey("users.id"), nullable=True)
    decision_at = Column(DateTime, nullable=True)

    escalated = Column(Boolean, default=False)
    escalated_to = Column(String, default="")  # direction, juridique
    escalated_at = Column(DateTime, nullable=True)

    freeze_payment = Column(Boolean, default=False)
    responsible_id = Column(String, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class Retention(Base):
    """Retenue de garantie sur contrat sous-traitant."""
    __tablename__ = "retentions"

    id = Column(String, primary_key=True, default=_uuid)
    contract_id = Column(String, ForeignKey("subcontracts.id"), nullable=False, index=True)
    subcontractor_id = Column(String, ForeignKey("subcontractors.id"), nullable=False, index=True)
    retention_type = Column(String, default="GARANTIE")  # GARANTIE/AVANCE/PENALITE
    rate_pct = Column(Float, default=5.0)
    total_retained = Column(Float, default=0.0)
    released_amount = Column(Float, default=0.0)
    remaining = Column(Float, default=0.0)
    release_date = Column(DateTime, nullable=True)
    status = Column(String, default="ACTIVE")  # ACTIVE/PARTIELLEMENT_LIBEREE/LIBEREE
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════
# INVENTORY EXTENSIONS
# ═══════════════════════════════════════════════════════════════

class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)
    address = Column(Text, default="")
    city = Column(String, default="")
    warehouse_type = Column(String, default="CENTRAL")  # CENTRAL/CHANTIER/TRANSIT
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    manager_id = Column(String, ForeignKey("users.id"), nullable=True)
    capacity = Column(String, default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class MaterialBatch(Base):
    __tablename__ = "material_batches"

    id = Column(String, primary_key=True, default=_uuid)
    stock_item_id = Column(String, ForeignKey("stock_items.id"), nullable=False, index=True)
    batch_number = Column(String, default="")
    supplier_id = Column(String, ForeignKey("suppliers.id"), nullable=True)
    purchase_order_id = Column(String, ForeignKey("purchase_orders.id"), nullable=True)
    quantity = Column(Float, default=0.0)
    unit_cost = Column(Float, default=0.0)
    expiry_date = Column(DateTime, nullable=True)
    warehouse_id = Column(String, ForeignKey("warehouses.id"), nullable=True)
    location = Column(String, default="")
    status = Column(String, default="DISPONIBLE")  # DISPONIBLE/RESERVE/UTILISE/EXPIRE
    received_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class StockAllocation(Base):
    __tablename__ = "stock_allocations"

    id = Column(String, primary_key=True, default=_uuid)
    stock_item_id = Column(String, ForeignKey("stock_items.id"), nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    lot_id = Column(String, ForeignKey("lots.id"), nullable=True)
    quantity = Column(Float, default=0.0)
    allocated_by = Column(String, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="ALLOUE")  # ALLOUE/CONSOMME/ANNULE
    allocated_at = Column(DateTime, default=datetime.utcnow)
    consumed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════
# HR EXTENSIONS
# ═══════════════════════════════════════════════════════════════

class HRDocument(Base):
    __tablename__ = "hr_documents"

    id = Column(String, primary_key=True, default=_uuid)
    employee_id = Column(String, ForeignKey("employees.id"), nullable=False, index=True)
    document_type = Column(String, nullable=False)
    # contrat, avenant, fiche_paie, attestation, cni, diplome, certificat
    name = Column(String, nullable=False)
    file_url = Column(String, default="")
    storage_key = Column(String, default="")
    file_size = Column(Integer, default=0)
    valid_from = Column(DateTime, nullable=True)
    valid_until = Column(DateTime, nullable=True)
    confidentiality = Column(String, default="CONFIDENTIEL")
    uploaded_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


# ═══════════════════════════════════════════════════════════════
# SUPPORT EXTENSIONS
# ═══════════════════════════════════════════════════════════════

class SLAPolicy(Base):
    __tablename__ = "sla_policies"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    category = Column(String, default="")
    priority = Column(String, default="NORMALE")
    response_time_hours = Column(Integer, default=24)
    resolution_time_hours = Column(Integer, default=72)
    escalation_time_hours = Column(Integer, default=48)
    escalation_to = Column(String, default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WarrantyClaim(Base):
    __tablename__ = "warranty_claims"

    id = Column(String, primary_key=True, default=_uuid)
    warranty_id = Column(String, ForeignKey("warranties.id"), nullable=False, index=True)
    ticket_id = Column(String, ForeignKey("sav_tickets.id"), nullable=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    description = Column(Text, default="")
    photos = Column(JSON, default=list)
    status = Column(String, default="SOUMISE")
    # SOUMISE/EN_VERIFICATION/APPROUVEE/REJETEE/INTERVENTION/CLOTUREE
    intervention_date = Column(DateTime, nullable=True)
    intervention_notes = Column(Text, default="")
    cost = Column(Float, default=0.0)
    covered_by_warranty = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


# ═══════════════════════════════════════════════════════════════
# CMS EXTENSIONS — Offres, Expertises, Projets questionnaire
# ═══════════════════════════════════════════════════════════════

class CMSOffer(Base):
    """Univers commercial et offres GLOBUS."""
    __tablename__ = "cms_offers"

    id = Column(String, primary_key=True, default=_uuid)
    universe = Column(String, nullable=False, index=True)
    # HOME/BUSINESS/PREMIUM/DIASPORA/ENGINEERING
    slug = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    tagline = Column(String, default="")
    hero_title = Column(String, default="")
    hero_subtitle = Column(String, default="")
    hero_image = Column(String, default="")
    hero_video = Column(String, default="")
    description = Column(Text, default="")
    target_audience = Column(String, default="")
    promise = Column(String, default="")
    icon_key = Column(String, default="")
    image = Column(String, default="")
    color = Column(String, default="")
    features = Column(JSON, default=list)
    offers = Column(JSON, default=list)
    # [{name, description, features, price_range, cta}]
    testimonials = Column(JSON, default=list)
    faq = Column(JSON, default=list)
    cta_title = Column(String, default="")
    cta_description = Column(String, default="")
    cta_button_text = Column(String, default="")
    cta_button_url = Column(String, default="")
    seo_title = Column(String, default="")
    seo_description = Column(String, default="")
    seo_keywords = Column(JSON, default=list)
    is_published = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class CMSExpertise(Base):
    """Compétences/expertises techniques GLOBUS."""
    __tablename__ = "cms_expertises"

    id = Column(String, primary_key=True, default=_uuid)
    slug = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    category = Column(String, default="")
    description = Column(Text, default="")
    icon = Column(String, default="")
    image = Column(String, default="")
    capabilities = Column(JSON, default=list)
    tools = Column(JSON, default=list)
    certifications = Column(JSON, default=list)
    projects_count = Column(Integer, default=0)
    years_experience = Column(Integer, default=0)
    key_figures = Column(JSON, default=list)
    related_projects = Column(JSON, default=list)
    seo_title = Column(String, default="")
    seo_description = Column(String, default="")
    is_published = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class ProjectBrief(Base):
    """Brief projet client (questionnaire /decrire-mon-projet)."""
    __tablename__ = "project_briefs"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String, unique=True, nullable=True, index=True)
    lead_id = Column(String, ForeignKey("leads.id"), nullable=True, index=True)

    # Multi-step questionnaire data
    current_step = Column(Integer, default=0)
    step1_data = Column(JSON, default=dict)
    step2_data = Column(JSON, default=dict)
    step3_data = Column(JSON, default=dict)
    step4_data = Column(JSON, default=dict)

    # Denormalized key fields for listing/filtering
    project_type = Column(String, default="")
    universe = Column(String, default="")
    contact_name = Column(String, default="")
    contact_email = Column(String, default="")
    contact_phone = Column(String, default="")

    # Status & workflow
    status = Column(String, default="BROUILLON", index=True)
    # BROUILLON/SOUMIS/EN_ETUDE/QUALIFIE/CONVERTI/ARCHIVE
    priority = Column(String, default="NORMAL")
    score = Column(Integer, default=0)
    assigned_to = Column(String, ForeignKey("users.id"), nullable=True)
    internal_notes = Column(Text, default="")
    estimated_budget = Column(Float, default=0.0)

    submitted_at = Column(DateTime, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    converted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class CMSRedirect(Base):
    __tablename__ = "cms_redirects"

    id = Column(String, primary_key=True, default=_uuid)
    source_path = Column(String, nullable=False, unique=True, index=True)
    target_path = Column(String, nullable=False)
    status_code = Column(Integer, default=301)  # 301/410
    is_active = Column(Boolean, default=True)
    hit_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
