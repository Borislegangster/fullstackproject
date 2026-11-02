"""User model for authentication — Extended for production RBAC."""
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer
from app.database import Base
import uuid


def _uuid():
    return str(uuid.uuid4())


# Valid roles — stored as plain strings for SQLite compatibility
VALID_ROLES = ("ADMIN", "CHEF_PROJET", "COMPTABLE", "RH", "CLIENT")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)

    # Identity
    first_name = Column(String, default="")
    last_name = Column(String, default="")
    phone = Column(String, default="")
    avatar_url = Column(String, nullable=True)

    # Role-Based Access Control
    role = Column(String, default="CLIENT", index=True)
    # Valid values: ADMIN, CHEF_PROJET, COMPTABLE, RH, CLIENT

    # Zero-Trust Onboarding
    is_active = Column(Boolean, default=False)
    must_change_password = Column(Boolean, default=True)
    invitation_token = Column(String, nullable=True)
    invitation_sent_at = Column(DateTime, nullable=True)

    # Account lockout (anti brute-force)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)

    # Tracking
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete

    @property
    def full_name(self) -> str:
        """Backwards-compatible accessor combining first + last name."""
        parts = [self.first_name or "", self.last_name or ""]
        return " ".join(p for p in parts if p).strip() or self.email.split("@")[0]

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    @property
    def is_locked(self) -> bool:
        if self.locked_until is None:
            return False
        return self.locked_until > datetime.utcnow()


class PasswordResetToken(Base):
    """One-time tokens for the forgot-password flow.

    A user requests a reset → server generates a token, stores its hash,
    emails the plaintext token, then verifies+invalidates on reset.
    """
    __tablename__ = "password_reset_tokens"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String, nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    requested_ip = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class UserSession(Base):
    """Tracks active refresh-token sessions per user (multi-device).

    Used by ClientAccount → "Sessions appareils" UI to show & revoke logins.
    """
    __tablename__ = "user_sessions"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    refresh_token_hash = Column(String, nullable=False, unique=True, index=True)
    user_agent = Column(String, default="")
    ip_address = Column(String, default="")
    device_label = Column(String, default="")  # "Chrome on Windows", "iPhone Safari", etc.
    last_active_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
