"""User model for authentication — Extended for production RBAC."""
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text
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
