"""
Security & Audit Models — Security events, API credentials, backups, exports.
"""
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey, JSON,
)
from app.database import Base
import uuid


def _uuid():
    return str(uuid.uuid4())


class AuditEvent(Base):
    """Enhanced audit event matching V4 spec §22."""
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True, default=_uuid)
    event_id = Column(String, unique=True, nullable=False, default=_uuid, index=True)
    timestamp_utc = Column(DateTime, default=datetime.utcnow, index=True)

    actor_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    actor_type = Column(String, default="USER")  # USER/SYSTEM/API/WEBHOOK
    actor_name = Column(String, default="")

    application = Column(String, default="web")  # web/desktop/mobile/backend
    module = Column(String, default="", index=True)
    # auth, crm, project, procurement, supplier, subcontractor, finance,
    # bim, ged, cms, communication, security, system

    action = Column(String, nullable=False, index=True)
    # CREATE/READ/UPDATE/DELETE/LOGIN/LOGOUT/EXPORT/APPROVE/REJECT/SIGN/PAY

    resource_type = Column(String, default="", index=True)
    resource_id = Column(String, default="")
    resource_label = Column(String, default="")

    diff = Column(JSON, default=dict)  # {field: {old, new}}
    details = Column(JSON, default=dict)

    ip_address = Column(String, default="")
    user_agent = Column(String, default="")
    device_id = Column(String, default="")
    app_version = Column(String, default="")

    request_id = Column(String, default="", index=True)
    result = Column(String, default="SUCCESS")  # SUCCESS/FAIL
    reason = Column(String, default="")

    event_family = Column(String, default="BUSINESS", index=True)
    # BUSINESS/SECURITY/SYSTEM
    criticality = Column(String, default="LOW")
    # LOW/MEDIUM/HIGH/CRITICAL

    integrity_hash = Column(String, default="")


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(String, primary_key=True, default=_uuid)
    event_type = Column(String, nullable=False, index=True)
    # LOGIN_SUCCESS/LOGIN_FAILED/MFA_ENROLLED/MFA_DISABLED/
    # ROLE_CHANGED/PASSWORD_CHANGED/SESSION_REVOKED/
    # API_KEY_CREATED/API_KEY_REVOKED/SECRET_ROTATED/
    # EXPORT_DB/BACKUP_CREATED/BRUTE_FORCE_DETECTED/
    # PERMISSION_ESCALATION/SUSPICIOUS_ACTIVITY

    severity = Column(String, default="INFO")  # INFO/WARNING/ALERT/CRITICAL
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    target_user_id = Column(String, ForeignKey("users.id"), nullable=True)

    ip_address = Column(String, default="")
    user_agent = Column(String, default="")
    device_id = Column(String, default="")
    location = Column(String, default="")

    details = Column(JSON, default=dict)
    resolved = Column(Boolean, default=False)
    resolved_by = Column(String, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class ApiCredential(Base):
    __tablename__ = "api_credentials"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    key_prefix = Column(String, nullable=False, index=True)  # first 8 chars
    key_hash = Column(String, nullable=False)
    scopes = Column(JSON, default=list)  # ["read:projects", "write:crm"]
    rate_limit = Column(Integer, default=1000)  # per hour

    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    last_used_at = Column(DateTime, nullable=True)
    last_used_ip = Column(String, default="")
    usage_count = Column(Integer, default=0)

    expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    revoked_at = Column(DateTime, nullable=True)
    revoked_by = Column(String, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BackupJob(Base):
    __tablename__ = "backup_jobs"

    id = Column(String, primary_key=True, default=_uuid)
    backup_type = Column(String, default="FULL")  # FULL/INCREMENTAL/FILES
    target = Column(String, default="DATABASE")  # DATABASE/FILES/MEDIA/ALL
    status = Column(String, default="PENDING", index=True)
    # PENDING/IN_PROGRESS/COMPLETED/FAILED

    file_path = Column(String, default="")
    file_size = Column(Integer, default=0)
    checksum = Column(String, default="")
    encrypted = Column(Boolean, default=True)

    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, default="")
    records_count = Column(Integer, default=0)

    retention_days = Column(Integer, default=30)
    expires_at = Column(DateTime, nullable=True)
    triggered_by = Column(String, ForeignKey("users.id"), nullable=True)
    trigger_type = Column(String, default="MANUAL")  # MANUAL/SCHEDULED/PRE_DEPLOY

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ExportJob(Base):
    __tablename__ = "export_jobs"

    id = Column(String, primary_key=True, default=_uuid)
    export_type = Column(String, nullable=False)
    # invoices/projects/leads/employees/stock/subcontractors/audit_log/full_backup
    format = Column(String, default="xlsx")  # xlsx/csv/pdf/zip
    filters = Column(JSON, default=dict)

    status = Column(String, default="PENDING", index=True)
    # PENDING/PROCESSING/COMPLETED/FAILED/EXPIRED

    file_url = Column(String, default="")
    storage_key = Column(String, default="")
    file_size = Column(Integer, default=0)
    records_count = Column(Integer, default=0)

    requested_by = Column(String, ForeignKey("users.id"), nullable=False)
    downloaded = Column(Boolean, default=False)
    downloaded_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
