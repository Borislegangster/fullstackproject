"""Schémas Pydantic — identité, authentification, administration des comptes."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)
    device_key: str | None = Field(default=None, max_length=120)
    device_name: str | None = Field(default=None, max_length=150)
    remember: bool = False


class OrganizationRef(ORM):
    id: uuid.UUID
    name: str
    kind: str


class MeOut(ORM):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    full_name: str
    phone: str | None = None
    whatsapp: str | None = None
    job_title: str | None = None
    trade: str | None = None
    disciplines: list[Any] = []
    locale: str
    timezone: str
    roles: list[str]
    permissions: list[str]
    organization: OrganizationRef | None = None
    mfa_enabled: bool
    mfa_required: bool
    preferences: dict[str, Any] = {}
    spaces: list[str] = []  # erp / client / extranet_supplier / extranet_subcontractor
    features: list[str] = []  # modules optionnels activés par l'administration (ex. « referrals » : parrainage)
    avatar_url: str | None = None
    email_verified: bool = False


class TokenOut(BaseModel):
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"  # noqa: S105 — type de jeton OAuth, pas un secret
    expires_in: int
    user: MeOut


class MfaChallengeOut(BaseModel):
    mfa_required: bool = True
    mfa_token: str
    methods: list[str]


class MfaVerifyIn(BaseModel):
    mfa_token: str
    code: str | None = Field(default=None, max_length=12)
    recovery_code: str | None = Field(default=None, max_length=32)
    webauthn: dict[str, Any] | None = None
    webauthn_challenge_token: str | None = None
    trust_device: bool = False


class RefreshIn(BaseModel):
    refresh_token: str | None = None


class MeUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=120)
    last_name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    whatsapp: str | None = Field(default=None, max_length=40)
    job_title: str | None = Field(default=None, max_length=150)
    locale: str | None = Field(default=None, max_length=10)
    timezone: str | None = Field(default=None, max_length=60)
    preferences: dict[str, Any] | None = None


class PasswordChangeIn(BaseModel):
    current_password: str = Field(max_length=256)
    new_password: str = Field(min_length=8, max_length=256)


class PasswordForgotIn(BaseModel):
    email: EmailStr


class PasswordResetIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    new_password: str = Field(min_length=8, max_length=256)


class EmailVerifyIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)


class InvitationAcceptIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=8, max_length=256)
    first_name: str | None = Field(default=None, max_length=120)
    last_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=40)


class SessionOut(ORM):
    id: uuid.UUID
    created_at: datetime
    last_used_at: datetime | None
    expires_at: datetime
    ip: str | None
    user_agent: str | None
    application: str | None
    mfa_verified_at: datetime | None
    current: bool = False


class DeviceOut(ORM):
    id: uuid.UUID
    name: str | None
    platform: str | None
    application: str | None
    trusted: bool
    trusted_until: datetime | None
    last_seen_at: datetime | None
    created_at: datetime


class TotpSetupOut(BaseModel):
    secret: str
    otpauth_uri: str
    qr_data_url: str


class CodeIn(BaseModel):
    code: str = Field(min_length=6, max_length=12)


class MfaDisableIn(BaseModel):
    password: str = Field(max_length=256)
    code: str = Field(min_length=6, max_length=32)


class RecoveryCodesOut(BaseModel):
    codes: list[str]


class WebAuthnOptionsOut(BaseModel):
    options: dict[str, Any]
    challenge_token: str


class WebAuthnRegisterIn(BaseModel):
    credential: dict[str, Any]
    challenge_token: str
    name: str = Field(default="Clé de sécurité", max_length=120)


class MfaFactorOut(ORM):
    id: uuid.UUID
    type: str
    name: str | None
    confirmed_at: datetime | None
    last_used_at: datetime | None
    created_at: datetime


class BreakGlassIn(BaseModel):
    scope: str = Field(pattern="^(restore|purge|hard_delete|secret_reset|mfa_reset)$")
    justification: str = Field(min_length=20, max_length=2000)
    code: str = Field(min_length=6, max_length=32)


class BreakGlassOut(ORM):
    id: uuid.UUID
    scope: str
    expires_at: datetime
    created_at: datetime


# ---------------------------------------------------------------------------- administration
class UserCreate(BaseModel):
    email: EmailStr
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    whatsapp: str | None = Field(default=None, max_length=40)
    job_title: str | None = Field(default=None, max_length=150)
    trade: str | None = Field(default=None, max_length=80)
    disciplines: list[str] = []
    organization_id: uuid.UUID | None = None
    role_codes: list[str] = Field(min_length=1)
    project_ids: list[uuid.UUID] = []
    project_role: str = "membre"
    send_invitation: bool = True
    invitation_channels: list[Literal["email", "whatsapp"]] = Field(default_factory=lambda: ["email"], min_length=1)
    message: str | None = Field(default=None, max_length=1000)


class UserUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=120)
    last_name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    whatsapp: str | None = Field(default=None, max_length=40)
    job_title: str | None = Field(default=None, max_length=150)
    trade: str | None = Field(default=None, max_length=80)
    disciplines: list[str] | None = None
    organization_id: uuid.UUID | None = None
    role_codes: list[str] | None = None
    is_active: bool | None = None
    mfa_required: bool | None = None


class UserOut(ORM):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    full_name: str
    phone: str | None
    whatsapp: str | None
    job_title: str | None
    trade: str | None
    disciplines: list[Any]
    organization_id: uuid.UUID | None = None
    organization: OrganizationRef | None
    role_codes: list[str]
    is_active: bool
    mfa_enabled: bool
    mfa_required: bool
    last_login_at: datetime | None
    locked_until: datetime | None
    created_at: datetime


class UserBrief(ORM):
    id: uuid.UUID
    full_name: str
    email: str
    job_title: str | None = None
    trade: str | None = None
    online: bool = False


class RoleIn(BaseModel):
    # Facultatif : dérivé du nom (« Conducteur de travaux » → CONDUCTEUR_DE_TRAVAUX), rendu unique.
    code: str | None = Field(default=None, pattern="^[A-Z][A-Z0-9_]{2,59}$")
    name: str = Field(min_length=2, max_length=150)
    description: str | None = None
    audience: str = Field(default="internal", pattern="^(internal|client|partner)$")
    global_scope: bool = False
    mfa_required: bool = False
    permissions: list[str] = []


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=150)
    description: str | None = None
    global_scope: bool | None = None
    mfa_required: bool | None = None
    permissions: list[str] | None = None


class RoleOut(ORM):
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    audience: str
    is_system: bool
    global_scope: bool
    mfa_required: bool
    permission_codes: list[str]
    user_count: int = 0


class PermissionOut(ORM):
    code: str
    module: str
    label: str
    sensitive: bool


class OrganizationIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    kind: str = Field(pattern="^(internal|client|supplier|subcontractor|partner)$")
    legal_name: str | None = None
    legal_form: str | None = None
    tax_id: str | None = None
    trade_register: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    whatsapp: str | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = "Cameroun"
    website: str | None = None
    notes: str | None = None
    is_active: bool = True


class OrganizationOut(ORM):
    id: uuid.UUID
    name: str
    kind: str
    legal_name: str | None
    legal_form: str | None
    tax_id: str | None
    trade_register: str | None
    email: str | None
    phone: str | None
    whatsapp: str | None
    address: str | None
    city: str | None
    country: str | None
    website: str | None
    notes: str | None
    is_active: bool
    created_at: datetime


class TeamIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    organization_id: uuid.UUID | None = None
    leader_id: uuid.UUID | None = None
    trade: str | None = Field(default=None, max_length=80)
    description: str | None = None
    member_ids: list[uuid.UUID] = []
    is_active: bool = True


class TeamUpdate(BaseModel):
    """Modification partielle : seuls les champs envoyés changent (membres remplacés si `member_ids` est fourni)."""

    name: str | None = Field(default=None, min_length=2, max_length=150)
    organization_id: uuid.UUID | None = None
    leader_id: uuid.UUID | None = None
    trade: str | None = Field(default=None, max_length=80)
    description: str | None = None
    member_ids: list[uuid.UUID] | None = None
    is_active: bool | None = None


class TeamOut(ORM):
    id: uuid.UUID
    name: str
    organization_id: uuid.UUID | None
    leader_id: uuid.UUID | None
    trade: str | None
    description: str | None
    is_active: bool
    member_ids: list[uuid.UUID] = []


class ApiKeyIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    scopes: list[str] = Field(min_length=1)
    expires_at: datetime | None = None
    allowed_ips: list[str] = []


class ApiKeyOut(ORM):
    id: uuid.UUID
    name: str
    key_prefix: str
    scopes: list[Any]
    last_used_at: datetime | None
    expires_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime


class ApiKeyCreated(ApiKeyOut):
    key: str  # affichée une seule fois


class InvitationOut(ORM):
    id: uuid.UUID
    email: str
    role_codes: list[Any]
    expires_at: datetime
    accepted_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime
