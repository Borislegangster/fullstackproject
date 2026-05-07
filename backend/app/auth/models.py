"""User model for authentication."""
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime
from app.database import Base
import uuid


def _uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, default="")
    role = Column(String, default="CLIENT")  # ADMIN, CLIENT
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
