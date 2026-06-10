"""JWT + password hashing service — Extended with RBAC and invitation tokens."""
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import get_settings
from app.auth.models import User
from app.utils.time import utcnow_naive

settings = get_settings()

# ── Config ────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)


# ── Generic SHA-256 hex helper (reused for reset tokens + session tokens) ──
def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


# ── Password reset helpers ───────────────────────────────────
def generate_reset_token() -> str:
    """Generate a secure random reset token (raw, to send via email)."""
    return secrets.token_urlsafe(48)


def hash_reset_token(token: str) -> str:
    """Hash a reset token for safe DB storage (SHA-256)."""
    return sha256_hex(token)


# ── Password ─────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT Tokens ───────────────────────────────────────────────
def create_access_token(user_id: str, role: str, minutes: Optional[int] = None) -> str:
    """Create a short-lived access token.

    `minutes` overrides the default TTL when provided — driven by the persisted
    `session_timeout` setting so admins can tune session expiration.
    """
    ttl = minutes if minutes is not None else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.utcnow() + timedelta(minutes=ttl)
    payload = {
        "sub": user_id,
        "role": role,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str, role: str) -> str:
    """Create a long-lived refresh token."""
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "role": role,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.JWT_REFRESH_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_invitation_token(email: str, hours: int = 48) -> str:
    """Create a short-lived invitation token for onboarding emails."""
    expire = datetime.utcnow() + timedelta(hours=hours)
    payload = {
        "sub": email,
        "exp": expire,
        "type": "invitation",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and validate an access token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise JWTError("Invalid token type")
        return payload
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token invalide ou expiré")


def decode_refresh_token(token: str) -> dict:
    """Decode and validate a refresh token."""
    try:
        payload = jwt.decode(token, settings.JWT_REFRESH_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise JWTError("Invalid token type")
        return payload
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token invalide ou expiré")


def decode_invitation_token(token: str) -> dict:
    """Decode and validate an invitation token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "invitation":
            raise JWTError("Invalid token type")
        return payload
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Lien d'invitation invalide ou expiré")


# ── Préférences de session / politique 2FA (persistées en settings) ──
_SESSION_TIMEOUT_MINUTES = {
    "30 minutes": 30,
    "1 heure": 60,
    "2 heures": 120,
    "4 heures": 240,
    "8 heures": 480,
    "Jamais": 60 * 24 * 365,  # ~1 an
}


async def _site_settings(db: AsyncSession):
    """Fetch the singleton CMSSiteSettings row (lazy import avoids cycles)."""
    from app.models.cms import CMSSiteSettings
    r = await db.execute(select(CMSSiteSettings).limit(1))
    return r.scalars().first()


def session_timeout_minutes(label: Optional[str]) -> int:
    """Map the persisted session_timeout label to a number of minutes."""
    return _SESSION_TIMEOUT_MINUTES.get(
        (label or "").strip(), settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )


async def is_2fa_enforced_for(db: AsyncSession, user: User) -> bool:
    """True when the org policy makes 2FA mandatory for this (staff) user."""
    s = await _site_settings(db)
    return bool(s and getattr(s, "enforce_2fa", False) and user.role != "CLIENT")


async def needs_2fa_setup(db: AsyncSession, user: User) -> bool:
    """True when 2FA is mandatory for this user but not yet enabled —
    used to prompt a forced enrollment after login."""
    if not await is_2fa_enforced_for(db, user):
        return False
    from app.services.twofactor_service import is_2fa_enabled
    return not await is_2fa_enabled(db, user.id)


async def issue_token_response(user: User, db: Optional[AsyncSession] = None):
    """Build a TokenResponse (access + refresh + user out) for a logged-in user.

    Centralised so login / refresh / set-password / reset-password / 2FA
    verify all return the exact same shape. When `db` is provided the access
    token TTL honours the persisted `session_timeout` setting and
    `must_setup_2fa` reflects the `enforce_2fa` policy.
    """
    from app.auth.schemas import TokenResponse, user_to_out
    minutes: Optional[int] = None
    must_setup = False
    if db is not None:
        s = await _site_settings(db)
        minutes = session_timeout_minutes(getattr(s, "session_timeout", None) if s else None)
        if s and getattr(s, "enforce_2fa", False) and user.role != "CLIENT":
            from app.services.twofactor_service import is_2fa_enabled
            must_setup = not await is_2fa_enabled(db, user.id)
    return TokenResponse(
        access_token=create_access_token(user.id, user.role, minutes),
        refresh_token=create_refresh_token(user.id, user.role),
        force_reset=user.must_change_password,
        must_setup_2fa=must_setup,
        user=user_to_out(user),
    )


def create_2fa_challenge_token(user_id: str, minutes: int = 5) -> str:
    """Short-lived token issued after password OK but before 2FA verified."""
    expire = utcnow_naive() + timedelta(minutes=minutes)
    payload = {"sub": user_id, "exp": expire, "type": "2fa_challenge"}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_2fa_challenge_token(token: str) -> str:
    """Decode a 2FA challenge token, returning the user_id."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "2fa_challenge":
            raise JWTError("Invalid token type")
        return payload["sub"]
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Challenge token invalide ou expiré")


# ── Dependencies ─────────────────────────────────────────────
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    if not credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token manquant")
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token invalide")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token invalide ou expiré")

    result = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Utilisateur introuvable")
    # Allow must_change_password users through — the frontend handles the redirect
    return user


async def require_admin(user: User = Depends(get_current_user)):
    if user.role != "ADMIN":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès réservé aux administrateurs")
    return user


def require_role(*allowed_roles: str):
    """Factory that creates a dependency requiring specific role(s).

    Usage:
        @router.get("/rh", dependencies=[Depends(require_role("ADMIN", "RH"))])
    """
    async def _check(user: User = Depends(get_current_user)):
        if user.role not in allowed_roles:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Accès réservé aux rôles : {', '.join(allowed_roles)}",
            )
        return user
    return _check


# Convenience shortcuts for common role checks
require_chef_projet = require_role("ADMIN", "CHEF_PROJET")
require_comptable = require_role("ADMIN", "COMPTABLE")
require_rh = require_role("ADMIN", "RH")
require_staff = require_role("ADMIN", "CHEF_PROJET", "COMPTABLE", "RH")


# ── Auth queries ─────────────────────────────────────────────
async def authenticate_user(db: AsyncSession, email: str, password: str):
    result = await db.execute(
        select(User).where(User.email == email, User.deleted_at.is_(None))
    )
    user = result.scalars().first()
    if not user or not verify_password(password, user.password_hash):
        return None
    # Users with must_change_password are allowed to authenticate
    # (they need a token to reach the set-password endpoint)
    # But fully deactivated users (is_active=False AND must_change_password=False) are blocked
    if not user.is_active and not user.must_change_password:
        return None
    return user
