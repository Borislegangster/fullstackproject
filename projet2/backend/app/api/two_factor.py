"""Two-factor authentication endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.schemas import (
    TokenResponse,
    TwoFactorDisableRequest,
    TwoFactorEnrollOut,
    TwoFactorLoginRequest,
    TwoFactorVerifyRequest,
    TwoFactorVerifyResponse,
)
from app.auth.service import (
    create_2fa_challenge_token,
    decode_2fa_challenge_token,
    create_access_token,
    create_refresh_token,
    get_current_user,
    is_2fa_enforced_for,
    issue_token_response,
    verify_password,
)
from app.database import get_db
from app.services import twofactor_service as tfa
from app.services.activity_service import log_activity
from app.utils.time import utcnow_naive

router = APIRouter(prefix="/auth/2fa", tags=["Two-Factor Auth"])


# ── User-side endpoints (authenticated) ──────────────────────

@router.get("/status")
async def get_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return whether 2FA is enabled for the current user."""
    enabled = await tfa.is_2fa_enabled(db, user.id)
    return {"enabled": enabled}


@router.post("/enroll", response_model=TwoFactorEnrollOut)
async def enroll_2fa(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Begin 2FA enrollment: returns the otpauth:// URI for QR rendering.

    The secret is stored in DB but `enabled=False` until /verify is called.
    """
    secret = await tfa.start_enrollment(db, user)
    await db.commit()
    return TwoFactorEnrollOut(
        otp_uri=tfa.build_otp_uri(user.email, secret),
        secret=secret,
        issuer=tfa.ISSUER,
    )


@router.post("/verify", response_model=TwoFactorVerifyResponse)
async def verify_2fa_enrollment(
    data: TwoFactorVerifyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm enrollment with a 6-digit code. Returns one-time backup codes."""
    ok, codes = await tfa.confirm_enrollment(db, user, data.code)
    if not ok:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Code invalide ou expiré")
    await log_activity(db, user.id, "2FA_ENROLLED", "user", user.id)
    await db.commit()
    return TwoFactorVerifyResponse(
        detail="2FA activée. Conservez vos codes de secours en lieu sûr.",
        backup_codes=codes,
    )


@router.post("/disable")
async def disable_2fa(
    data: TwoFactorDisableRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disable 2FA after confirming the password."""
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mot de passe incorrect")
    # Politique de sécurité : 2FA obligatoire → désactivation interdite
    if await is_2fa_enforced_for(db, user):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "La 2FA est obligatoire (politique de sécurité) et ne peut pas être désactivée.",
        )
    ok = await tfa.disable_2fa(db, user.id)
    if not ok:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "2FA n'est pas activée")
    await log_activity(db, user.id, "2FA_DISABLED", "user", user.id)
    await db.commit()
    return {"detail": "2FA désactivée"}


# ── Login completion endpoint (no auth — uses challenge token) ──

@router.post("/login-verify", response_model=TokenResponse)
async def complete_login_with_2fa(
    data: TwoFactorLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Second step of login when 2FA is enabled.

    The frontend receives a challenge_token from /auth/login when 2FA is on,
    then submits it here together with the TOTP / backup code.
    """
    user_id = decode_2fa_challenge_token(data.challenge_token)
    user_r = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = user_r.scalars().first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Utilisateur introuvable")

    ok = await tfa.verify_login_code(db, user.id, data.code)
    if not ok:
        await log_activity(db, user.id, "2FA_LOGIN_FAILED", "user", user.id,
                            ip_address=str(request.client.host) if request.client else "")
        await db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Code 2FA invalide")

    # Issue real tokens
    user.last_login_at = utcnow_naive()
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()

    return await issue_token_response(user, db)
