"""Services d'identité : connexion, MFA (TOTP / WebAuthn / codes de secours), sessions avec rotation des
jetons de rafraîchissement, appareils, réinitialisation, invitations, inscription client, OTP métier,
break-glass. Tous les événements de sécurité sont audités (famille « security »)."""

from __future__ import annotations

import base64
import io
import json
import uuid
from datetime import timedelta
from typing import Any

import jwt
import pyotp
import qrcode
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.context import get_context
from app.core.errors import AppError, BusinessRuleError, Conflict, Forbidden, NotFound, Unauthorized
from app.core.events import emit
from app.core.security import (
    create_access_token,
    create_purpose_token,
    decode_token,
    generate_numeric_code,
    hash_password,
    password_needs_rehash,
    random_token,
    sha256_hex,
    validate_password_strength,
    verify_password,
)
from app.core.utils import clean_phone, utcnow
from app.modules.identity.models import (
    Device,
    Invitation,
    MFAFactor,
    MFARecoveryCode,
    Organization,
    Role,
    User,
    UserRole,
    UserSession,
    UserToken,
)
from app.modules.identity.schemas import MeOut, OrganizationRef

MAX_FAILED_LOGINS = 5
LOCK_MINUTES = 15
RESET_TTL_MINUTES = 30
INVITE_TTL_DAYS = 7


def normalize_email(email: str) -> str:
    return email.strip().lower()


def user_by_email(db: Session, email: str) -> User | None:
    return db.execute(
        select(User).where(User.email == normalize_email(email), User.deleted_at.is_(None))
    ).scalar_one_or_none()


def role_requires_mfa(user: User) -> bool:
    return bool(user.mfa_required) or any(r.mfa_required or r.code in settings.MFA_REQUIRED_ROLES for r in user.roles)


def features_for(user: User, spaces: list[str]) -> list[str]:
    """Modules optionnels visibles par l'utilisateur (activés par l'administration, désactivés par défaut)."""
    from sqlalchemy.orm import object_session

    db = object_session(user)
    if db is None:
        return []
    features: list[str] = []
    if "client" in spaces:
        from app.modules.referrals.service import policy as referral_policy

        if referral_policy(db)["enabled"]:
            features.append("referrals")
        from app.modules.financing.service import portal_enabled as financing_enabled

        if financing_enabled(db):
            features.append("financing")
    return features


def spaces_for(user: User, permissions: set[str]) -> list[str]:
    spaces: list[str] = []
    kind = user.organization.kind if user.organization else None
    if kind == "internal" or any(r.audience == "internal" for r in user.roles):
        spaces.append("erp")
    if "client:portal" in permissions:
        spaces.append("client")
    if "extranet:supplier" in permissions:
        spaces.append("extranet_supplier")
    if "extranet:subcontractor" in permissions:
        spaces.append("extranet_subcontractor")
    return spaces


def permissions_of(user: User) -> set[str]:
    perms: set[str] = set()
    for role in user.roles:
        perms.update(role.permission_codes)
    return perms


def build_me(user: User) -> MeOut:
    perms = permissions_of(user)
    spaces = spaces_for(user, perms)
    return MeOut(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        full_name=user.full_name,
        phone=user.phone,
        whatsapp=user.whatsapp,
        job_title=user.job_title,
        trade=user.trade,
        disciplines=user.disciplines or [],
        locale=user.locale,
        timezone=user.timezone,
        roles=user.role_codes,
        permissions=sorted(perms),
        organization=OrganizationRef.model_validate(user.organization) if user.organization else None,
        mfa_enabled=user.mfa_enabled,
        mfa_required=role_requires_mfa(user),
        preferences=user.preferences or {},
        spaces=spaces,
        features=features_for(user, spaces),
        avatar_url=f"{settings.API_PREFIX}/files/{user.avatar_file_id}" if user.avatar_file_id else None,
        email_verified=user.email_verified_at is not None,
    )


# ---------------------------------------------------------------------------- appareils & sessions
def _device(db: Session, user: User, device_key: str | None, device_name: str | None) -> tuple[Device | None, bool]:
    ctx = get_context()
    key = device_key or ctx.device_id
    if not key:
        return None, False
    device = db.execute(
        select(Device).where(Device.user_id == user.id, Device.device_key == key[:120])
    ).scalar_one_or_none()
    is_new = device is None
    if device is None:
        device = Device(
            user_id=user.id,
            device_key=key[:120],
            name=(device_name or ctx.user_agent or "Appareil")[:150],
            platform=_platform(ctx.user_agent),
            application=ctx.application,
        )
        db.add(device)
    if device.revoked_at is not None:
        raise Unauthorized("Cet appareil a été révoqué", code="DEVICE_REVOKED")
    device.last_seen_at = utcnow()
    device.last_ip = ctx.ip
    db.flush()
    return device, is_new


def _platform(ua: str | None) -> str | None:
    if not ua:
        return None
    lowered = ua.lower()
    for key, name in (
        ("android", "android"),
        ("iphone", "ios"),
        ("ipad", "ios"),
        ("windows", "windows"),
        ("mac os", "macos"),
        ("linux", "linux"),
    ):
        if key in lowered:
            return name
    return "web"


def create_session(
    db: Session, user: User, *, device: Device | None, mfa_verified: bool, remember: bool, auth_method: str = "password"
) -> tuple[UserSession, str, str]:
    ctx = get_context()
    refresh = random_token(48)
    ttl = timedelta(days=settings.REFRESH_TOKEN_TTL_DAYS if remember or ctx.application != "web" else 1)
    session = UserSession(
        id=uuid.uuid4(),
        user_id=user.id,
        device_id=device.id if device else None,
        family_id=uuid.uuid4(),
        refresh_token_hash=sha256_hex(refresh),
        expires_at=utcnow() + ttl,
        ip=ctx.ip,
        user_agent=ctx.user_agent,
        application=ctx.application,
        last_used_at=utcnow(),
        mfa_verified_at=utcnow() if mfa_verified else None,
        auth_method=auth_method,
    )
    db.add(session)
    user.last_login_at = utcnow()
    user.failed_login_count = 0
    user.locked_until = None
    db.flush()
    access = create_access_token(
        user_id=user.id,
        session_id=session.id,
        roles=user.role_codes,
        organization_id=user.organization_id,
        mfa=mfa_verified,
    )
    return session, access, refresh


def _lock_check(user: User) -> None:
    if user.locked_until and user.locked_until > utcnow():
        raise Unauthorized(
            "Compte temporairement verrouillé après plusieurs échecs. Réessayez plus tard.", code="ACCOUNT_LOCKED"
        )


def _fail_login(db: Session, user: User | None, email: str, reason: str) -> None:
    if user is not None:
        user.failed_login_count = (user.failed_login_count or 0) + 1
        if user.failed_login_count >= MAX_FAILED_LOGINS:
            user.locked_until = utcnow() + timedelta(minutes=LOCK_MINUTES)
        db.commit()
    audit.record_independent(
        family="security",
        module="auth",
        action="LOGIN",
        resource_type="user",
        resource_id=user.id if user else None,
        actor_id=user.id if user else None,
        actor_label=email,
        result="FAIL",
        reason=reason,
        criticality="HIGH" if user and user.locked_until else "MEDIUM",
    )


def authenticate(
    db: Session, *, email: str, password: str, device_key: str | None, device_name: str | None, remember: bool
) -> dict[str, Any]:
    user = user_by_email(db, email)
    if user is not None:
        _lock_check(user)
    if user is None or not verify_password(password, user.password_hash):
        _fail_login(db, user, normalize_email(email), "Identifiants invalides")
        raise Unauthorized("E-mail ou mot de passe incorrect", code="INVALID_CREDENTIALS")
    if not user.is_active:
        _fail_login(db, user, user.email, "Compte inactif")
        raise Unauthorized("Compte désactivé. Contactez l'administrateur.", code="ACCOUNT_INACTIVE")
    if user.password_hash and password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    device, is_new_device = _device(db, user, device_key, device_name)
    trusted = bool(device and device.trusted and device.trusted_until and device.trusted_until > utcnow())
    if user.mfa_enabled and not (trusted and not role_requires_mfa(user)):
        methods = ["totp", "recovery"] if _has_totp(db, user) else ["recovery"]
        if _webauthn_factors(db, user):
            methods.insert(0, "webauthn")
        token = create_purpose_token(
            "mfa",
            str(user.id),
            settings.MFA_CHALLENGE_TTL_MINUTES * 60,
            {
                "device": str(device.id) if device else None,
                "remember": remember,
                "new_device": is_new_device,
            },
        )
        db.commit()
        return {"mfa_required": True, "mfa_token": token, "methods": methods}
    session, access, refresh = create_session(db, user, device=device, mfa_verified=False, remember=remember)
    _after_login(db, user, session, is_new_device, device)
    db.commit()
    return {"session": session, "access": access, "refresh": refresh, "user": user}


def _after_login(db: Session, user: User, session: UserSession, is_new_device: bool, device: Device | None) -> None:
    ctx = get_context()
    audit.record(
        db,
        family="security",
        module="auth",
        action="LOGIN",
        resource_type="user",
        resource_id=user.id,
        actor_id=user.id,
        actor_label=user.email,
        diff={"session": str(session.id), "method": session.auth_method},
    )
    if (
        is_new_device
        and user.last_login_at is not None
        and db.execute(
            select(UserSession.id).where(UserSession.user_id == user.id, UserSession.id != session.id).limit(1)
        ).first()
    ):
        emit(
            db,
            "security.new_device",
            {
                "user_id": str(user.id),
                "device": device.name if device else ctx.user_agent,
                "ip": ctx.ip,
                "at": utcnow().isoformat(),
            },
            aggregate_type="user",
            aggregate_id=user.id,
        )


def verify_mfa_login(
    db: Session,
    *,
    mfa_token: str,
    code: str | None,
    recovery_code: str | None,
    webauthn: dict[str, Any] | None,
    webauthn_challenge_token: str | None,
    trust_device: bool,
) -> dict[str, Any]:
    try:
        payload = decode_token(mfa_token, expected_type="mfa")
    except jwt.PyJWTError as exc:
        raise Unauthorized("Défi MFA expiré, reconnectez-vous", code="MFA_CHALLENGE_EXPIRED") from exc
    user = db.get(User, uuid.UUID(payload["sub"]))
    if user is None or not user.is_active:
        raise Unauthorized("Compte inactif", code="ACCOUNT_INACTIVE")
    _lock_check(user)
    method = None
    if code and verify_totp(db, user, code):
        method = "totp"
    elif recovery_code and use_recovery_code(db, user, recovery_code):
        method = "recovery"
    elif (
        webauthn
        and webauthn_challenge_token
        and verify_webauthn_assertion(db, user, webauthn, webauthn_challenge_token)
    ):
        method = "webauthn"
    if method is None:
        _fail_login(db, user, user.email, "Code MFA invalide")
        raise Unauthorized("Code de vérification invalide", code="INVALID_MFA_CODE")
    device = db.get(Device, uuid.UUID(payload["device"])) if payload.get("device") else None
    if device and trust_device:
        device.trusted = True
        device.trusted_until = utcnow() + timedelta(days=30)
    session, access, refresh = create_session(
        db,
        user,
        device=device,
        mfa_verified=True,
        remember=bool(payload.get("remember")),
        auth_method=f"password+{method}",
    )
    _after_login(db, user, session, bool(payload.get("new_device")), device)
    db.commit()
    return {
        "session": session,
        "access": access,
        "refresh": refresh,
        "user": user,
        "remember": bool(payload.get("remember")),
    }


def rotate_refresh(db: Session, refresh_token: str) -> tuple[UserSession, User, str, str]:
    token_hash = sha256_hex(refresh_token)
    session = db.execute(
        select(UserSession).where(UserSession.refresh_token_hash == token_hash).with_for_update()
    ).scalar_one_or_none()
    now = utcnow()
    if session is None:
        reused = db.execute(
            select(UserSession).where(UserSession.previous_token_hash == token_hash)
        ).scalar_one_or_none()
        if reused is not None:
            # Réutilisation d'un jeton déjà tourné : compromission probable → révocation de la famille.
            db.execute(
                update(UserSession)
                .where(UserSession.family_id == reused.family_id, UserSession.revoked_at.is_(None))
                .values(revoked_at=now, revoke_reason="refresh_token_reuse")
            )
            audit.record(
                db,
                family="security",
                module="auth",
                action="TOKEN_REUSE",
                resource_type="session",
                resource_id=reused.id,
                actor_id=reused.user_id,
                result="FAIL",
                reason="Réutilisation d'un jeton de rafraîchissement",
                criticality="CRITICAL",
            )
            db.commit()
        raise Unauthorized("Session expirée, reconnectez-vous", code="INVALID_REFRESH_TOKEN")
    if session.revoked_at is not None or session.expires_at < now:
        raise Unauthorized("Session expirée, reconnectez-vous", code="SESSION_REVOKED")
    user = db.get(User, session.user_id)
    if user is None or not user.is_active or user.deleted_at is not None:
        raise Unauthorized("Compte inactif", code="ACCOUNT_INACTIVE")
    new_refresh = random_token(48)
    session.previous_token_hash = token_hash
    session.refresh_token_hash = sha256_hex(new_refresh)
    session.last_used_at = now
    access = create_access_token(
        user_id=user.id,
        session_id=session.id,
        roles=user.role_codes,
        organization_id=user.organization_id,
        mfa=session.mfa_verified_at is not None,
    )
    db.commit()
    return session, user, access, new_refresh


def revoke_session(db: Session, session_id: uuid.UUID, *, reason: str, user_id: uuid.UUID | None = None) -> None:
    session = db.get(UserSession, session_id)
    if session is None or (user_id and session.user_id != user_id):
        raise NotFound("Session introuvable")
    if session.revoked_at is None:
        session.revoked_at = utcnow()
        session.revoke_reason = reason
        audit.record(
            db,
            family="security",
            module="auth",
            action="SESSION_REVOKE",
            resource_type="session",
            resource_id=session.id,
            actor_id=user_id,
            reason=reason,
        )


def revoke_all_sessions(db: Session, user_id: uuid.UUID, *, except_session: uuid.UUID | None, reason: str) -> int:
    stmt = update(UserSession).where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
    if except_session:
        stmt = stmt.where(UserSession.id != except_session)
    result = db.execute(stmt.values(revoked_at=utcnow(), revoke_reason=reason))
    return int(result.rowcount or 0)


# ---------------------------------------------------------------------------- mots de passe
def set_password(user: User, password: str) -> None:
    problems = validate_password_strength(password, email=user.email)
    if problems:
        raise AppError(
            "Mot de passe trop faible : " + ", ".join(problems), code="WEAK_PASSWORD", details={"rules": problems}
        )
    user.password_hash = hash_password(password)
    user.password_changed_at = utcnow()


def change_password(db: Session, user: User, current: str, new: str, current_session: uuid.UUID | None) -> None:
    if not verify_password(current, user.password_hash):
        audit.record(
            db,
            family="security",
            module="auth",
            action="PASSWORD_CHANGE",
            resource_type="user",
            resource_id=user.id,
            result="FAIL",
            reason="Mot de passe actuel incorrect",
            criticality="MEDIUM",
        )
        db.commit()
        raise AppError("Mot de passe actuel incorrect", code="INVALID_PASSWORD")
    set_password(user, new)
    revoked = revoke_all_sessions(db, user.id, except_session=current_session, reason="password_changed")
    audit.record(
        db,
        family="security",
        module="auth",
        action="PASSWORD_CHANGE",
        resource_type="user",
        resource_id=user.id,
        diff={"revoked_sessions": revoked},
        criticality="MEDIUM",
    )
    db.commit()


def request_password_reset(db: Session, email: str) -> None:
    from app.modules.notifications.service import queue_external

    user = user_by_email(db, email)
    if user is None or not user.is_active:
        audit.record(
            db,
            family="security",
            module="auth",
            action="PASSWORD_RESET_REQUEST",
            actor_label=email,
            result="FAIL",
            reason="Compte inconnu",
        )
        db.commit()
        return
    token = random_token(32)
    db.add(
        UserToken(
            user_id=user.id,
            email=user.email,
            purpose="reset",
            token_hash=sha256_hex(token),
            expires_at=utcnow() + timedelta(minutes=RESET_TTL_MINUTES),
            ip=get_context().ip,
        )
    )
    queue_external(
        db,
        channel="email",
        recipient=user.email,
        template_code="auth.password_reset",
        context={
            "first_name": user.first_name,
            "link": f"{settings.PUBLIC_BASE_URL.rstrip('/')}/reset?token={token}",
            "ttl_minutes": RESET_TTL_MINUTES,
        },
    )
    audit.record(
        db,
        family="security",
        module="auth",
        action="PASSWORD_RESET_REQUEST",
        resource_type="user",
        resource_id=user.id,
        actor_id=user.id,
    )
    db.commit()


def _consume_token(db: Session, token: str, purpose: str) -> UserToken:
    row = db.execute(
        select(UserToken)
        .where(UserToken.purpose == purpose, UserToken.token_hash == sha256_hex(token))
        .with_for_update()
    ).scalar_one_or_none()
    if row is None or row.used_at is not None or row.expires_at < utcnow():
        raise AppError("Lien invalide ou expiré", code="INVALID_TOKEN")
    row.used_at = utcnow()
    return row


def reset_password(db: Session, token: str, new_password: str) -> None:
    row = _consume_token(db, token, "reset")
    user = db.get(User, row.user_id)
    if user is None:
        raise AppError("Lien invalide ou expiré", code="INVALID_TOKEN")
    set_password(user, new_password)
    user.failed_login_count = 0
    user.locked_until = None
    revoke_all_sessions(db, user.id, except_session=None, reason="password_reset")
    audit.record(
        db,
        family="security",
        module="auth",
        action="PASSWORD_RESET",
        resource_type="user",
        resource_id=user.id,
        actor_id=user.id,
        criticality="MEDIUM",
    )
    db.commit()


# ---------------------------------------------------------------------------- TOTP
def _has_totp(db: Session, user: User) -> bool:
    return (
        db.execute(
            select(MFAFactor.id).where(
                MFAFactor.user_id == user.id,
                MFAFactor.type == "totp",
                MFAFactor.confirmed_at.is_not(None),
                MFAFactor.disabled_at.is_(None),
            )
        ).first()
        is not None
    )


def _webauthn_factors(db: Session, user: User) -> list[MFAFactor]:
    return list(
        db.execute(
            select(MFAFactor).where(
                MFAFactor.user_id == user.id, MFAFactor.type == "webauthn", MFAFactor.disabled_at.is_(None)
            )
        ).scalars()
    )


def totp_setup(db: Session, user: User) -> dict[str, str]:
    for pending in db.execute(
        select(MFAFactor).where(
            MFAFactor.user_id == user.id, MFAFactor.type == "totp", MFAFactor.confirmed_at.is_(None)
        )
    ).scalars():
        db.delete(pending)
    secret = pyotp.random_base32()
    db.add(MFAFactor(user_id=user.id, type="totp", name="Application d'authentification", secret=secret))
    uri = pyotp.TOTP(secret).provisioning_uri(name=user.email, issuer_name="GLOBUS ENGINEERING")
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    db.commit()
    return {
        "secret": secret,
        "otpauth_uri": uri,
        "qr_data_url": "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(),
    }


def verify_totp(db: Session, user: User, code: str, *, pending: bool = False) -> bool:
    code = code.strip().replace(" ", "")
    stmt = select(MFAFactor).where(
        MFAFactor.user_id == user.id, MFAFactor.type == "totp", MFAFactor.disabled_at.is_(None)
    )
    stmt = stmt.where(MFAFactor.confirmed_at.is_(None) if pending else MFAFactor.confirmed_at.is_not(None))
    for factor in db.execute(stmt).scalars():
        if not factor.secret:
            continue
        totp = pyotp.TOTP(factor.secret)
        now = utcnow().timestamp()
        for offset in (-1, 0, 1):
            step = int(now // 30) + offset
            if totp.at(step * 30) == code:
                if factor.last_used_step is not None and step <= factor.last_used_step:
                    return False  # anti-rejeu
                factor.last_used_step = step
                factor.last_used_at = utcnow()
                return True
    return False


def generate_recovery_codes(db: Session, user: User) -> list[str]:
    db.execute(
        update(MFARecoveryCode)
        .where(MFARecoveryCode.user_id == user.id, MFARecoveryCode.used_at.is_(None))
        .values(used_at=utcnow())
    )
    codes = [f"{random_token(6)[:5]}-{random_token(6)[:5]}".upper().replace("_", "X") for _ in range(10)]
    for code in codes:
        db.add(MFARecoveryCode(user_id=user.id, code_hash=sha256_hex(code.replace("-", ""))))
    return codes


def use_recovery_code(db: Session, user: User, code: str) -> bool:
    normalized = code.strip().upper().replace("-", "").replace(" ", "")
    row = db.execute(
        select(MFARecoveryCode).where(
            MFARecoveryCode.user_id == user.id,
            MFARecoveryCode.code_hash == sha256_hex(normalized),
            MFARecoveryCode.used_at.is_(None),
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    row.used_at = utcnow()
    return True


def totp_confirm(db: Session, user: User, code: str) -> list[str]:
    if not verify_totp(db, user, code, pending=True):
        raise AppError("Code invalide. Vérifiez l'heure de votre téléphone.", code="INVALID_MFA_CODE")
    factor = (
        db.execute(
            select(MFAFactor).where(
                MFAFactor.user_id == user.id, MFAFactor.type == "totp", MFAFactor.confirmed_at.is_(None)
            )
        )
        .scalars()
        .first()
    )
    if factor is None:
        raise AppError("Aucune configuration TOTP en cours", code="MFA_NOT_PENDING")
    factor.confirmed_at = utcnow()
    for other in db.execute(
        select(MFAFactor).where(
            MFAFactor.user_id == user.id,
            MFAFactor.type == "totp",
            MFAFactor.id != factor.id,
            MFAFactor.disabled_at.is_(None),
        )
    ).scalars():
        other.disabled_at = utcnow()
    user.mfa_enabled = True
    codes = generate_recovery_codes(db, user)
    audit.record(
        db,
        family="security",
        module="auth",
        action="MFA_ENABLE",
        resource_type="user",
        resource_id=user.id,
        diff={"method": "totp"},
        criticality="MEDIUM",
    )
    db.commit()
    return codes


def mfa_disable(db: Session, user: User, password: str, code: str) -> None:
    if role_requires_mfa(user) and settings.MFA_ENFORCEMENT == "enforce":
        raise Forbidden("Le MFA est obligatoire pour votre rôle", code="MFA_MANDATORY")
    if not verify_password(password, user.password_hash) or not (
        verify_totp(db, user, code) or use_recovery_code(db, user, code)
    ):
        raise AppError("Mot de passe ou code invalide", code="INVALID_MFA_CODE")
    for factor in db.execute(
        select(MFAFactor).where(MFAFactor.user_id == user.id, MFAFactor.disabled_at.is_(None))
    ).scalars():
        factor.disabled_at = utcnow()
    user.mfa_enabled = False
    audit.record(
        db,
        family="security",
        module="auth",
        action="MFA_DISABLE",
        resource_type="user",
        resource_id=user.id,
        criticality="HIGH",
    )
    db.commit()


# ---------------------------------------------------------------------------- WebAuthn / passkeys
def _rp_origins() -> list[str]:
    origins = [settings.PUBLIC_BASE_URL.rstrip("/")]
    origins += [o for o in settings.CORS_ORIGINS if o.startswith("http")]
    return origins


def webauthn_register_options(db: Session, user: User) -> dict[str, Any]:
    from webauthn import generate_registration_options, options_to_json
    from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
    from webauthn.helpers.structs import (
        AuthenticatorSelectionCriteria,
        PublicKeyCredentialDescriptor,
        ResidentKeyRequirement,
        UserVerificationRequirement,
    )

    existing = [
        PublicKeyCredentialDescriptor(id=base64url_to_bytes(f.credential_id))
        for f in _webauthn_factors(db, user)
        if f.credential_id
    ]
    options = generate_registration_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        rp_name=settings.WEBAUTHN_RP_NAME,
        user_name=user.email,
        user_id=user.id.bytes,
        user_display_name=user.full_name,
        exclude_credentials=existing,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED, user_verification=UserVerificationRequirement.PREFERRED
        ),
    )
    challenge = create_purpose_token("webauthn_reg", str(user.id), 300, {"c": bytes_to_base64url(options.challenge)})
    return {"options": json.loads(options_to_json(options)), "challenge_token": challenge}


def webauthn_register_verify(
    db: Session, user: User, credential: dict[str, Any], challenge_token: str, name: str
) -> MFAFactor:
    from webauthn import verify_registration_response
    from webauthn.helpers import base64url_to_bytes, bytes_to_base64url

    try:
        payload = decode_token(challenge_token, expected_type="webauthn_reg")
    except jwt.PyJWTError as exc:
        raise AppError("Défi expiré", code="WEBAUTHN_CHALLENGE_EXPIRED") from exc
    if payload["sub"] != str(user.id):
        raise Forbidden("Défi invalide")
    try:
        verified = verify_registration_response(
            credential=credential,
            expected_challenge=base64url_to_bytes(payload["c"]),
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=_rp_origins(),
        )
    except Exception as exc:
        raise AppError(f"Enregistrement de la clé refusé : {exc}", code="WEBAUTHN_INVALID") from exc
    factor = MFAFactor(
        user_id=user.id,
        type="webauthn",
        name=name,
        credential_id=bytes_to_base64url(verified.credential_id),
        public_key=bytes_to_base64url(verified.credential_public_key),
        sign_count=verified.sign_count,
        transports=credential.get("response", {}).get("transports") or [],
        confirmed_at=utcnow(),
    )
    db.add(factor)
    user.mfa_enabled = True
    if not db.execute(
        select(MFARecoveryCode.id).where(MFARecoveryCode.user_id == user.id, MFARecoveryCode.used_at.is_(None))
    ).first():
        generate_recovery_codes(db, user)
    audit.record(
        db,
        family="security",
        module="auth",
        action="MFA_ENABLE",
        resource_type="user",
        resource_id=user.id,
        diff={"method": "webauthn"},
        criticality="MEDIUM",
    )
    db.commit()
    return factor


def webauthn_login_options(db: Session, mfa_token: str) -> dict[str, Any]:
    from webauthn import generate_authentication_options, options_to_json
    from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
    from webauthn.helpers.structs import PublicKeyCredentialDescriptor

    try:
        payload = decode_token(mfa_token, expected_type="mfa")
    except jwt.PyJWTError as exc:
        raise Unauthorized("Défi MFA expiré", code="MFA_CHALLENGE_EXPIRED") from exc
    user = db.get(User, uuid.UUID(payload["sub"]))
    if user is None:
        raise Unauthorized("Compte inconnu")
    allow = [
        PublicKeyCredentialDescriptor(id=base64url_to_bytes(f.credential_id))
        for f in _webauthn_factors(db, user)
        if f.credential_id
    ]
    options = generate_authentication_options(rp_id=settings.WEBAUTHN_RP_ID, allow_credentials=allow)
    challenge = create_purpose_token("webauthn_auth", str(user.id), 300, {"c": bytes_to_base64url(options.challenge)})
    return {"options": json.loads(options_to_json(options)), "challenge_token": challenge}


def verify_webauthn_assertion(db: Session, user: User, credential: dict[str, Any], challenge_token: str) -> bool:
    from webauthn import verify_authentication_response
    from webauthn.helpers import base64url_to_bytes

    try:
        payload = decode_token(challenge_token, expected_type="webauthn_auth")
    except jwt.PyJWTError:
        return False
    if payload["sub"] != str(user.id):
        return False
    raw_id = credential.get("rawId") or credential.get("id")
    factor = next((f for f in _webauthn_factors(db, user) if f.credential_id == raw_id), None)
    if factor is None or not factor.public_key:
        return False
    try:
        verified = verify_authentication_response(
            credential=credential,
            expected_challenge=base64url_to_bytes(payload["c"]),
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=_rp_origins(),
            credential_public_key=base64url_to_bytes(factor.public_key),
            credential_current_sign_count=factor.sign_count or 0,
        )
    except Exception:  # noqa: BLE001
        return False
    factor.sign_count = verified.new_sign_count
    factor.last_used_at = utcnow()
    return True


# ---------------------------------------------------------------------------- inscription / invitations
def _default_org(db: Session, kind: str, name: str) -> Organization:
    org = Organization(name=name, kind=kind)
    db.add(org)
    db.flush()
    return org


def assign_roles(db: Session, user: User, role_codes: list[str], *, granted_by: uuid.UUID | None) -> None:
    roles = db.execute(select(Role).where(Role.code.in_(role_codes))).scalars().all()
    missing = set(role_codes) - {r.code for r in roles}
    if missing:
        raise BusinessRuleError(f"Rôle(s) inconnu(s) : {', '.join(sorted(missing))}", code="UNKNOWN_ROLE")
    db.execute(UserRole.__table__.delete().where(UserRole.user_id == user.id))
    for role in roles:
        db.add(UserRole(user_id=user.id, role_id=role.id, granted_by_id=granted_by))
    db.flush()
    db.refresh(user)


def verify_email(db: Session, token: str) -> User:
    row = _consume_token(db, token, "verify")
    user = db.get(User, row.user_id)
    if user is None:
        raise AppError("Lien invalide", code="INVALID_TOKEN")
    user.email_verified_at = utcnow()
    db.commit()
    return user


def invite_user(
    db: Session,
    *,
    inviter: User | None,
    email: str,
    first_name: str | None,
    last_name: str | None,
    role_codes: list[str],
    organization_id: uuid.UUID | None,
    project_ids: list[uuid.UUID],
    message: str | None,
    channels: tuple[str, ...] | list[str] = ("email",),
    phone: str | None = None,
) -> tuple[Invitation, str]:
    """Invitation à usage unique : lien d'activation envoyé par e-mail et/ou WhatsApp. Aucun mot de passe ne
    circule : l'invité choisit le sien à l'activation, puis active la double authentification si son profil
    l'exige (clients : toujours). Sans invitant (premier administrateur, mise en service) : invitation au nom de
    l'entreprise."""
    from app.modules.notifications.service import queue_external

    inviter_name = inviter.full_name if inviter else "L'équipe GLOBUS ENGINEERING"

    token = random_token(32)
    roles = db.execute(select(Role).where(Role.code.in_(role_codes))).scalars().all()
    if len(roles) != len(set(role_codes)):
        raise BusinessRuleError("Rôle inconnu", code="UNKNOWN_ROLE")
    invitation = Invitation(
        email=normalize_email(email),
        first_name=first_name,
        last_name=last_name,
        organization_id=organization_id,
        role_codes=role_codes,
        project_ids=[str(p) for p in project_ids],
        invited_by_id=inviter.id if inviter else None,
        token_hash=sha256_hex(token),
        expires_at=utcnow() + timedelta(days=INVITE_TTL_DAYS),
        message=message,
    )
    db.add(invitation)
    db.flush()
    link = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/activation?invitation={token}"
    context = {
        "first_name": first_name,
        "inviter": inviter_name,
        "role_label": ", ".join(r.name for r in roles),
        "message": message,
        "ttl_days": INVITE_TTL_DAYS,
        "link": link,
        "email": invitation.email,
        "title": "Votre accès GLOBUS ENGINEERING",
        "body": (
            f"{inviter_name} vous ouvre un accès à la plateforme GLOBUS ENGINEERING (identifiant : "
            f"{invitation.email}). Activez votre compte, choisissez votre mot de passe puis la double "
            f"authentification ; lien personnel valable {INVITE_TTL_DAYS} jours"
        ),
    }
    sent = []
    if "email" in channels:
        queue_external(
            db, channel="email", recipient=invitation.email, template_code="auth.invitation", context=context
        )
        sent.append("email")
    whatsapp = clean_phone(phone)
    if "whatsapp" in channels and whatsapp:
        queue_external(db, channel="whatsapp", recipient=whatsapp, template_code="auth.invitation", context=context)
        sent.append("whatsapp")
    if not sent:
        raise BusinessRuleError("Aucun canal d'invitation disponible (e-mail ou numéro WhatsApp)", code="NO_CHANNEL")
    audit.record(
        db,
        family="security",
        module="users",
        action="INVITE",
        resource_type="invitation",
        resource_id=invitation.id,
        diff={"email": invitation.email, "roles": role_codes, "channels": sent},
    )
    return invitation, token


def accept_invitation(
    db: Session, *, token: str, password: str, first_name: str | None, last_name: str | None, phone: str | None
) -> User:
    from app.modules.projects.models import ProjectMember

    invitation = db.execute(
        select(Invitation).where(Invitation.token_hash == sha256_hex(token)).with_for_update()
    ).scalar_one_or_none()
    if invitation is None or invitation.accepted_at or invitation.revoked_at or invitation.expires_at < utcnow():
        raise AppError("Invitation invalide ou expirée", code="INVALID_INVITATION")
    user = user_by_email(db, invitation.email)
    if user is None:
        user = User(
            email=invitation.email,
            first_name=(first_name or invitation.first_name or "").strip() or "Utilisateur",
            last_name=(last_name or invitation.last_name or "").strip() or "GLOBUS",
            phone=clean_phone(phone),
            organization_id=invitation.organization_id,
            email_verified_at=utcnow(),
        )
        set_password(user, password)
        db.add(user)
        db.flush()
    elif user.password_hash:
        raise Conflict("Un compte existe déjà : connectez-vous", code="EMAIL_TAKEN")
    else:
        set_password(user, password)
    assign_roles(db, user, list(invitation.role_codes), granted_by=invitation.invited_by_id)
    if "CLIENT" in invitation.role_codes:
        user.mfa_required = True  # espace client : double authentification obligatoire dès la première connexion
    user.email_verified_at = user.email_verified_at or utcnow()
    for pid in invitation.project_ids or []:
        pid_uuid = uuid.UUID(str(pid))
        if not db.execute(
            select(ProjectMember.id).where(ProjectMember.project_id == pid_uuid, ProjectMember.user_id == user.id)
        ).first():
            role = "client" if "CLIENT" in invitation.role_codes else "membre"
            db.add(
                ProjectMember(
                    project_id=pid_uuid, user_id=user.id, project_role=role, added_by_id=invitation.invited_by_id
                )
            )
    invitation.accepted_at = utcnow()
    audit.record(
        db,
        family="security",
        module="users",
        action="INVITATION_ACCEPT",
        resource_type="user",
        resource_id=user.id,
        actor_id=user.id,
    )
    db.commit()
    return user


# ---------------------------------------------------------------------------- OTP métier (signature, décision)
def issue_otp(
    db: Session, user: User, *, purpose: str, payload: dict[str, Any], channel: str = "email", ttl_minutes: int = 10
) -> dict[str, Any]:
    """Envoie un code à 6 chiffres (e-mail / SMS / WhatsApp) pour une validation à valeur probante."""
    from app.modules.notifications.service import queue_external
    from app.providers.messaging import sms_available, whatsapp_available

    if (channel == "sms" and not sms_available()) or (channel == "whatsapp" and not whatsapp_available()):
        channel = "email"  # canal non configuré : repli e-mail plutôt qu'un code jamais reçu
    code = generate_numeric_code(6)
    token = random_token(24)
    db.add(
        UserToken(
            user_id=user.id,
            email=user.email,
            purpose=purpose,
            token_hash=sha256_hex(token),
            payload={**payload, "code_hash": sha256_hex(f"{token}:{code}"), "channel": channel},
            expires_at=utcnow() + timedelta(minutes=ttl_minutes),
            ip=get_context().ip,
        )
    )
    recipient = {"email": user.email, "sms": user.phone, "whatsapp": user.whatsapp or user.phone}.get(
        channel
    ) or user.email
    used_channel = channel if recipient != user.email or channel == "email" else "email"
    queue_external(
        db,
        channel=used_channel,
        recipient=recipient,
        template_code="auth.otp",
        context={
            "first_name": user.first_name,
            "code": code,
            "ttl_minutes": ttl_minutes,
            "purpose": payload.get("label", purpose),
            "title": "Code de validation",
            "body": f"Votre code : {code}",
        },
    )
    db.flush()
    masked = recipient[:3] + "•••" + recipient[-3:] if recipient and len(recipient) > 6 else recipient
    result: dict[str, Any] = {
        "otp_token": token,
        "channel": used_channel,
        "sent_to": masked,
        "expires_in": ttl_minutes * 60,
    }
    if settings.ENV == "test":
        result["test_code"] = code
    return result


def verify_otp(db: Session, user: User, *, purpose: str, otp_token: str, code: str) -> dict[str, Any]:
    row = db.execute(
        select(UserToken)
        .where(
            UserToken.purpose == purpose, UserToken.token_hash == sha256_hex(otp_token), UserToken.user_id == user.id
        )
        .with_for_update()
    ).scalar_one_or_none()
    if row is None or row.used_at is not None or row.expires_at < utcnow():
        raise AppError("Code expiré, demandez-en un nouveau", code="OTP_EXPIRED")
    if row.attempts >= 5:
        raise AppError("Trop de tentatives, demandez un nouveau code", code="OTP_LOCKED")
    if sha256_hex(f"{otp_token}:{code.strip()}") != row.payload.get("code_hash"):
        row.attempts += 1
        db.commit()
        raise AppError("Code incorrect", code="OTP_INVALID")
    row.used_at = utcnow()
    return {
        "verified_at": row.used_at,
        "channel": row.payload.get("channel"),
        "token_id": str(row.id),
        "payload": {k: v for k, v in row.payload.items() if k != "code_hash"},
    }


# ---------------------------------------------------------------------------- break-glass
def open_break_glass(db: Session, user: User, *, scope: str, justification: str, code: str) -> Any:
    from app.modules.system.models import BreakGlassGrant

    if not user.mfa_enabled:
        raise Forbidden("Le break-glass exige un MFA actif", code="MFA_REQUIRED")
    if not (verify_totp(db, user, code) or use_recovery_code(db, user, code)):
        audit.record(
            db,
            family="security",
            module="security",
            action="BREAK_GLASS",
            resource_type="user",
            resource_id=user.id,
            result="FAIL",
            reason="Code MFA invalide",
            criticality="CRITICAL",
        )
        db.commit()
        raise AppError("Code MFA invalide", code="INVALID_MFA_CODE")
    grant = BreakGlassGrant(
        user_id=user.id,
        scope=scope,
        justification=justification,
        mfa_verified_at=utcnow(),
        expires_at=utcnow() + timedelta(minutes=settings.BREAK_GLASS_TTL_MINUTES),
    )
    db.add(grant)
    db.flush()
    audit.record(
        db,
        family="security",
        module="security",
        action="BREAK_GLASS",
        resource_type="break_glass",
        resource_id=grant.id,
        diff={"scope": scope},
        reason=justification,
        criticality="CRITICAL",
    )
    emit(
        db,
        "system.alert",
        {"title": "Break-glass ouvert", "message": f"{user.full_name} — {scope} : {justification[:200]}"},
    )
    db.commit()
    return grant


def require_break_glass(db: Session, user_id: uuid.UUID, scope: str, grant_id: uuid.UUID | None) -> Any:
    from app.modules.system.models import BreakGlassGrant

    if grant_id is None:
        raise Forbidden(
            "Opération destructive : ouvrez un accès break-glass (MFA + justification)", code="BREAK_GLASS_REQUIRED"
        )
    grant = db.get(BreakGlassGrant, grant_id)
    if (
        grant is None
        or grant.user_id != user_id
        or grant.scope != scope
        or grant.used_at is not None
        or grant.revoked_at is not None
        or grant.expires_at < utcnow()
    ):
        raise Forbidden("Accès break-glass invalide ou expiré", code="BREAK_GLASS_INVALID")
    grant.used_at = utcnow()
    return grant
