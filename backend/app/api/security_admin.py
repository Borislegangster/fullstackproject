"""
Security & Admin API — Security events, API credentials, backups, exports.
Routes: /api/v1/security/*
"""
from datetime import datetime
import hashlib
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.service import require_admin
from app.models.security_audit import (
    SecurityEvent, ApiCredential, BackupJob, ExportJob,
)
import uuid

router = APIRouter(prefix="/security", tags=["security"])


def _dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


# ── Security Events ──────────────────────────────────────────

@router.get("/events")
async def list_security_events(
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    user_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_admin),
):
    q = select(SecurityEvent)
    if event_type:
        q = q.where(SecurityEvent.event_type == event_type)
    if severity:
        q = q.where(SecurityEvent.severity == severity)
    if user_id:
        q = q.where(SecurityEvent.user_id == user_id)
    rows = (await db.execute(q.order_by(SecurityEvent.created_at.desc()).offset(skip).limit(limit))).scalars().all()
    return [_dict(r) for r in rows]


@router.get("/events/stats")
async def security_stats(db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    now = datetime.utcnow()
    day_ago = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total_today = (await db.execute(
        select(func.count()).where(SecurityEvent.created_at >= day_ago)
    )).scalar() or 0

    critical_today = (await db.execute(
        select(func.count()).where(SecurityEvent.created_at >= day_ago, SecurityEvent.severity == "CRITIQUE")
    )).scalar() or 0

    brute_force = (await db.execute(
        select(func.count()).where(SecurityEvent.event_type == "BRUTE_FORCE", SecurityEvent.created_at >= day_ago)
    )).scalar() or 0

    failed_logins = (await db.execute(
        select(func.count()).where(SecurityEvent.event_type == "LOGIN_FAILED", SecurityEvent.created_at >= day_ago)
    )).scalar() or 0

    return {
        "events_today": total_today,
        "critical_today": critical_today,
        "brute_force_attempts": brute_force,
        "failed_logins_today": failed_logins,
    }


# ── API Credentials ──────────────────────────────────────────

class ApiCredentialCreate(BaseModel):
    name: str
    scopes: list = []
    rate_limit_per_minute: int = 60
    rate_limit_per_day: int = 10000
    expires_at: Optional[str] = None
    allowed_ips: list = []

class ApiCredentialUpdate(BaseModel):
    name: Optional[str] = None
    scopes: Optional[list] = None
    rate_limit_per_minute: Optional[int] = None
    rate_limit_per_day: Optional[int] = None
    is_active: Optional[bool] = None
    allowed_ips: Optional[list] = None


@router.get("/api-keys")
async def list_api_keys(db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    rows = (await db.execute(
        select(ApiCredential).where(ApiCredential.deleted_at.is_(None))
    )).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/api-keys")
async def create_api_key(body: ApiCredentialCreate, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    raw_key = f"glbs_{secrets.token_urlsafe(32)}"
    key_prefix = raw_key[:12]
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    cred = ApiCredential(
        id=str(uuid.uuid4()),
        user_id=user.id,
        name=body.name,
        key_prefix=key_prefix,
        key_hash=key_hash,
        scopes=body.scopes,
        rate_limit_per_minute=body.rate_limit_per_minute,
        rate_limit_per_day=body.rate_limit_per_day,
        expires_at=datetime.fromisoformat(body.expires_at) if body.expires_at else None,
        allowed_ips=body.allowed_ips,
    )
    db.add(cred)
    await db.commit()
    await db.refresh(cred)
    result = _dict(cred)
    result["api_key"] = raw_key
    return result


@router.patch("/api-keys/{key_id}")
async def update_api_key(key_id: str, body: ApiCredentialUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    cred = (await db.execute(select(ApiCredential).where(ApiCredential.id == key_id))).scalar_one_or_none()
    if not cred:
        raise HTTPException(404)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(cred, k, v)
    await db.commit()
    return _dict(cred)


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(key_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    cred = (await db.execute(select(ApiCredential).where(ApiCredential.id == key_id))).scalar_one_or_none()
    if not cred:
        raise HTTPException(404)
    cred.is_active = False
    cred.revoked_at = datetime.utcnow()
    cred.deleted_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


# ── Backups ──────────────────────────────────────────────────

class BackupCreate(BaseModel):
    backup_type: str = "FULL"
    description: str = ""
    retention_days: int = 30
    encrypted: bool = True

@router.get("/backups")
async def list_backups(db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    rows = (await db.execute(
        select(BackupJob).order_by(BackupJob.created_at.desc()).limit(50)
    )).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/backups")
async def create_backup(body: BackupCreate, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    job = BackupJob(
        id=str(uuid.uuid4()),
        backup_type=body.backup_type,
        description=body.description,
        retention_days=body.retention_days,
        encrypted=body.encrypted,
        triggered_by=user.id,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return _dict(job)


@router.patch("/backups/{backup_id}/complete")
async def complete_backup(backup_id: str, size_bytes: int = 0, storage_path: str = "", db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    job = (await db.execute(select(BackupJob).where(BackupJob.id == backup_id))).scalar_one_or_none()
    if not job:
        raise HTTPException(404)
    job.status = "COMPLETE"
    job.completed_at = datetime.utcnow()
    job.size_bytes = size_bytes
    job.storage_path = storage_path
    await db.commit()
    return _dict(job)


# ── Exports ──────────────────────────────────────────────────

class ExportCreate(BaseModel):
    export_type: str = "CSV"
    entity_type: str = ""
    filters: dict = {}
    columns: list = []

@router.get("/exports")
async def list_exports(db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    rows = (await db.execute(
        select(ExportJob).where(ExportJob.requested_by == user.id)
        .order_by(ExportJob.created_at.desc()).limit(50)
    )).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/exports")
async def create_export(body: ExportCreate, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    job = ExportJob(
        id=str(uuid.uuid4()),
        export_type=body.export_type,
        entity_type=body.entity_type,
        filters=body.filters,
        columns=body.columns,
        requested_by=user.id,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return _dict(job)


@router.patch("/exports/{export_id}/complete")
async def complete_export(export_id: str, file_url: str = "", row_count: int = 0, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    job = (await db.execute(select(ExportJob).where(ExportJob.id == export_id))).scalar_one_or_none()
    if not job:
        raise HTTPException(404)
    job.status = "COMPLETE"
    job.completed_at = datetime.utcnow()
    job.file_url = file_url
    job.row_count = row_count
    await db.commit()
    return _dict(job)
