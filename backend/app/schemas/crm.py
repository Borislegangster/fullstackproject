"""CRM / Lead management schemas."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class LeadCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str = ""
    company: str = ""
    project_type: str = ""
    message: str = ""
    location: str = ""
    source: str = "website"


class LeadUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    project_type: Optional[str] = None
    message: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    pipeline_notes: Optional[str] = None
    quote_amount: Optional[float] = None
    assigned_to: Optional[str] = None


class LeadOut(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: str
    phone: str
    company: str
    project_type: str
    message: str
    location: str
    status: str
    pipeline_notes: str
    quote_amount: Optional[float]
    assigned_to: Optional[str]
    source: str
    converted_project_id: Optional[str]
    converted_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class ConvertLeadRequest(BaseModel):
    project_name: str
    project_type: str = ""
    template_id: Optional[str] = None
    chef_projet_id: Optional[str] = None
