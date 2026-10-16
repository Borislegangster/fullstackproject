"""API identité : /auth/* (connexion, MFA, sessions, appareils, mot de passe, inscription, invitations)
et administration (/users, /roles, /permissions, /organizations, /teams, /api-keys)."""

from __future__ import annotations

import re
import uuid
from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.context import get_context
from app.core.database import get_db
from app.core.deps import (
    ACCESS_COOKIE,
    CSRF_COOKIE,
    REFRESH_COOKIE,
    Principal,
    get_principal,
    require,
)
from app.core.errors import AppError, Conflict, Forbidden, NotFound, Unauthorized
from app.core.pagination import PageParams, paginate
from app.core.permissions import PERMISSION_CODES
from app.core.ratelimit import rate_limit
from app.core.security import create_purpose_token, random_token, sha256_hex
from app.core.utils import slugify, utcnow
from app.modules.identity import service
from app.modules.identity.models import (
    ApiCredential,
    Device,
    Invitation,
    MFAFactor,
    Organization,
    Permission,
    Role,
    RolePermission,
    Team,
    TeamMember,
    User,
    UserRole,
    UserSession,
)
from app.modules.identity.schemas import (
    ApiKeyCreated,
    ApiKeyIn,
    ApiKeyOut,
    BreakGlassIn,
    BreakGlassOut,
    CodeIn,
    DeviceOut,
    EmailVerifyIn,
    InvitationAcceptIn,
    InvitationOut,
    LoginIn,
    MeOut,
    MeUpdate,
    MfaDisableIn,
    MfaFactorOut,
    MfaVerifyIn,
    OrganizationIn,
    OrganizationOut,
    PasswordChangeIn,
    PasswordForgotIn,
    PasswordResetIn,
    PermissionOut,
    RecoveryCodesOut,
    RefreshIn,
    RoleIn,
    RoleOut,
    RoleUpdate,
    SessionOut,
    TeamIn,
    TeamOut,
    TeamUpdate,
    TotpSetupOut,
    UserBrief,
    UserCreate,
    UserOut,
    UserUpdate,
    WebAuthnOptionsOut,
    WebAuthnRegisterIn,
)
from app.modules.subcontracting.trades import ensure_person_trade

router = APIRouter(prefix="/auth", tags=["Authentification"])
admin = APIRouter(tags=["Utilisateurs & rôles"])


# ---------------------------------------------------------------------------- cookies
def _is_web() -> bool:
    return get_context().application == "web"


def _set_cookies(response: Response, access: str, refresh: str, remember: bool) -> str:
    csrf = random_token(24)
    secure = bool(settings.COOKIE_SECURE)
    common = {"secure": secure, "samesite": settings.COOKIE_SAMESITE, "domain": settings.COOKIE_DOMAIN}
    response.set_cookie(
        ACCESS_COOKIE, access, httponly=True, path="/", max_age=settings.ACCESS_TOKEN_TTL_MINUTES * 60, **common
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh,
        httponly=True,
        path=f"{settings.API_PREFIX}/auth",
        max_age=settings.REFRESH_TOKEN_TTL_DAYS * 86400 if remember else None,
        **common,
    )
    response.set_cookie(
        CSRF_COOKIE, csrf, httponly=False, path="/", max_age=settings.REFRESH_TOKEN_TTL_DAYS * 86400, **common
    )
    return csrf


def _clear_cookies(response: Response) -> None:
    for name, path in ((ACCESS_COOKIE, "/"), (REFRESH_COOKIE, f"{settings.API_PREFIX}/auth"), (CSRF_COOKIE, "/")):
        response.delete_cookie(name, path=path, domain=settings.COOKIE_DOMAIN)


def _token_response(response: Response, result: dict[str, Any], remember: bool) -> dict[str, Any]:
    user: User = result["user"]
    body: dict[str, Any] = {
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_TTL_MINUTES * 60,
        "user": service.build_me(user).model_dump(),
    }
    if _is_web():
        _set_cookies(response, result["access"], result["refresh"], remember)
    else:
        body["access_token"] = result["access"]
        body["refresh_token"] = result["refresh"]
    return body


# ---------------------------------------------------------------------------- connexion
@router.post("/login", dependencies=[Depends(rate_limit("login", settings.RATE_LIMIT_LOGIN))])
def login(data: LoginIn, response: Response, db: Session = Depends(get_db)) -> dict[str, Any]:
    result = service.authenticate(
        db,
        email=data.email,
        password=data.password,
        device_key=data.device_key,
        device_name=data.device_name,
        remember=data.remember,
    )
    if result.get("mfa_required"):
        return {"mfa_required": True, "mfa_token": result["mfa_token"], "methods": result["methods"]}
    return _token_response(response, result, data.remember)


@router.post("/mfa/verify", dependencies=[Depends(rate_limit("mfa", settings.RATE_LIMIT_LOGIN))])
def mfa_verify(data: MfaVerifyIn, response: Response, db: Session = Depends(get_db)) -> dict[str, Any]:
    result = service.verify_mfa_login(
        db,
        mfa_token=data.mfa_token,
        code=data.code,
        recovery_code=data.recovery_code,
        webauthn=data.webauthn,
        webauthn_challenge_token=data.webauthn_challenge_token,
        trust_device=data.trust_device,
    )
    return _token_response(response, result, bool(result.get("remember")))


@router.post("/mfa/webauthn/options", response_model=WebAuthnOptionsOut)
def mfa_webauthn_options(data: dict[str, str], db: Session = Depends(get_db)) -> dict[str, Any]:
    token = data.get("mfa_token")
    if not token:
        raise AppError("mfa_token requis")
    return service.webauthn_login_options(db, token)


@router.post("/refresh")
def refresh(
    request: Request, response: Response, data: RefreshIn | None = None, db: Session = Depends(get_db)
) -> dict[str, Any]:
    token = (data.refresh_token if data else None) or request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise Unauthorized("Session expirée", code="NO_REFRESH_TOKEN")
    session, user, access, new_refresh = service.rotate_refresh(db, token)
    body: dict[str, Any] = {
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_TTL_MINUTES * 60,
        "user": service.build_me(user).model_dump(),
    }
    if _is_web() and not (data and data.refresh_token):
        remember = (session.expires_at - session.created_at).days > 2
        _set_cookies(response, access, new_refresh, remember)
    else:
        body.update(access_token=access, refresh_token=new_refresh)
    return body


@router.post("/logout")
def logout(
    response: Response, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)
) -> dict[str, str]:
    if principal.session_id:
        service.revoke_session(db, principal.session_id, reason="logout", user_id=principal.id)
        db.commit()
    _clear_cookies(response)
    return {"status": "ok"}


@router.get("/me", response_model=MeOut)
def me(principal: Principal = Depends(get_principal)) -> MeOut:
    return service.build_me(principal.user)


@router.patch("/me", response_model=MeOut)
def update_me(data: MeUpdate, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> MeOut:
    user = db.get(User, principal.id)
    assert user is not None
    changes = data.model_dump(exclude_unset=True)
    if "preferences" in changes and changes["preferences"] is not None:
        user.preferences = {**(user.preferences or {}), **changes.pop("preferences")}
    for key, value in changes.items():
        setattr(user, key, value)
    audit.record(
        db,
        family="business",
        module="account",
        action="UPDATE",
        resource_type="user",
        resource_id=user.id,
        diff={k: [None, v] for k, v in changes.items()},
    )
    db.commit()
    db.refresh(user)
    return service.build_me(user)


# ---------------------------------------------------------------------------- mots de passe
@router.post("/password/change")
def password_change(
    data: PasswordChangeIn, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)
) -> dict[str, str]:
    user = db.get(User, principal.id)
    assert user is not None
    service.change_password(db, user, data.current_password, data.new_password, principal.session_id)
    return {"status": "ok"}


@router.post(
    "/password/forgot", status_code=202, dependencies=[Depends(rate_limit("forgot", settings.RATE_LIMIT_PUBLIC_FORMS))]
)
def password_forgot(data: PasswordForgotIn, db: Session = Depends(get_db)) -> dict[str, str]:
    service.request_password_reset(db, data.email)
    return {"status": "accepted", "message": "Si un compte existe, un e-mail de réinitialisation a été envoyé."}


@router.post("/password/reset", dependencies=[Depends(rate_limit("reset", settings.RATE_LIMIT_LOGIN))])
def password_reset(data: PasswordResetIn, db: Session = Depends(get_db)) -> dict[str, str]:
    service.reset_password(db, data.token, data.new_password)
    return {"status": "ok"}


@router.post("/email/verify")
def email_verify(data: EmailVerifyIn, db: Session = Depends(get_db)) -> dict[str, str]:
    service.verify_email(db, data.token)
    return {"status": "verified"}


@router.get("/invitations/{token}")
def invitation_info(token: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    inv = db.execute(select(Invitation).where(Invitation.token_hash == sha256_hex(token))).scalar_one_or_none()
    if inv is None or inv.accepted_at or inv.revoked_at or inv.expires_at < utcnow():
        raise NotFound("Invitation invalide ou expirée")
    return {
        "email": inv.email,
        "first_name": inv.first_name,
        "last_name": inv.last_name,
        "roles": inv.role_codes,
        "expires_at": inv.expires_at,
    }


@router.post("/invitations/accept")
def invitation_accept(data: InvitationAcceptIn, response: Response, db: Session = Depends(get_db)) -> dict[str, Any]:
    user = service.accept_invitation(
        db,
        token=data.token,
        password=data.password,
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
    )
    _session, access, refresh_token = service.create_session(
        db, user, device=None, mfa_verified=False, remember=False, auth_method="invitation"
    )
    db.commit()
    return _token_response(response, {"user": user, "access": access, "refresh": refresh_token}, False)


# ---------------------------------------------------------------------------- MFA
@router.get("/mfa/factors", response_model=list[MfaFactorOut])
def mfa_factors(principal: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> list[MFAFactor]:
    return list(
        db.execute(
            select(MFAFactor).where(
                MFAFactor.user_id == principal.id, MFAFactor.disabled_at.is_(None), MFAFactor.confirmed_at.is_not(None)
            )
        ).scalars()
    )


@router.post("/mfa/totp/setup", response_model=TotpSetupOut)
def totp_setup(principal: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> dict[str, str]:
    user = db.get(User, principal.id)
    assert user is not None
    return service.totp_setup(db, user)


@router.post("/mfa/totp/confirm", response_model=RecoveryCodesOut)
def totp_confirm(
    data: CodeIn, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)
) -> dict[str, Any]:
    user = db.get(User, principal.id)
    assert user is not None
    return {"codes": service.totp_confirm(db, user, data.code)}


@router.post("/mfa/recovery-codes", response_model=RecoveryCodesOut)
def regenerate_codes(
    data: CodeIn, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)
) -> dict[str, Any]:
    user = db.get(User, principal.id)
    assert user is not None
    if not service.verify_totp(db, user, data.code):
        raise AppError("Code invalide", code="INVALID_MFA_CODE")
    codes = service.generate_recovery_codes(db, user)
    audit.record(
        db,
        family="security",
        module="auth",
        action="MFA_RECOVERY_REGENERATE",
        resource_type="user",
        resource_id=user.id,
        criticality="MEDIUM",
    )
    db.commit()
    return {"codes": codes}


@router.post("/mfa/disable")
def mfa_disable(
    data: MfaDisableIn, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)
) -> dict[str, str]:
    user = db.get(User, principal.id)
    assert user is not None
    service.mfa_disable(db, user, data.password, data.code)
    return {"status": "disabled"}


@router.post("/mfa/webauthn/register/options", response_model=WebAuthnOptionsOut)
def webauthn_register_options(
    principal: Principal = Depends(get_principal), db: Session = Depends(get_db)
) -> dict[str, Any]:
    user = db.get(User, principal.id)
    assert user is not None
    return service.webauthn_register_options(db, user)


@router.post("/mfa/webauthn/register/verify", response_model=MfaFactorOut)
def webauthn_register_verify(
    data: WebAuthnRegisterIn, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)
) -> MFAFactor:
    user = db.get(User, principal.id)
    assert user is not None
    return service.webauthn_register_verify(db, user, data.credential, data.challenge_token, data.name)


@router.delete("/mfa/factors/{factor_id}")
def delete_factor(
    factor_id: uuid.UUID, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)
) -> dict[str, str]:
    factor = db.get(MFAFactor, factor_id)
    if factor is None or factor.user_id != principal.id:
        raise NotFound("Facteur introuvable")
    remaining = db.execute(
        select(func.count())
        .select_from(MFAFactor)
        .where(
            MFAFactor.user_id == principal.id,
            MFAFactor.disabled_at.is_(None),
            MFAFactor.confirmed_at.is_not(None),
            MFAFactor.id != factor_id,
        )
    ).scalar_one()
    user = db.get(User, principal.id)
    assert user is not None
    if remaining == 0 and service.role_requires_mfa(user) and settings.MFA_ENFORCEMENT == "enforce":
        raise Forbidden("Au moins un facteur MFA est obligatoire pour votre rôle", code="MFA_MANDATORY")
    factor.disabled_at = utcnow()
    if remaining == 0:
        user.mfa_enabled = False
    audit.record(
        db,
        family="security",
        module="auth",
        action="MFA_FACTOR_DELETE",
        resource_type="mfa_factor",
        resource_id=factor.id,
        criticality="MEDIUM",
    )
    db.commit()
    return {"status": "deleted"}


# ---------------------------------------------------------------------------- sessions & appareils
@router.get("/sessions", response_model=list[SessionOut])
def my_sessions(principal: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    rows = (
        db.execute(
            select(UserSession)
            .where(
                UserSession.user_id == principal.id, UserSession.revoked_at.is_(None), UserSession.expires_at > utcnow()
            )
            .order_by(UserSession.last_used_at.desc().nullslast())
        )
        .scalars()
        .all()
    )
    return [{**SessionOut.model_validate(s).model_dump(), "current": s.id == principal.session_id} for s in rows]


@router.delete("/sessions/{session_id}")
def revoke_my_session(
    session_id: uuid.UUID, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)
) -> dict[str, str]:
    service.revoke_session(db, session_id, reason="user_revoked", user_id=principal.id)
    db.commit()
    return {"status": "revoked"}


@router.post("/sessions/revoke-others")
def revoke_others(principal: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> dict[str, int]:
    count = service.revoke_all_sessions(
        db, principal.id, except_session=principal.session_id, reason="user_revoked_all"
    )
    audit.record(
        db,
        family="security",
        module="auth",
        action="SESSION_REVOKE_ALL",
        resource_type="user",
        resource_id=principal.id,
        diff={"count": count},
    )
    db.commit()
    return {"revoked": count}


@router.get("/devices", response_model=list[DeviceOut])
def my_devices(principal: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> list[Device]:
    return list(
        db.execute(
            select(Device)
            .where(Device.user_id == principal.id, Device.revoked_at.is_(None))
            .order_by(Device.last_seen_at.desc().nullslast())
        ).scalars()
    )


@router.patch("/devices/{device_id}", response_model=DeviceOut)
def update_device(
    device_id: uuid.UUID,
    data: dict[str, Any],
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
) -> Device:
    device = db.get(Device, device_id)
    if device is None or device.user_id != principal.id:
        raise NotFound("Appareil introuvable")
    if "name" in data:
        device.name = str(data["name"])[:150]
    if "trusted" in data:
        device.trusted = bool(data["trusted"])
        device.trusted_until = utcnow() + timedelta(days=30) if device.trusted else None
    audit.record(
        db,
        family="security",
        module="auth",
        action="DEVICE_UPDATE",
        resource_type="device",
        resource_id=device.id,
        diff={"trusted": device.trusted},
    )
    db.commit()
    return device


@router.delete("/devices/{device_id}")
def revoke_device(
    device_id: uuid.UUID, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)
) -> dict[str, str]:
    device = db.get(Device, device_id)
    if device is None or device.user_id != principal.id:
        raise NotFound("Appareil introuvable")
    device.revoked_at = utcnow()
    for session in db.execute(
        select(UserSession).where(UserSession.device_id == device.id, UserSession.revoked_at.is_(None))
    ).scalars():
        session.revoked_at = utcnow()
        session.revoke_reason = "device_revoked"
    audit.record(
        db,
        family="security",
        module="auth",
        action="DEVICE_REVOKE",
        resource_type="device",
        resource_id=device.id,
        criticality="MEDIUM",
    )
    db.commit()
    return {"status": "revoked"}


@router.get("/login-history")
def login_history(
    principal: Principal = Depends(get_principal), db: Session = Depends(get_db), limit: int = Query(50, le=200)
) -> list[dict[str, Any]]:
    from app.modules.system.models import AuditEvent

    rows = (
        db.execute(
            select(AuditEvent)
            .where(
                AuditEvent.family == "security",
                or_(AuditEvent.actor_id == principal.id, AuditEvent.resource_id == str(principal.id)),
                AuditEvent.action.in_(
                    ["LOGIN", "TOKEN_REUSE", "PASSWORD_CHANGE", "PASSWORD_RESET", "MFA_ENABLE", "MFA_DISABLE"]
                ),
            )
            .order_by(AuditEvent.seq.desc())
            .limit(limit)
        )
        .scalars()
        .all()
    )
    return [
        {
            "at": r.timestamp_utc,
            "action": r.action,
            "result": r.result,
            "ip": r.ip,
            "user_agent": r.user_agent,
            "application": r.application,
            "reason": r.reason,
        }
        for r in rows
    ]


@router.post("/break-glass", response_model=BreakGlassOut)
def break_glass(
    data: BreakGlassIn, principal: Principal = Depends(require("security:manage")), db: Session = Depends(get_db)
) -> Any:
    user = db.get(User, principal.id)
    assert user is not None
    return service.open_break_glass(db, user, scope=data.scope, justification=data.justification, code=data.code)


@router.post("/ws-ticket")
def ws_ticket(principal: Principal = Depends(get_principal)) -> dict[str, Any]:
    """Ticket WebSocket à usage court (évite d'exposer les jetons dans l'URL)."""
    ticket = create_purpose_token("ws", str(principal.id), 60, {"sid": str(principal.session_id or "")})
    return {"ticket": ticket, "url": settings.ws_public_url, "expires_in": 60}


# ============================================================================ administration
def _user_out(user: User) -> dict[str, Any]:
    return {**UserOut.model_validate(user).model_dump(), "role_codes": user.role_codes, "full_name": user.full_name}


@admin.get("/users")
def list_users(
    params: PageParams = Depends(),
    role: str | None = None,
    organization_id: uuid.UUID | None = None,
    kind: str | None = None,
    active: bool | None = None,
    principal: Principal = Depends(require("users:read")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(User).where(User.deleted_at.is_(None))
    if role:
        stmt = (
            stmt.join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(Role.code == role)
        )
    if organization_id:
        stmt = stmt.where(User.organization_id == organization_id)
    if kind:
        stmt = stmt.join(Organization, Organization.id == User.organization_id).where(Organization.kind == kind)
    if active is not None:
        stmt = stmt.where(User.is_active.is_(active))
    return paginate(
        db,
        stmt,
        params,
        sort_fields={
            "name": User.last_name,
            "email": User.email,
            "created_at": User.created_at,
            "last_login_at": User.last_login_at,
        },
        default_sort=User.last_name,
        search_columns=[User.first_name, User.last_name, User.email],
        transform=_user_out,
    )


@admin.get("/users/directory", response_model=list[UserBrief])
def user_directory(
    q: str | None = Query(None, max_length=100),
    project_id: uuid.UUID | None = None,
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Annuaire restreint (messagerie, affectations) : internes + membres des projets communs."""
    from app.modules.projects.models import ProjectMember
    from app.websocket.hub import hub

    stmt = select(User).where(User.deleted_at.is_(None), User.is_active.is_(True))
    if project_id:
        stmt = stmt.join(ProjectMember, ProjectMember.user_id == User.id).where(ProjectMember.project_id == project_id)
    elif not principal.is_internal:
        my_projects = select(ProjectMember.project_id).where(ProjectMember.user_id == principal.id)
        shared = select(ProjectMember.user_id).where(
            ProjectMember.project_id.in_(my_projects), ProjectMember.project_role != "client"
        )
        stmt = stmt.where(User.id.in_(shared))
    else:
        stmt = stmt.join(Organization, Organization.id == User.organization_id, isouter=True)
    if q:
        stmt = stmt.where(
            or_(User.first_name.ilike(f"%{q}%"), User.last_name.ilike(f"%{q}%"), User.email.ilike(f"%{q}%"))
        )
    users = db.execute(stmt.order_by(User.last_name).limit(100)).scalars().unique().all()
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "job_title": u.job_title,
            "trade": u.trade,
            "online": hub.is_online(str(u.id)),
        }
        for u in users
    ]


@admin.post("/users", status_code=201)
def create_user(
    data: UserCreate, principal: Principal = Depends(require("users:write")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    if service.user_by_email(db, data.email):
        raise Conflict("Un utilisateur existe déjà avec cet e-mail", code="EMAIL_TAKEN")
    if "ADMIN" in data.role_codes and "ADMIN" not in principal.roles:
        raise Forbidden("Seul un administrateur peut créer un administrateur")
    ensure_person_trade(data.trade)
    from app.modules.bim.service import ensure_known_disciplines, global_disciplines

    ensure_known_disciplines(data.disciplines, global_disciplines(db))
    inviter = db.get(User, principal.id)
    assert inviter is not None
    user = User(
        email=service.normalize_email(data.email),
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        whatsapp=data.whatsapp,
        job_title=data.job_title,
        trade=data.trade,
        disciplines=data.disciplines,
        organization_id=data.organization_id,
    )
    db.add(user)
    db.flush()
    service.assign_roles(db, user, data.role_codes, granted_by=principal.id)
    from app.modules.projects.models import ProjectMember

    for pid in data.project_ids:
        db.add(ProjectMember(project_id=pid, user_id=user.id, project_role=data.project_role, added_by_id=principal.id))
    invitation_id = None
    if data.send_invitation:
        invitation, _ = service.invite_user(
            db,
            inviter=inviter,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            role_codes=data.role_codes,
            organization_id=data.organization_id,
            project_ids=[],
            message=data.message,
            channels=data.invitation_channels,
            phone=data.whatsapp or data.phone,
        )
        invitation_id = invitation.id
        if "CLIENT" in data.role_codes:
            user.mfa_required = True
    audit.record(
        db,
        family="security",
        module="users",
        action="CREATE",
        resource_type="user",
        resource_id=user.id,
        diff={"email": user.email, "roles": data.role_codes},
        criticality="MEDIUM",
    )
    db.commit()
    db.refresh(user)
    return {**_user_out(user), "invitation_id": invitation_id}


@admin.get("/users/{user_id}")
def get_user(
    user_id: uuid.UUID, principal: Principal = Depends(require("users:read")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    user = db.get(User, user_id)
    if user is None or user.deleted_at:
        raise NotFound("Utilisateur introuvable")
    return _user_out(user)


@admin.patch("/users/{user_id}")
def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    principal: Principal = Depends(require("users:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    user = db.get(User, user_id)
    if user is None or user.deleted_at:
        raise NotFound("Utilisateur introuvable")
    before = {
        **audit.snapshot(user, ["first_name", "last_name", "is_active", "mfa_required", "organization_id"]),
        "roles": user.role_codes,
    }
    changes = data.model_dump(exclude_unset=True)
    for key in ("first_name", "last_name", "disciplines", "is_active", "mfa_required"):  # obligatoires : vide ignoré
        if changes.get(key, False) is None:
            changes.pop(key)
    if "trade" in changes:
        ensure_person_trade(changes["trade"], current=user.trade)
    if "disciplines" in changes:
        from app.modules.bim.service import ensure_known_disciplines, global_disciplines

        ensure_known_disciplines(changes["disciplines"], global_disciplines(db), tolerated=user.disciplines)
    roles = changes.pop("role_codes", None)
    if roles is not None:
        if ("ADMIN" in roles or "ADMIN" in user.role_codes) and "ADMIN" not in principal.roles:
            raise Forbidden("Seul un administrateur peut modifier un rôle administrateur")
        if user.id == principal.id and "ADMIN" in user.role_codes and "ADMIN" not in roles:
            raise Forbidden("Vous ne pouvez pas retirer votre propre rôle administrateur")
        service.assign_roles(db, user, roles, granted_by=principal.id)
    for key, value in changes.items():
        setattr(user, key, value)
    if changes.get("is_active") is False:
        service.revoke_all_sessions(db, user.id, except_session=None, reason="account_disabled")
    after = {
        **audit.snapshot(user, ["first_name", "last_name", "is_active", "mfa_required", "organization_id"]),
        "roles": user.role_codes,
    }
    audit.record(
        db,
        family="security",
        module="users",
        action="UPDATE",
        resource_type="user",
        resource_id=user.id,
        diff=audit.diff_dicts(before, after),
        criticality="HIGH" if roles is not None else "MEDIUM",
    )
    db.commit()
    db.refresh(user)
    return _user_out(user)


@admin.post("/users/{user_id}/unlock")
def unlock_user(
    user_id: uuid.UUID, principal: Principal = Depends(require("users:write")), db: Session = Depends(get_db)
) -> dict[str, str]:
    user = db.get(User, user_id)
    if user is None:
        raise NotFound("Utilisateur introuvable")
    user.locked_until = None
    user.failed_login_count = 0
    audit.record(db, family="security", module="users", action="UNLOCK", resource_type="user", resource_id=user.id)
    db.commit()
    return {"status": "unlocked"}


@admin.post("/users/{user_id}/revoke-sessions")
def admin_revoke_sessions(
    user_id: uuid.UUID, principal: Principal = Depends(require("security:manage")), db: Session = Depends(get_db)
) -> dict[str, int]:
    count = service.revoke_all_sessions(db, user_id, except_session=None, reason="admin_revoked")
    audit.record(
        db,
        family="security",
        module="users",
        action="SESSION_REVOKE_ALL",
        resource_type="user",
        resource_id=user_id,
        diff={"count": count},
        criticality="HIGH",
    )
    db.commit()
    return {"revoked": count}


@admin.post("/users/{user_id}/reset-mfa")
def admin_reset_mfa(
    user_id: uuid.UUID,
    break_glass_id: uuid.UUID | None = None,
    principal: Principal = Depends(require("security:manage")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    service.require_break_glass(db, principal.id, "mfa_reset", break_glass_id)
    user = db.get(User, user_id)
    if user is None:
        raise NotFound("Utilisateur introuvable")
    for factor in db.execute(
        select(MFAFactor).where(MFAFactor.user_id == user.id, MFAFactor.disabled_at.is_(None))
    ).scalars():
        factor.disabled_at = utcnow()
    user.mfa_enabled = False
    service.revoke_all_sessions(db, user.id, except_session=None, reason="mfa_reset")
    audit.record(
        db,
        family="security",
        module="users",
        action="MFA_RESET",
        resource_type="user",
        resource_id=user.id,
        criticality="CRITICAL",
    )
    db.commit()
    return {"status": "reset"}


@admin.get("/invitations", response_model=list[InvitationOut])
def list_invitations(
    principal: Principal = Depends(require("users:read")), db: Session = Depends(get_db)
) -> list[Invitation]:
    return list(db.execute(select(Invitation).order_by(Invitation.created_at.desc()).limit(200)).scalars())


@admin.delete("/invitations/{invitation_id}")
def revoke_invitation(
    invitation_id: uuid.UUID, principal: Principal = Depends(require("users:write")), db: Session = Depends(get_db)
) -> dict[str, str]:
    inv = db.get(Invitation, invitation_id)
    if inv is None:
        raise NotFound("Invitation introuvable")
    inv.revoked_at = utcnow()
    audit.record(
        db,
        family="security",
        module="users",
        action="INVITATION_REVOKE",
        resource_type="invitation",
        resource_id=inv.id,
    )
    db.commit()
    return {"status": "revoked"}


# ---------------------------------------------------------------------------- rôles & permissions
def _role_out(db: Session, role: Role) -> dict[str, Any]:
    count = db.execute(select(func.count()).select_from(UserRole).where(UserRole.role_id == role.id)).scalar_one()
    return {**RoleOut.model_validate(role).model_dump(), "permission_codes": role.permission_codes, "user_count": count}


@admin.get("/permissions", response_model=list[PermissionOut])
def list_permissions(
    principal: Principal = Depends(require("users:read")), db: Session = Depends(get_db)
) -> list[Permission]:
    return list(db.execute(select(Permission).order_by(Permission.module, Permission.code)).scalars())


@admin.get("/directory/roles")
def roles_directory(
    principal: Principal = Depends(get_principal), db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    """Annuaire des rôles internes (code, nom, description) pour les sélecteurs « qui est prévenu ? » des écrans
    métier : accessible à tout utilisateur interne, sans exposer les permissions."""
    if "erp" not in service.spaces_for(principal.user, set(principal.permissions)):
        raise Forbidden("Réservé aux utilisateurs internes")
    rows = db.execute(select(Role).where(Role.audience == "internal").order_by(Role.name)).scalars()
    return [{"code": r.code, "name": r.name, "description": r.description} for r in rows]


@admin.get("/roles")
def list_roles(
    principal: Principal = Depends(require("users:read")), db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    return [_role_out(db, r) for r in db.execute(select(Role).order_by(Role.audience, Role.name)).scalars()]


def _set_role_permissions(db: Session, role: Role, codes: list[str]) -> None:
    unknown = set(codes) - PERMISSION_CODES
    if unknown:
        raise AppError(f"Permissions inconnues : {', '.join(sorted(unknown))}", code="UNKNOWN_PERMISSION")
    role.permissions.clear()
    db.flush()
    for code in sorted(set(codes)):
        role.permissions.append(RolePermission(role_id=role.id, permission_code=code))


def _role_code(db: Session, name: str) -> str:
    """Code technique d'un nouveau rôle dérivé de son nom, rendu unique (suffixe _2, _3…)."""
    base = slugify(re.sub(r"[^\w]+", " ", name), max_length=50).replace("-", "_").upper()  # ’ & / … séparent
    if not base[:1].isalpha() or len(base) < 3:
        base = f"ROLE_{base}"
    code, index = base, 2
    while db.execute(select(Role.id).where(Role.code == code)).first():
        code, index = f"{base}_{index}", index + 1
    return code


@admin.post("/roles", status_code=201)
def create_role(
    data: RoleIn, principal: Principal = Depends(require("roles:manage")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    if data.code and db.execute(select(Role).where(Role.code == data.code)).scalar_one_or_none():
        raise Conflict("Code de rôle déjà utilisé")
    role = Role(
        code=data.code or _role_code(db, data.name),
        name=data.name,
        description=data.description,
        audience=data.audience,
        global_scope=data.global_scope,
        mfa_required=data.mfa_required,
        is_system=False,
    )
    db.add(role)
    db.flush()
    _set_role_permissions(db, role, data.permissions)
    audit.record(
        db,
        family="security",
        module="roles",
        action="CREATE",
        resource_type="role",
        resource_id=role.id,
        diff={"code": role.code, "permissions": data.permissions},
        criticality="HIGH",
    )
    db.commit()
    return _role_out(db, role)


@admin.patch("/roles/{role_id}")
def update_role(
    role_id: uuid.UUID,
    data: RoleUpdate,
    principal: Principal = Depends(require("roles:manage")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    role = db.get(Role, role_id)
    if role is None:
        raise NotFound("Rôle introuvable")
    if role.code == "ADMIN" and data.permissions is not None:
        raise Forbidden("Les permissions du rôle ADMIN ne sont pas modifiables")
    before = {
        "permissions": role.permission_codes,
        "global_scope": role.global_scope,
        "mfa_required": role.mfa_required,
    }
    changes = data.model_dump(exclude_unset=True)
    perms = changes.pop("permissions", None)
    for key, value in changes.items():
        setattr(role, key, value)
    if perms is not None:
        _set_role_permissions(db, role, perms)
    db.flush()
    after = {"permissions": role.permission_codes, "global_scope": role.global_scope, "mfa_required": role.mfa_required}
    audit.record(
        db,
        family="security",
        module="roles",
        action="UPDATE",
        resource_type="role",
        resource_id=role.id,
        diff=audit.diff_dicts(before, after),
        criticality="HIGH",
    )
    db.commit()
    return _role_out(db, role)


@admin.delete("/roles/{role_id}")
def delete_role(
    role_id: uuid.UUID, principal: Principal = Depends(require("roles:manage")), db: Session = Depends(get_db)
) -> dict[str, str]:
    role = db.get(Role, role_id)
    if role is None:
        raise NotFound("Rôle introuvable")
    if role.is_system:
        raise Forbidden("Un rôle système ne peut pas être supprimé")
    if db.execute(select(UserRole).where(UserRole.role_id == role.id).limit(1)).first():
        raise Conflict("Rôle encore attribué à des utilisateurs")
    db.delete(role)
    audit.record(
        db,
        family="security",
        module="roles",
        action="DELETE",
        resource_type="role",
        resource_id=role_id,
        criticality="HIGH",
    )
    db.commit()
    return {"status": "deleted"}


# ---------------------------------------------------------------------------- organisations & équipes
@admin.get("/organizations")
def list_organizations(
    params: PageParams = Depends(),
    kind: str | None = None,
    principal: Principal = Depends(require("users:read")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(Organization).where(Organization.deleted_at.is_(None))
    if kind:
        stmt = stmt.where(Organization.kind == kind)
    return paginate(
        db,
        stmt,
        params,
        sort_fields={"name": Organization.name, "created_at": Organization.created_at},
        default_sort=Organization.name,
        search_columns=[Organization.name, Organization.legal_name],
        transform=lambda o: OrganizationOut.model_validate(o).model_dump(),
    )


@admin.post("/organizations", status_code=201, response_model=OrganizationOut)
def create_organization(
    data: OrganizationIn, principal: Principal = Depends(require("users:write")), db: Session = Depends(get_db)
) -> Organization:
    org = Organization(**data.model_dump())
    db.add(org)
    db.flush()
    audit.record(
        db,
        family="business",
        module="organizations",
        action="CREATE",
        resource_type="organization",
        resource_id=org.id,
        diff={"name": org.name, "kind": org.kind},
    )
    db.commit()
    return org


@admin.get("/organizations/{org_id}", response_model=OrganizationOut)
def get_organization(
    org_id: uuid.UUID, principal: Principal = Depends(require("users:read")), db: Session = Depends(get_db)
) -> Organization:
    """Fiche d'une organisation (libellé de la valeur courante des sélecteurs)."""
    org = db.get(Organization, org_id)
    if org is None or org.deleted_at is not None:
        raise NotFound("Organisation introuvable")
    return org


@admin.patch("/organizations/{org_id}", response_model=OrganizationOut)
def update_organization(
    org_id: uuid.UUID,
    data: OrganizationIn,
    principal: Principal = Depends(require("users:write")),
    db: Session = Depends(get_db),
) -> Organization:
    org = db.get(Organization, org_id)
    if org is None:
        raise NotFound("Organisation introuvable")
    before = audit.snapshot(org)
    for key, value in data.model_dump().items():
        setattr(org, key, value)
    audit.record(
        db,
        family="business",
        module="organizations",
        action="UPDATE",
        resource_type="organization",
        resource_id=org.id,
        diff=audit.diff_dicts(before, audit.snapshot(org)),
    )
    db.commit()
    return org


def _team_out(db: Session, team: Team) -> dict[str, Any]:
    members = db.execute(
        select(User).join(TeamMember, TeamMember.user_id == User.id).where(TeamMember.team_id == team.id)
    ).scalars()
    names = sorted(((u.id, u.full_name) for u in members), key=lambda pair: pair[1])
    leader = db.get(User, team.leader_id) if team.leader_id else None
    organization = db.get(Organization, team.organization_id) if team.organization_id else None
    return {
        **TeamOut.model_validate(team).model_dump(),
        "member_ids": [uid for uid, _name in names],
        # noms lisibles pour la fiche (les identifiants ne sont jamais affichés)
        "member_names": [name for _uid, name in names],
        "leader_name": leader.full_name if leader else None,
        "organization_name": organization.name if organization else None,
    }


@admin.get("/teams")
def list_teams(
    principal: Principal = Depends(require("users:read")), db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    return [_team_out(db, t) for t in db.execute(select(Team).order_by(Team.name)).scalars()]


@admin.post("/teams", status_code=201)
def create_team(
    data: TeamIn, principal: Principal = Depends(require("users:write")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    payload = data.model_dump()
    ensure_person_trade(payload["trade"])
    members = payload.pop("member_ids")
    team = Team(**payload)
    db.add(team)
    db.flush()
    for uid in members:
        db.add(TeamMember(team_id=team.id, user_id=uid))
    audit.record(db, family="business", module="teams", action="CREATE", resource_type="team", resource_id=team.id)
    db.commit()
    return _team_out(db, team)


@admin.patch("/teams/{team_id}")
def update_team(
    team_id: uuid.UUID,
    data: TeamUpdate,
    principal: Principal = Depends(require("users:write")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    team = db.get(Team, team_id)
    if team is None:
        raise NotFound("Équipe introuvable")
    payload = data.model_dump(exclude_unset=True)
    if "trade" in payload:
        ensure_person_trade(payload["trade"], current=team.trade)
    for key in ("name", "is_active"):  # obligatoires : une valeur vide ne remplace pas l'existante
        if payload.get(key, False) is None:
            payload.pop(key)
    members = payload.pop("member_ids", None)
    for key, value in payload.items():
        setattr(team, key, value)
    if members is not None:
        db.execute(TeamMember.__table__.delete().where(TeamMember.team_id == team.id))
        for uid in members:
            db.add(TeamMember(team_id=team.id, user_id=uid))
    audit.record(db, family="business", module="teams", action="UPDATE", resource_type="team", resource_id=team.id)
    db.commit()
    return _team_out(db, team)


# ---------------------------------------------------------------------------- clés d'API
@admin.get("/api-keys", response_model=list[ApiKeyOut])
def list_api_keys(
    principal: Principal = Depends(require("security:manage")), db: Session = Depends(get_db)
) -> list[ApiCredential]:
    return list(db.execute(select(ApiCredential).order_by(ApiCredential.created_at.desc())).scalars())


@admin.post("/api-keys", status_code=201, response_model=ApiKeyCreated)
def create_api_key(
    data: ApiKeyIn, principal: Principal = Depends(require("security:manage")), db: Session = Depends(get_db)
) -> dict[str, Any]:
    unknown = set(data.scopes) - PERMISSION_CODES
    if unknown:
        raise AppError(f"Portées inconnues : {', '.join(sorted(unknown))}")
    raw = "glb_" + random_token(32)
    cred = ApiCredential(
        name=data.name,
        key_prefix=raw[:12],
        key_hash=sha256_hex(raw),
        scopes=data.scopes,
        created_by_id=principal.id,
        expires_at=data.expires_at,
        allowed_ips=data.allowed_ips,
        organization_id=principal.organization_id,
    )
    db.add(cred)
    db.flush()
    audit.record(
        db,
        family="security",
        module="api_keys",
        action="CREATE",
        resource_type="api_credential",
        resource_id=cred.id,
        diff={"name": cred.name, "scopes": data.scopes},
        criticality="HIGH",
    )
    db.commit()
    return {**ApiKeyOut.model_validate(cred).model_dump(), "key": raw}


@admin.delete("/api-keys/{key_id}")
def revoke_api_key(
    key_id: uuid.UUID, principal: Principal = Depends(require("security:manage")), db: Session = Depends(get_db)
) -> dict[str, str]:
    cred = db.get(ApiCredential, key_id)
    if cred is None:
        raise NotFound("Clé introuvable")
    cred.revoked_at = utcnow()
    audit.record(
        db,
        family="security",
        module="api_keys",
        action="REVOKE",
        resource_type="api_credential",
        resource_id=cred.id,
        criticality="HIGH",
    )
    db.commit()
    return {"status": "revoked"}
