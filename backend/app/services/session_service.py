"""Session tracking — Records each successful login as a UserSession row.

The frontend can list them via /auth/sessions and revoke specific ones.
"""
import secrets as _secrets
from datetime import timedelta
from typing import Optional

from fastapi import Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User, UserSession
from app.auth.service import sha256_hex
from app.config import get_settings
from app.utils.time import utcnow_naive

settings = get_settings()


def _device_label_from_ua(user_agent: str) -> str:
    """Best-effort device label from user-agent string."""
    if not user_agent:
        return "Inconnu"
    try:
        from user_agents import parse
        ua = parse(user_agent)
        browser = (ua.browser.family or "").strip()
        os = (ua.os.family or "").strip()
        device = (ua.device.family or "").strip()
        parts = [p for p in [browser, "on", os] if p]
        label = " ".join(parts)
        if ua.is_mobile and device and device != "Other":
            label = f"{device} ({label})" if label else device
        return label or user_agent[:60]
    except Exception:
        return user_agent[:60]


async def create_session_record(
    db: AsyncSession,
    user: User,
    request: Optional[Request] = None,
    refresh_token: Optional[str] = None,
) -> UserSession:
    """Create a UserSession row for a successful login."""
    ua = ""
    ip = ""
    if request is not None:
        ua = request.headers.get("user-agent", "")
        ip = str(request.client.host) if request.client else ""

    # If no refresh token is provided we still record the session — for the
    # admin overview — with a random surrogate hash so the unique index is OK.
    token_hash = sha256_hex(refresh_token) if refresh_token else sha256_hex(_secrets.token_urlsafe(32))

    expires = utcnow_naive() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    sess = UserSession(
        user_id=user.id,
        refresh_token_hash=token_hash,
        user_agent=ua[:255],
        ip_address=ip,
        device_label=_device_label_from_ua(ua),
        last_active_at=utcnow_naive(),
        expires_at=expires,
    )
    db.add(sess)
    await db.flush()
    return sess


async def list_user_sessions(db: AsyncSession, user_id: str) -> list[UserSession]:
    r = await db.execute(
        select(UserSession)
        .where(
            UserSession.user_id == user_id,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > utcnow_naive(),
        )
        .order_by(UserSession.last_active_at.desc())
    )
    return list(r.scalars().all())


async def revoke_session(db: AsyncSession, session_id: str, user_id: str) -> bool:
    r = await db.execute(
        select(UserSession).where(
            UserSession.id == session_id,
            UserSession.user_id == user_id,
        )
    )
    sess = r.scalars().first()
    if not sess or sess.revoked_at is not None:
        return False
    sess.revoked_at = utcnow_naive()
    await db.flush()
    return True


async def revoke_all_sessions_except(
    db: AsyncSession, user_id: str, current_session_id: Optional[str] = None
) -> int:
    """Bulk-revoke every active session for a user (optionally keeping one).

    Single UPDATE statement so the round-trip cost is independent of the
    number of devices.
    """
    stmt = (
        update(UserSession)
        .where(
            UserSession.user_id == user_id,
            UserSession.revoked_at.is_(None),
        )
        .values(revoked_at=utcnow_naive())
    )
    if current_session_id:
        stmt = stmt.where(UserSession.id != current_session_id)
    result = await db.execute(stmt)
    return result.rowcount or 0
