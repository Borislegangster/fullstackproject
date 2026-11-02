"""Exports API — multi-format exports for every major ERP module.

Each endpoint builds `(headers, rows)` and streams an attachment in the
requested format (`fmt` query param): `xlsx` (default), `csv` or `pdf`.
Where a natural date column exists, `date_from` / `date_to` (YYYY-MM-DD)
filter the rows. Grouped under one prefix (`/api/v1/exports/*`).
"""
from __future__ import annotations

import csv as _csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import require_staff, require_rh, require_comptable
from app.database import get_db
from app.models.erp import (
    Employee, Invoice, Lead, Payroll, Project, PurchaseRequest, StockItem,
    SubContractorInvoice, TempWorker,
)
from app.services.excel_service import export_rows

router = APIRouter(prefix="/exports", tags=["Exports"])

XLSX_MEDIA = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
CSV_MEDIA = "text/csv; charset=utf-8"
PDF_MEDIA = "application/pdf"


def _stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")


def _fmt_date(value) -> str:
    if not value:
        return ""
    if hasattr(value, "strftime"):
        return value.strftime("%d/%m/%Y")
    return str(value)[:10]


def _parse_date(s: Optional[str]):
    if not s:
        return None
    try:
        return datetime.strptime(str(s)[:10], "%Y-%m-%d")
    except Exception:
        return None


def _date_range(q, col, date_from: Optional[str], date_to: Optional[str]):
    """Filter a query by [date_from, date_to] (inclusive) on `col`."""
    df = _parse_date(date_from)
    dt = _parse_date(date_to)
    if df is not None:
        q = q.where(col >= df)
    if dt is not None:
        q = q.where(col < dt + timedelta(days=1))
    return q


def _xlsx_response(content: bytes, filename: str) -> Response:
    return Response(
        content=content,
        media_type=XLSX_MEDIA,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _csv_bytes(headers, rows) -> bytes:
    buf = io.StringIO()
    writer = _csv.writer(buf, delimiter=";")
    writer.writerow(list(headers))
    for row in rows:
        writer.writerow(["" if c is None else c for c in row])
    # BOM so Excel renders accents correctly
    return ("﻿" + buf.getvalue()).encode("utf-8")


def _pdf_bytes(title: str, headers, rows) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=landscape(A4),
        leftMargin=1 * cm, rightMargin=1 * cm, topMargin=1 * cm, bottomMargin=1 * cm,
    )
    avail = landscape(A4)[0] - 2 * cm
    ncols = max(len(headers), 1)
    colw = avail / ncols
    head_style = ParagraphStyle(
        "h", fontName="Helvetica-Bold", fontSize=7, leading=8, textColor=colors.white)
    cell_style = ParagraphStyle("c", fontName="Helvetica", fontSize=6.5, leading=8)
    data = [[Paragraph(str(h), head_style) for h in headers]]
    for row in rows:
        data.append([Paragraph("" if c is None else str(c), cell_style) for c in row])
    table = Table(data, colWidths=[colw] * ncols, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1A365D")),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#D1D5DB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    styles = getSampleStyleSheet()
    doc.build([Paragraph(title, styles["Title"]), Spacer(1, 8), table])
    return buf.getvalue()


def _export_response(fmt: Optional[str], sheet: str, headers, rows, basename: str) -> Response:
    """Serialize (headers, rows) to the requested format and stream it."""
    f = (fmt or "xlsx").lower()
    if f == "excel":
        f = "xlsx"
    stamp = _stamp()
    if f == "csv":
        return Response(
            _csv_bytes(headers, rows), media_type=CSV_MEDIA,
            headers={"Content-Disposition": f'attachment; filename="{basename}-{stamp}.csv"'},
        )
    if f == "pdf":
        return Response(
            _pdf_bytes(sheet, headers, rows), media_type=PDF_MEDIA,
            headers={"Content-Disposition": f'attachment; filename="{basename}-{stamp}.pdf"'},
        )
    return _xlsx_response(export_rows(sheet, headers, rows), f"{basename}-{stamp}.xlsx")


# ── Invoices ─────────────────────────────────────────────────

@router.get("/invoices.xlsx")
async def export_invoices(
    status_filter: Optional[str] = None,
    fmt: Optional[str] = "xlsx",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: User = Depends(require_comptable),
    db: AsyncSession = Depends(get_db),
):
    q = select(Invoice).where(Invoice.deleted_at.is_(None)).order_by(Invoice.created_at.desc())
    if status_filter:
        q = q.where(Invoice.status == status_filter)
    q = _date_range(q, Invoice.issue_date, date_from, date_to)
    r = await db.execute(q)
    rows = [
        [
            inv.code,
            inv.invoice_type,
            inv.status,
            _fmt_date(inv.issue_date),
            _fmt_date(inv.due_date),
            float(inv.subtotal or 0),
            float(inv.tax_amount or 0),
            float(inv.total or 0),
            float(inv.amount_paid or 0),
            float((inv.total or 0) - (inv.amount_paid or 0)),
            inv.notes or "",
        ]
        for inv in r.scalars().all()
    ]
    return _export_response(
        fmt, "Factures",
        ["Code", "Type", "Statut", "Émise le", "Échéance",
         "Sous-total", "TVA", "Total", "Payé", "Reste dû", "Notes"],
        rows, "factures",
    )


# ── Projects ─────────────────────────────────────────────────

@router.get("/projects.xlsx")
async def export_projects(
    fmt: Optional[str] = "xlsx",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    q = select(Project).where(Project.deleted_at.is_(None)).order_by(Project.created_at.desc())
    q = _date_range(q, Project.created_at, date_from, date_to)
    r = await db.execute(q)
    rows = [
        [
            p.code, p.name, p.project_type or "", p.location or "",
            p.status, p.progress or 0,
            float(p.budget_initial or 0), float(p.budget_spent or 0),
            _fmt_date(p.start_date), _fmt_date(p.estimated_end_date),
        ]
        for p in r.scalars().all()
    ]
    return _export_response(
        fmt, "Chantiers",
        ["Code", "Nom", "Type", "Localisation", "Statut", "Progression %",
         "Budget initial", "Budget dépensé", "Début", "Fin prévue"],
        rows, "chantiers",
    )


# ── Leads / CRM ──────────────────────────────────────────────

@router.get("/leads.xlsx")
async def export_leads(
    fmt: Optional[str] = "xlsx",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    q = select(Lead).where(Lead.deleted_at.is_(None)).order_by(Lead.created_at.desc())
    q = _date_range(q, Lead.created_at, date_from, date_to)
    r = await db.execute(q)
    rows = [
        [
            f"{l.first_name} {l.last_name}".strip(),
            l.email, l.phone or "", l.company or "",
            l.project_type or "", l.location or "",
            l.status, float(l.quote_amount or 0),
            _fmt_date(l.created_at), l.source or "",
        ]
        for l in r.scalars().all()
    ]
    return _export_response(
        fmt, "Leads",
        ["Nom", "Email", "Téléphone", "Société", "Type projet", "Localisation",
         "Statut", "Devis", "Créé le", "Source"],
        rows, "leads",
    )


# ── HR ───────────────────────────────────────────────────────

@router.get("/employees.xlsx")
async def export_employees(
    fmt: Optional[str] = "xlsx",
    user: User = Depends(require_rh),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Employee).where(Employee.deleted_at.is_(None)).order_by(Employee.last_name)
    )
    rows = [
        [
            e.employee_code, f"{e.first_name} {e.last_name}".strip(),
            e.email or "", e.phone or "", e.position or "", e.department or "",
            e.contract_type or "CDI", float(e.base_salary or 0),
            _fmt_date(e.hire_date), "Oui" if e.is_active else "Non",
        ]
        for e in r.scalars().all()
    ]
    return _export_response(
        fmt, "Employés",
        ["Matricule", "Nom complet", "Email", "Téléphone", "Poste", "Département",
         "Contrat", "Salaire base", "Embauche", "Actif"],
        rows, "employes",
    )


@router.get("/temp-workers.xlsx")
async def export_temp_workers(
    fmt: Optional[str] = "xlsx",
    user: User = Depends(require_rh),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(TempWorker).where(TempWorker.deleted_at.is_(None)))
    rows = [
        [
            f"{w.first_name} {w.last_name}".strip(),
            w.phone or "", w.speciality or "",
            float(w.daily_rate or 0), float(w.rating or 0),
            "Oui" if w.is_active else "Non",
        ]
        for w in r.scalars().all()
    ]
    return _export_response(
        fmt, "Journaliers",
        ["Nom complet", "Téléphone", "Spécialité", "Taux/jour", "Note", "Actif"],
        rows, "journaliers",
    )


@router.get("/payroll.xlsx")
async def export_payroll(
    period: Optional[str] = None,
    fmt: Optional[str] = "xlsx",
    user: User = Depends(require_rh),
    db: AsyncSession = Depends(get_db),
):
    q = select(Payroll).order_by(Payroll.period.desc(), Payroll.created_at.desc())
    if period:
        q = q.where(Payroll.period == period)
    r = await db.execute(q)
    rows = [
        [
            p.period, p.worker_type, p.worker_id,
            p.days_worked or 0,
            float(p.base_amount or 0), float(p.bonuses or 0),
            float(p.deductions or 0), float(p.advances or 0),
            float(p.net_amount or 0), p.status,
            _fmt_date(p.paid_at),
        ]
        for p in r.scalars().all()
    ]
    return _export_response(
        fmt, "Paie",
        ["Période", "Type", "Worker ID", "Jours travaillés",
         "Base", "Primes", "Retenues", "Avances", "Net", "Statut", "Payé le"],
        rows, "paie",
    )


# ── Procurement ──────────────────────────────────────────────

@router.get("/purchase-requests.xlsx")
async def export_purchase_requests(
    fmt: Optional[str] = "xlsx",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(PurchaseRequest).where(PurchaseRequest.deleted_at.is_(None))
        .order_by(PurchaseRequest.created_at.desc())
    )
    q = _date_range(q, PurchaseRequest.created_at, date_from, date_to)
    r = await db.execute(q)
    rows = [
        [
            pr.code, pr.status, float(pr.estimated_total or 0),
            (pr.description or "")[:200],
            _fmt_date(pr.created_at), _fmt_date(pr.validated_at),
        ]
        for pr in r.scalars().all()
    ]
    return _export_response(
        fmt, "Demandes d'achat",
        ["Code", "Statut", "Total estimé", "Description", "Créée le", "Validée le"],
        rows, "demandes-achat",
    )


@router.get("/stock.xlsx")
async def export_stock(
    fmt: Optional[str] = "xlsx",
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(StockItem).order_by(StockItem.name))
    rows = [
        [
            s.name, s.category or "", s.unit or "pcs",
            float(s.quantity or 0), float(s.alert_threshold or 0),
            s.location or "",
            "ALERTE" if (s.quantity or 0) <= (s.alert_threshold or 0) else "OK",
        ]
        for s in r.scalars().all()
    ]
    return _export_response(
        fmt, "Stock",
        ["Article", "Catégorie", "Unité", "Quantité", "Seuil alerte", "Emplacement", "État"],
        rows, "stock",
    )


@router.get("/subcontractor-invoices.xlsx")
async def export_subcontractor_invoices(
    fmt: Optional[str] = "xlsx",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: User = Depends(require_comptable),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(SubContractorInvoice).where(SubContractorInvoice.deleted_at.is_(None))
        .order_by(SubContractorInvoice.created_at.desc())
    )
    q = _date_range(q, SubContractorInvoice.issue_date, date_from, date_to)
    r = await db.execute(q)
    rows = [
        [
            si.code, si.status,
            float(si.amount or 0),
            _fmt_date(si.issue_date), _fmt_date(si.due_date), _fmt_date(si.paid_at),
            (si.notes or "")[:200],
        ]
        for si in r.scalars().all()
    ]
    return _export_response(
        fmt, "Factures sous-traitants",
        ["Code", "Statut", "Montant", "Émise le", "Échéance", "Payée le", "Notes"],
        rows, "factures-soustraitants",
    )
