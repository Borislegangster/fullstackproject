"""Auth API routes."""
from datetime import timedelta
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
# pyrefly: ignore [missing-import]
from sqlalchemy import select
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from app.rate_limit import limiter

from app.database import get_db
from app.config import get_settings
from app import metrics
from app.auth.service import (
    authenticate_user,
    create_2fa_challenge_token,
    decode_refresh_token,
    decode_invitation_token,
    get_current_user,
    hash_password,
    verify_password,
    generate_reset_token,
    hash_reset_token,
    issue_token_response,
    needs_2fa_setup,
)
from app.auth.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    ResetPasswordRequest,
    SetPasswordRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserOut,
    user_to_out,
)
from app.auth.models import PasswordResetToken, User
from app.services.email_service import (
    send_password_changed_notification,
    send_password_reset_email,
)
from app.services.session_service import create_session_record
from app.services.twofactor_service import is_2fa_enabled
from app.utils.time import utcnow_naive

# Backward-compat exports (used by other modules that still import from auth)
_user_out = user_to_out

settings = get_settings()

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login")
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def login(request: Request, data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login endpoint. Returns either:
      - TokenResponse on standard success
      - {"two_factor_required": True, "challenge_token": "...", "email": "..."}
        when the user has 2FA enabled (frontend should call /auth/2fa/login-verify)
    Also enforces account lockout after consecutive failed attempts.
    """
    # Account lockout check (anti brute-force)
    pre_r = await db.execute(
        select(User).where(User.email == data.email, User.deleted_at.is_(None))
    )
    pre = pre_r.scalars().first()
    if pre and pre.locked_until and pre.locked_until > utcnow_naive():
        metrics.inc("auth_login_locked_total")
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Compte temporairement verrouillé. Réessayez dans quelques minutes.",
        )

    user = await authenticate_user(db, data.email, data.password)
    if not user:
        # Bump failed attempts; lock at 5
        if pre:
            pre.failed_login_attempts = (pre.failed_login_attempts or 0) + 1
            if pre.failed_login_attempts >= 5:
                pre.locked_until = utcnow_naive() + timedelta(minutes=15)
                pre.failed_login_attempts = 0
            await db.commit()
        metrics.inc("auth_login_failures_total")
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Email ou mot de passe incorrect",
        )

    # Successful password — check 2FA
    if await is_2fa_enabled(db, user.id):
        return {
            "two_factor_required": True,
            "challenge_token": create_2fa_challenge_token(user.id),
            "email": user.email,
        }

    # Standard success path — single commit for both user update and session insert
    user.last_login_at = utcnow_naive()
    user.failed_login_attempts = 0
    user.locked_until = None
    await create_session_record(db, user, request)
    await db.commit()

    metrics.inc("auth_login_success_total")
    return await issue_token_response(user, db)


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

    return await issue_token_response(user, db)


@router.post("/set-password", response_model=TokenResponse)
async def set_password(data: SetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Set password for first-time login (invitation flow) or forced reset.

    Accepts both `token` and `invitation_token` (validator merges them).
    Pydantic also enforces min length 8 — no need to recheck.
    """
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

    user.password_hash = hash_password(data.new_password)
    user.must_change_password = False
    user.is_active = True
    user.invitation_token = None
    user.updated_at = utcnow_naive()
    await db.commit()

    return await issue_token_response(user, db)


# ── Forgot / Reset password ──────────────────────────────────

@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Trigger a password reset email if the account exists.

    Always returns success to avoid email enumeration.
    """
    result = await db.execute(
        select(User).where(User.email == data.email, User.deleted_at.is_(None))
    )
    user = result.scalars().first()

    if user and user.is_active:
        # Generate token (raw to email, hashed in DB)
        raw_token = generate_reset_token()
        token_hash = hash_reset_token(raw_token)
        expires_at = utcnow_naive() + timedelta(hours=1)

        prt = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
            requested_ip=str(request.client.host) if request.client else "",
        )
        db.add(prt)
        await db.commit()

        bg.add_task(send_password_reset_email, user.email, raw_token, user.first_name)

    # Always return the same response (anti-enumeration)
    return {"detail": "Si un compte existe avec cette adresse, un email a été envoyé."}


@router.post("/reset-password", response_model=TokenResponse)
async def reset_password(
    data: ResetPasswordRequest,
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Consume a reset token and update the password.

    Returns a fresh token pair so the user is logged in immediately.
    """
    token_hash = hash_reset_token(data.token)
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )
    prt = result.scalars().first()
    now = utcnow_naive()
    if not prt or prt.used_at is not None or prt.expires_at < now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Lien invalide ou expiré")

    user_r = await db.execute(
        select(User).where(User.id == prt.user_id, User.deleted_at.is_(None))
    )
    user = user_r.scalars().first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Utilisateur introuvable")

    # Update password and invalidate the token
    user.password_hash = hash_password(data.new_password)
    user.must_change_password = False
    user.is_active = True
    user.failed_login_attempts = 0
    user.locked_until = None
    user.updated_at = now
    prt.used_at = now

    await db.commit()

    bg.add_task(send_password_changed_notification, user.email, user.first_name)

    return await issue_token_response(user, db)


# ── Authenticated profile management ─────────────────────────

@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    out = _user_out(user)
    out.must_setup_2fa = await needs_2fa_setup(db, user)
    return out


@router.patch("/me", response_model=UserOut)
async def update_me(
    data: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's own profile."""
    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        if value is not None:
            setattr(user, field, value)
    user.updated_at = utcnow_naive()
    await db.commit()
    await db.refresh(user)
    return _user_out(user)


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    bg: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the current user's password (must know current password)."""
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mot de passe actuel incorrect")
    if data.current_password == data.new_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Le nouveau mot de passe doit être différent")

    user.password_hash = hash_password(data.new_password)
    user.must_change_password = False
    user.updated_at = utcnow_naive()
    await db.commit()

    bg.add_task(send_password_changed_notification, user.email, user.first_name)
    return {"detail": "Mot de passe modifié avec succès"}


# ── Multi-device sessions ────────────────────────────────────

@router.get("/sessions")
async def list_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the current user's active sessions across devices."""
    from app.services.session_service import list_user_sessions
    sessions = await list_user_sessions(db, user.id)
    return [
        {
            "id": s.id,
            "device_label": s.device_label,
            "user_agent": s.user_agent,
            "ip_address": s.ip_address,
            "last_active_at": s.last_active_at.isoformat() if s.last_active_at else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in sessions
    ]


@router.post("/sessions/{session_id}/revoke")
async def revoke_session(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a specific session (force logout on that device)."""
    from app.services.session_service import revoke_session as do_revoke
    ok = await do_revoke(db, session_id, user.id)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session introuvable")
    await db.commit()
    return {"detail": "Session révoquée"}


@router.post("/sessions/revoke-others")
async def revoke_all_other_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke every session except the current one (logout from all other devices)."""
    from app.services.session_service import revoke_all_sessions_except
    count = await revoke_all_sessions_except(db, user.id, current_session_id=None)
    await db.commit()
    return {"detail": "Sessions révoquées", "count": count}
