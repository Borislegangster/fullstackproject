"""Identité : User, Role, Permission, Organization, Team, Device, Session, MFAFactor (§19)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, Index, Integer, String, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import (
    Base,
    SoftDelete,
    Timestamps,
    UUIDPk,
    Versioned,
    bool_col,
    dt_col,
    fk,
    int_col,
    json_col,
    str_col,
    text_col,
)
from app.core.security import EncryptedString
from app.core.utils import utcnow

ORG_KINDS = ("internal", "client", "supplier", "subcontractor", "partner")


class Organization(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = str_col(200, nullable=False, index=True)
    kind: Mapped[str] = str_col(
        30, nullable=False, index=True
    )  # internal / client / supplier / subcontractor / partner
    legal_name: Mapped[str | None] = str_col(250)
    legal_form: Mapped[str | None] = str_col(60)
    tax_id: Mapped[str | None] = str_col(60)  # NIU
    trade_register: Mapped[str | None] = str_col(80)  # RCCM
    email: Mapped[str | None] = str_col(254)
    phone: Mapped[str | None] = str_col(40)
    whatsapp: Mapped[str | None] = str_col(40)
    address: Mapped[str | None] = text_col()
    city: Mapped[str | None] = str_col(120)
    country: Mapped[str | None] = str_col(80, default="Cameroun")
    website: Mapped[str | None] = str_col(250)
    is_active: Mapped[bool] = bool_col(True)
    notes: Mapped[str | None] = text_col()


class Permission(Base):
    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(String(80), primary_key=True)
    module: Mapped[str] = str_col(60, nullable=False, index=True)
    label: Mapped[str] = str_col(200, nullable=False)
    description: Mapped[str | None] = text_col()
    sensitive: Mapped[bool] = bool_col(False)


class Role(UUIDPk, Timestamps, Base):
    __tablename__ = "roles"

    code: Mapped[str] = str_col(60, nullable=False, unique=True)
    name: Mapped[str] = str_col(150, nullable=False)
    description: Mapped[str | None] = text_col()
    audience: Mapped[str] = str_col(20, nullable=False, default="internal")  # internal / client / partner
    is_system: Mapped[bool] = bool_col(False)
    global_scope: Mapped[bool] = bool_col(False)  # voit tous les projets (sinon affectations uniquement)
    mfa_required: Mapped[bool] = bool_col(False)
    permissions: Mapped[list[RolePermission]] = relationship(
        back_populates="role", cascade="all, delete-orphan", lazy="selectin"
    )

    @property
    def permission_codes(self) -> list[str]:
        return sorted(p.permission_code for p in self.permissions)


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    permission_code: Mapped[str] = mapped_column(
        String(80), ForeignKey("permissions.code", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[Role] = relationship(back_populates="permissions")


class User(UUIDPk, Timestamps, SoftDelete, Versioned, Base):
    __tablename__ = "users"

    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id")
    email: Mapped[str] = str_col(254, nullable=False, unique=True)
    first_name: Mapped[str] = str_col(120, nullable=False)
    last_name: Mapped[str] = str_col(120, nullable=False)
    phone: Mapped[str | None] = str_col(40)
    whatsapp: Mapped[str | None] = str_col(40)
    job_title: Mapped[str | None] = str_col(150)
    trade: Mapped[str | None] = str_col(80)  # corps de métier (maçon, électricien, plombier…)
    disciplines: Mapped[list[Any]] = json_col(list)  # architecture, structure, electricite…
    avatar_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id", use_alter=True)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    password_changed_at: Mapped[datetime | None] = dt_col()
    is_active: Mapped[bool] = bool_col(True)
    email_verified_at: Mapped[datetime | None] = dt_col()
    failed_login_count: Mapped[int] = int_col(0)
    locked_until: Mapped[datetime | None] = dt_col()
    last_login_at: Mapped[datetime | None] = dt_col()
    mfa_enabled: Mapped[bool] = bool_col(False)
    mfa_required: Mapped[bool] = bool_col(False)  # imposé individuellement
    locale: Mapped[str] = str_col(10, nullable=False, default="fr")
    timezone: Mapped[str] = str_col(60, nullable=False, default="Africa/Douala")
    preferences: Mapped[dict[str, Any]] = json_col(dict)
    privacy: Mapped[dict[str, Any]] = json_col(dict)  # consentements / choix de confidentialité

    organization: Mapped[Organization | None] = relationship(lazy="joined")
    roles: Mapped[list[Role]] = relationship(
        secondary="user_roles",
        primaryjoin="User.id == UserRole.user_id",
        secondaryjoin="Role.id == UserRole.role_id",
        lazy="selectin",
        viewonly=True,
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def role_codes(self) -> list[str]:
        return sorted(r.code for r in self.roles)


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    granted_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    granted_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class Team(UUIDPk, Timestamps, Base):
    __tablename__ = "teams"

    name: Mapped[str] = str_col(150, nullable=False)
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id")
    leader_id: Mapped[uuid.UUID | None] = fk("users.id")
    trade: Mapped[str | None] = str_col(80)
    description: Mapped[str | None] = text_col()
    is_active: Mapped[bool] = bool_col(True)


class TeamMember(Base):
    __tablename__ = "team_members"

    team_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[str] = str_col(40, nullable=False, default="member")


class Device(UUIDPk, Timestamps, Base):
    __tablename__ = "devices"
    __table_args__ = (UniqueConstraint("user_id", "device_key"),)

    user_id: Mapped[uuid.UUID] = fk("users.id", nullable=False, ondelete="CASCADE")
    device_key: Mapped[str] = str_col(120, nullable=False)  # identifiant stable fourni par l'application
    name: Mapped[str | None] = str_col(150)
    platform: Mapped[str | None] = str_col(40)  # web / android / ios / windows / macos / linux
    application: Mapped[str | None] = str_col(40)
    trusted: Mapped[bool] = bool_col(False)
    trusted_until: Mapped[datetime | None] = dt_col()
    last_seen_at: Mapped[datetime | None] = dt_col()
    last_ip: Mapped[str | None] = str_col(64)
    revoked_at: Mapped[datetime | None] = dt_col()


class UserSession(UUIDPk, Base):
    __tablename__ = "user_sessions"

    user_id: Mapped[uuid.UUID] = fk("users.id", nullable=False, ondelete="CASCADE")
    device_id: Mapped[uuid.UUID | None] = fk("devices.id")
    family_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    refresh_token_hash: Mapped[str] = str_col(64, nullable=False, unique=True)
    previous_token_hash: Mapped[str | None] = str_col(64, index=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    last_used_at: Mapped[datetime | None] = dt_col()
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    revoked_at: Mapped[datetime | None] = dt_col(index=True)
    revoke_reason: Mapped[str | None] = str_col(120)
    ip: Mapped[str | None] = str_col(64)
    user_agent: Mapped[str | None] = str_col(400)
    application: Mapped[str | None] = str_col(40)
    mfa_verified_at: Mapped[datetime | None] = dt_col()
    auth_method: Mapped[str] = str_col(30, nullable=False, default="password")


class MFAFactor(UUIDPk, Timestamps, Base):
    __tablename__ = "mfa_factors"

    user_id: Mapped[uuid.UUID] = fk("users.id", nullable=False, ondelete="CASCADE")
    type: Mapped[str] = str_col(20, nullable=False)  # totp / webauthn
    name: Mapped[str | None] = str_col(120)
    secret: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)  # TOTP chiffré AES-256-GCM
    credential_id: Mapped[str | None] = str_col(512, index=True)
    public_key: Mapped[str | None] = text_col()
    sign_count: Mapped[int] = int_col(0)
    transports: Mapped[list[Any]] = json_col(list)
    confirmed_at: Mapped[datetime | None] = dt_col()
    last_used_at: Mapped[datetime | None] = dt_col()
    last_used_step: Mapped[int | None] = mapped_column(Integer, nullable=True)  # anti-rejeu TOTP
    disabled_at: Mapped[datetime | None] = dt_col()


class MFARecoveryCode(UUIDPk, Base):
    __tablename__ = "mfa_recovery_codes"

    user_id: Mapped[uuid.UUID] = fk("users.id", nullable=False, ondelete="CASCADE")
    code_hash: Mapped[str] = str_col(64, nullable=False)
    used_at: Mapped[datetime | None] = dt_col()
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class UserToken(UUIDPk, Base):
    """Jetons à usage unique : réinitialisation, vérification e-mail, invitation, OTP."""

    __tablename__ = "user_tokens"
    __table_args__ = (Index("ix_user_tokens_lookup", "purpose", "token_hash"),)

    user_id: Mapped[uuid.UUID | None] = fk("users.id", ondelete="CASCADE")
    email: Mapped[str | None] = str_col(254)
    purpose: Mapped[str] = str_col(30, nullable=False)  # reset / verify / invite / otp_sign / otp_decision
    token_hash: Mapped[str] = str_col(64, nullable=False)
    payload: Mapped[dict[str, Any]] = json_col(dict)
    attempts: Mapped[int] = int_col(0)
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    used_at: Mapped[datetime | None] = dt_col()
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    ip: Mapped[str | None] = str_col(64)


class ApiCredential(UUIDPk, Timestamps, Base):
    """Clés d'API (hachées ; la valeur n'est affichée qu'une fois à la création)."""

    __tablename__ = "api_credentials"

    name: Mapped[str] = str_col(150, nullable=False)
    key_prefix: Mapped[str] = str_col(16, nullable=False, index=True)
    key_hash: Mapped[str] = str_col(64, nullable=False, unique=True)
    scopes: Mapped[list[Any]] = json_col(list)
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id")
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id")
    last_used_at: Mapped[datetime | None] = dt_col()
    expires_at: Mapped[datetime | None] = dt_col()
    revoked_at: Mapped[datetime | None] = dt_col()
    allowed_ips: Mapped[list[Any]] = json_col(list)


class Invitation(UUIDPk, Timestamps, Base):
    __tablename__ = "invitations"

    email: Mapped[str] = str_col(254, nullable=False, index=True)
    first_name: Mapped[str | None] = str_col(120)
    last_name: Mapped[str | None] = str_col(120)
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id")
    role_codes: Mapped[list[Any]] = json_col(list)
    project_ids: Mapped[list[Any]] = json_col(list)
    invited_by_id: Mapped[uuid.UUID | None] = fk("users.id")
    token_hash: Mapped[str] = str_col(64, nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    accepted_at: Mapped[datetime | None] = dt_col()
    revoked_at: Mapped[datetime | None] = dt_col()
    message: Mapped[str | None] = text_col()


__all__ = [
    "ORG_KINDS",
    "ApiCredential",
    "Device",
    "Invitation",
    "MFAFactor",
    "MFARecoveryCode",
    "Organization",
    "Permission",
    "Role",
    "RolePermission",
    "Team",
    "TeamMember",
    "User",
    "UserRole",
    "UserSession",
    "UserToken",
]
