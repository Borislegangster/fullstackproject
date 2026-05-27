"""Auth API routes."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.config import get_settings
from app.auth.service import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    decode_invitation_token,
    get_current_user,
    hash_password,
)
from app.auth.schemas import (
    LoginRequest,
    RefreshTokenRequest,
    SetPasswordRequest,
    TokenResponse,
    UserOut,
)
from app.auth.models import User

settings = get_settings()
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _user_out(user: User) -> UserOut:
    """Helper to build a UserOut from a User model."""
    return UserOut(
        id=user.id,
        email=user.email,
        first_name=user.first_name or "",
        last_name=user.last_name or "",
        full_name=user.full_name,
        role=user.role,
        phone=user.phone or "",
        avatar_url=user.avatar_url,
        must_change_password=user.must_change_password,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def login(request: Request, data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Email ou mot de passe incorrect",
        )
    # Update last login
    user.last_login_at = datetime.utcnow()
    await db.commit()

    access_token = create_access_token(user.id, user.role)
    refresh_token = create_refresh_token(user.id, user.role)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        force_reset=user.must_change_password,
        user=_user_out(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a valid refresh token for a new access + refresh token pair."""
    payload = decode_refresh_token(data.refresh_token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token invalide")

    result = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Utilisateur introuvable ou désactivé")

    new_access = create_access_token(user.id, user.role)
    new_refresh = create_refresh_token(user.id, user.role)
    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        force_reset=user.must_change_password,
        user=_user_out(user),
    )


@router.post("/set-password")
async def set_password(data: SetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Set password for first-time login (invitation flow) or forced reset."""
    # Decode the invitation token to find the user
    payload = decode_invitation_token(data.token)
    email = payload.get("sub")
    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Token invalide")

    result = await db.execute(
        select(User).where(User.email == email, User.deleted_at.is_(None))
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Utilisateur introuvable")

    # Validate password strength (min 8 chars)
    if len(data.new_password) < 8:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Le mot de passe doit contenir au moins 8 caractères",
        )

    # Update user
    user.password_hash = hash_password(data.new_password)
    user.must_change_password = False
    user.is_active = True
    user.invitation_token = None
    user.updated_at = datetime.utcnow()
    await db.commit()

    # Return tokens so the user is logged in immediately
    access_token = create_access_token(user.id, user.role)
    refresh_token = create_refresh_token(user.id, user.role)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        force_reset=False,
        user=_user_out(user),
    )


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    return _user_out(user)
