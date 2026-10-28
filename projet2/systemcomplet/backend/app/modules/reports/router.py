"""Rapports & tableaux de bord (§7 Dashboard / Rapports, application Direction) : KPI portefeuille, trésorerie,
marges, approbations en attente, alertes ; exports CSV / XLSX contrôlés par permission et tracés."""

from __future__ import annotations

import csv
import io
import uuid
from collections.abc import Callable
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.database import get_db
from app.core.errors import BusinessRuleError
from app.core.utils import jsonable, money, utcnow

router = APIRouter(prefix="/reports", tags=["Rapports & tableaux de bord"])


def _scope(access: Access) -> list[uuid.UUID] | None:
    scope = access.project_scope()
    return None if scope is None else list(scope)


def _in_scope(stmt: Any, column: Any, scope: list[uuid.UUID] | None) -> Any:
    return stmt if scope is None else stmt.where(column.in_(scope or [uuid.uuid4()]))


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """Tableau de bord ERP / Direction : un seul appel pour le web, le desktop et le mobile Direction."""
    from app.modules.billing.models import ClientInvoice, SupplierInvoice
    from app.modules.finance.models import FundsCall, Payment
    from app.modules.procurement.models import Approval, PurchaseRequest
    from app.modules.projects.models import Decision, Milestone, Project
    from app.modules.qhse.models import Incident
    from app.modules.subcontracting.models import Situation, Subcontract
    from app.modules.support.models import Ticket

    access.require("dashboard:view")
    scope = _scope(access)
    today = date.today()
    projects = (
        db.execute(_in_scope(select(Project).where(Project.deleted_at.is_(None)), Project.id, scope)).scalars().all()
    )
    active = [p for p in projects if p.status in ("preparation", "execution")]
    health: dict[str, int] = {}
    for p in active:
        health[p.health] = health.get(p.health, 0) + 1
    late_milestones = db.execute(
        _in_scope(
            select(func.count())
            .select_from(Milestone)
            .where(Milestone.status == "planned", Milestone.due_date < today),
            Milestone.project_id,
            scope,
        )
    ).scalar_one()
    incidents = db.execute(
        _in_scope(
            select(func.count())
            .select_from(Incident)
            .where(Incident.status != "closed", Incident.severity.in_(["high", "critical"])),
            Incident.project_id,
            scope,
        )
    ).scalar_one()
    approvals = {
        "purchase_requests": db.execute(
            select(func.count())
            .select_from(Approval)
            .where(
                Approval.status == "pending",
                Approval.entity_type == "purchase_request",
                Approval.approver_role.in_(list(access.p.roles) or [""]),
            )
        ).scalar_one(),
        "payments": db.execute(
            select(func.count()).select_from(Payment).where(Payment.status == "awaiting_approval")
        ).scalar_one()
        if access.has("finance:approve")
        else 0,
        "situations": db.execute(
            _in_scope(
                select(func.count())
                .select_from(Situation)
                .join(Subcontract, Subcontract.id == Situation.subcontract_id)
                .where(Situation.status == "field_checked"),
                Subcontract.project_id,
                scope,
            )
        ).scalar_one()
        if access.has("subcontracting:validate")
        else 0,
        "client_decisions_pending": db.execute(
            _in_scope(
                select(func.count()).select_from(Decision).where(Decision.status == "pending_client"),
                Decision.project_id,
                scope,
            )
        ).scalar_one(),
        "draft_requests": db.execute(
            _in_scope(
                select(func.count()).select_from(PurchaseRequest).where(PurchaseRequest.status == "submitted"),
                PurchaseRequest.project_id,
                scope,
            )
        ).scalar_one(),
    }
    out: dict[str, Any] = {
        "generated_at": utcnow(),
        "projects": {
            "total": len(projects),
            "active": len(active),
            "health": health,
            "avg_progress": round(sum(float(p.progress_pct or 0) for p in active) / len(active), 1) if active else None,
        },
        "planning": {"late_milestones": late_milestones},
        "qhse": {"open_serious_incidents": incidents},
        "approvals": approvals,
        "support": {
            "open_tickets": db.execute(
                _in_scope(
                    select(func.count()).select_from(Ticket).where(Ticket.status.not_in(["closed", "cancelled"])),
                    Ticket.project_id,
                    scope,
                )
            ).scalar_one(),
            "sla_breached": db.execute(
                _in_scope(
                    select(func.count())
                    .select_from(Ticket)
                    .where(
                        Ticket.status.not_in(["closed", "cancelled"]),
                        Ticket.response_breached | Ticket.resolution_breached,
                    ),
                    Ticket.project_id,
                    scope,
                )
            ).scalar_one(),
        },
    }
    if access.has("dashboard:direction") or access.has("finance:read"):
        from app.modules.finance.service import cashflow, margins

        receivable = db.execute(
            _in_scope(
                select(func.coalesce(func.sum(FundsCall.amount - FundsCall.amount_paid), 0)).where(
                    FundsCall.status.in_(["issued", "partially_paid", "overdue"])
                ),
                FundsCall.project_id,
                scope,
            )
        ).scalar_one()
        overdue = db.execute(
            _in_scope(
                select(func.coalesce(func.sum(FundsCall.amount - FundsCall.amount_paid), 0)).where(
                    FundsCall.status == "overdue"
                ),
                FundsCall.project_id,
                scope,
            )
        ).scalar_one()
        payable = db.execute(
            _in_scope(
                select(func.coalesce(func.sum(SupplierInvoice.total - SupplierInvoice.amount_paid), 0)).where(
                    SupplierInvoice.status.in_(["approved_for_payment", "partially_paid"])
                ),
                SupplierInvoice.project_id,
                scope,
            )
        ).scalar_one()
        month_start = today.replace(day=1)
        collected = db.execute(
            _in_scope(
                select(func.coalesce(func.sum(Payment.amount), 0)).where(
                    Payment.direction == "in", Payment.status == "succeeded", func.date(Payment.paid_at) >= month_start
                ),
                Payment.project_id,
                scope,
            )
        ).scalar_one()
        invoiced = db.execute(
            _in_scope(
                select(func.coalesce(func.sum(ClientInvoice.total), 0)).where(
                    ClientInvoice.status.not_in(["draft", "cancelled"])
                ),
                ClientInvoice.project_id,
                scope,
            )
        ).scalar_one()
        project_margins = margins(db, scope)
        active_ids = {p.id for p in active}
        contracts_value = money(sum((Decimal(p.contract_amount or 0) for p in active), Decimal("0")))
        changes_value = money(
            sum(
                (Decimal(m["approved_change_orders"] or 0) for m in project_margins if m["project_id"] in active_ids),
                Decimal("0"),
            )
        )
        out["finance"] = {
            # Valeur du portefeuille : contrats signés + avenants approuvés, avec le détail des deux.
            "portfolio_value": money(contracts_value + changes_value),
            "portfolio_contracts": contracts_value,
            "portfolio_changes": changes_value,
            "invoiced": invoiced,
            "receivable": receivable,
            "overdue": overdue,
            "payable": payable,
            "collected_this_month": collected,
            "cashflow": cashflow(db, project_id=None, months=6),
            "margins": sorted(project_margins, key=lambda m: m.get("margin_pct") or 0)[:20],
        }
    return jsonable(out)


# ============================================================================ exports
def _rows_projects(db: Session, access: Access) -> tuple[list[str], list[list[Any]]]:
    from app.modules.projects.models import Project

    rows = db.execute(
        _in_scope(select(Project).where(Project.deleted_at.is_(None)), Project.id, _scope(access))
    ).scalars()
    from app.modules.projects.service import approved_changes_total

    finance = access.has("finance:read")
    header = [
        "code",
        "nom",
        "statut",
        "santé",
        "avancement_%",
        "ville",
        "début_prévu",
        "fin_prévue",
        "montant_contrat_avenants_non_inclus",
        "avenants_approuvés",
    ]
    return header, [
        [
            p.code,
            p.name,
            p.status,
            p.health,
            p.progress_pct,
            p.city,
            p.start_planned,
            p.end_planned,
            p.contract_amount if finance else "",
            approved_changes_total(db, p.id) if finance else "",
        ]
        for p in rows
    ]


def _rows_leads(db: Session, access: Access) -> tuple[list[str], list[list[Any]]]:
    from app.modules.crm.models import Lead

    access.require("crm:read")
    rows = db.execute(select(Lead).order_by(Lead.created_at.desc()).limit(50000)).scalars()
    header = ["numéro", "date", "source", "univers", "prénom", "nom", "ville", "pays", "score", "température", "statut"]
    return header, [
        [
            x.number,
            x.created_at,
            x.source,
            x.universe,
            x.first_name,
            x.last_name,
            x.city,
            x.country,
            x.score,
            x.temperature,
            x.status,
        ]
        for x in rows
    ]


def _rows_purchase_orders(db: Session, access: Access) -> tuple[list[str], list[list[Any]]]:
    from app.modules.procurement.models import PurchaseOrder
    from app.modules.suppliers.models import Supplier

    access.require("procurement:read")
    rows = db.execute(
        _in_scope(
            select(PurchaseOrder, Supplier.legal_name)
            .join(Supplier, Supplier.id == PurchaseOrder.supplier_id)
            .where(PurchaseOrder.deleted_at.is_(None)),
            PurchaseOrder.project_id,
            _scope(access),
        )
    ).all()
    header = ["numéro", "date", "fournisseur", "statut", "total_ht", "tva", "total_ttc", "canal", "date_souhaitée"]
    return header, [
        [
            po.number,
            po.created_at,
            name,
            po.status,
            po.subtotal,
            po.tax_amount,
            po.total,
            po.sent_channel,
            po.expected_date,
        ]
        for po, name in rows
    ]


def _rows_supplier_invoices(db: Session, access: Access) -> tuple[list[str], list[list[Any]]]:
    from app.modules.billing.models import SupplierInvoice
    from app.modules.suppliers.models import Supplier

    access.require("billing:read")
    rows = db.execute(
        _in_scope(
            select(SupplierInvoice, Supplier.legal_name)
            .join(Supplier, Supplier.id == SupplierInvoice.supplier_id)
            .where(SupplierInvoice.deleted_at.is_(None)),
            SupplierInvoice.project_id,
            _scope(access),
        )
    ).all()
    header = [
        "numéro",
        "réf_fournisseur",
        "fournisseur",
        "date",
        "échéance",
        "total",
        "payé",
        "statut",
        "rapprochement",
    ]
    return header, [
        [
            i.number,
            i.supplier_reference,
            name,
            i.invoice_date,
            i.due_date,
            i.total,
            i.amount_paid,
            i.status,
            i.match_status,
        ]
        for i, name in rows
    ]


def _rows_client_invoices(db: Session, access: Access) -> tuple[list[str], list[list[Any]]]:
    from app.modules.billing.models import ClientInvoice

    access.require("billing:read")
    rows = db.execute(
        _in_scope(
            select(ClientInvoice).where(ClientInvoice.deleted_at.is_(None)), ClientInvoice.project_id, _scope(access)
        )
    ).scalars()
    header = ["numéro", "titre", "date", "échéance", "total", "payé", "statut"]
    return header, [[i.number, i.title, i.issue_date, i.due_date, i.total, i.amount_paid, i.status] for i in rows]


def _rows_payments(db: Session, access: Access) -> tuple[list[str], list[list[Any]]]:
    from app.modules.finance.models import Payment

    access.require("finance:read")
    rows = db.execute(_in_scope(select(Payment), Payment.project_id, _scope(access))).scalars()
    header = [
        "numéro",
        "sens",
        "tiers",
        "montant",
        "devise",
        "moyen",
        "prestataire",
        "statut",
        "date_paiement",
        "référence",
    ]
    return header, [
        [
            p.number,
            p.direction,
            p.counterparty_label,
            p.amount,
            p.currency,
            p.method,
            p.provider,
            p.status,
            p.paid_at,
            p.provider_reference,
        ]
        for p in rows
    ]


def _rows_stock(db: Session, access: Access) -> tuple[list[str], list[list[Any]]]:
    from app.modules.inventory.service import stock_overview

    access.require("inventory:read")
    header = ["sku", "article", "catégorie", "unité", "quantité", "réservé", "disponible", "seuil", "cmup", "valeur"]
    return header, [
        [
            r["sku"],
            r["name"],
            r["category"],
            r["unit"],
            r["quantity"],
            r["reserved"],
            r["available"],
            r["min_threshold"],
            r["average_cost"],
            r["value"],
        ]
        for r in stock_overview(db)
    ]


def _rows_attendance(db: Session, access: Access) -> tuple[list[str], list[list[Any]]]:
    from app.modules.hr.service import attendance_summary

    access.require("hr:read")
    end = date.today()
    start = end.replace(day=1)
    header = ["matricule", "nom", "jours_présents", "heures", "heures_sup", "retards", "absences"]
    return header, [
        [r["matricule"], r["name"], r["days_present"], r["hours"], r["overtime_hours"], r["late"], r["absences"]]
        for r in attendance_summary(db, start=start, end=end)
    ]


def _rows_incidents(db: Session, access: Access) -> tuple[list[str], list[list[Any]]]:
    from app.modules.qhse.models import Incident

    access.require("qhse:read")
    rows = db.execute(_in_scope(select(Incident), Incident.project_id, _scope(access))).scalars()
    header = ["numéro", "date", "type", "gravité", "titre", "jours_perdus", "statut"]
    return header, [[i.number, i.occurred_at, i.kind, i.severity, i.title, i.lost_time_days, i.status] for i in rows]


def _rows_tickets(db: Session, access: Access) -> tuple[list[str], list[list[Any]]]:
    from app.modules.support.models import Ticket

    access.require("support:read")
    rows = db.execute(_in_scope(select(Ticket), Ticket.project_id, _scope(access))).scalars()
    header = [
        "numéro",
        "date",
        "catégorie",
        "priorité",
        "objet",
        "statut",
        "garantie",
        "sla_réponse_dépassé",
        "satisfaction",
    ]
    return header, [
        [
            t.number,
            t.created_at,
            t.category,
            t.priority,
            t.subject,
            t.status,
            t.within_warranty,
            t.response_breached,
            t.satisfaction_rating,
        ]
        for t in rows
    ]


def _rows_situations(db: Session, access: Access) -> tuple[list[str], list[list[Any]]]:
    from app.modules.subcontracting.models import Situation, Subcontract, Subcontractor

    access.require("subcontracting:read")
    rows = db.execute(
        _in_scope(
            select(Situation, Subcontract.number, Subcontractor.legal_name)
            .join(Subcontract, Subcontract.id == Situation.subcontract_id)
            .join(Subcontractor, Subcontractor.id == Subcontract.subcontractor_id),
            Subcontract.project_id,
            _scope(access),
        )
    ).all()
    header = [
        "situation",
        "marché",
        "sous-traitant",
        "période_fin",
        "brut",
        "avance",
        "retenue",
        "pénalités",
        "net",
        "statut",
    ]
    return header, [
        [
            s.number,
            number,
            name,
            s.period_end,
            s.gross_amount,
            s.advance_recovered,
            s.retention_amount,
            s.penalties,
            s.net_amount,
            s.status,
        ]
        for s, number, name in rows
    ]


DATASETS: dict[str, Callable[[Session, Access], tuple[list[str], list[list[Any]]]]] = {
    "projects": _rows_projects,
    "leads": _rows_leads,
    "purchase_orders": _rows_purchase_orders,
    "supplier_invoices": _rows_supplier_invoices,
    "client_invoices": _rows_client_invoices,
    "payments": _rows_payments,
    "stock": _rows_stock,
    "attendance": _rows_attendance,
    "incidents": _rows_incidents,
    "tickets": _rows_tickets,
    "situations": _rows_situations,
}


def _cell(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, Decimal):
        return float(value)
    if hasattr(value, "tzinfo") and getattr(value, "tzinfo", None) is not None:
        return value.replace(tzinfo=None)
    if isinstance(value, bool):
        return "oui" if value else "non"
    text = str(value) if not isinstance(value, (int, float, date)) else value
    if isinstance(text, str) and text[:1] in ("=", "+", "-", "@"):
        return "'" + text  # neutralise l'injection de formules (CSV/XLSX)
    return text


@router.get("/export/{dataset}")
def export(
    dataset: str,
    format: str = Query(default="xlsx", pattern="^(csv|xlsx)$"),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> Response:
    access.require("reports:export")
    builder = DATASETS.get(dataset)
    if builder is None:
        raise BusinessRuleError(f"Jeu de données inconnu ({', '.join(sorted(DATASETS))})")
    header, rows = builder(db, access)
    audit.record(
        db,
        family="security",
        module="reports",
        action="EXPORT",
        resource_type="dataset",
        resource_id=dataset,
        diff={"format": format, "rows": len(rows)},
        criticality="MEDIUM",
    )
    db.commit()
    filename = f"globus-{dataset}-{date.today():%Y%m%d}.{format}"
    if format == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf, delimiter=";")
        writer.writerow(header)
        for row in rows:
            writer.writerow([_cell(v) for v in row])
        return Response(
            ("﻿" + buf.getvalue()).encode("utf-8"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill

    wb = Workbook()
    ws = wb.active
    ws.title = dataset[:31]
    ws.append(header)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="385AA6")
    for row in rows:
        ws.append([_cell(v) for v in row])
    ws.freeze_panes = "A2"
    for column in ws.columns:
        width = max((len(str(c.value)) for c in column if c.value is not None), default=8)
        ws.column_dimensions[column[0].column_letter].width = min(60, max(10, width + 2))
    out = io.BytesIO()
    wb.save(out)
    return Response(
        out.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/datasets")
def datasets(access: Access = Depends(get_access)) -> list[str]:
    access.require("reports:export")
    return sorted(DATASETS)


@router.get("/weekly")
def weekly(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """Synthèse hebdomadaire Direction : nouveaux leads, commandes, encaissements, incidents, avancement."""
    from app.modules.crm.models import Lead
    from app.modules.finance.models import Payment
    from app.modules.procurement.models import PurchaseOrder
    from app.modules.qhse.models import Incident

    access.require("reports:read")
    scope = _scope(access)
    since = utcnow() - timedelta(days=7)
    return jsonable(
        {
            "since": since,
            "leads": db.execute(select(func.count()).select_from(Lead).where(Lead.created_at >= since)).scalar_one()
            if access.has("crm:read")
            else None,
            "purchase_orders": db.execute(
                _in_scope(
                    select(func.count()).select_from(PurchaseOrder).where(PurchaseOrder.created_at >= since),
                    PurchaseOrder.project_id,
                    scope,
                )
            ).scalar_one(),
            "collected": db.execute(
                _in_scope(
                    select(func.coalesce(func.sum(Payment.amount), 0)).where(
                        Payment.direction == "in", Payment.status == "succeeded", Payment.paid_at >= since
                    ),
                    Payment.project_id,
                    scope,
                )
            ).scalar_one()
            if access.has("finance:read")
            else None,
            "incidents": db.execute(
                _in_scope(
                    select(func.count()).select_from(Incident).where(Incident.created_at >= since),
                    Incident.project_id,
                    scope,
                )
            ).scalar_one(),
        }
    )


# ---------------------------------------------------------------------------- rapport de direction (A7)
def _executive_out(report: Any, *, full: bool = False) -> dict[str, Any]:
    out = {
        "id": report.id,
        "number": report.number,
        "period_start": report.period_start,
        "period_end": report.period_end,
        "headline": report.summary_text,
        "ai_generated": report.ai_generated,
        "generated_by": report.generated_by,
        "sent_at": report.sent_at,
        "created_at": report.created_at,
        "has_pdf": report.pdf_file_id is not None,
    }
    if full:
        out["narrative"] = report.narrative
        out["data"] = report.data
    return jsonable(out)


def _executive(db: Session, report_id: uuid.UUID) -> Any:
    from app.core.errors import NotFound
    from app.modules.reports.models import ExecutiveReport

    report = db.get(ExecutiveReport, report_id)
    if report is None:
        raise NotFound("Rapport introuvable")
    return report


@router.get("/executive")
def executive_reports(
    limit: int = Query(26, ge=1, le=104), db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    """Rapports de direction hebdomadaires (les plus récents d'abord)."""
    from app.modules.reports.models import ExecutiveReport

    access.require("dashboard:direction")
    rows = db.execute(select(ExecutiveReport).order_by(ExecutiveReport.period_end.desc()).limit(limit)).scalars()
    return [_executive_out(r) for r in rows]


@router.get("/executive/{report_id}")
def executive_report(
    report_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("dashboard:direction")
    return _executive_out(_executive(db, report_id), full=True)


@router.post("/executive/generate", status_code=201)
def generate_executive(
    period_end: date | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    """(Re)génère le rapport d'une semaine (lundi → dimanche contenant `period_end`, par défaut la semaine écoulée)."""
    from app.modules.reports.executive import generate, last_week

    access.require("dashboard:direction")
    if period_end is not None:
        if period_end > date.today():
            raise BusinessRuleError("Semaine non écoulée", code="PERIOD_IN_FUTURE")
        start = period_end - timedelta(days=period_end.weekday())
        end = start + timedelta(days=6)
    else:
        start, end = last_week()
    report = generate(db, start, end, by="user", user_id=access.p.id, force=True)
    audit.record(
        db,
        family="business",
        module="reports",
        action="EXECUTIVE_REPORT",
        resource_type="executive_report",
        resource_id=report.id,
    )
    db.commit()
    return _executive_out(report, full=True)


@router.get("/executive/{report_id}/pdf")
def executive_pdf(report_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> Any:
    from app.core.downloads import file_response
    from app.core.errors import NotFound
    from app.modules.system.models import StoredFile

    access.require("dashboard:direction")
    report = _executive(db, report_id)
    stored = db.get(StoredFile, report.pdf_file_id) if report.pdf_file_id else None
    if stored is None:
        raise NotFound("PDF non disponible")
    audit.record(
        db,
        family="business",
        module="reports",
        action="DOWNLOAD",
        resource_type="executive_report",
        resource_id=report.id,
    )
    db.commit()
    return file_response(stored)
