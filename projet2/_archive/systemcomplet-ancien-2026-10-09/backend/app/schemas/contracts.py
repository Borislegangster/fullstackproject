"""Pydantic schemas for Contracts, Change Orders, Tenders, Bids."""
from datetime import datetime
from typing import Optional, List
# pyrefly: ignore [missing-import]
from pydantic import BaseModel


# ── Contract ────────────────────────────────────────────────
class ContractCreate(BaseModel):
    lead_id: Optional[str] = None
    quote_id: Optional[str] = None
    project_id: Optional[str] = None
    client_id: Optional[str] = None
    title: str
    description: str = ""
    amount: float = 0.0
    payment_terms: str = ""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    clauses: List[dict] = []

class ContractUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    amount: Optional[float] = None
    payment_terms: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class ContractOut(BaseModel):
    id: str
    code: str
    lead_id: Optional[str]
    quote_id: Optional[str]
    project_id: Optional[str]
    client_id: Optional[str]
    title: str
    description: str
    amount: float
    payment_terms: str
    status: str
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    signed_at: Optional[datetime]
    created_at: datetime
    class Config:
        from_attributes = True

class ChangeOrderCreate(BaseModel):
    contract_id: Optional[str] = None
    project_id: str
    title: str
    description: str = ""
    amount_delta: float = 0.0
    delay_delta_days: int = 0
    justification: str = ""

class ChangeOrderOut(BaseModel):
    id: str
    code: str
    contract_id: Optional[str]
    project_id: str
    title: str
    description: str
    amount_delta: float
    delay_delta_days: int
    status: str
    justification: str
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    created_at: datetime
    class Config:
        from_attributes = True


# ── Tender / RFQ ────────────────────────────────────────────
class TenderCreate(BaseModel):
    project_id: str
    title: str
    description: str = ""
    deadline: Optional[datetime] = None
    lots: List[dict] = []
    documents: List[str] = []
    invited_subcontractors: List[str] = []

class TenderOut(BaseModel):
    id: str
    code: str
    project_id: str
    title: str
    description: str
    status: str
    deadline: Optional[datetime]
    lots_count: int
    bids_count: int
    created_at: datetime
    class Config:
        from_attributes = True

class BidCreate(BaseModel):
    tender_id: str
    lot_id: Optional[str] = None
    subcontractor_id: str
    amount: float
    duration_days: int = 0
    technical_note: str = ""
    documents: List[str] = []
    conditions: str = ""

class BidOut(BaseModel):
    id: str
    tender_id: str
    lot_id: Optional[str]
    subcontractor_id: str
    amount: float
    duration_days: int
    technical_note: str
    status: str  # SOUMIS / ACCEPTE / REFUSE / RETIRE
    score: Optional[float]
    created_at: datetime
    class Config:
        from_attributes = True


# ── Calls ───────────────────────────────────────────────────
class CallCreate(BaseModel):
    call_type: str = "audio"  # audio, video
    project_id: Optional[str] = None
    participants: List[str] = []

class CallOut(BaseModel):
    id: str
    call_type: str
    project_id: Optional[str]
    initiated_by: str
    status: str  # RINGING / ACTIVE / ENDED / MISSED
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    duration_seconds: int
    participants_count: int
    recording_url: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True


# ── Analytics ───────────────────────────────────────────────
class AnalyticsEventCreate(BaseModel):
    event_type: str
    page_path: str = ""
    referrer: str = ""
    utm_source: str = ""
    utm_medium: str = ""
    utm_campaign: str = ""
    utm_content: str = ""
    utm_term: str = ""
    device_type: str = ""
    browser: str = ""
    os: str = ""
    country: str = ""
    city: str = ""
    metadata: dict = {}

class AnalyticsOverview(BaseModel):
    total_visitors: int
    total_sessions: int
    total_pageviews: int
    avg_session_duration: float
    bounce_rate: float
    new_visitors_pct: float
    top_pages: List[dict]
    top_sources: List[dict]
    conversion_rate: float

class KPIOverview(BaseModel):
    lead_to_quote_rate: float
    quote_to_contract_rate: float
    avg_quote_cycle_days: float
    quote_acceptance_rate: float
    margin_by_project: List[dict]
    budget_variance: float
    urgent_purchase_rate: float
    complete_delivery_rate: float
    supplier_avg_delay_days: float
    dispute_rate: float
    avg_dispute_resolution_days: float
    subcontractor_performance: List[dict]
    clashes_avoided: int
    avg_issue_resolution_hours: float
    client_satisfaction: float
    sav_sla_compliance: float


# ── Security / Audit ────────────────────────────────────────
class AuditEventOut(BaseModel):
    id: str
    timestamp_utc: datetime
    actor_id: Optional[str]
    actor_type: str
    application: str
    module: str
    action: str
    resource_type: str
    resource_id: Optional[str]
    diff: Optional[dict]
    ip_address: str
    user_agent: str
    request_id: str
    result: str
    reason: str
    criticality: str
    class Config:
        from_attributes = True

class ApiKeyCreate(BaseModel):
    name: str
    permissions: List[str] = []
    expires_at: Optional[datetime] = None

class ApiKeyOut(BaseModel):
    id: str
    name: str
    key_prefix: str
    permissions: List[str]
    is_active: bool
    last_used_at: Optional[datetime]
    expires_at: Optional[datetime]
    created_at: datetime
    class Config:
        from_attributes = True

class BackupJobOut(BaseModel):
    id: str
    backup_type: str
    status: str
    size_bytes: Optional[int]
    started_at: datetime
    completed_at: Optional[datetime]
    location: str
    class Config:
        from_attributes = True
