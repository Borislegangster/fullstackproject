"""Pydantic schemas for Newsletter, campaigns, segments."""
from datetime import datetime
from typing import Optional, List
# pyrefly: ignore [missing-import]
from pydantic import BaseModel


class SegmentCreate(BaseModel):
    name: str
    description: str = ""
    rules: dict = {}  # Filter rules for segment

class SegmentOut(BaseModel):
    id: str
    name: str
    description: str
    rules: dict
    subscriber_count: int
    created_at: datetime
    class Config:
        from_attributes = True

class CampaignCreate(BaseModel):
    name: str
    subject: str
    body_html: str = ""
    body_text: str = ""
    segment_id: Optional[str] = None
    template_id: Optional[str] = None
    scheduled_at: Optional[datetime] = None

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    segment_id: Optional[str] = None
    scheduled_at: Optional[datetime] = None

class CampaignOut(BaseModel):
    id: str
    name: str
    subject: str
    status: str  # DRAFT / SCHEDULED / SENDING / SENT / FAILED
    segment_id: Optional[str]
    total_recipients: int
    sent_count: int
    delivered_count: int
    opened_count: int
    clicked_count: int
    bounced_count: int
    unsubscribed_count: int
    scheduled_at: Optional[datetime]
    sent_at: Optional[datetime]
    created_at: datetime
    class Config:
        from_attributes = True

class CampaignStatsOut(BaseModel):
    total_campaigns: int
    total_subscribers: int
    avg_open_rate: float
    avg_click_rate: float
    avg_bounce_rate: float
    total_unsubscribes: int

class AutoReplyCreate(BaseModel):
    name: str
    trigger: str  # contact_form, newsletter_subscribe, project_brief
    channel: str  # email, whatsapp
    subject: str = ""
    body_template: str = ""
    is_active: bool = True
