"""API Administration (§20-22) : paramètres, mode maintenance, intégrations (états sans secrets), coffre de secrets
(écriture / rotation uniquement — V4-SEC-02), webhooks sortants, drapeaux de fonctionnalités, sauvegardes et
restaurations (V4-BACKUP-40/41), break-glass, journal d'audit (V4-AUDIT-34) et vérification de la chaîne, jobs."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.config import settings
from app.core.crud import serialize
from app.core.database import get_db
from app.core.errors import BusinessRuleError, Forbidden, NotFound
from app.core.events import emit
from app.core.pagination import PageParams, paginate
from app.core.secrets import MANAGED_SECRETS, secret_status, set_secret
from app.core.utils import jsonable, utcnow
from app.modules.admin import backups
from app.modules.admin.state import invalidate
from app.modules.system.models import (
    AuditEvent,
    BackupJob,
    FeatureFlag,
    JobRun,
    OutboxEvent,
    Setting,
    WebhookDelivery,
    WebhookEndpoint,
)

router = APIRouter(prefix="/admin", tags=["Administration"])
PROTECTED_SETTINGS = {"payroll_parameters", "maintenance", "__feature_flags__"}


def _require_mfa(access: Access) -> None:
    if not access.p.mfa_verified and settings.MFA_ENFORCEMENT == "enforce":
        raise Forbidden("Opération sensible : session MFA requise", code="MFA_REQUIRED")


# ============================================================================ paramètres & maintenance
@router.get("/settings")
def list_settings(
    category: str | None = None, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require("settings:read")
    stmt = select(Setting)
    if category:
        stmt = stmt.where(Setting.category == category)
    return [jsonable(serialize(s)) for s in db.execute(stmt.order_by(Setting.category, Setting.key)).scalars()]


class SettingIn(BaseModel):
    value: Any
    category: str = Field(default="general", max_length=60)
    is_public: bool = False
    description: str | None = Field(default=None, max_length=2000)


@router.put("/settings/{key}")
def put_setting(
    key: str, data: SettingIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("settings:write")
    if key in PROTECTED_SETTINGS or not key.replace("_", "").replace(".", "").isalnum() or len(key) > 120:
        raise BusinessRuleError("Clé de paramètre réservée ou invalide (utiliser l'écran dédié)")
    row = db.get(Setting, key)
    previous = row.value if row else None
    if row is None:
        row = Setting(key=key)
        db.add(row)
    row.value, row.category, row.is_public, row.description = (
        data.value,
        data.category,
        data.is_public,
        data.description,
    )
    row.updated_by_id = access.p.id
    audit.record(
        db,
        family="system",
        module="settings",
        action="UPDATE",
        resource_type="setting",
        resource_id=key,
        diff={"old": jsonable(previous), "new": jsonable(data.value)},
        criticality="MEDIUM",
    )
    db.commit()
    invalidate(key)
    return jsonable(serialize(row))


class MaintenanceIn(BaseModel):
    enabled: bool
    message: str | None = Field(default=None, max_length=500)
    until: datetime | None = None


@router.get("/maintenance")
def get_maintenance(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("settings:read")
    row = db.get(Setting, "maintenance")
    return jsonable(row.value if row else {"enabled": False})


@router.put("/maintenance")
def set_maintenance(
    data: MaintenanceIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("maintenance:manage")
    row = db.get(Setting, "maintenance") or Setting(key="maintenance", category="system")
    row.value = {
        "enabled": data.enabled,
        "message": data.message,
        "until": data.until.isoformat() if data.until else None,
        "since": utcnow().isoformat(),
        "by": str(access.p.id),
    }
    row.updated_by_id = access.p.id
    db.merge(row)
    audit.record(
        db,
        family="system",
        module="maintenance",
        action="ENABLE" if data.enabled else "DISABLE",
        resource_type="setting",
        resource_id="maintenance",
        reason=data.message,
        criticality="HIGH",
    )
    db.commit()
    invalidate("maintenance")
    return jsonable(row.value)


# ============================================================================ intégrations & secrets
@router.get("/integrations")
def integrations(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """État de configuration des prestataires (booléens uniquement — aucune valeur de secret)."""
    access.require("integrations:manage")
    from app.core.secrets import get_secret
    from app.providers.ai import get_ai_provider
    from app.providers.aps import aps_configured
    from app.providers.messaging import sms_available, whatsapp_available
    from app.providers.payments import available_payment_methods, provider_configuration
    from app.providers.stt import transcription_available

    return {
        "email": {
            "provider": settings.EMAIL_PROVIDER,
            "configured": settings.EMAIL_PROVIDER == "console"
            or (settings.EMAIL_PROVIDER == "ses" and bool(settings.SES_REGION))
            or bool(get_secret("SMTP_PASSWORD") or get_secret("SENDGRID_API_KEY") or get_secret("MAILGUN_API_KEY")),
        },
        "whatsapp": {
            "provider": settings.WHATSAPP_PROVIDER,
            "available": whatsapp_available(),
            "po_template": settings.META_WA_PO_TEMPLATE,
        },
        "sms": {
            "provider": settings.SMS_PROVIDER,
            "configured": sms_available(),
        },
        "payments": {
            "providers": settings.PAYMENT_PROVIDERS,
            "methods": available_payment_methods(),
            "details": provider_configuration(),
        },
        "push": {
            "webpush": bool(settings.VAPID_PUBLIC_KEY and get_secret("VAPID_PRIVATE_KEY")),
            "fcm": bool(get_secret("FCM_SERVICE_ACCOUNT_JSON")),
        },
        "bim_aps": {"configured": aps_configured(), "region": settings.APS_REGION},
        "ai": {"configured": get_ai_provider() is not None, "model": settings.ANTHROPIC_MODEL},
        "speech_to_text": {"server": transcription_available()},
        "storage": {"private": settings.PRIVATE_STORAGE_BACKEND, "antivirus": bool(settings.CLAMAV_HOST)},
        "realtime": {
            "redis": bool(settings.REDIS_URL),
            "turn": bool(settings.TURN_URLS and get_secret("TURN_SHARED_SECRET")),
        },
    }


@router.get("/secrets")
def secrets(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    access.require("integrations:manage")
    return jsonable(secret_status(db))


class SecretIn(BaseModel):
    value: str = Field(min_length=4, max_length=20000)


@router.put("/secrets/{name}")
def put_secret(
    name: str, data: SecretIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Écriture / rotation d'un secret (chiffré AES-256-GCM). La réponse ne contient jamais la valeur."""
    access.require("integrations:manage")
    _require_mfa(access)
    if name not in MANAGED_SECRETS and not name.startswith("WEBHOOK_SECRET_"):
        raise BusinessRuleError("Secret inconnu")
    entry = set_secret(db, name, data.value, user_id=access.p.id)
    audit.record(
        db,
        family="security",
        module="secrets",
        action="ROTATE" if entry.version > 1 else "SET",
        resource_type="secret",
        resource_id=name,
        diff={"fingerprint": entry.fingerprint, "version": entry.version},
        criticality="CRITICAL",
    )
    db.commit()
    return {"name": name, "fingerprint": entry.fingerprint, "version": entry.version, "configured": True}


# ============================================================================ webhooks sortants
class WebhookIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    url: HttpUrl
    events: list[str] = Field(min_length=1, max_length=100)
    secret: str = Field(min_length=16, max_length=500)
    is_active: bool = True


def _webhook_out(endpoint: WebhookEndpoint) -> dict[str, Any]:
    data = serialize(endpoint)
    data.pop("secret_name", None)
    return jsonable(data)


@router.get("/webhooks")
def list_webhooks(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    access.require("integrations:manage")
    return [_webhook_out(e) for e in db.execute(select(WebhookEndpoint).order_by(WebhookEndpoint.created_at)).scalars()]


@router.get("/webhooks/events")
def webhook_events(access: Access = Depends(get_access)) -> list[dict[str, str]]:
    """Catalogue des événements transmissibles aux intégrations externes."""
    from app.modules.admin.webhooks import PUBLIC_EVENTS

    access.require("integrations:manage")
    return [{"type": "*", "label": "Tous les événements publics"}] + [
        {"type": k, "label": v} for k, v in PUBLIC_EVENTS.items()
    ]


@router.post("/webhooks", status_code=201)
def create_webhook(
    data: WebhookIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.admin.webhooks import new_endpoint_secret_name, safe_url, unknown_events

    access.require("integrations:manage")
    if unknown := unknown_events(data.events):
        raise BusinessRuleError(f"Événements inconnus : {', '.join(unknown)}", code="UNKNOWN_EVENT")
    url = str(data.url)
    if settings.is_production and not url.startswith("https://"):
        raise BusinessRuleError("HTTPS obligatoire pour les webhooks en production")
    if not safe_url(url):
        raise BusinessRuleError("URL interdite (adresse privée ou locale)", code="UNSAFE_URL")
    secret_name = new_endpoint_secret_name()
    set_secret(db, secret_name, data.secret, user_id=access.p.id, description=f"Signature webhook {data.name}")
    endpoint = WebhookEndpoint(
        name=data.name,
        url=url,
        events=data.events,
        secret_name=secret_name,
        is_active=data.is_active,
        created_by_id=access.p.id,
    )
    db.add(endpoint)
    db.flush()
    audit.record(
        db,
        family="system",
        module="integrations",
        action="WEBHOOK_CREATE",
        resource_type="webhook_endpoint",
        resource_id=endpoint.id,
        diff={"url": url, "events": data.events},
        criticality="MEDIUM",
    )
    db.commit()
    return _webhook_out(endpoint)


class WebhookUpdate(BaseModel):
    events: list[str] | None = Field(default=None, min_length=1, max_length=100)
    is_active: bool | None = None
    secret: str | None = Field(default=None, min_length=16, max_length=500)


@router.patch("/webhooks/{endpoint_id}")
def update_webhook(
    endpoint_id: uuid.UUID, data: WebhookUpdate, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("integrations:manage")
    endpoint = db.get(WebhookEndpoint, endpoint_id)
    if endpoint is None:
        raise NotFound("Webhook introuvable")
    if data.events is not None:
        from app.modules.admin.webhooks import unknown_events

        if unknown := unknown_events(data.events):
            raise BusinessRuleError(f"Événements inconnus : {', '.join(unknown)}", code="UNKNOWN_EVENT")
        endpoint.events = data.events
    if data.is_active is not None:
        endpoint.is_active = data.is_active
    if data.secret:
        set_secret(db, endpoint.secret_name, data.secret, user_id=access.p.id)
    audit.record(
        db,
        family="system",
        module="integrations",
        action="WEBHOOK_UPDATE",
        resource_type="webhook_endpoint",
        resource_id=endpoint.id,
        diff={"events": data.events, "active": data.is_active, "secret_rotated": bool(data.secret)},
    )
    db.commit()
    return _webhook_out(endpoint)


@router.get("/webhooks/{endpoint_id}/deliveries")
def webhook_deliveries(
    endpoint_id: uuid.UUID,
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("integrations:manage")
    stmt = select(WebhookDelivery).where(WebhookDelivery.endpoint_id == endpoint_id)
    return paginate(
        db, stmt, params, default_sort=WebhookDelivery.created_at.desc(), transform=lambda d: jsonable(serialize(d))
    )


@router.post("/webhooks/{endpoint_id}/test")
def test_webhook(
    endpoint_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("integrations:manage")
    endpoint = db.get(WebhookEndpoint, endpoint_id)
    if endpoint is None:
        raise NotFound("Webhook introuvable")
    from app.modules.admin.webhooks import deliver

    delivery = WebhookDelivery(endpoint_id=endpoint.id, event_type="system.test")
    db.add(delivery)
    db.flush()
    deliver(db, delivery, None)
    db.commit()
    return jsonable(serialize(delivery))


# ============================================================================ drapeaux de fonctionnalités
@router.get("/feature-flags")
def flags(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    access.require("settings:read")
    return [jsonable(serialize(f)) for f in db.execute(select(FeatureFlag).order_by(FeatureFlag.key)).scalars()]


class FlagIn(BaseModel):
    enabled: bool
    description: str | None = Field(default=None, max_length=1000)
    roles: list[str] = Field(default_factory=list, max_length=20)
    percentage: int = Field(default=100, ge=0, le=100)


@router.put("/feature-flags/{key}")
def put_flag(
    key: str, data: FlagIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("settings:write")
    if not key.replace("_", "").replace(".", "").isalnum() or len(key) > 80:
        raise BusinessRuleError("Clé invalide")
    flag = db.get(FeatureFlag, key) or FeatureFlag(key=key)
    flag.enabled, flag.description, flag.roles, flag.percentage = (
        data.enabled,
        data.description,
        data.roles,
        data.percentage,
    )
    db.merge(flag)
    audit.record(
        db,
        family="system",
        module="settings",
        action="FEATURE_FLAG",
        resource_type="feature_flag",
        resource_id=key,
        diff=data.model_dump(),
    )
    db.commit()
    invalidate("__feature_flags__")
    return jsonable(serialize(flag))


# ============================================================================ sauvegardes & restauration
@router.get("/backups")
def list_backups(
    params: PageParams = Depends(), db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("backups:run")

    def transform(job: BackupJob) -> dict[str, Any]:
        data = serialize(job)
        data.pop("file_path", None)
        return jsonable(data)

    return paginate(db, select(BackupJob), params, default_sort=BackupJob.created_at.desc(), transform=transform)


class BackupIn(BaseModel):
    kind: str = Field(default="full", pattern="^(database|files|full)$")


@router.post("/backups", status_code=202)
def request_backup(
    data: BackupIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("backups:run")
    job = BackupJob(kind=data.kind, status="pending", trigger="manual", triggered_by_id=access.p.id)
    db.add(job)
    db.flush()
    emit(db, "backup.requested", {"job_id": job.id}, aggregate_type="backup_job", aggregate_id=job.id)
    db.commit()
    return {"id": str(job.id), "status": job.status}


@router.post("/backups/{job_id}/verify")
def verify_backup(
    job_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("backups:run")
    return backups.verify(backups.get_job(db, job_id))


@router.post("/backups/{job_id}/restore-test", status_code=202)
def restore_test(
    job_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Restauration de contrôle dans une base isolée (non destructive)."""
    access.require("backups:restore")
    source = backups.get_job(db, job_id)
    if source.status != "success":
        raise BusinessRuleError("Sauvegarde non exploitable")
    emit(
        db,
        "backup.restore_test",
        {"source_id": source.id, "user_id": access.p.id},
        aggregate_type="backup_job",
        aggregate_id=source.id,
    )
    db.commit()
    return {"status": "queued", "source": str(source.id)}


class BreakGlassIn(BaseModel):
    scope: str = Field(pattern="^(restore|purge|hard_delete|secret_reset)$")
    justification: str = Field(min_length=20, max_length=4000)
    code: str = Field(min_length=6, max_length=20)


@router.post("/break-glass", status_code=201)
def break_glass(
    data: BreakGlassIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Accès d'urgence (V4-BACKUP-41) : MFA + justification, durée limitée, alerte direction, audit critique."""
    from app.modules.identity.service import open_break_glass

    if not access.p.has_any("backups:restore", "security:manage"):
        access.require("backups:restore")
    grant = open_break_glass(db, access.p.user, scope=data.scope, justification=data.justification, code=data.code)
    return jsonable({"id": grant.id, "scope": grant.scope, "expires_at": grant.expires_at})


class RestoreIn(BaseModel):
    break_glass_id: uuid.UUID
    confirmation: str = Field(pattern="^RESTAURER$")


@router.post("/backups/{job_id}/restore", status_code=202)
def restore(
    job_id: uuid.UUID, data: RestoreIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.identity.service import require_break_glass

    access.require("backups:restore")
    source = backups.get_job(db, job_id)
    check = backups.verify(source)
    if not check["ok"]:
        raise BusinessRuleError(f"Sauvegarde invalide : {check['reason']}", code="BACKUP_INVALID")
    grant = require_break_glass(db, access.p.id, "restore", data.break_glass_id)
    emit(
        db,
        "backup.restore",
        {"source_id": source.id, "user_id": access.p.id, "break_glass_id": grant.id},
        aggregate_type="backup_job",
        aggregate_id=source.id,
    )
    audit.record(
        db,
        family="security",
        module="backups",
        action="RESTORE_REQUESTED",
        resource_type="backup_job",
        resource_id=source.id,
        diff={"break_glass": str(grant.id)},
        criticality="CRITICAL",
    )
    db.commit()
    return {"status": "queued", "source": str(source.id)}


# ============================================================================ audit & jobs
# ---------------------------------------------------------------------------- centre de sécurité
@router.get("/security/overview")
def security_overview(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """Synthèse sécurité : adoption MFA, comptes verrouillés, sessions actives, échecs de connexion, alertes."""
    from datetime import timedelta

    from app.modules.identity.models import ApiCredential, User, UserSession
    from app.modules.identity.service import role_requires_mfa as mfa_required_for

    access.require("security:read")
    now = utcnow()
    users = db.execute(select(User).where(User.deleted_at.is_(None))).scalars().all()
    active_users = [u for u in users if u.is_active]
    locked = [u for u in active_users if u.locked_until and u.locked_until > now]
    mfa_gap = [u for u in active_users if mfa_required_for(u) and not u.mfa_enabled]
    sessions = db.execute(
        select(UserSession.application, func.count())
        .where(UserSession.revoked_at.is_(None), UserSession.expires_at > now)
        .group_by(UserSession.application)
    ).all()
    day = now - timedelta(days=1)
    failed = db.execute(
        select(func.count())
        .select_from(AuditEvent)
        .where(
            AuditEvent.family == "security",
            AuditEvent.action == "LOGIN",
            AuditEvent.result == "FAIL",
            AuditEvent.timestamp_utc >= day,
        )
    ).scalar_one()
    alerts = (
        db.execute(
            select(AuditEvent)
            .where(AuditEvent.family == "security", AuditEvent.criticality.in_(["HIGH", "CRITICAL"]))
            .order_by(AuditEvent.seq.desc())
            .limit(50)
        )
        .scalars()
        .all()
    )
    api_keys = db.execute(
        select(func.count()).select_from(ApiCredential).where(ApiCredential.revoked_at.is_(None))
    ).scalar_one()
    return jsonable(
        {
            "users": {
                "total": len(users),
                "active": len(active_users),
                "mfa_enabled": sum(1 for u in active_users if u.mfa_enabled),
                "mfa_missing": [{"id": u.id, "name": u.full_name, "email": u.email} for u in mfa_gap[:100]],
            },
            "locked_accounts": [
                {
                    "id": u.id,
                    "name": u.full_name,
                    "email": u.email,
                    "locked_until": u.locked_until,
                    "failed_login_count": u.failed_login_count,
                }
                for u in locked
            ],
            "sessions": {"total": sum(c for _, c in sessions), "by_application": {a or "web": c for a, c in sessions}},
            "failed_logins_24h": failed,
            "api_keys_active": api_keys,
            "alerts": [serialize(a) for a in alerts],
        }
    )


@router.get("/security/sessions")
def security_sessions(
    params: PageParams = Depends(),
    user_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    """Sessions actives (tous utilisateurs) : application, IP, appareil, dernière activité."""
    from app.modules.identity.models import User, UserSession

    access.require("security:read")
    stmt = (
        select(UserSession, User)
        .join(User, User.id == UserSession.user_id)
        .where(UserSession.revoked_at.is_(None), UserSession.expires_at > utcnow())
    )
    if user_id:
        stmt = stmt.where(UserSession.user_id == user_id)
    page = paginate(db, stmt, params, default_sort=UserSession.created_at.desc(), scalars=False)
    page["items"] = [
        jsonable(
            {
                "id": s.id,
                "user_id": u.id,
                "user": u.full_name,
                "email": u.email,
                "application": s.application,
                "ip": s.ip,
                "user_agent": s.user_agent,
                "auth_method": s.auth_method,
                "mfa_verified": s.mfa_verified_at is not None,
                "created_at": s.created_at,
                "last_used_at": s.last_used_at,
                "expires_at": s.expires_at,
            }
        )
        for s, u in page["items"]
    ]
    return page


@router.get("/audit")
def audit_log(
    params: PageParams = Depends(),
    family: str | None = None,
    module: str | None = None,
    action: str | None = None,
    actor_id: uuid.UUID | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    criticality: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("audit:read")
    stmt = select(AuditEvent)
    for col, value in (
        (AuditEvent.family, family),
        (AuditEvent.module, module),
        (AuditEvent.action, action),
        (AuditEvent.actor_id, actor_id),
        (AuditEvent.resource_type, resource_type),
        (AuditEvent.resource_id, resource_id),
        (AuditEvent.criticality, criticality),
    ):
        if value:
            stmt = stmt.where(col == value)
    if start:
        stmt = stmt.where(AuditEvent.timestamp_utc >= start)
    if end:
        stmt = stmt.where(AuditEvent.timestamp_utc <= end)
    return paginate(db, stmt, params, default_sort=AuditEvent.seq.desc(), transform=lambda e: jsonable(serialize(e)))


@router.get("/audit/verify")
def audit_verify(
    limit: int | None = Query(default=None, ge=1), db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("audit:read")
    result = audit.verify_chain(db, limit=limit)
    audit.record(
        db,
        family="security",
        module="audit",
        action="CHAIN_VERIFY",
        result="SUCCESS" if result["valid"] else "FAIL",
        diff={"checked": result.get("checked")},
        criticality="LOW" if result["valid"] else "CRITICAL",
    )
    db.commit()
    return result


@router.get("/jobs")
def jobs(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    access.require("settings:read")
    from app.workers.scheduler import job_catalog

    out = []
    for job in job_catalog():
        last = (
            db.execute(select(JobRun).where(JobRun.job == job["name"]).order_by(JobRun.started_at.desc()))
            .scalars()
            .first()
        )
        out.append({**job, "last_run": jsonable(serialize(last)) if last else None})
    return out


@router.post("/jobs/{name}/run")
def run_job(name: str, access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("maintenance:manage")
    from app.workers.scheduler import run_by_name

    try:
        return jsonable(run_by_name(name))
    except KeyError as exc:
        raise NotFound("Job inconnu") from exc


@router.get("/system")
def system(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("settings:read")
    size = db.execute(select(func.pg_database_size(func.current_database()))).scalar_one()
    pending = db.execute(
        select(func.count()).select_from(OutboxEvent).where(OutboxEvent.status == "pending")
    ).scalar_one()
    failed = db.execute(
        select(func.count()).select_from(OutboxEvent).where(OutboxEvent.status == "failed")
    ).scalar_one()
    last_backup = (
        db.execute(select(BackupJob).where(BackupJob.status == "success").order_by(BackupJob.created_at.desc()))
        .scalars()
        .first()
    )
    return jsonable(
        {
            "environment": settings.ENV,
            "version": settings.APP_VERSION,
            "database_size_bytes": size,
            "outbox_pending": pending,
            "outbox_failed": failed,
            "last_backup": {"at": last_backup.created_at, "kind": last_backup.kind, "size": last_backup.size_bytes}
            if last_backup
            else None,
            "now": utcnow(),
        }
    )
