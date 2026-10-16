"""IA & automatisation (§24) : journal des requêtes, rapports vocaux, OCR, anomalies, prédictions.
Aucune IA ne valide seule un paiement, un contrat, une version de plan, une décision client ou un
changement financier critique : chaque résultat reste « à valider » par un humain."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, Float, Index, Numeric, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import (
    Base,
    Timestamps,
    UUIDPk,
    Versioned,
    dt_col,
    fk,
    int_col,
    json_col,
    money_col,
    str_col,
    text_col,
)
from app.core.utils import utcnow


class AIRequest(UUIDPk, Base):
    __tablename__ = "ai_requests"

    feature: Mapped[str] = str_col(
        40, nullable=False, index=True
    )  # speech_to_text / ocr / reformulation / extraction / lead_scoring / anomaly / site_summary / prediction / document_assistant / material_assistant / support_assistant
    provider: Mapped[str] = str_col(20, nullable=False)  # anthropic / openai / rules
    model: Mapped[str | None] = str_col(80)
    user_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    entity_type: Mapped[str | None] = str_col(40)
    entity_id: Mapped[str | None] = str_col(80)
    input_hash: Mapped[str | None] = str_col(64)
    input_tokens: Mapped[int] = int_col(0)
    output_tokens: Mapped[int] = int_col(0)
    duration_ms: Mapped[int] = int_col(0)
    status: Mapped[str] = str_col(20, nullable=False, default="ok")  # ok / error / fallback
    error: Mapped[str | None] = text_col()
    output: Mapped[dict[str, Any]] = json_col(dict)
    validation_status: Mapped[str] = str_col(
        20, nullable=False, default="pending"
    )  # pending / accepted / edited / rejected / not_required
    validated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    validated_at: Mapped[datetime | None] = dt_col()
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class VoiceReport(UUIDPk, Timestamps, Versioned, Base):
    """Rapport vocal IA : capture → transcription → reformulation → extraction → validation humaine."""

    __tablename__ = "voice_reports"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False)
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    author_id: Mapped[uuid.UUID | None] = fk("users.id")
    audio_file_id: Mapped[uuid.UUID] = fk("stored_files.id", nullable=False)
    recorded_at: Mapped[datetime | None] = dt_col()
    duration_seconds: Mapped[int | None] = mapped_column(nullable=True)
    status: Mapped[str] = str_col(
        20, nullable=False, default="uploaded"
    )  # uploaded / transcribed / processed / validated / rejected / failed
    transcript: Mapped[str | None] = text_col()
    reformulated: Mapped[str | None] = text_col()
    extracted: Mapped[dict[str, Any]] = json_col(dict)  # activité, équipe, quantité, retard, besoin
    is_critical: Mapped[bool] = mapped_column(nullable=False, default=False)
    daily_log_id: Mapped[uuid.UUID | None] = fk("daily_logs.id")
    validated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    validated_at: Mapped[datetime | None] = dt_col()
    error: Mapped[str | None] = text_col()
    client_mutation_id: Mapped[str | None] = str_col(80, unique=True)


class OcrJob(UUIDPk, Timestamps, Base):
    __tablename__ = "ocr_jobs"

    kind: Mapped[str] = str_col(20, nullable=False)  # delivery_note / invoice / document
    file_id: Mapped[uuid.UUID] = fk("stored_files.id", nullable=False)
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    status: Mapped[str] = str_col(
        20, nullable=False, default="pending"
    )  # pending / processed / validated / rejected / failed
    raw_text: Mapped[str | None] = text_col()
    extracted: Mapped[dict[str, Any]] = json_col(dict)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_type: Mapped[str | None] = str_col(40)
    target_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    validated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    validated_at: Mapped[datetime | None] = dt_col()


class Anomaly(UUIDPk, Timestamps, Base):
    __tablename__ = "anomalies"
    __table_args__ = (Index("ix_anomalies_entity", "entity_type", "entity_id"),)

    kind: Mapped[str] = str_col(
        40, nullable=False
    )  # invoice_above_po / price_outlier / quantity_outlier / duplicate_invoice / unusual_payment / attendance_outlier / stock_variance
    severity: Mapped[str] = str_col(10, nullable=False, default="medium")
    score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    entity_type: Mapped[str] = str_col(40, nullable=False)
    entity_id: Mapped[str] = str_col(80, nullable=False)
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    description: Mapped[str] = text_col(nullable=False)
    evidence: Mapped[dict[str, Any]] = json_col(dict)
    amount_at_risk: Mapped[Decimal] = money_col()
    status: Mapped[str] = str_col(
        20, nullable=False, default="new", index=True
    )  # new / confirmed / dismissed / resolved
    fingerprint: Mapped[str] = str_col(64, nullable=False, unique=True)
    reviewed_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    reviewed_at: Mapped[datetime | None] = dt_col()
    review_note: Mapped[str | None] = text_col()


class Prediction(UUIDPk, Base):
    """Prévision coût / délai (EVM : CPI, SPI, EAC) et niveau de risque par projet."""

    __tablename__ = "predictions"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    computed_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    as_of: Mapped[date] = mapped_column(Date, nullable=False)
    budget_at_completion: Mapped[Decimal] = money_col()
    planned_value: Mapped[Decimal] = money_col()
    earned_value: Mapped[Decimal] = money_col()
    actual_cost: Mapped[Decimal] = money_col()
    cpi: Mapped[Decimal | None] = mapped_column(Numeric(8, 3), nullable=True)
    spi: Mapped[Decimal | None] = mapped_column(Numeric(8, 3), nullable=True)
    estimate_at_completion: Mapped[Decimal] = money_col()
    variance_at_completion: Mapped[Decimal] = money_col()
    forecast_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    delay_days: Mapped[int] = int_col(0)
    risk_level: Mapped[str] = str_col(10, nullable=False, default="low")  # low / medium / high / critical
    explanation: Mapped[str | None] = text_col()
    inputs: Mapped[dict[str, Any]] = json_col(dict)


__all__ = ["AIRequest", "Anomaly", "OcrJob", "Prediction", "VoiceReport"]
