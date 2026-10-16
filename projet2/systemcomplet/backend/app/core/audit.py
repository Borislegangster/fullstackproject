"""Journal d'activité append-only chaîné (§22, V4-AUDIT-34, V4-SEC-04).

Familles : business / security / system. Chaque événement porte le correlation_id de la requête et
une empreinte d'intégrité chaînée (SHA-256 du hash précédent + contenu canonique).
"""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import UTC
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.context import get_context
from app.core.utils import jsonable, mask_ip, truncate, utcnow
from app.modules.system.models import AuditEvent

log = logging.getLogger("globus.audit")

FAMILIES = ("business", "security", "system")
CRITICALITIES = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
_AUDIT_LOCK_KEY = 74_210_001
_SENSITIVE_KEYS = ("password", "secret", "token", "hash", "otp", "code", "key", "iban", "cvv", "pin")


def _minimize(value: Any) -> Any:
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for k, v in value.items():
            if any(s in str(k).lower() for s in _SENSITIVE_KEYS):
                out[k] = "***"
            else:
                out[k] = _minimize(v)
        return out
    if isinstance(value, list):
        return [_minimize(v) for v in value[:50]]
    return truncate(jsonable(value), 500)


def diff_dicts(before: dict[str, Any] | None, after: dict[str, Any] | None) -> dict[str, Any]:
    """Différence minimisée {champ: [ancien, nouveau]}."""
    before = before or {}
    after = after or {}
    changes: dict[str, Any] = {}
    for key in sorted(set(before) | set(after)):
        old, new = jsonable(before.get(key)), jsonable(after.get(key))
        if old != new:
            changes[key] = [old, new]
    return _minimize(changes)


def snapshot(obj: Any, fields: list[str] | None = None) -> dict[str, Any]:
    """Instantané des colonnes d'un objet ORM (pour diff)."""
    if obj is None:
        return {}
    table = getattr(obj, "__table__", None)
    names = fields or ([c.key for c in table.columns] if table is not None else [])
    return {name: getattr(obj, name, None) for name in names}


def _canonical(ev: AuditEvent) -> str:
    return json.dumps(
        {
            "event_id": str(ev.event_id),
            "ts": ev.timestamp_utc.astimezone(UTC).isoformat(timespec="microseconds"),
            "family": ev.family,
            "actor_id": str(ev.actor_id) if ev.actor_id else None,
            "actor_type": ev.actor_type,
            "module": ev.module,
            "action": ev.action,
            "resource_type": ev.resource_type,
            "resource_id": ev.resource_id,
            "diff": ev.diff,
            "result": ev.result,
            "reason": ev.reason,
            "criticality": ev.criticality,
            "request_id": ev.request_id,
        },
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=str,
    )


def compute_hash(prev_hash: str | None, ev: AuditEvent) -> str:
    return hashlib.sha256(((prev_hash or "GENESIS") + "|" + _canonical(ev)).encode("utf-8")).hexdigest()


def record(
    db: Session,
    *,
    family: str,
    module: str,
    action: str,
    resource_type: str | None = None,
    resource_id: Any = None,
    actor_id: uuid.UUID | None = None,
    actor_type: str = "user",
    actor_label: str | None = None,
    diff: dict[str, Any] | None = None,
    result: str = "SUCCESS",
    reason: str | None = None,
    criticality: str = "LOW",
    project_id: uuid.UUID | None = None,
) -> AuditEvent:
    """Ajoute un événement dans la transaction courante (atomique avec l'action métier)."""
    if family not in FAMILIES:
        raise ValueError(f"famille d'audit inconnue : {family}")
    if criticality not in CRITICALITIES:
        raise ValueError(f"criticité inconnue : {criticality}")
    ctx = get_context()
    if actor_id is None and ctx.user_id:
        try:
            actor_id = uuid.UUID(ctx.user_id)
        except ValueError:
            actor_id = None
    db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _AUDIT_LOCK_KEY})
    prev_hash = db.execute(
        select(AuditEvent.integrity_hash).order_by(AuditEvent.seq.desc()).limit(1)
    ).scalar_one_or_none()
    ev = AuditEvent(
        event_id=uuid.uuid4(),
        timestamp_utc=utcnow(),
        family=family,
        actor_id=actor_id,
        actor_type=actor_type if actor_id or actor_type != "user" else "anonymous",
        actor_label=actor_label,
        application=ctx.application,
        app_version=ctx.app_version,
        device_id=ctx.device_id,
        module=module,
        action=action.upper(),
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        project_id=project_id,
        diff=_minimize(diff or {}),
        ip=ctx.ip if family == "security" else mask_ip(ctx.ip),
        user_agent=ctx.user_agent,
        request_id=ctx.request_id,
        result=result,
        reason=reason,
        criticality=criticality,
        prev_hash=prev_hash,
    )
    ev.integrity_hash = compute_hash(prev_hash, ev)
    db.add(ev)
    db.flush()
    return ev


def record_independent(**kwargs: Any) -> None:
    """Événement persistant même si la transaction métier échoue (ex. échec de connexion)."""
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        record(db, **kwargs)
        db.commit()
    except Exception:
        db.rollback()
        log.exception("audit_independent_failed")
    finally:
        db.close()


def verify_chain(db: Session, *, limit: int | None = None) -> dict[str, Any]:
    """Recalcule la chaîne et signale la première rupture éventuelle."""
    stmt = select(AuditEvent).order_by(AuditEvent.seq.asc())
    if limit:
        stmt = stmt.limit(limit)
    prev: str | None = None
    checked = 0
    for ev in db.execute(stmt).scalars():
        expected = compute_hash(prev, ev)
        if ev.prev_hash != prev or ev.integrity_hash != expected:
            return {"valid": False, "checked": checked, "broken_at_seq": ev.seq, "event_id": str(ev.event_id)}
        prev = ev.integrity_hash
        checked += 1
    return {"valid": True, "checked": checked, "last_hash": prev}
