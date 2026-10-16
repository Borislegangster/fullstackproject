"""API IA (§24) : rapport vocal terrain, OCR, assistant documentaire, synthèses, anomalies, prévisions EVM,
journal d'usage. Toute sortie IA reste une proposition soumise à validation humaine tracée."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.crud import serialize
from app.core.database import get_db
from app.core.downloads import file_response
from app.core.errors import BusinessRuleError, NotFound
from app.core.files import store_private, validate_upload
from app.core.pagination import PageParams, paginate
from app.core.utils import jsonable, utcnow
from app.modules.ai import service
from app.modules.ai.models import AIRequest, Anomaly, OcrJob, Prediction, VoiceReport
from app.modules.projects.models import Project

router = APIRouter(tags=["IA"])


def _ai_status() -> dict[str, Any]:
    from app.core.config import settings
    from app.providers.ai import get_ai_provider
    from app.providers.stt import transcription_available

    return {
        "llm": get_ai_provider() is not None,
        "model": settings.ANTHROPIC_MODEL if get_ai_provider() else None,
        "speech_to_text": "server" if transcription_available() else "device",
    }


@router.get("/ai/status")
def status(access: Access = Depends(get_access)) -> dict[str, Any]:
    return _ai_status()


# ============================================================================ rapport vocal
@router.post("/ai/voice-reports", status_code=201)
async def upload_voice_report(
    project_id: uuid.UUID = Form(...),
    site_id: uuid.UUID | None = Form(None),
    recorded_at: datetime | None = Form(None),
    duration_seconds: int | None = Form(None),
    transcript: str | None = Form(None, max_length=50000),
    client_mutation_id: str | None = Form(None, max_length=80),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require_project(project_id, "site:report")
    if client_mutation_id:
        existing = db.execute(
            select(VoiceReport).where(VoiceReport.client_mutation_id == client_mutation_id)
        ).scalar_one_or_none()
        if existing is not None:
            return jsonable(serialize(existing))
    upload = validate_upload(file.filename or "rapport.webm", await file.read(), category="audio", max_mb=100)
    stored = store_private(db, upload, purpose="voice_reports", classification="internal", uploaded_by_id=access.p.id)
    report = VoiceReport(
        project_id=project_id,
        site_id=site_id,
        author_id=access.p.id,
        audio_file_id=stored.id,
        recorded_at=recorded_at or utcnow(),
        duration_seconds=duration_seconds,
        client_mutation_id=client_mutation_id,
    )
    db.add(report)
    db.flush()
    service.process_voice_report(db, report, transcript=transcript, user_id=access.p.id)
    db.commit()
    return jsonable(serialize(report))


@router.get("/ai/voice-reports")
def list_voice_reports(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("site:report")
    stmt = access.filter_by_project(select(VoiceReport), VoiceReport.project_id, allow_null=False)
    if project_id:
        stmt = stmt.where(VoiceReport.project_id == project_id)
    if status:
        stmt = stmt.where(VoiceReport.status == status)
    return paginate(
        db, stmt, params, default_sort=VoiceReport.created_at.desc(), transform=lambda r: jsonable(serialize(r))
    )


def _voice(db: Session, access: Access, report_id: uuid.UUID) -> VoiceReport:
    report = db.get(VoiceReport, report_id)
    if report is None:
        raise NotFound("Rapport introuvable")
    access.require_project(report.project_id, "site:report")
    return report


@router.get("/ai/voice-reports/{report_id}/audio")
def voice_audio(report_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> Response:
    """Écoute de l'enregistrement original avant validation (contrôle de la transcription)."""
    from app.modules.system.models import StoredFile

    report = _voice(db, access, report_id)
    return file_response(db.get(StoredFile, report.audio_file_id))


@router.get("/ai/ocr/{job_id}")
def get_ocr(job_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    job = db.get(OcrJob, job_id)
    if job is None or (job.created_by_id != access.p.id and not access.has("billing:validate")):
        raise NotFound("Extraction introuvable")
    return jsonable(serialize(job))


class TranscriptIn(BaseModel):
    transcript: str = Field(min_length=3, max_length=50000)


@router.post("/ai/voice-reports/{report_id}/transcript")
def provide_transcript(
    report_id: uuid.UUID, data: TranscriptIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Transcription réalisée sur l'appareil (mode « device ») envoyée après coup."""
    report = _voice(db, access, report_id)
    if report.status not in ("uploaded", "failed"):
        raise BusinessRuleError("Rapport déjà transcrit")
    service.process_voice_report(db, report, transcript=data.transcript, user_id=access.p.id)
    db.commit()
    return jsonable(serialize(report))


class VoiceValidateIn(BaseModel):
    edited_text: str | None = Field(default=None, max_length=50000)


@router.post("/ai/voice-reports/{report_id}/validate")
def validate_voice(
    report_id: uuid.UUID, data: VoiceValidateIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    report = _voice(db, access, report_id)
    daily = service.validate_voice_report(db, report, user_id=access.p.id, edited_text=data.edited_text)
    audit.record(
        db,
        family="business",
        module="ai",
        action="VOICE_VALIDATE",
        resource_type="voice_report",
        resource_id=report.id,
        project_id=report.project_id,
        diff={"edited": bool(data.edited_text)},
    )
    db.commit()
    return jsonable({"report": serialize(report), "daily_log": serialize(daily)})


@router.post("/ai/voice-reports/{report_id}/reject")
def reject_voice(
    report_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    report = _voice(db, access, report_id)
    report.status = "rejected"
    db.commit()
    return jsonable(serialize(report))


# ============================================================================ OCR
@router.post("/ai/ocr", status_code=201)
async def ocr(
    kind: str = Form(..., pattern="^(invoice|delivery_note|document)$"),
    project_id: uuid.UUID | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    if not access.p.has_any("billing:write", "deliveries:receive", "documents:write"):
        access.require("billing:write")
    if project_id:
        access.require_project(project_id)
    upload = validate_upload(file.filename or "piece.pdf", await file.read(), category="media", max_mb=30)
    stored = store_private(db, upload, purpose="ocr", classification="confidential", uploaded_by_id=access.p.id)
    job = OcrJob(kind=kind, file_id=stored.id, project_id=project_id, created_by_id=access.p.id)
    db.add(job)
    db.flush()
    service.process_ocr(db, job, user_id=access.p.id)
    db.commit()
    return jsonable({**serialize(job), "file_id": stored.id})


class OcrValidateIn(BaseModel):
    target_type: str | None = Field(default=None, max_length=40)
    target_id: uuid.UUID | None = None
    accepted: bool = True


@router.post("/ai/ocr/{job_id}/validate")
def validate_ocr(
    job_id: uuid.UUID, data: OcrValidateIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    job = db.get(OcrJob, job_id)
    if job is None or (job.created_by_id != access.p.id and not access.has("billing:validate")):
        raise NotFound("Extraction introuvable")
    job.status = "validated" if data.accepted else "rejected"
    job.target_type, job.target_id = data.target_type, data.target_id
    job.validated_by_id = access.p.id
    job.validated_at = utcnow()
    row = (
        db.execute(select(AIRequest).where(AIRequest.entity_type == "ocr_job", AIRequest.entity_id == str(job.id)))
        .scalars()
        .first()
    )
    if row is not None:
        row.validation_status = "accepted" if data.accepted else "rejected"
        row.validated_by_id = access.p.id
        row.validated_at = utcnow()
    db.commit()
    return jsonable(serialize(job))


# ============================================================================ assistant documentaire & synthèses
class QuestionIn(BaseModel):
    question: str = Field(min_length=3, max_length=2000)


@router.post("/ai/document-versions/{version_id}/ask")
def ask_document(
    version_id: uuid.UUID, data: QuestionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.documents.models import Document, DocumentVersion
    from app.modules.documents.service import require_read

    access.require("ai:use")
    version = db.get(DocumentVersion, version_id)
    document = db.get(Document, version.document_id) if version else None
    if document is None:
        raise NotFound("Document introuvable")
    require_read(access, db, document)
    result = service.document_answer(db, version, data.question, user_id=access.p.id)
    db.commit()
    return result


class SummaryIn(BaseModel):
    start: date | None = None
    end: date | None = None
    audience: str = Field(default="direction", pattern="^(direction|client)$")


@router.post("/ai/projects/{project_id}/summary")
def project_summary(
    project_id: uuid.UUID, data: SummaryIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require_project(project_id, "ai:use")
    project = db.get(Project, project_id)
    end = data.end or date.today()
    start = data.start or end - timedelta(days=7)
    text = service.site_summary(db, project, start=start, end=end, audience=data.audience, user_id=access.p.id)
    db.commit()
    return {"text": text, "start": start.isoformat(), "end": end.isoformat(), "requires_validation": True}


# ============================================================================ anomalies & prévisions
@router.get("/ai/anomalies")
def anomalies(
    params: PageParams = Depends(),
    status: str | None = None,
    kind: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    if not access.p.has_any("reports:read", "finance:read"):
        access.require("reports:read")
    stmt = access.filter_by_project(select(Anomaly), Anomaly.project_id)
    if status:
        stmt = stmt.where(Anomaly.status == status)
    if kind:
        stmt = stmt.where(Anomaly.kind == kind)
    return paginate(
        db, stmt, params, default_sort=Anomaly.created_at.desc(), transform=lambda a: jsonable(serialize(a))
    )


class ReviewIn(BaseModel):
    status: str = Field(pattern="^(confirmed|dismissed|resolved)$")
    note: str = Field(min_length=3, max_length=4000)


@router.post("/ai/anomalies/{anomaly_id}/review")
def review_anomaly(
    anomaly_id: uuid.UUID, data: ReviewIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    if not access.p.has_any("finance:approve", "procurement:approve", "reports:export"):
        access.require("finance:approve")
    anomaly = db.get(Anomaly, anomaly_id)
    if anomaly is None:
        raise NotFound("Anomalie introuvable")
    anomaly.status = data.status
    anomaly.review_note = data.note
    anomaly.reviewed_by_id = access.p.id
    anomaly.reviewed_at = utcnow()
    audit.record(
        db,
        family="business",
        module="ai",
        action="ANOMALY_REVIEW",
        resource_type="anomaly",
        resource_id=anomaly.id,
        project_id=anomaly.project_id,
        diff={"status": data.status},
        reason=data.note,
    )
    db.commit()
    return jsonable(serialize(anomaly))


@router.post("/ai/anomalies/scan")
def scan_anomalies(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("reports:export")
    result = service.detect_anomalies(db)
    db.commit()
    return result


@router.get("/ai/predictions")
def predictions(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require_project(project_id, "reports:read")
    rows = db.execute(
        select(Prediction).where(Prediction.project_id == project_id).order_by(Prediction.as_of.desc()).limit(90)
    ).scalars()
    return [jsonable(serialize(p)) for p in rows]


@router.post("/ai/predictions/{project_id}/compute", status_code=201)
def compute_prediction(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require_project(project_id, "reports:read")
    project = db.get(Project, project_id)
    prediction = service.compute_prediction(db, project)
    if prediction is None:
        raise BusinessRuleError(
            "Prévision impossible : budget approuvé et dates de projet requis", code="MISSING_BASELINE"
        )
    db.commit()
    return jsonable(serialize(prediction))


@router.get("/ai/usage")
def usage(days: int = 30, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("settings:read")
    since = utcnow() - timedelta(days=max(1, min(days, 365)))
    rows = db.execute(
        select(
            AIRequest.feature,
            AIRequest.provider,
            AIRequest.status,
            func.count(),
            func.coalesce(func.sum(AIRequest.input_tokens), 0),
            func.coalesce(func.sum(AIRequest.output_tokens), 0),
        )
        .where(AIRequest.created_at >= since)
        .group_by(AIRequest.feature, AIRequest.provider, AIRequest.status)
    ).all()
    validations = db.execute(
        select(AIRequest.validation_status, func.count())
        .where(AIRequest.created_at >= since)
        .group_by(AIRequest.validation_status)
    ).all()
    return {
        "status": _ai_status(),
        "days": days,
        "by_feature": [
            {"feature": f, "provider": p, "status": s, "requests": c, "input_tokens": i, "output_tokens": o}
            for f, p, s, c, i, o in rows
        ],
        "validation": {s: c for s, c in validations},
    }
