"""
Communications Models — Calls, call participants, presence.
"""
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey, JSON,
)
from app.database import Base
import uuid


def _uuid():
    return str(uuid.uuid4())


class Call(Base):
    __tablename__ = "calls"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True, index=True)
    initiated_by = Column(String, ForeignKey("users.id"), nullable=False)
    call_type = Column(String, default="AUDIO")  # AUDIO/VIDEO/SCREEN_SHARE
    status = Column(String, default="RINGING", index=True)
    # RINGING/IN_PROGRESS/COMPLETED/MISSED/DECLINED/FAILED

    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, default=0)

    recording_url = Column(String, default="")
    recording_consent = Column(Boolean, default=False)
    recording_retention_days = Column(Integer, default=30)

    context_type = Column(String, default="")  # direct, project, bim_issue
    context_id = Column(String, default="")
    notes = Column(Text, default="")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CallParticipant(Base):
    __tablename__ = "call_participants"

    id = Column(String, primary_key=True, default=_uuid)
    call_id = Column(String, ForeignKey("calls.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String, default="PARTICIPANT")  # INITIATOR/PARTICIPANT
    status = Column(String, default="INVITED")
    # INVITED/RINGING/CONNECTED/DISCONNECTED/DECLINED
    joined_at = Column(DateTime, nullable=True)
    left_at = Column(DateTime, nullable=True)
    muted = Column(Boolean, default=False)
    video_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserPresence(Base):
    __tablename__ = "user_presence"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    status = Column(String, default="OFFLINE")  # ONLINE/AWAY/BUSY/OFFLINE
    last_seen_at = Column(DateTime, default=datetime.utcnow)
    current_page = Column(String, default="")
    device = Column(String, default="")  # web/desktop/mobile
    ip_address = Column(String, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
