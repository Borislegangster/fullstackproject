"""Auth API routes."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
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
    get_current_user,
)
from app.auth.schemas import LoginRequest, RefreshTokenRequest, TokenResponse, UserOut
from app.auth.models import User

settings = get_settings()
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def login(request: Request, data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Email ou mot de passe incorrect",
        )
    access_token = create_access_token(user.id, user.role)
    refresh_token = create_refresh_token(user.id, user.role)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut(id=user.id, email=user.email, full_name=user.full_name, role=user.role),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a valid refresh token for a new access + refresh token pair."""
    payload = decode_refresh_token(data.refresh_token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token invalide")

    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Utilisateur introuvable ou désactivé")

    new_access = create_access_token(user.id, user.role)
    new_refresh = create_refresh_token(user.id, user.role)
    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        user=UserOut(id=user.id, email=user.email, full_name=user.full_name, role=user.role),
    )


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    return UserOut(id=user.id, email=user.email, full_name=user.full_name, role=user.role)
