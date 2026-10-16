"""Entités transverses : audit, idempotence, outbox, jobs, numérotation, paramètres, secrets,
webhooks, sauvegardes, exports, break-glass, fichiers, tâches d'action, consentements (§19 Security)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, Identity, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import (
    Base,
    JSONType,
    Timestamps,
    UUIDPk,
    bigint_col,
    bool_col,
    dt_col,
    fk,
    int_col,
    json_col,
    str_col,
    text_col,
)
from app.core.utils import utcnow


class AuditEvent(Base):
    """Journal append-only chaîné (integrity_hash = SHA-256(prev_hash + contenu canonique))."""

    __tablename__ = "audit_events"
    __table_args__ = (
        Index("ix_audit_events_family_ts", "family", "timestamp_utc"),
        Index("ix_audit_events_resource", "resource_type", "resource_id"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    seq: Mapped[int] = mapped_column(BigInteger, Identity(always=False), unique=True, nullable=False)
    timestamp_utc: Mapped[datetime] = mapped_column(
        default=utcnow, server_default=func.now(), nullable=False, index=True
    )
    family: Mapped[str] = str_col(20, nullable=False)  # business / security / system
    actor_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)
    actor_type: Mapped[str] = str_col(30, nullable=False, default="user")
    actor_label: Mapped[str | None] = str_col(200)
    application: Mapped[str | None] = str_col(40)
    app_version: Mapped[str | None] = str_col(40)
    device_id: Mapped[str | None] = str_col(120)
    module: Mapped[str] = str_col(60, nullable=False, index=True)
    action: Mapped[str] = str_col(60, nullable=False, index=True)
    resource_type: Mapped[str | None] = str_col(80)
    resource_id: Mapped[str | None] = str_col(80)
    project_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)
    diff: Mapped[dict[str, Any]] = json_col(dict)
    ip: Mapped[str | None] = str_col(64)
    user_agent: Mapped[str | None] = str_col(400)
    request_id: Mapped[str | None] = str_col(64, index=True)
    result: Mapped[str] = str_col(10, nullable=False, default="SUCCESS")
    reason: Mapped[str | None] = text_col()
    criticality: Mapped[str] = str_col(10, nullable=False, default="LOW")
    prev_hash: Mapped[str | None] = str_col(64)
    integrity_hash: Mapped[str] = str_col(64, nullable=False)


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    __table_args__ = (UniqueConstraint("scope", "key"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    scope: Mapped[str] = str_col(120, nullable=False)  # utilisateur ou client technique
    key: Mapped[str] = str_col(200, nullable=False)
    method: Mapped[str] = str_col(10, nullable=False)
    path: Mapped[str] = str_col(300, nullable=False)
    request_hash: Mapped[str] = str_col(64, nullable=False)
    status: Mapped[str] = str_col(20, nullable=False, default="in_progress")
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response: Mapped[dict[str, Any] | None] = mapped_column(JSONType, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(nullable=False, index=True)


class OutboxEvent(Base):
    """Patron outbox : les événements métier sont écrits dans la même transaction que la donnée."""

    __tablename__ = "outbox_events"
    __table_args__ = (Index("ix_outbox_pending", "status", "available_at"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = str_col(100, nullable=False, index=True)
    aggregate_type: Mapped[str | None] = str_col(80)
    aggregate_id: Mapped[str | None] = str_col(80)
    project_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    payload: Mapped[dict[str, Any]] = json_col(dict)
    status: Mapped[str] = str_col(20, nullable=False, default="pending")
    attempts: Mapped[int] = int_col(0)
    available_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now(), nullable=False)
    last_error: Mapped[str | None] = text_col()
    correlation_id: Mapped[str | None] = str_col(64)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    processed_at: Mapped[datetime | None] = dt_col()


class JobRun(Base):
    __tablename__ = "job_runs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    job: Mapped[str] = str_col(100, nullable=False, index=True)
    status: Mapped[str] = str_col(20, nullable=False, default="running")
    started_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    finished_at: Mapped[datetime | None] = dt_col()
    items: Mapped[int] = int_col(0)
    details: Mapped[dict[str, Any]] = json_col(dict)
    error: Mapped[str | None] = text_col()


class NumberSequence(Base):
    __tablename__ = "number_sequences"

    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    next_value: Mapped[int] = mapped_column(BigInteger, nullable=False, default=1)


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    value: Mapped[Any] = json_col(dict)
    category: Mapped[str] = str_col(60, nullable=False, default="general")
    is_public: Mapped[bool] = bool_col(False)
    description: Mapped[str | None] = text_col()
    updated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now(), onupdate=utcnow)


class SecretEntry(UUIDPk, Base):
    """Coffre de secrets : écriture/rotation autorisées, lecture en clair interdite via l'API."""

    __tablename__ = "secret_entries"

    name: Mapped[str] = str_col(120, nullable=False, unique=True)
    ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    fingerprint: Mapped[str] = str_col(32, nullable=False)
    description: Mapped[str | None] = text_col()
    version: Mapped[int] = int_col(1)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    rotated_at: Mapped[datetime | None] = dt_col()
    rotated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    enabled: Mapped[bool] = bool_col(False)
    description: Mapped[str | None] = text_col()
    roles: Mapped[list[Any]] = json_col(list)
    percentage: Mapped[int] = int_col(100)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now(), onupdate=utcnow)


class WebhookEndpoint(UUIDPk, Timestamps, Base):
    """Webhooks sortants (intégrations tierces)."""

    __tablename__ = "webhook_endpoints"

    name: Mapped[str] = str_col(150, nullable=False)
    url: Mapped[str] = str_col(500, nullable=False)
    events: Mapped[list[Any]] = json_col(list)
    secret_name: Mapped[str] = str_col(120, nullable=False)  # référence dans le coffre
    is_active: Mapped[bool] = bool_col(True)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    failure_count: Mapped[int] = int_col(0)
    last_success_at: Mapped[datetime | None] = dt_col()
    last_failure_at: Mapped[datetime | None] = dt_col()


class WebhookDelivery(UUIDPk, Base):
    __tablename__ = "webhook_deliveries"

    endpoint_id: Mapped[uuid.UUID] = fk("webhook_endpoints.id", nullable=False, ondelete="CASCADE")
    event_type: Mapped[str] = str_col(100, nullable=False)
    outbox_event_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    status: Mapped[str] = str_col(20, nullable=False, default="pending")
    attempts: Mapped[int] = int_col(0)
    response_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_error: Mapped[str | None] = text_col()
    next_attempt_at: Mapped[datetime | None] = dt_col()
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    delivered_at: Mapped[datetime | None] = dt_col()


class InboundWebhookEvent(UUIDPk, Base):
    """Webhooks entrants : signature vérifiée + unicité (provider, event_id) = idempotence."""

    __tablename__ = "inbound_webhook_events"
    __table_args__ = (UniqueConstraint("provider", "event_id"),)

    provider: Mapped[str] = str_col(40, nullable=False)
    event_id: Mapped[str] = str_col(200, nullable=False)
    event_type: Mapped[str | None] = str_col(120)
    signature_valid: Mapped[bool] = bool_col(False)
    payload: Mapped[dict[str, Any]] = json_col(dict)
    status: Mapped[str] = str_col(20, nullable=False, default="received")
    error: Mapped[str | None] = text_col()
    received_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    processed_at: Mapped[datetime | None] = dt_col()


class BackupJob(UUIDPk, Base):
    __tablename__ = "backup_jobs"

    kind: Mapped[str] = str_col(20, nullable=False)  # database / files / full / restore / restore_test
    status: Mapped[str] = str_col(20, nullable=False, default="pending")
    triggered_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    trigger: Mapped[str] = str_col(20, nullable=False, default="manual")  # manual / schedule / pre_destructive
    started_at: Mapped[datetime | None] = dt_col()
    finished_at: Mapped[datetime | None] = dt_col()
    file_path: Mapped[str | None] = str_col(500)
    size_bytes: Mapped[int] = bigint_col(0)
    checksum: Mapped[str | None] = str_col(64)
    signature: Mapped[str | None] = str_col(200)
    encrypted: Mapped[bool] = bool_col(True)
    remote_copy_status: Mapped[str | None] = str_col(30)
    source_backup_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)  # pour une restauration
    target_environment: Mapped[str | None] = str_col(40)
    break_glass_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    error: Mapped[str | None] = text_col()
    details: Mapped[dict[str, Any]] = json_col(dict)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class ExportJob(UUIDPk, Base):
    __tablename__ = "export_jobs"

    kind: Mapped[str] = str_col(40, nullable=False)  # report / database / gdpr / dataset
    format: Mapped[str] = str_col(10, nullable=False, default="xlsx")
    params: Mapped[dict[str, Any]] = json_col(dict)
    status: Mapped[str] = str_col(20, nullable=False, default="pending")
    file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id")
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    finished_at: Mapped[datetime | None] = dt_col()
    expires_at: Mapped[datetime | None] = dt_col()
    error: Mapped[str | None] = text_col()


class BreakGlassGrant(UUIDPk, Base):
    """Opérations destructives : break-glass + MFA + justification (V4-BACKUP-41)."""

    __tablename__ = "break_glass_grants"

    user_id: Mapped[uuid.UUID] = fk("users.id", nullable=False)
    scope: Mapped[str] = str_col(40, nullable=False)  # restore / purge / hard_delete / secret_reset
    justification: Mapped[str] = mapped_column(Text, nullable=False)
    mfa_verified_at: Mapped[datetime] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    used_at: Mapped[datetime | None] = dt_col()
    revoked_at: Mapped[datetime | None] = dt_col()


class StoredFile(UUIDPk, Base):
    """Registre des fichiers privés (GED, photos, pièces jointes, BIM…)."""

    __tablename__ = "stored_files"

    backend: Mapped[str] = str_col(20, nullable=False, default="local")
    storage_key: Mapped[str] = str_col(500, nullable=False, unique=True)
    original_name: Mapped[str] = str_col(300, nullable=False)
    mime_type: Mapped[str] = str_col(150, nullable=False)
    size_bytes: Mapped[int] = bigint_col(0)
    checksum_sha256: Mapped[str] = str_col(64, nullable=False, index=True)
    encrypted: Mapped[bool] = bool_col(False)
    classification: Mapped[str] = str_col(20, nullable=False, default="internal")
    purpose: Mapped[str | None] = str_col(60)
    uploaded_by_id: Mapped[uuid.UUID | None] = fk("users.id")
    scan_status: Mapped[str] = str_col(20, nullable=False, default="skipped")  # clean / infected / pending / skipped
    scan_details: Mapped[str | None] = text_col()
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    geo: Mapped[dict[str, Any]] = json_col(dict)
    taken_at: Mapped[datetime | None] = dt_col()
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    deleted_at: Mapped[datetime | None] = dt_col()
    retention_until: Mapped[datetime | None] = dt_col()


class ActionItem(UUIDPk, Timestamps, Base):
    """Tâche d'action transverse (tâche finance après échec de paiement, escalade SLA, litige…)."""

    __tablename__ = "action_items"
    __table_args__ = (Index("ix_action_items_entity", "entity_type", "entity_id"),)

    title: Mapped[str] = str_col(250, nullable=False)
    description: Mapped[str | None] = text_col()
    module: Mapped[str] = str_col(60, nullable=False, index=True)
    entity_type: Mapped[str | None] = str_col(80)
    entity_id: Mapped[str | None] = str_col(80)
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    assignee_id: Mapped[uuid.UUID | None] = fk("users.id")
    assignee_role: Mapped[str | None] = str_col(60, index=True)
    priority: Mapped[str] = str_col(20, nullable=False, default="normal")
    status: Mapped[str] = str_col(20, nullable=False, default="open", index=True)
    due_at: Mapped[datetime | None] = dt_col(index=True)
    completed_at: Mapped[datetime | None] = dt_col()
    completed_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    source: Mapped[str] = str_col(20, nullable=False, default="system")


class ConsentRecord(UUIDPk, Base):
    """Preuve de consentement (cookies, formulaires, newsletter, WhatsApp)."""

    __tablename__ = "consent_records"

    subject_type: Mapped[str] = str_col(30, nullable=False)  # visitor / lead / subscriber / user
    subject_ref: Mapped[str] = str_col(200, nullable=False, index=True)
    purposes: Mapped[dict[str, Any]] = json_col(dict)
    policy_version: Mapped[str] = str_col(40, nullable=False, default="1")
    text_hash: Mapped[str | None] = str_col(64)
    source: Mapped[str] = str_col(40, nullable=False)
    ip_hash: Mapped[str | None] = str_col(64)
    user_agent: Mapped[str | None] = str_col(400)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    withdrawn_at: Mapped[datetime | None] = dt_col()


__all__ = [
    "ActionItem",
    "AuditEvent",
    "BackupJob",
    "BreakGlassGrant",
    "ConsentRecord",
    "ExportJob",
    "FeatureFlag",
    "IdempotencyKey",
    "InboundWebhookEvent",
    "JobRun",
    "NumberSequence",
    "OutboxEvent",
    "SecretEntry",
    "Setting",
    "StoredFile",
    "WebhookDelivery",
    "WebhookEndpoint",
]
