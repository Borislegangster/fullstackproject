"""Fonctions IA §24 : qualification de lead, brouillon de réponse SAV, synthèse chantier, rapport vocal (transcription
→ reformulation → extraction → validation humaine), OCR factures / BL, assistant documentaire, détection d'anomalies,
prévisions coût / délai (EVM). Claude (SDK officiel) si configuré, sinon règles déterministes ; aucune IA ne valide
seule une action critique (validation humaine tracée)."""

from __future__ import annotations

import hashlib
import json
import logging
import re
import statistics
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError
from app.core.events import emit
from app.core.utils import money, utcnow
from app.modules.ai.models import AIRequest, Anomaly, OcrJob, Prediction, VoiceReport
from app.providers.ai import AIResult, Attachment, get_ai_provider, strict_schema

log = logging.getLogger("globus.ai")
SYSTEM_BASE = (
    "Tu es l'assistant de GLOBUS ENGINEERING, entreprise de BTP au Cameroun (conception, calcul, "
    "construction, contrôle). Réponds en français, de façon factuelle, sans inventer de données : si une "
    "information manque, indique-la comme manquante."
)


def _record(
    db: Session,
    *,
    feature: str,
    user_id: uuid.UUID | None,
    entity_type: str | None,
    entity_id: Any,
    source: str,
    result: AIResult | None = None,
    output: dict[str, Any] | None = None,
    error: str | None = None,
    validation: str = "pending",
) -> AIRequest:
    row = AIRequest(
        feature=feature,
        provider="anthropic" if result else "rules",
        model=result.model if result else None,
        user_id=user_id,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        input_hash=hashlib.sha256(source.encode()).hexdigest(),
        input_tokens=result.input_tokens if result else 0,
        output_tokens=result.output_tokens if result else 0,
        duration_ms=result.duration_ms if result else 0,
        status="error" if error else ("ok" if result else "fallback"),
        error=error,
        output=output or {},
        validation_status=validation,
    )
    db.add(row)
    return row


def _json(
    feature: str,
    *,
    system: str,
    prompt: str,
    schema: dict[str, Any],
    effort: str = "low",
    attachments: list[Attachment] | None = None,
) -> tuple[dict[str, Any] | None, AIResult | None, str | None]:
    provider = get_ai_provider()
    if provider is None:
        return None, None, None
    try:
        result = provider.complete_json(
            system=system, prompt=prompt, schema=schema, effort=effort, attachments=attachments
        )
        return result.data, result, None
    except Exception as exc:  # noqa: BLE001 — repli déterministe, erreur tracée
        log.warning("ai_failed", extra={"feature": feature, "error": str(exc)[:200]})
        return None, None, str(exc)[:500]


def _text(
    feature: str, *, system: str, prompt: str, effort: str = "medium"
) -> tuple[str | None, AIResult | None, str | None]:
    provider = get_ai_provider()
    if provider is None:
        return None, None, None
    try:
        result = provider.complete_text(system=system, prompt=prompt, effort=effort)
        return result.text, result, None
    except Exception as exc:  # noqa: BLE001
        log.warning("ai_failed", extra={"feature": feature, "error": str(exc)[:200]})
        return None, None, str(exc)[:500]


# ============================================================================ CRM : qualification de lead
LEAD_SCHEMA = strict_schema(
    {
        "summary": {"type": "string"},
        "universe": {"type": "string", "enum": ["HOME", "BUSINESS", "PREMIUM", "DIASPORA", "ENGINEERING", "INCONNU"]},
        "urgency": {"type": "string", "enum": ["low", "normal", "high"]},
        "maturity": {"type": "string", "enum": ["idee", "etude", "pret_a_lancer", "inconnu"]},
        "missing_information": {"type": "array", "items": {"type": "string"}},
        "next_action": {"type": "string"},
        "score_adjustment": {"type": "integer"},
    }
)


def qualify_lead(db: Session, lead: Any) -> dict[str, Any]:
    """Résumé + univers + informations manquantes ; ajustement de score borné (±15), jamais décisionnel."""
    source = json.dumps(
        {
            "message": lead.message,
            "universe": lead.universe,
            "project_type": lead.project_type,
            "budget_min": str(lead.budget_min) if lead.budget_min else None,
            "budget_max": str(lead.budget_max) if lead.budget_max else None,
            "timeline": lead.timeline,
            "has_land": lead.has_land,
            "land_status": lead.land_status,
            "city": lead.city,
            "country": lead.country,
            "is_diaspora": lead.is_diaspora,
        },
        ensure_ascii=False,
    )
    data, result, error = _json(
        "lead_scoring",
        system=SYSTEM_BASE + " Tu qualifies des demandes de projet.",
        prompt=f"Qualifie cette demande (JSON) :\n{source}",
        schema=LEAD_SCHEMA,
    )
    if data is None:
        missing = [
            label
            for key, label in (
                ("budget_max", "budget"),
                ("timeline", "délai"),
                ("has_land", "terrain"),
                ("city", "localisation"),
            )
            if getattr(lead, key) in (None, "")
        ]
        data = {
            "summary": (lead.message or "Demande sans description")[:280],
            "universe": lead.universe or "INCONNU",
            "urgency": "high" if lead.urgency == "urgent" else "normal",
            "maturity": "pret_a_lancer" if lead.has_land and lead.budget_max else "etude",
            "missing_information": missing,
            "next_action": "Appeler le prospect pour compléter : " + ", ".join(missing)
            if missing
            else "Proposer un rendez-vous de cadrage",
            "score_adjustment": 0,
        }
    data["score_adjustment"] = max(-15, min(15, int(data.get("score_adjustment", 0))))
    lead.ai_summary = data["summary"]
    lead.ai_qualification = data
    if data["score_adjustment"]:
        lead.score = max(0, min(100, int(lead.score or 0) + data["score_adjustment"]))
    _record(
        db,
        feature="lead_scoring",
        user_id=None,
        entity_type="lead",
        entity_id=lead.id,
        source=source,
        result=result,
        output=data,
        error=error,
        validation="not_required",
    )
    return data


# ============================================================================ SAV : brouillon de réponse
def support_draft(db: Session, ticket: Any, *, user_id: uuid.UUID | None) -> str:
    from app.modules.support.models import TicketMessage

    history = (
        db.execute(
            select(TicketMessage)
            .where(TicketMessage.ticket_id == ticket.id, TicketMessage.internal.is_(False))
            .order_by(TicketMessage.created_at)
        )
        .scalars()
        .all()
    )
    source = json.dumps(
        {
            "subject": ticket.subject,
            "description": ticket.description,
            "category": ticket.category,
            "within_warranty": ticket.within_warranty,
            "status": ticket.status,
            "history": [m.body for m in history][-10:],
        },
        ensure_ascii=False,
    )
    text, result, error = _text(
        "support_assistant",
        system=SYSTEM_BASE + " Tu rédiges des réponses SAV courtoises, précises et engageantes, "
        "sans promettre de date ni de prise en charge non décidées.",
        prompt=f"Rédige une réponse au client pour ce ticket :\n{source}",
        effort="low",
    )
    if text is None:
        warranty = {
            True: "Votre demande est examinée au titre de la garantie applicable.",
            False: "Votre demande sera étudiée ; un devis vous sera proposé si elle n'est pas couverte.",
            None: "Nous vérifions les garanties applicables à votre demande.",
        }[ticket.within_warranty]
        text = (
            f"Bonjour,\n\nNous avons bien reçu votre demande {ticket.number} « {ticket.subject} ». {warranty} "
            "Un technicien vous contactera pour convenir d'un diagnostic.\n\nCordialement,\nService après-vente "
            "GLOBUS ENGINEERING"
        )
    _record(
        db,
        feature="support_assistant",
        user_id=user_id,
        entity_type="ticket",
        entity_id=ticket.id,
        source=source,
        result=result,
        output={"text": text},
        error=error,
    )
    return text


# ============================================================================ synthèse chantier
def site_summary(
    db: Session, project: Any, *, start: date, end: date, audience: str = "direction", user_id: uuid.UUID | None = None
) -> str:
    from app.modules.projects.models import DailyLog
    from app.modules.qhse.models import Incident

    logs = (
        db.execute(
            select(DailyLog)
            .where(DailyLog.project_id == project.id, DailyLog.log_date >= start, DailyLog.log_date <= end)
            .order_by(DailyLog.log_date)
        )
        .scalars()
        .all()
    )
    incidents = (
        db.execute(
            select(Incident).where(
                Incident.project_id == project.id,
                func.date(Incident.occurred_at) >= start,
                func.date(Incident.occurred_at) <= end,
            )
        )
        .scalars()
        .all()
    )
    if audience == "client":
        incidents = [i for i in incidents if i.published_to_client]
    facts = {
        "project": project.name,
        "progress_pct": str(project.progress_pct),
        "health": project.health,
        "logs": [
            {
                "date": str(log.log_date),
                "activities": (log.activities or "")[:500],
                "issues": (log.issues or "")[:300],
                "weather": log.weather,
                "workforce": log.workforce_count,
            }
            for log in logs
        ],
        "incidents": [
            {"title": i.title if audience != "client" else (i.client_summary or ""), "severity": i.severity}
            for i in incidents
        ],
    }
    source = json.dumps(facts, ensure_ascii=False, default=str)
    tone = (
        "pour le client, rassurant et transparent, sans jargon ni information interne"
        if audience == "client"
        else "pour la direction, synthétique, orienté risques et décisions"
    )
    text, result, error = _text("site_summary", system=SYSTEM_BASE, prompt=f"Synthèse de la période {tone} :\n{source}")
    if text is None:
        lines = [
            f"Avancement global : {project.progress_pct} %.",
            f"{len(logs)} rapport(s) journalier(s) sur la période.",
        ]
        for log in logs[-5:]:
            if log.activities:
                lines.append(f"• {log.log_date:%d/%m} : {log.activities[:160]}")
        if incidents:
            lines.append(f"{len(incidents)} événement(s) QHSE à suivre.")
        text = "\n".join(lines)
    _record(
        db,
        feature="site_summary",
        user_id=user_id,
        entity_type="project",
        entity_id=project.id,
        source=source,
        result=result,
        output={"text": text, "audience": audience},
        error=error,
        validation="pending",
    )
    return text


# ============================================================================ rapport vocal terrain
VOICE_SCHEMA = strict_schema(
    {
        "reformulated": {"type": "string"},
        "activities": {
            "type": "array",
            "items": strict_schema(
                {
                    "activity": {"type": "string"},
                    "team_size": {"type": "integer"},
                    "quantity": {"type": "string"},
                    "progress_note": {"type": "string"},
                }
            ),
        },
        "delays": {"type": "array", "items": {"type": "string"}},
        "needs": {"type": "array", "items": {"type": "string"}},
        "safety_issues": {"type": "array", "items": {"type": "string"}},
        "weather": {"type": "string"},
        "is_critical": {"type": "boolean"},
    }
)
CRITICAL_WORDS = ("accident", "blessé", "blessure", "effondr", "incendie", "chute", "électrocut", "fissure importante")
NEED_WORDS = ("besoin", "manque", "il faut", "rupture", "commander")
DELAY_WORDS = ("retard", "bloqué", "arrêt", "attente", "pluie")


def process_voice_report(
    db: Session, report: VoiceReport, *, transcript: str | None, user_id: uuid.UUID | None
) -> VoiceReport:
    """Transcription (serveur ou appareil) → reformulation → extraction ; reste « à valider » par un humain."""
    from app.core.files import read_private
    from app.modules.system.models import StoredFile
    from app.providers.stt import transcribe, transcription_available

    if transcript:
        report.transcript = transcript.strip()
    elif transcription_available():
        stored = db.get(StoredFile, report.audio_file_id)
        try:
            report.transcript = transcribe(read_private(stored), stored.original_name, stored.mime_type).text
        except Exception as exc:  # noqa: BLE001
            report.status = "failed"
            report.error = f"Transcription impossible : {str(exc)[:300]}"
            return report
    if not report.transcript:
        report.status = "uploaded"
        report.error = "Transcription en attente (transcription sur l'appareil ou service STT à configurer)"
        return report
    report.status = "transcribed"
    data, result, error = _json(
        "speech_to_text",
        system=SYSTEM_BASE + " Tu structures des rapports oraux de chantier.",
        prompt=f"Rapport oral d'un chef de chantier :\n{report.transcript}",
        schema=VOICE_SCHEMA,
    )
    if data is None:
        sentences = [s.strip() for s in re.split(r"[.!?\n]+", report.transcript) if s.strip()]
        lower = report.transcript.lower()
        data = {
            "reformulated": ". ".join(s[:1].upper() + s[1:] for s in sentences) + ("." if sentences else ""),
            "activities": [],
            "delays": [s for s in sentences if any(w in s.lower() for w in DELAY_WORDS)],
            "needs": [s for s in sentences if any(w in s.lower() for w in NEED_WORDS)],
            "safety_issues": [s for s in sentences if any(w in s.lower() for w in CRITICAL_WORDS)],
            "weather": "pluie" if "pluie" in lower else "",
            "is_critical": any(w in lower for w in CRITICAL_WORDS),
        }
    report.reformulated = data["reformulated"]
    report.extracted = data
    report.is_critical = bool(data.get("is_critical")) or bool(data.get("safety_issues"))
    report.status = "processed"
    report.error = None
    _record(
        db,
        feature="speech_to_text",
        user_id=user_id,
        entity_type="voice_report",
        entity_id=report.id,
        source=report.transcript,
        result=result,
        output=data,
        error=error,
    )
    return report


def announce_voice_report(db: Session, report: VoiceReport, *, author_name: str) -> None:
    """Prévient le chef de projet et le conducteur de travaux (la direction aussi si le rapport est critique) qu'un
    rapport vocal attend leur validation dans « Assistants IA › Rapports vocaux »."""
    from app.modules.projects.models import Project

    project = db.get(Project, report.project_id)
    text = (report.reformulated or report.transcript or "").strip()
    emit(
        db,
        "voice_report.received",
        {
            "id": str(report.id),
            "project_id": report.project_id,
            "project_name": project.name if project else "",
            "manager_id": project.manager_id if project else None,
            "author": author_name,
            "summary": (text[:200] + ("…" if len(text) > 200 else "")) if text else "transcription en cours",
            "is_critical": bool(report.is_critical),
            "status": report.status,
        },
        aggregate_type="voice_report",
        aggregate_id=report.id,
        project_id=report.project_id,
    )


def validate_voice_report(db: Session, report: VoiceReport, *, user_id: uuid.UUID, edited_text: str | None) -> Any:
    """Validation humaine → rapport journalier (brouillon) ; alerte si critique."""
    from app.modules.projects.models import DailyLog

    if report.status != "processed":
        raise BusinessRuleError("Rapport non traité")
    extracted = report.extracted or {}
    summary = edited_text or report.reformulated or report.transcript or ""
    log_date = (report.recorded_at or utcnow()).date()
    daily = db.execute(
        select(DailyLog).where(
            DailyLog.project_id == report.project_id,
            DailyLog.log_date == log_date,
            DailyLog.site_id.is_(None) if report.site_id is None else DailyLog.site_id == report.site_id,
        )
    ).scalar_one_or_none()
    if daily is None:
        daily = DailyLog(
            project_id=report.project_id,
            site_id=report.site_id,
            log_date=log_date,
            author_id=user_id,
            status="draft",
            activities=summary,
            source="voice_ai",
            voice_report_id=report.id,
            weather=extracted.get("weather") or None,
        )
        db.add(daily)
    else:
        daily.activities = f"{daily.activities or ''}\n{summary}".strip()
    for key, attr in (("delays", "issues"), ("needs", "needs"), ("safety_issues", "safety_notes")):
        values = [str(v) for v in extracted.get(key) or []]
        if values:
            setattr(daily, attr, "\n".join(filter(None, [getattr(daily, attr), *values])))
    daily.is_critical = daily.is_critical or report.is_critical
    db.flush()
    report.status = "validated"
    report.validated_by_id = user_id
    report.validated_at = utcnow()
    report.daily_log_id = daily.id
    row = (
        db.execute(
            select(AIRequest).where(AIRequest.entity_type == "voice_report", AIRequest.entity_id == str(report.id))
        )
        .scalars()
        .first()
    )
    if row is not None:
        row.validation_status = "edited" if edited_text else "accepted"
        row.validated_by_id = user_id
        row.validated_at = utcnow()
    if report.is_critical:
        from app.modules.projects.models import Project

        project = db.get(Project, report.project_id)
        emit(
            db,
            "daily_log.critical",
            {
                "project_id": report.project_id,
                "summary": summary[:300],
                "project_name": project.name if project else "",
            },
            aggregate_type="daily_log",
            aggregate_id=daily.id,
            project_id=report.project_id,
        )
    return daily


# ============================================================================ OCR factures / BL
OCR_SCHEMA = strict_schema(
    {
        "supplier_name": {"type": "string"},
        "reference": {"type": "string"},
        "date": {"type": "string"},
        "po_number": {"type": "string"},
        "lines": {
            "type": "array",
            "items": strict_schema(
                {"description": {"type": "string"}, "quantity": {"type": "number"}, "unit_price": {"type": "number"}}
            ),
        },
        "subtotal": {"type": "number"},
        "tax": {"type": "number"},
        "total": {"type": "number"},
        "confidence": {"type": "number"},
    }
)


def _amount(text: str, label: str) -> float | None:
    match = re.search(r"(?:" + label + r")[^0-9]{0,30}([0-9][0-9 .]*[0-9](?:,[0-9]{1,2})?)", text, re.IGNORECASE)
    if not match:
        return None
    value = match.group(1).replace(" ", "").replace(".", "").replace(",", ".")
    try:
        return float(value)
    except ValueError:
        return None


def process_ocr(db: Session, job: OcrJob, *, user_id: uuid.UUID | None) -> OcrJob:
    from app.core.files import read_private
    from app.core.pdf import extract_text
    from app.modules.system.models import StoredFile

    stored = db.get(StoredFile, job.file_id)
    data_bytes = read_private(stored)
    attachments: list[Attachment] = []
    if stored.mime_type == "application/pdf":
        text, _pages = extract_text(data_bytes, max_chars=60_000)
        job.raw_text = text
        if len(text.strip()) < 40:
            attachments.append(Attachment(data=data_bytes, media_type="application/pdf"))
    elif stored.mime_type in ("image/jpeg", "image/png", "image/webp"):
        attachments.append(Attachment(data=data_bytes, media_type=stored.mime_type))
        job.raw_text = None
    else:
        raise BusinessRuleError("Format non pris en charge pour l'OCR (PDF, JPEG, PNG, WebP)")
    kind = {"invoice": "facture fournisseur", "delivery_note": "bon de livraison"}.get(job.kind, "document")
    data, result, error = _json(
        "ocr",
        system=SYSTEM_BASE + " Tu extrais les données de pièces comptables. Laisse vide ce qui n'est pas lisible.",
        prompt=f"Extrais les données de cette {kind}.\n{(job.raw_text or '')[:50_000]}",
        schema=OCR_SCHEMA,
        attachments=attachments or None,
    )
    if data is None:
        text = job.raw_text or ""
        ref = re.search(
            r"(?:facture|invoice|bl|bon de livraison)\s*(?:n[°o.]?|#)\s*[:\-]?\s*([A-Z0-9\-/]{3,})", text, re.IGNORECASE
        )
        po = re.search(r"\b(BC-\d{4}-\d{5})\b", text)
        when = re.search(r"\b(\d{2}[/.-]\d{2}[/.-]\d{4})\b", text)
        data = {
            "supplier_name": "",
            "reference": ref.group(1) if ref else "",
            "date": when.group(1) if when else "",
            "po_number": po.group(1) if po else "",
            "lines": [],
            "subtotal": _amount(text, "total\\s*h\\.?t") or 0,
            "tax": _amount(text, "tva") or 0,
            "total": _amount(text, "total\\s*t\\.?t\\.?c|net\\s*à\\s*payer") or 0,
            "confidence": 0.3 if text else 0.0,
        }
    job.extracted = data
    job.confidence = float(data.get("confidence") or 0)
    job.status = "processed" if data else "failed"
    _record(
        db,
        feature="ocr",
        user_id=user_id,
        entity_type="ocr_job",
        entity_id=job.id,
        source=job.raw_text or str(job.file_id),
        result=result,
        output=data,
        error=error,
    )
    return job


# ============================================================================ assistant documentaire
def document_answer(db: Session, version: Any, question: str, *, user_id: uuid.UUID) -> dict[str, Any]:
    text = version.extracted_text or ""
    if not text.strip():
        return {"answer": "Ce document ne contient pas de texte exploitable (scan sans OCR).", "sources": []}
    excerpt = text[:120_000]
    answer, result, error = _text(
        "document_assistant",
        system=SYSTEM_BASE + " Tu réponds uniquement à partir du document fourni et cites les "
        "passages utilisés entre guillemets.",
        prompt=f"Document :\n{excerpt}\n\nQuestion : {question}",
        effort="low",
    )
    sources: list[str] = []
    if answer is None:
        words = [w for w in re.findall(r"\w{4,}", question.lower())][:6]
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
        ranked = sorted(paragraphs, key=lambda p: sum(p.lower().count(w) for w in words), reverse=True)
        sources = [p[:400] for p in ranked[:3] if any(w in p.lower() for w in words)]
        answer = (
            ("Passages pertinents trouvés dans le document :\n\n" + "\n\n".join(sources))
            if sources
            else "Aucun passage du document ne correspond à la question."
        )
    _record(
        db,
        feature="document_assistant",
        user_id=user_id,
        entity_type="document_version",
        entity_id=version.id,
        source=question,
        result=result,
        output={"answer": answer},
        error=error,
        validation="not_required",
    )
    return {"answer": answer, "sources": sources, "ai": result is not None}


# ============================================================================ anomalies (job)
def _anomaly(
    db: Session,
    *,
    kind: str,
    entity_type: str,
    entity_id: Any,
    project_id: Any,
    description: str,
    evidence: dict[str, Any],
    amount: Decimal,
    severity: str,
    score: float,
) -> bool:
    fingerprint = hashlib.sha256(f"{kind}|{entity_type}|{entity_id}".encode()).hexdigest()
    if db.execute(select(Anomaly.id).where(Anomaly.fingerprint == fingerprint)).first():
        return False
    db.add(
        Anomaly(
            kind=kind,
            severity=severity,
            score=score,
            entity_type=entity_type,
            entity_id=str(entity_id),
            project_id=project_id,
            description=description,
            evidence=json.loads(json.dumps(evidence, default=str)),
            amount_at_risk=money(amount),
            fingerprint=fingerprint,
        )
    )
    emit(
        db,
        "anomaly.detected",
        {"kind": kind, "description": description, "severity": severity},
        aggregate_type=entity_type,
        aggregate_id=entity_id,
        project_id=project_id,
    )
    return True


def detect_anomalies(db: Session) -> dict[str, Any]:
    """Règles explicables : doublons de facture, prix hors norme, paiement inhabituel, pointage aberrant."""
    from app.modules.billing.models import SupplierInvoice
    from app.modules.finance.models import Payment
    from app.modules.hr.models import Attendance
    from app.modules.procurement.models import PurchaseOrder, PurchaseOrderLine
    from app.modules.suppliers.models import SupplierPriceHistory

    since = utcnow() - timedelta(days=30)
    created = 0
    recent = (
        db.execute(
            select(SupplierInvoice).where(SupplierInvoice.created_at >= since, SupplierInvoice.deleted_at.is_(None))
        )
        .scalars()
        .all()
    )
    for invoice in recent:
        twin = (
            db.execute(
                select(SupplierInvoice).where(
                    SupplierInvoice.supplier_id == invoice.supplier_id,
                    SupplierInvoice.id != invoice.id,
                    SupplierInvoice.total == invoice.total,
                    SupplierInvoice.status != "rejected",
                    SupplierInvoice.invoice_date.between(
                        invoice.invoice_date - timedelta(days=7), invoice.invoice_date + timedelta(days=7)
                    ),
                )
            )
            .scalars()
            .first()
        )
        if twin is not None and _anomaly(
            db,
            kind="duplicate_invoice",
            entity_type="supplier_invoice",
            entity_id=invoice.id,
            project_id=invoice.project_id,
            description=f"Facture {invoice.supplier_reference} : même montant que "
            f"{twin.supplier_reference} à moins de 7 jours",
            evidence={"twin": str(twin.id), "total": str(invoice.total)},
            amount=Decimal(invoice.total),
            severity="high",
            score=0.9,
        ):
            created += 1
    lines = db.execute(
        select(PurchaseOrderLine, PurchaseOrder)
        .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderLine.order_id)
        .where(PurchaseOrder.created_at >= since, PurchaseOrderLine.supplier_product_id.is_not(None))
    ).all()
    for line, po in lines:
        history = [
            Decimal(p)
            for p in db.execute(
                select(SupplierPriceHistory.unit_price).where(
                    SupplierPriceHistory.product_id == line.supplier_product_id
                )
            ).scalars()
        ]
        if len(history) >= 3:
            median = Decimal(str(statistics.median(history)))
            if (
                median > 0
                and Decimal(line.unit_price) > median * Decimal("1.3")
                and _anomaly(
                    db,
                    kind="price_outlier",
                    entity_type="purchase_order_line",
                    entity_id=line.id,
                    project_id=po.project_id,
                    description=f"BC {po.number} : prix {line.unit_price} > médiane historique {median} (+30 %)",
                    evidence={"median": str(median), "history": [str(h) for h in history][-10:]},
                    amount=(Decimal(line.unit_price) - median) * Decimal(line.quantity),
                    severity="medium",
                    score=0.7,
                )
            ):
                created += 1
    payments = (
        db.execute(
            select(Payment).where(
                Payment.direction == "out", Payment.created_at >= since, Payment.counterparty_id.is_not(None)
            )
        )
        .scalars()
        .all()
    )
    for payment in payments:
        previous = [
            Decimal(a)
            for a in db.execute(
                select(Payment.amount).where(
                    Payment.direction == "out",
                    Payment.counterparty_id == payment.counterparty_id,
                    Payment.id != payment.id,
                    Payment.status == "succeeded",
                )
            ).scalars()
        ]
        if len(previous) >= 3:
            average = sum(previous, Decimal("0")) / len(previous)
            if (
                average > 0
                and Decimal(payment.amount) > average * 3
                and _anomaly(
                    db,
                    kind="unusual_payment",
                    entity_type="payment",
                    entity_id=payment.id,
                    project_id=payment.project_id,
                    description=f"Paiement {payment.number} : {payment.amount} > 3 × moyenne ({average:.0f})",
                    evidence={"average": str(average)},
                    amount=Decimal(payment.amount),
                    severity="high",
                    score=0.8,
                )
            ):
                created += 1
    for row in db.execute(
        select(Attendance).where(Attendance.created_at >= since, Attendance.hours_worked > 14)
    ).scalars():
        if _anomaly(
            db,
            kind="attendance_outlier",
            entity_type="attendance",
            entity_id=row.id,
            project_id=row.project_id,
            description=f"Pointage de {row.hours_worked} h le {row.work_date:%d/%m/%Y}",
            evidence={"employee_id": str(row.employee_id)},
            amount=Decimal("0"),
            severity="low",
            score=0.5,
        ):
            created += 1
    from app.modules.ai.controls import detect_control_anomalies

    created += detect_control_anomalies(db)
    return {"items": created}


# ============================================================================ prévisions EVM (job)
def compute_prediction(db: Session, project: Any, *, as_of: date | None = None) -> Prediction | None:
    from app.modules.finance.models import Expense
    from app.modules.finance.service import current_budget

    budget = current_budget(db, project.id)
    if budget is None or Decimal(budget.total) <= 0 or not project.start_planned or not project.end_planned:
        return None
    today = as_of or date.today()
    bac = Decimal(budget.total)
    duration = max(1, (project.end_planned - project.start_planned).days)
    elapsed = min(max(0, (today - project.start_planned).days), duration)
    pv = bac * Decimal(elapsed) / Decimal(duration)
    ev = bac * Decimal(project.progress_pct or 0) / 100
    ac = Decimal(
        db.execute(
            select(func.coalesce(func.sum(Expense.amount), 0)).where(
                Expense.project_id == project.id, Expense.deleted_at.is_(None), Expense.expense_date <= today
            )
        ).scalar_one()
    )
    cpi = (ev / ac).quantize(Decimal("0.001")) if ac > 0 and ev > 0 else None
    spi = (ev / pv).quantize(Decimal("0.001")) if pv > 0 and ev > 0 else None
    eac = (bac / cpi) if cpi else ac + (bac - ev)
    forecast_end = (
        project.start_planned + timedelta(days=int(duration / float(spi))) if spi and spi > 0 else project.end_planned
    )
    delay = max(0, (forecast_end - project.end_planned).days)
    risk = "low"
    if (cpi is not None and cpi < Decimal("0.9")) or (spi is not None and spi < Decimal("0.85")):
        risk = "high"
    elif (cpi is not None and cpi < Decimal("0.97")) or (spi is not None and spi < Decimal("0.95")):
        risk = "medium"
    if (cpi is not None and cpi < Decimal("0.8")) or (spi is not None and spi < Decimal("0.75")):
        risk = "critical"
    cpi_label = cpi if cpi is not None else "n/d"
    spi_label = spi if spi is not None else "n/d"
    explanation = (
        f"CPI {cpi_label} (valeur acquise / coût réel), SPI {spi_label} "
        f"(valeur acquise / valeur planifiée). Coût final estimé {money(eac):,.0f} FCFA pour un budget de "
        f"{bac:,.0f} FCFA ; fin estimée le {forecast_end:%d/%m/%Y}."
    ).replace(",", " ")
    prediction = Prediction(
        project_id=project.id,
        as_of=today,
        budget_at_completion=money(bac),
        planned_value=money(pv),
        earned_value=money(ev),
        actual_cost=money(ac),
        cpi=cpi,
        spi=spi,
        estimate_at_completion=money(eac),
        variance_at_completion=money(bac - eac),
        forecast_end_date=forecast_end,
        delay_days=delay,
        risk_level=risk,
        explanation=explanation,
        inputs={
            "progress_pct": str(project.progress_pct),
            "elapsed_days": elapsed,
            "duration_days": duration,
            "budget_version": budget.version_number,
        },
    )
    db.add(prediction)
    return prediction


def compute_predictions(db: Session) -> dict[str, Any]:
    from app.modules.projects.models import Project

    count = 0
    today = date.today()
    for project in db.execute(
        select(Project).where(Project.deleted_at.is_(None), Project.status.in_(["preparation", "execution"]))
    ).scalars():
        already = db.execute(
            select(Prediction.id).where(Prediction.project_id == project.id, Prediction.as_of == today)
        ).first()
        if already:
            continue
        prediction = compute_prediction(db, project, as_of=today)
        if prediction is None:
            continue
        count += 1
        if prediction.risk_level in ("high", "critical"):
            emit(
                db,
                "prediction.risk",
                {
                    "project_id": project.id,
                    "project_name": project.name,
                    "explanation": prediction.explanation,
                    "risk": prediction.risk_level,
                },
                aggregate_type="project",
                aggregate_id=project.id,
                project_id=project.id,
            )
    return {"items": count}
