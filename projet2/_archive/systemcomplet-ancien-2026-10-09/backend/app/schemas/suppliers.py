"""Pydantic schemas for Supplier, Delivery, GRN, 3-way match."""
from datetime import datetime
from typing import Optional, List
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field


# ── Supplier ────────────────────────────────────────────────
class SupplierContactSchema(BaseModel):
    id: Optional[str] = None
    supplier_id: Optional[str] = None
    name: str
    role: str = ""
    email: str = ""
    phone: str = ""
    whatsapp: str = ""
    is_primary: bool = False

class SupplierProductSchema(BaseModel):
    id: Optional[str] = None
    supplier_id: Optional[str] = None
    reference: str = ""
    name: str
    category: str = ""
    unit: str = "pcs"
    unit_price: float = 0.0
    min_order_qty: float = 0.0
    lead_time_days: int = 0
    available: bool = True

class SupplierCreate(BaseModel):
    company_name: str
    legal_name: str = ""
    tax_id: str = ""
    email: str = ""
    phone: str = ""
    whatsapp: str = ""
    address: str = ""
    city: str = ""
    zone: str = ""
    speciality: str = ""
    payment_terms: str = ""
    min_order_amount: float = 0.0
    notes: str = ""

class SupplierUpdate(BaseModel):
    company_name: Optional[str] = None
    legal_name: Optional[str] = None
    tax_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    zone: Optional[str] = None
    speciality: Optional[str] = None
    payment_terms: Optional[str] = None
    min_order_amount: Optional[float] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class SupplierOut(BaseModel):
    id: str
    company_name: str
    legal_name: str
    tax_id: str
    email: str
    phone: str
    whatsapp: str
    address: str
    city: str
    zone: str
    speciality: str
    payment_terms: str
    min_order_amount: float
    quality_score: float
    delivery_rate: float
    error_rate: float
    is_active: bool
    notes: str
    contacts: List[SupplierContactSchema] = []
    created_at: datetime
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class SupplierRatingCreate(BaseModel):
    quality_score: int = Field(ge=1, le=5)
    delivery_score: int = Field(ge=1, le=5)
    communication_score: int = Field(ge=1, le=5)
    price_score: int = Field(ge=1, le=5)
    comments: str = ""
    project_id: Optional[str] = None


# ── Delivery ────────────────────────────────────────────────
class DeliveryItemCreate(BaseModel):
    product_name: str
    po_line_ref: str = ""
    expected_qty: float
    unit: str = "pcs"

class DeliveryCreate(BaseModel):
    purchase_order_id: str
    supplier_id: str
    project_id: Optional[str] = None
    expected_date: Optional[datetime] = None
    items: List[DeliveryItemCreate] = []
    notes: str = ""

class DeliveryReceiveItem(BaseModel):
    delivery_item_id: str
    received_qty: float
    quality_ok: bool = True
    damage_notes: str = ""
    lot_number: str = ""

class DeliveryReceive(BaseModel):
    received_by: Optional[str] = None
    items: List[DeliveryReceiveItem]
    photos: List[str] = []
    geolocation: Optional[str] = None
    vehicle_plate: str = ""
    driver_name: str = ""
    notes: str = ""

class DeliveryOut(BaseModel):
    id: str
    code: str
    purchase_order_id: str
    supplier_id: str
    project_id: Optional[str]
    status: str
    expected_date: Optional[datetime]
    shipped_at: Optional[datetime]
    received_at: Optional[datetime]
    transporter: str
    tracking_number: str
    notes: str
    created_at: datetime
    class Config:
        from_attributes = True

class ThreeWayMatchResult(BaseModel):
    po_total: float
    grn_total: float
    invoice_total: float
    po_grn_match: bool
    grn_invoice_match: bool
    po_invoice_match: bool
    discrepancies: List[dict] = []
    status: str  # MATCHED / PARTIAL / MISMATCH


# ── Dispute ─────────────────────────────────────────────────
class DisputeCreate(BaseModel):
    entity_type: str  # supplier, subcontractor
    entity_id: str
    project_id: Optional[str] = None
    subject: str
    description: str = ""
    amount_contested: float = 0.0
    priority: str = "NORMAL"

class DisputeEventCreate(BaseModel):
    event_type: str  # note, proposal, counter_proposal, decision, evidence
    description: str
    amount: Optional[float] = None
    attachment_url: Optional[str] = None

class DisputeOut(BaseModel):
    id: str
    code: str
    entity_type: str
    entity_id: str
    project_id: Optional[str]
    subject: str
    description: str
    amount_contested: float
    amount_resolved: Optional[float]
    status: str
    priority: str
    assigned_to: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]
    class Config:
        from_attributes = True
