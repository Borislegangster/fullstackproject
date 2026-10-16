"""Authentification et autorisation des requêtes (jeton Bearer, cookie HttpOnly + CSRF, clé d'API)."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Annotated, Any

import jwt
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.context import get_context
from app.core.database import get_db
from app.core.errors import Forbidden, Unauthorized
from app.core.middleware import client_ip
from app.core.security import constant_time_equals, decode_token, sha256_hex
from app.core.utils import utcnow

ACCESS_COOKIE = "globus_access"
REFRESH_COOKIE = "globus_refresh"
CSRF_COOKIE = "globus_csrf"
CSRF_HEADER = "x-csrf-token"
_UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}
_MFA_EXEMPT_PREFIXES = ("/auth/", "/me")


@dataclass
class Principal:
    user: Any  # app.modules.identity.models.User
    session_id: uuid.UUID | None
    roles: set[str] = field(default_factory=set)
    permissions: set[str] = field(default_factory=set)
    organization_id: uuid.UUID | None = None
    org_kind: str | None = None
    global_scope: bool = False
    mfa_verified: bool = False
    api_key_id: uuid.UUID | None = None
    auth_via: str = "bearer"  # bearer / cookie / api_key

    @property
    def id(self) -> uuid.UUID:
        return self.user.id

    @property
    def is_internal(self) -> bool:
        return self.org_kind == "internal"

    @property
    def is_client(self) -> bool:
        return "CLIENT" in self.roles

    def has(self, *perms: str) -> bool:
        return all(p in self.permissions for p in perms)

    def has_any(self, *perms: str) -> bool:
        return any(p in self.permissions for p in perms)

    def require(self, *perms: str) -> None:
        missing = [p for p in perms if p not in self.permissions]
        if missing:
            raise Forbidden("Permission insuffisante", code="PERMISSION_DENIED", details={"missing": missing})


def _extract_token(request: Request) -> tuple[str | None, str]:
    auth = request.headers.get("authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth[7:].strip(), "bearer"
    cookie = request.cookies.get(ACCESS_COOKIE)
    if cookie:
        return cookie, "cookie"
    return None, "none"


def optional_scope_key(request: Request) -> str:
    token, _ = _extract_token(request)
    if token:
        try:
            return "user:" + str(decode_token(token)["sub"])
        except Exception:  # noqa: BLE001
            pass
    api_key = request.headers.get("x-api-key")
    if api_key:
        return "key:" + sha256_hex(api_key)[:16]
    return "ip:" + (client_ip(request.scope) or "unknown")


def _permissions_for(user: Any) -> tuple[set[str], bool, bool]:
    perms: set[str] = set()
    global_scope = False
    mfa_required = bool(getattr(user, "mfa_required", False))
    for role in user.roles:
        perms.update(role.permission_codes)
        global_scope = global_scope or role.global_scope
        mfa_required = mfa_required or role.mfa_required or role.code in settings.MFA_REQUIRED_ROLES
    return perms, global_scope, mfa_required


def _api_key_principal(db: Session, raw_key: str) -> Principal:
    from app.modules.identity.models import ApiCredential, User

    cred = db.execute(select(ApiCredential).where(ApiCredential.key_hash == sha256_hex(raw_key))).scalar_one_or_none()
    now = utcnow()
    if cred is None or cred.revoked_at is not None or (cred.expires_at and cred.expires_at < now):
        raise Unauthorized("Clé d'API invalide", code="INVALID_API_KEY")
    ip = get_context().ip
    if cred.allowed_ips and ip not in cred.allowed_ips:
        raise Forbidden("Adresse IP non autorisée pour cette clé", code="API_KEY_IP_DENIED")
    owner = db.get(User, cred.created_by_id) if cred.created_by_id else None
    if owner is None or not owner.is_active:
        raise Unauthorized("Clé d'API orpheline", code="INVALID_API_KEY")
    cred.last_used_at = now
    db.commit()
    owner_perms, global_scope, _ = _permissions_for(owner)
    scopes = set(cred.scopes or []) & owner_perms  # une clé ne dépasse jamais les droits de son créateur
    get_context().user_id = str(owner.id)
    return Principal(
        user=owner,
        session_id=None,
        roles=set(owner.role_codes),
        permissions=scopes,
        organization_id=owner.organization_id,
        org_kind=owner.organization.kind if owner.organization else None,
        global_scope=global_scope,
        mfa_verified=True,
        api_key_id=cred.id,
        auth_via="api_key",
    )


def get_principal(request: Request, db: Session = Depends(get_db)) -> Principal:
    from app.modules.identity.models import User, UserSession

    api_key = request.headers.get("x-api-key")
    token, via = _extract_token(request)
    if not token and api_key:
        return _api_key_principal(db, api_key)
    if not token:
        raise Unauthorized("Authentification requise", code="NOT_AUTHENTICATED")
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError as exc:
        raise Unauthorized("Session expirée", code="TOKEN_EXPIRED") from exc
    except jwt.PyJWTError as exc:
        raise Unauthorized("Jeton invalide", code="INVALID_TOKEN") from exc

    if via == "cookie" and request.method in _UNSAFE:
        header = request.headers.get(CSRF_HEADER) or ""
        cookie = request.cookies.get(CSRF_COOKIE) or ""
        if not header or not cookie or not constant_time_equals(header, cookie):
            raise Forbidden("Jeton CSRF manquant ou invalide", code="CSRF_FAILED")

    session_id = uuid.UUID(payload["sid"]) if payload.get("sid") else None
    if session_id is None:
        raise Unauthorized("Jeton invalide", code="INVALID_TOKEN")
    session = db.get(UserSession, session_id)
    now = utcnow()
    if session is None or session.revoked_at is not None or session.expires_at < now:
        raise Unauthorized("Session révoquée ou expirée", code="SESSION_REVOKED")
    user = db.get(User, uuid.UUID(payload["sub"]))
    if user is None or not user.is_active or user.deleted_at is not None:
        raise Unauthorized("Compte inactif", code="ACCOUNT_INACTIVE")
    if user.locked_until and user.locked_until > now:
        raise Unauthorized("Compte verrouillé temporairement", code="ACCOUNT_LOCKED")

    perms, global_scope, mfa_required = _permissions_for(user)
    get_context().user_id = str(user.id)
    principal = Principal(
        user=user,
        session_id=session.id,
        roles=set(user.role_codes),
        permissions=perms,
        organization_id=user.organization_id,
        org_kind=user.organization.kind if user.organization else None,
        global_scope=global_scope,
        mfa_verified=session.mfa_verified_at is not None,
        auth_via=via,
    )
    if mfa_required and settings.MFA_ENFORCEMENT == "enforce" and not user.mfa_enabled and not _path_exempt(request):
        raise Forbidden("L'activation du MFA est obligatoire pour ce compte", code="MFA_ENROLLMENT_REQUIRED")
    return principal


def _path_exempt(request: Request) -> bool:
    path = request.url.path.removeprefix(settings.API_PREFIX)
    return path.startswith(_MFA_EXEMPT_PREFIXES)


def get_optional_principal(request: Request, db: Session = Depends(get_db)) -> Principal | None:
    token, _ = _extract_token(request)
    if not token and not request.headers.get("x-api-key"):
        return None
    try:
        return get_principal(request, db)
    except (Unauthorized, Forbidden):
        return None


def require(*perms: str, any_of: bool = False) -> Callable[..., Principal]:
    """Dépendance : exige toutes (ou l'une, `any_of=True`) des permissions."""

    def dependency(principal: Principal = Depends(get_principal)) -> Principal:
        ok = principal.has_any(*perms) if any_of else principal.has(*perms)
        if not ok:
            raise Forbidden("Permission insuffisante", code="PERMISSION_DENIED", details={"required": list(perms)})
        return principal

    return dependency


def require_mfa_session(principal: Principal = Depends(get_principal)) -> Principal:
    if not principal.mfa_verified:
        raise Forbidden("Cette action exige une session validée par MFA", code="MFA_SESSION_REQUIRED")
    return principal


CurrentPrincipal = Annotated[Principal, Depends(get_principal)]
OptionalPrincipal = Annotated[Principal | None, Depends(get_optional_principal)]
DB = Annotated[Session, Depends(get_db)]
