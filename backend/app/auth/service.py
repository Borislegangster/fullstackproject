"""JWT + password hashing service — Extended with RBAC and invitation tokens."""
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

settings = get_settings()

# ── Config ────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)


# ── Password ─────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT Tokens ───────────────────────────────────────────────
def create_access_token(user_id: str, role: str) -> str:
    """Create a short-lived access token."""
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
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
