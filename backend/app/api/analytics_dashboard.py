"""
Analytics Dashboard API — KPIs, trends, aggregations per V4 Part XXIII.
Routes: /api/v1/analytics/*
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, case, and_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.auth.service import require_staff, require_admin
from app.models.erp import (
    Project, Invoice, PurchaseOrder, Payment, Quote,
    ProjectExpense, Lead, ActivityLog,
)
from app.models.suppliers import Supplier, Delivery, SupplierInvoice
from app.models.extensions import Lot, Milestone, Risk, ChangeOrder
from app.models.bim_hub import BimIssue, Clash
from app.models.security_audit import AuditEvent

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ── Executive Dashboard ──────────────────────────────────────

@router.get("/executive")
async def executive_dashboard(db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    projects_total = (await db.execute(select(func.count()).where(Project.deleted_at.is_(None)))).scalar() or 0
    projects_active = (await db.execute(select(func.count()).where(Project.status == "EN_COURS", Project.deleted_at.is_(None)))).scalar() or 0

    revenue_month = (await db.execute(
        select(func.sum(Payment.amount)).where(Payment.paid_at >= month_start)
    )).scalar() or 0

    invoices_pending = (await db.execute(
        select(func.sum(Invoice.total)).where(Invoice.status.in_(["ENVOYEE", "EN_RETARD"]))
    )).scalar() or 0

    expenses_month = (await db.execute(
        select(func.sum(ProjectExpense.amount)).where(ProjectExpense.expense_date >= month_start)
    )).scalar() or 0

    quotes_pending = (await db.execute(
        select(func.count()).where(Quote.status == "ENVOYEE")
    )).scalar() or 0

    contacts_total = (await db.execute(
        select(func.count()).where(Lead.deleted_at.is_(None))
    )).scalar() or 0

    suppliers_active = (await db.execute(
        select(func.count()).where(Supplier.status == "ACTIF", Supplier.deleted_at.is_(None))
    )).scalar() or 0

    return {
        "projects": {"total": projects_total, "active": projects_active},
        "finance": {
            "revenue_month": float(revenue_month or 0),
            "pending_invoices": float(invoices_pending or 0),
            "expenses_month": float(expenses_month or 0),
            "margin_month": float((revenue_month or 0) - (expenses_month or 0)),
        },
        "commercial": {
            "quotes_pending": quotes_pending,
            "contacts_total": contacts_total,
        },
        "supply_chain": {
            "suppliers_active": suppliers_active,
        },
        "generated_at": now.isoformat(),
    }


# ── Project Analytics ────────────────────────────────────────

@router.get("/projects/{project_id}")
async def project_analytics(project_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not project:
        return {"error": "Project not found"}

    lots = (await db.execute(select(func.count()).where(Lot.project_id == project_id, Lot.deleted_at.is_(None)))).scalar() or 0
    lots_budget = (await db.execute(select(func.sum(Lot.budget)).where(Lot.project_id == project_id))).scalar() or 0
    lots_actual = (await db.execute(select(func.sum(Lot.actual_cost)).where(Lot.project_id == project_id))).scalar() or 0

    milestones_total = (await db.execute(select(func.count()).where(Milestone.project_id == project_id))).scalar() or 0
    milestones_done = (await db.execute(select(func.count()).where(Milestone.project_id == project_id, Milestone.status == "COMPLETE"))).scalar() or 0

    risks_open = (await db.execute(select(func.count()).where(Risk.project_id == project_id, Risk.status == "IDENTIFIE"))).scalar() or 0
    risks_critical = (await db.execute(select(func.count()).where(Risk.project_id == project_id, Risk.risk_score >= 9))).scalar() or 0

    cos = (await db.execute(select(func.count()).where(ChangeOrder.project_id == project_id))).scalar() or 0
    co_cost = (await db.execute(select(func.sum(ChangeOrder.cost_impact)).where(ChangeOrder.project_id == project_id, ChangeOrder.status == "APPROUVE"))).scalar() or 0

    bim_issues_open = (await db.execute(select(func.count()).where(BimIssue.project_id == project_id, BimIssue.status.in_(["OUVERTE", "EN_COURS"])))).scalar() or 0
    clashes_open = (await db.execute(select(func.count()).where(Clash.project_id == project_id, Clash.status.in_(["NOUVEAU", "EN_COURS"])))).scalar() or 0
    cost_avoided = (await db.execute(select(func.sum(Clash.cost_avoided)).where(Clash.project_id == project_id, Clash.status == "RESOLU"))).scalar() or 0

    return {
        "project_id": project_id,
        "lots": {"count": lots, "budget": float(lots_budget or 0), "actual": float(lots_actual or 0), "variance": float((lots_budget or 0) - (lots_actual or 0))},
        "milestones": {"total": milestones_total, "done": milestones_done, "progress_pct": round(milestones_done / max(milestones_total, 1) * 100, 1)},
        "risks": {"open": risks_open, "critical": risks_critical},
        "change_orders": {"count": cos, "approved_cost_impact": float(co_cost or 0)},
        "bim": {"issues_open": bim_issues_open, "clashes_open": clashes_open, "cost_avoided": float(cost_avoided or 0)},
    }


# ── Financial Trends ─────────────────────────────────────────

@router.get("/finance/trends")
async def finance_trends(
    months: int = 12,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_admin),
):
    now = datetime.utcnow()
    results = []
    for i in range(months - 1, -1, -1):
        m_start = (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if m_start.month == 12:
            m_end = m_start.replace(year=m_start.year + 1, month=1)
        else:
            m_end = m_start.replace(month=m_start.month + 1)

        revenue = (await db.execute(
            select(func.sum(Payment.amount)).where(Payment.paid_at >= m_start, Payment.paid_at < m_end)
        )).scalar() or 0

        expenses = (await db.execute(
            select(func.sum(ProjectExpense.amount)).where(ProjectExpense.expense_date >= m_start, ProjectExpense.expense_date < m_end)
        )).scalar() or 0

        invoiced = (await db.execute(
            select(func.sum(Invoice.total)).where(Invoice.created_at >= m_start, Invoice.created_at < m_end)
        )).scalar() or 0

        results.append({
            "month": m_start.strftime("%Y-%m"),
            "revenue": float(revenue or 0),
            "expenses": float(expenses or 0),
            "margin": float((revenue or 0) - (expenses or 0)),
            "invoiced": float(invoiced or 0),
        })
    return results


# ── Supply Chain Analytics ───────────────────────────────────

@router.get("/supply-chain")
async def supply_chain_analytics(db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    suppliers_total = (await db.execute(select(func.count()).where(Supplier.deleted_at.is_(None)))).scalar() or 0
    suppliers_active = (await db.execute(select(func.count()).where(Supplier.status == "ACTIF", Supplier.deleted_at.is_(None)))).scalar() or 0
    avg_quality = (await db.execute(select(func.avg(Supplier.quality_score)).where(Supplier.deleted_at.is_(None)))).scalar() or 0

    deliveries_pending = (await db.execute(select(func.count()).where(Delivery.status.in_(["ATTENDUE", "EXPEDIEE", "EN_TRANSIT"])))).scalar() or 0
    deliveries_received = (await db.execute(select(func.count()).where(Delivery.status == "RECUE"))).scalar() or 0

    invoices_pending = (await db.execute(select(func.count()).where(SupplierInvoice.status == "BROUILLON"))).scalar() or 0
    invoices_total_pending = (await db.execute(select(func.sum(SupplierInvoice.amount_ttc)).where(SupplierInvoice.status.in_(["BROUILLON", "SOUMISE"])))).scalar() or 0

    return {
        "suppliers": {"total": suppliers_total, "active": suppliers_active, "avg_quality": round(float(avg_quality or 0), 2)},
        "deliveries": {"pending": deliveries_pending, "received": deliveries_received},
        "invoices": {"pending_count": invoices_pending, "pending_amount": float(invoices_total_pending or 0)},
    }


# ── Activity Feed ────────────────────────────────────────────

@router.get("/activity")
async def activity_feed(
    skip: int = 0,
    limit: int = 50,
    entity_type: Optional[str] = None,
    user_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_staff),
):
    q = select(ActivityLog)
    if entity_type:
        q = q.where(ActivityLog.entity_type == entity_type)
    if user_id:
        q = q.where(ActivityLog.actor_id == user_id)
    rows = (await db.execute(q.order_by(ActivityLog.created_at.desc()).offset(skip).limit(limit))).scalars().all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]


# ── Audit Log ────────────────────────────────────────────────

@router.get("/audit-log")
async def audit_log(
    skip: int = 0,
    limit: int = 100,
    event_family: Optional[str] = None,
    user_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_admin),
):
    q = select(AuditEvent)
    if event_family:
        q = q.where(AuditEvent.event_family == event_family)
    if user_id:
        q = q.where(AuditEvent.user_id == user_id)
    rows = (await db.execute(q.order_by(AuditEvent.created_at.desc()).offset(skip).limit(limit))).scalars().all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in rows]
