"""Reports API — Dashboard stats, custom reports, scheduled reports."""
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import require_admin, require_staff
from app.database import get_db
from app.models.erp import (
    Employee,
    Equipment,
    Invoice,
    Lead,
    Payment,
    Project,
    ProjectExpense,
    QHSEIncident,
    SAVTicket,
    ScheduledReport,
    StockItem,
)


async def _invoice_ids_with_payments(db: AsyncSession) -> set[str]:
    """IDs of invoices that already have ≥1 Payment row — so a fully-paid
    invoice is never counted both via its Payment(s) AND its total."""
    rows = await db.execute(select(Payment.invoice_id).distinct())
    return {x for x in rows.scalars().all() if x}

# Human-readable French labels for ProjectExpense.category keys.
EXPENSE_CATEGORY_LABELS = {
    "materials": "Matériaux",
    "labor": "Main d'œuvre",
    "subcontractor": "Sous-traitance",
    "logistics": "Logistique",
    "equipment": "Équipement",
    "misc": "Divers",
}
from app.services.activity_service import log_activity

router = APIRouter(prefix="/reports", tags=["Reports"])


from app.utils.time import utcnow_naive as _now


# ── Dashboard ────────────────────────────────────────────────

@router.get("/dashboard")
async def dashboard_stats(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated KPIs for the ERP dashboard."""
    # Active projects
    active_p = await db.execute(
        select(func.count(Project.id)).where(Project.status == "EN_COURS", Project.deleted_at.is_(None))
    )
    # Monthly revenue — cash-basis (encaissements) this month, with the
    # PAYEE-without-Payment fallback; the accrual figure is exposed too.
    month_start = _now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    pay_sum = (await db.execute(
        select(func.sum(Payment.amount)).where(Payment.paid_at >= month_start)
    )).scalar() or 0
    _paid_ids = await _invoice_ids_with_payments(db)
    _inv_rows = (await db.execute(
        select(Invoice.id, Invoice.total).where(
            Invoice.status == "PAYEE",
            Invoice.paid_at >= month_start,
            Invoice.deleted_at.is_(None),
        )
    )).all()
    monthly_invoiced = sum(float(t or 0) for _, t in _inv_rows)
    monthly_cash = float(pay_sum) + sum(
        float(t or 0) for iid, t in _inv_rows if iid not in _paid_ids
    )
    # Active employees
    emp_r = await db.execute(
        select(func.count(Employee.id)).where(
            Employee.is_active == True, Employee.deleted_at.is_(None)  # noqa: E712
        )
    )
    # Open SAV
    open_sav = await db.execute(
        select(func.count(SAVTicket.id)).where(
            SAVTicket.status.in_(["OUVERT", "EN_COURS"]),
            SAVTicket.deleted_at.is_(None),
        )
    )
    # Open incidents
    open_qhse = await db.execute(
        select(func.count(QHSEIncident.id)).where(
            QHSEIncident.status.in_(["OUVERT", "EN_COURS"]),
            QHSEIncident.deleted_at.is_(None),
        )
    )
    # Low stock items
    low_stock_r = await db.execute(
        select(func.count(StockItem.id)).where(StockItem.quantity <= StockItem.alert_threshold)
    )
    return {
        "active_projects": active_p.scalar() or 0,
        "monthly_revenue": monthly_cash,                  # cash-basis (encaissements)
        "monthly_revenue_invoiced": monthly_invoiced,     # accrual (factures soldées)
        "active_employees": emp_r.scalar() or 0,
        "open_sav_tickets": open_sav.scalar() or 0,
        "open_incidents": open_qhse.scalar() or 0,
        "low_stock_items": low_stock_r.scalar() or 0,
    }


@router.get("/alerts")
async def dashboard_alerts(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Real alerts for the dashboard widget."""
    alerts: list[dict] = []

    # Late projects (estimated_end_date in the past, still EN_COURS)
    late_r = await db.execute(
        select(Project).where(
            Project.status == "EN_COURS",
            Project.estimated_end_date < _now(),
            Project.deleted_at.is_(None),
        )
    )
    for p in late_r.scalars().all():
        alerts.append({
            "type": "PROJECT_LATE",
            "severity": "high",
            "title": f"Retard chantier {p.name}",
            "description": "L'échéance prévue est dépassée.",
            "link": f"/erp/chantiers?project={p.id}",
        })

    # Budget overruns
    over_r = await db.execute(select(Project).where(Project.deleted_at.is_(None)))
    for p in over_r.scalars().all():
        if p.budget_initial and p.budget_spent > p.budget_initial:
            ratio = (p.budget_spent - p.budget_initial) / p.budget_initial * 100
            alerts.append({
                "type": "BUDGET_OVERRUN",
                "severity": "medium" if ratio < 10 else "high",
                "title": f"Dépassement budget {p.name}",
                "description": f"+{ratio:.0f}% au-dessus du budget prévu",
                "link": f"/erp/finances?project={p.id}",
            })

    # Low stock
    low_r = await db.execute(
        select(StockItem).where(StockItem.quantity <= StockItem.alert_threshold)
    )
    for s in low_r.scalars().all():
        alerts.append({
            "type": "STOCK_LOW",
            "severity": "medium",
            "title": f"Stock bas — {s.name}",
            "description": f"{s.quantity} {s.unit} restants (seuil : {s.alert_threshold})",
            "link": "/erp/achats",
        })

    # QHSE critical incidents
    crit_r = await db.execute(
        select(QHSEIncident).where(
            QHSEIncident.status != "CLOTURE",
            QHSEIncident.severity.in_(["GRAVE", "CRITIQUE"]),
            QHSEIncident.deleted_at.is_(None),
        )
    )
    for inc in crit_r.scalars().all():
        alerts.append({
            "type": "QHSE_INCIDENT",
            "severity": "high",
            "title": f"Incident QHSE — {inc.title}",
            "description": inc.description or "",
            "link": f"/erp/qhse?incident={inc.id}",
        })

    # Overdue invoices
    overdue_r = await db.execute(
        select(Invoice).where(
            Invoice.status == "ENVOYEE",
            Invoice.due_date < _now(),
            Invoice.deleted_at.is_(None),
        )
    )
    for inv in overdue_r.scalars().all():
        alerts.append({
            "type": "INVOICE_OVERDUE",
            "severity": "medium",
            "title": f"Facture en retard — {inv.code}",
            "description": f"{inv.total:,.0f} FCFA en attente",
            "link": "/erp/facturation",
        })

    return alerts


# ── Revenue & profitability time series ──────────────────────

@router.get("/revenue-by-month")
async def revenue_by_month(
    months: int = 12,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Monthly revenue for the last N months, on TWO bases:

      • `revenue`  → cash-basis (reconnaissance à l'encaissement): real `Payment`
        rows (partials included) + any PAYEE invoice that has no Payment row.
      • `invoiced` → accrual basis: total of invoices that became PAYEE.
    """
    cutoff = (_now() - timedelta(days=months * 31)).replace(day=1)
    cash: dict[str, float] = {}
    invoiced: dict[str, float] = {}

    # 1) Encaissements réels (Payment) — partiels inclus
    pr = await db.execute(
        select(Payment.paid_at, Payment.amount).where(Payment.paid_at >= cutoff)
    )
    for paid_at, amount in pr.all():
        if not paid_at:
            continue
        k = paid_at.strftime("%Y-%m")
        cash[k] = cash.get(k, 0) + float(amount or 0)

    # 2) Factures soldées : total → `invoiced`; + bascule en cash si aucune
    #    ligne Payment (factures marquées payées sans encaissement enregistré)
    paid_ids = await _invoice_ids_with_payments(db)
    ir = await db.execute(
        select(Invoice.id, Invoice.paid_at, Invoice.total).where(
            Invoice.status == "PAYEE",
            Invoice.paid_at >= cutoff,
            Invoice.deleted_at.is_(None),
        )
    )
    for inv_id, paid_at, total in ir.all():
        if not paid_at:
            continue
        k = paid_at.strftime("%Y-%m")
        invoiced[k] = invoiced.get(k, 0) + float(total or 0)
        if inv_id not in paid_ids:
            cash[k] = cash.get(k, 0) + float(total or 0)

    keys = sorted(set(cash) | set(invoiced))
    return [{"month": k, "revenue": cash.get(k, 0), "invoiced": invoiced.get(k, 0)} for k in keys]


@router.get("/margin-by-project")
async def margin_by_project(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    # Cash-basis revenue per project, precomputed in 2 grouped queries (no N+1):
    #   Σ Payment.amount (joined to Invoice) + PAYEE invoices without any Payment.
    cash_rows = await db.execute(
        select(Invoice.project_id, func.sum(Payment.amount))
        .select_from(Payment).join(Invoice, Payment.invoice_id == Invoice.id)
        .where(Invoice.deleted_at.is_(None))
        .group_by(Invoice.project_id)
    )
    cash_by_project: dict[str, float] = {pid: float(s or 0) for pid, s in cash_rows.all()}

    paid_ids = await _invoice_ids_with_payments(db)
    fallback_by_project: dict[str, float] = {}
    fb_rows = await db.execute(
        select(Invoice.project_id, Invoice.id, Invoice.total).where(
            Invoice.status == "PAYEE", Invoice.deleted_at.is_(None)
        )
    )
    for pid, iid, total in fb_rows.all():
        if iid not in paid_ids:
            fallback_by_project[pid] = fallback_by_project.get(pid, 0) + float(total or 0)

    r = await db.execute(select(Project).where(Project.deleted_at.is_(None)))
    out = []
    for p in r.scalars().all():
        revenue = cash_by_project.get(p.id, 0.0) + fallback_by_project.get(p.id, 0.0)
        spent = float(p.budget_spent or 0)
        margin_pct = (revenue - spent) / revenue * 100 if revenue else 0.0
        out.append({
            "project_id": p.id,
            "project_name": p.name,
            "budget": p.budget_initial,
            "spent": spent,
            "revenue": revenue,
            "margin_pct": round(margin_pct, 1),
        })
    return out


# ── CRM funnel ───────────────────────────────────────────────

@router.get("/crm-funnel")
async def crm_funnel(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Lead.status, func.count(Lead.id)).where(Lead.deleted_at.is_(None)).group_by(Lead.status)
    )
    return [{"status": s, "count": c} for s, c in r.all()]


# ── Expense breakdown (pie chart) ────────────────────────────

@router.get("/expense-breakdown")
async def expense_breakdown(
    project_id: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Total project expenses grouped by category, with percentages.

    Feeds the dashboard "répartition des dépenses" pie chart. Returns an empty
    list when there are no expenses (the chart shows its own empty state).
    """
    q = select(ProjectExpense.category, func.sum(ProjectExpense.amount)).where(
        ProjectExpense.deleted_at.is_(None)
    )
    if project_id:
        q = q.where(ProjectExpense.project_id == project_id)
    q = q.group_by(ProjectExpense.category)
    r = await db.execute(q)
    rows = [(cat or "misc", float(total or 0)) for cat, total in r.all()]
    grand_total = sum(amount for _, amount in rows)
    out = [
        {
            "category": cat,
            "label": EXPENSE_CATEGORY_LABELS.get(cat, cat.capitalize() if cat else "Divers"),
            "amount": amount,
            "percentage": round(amount / grand_total * 100, 1) if grand_total else 0.0,
        }
        for cat, amount in rows
    ]
    out.sort(key=lambda x: x["amount"], reverse=True)
    return out


# ── Project performance (progress vs budget) ─────────────────

@router.get("/project-performance")
async def project_performance(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Per-project progress (%) vs budget consumption (%) — bar chart."""
    r = await db.execute(
        select(Project).where(Project.deleted_at.is_(None)).order_by(Project.created_at.desc())
    )
    out = []
    for p in r.scalars().all():
        budget = float(p.budget_initial or 0)
        spent = float(p.budget_spent or 0)
        budget_used = round(spent / budget * 100, 1) if budget else 0.0
        out.append({
            "project_id": p.id,
            "project_name": p.name,
            "status": p.status,
            "progress": p.progress or 0,
            "budget_initial": budget,
            "budget_spent": spent,
            "budget_used_pct": budget_used,
        })
    return out


# ── Projects by type (distribution) ──────────────────────────

@router.get("/projects-by-type")
async def projects_by_type(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Count of projects grouped by project_type — distribution chart."""
    r = await db.execute(
        select(Project.project_type, func.count(Project.id))
        .where(Project.deleted_at.is_(None))
        .group_by(Project.project_type)
    )
    out = [
        {"type": (ptype or "Non spécifié"), "count": count}
        for ptype, count in r.all()
    ]
    out.sort(key=lambda x: x["count"], reverse=True)
    return out


# ── Scheduled reports ────────────────────────────────────────

class ScheduledReportCreate(BaseModel):
    name: str
    report_type: str
    frequency: str = "WEEKLY"
    recipients: list[str] = []


@router.get("/scheduled")
async def list_scheduled(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(ScheduledReport).where(ScheduledReport.deleted_at.is_(None)).order_by(ScheduledReport.name)
    )
    return [
        {
            "id": s.id, "name": s.name, "report_type": s.report_type,
            "frequency": s.frequency, "recipients": s.recipients,
            "is_active": s.is_active, "last_run_at": s.last_run_at,
            "next_run_at": s.next_run_at, "created_at": s.created_at,
        }
        for s in r.scalars().all()
    ]


@router.post("/scheduled")
async def create_scheduled(
    data: ScheduledReportCreate,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    s = ScheduledReport(**data.model_dump(), created_by=user.id)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return {"id": s.id}


@router.patch("/scheduled/{report_id}/toggle")
async def toggle_scheduled(
    report_id: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(ScheduledReport).where(ScheduledReport.id == report_id))
    s = r.scalars().first()
    if not s:
        raise HTTPException(404, "Rapport planifié introuvable")
    s.is_active = not s.is_active
    s.updated_at = _now()
    await db.commit()
    return {"is_active": s.is_active}


@router.delete("/scheduled/{report_id}")
async def delete_scheduled(
    report_id: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(ScheduledReport).where(ScheduledReport.id == report_id))
    s = r.scalars().first()
    if not s:
        raise HTTPException(404, "Rapport planifié introuvable")
    s.deleted_at = _now()
    await db.commit()
    return {"detail": "Rapport supprimé"}
