"""Auth API routes."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.service import authenticate_user, create_access_token, get_current_user
from app.auth.schemas import LoginRequest, TokenResponse, UserOut
from app.auth.models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Email ou mot de passe incorrect",
        )
    token = create_access_token(user.id, user.role)
    return TokenResponse(
        access_token=token,
        user=UserOut(id=user.id, email=user.email, full_name=user.full_name, role=user.role),
    )


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    return UserOut(id=user.id, email=user.email, full_name=user.full_name, role=user.role)
