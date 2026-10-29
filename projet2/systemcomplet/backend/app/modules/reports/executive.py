"""Rapport de direction hebdomadaire (innovation A7).

Chaque lundi, la plateforme fige les indicateurs de la semaine écoulée (commercial, finance, chantiers, indice de
confiance, contrôle interne, SAV) et rédige une synthèse : Claude si l'IA est configurée — strictement à partir des
chiffres fournis, sans invention — sinon un texte déterministe. Le PDF est diffusé à la Direction.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from html import escape
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.events import emit
from app.core.numbering import next_number
from app.core.utils import jsonable, money, utcnow
from app.modules.reports.models import ExecutiveReport

log = logging.getLogger("globus.executive")

NARRATIVE_SCHEMA_FIELDS: dict[str, Any] = {
    "headline": {"type": "string"},
    "highlights": {"type": "array", "items": {"type": "string"}},
    "risks": {"type": "array", "items": {"type": "string"}},
    "decisions": {"type": "array", "items": {"type": "string"}},
    "outlook": {"type": "string"},
}


def _bounds(start: date, end: date) -> tuple[datetime, datetime]:
    tz = utcnow().tzinfo
    return datetime.combine(start, time.min).replace(tzinfo=tz), datetime.combine(
        end + timedelta(days=1), time.min
    ).replace(tzinfo=tz)


def last_week(today: date | None = None) -> tuple[date, date]:
    today = today or date.today()
    monday = today - timedelta(days=today.weekday())
    return monday - timedelta(days=7), monday - timedelta(days=1)


def build_data(db: Session, start: date, end: date) -> dict[str, Any]:
    from app.modules.ai.models import Anomaly
    from app.modules.billing.models import ClientInvoice, PaymentPlan, SupplierInvoice
    from app.modules.crm.models import Contract, Lead, Quote
    from app.modules.finance.models import FundsCall, Payment
    from app.modules.finance.service import cashflow
    from app.modules.projects.models import Milestone, Project, TrustSnapshot
    from app.modules.projects.trust import ACTIVE_STATUSES
    from app.modules.qhse.models import Incident
    from app.modules.support.models import Ticket

    since, until = _bounds(start, end)
    today = date.today()

    def count(stmt: Any) -> int:
        return int(db.execute(stmt).scalar_one() or 0)

    def amount(stmt: Any) -> Decimal:
        return money(Decimal(db.execute(stmt).scalar_one() or 0))

    leads = db.execute(
        select(Lead.source, func.count())
        .where(Lead.created_at >= since, Lead.created_at < until, Lead.deleted_at.is_(None))
        .group_by(Lead.source)
    ).all()
    contracts = db.execute(
        select(func.count(), func.coalesce(func.sum(Contract.amount), 0)).where(
            Contract.signed_at >= since, Contract.signed_at < until, Contract.deleted_at.is_(None)
        )
    ).one()
    commercial = {
        "leads": sum(c for _, c in leads),
        "leads_by_source": dict(sorted(((s or "autre", c) for s, c in leads), key=lambda x: -x[1])[:5]),
        "quotes_sent": count(
            select(func.count())
            .select_from(Quote)
            .where(Quote.sent_at >= since, Quote.sent_at < until, Quote.deleted_at.is_(None))
        ),
        "quotes_accepted": count(
            select(func.count())
            .select_from(Quote)
            .where(Quote.accepted_at >= since, Quote.accepted_at < until, Quote.deleted_at.is_(None))
        ),
        "contracts_signed": int(contracts[0] or 0),
        "contracts_amount": money(Decimal(contracts[1] or 0)),
    }
    # créances = appels de fonds ouverts + factures ouvertes non issues d'un appel de fonds (pas de double compte)
    invoice_due = ClientInvoice.total - ClientInvoice.amount_paid - ClientInvoice.amount_credited
    from_calls = select(FundsCall.client_invoice_id).where(FundsCall.client_invoice_id.is_not(None))
    standalone = (ClientInvoice.deleted_at.is_(None), ClientInvoice.id.not_in(from_calls))
    receivable = amount(
        select(func.coalesce(func.sum(FundsCall.amount - FundsCall.amount_paid), 0)).where(
            FundsCall.status.in_(["issued", "partially_paid", "overdue"])
        )
    ) + amount(
        select(func.coalesce(func.sum(invoice_due), 0)).where(
            ClientInvoice.status.in_(["sent", "partially_paid", "overdue"]), *standalone
        )
    )
    overdue = amount(
        select(func.coalesce(func.sum(FundsCall.amount - FundsCall.amount_paid), 0)).where(
            FundsCall.status == "overdue"
        )
    ) + amount(select(func.coalesce(func.sum(invoice_due), 0)).where(ClientInvoice.status == "overdue", *standalone))
    series = cashflow(db, project_id=None, months=3)["series"]
    finance = {
        "invoiced": amount(
            select(func.coalesce(func.sum(ClientInvoice.total), 0)).where(
                ClientInvoice.issue_date >= start,
                ClientInvoice.issue_date <= end,
                ClientInvoice.status.not_in(["draft", "cancelled"]),
            )
        ),
        "collected": amount(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.direction == "in",
                Payment.status == "succeeded",
                Payment.paid_at >= since,
                Payment.paid_at < until,
            )
        ),
        "paid_out": amount(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.direction == "out",
                Payment.status == "succeeded",
                Payment.paid_at >= since,
                Payment.paid_at < until,
            )
        ),
        "receivable": money(receivable),
        "overdue": money(overdue),
        "payable": amount(
            select(func.coalesce(func.sum(SupplierInvoice.total - SupplierInvoice.amount_paid), 0)).where(
                SupplierInvoice.status.in_(["approved_for_payment", "partially_paid"]),
                SupplierInvoice.deleted_at.is_(None),
            )
        ),
        "cash_next_months": [{"month": s["month"], "net": s["net"]} for s in series],
        "payment_plans_defaulted": count(
            select(func.count()).select_from(PaymentPlan).where(PaymentPlan.status == "defaulted")
        ),
    }
    active = (
        db.execute(select(Project).where(Project.deleted_at.is_(None), Project.status.in_(ACTIVE_STATUSES)))
        .scalars()
        .all()
    )
    trust_rows = []
    for project in active:
        snap = (
            db.execute(
                select(TrustSnapshot)
                .where(TrustSnapshot.project_id == project.id, TrustSnapshot.score.is_not(None))
                .order_by(TrustSnapshot.as_of.desc())
            )
            .scalars()
            .first()
        )
        if snap is not None:
            trust_rows.append({"code": project.code, "name": project.name, "score": float(snap.score)})
    trust_rows.sort(key=lambda r: r["score"])
    upcoming = db.execute(
        select(Milestone, Project)
        .join(Project, Project.id == Milestone.project_id)
        .where(
            Milestone.status == "planned",
            Milestone.due_date >= today,
            Project.status.in_(ACTIVE_STATUSES),
            Milestone.due_date <= today + timedelta(days=7),
            Project.deleted_at.is_(None),
        )
        .order_by(Milestone.due_date)
        .limit(10)
    ).all()
    projects = {
        "active": len(active),
        "avg_progress": round(sum(float(p.progress_pct or 0) for p in active) / len(active), 1) if active else None,
        "health": {h: sum(1 for p in active if p.health == h) for h in ("on_track", "at_risk", "critical")},
        "late_milestones": count(
            select(func.count()).select_from(Milestone).where(Milestone.status == "planned", Milestone.due_date < today)
        ),
        "trust_average": round(sum(r["score"] for r in trust_rows) / len(trust_rows), 1) if trust_rows else None,
        "trust_lowest": trust_rows[:3],
        "upcoming_milestones": [{"project": p.code, "name": m.name, "due_date": m.due_date} for m, p in upcoming],
    }
    anomalies = db.execute(
        select(Anomaly.severity, func.count())
        .where(Anomaly.created_at >= since, Anomaly.created_at < until)
        .group_by(Anomaly.severity)
    ).all()
    top = (
        db.execute(
            select(Anomaly)
            .where(Anomaly.status.in_(["new", "confirmed"]), Anomaly.severity.in_(["high", "critical"]))
            .order_by(Anomaly.created_at.desc())
            .limit(3)
        )
        .scalars()
        .all()
    )
    controls = {
        "new_anomalies": {s: c for s, c in anomalies},
        "open_serious": [{"kind": a.kind, "description": a.description, "amount": a.amount_at_risk} for a in top],
        "serious_incidents_open": count(
            select(func.count())
            .select_from(Incident)
            .where(Incident.status != "closed", Incident.severity.in_(["high", "critical"]))
        ),
    }
    support = {
        "opened": count(
            select(func.count()).select_from(Ticket).where(Ticket.created_at >= since, Ticket.created_at < until)
        ),
        "open": count(select(func.count()).select_from(Ticket).where(Ticket.status.not_in(["closed", "cancelled"]))),
        "sla_breached": count(
            select(func.count())
            .select_from(Ticket)
            .where(
                Ticket.status.not_in(["closed", "cancelled"]),
                Ticket.response_breached | Ticket.resolution_breached,
            )
        ),
    }
    return jsonable(
        {
            "period": {"start": start, "end": end},
            "commercial": commercial,
            "finance": finance,
            "projects": projects,
            "controls": controls,
            "support": support,
        }
    )


def _fmt(value: Any) -> str:
    try:
        return f"{Decimal(str(value)):,.0f} FCFA".replace(",", " ")
    except Exception:  # noqa: BLE001
        return str(value)


def rules_narrative(data: dict[str, Any]) -> dict[str, Any]:
    c, f, p, k, s = data["commercial"], data["finance"], data["projects"], data["controls"], data["support"]
    highlights = [
        f"{c['leads']} nouveaux leads, {c['quotes_sent']} devis envoyés, {c['contracts_signed']} contrat(s) signé(s) "
        f"({_fmt(c['contracts_amount'])}).",
        f"Encaissé : {_fmt(f['collected'])} ; facturé : {_fmt(f['invoiced'])} ; décaissé : {_fmt(f['paid_out'])}.",
    ]
    if p["active"]:
        highlights.append(
            f"{p['active']} chantier(s) actif(s), avancement moyen {p['avg_progress']} %"
            + (f", indice de confiance moyen {p['trust_average']}/100." if p["trust_average"] is not None else ".")
        )
    risks = []
    if Decimal(str(f["overdue"])) > 0:
        risks.append(f"Créances en retard : {_fmt(f['overdue'])} (encours total {_fmt(f['receivable'])}).")
    if p["late_milestones"]:
        risks.append(f"{p['late_milestones']} jalon(s) en retard sur l'ensemble des chantiers.")
    for row in p["trust_lowest"]:
        if row["score"] < 70:
            risks.append(f"Chantier {row['code']} — indice de confiance {row['score']}/100 : point de vigilance.")
    for anomaly in k["open_serious"]:
        risks.append(f"Contrôle interne : {anomaly['description']}")
    if k["serious_incidents_open"]:
        risks.append(f"{k['serious_incidents_open']} incident(s) QHSE grave(s) non clôturé(s).")
    if s["sla_breached"]:
        risks.append(f"{s['sla_breached']} ticket(s) SAV hors délai.")
    decisions = []
    if Decimal(str(f["overdue"])) > 0:
        decisions.append("Valider le plan de relance des impayés (échéanciers, appels de la finance).")
    if k["open_serious"]:
        decisions.append("Statuer sur les anomalies graves ouvertes avant tout paiement concerné.")
    if any(r["score"] < 70 for r in p["trust_lowest"]):
        decisions.append("Point de revue avec les chefs de projet des chantiers en vigilance.")
    net = sum(Decimal(str(m["net"])) for m in f["cash_next_months"])
    outlook = (
        f"Trésorerie prévisionnelle nette sur 3 mois : {_fmt(net)}. "
        f"{len(p['upcoming_milestones'])} jalon(s) attendu(s) cette semaine."
    )
    headline = "Semaine sous contrôle" if not risks else f"{len(risks)} point(s) d'attention cette semaine"
    return {
        "headline": headline,
        "highlights": highlights,
        "risks": risks or ["Aucun signal d'alerte."],
        "decisions": decisions or ["Aucune décision urgente."],
        "outlook": outlook,
    }


def ai_narrative(db: Session, data: dict[str, Any]) -> tuple[dict[str, Any] | None, Any, str | None]:
    from app.modules.ai.service import SYSTEM_BASE, _json
    from app.providers.ai import strict_schema

    system = (
        SYSTEM_BASE
        + " Tu rédiges le rapport hebdomadaire de la Direction : titre court, 3 à 5 faits marquants, risques "
        "classés par gravité, décisions attendues, perspective. N'utilise QUE les chiffres fournis (montants en FCFA) ;"
        " n'invente aucun fait, aucun nom, aucun chiffre."
    )
    data_out, result, error = _json(
        "executive_report",
        system=system,
        prompt="Indicateurs de la semaine (JSON) :\n" + json.dumps(data, ensure_ascii=False)[:20000],
        schema=strict_schema(NARRATIVE_SCHEMA_FIELDS),
        effort="medium",
    )
    return data_out, result, error


def generate(
    db: Session, start: date, end: date, *, by: str = "schedule", user_id: Any = None, force: bool = False
) -> ExecutiveReport:
    existing = db.execute(
        select(ExecutiveReport).where(ExecutiveReport.period_start == start, ExecutiveReport.period_end == end)
    ).scalar_one_or_none()
    if existing is not None and not force:
        return existing
    data = build_data(db, start, end)
    narrative, result, error = ai_narrative(db, data)
    ai_used = narrative is not None
    if narrative is None:
        narrative = rules_narrative(data)
    from app.modules.ai.service import _record

    report = existing or ExecutiveReport(number=next_number(db, "executive_report"), period_start=start, period_end=end)
    report.data = data
    report.narrative = jsonable(narrative)
    report.ai_generated = ai_used
    report.summary_text = narrative.get("headline")
    report.generated_by = by
    report.requested_by_id = user_id
    if existing is None:
        db.add(report)
    db.flush()
    _record(
        db,
        feature="executive_report",
        user_id=user_id,
        entity_type="executive_report",
        entity_id=report.id,
        source=json.dumps(data, sort_keys=True, default=str),
        result=result,
        error=error,
        output=narrative,
        validation="not_required",
    )
    report.pdf_file_id = _pdf(db, report).id
    return report


def _pdf(db: Session, report: ExecutiveReport) -> Any:
    from app.core.files import store_generated
    from app.core.pdf import PdfDocument
    from app.modules.documents.seals import sealed_pdf

    d, n = report.data, report.narrative
    f, c, p = d["finance"], d["commercial"], d["projects"]
    doc = PdfDocument(
        title="Rapport de direction",
        number=report.number,
        issued_on=date.today(),
        meta=[
            ("Période", f"du {report.period_start:%d/%m/%Y} au {report.period_end:%d/%m/%Y}"),
            ("Synthèse", "rédigée par l'IA à partir des seuls indicateurs" if report.ai_generated else "automatique"),
        ],
        columns=["Indicateur", "Valeur"],
        rows=[
            ["Leads reçus", str(c["leads"])],
            ["Contrats signés", f"{c['contracts_signed']} ({_fmt(c['contracts_amount'])})"],
            ["Encaissé", _fmt(f["collected"])],
            ["Facturé", _fmt(f["invoiced"])],
            ["Créances (dont retard)", f"{_fmt(f['receivable'])} ({_fmt(f['overdue'])})"],
            ["Dettes fournisseurs à payer", _fmt(f["payable"])],
            ["Chantiers actifs", str(p["active"])],
            ["Indice de confiance moyen", f"{p['trust_average']}/100" if p["trust_average"] is not None else "—"],
            ["Jalons en retard", str(p["late_milestones"])],
        ],
        col_widths=[260, 220],
        paragraphs=[
            (escape(n.get("headline") or "Synthèse"), " ".join(n.get("highlights", []))),
            ("Risques", " • ".join(n.get("risks", []))),
            ("Décisions attendues", " • ".join(n.get("decisions", []))),
            ("Perspective", n.get("outlook", "")),
        ],
        footer_note="Document confidentiel — Direction GLOBUS ENGINEERING.",
    )
    return store_generated(
        db,
        sealed_pdf(
            db,
            doc,
            kind="executive_report",
            entity_type="executive_report",
            entity_id=report.id,
            reference=report.number,
            title=f"Rapport de direction du {report.period_start:%d/%m/%Y} au {report.period_end:%d/%m/%Y}",
            issued_on=doc.issued_on,
        ),
        filename=f"{report.number}.pdf",
        mime="application/pdf",
        purpose="executive_reports",
        classification="confidential",
    )


def weekly_job(db: Session) -> dict[str, Any]:
    """Job du lundi : rapport de la semaine écoulée, diffusé à la Direction (in-app, e-mail)."""
    start, end = last_week()
    report = generate(db, start, end)
    if report.sent_at is None:
        report.sent_at = utcnow()
        emit(
            db,
            "executive_report.ready",
            {
                "id": report.id,
                "number": report.number,
                "headline": report.summary_text,
                "period": f"du {start:%d/%m} au {end:%d/%m/%Y}",
            },
            aggregate_type="executive_report",
            aggregate_id=report.id,
        )
    return {"items": 1, "report": report.number}


__all__ = ["build_data", "generate", "last_week", "rules_narrative", "weekly_job"]
