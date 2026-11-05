"""
Supplier & Supply Chain Models — Fournisseurs, Livraisons, GRN, 3-way match.
"""
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey, JSON,
)
from app.database import Base
import uuid


def _uuid():
    return str(uuid.uuid4())


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String, unique=True, nullable=False, index=True)
    company_name = Column(String, nullable=False)
    legal_form = Column(String, default="")
    tax_id = Column(String, default="")
    registration_number = Column(String, default="")

    address = Column(Text, default="")
    city = Column(String, default="")
    country = Column(String, default="Cameroun")
    postal_code = Column(String, default="")

    phone = Column(String, default="")
    email = Column(String, default="")
    website = Column(String, default="")
    whatsapp = Column(String, default="")

    category = Column(String, default="")  # materiaux, services, equipement
    specialties = Column(JSON, default=list)
    delivery_zones = Column(JSON, default=list)
    payment_terms = Column(String, default="")  # 30 jours, comptant, etc.
    min_order_amount = Column(Float, default=0.0)
    currency = Column(String, default="XAF")

    quality_score = Column(Float, default=0.0)  # 0-5
    service_rate = Column(Float, default=0.0)  # % livraisons conformes
    error_rate = Column(Float, default=0.0)  # % erreurs
    avg_delivery_days = Column(Float, default=0.0)
    total_orders = Column(Integer, default=0)
    total_spent = Column(Float, default=0.0)

    certifications = Column(JSON, default=list)
    documents = Column(JSON, default=list)
    notes = Column(Text, default="")
    logo_url = Column(String, default="")

    status = Column(String, default="ACTIF", index=True)  # ACTIF/SUSPENDU/INACTIF
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class SupplierContact(Base):
    __tablename__ = "supplier_contacts"

    id = Column(String, primary_key=True, default=_uuid)
    supplier_id = Column(String, ForeignKey("suppliers.id"), nullable=False, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    role = Column(String, default="")  # commercial, logistique, facturation
    email = Column(String, default="")
    phone = Column(String, default="")
    whatsapp = Column(String, default="")
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class SupplierProduct(Base):
    __tablename__ = "supplier_products"

    id = Column(String, primary_key=True, default=_uuid)
    supplier_id = Column(String, ForeignKey("suppliers.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    reference = Column(String, default="")
    description = Column(Text, default="")
    category = Column(String, default="")
    unit = Column(String, default="")  # kg, m3, unite, sac, etc.
    unit_price = Column(Float, default=0.0)
    currency = Column(String, default="XAF")
    min_quantity = Column(Float, default=0.0)
    lead_time_days = Column(Integer, default=0)
    is_available = Column(Boolean, default=True)
    image_url = Column(String, default="")
    specifications = Column(JSON, default=dict)
    price_history = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String, unique=True, nullable=False, index=True)
    purchase_order_id = Column(String, ForeignKey("purchase_orders.id"), nullable=True, index=True)
    supplier_id = Column(String, ForeignKey("suppliers.id"), nullable=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True, index=True)

    status = Column(String, default="ATTENDUE", index=True)
    # ATTENDUE/EXPEDIEE/EN_TRANSIT/RECUE/PARTIELLE/REFUSEE

    expected_date = Column(DateTime, nullable=True)
    shipped_date = Column(DateTime, nullable=True)
    received_date = Column(DateTime, nullable=True)

    transporter = Column(String, default="")
    tracking_number = Column(String, default="")
    vehicle_plate = Column(String, default="")
    driver_name = Column(String, default="")
    driver_phone = Column(String, default="")

    delivery_note_url = Column(String, default="")
    photos = Column(JSON, default=list)
    geolocation = Column(JSON, default=dict)  # {lat, lng}

    received_by = Column(String, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, default="")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class DeliveryItem(Base):
    __tablename__ = "delivery_items"

    id = Column(String, primary_key=True, default=_uuid)
    delivery_id = Column(String, ForeignKey("deliveries.id"), nullable=False, index=True)
    product_name = Column(String, nullable=False)
    product_ref = Column(String, default="")
    unit = Column(String, default="")
    quantity_expected = Column(Float, default=0.0)
    quantity_received = Column(Float, default=0.0)
    quantity_damaged = Column(Float, default=0.0)
    quantity_different = Column(Float, default=0.0)
    unit_price = Column(Float, default=0.0)
    status = Column(String, default="CONFORME")  # CONFORME/ECART/ENDOMMAGE/DIFFERENT
    notes = Column(Text, default="")
    photos = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)


class GoodsReceipt(Base):
    """Bon de réception (GRN) — proof of delivery acceptance."""
    __tablename__ = "goods_receipts"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String, unique=True, nullable=False, index=True)
    delivery_id = Column(String, ForeignKey("deliveries.id"), nullable=False, index=True)
    purchase_order_id = Column(String, ForeignKey("purchase_orders.id"), nullable=True, index=True)
    supplier_id = Column(String, ForeignKey("suppliers.id"), nullable=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True, index=True)

    items = Column(JSON, default=list)
    total_amount = Column(Float, default=0.0)

    received_by = Column(String, ForeignKey("users.id"), nullable=True)
    verified_by = Column(String, ForeignKey("users.id"), nullable=True)

    has_discrepancy = Column(Boolean, default=False)
    discrepancy_notes = Column(Text, default="")
    photos = Column(JSON, default=list)
    geolocation = Column(JSON, default=dict)

    status = Column(String, default="BROUILLON", index=True)  # BROUILLON/VALIDE/CONTESTE
    received_at = Column(DateTime, default=datetime.utcnow)
    validated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SupplierInvoice(Base):
    """Facture fournisseur — separate from client invoices."""
    __tablename__ = "supplier_invoices"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String, unique=True, nullable=False, index=True)
    supplier_id = Column(String, ForeignKey("suppliers.id"), nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True, index=True)
    purchase_order_id = Column(String, ForeignKey("purchase_orders.id"), nullable=True)
    goods_receipt_id = Column(String, ForeignKey("goods_receipts.id"), nullable=True)

    invoice_number = Column(String, default="")
    invoice_date = Column(DateTime, nullable=True)
    due_date = Column(DateTime, nullable=True)
    amount_ht = Column(Float, default=0.0)
    tax_rate = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    amount_ttc = Column(Float, default=0.0)
    amount_paid = Column(Float, default=0.0)

    lines = Column(JSON, default=list)
    file_url = Column(String, default="")
    storage_key = Column(String, default="")

    status = Column(String, default="RECUE", index=True)
    # RECUE/EN_VERIFICATION/VALIDEE/EN_PAIEMENT/PAYEE/CONTESTEE/ANNULEE

    match_status = Column(String, default="NON_RAPPROCHEE")
    # NON_RAPPROCHEE/RAPPROCHEE/ECART_DETECTE

    validated_by = Column(String, ForeignKey("users.id"), nullable=True)
    validated_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    payment_reference = Column(String, default="")
    payment_method = Column(String, default="")

    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class InvoiceMatch(Base):
    """3-way match: PO / GRN / Supplier Invoice."""
    __tablename__ = "invoice_matches"

    id = Column(String, primary_key=True, default=_uuid)
    supplier_invoice_id = Column(String, ForeignKey("supplier_invoices.id"), nullable=False, index=True)
    purchase_order_id = Column(String, ForeignKey("purchase_orders.id"), nullable=True)
    goods_receipt_id = Column(String, ForeignKey("goods_receipts.id"), nullable=True)

    po_amount = Column(Float, default=0.0)
    grn_amount = Column(Float, default=0.0)
    invoice_amount = Column(Float, default=0.0)

    amount_variance = Column(Float, default=0.0)
    quantity_variance = Column(Float, default=0.0)
    price_variance = Column(Float, default=0.0)

    status = Column(String, default="EN_COURS", index=True)
    # EN_COURS/CONFORME/ECART_MINEUR/ECART_MAJEUR/APPROUVE/REJETE
    tolerance_pct = Column(Float, default=2.0)

    matched_by = Column(String, ForeignKey("users.id"), nullable=True)
    approved_by = Column(String, ForeignKey("users.id"), nullable=True)
    match_details = Column(JSON, default=list)
    notes = Column(Text, default="")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SupplierRating(Base):
    __tablename__ = "supplier_ratings"

    id = Column(String, primary_key=True, default=_uuid)
    supplier_id = Column(String, ForeignKey("suppliers.id"), nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    rated_by = Column(String, ForeignKey("users.id"), nullable=True)

    quality_score = Column(Float, default=0.0)  # 1-5
    delivery_score = Column(Float, default=0.0)
    price_score = Column(Float, default=0.0)
    communication_score = Column(Float, default=0.0)
    overall_score = Column(Float, default=0.0)

    comment = Column(Text, default="")
    period = Column(String, default="")  # YYYY-MM or YYYY-Q1
    created_at = Column(DateTime, default=datetime.utcnow)
