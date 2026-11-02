"""Pydantic schemas for BIM Hub, issues, annotations, clashes."""
from datetime import datetime
from typing import Optional, List
# pyrefly: ignore [missing-import]
from pydantic import BaseModel


class BimModelCreate(BaseModel):
    project_id: str
    name: str
    description: str = ""
    file_format: str = ""  # RVT, DWG, IFC, SKP, PDF
    discipline: str = "architecture"

class BimModelOut(BaseModel):
    id: str
    project_id: str
    name: str
    description: str
    file_format: str
    discipline: str
    current_version: int
    aps_urn: Optional[str]
    status: str
    created_at: datetime
    class Config:
        from_attributes = True

class BimVersionCreate(BaseModel):
    file_url: str
    version_note: str = ""

class BimVersionOut(BaseModel):
    id: str
    model_id: str
    version_number: int
    file_url: str
    aps_urn: Optional[str]
    status: str
    version_note: str
    uploaded_by: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True

class BimIssueCreate(BaseModel):
    model_id: str
    version_id: Optional[str] = None
    title: str
    description: str = ""
    priority: str = "MEDIUM"
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None
    discipline: str = ""
    location_data: Optional[dict] = None

class BimIssueUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None
    resolution_note: Optional[str] = None

class BimIssueOut(BaseModel):
    id: str
    model_id: str
    version_id: Optional[str]
    title: str
    description: str
    priority: str
    status: str
    assigned_to: Optional[str]
    created_by: str
    due_date: Optional[datetime]
    discipline: str
    location_data: Optional[dict]
    resolution_note: str
    created_at: datetime
    resolved_at: Optional[datetime]
    class Config:
        from_attributes = True

class BimAnnotationCreate(BaseModel):
    model_id: str
    version_id: str
    annotation_type: str  # pin, text, measure, photo, capture, arrow, rectangle
    layer: str = "general"
    data: dict = {}
    content: str = ""

class BimAnnotationOut(BaseModel):
    id: str
    model_id: str
    version_id: str
    annotation_type: str
    layer: str
    data: dict
    content: str
    author_id: str
    created_at: datetime
    class Config:
        from_attributes = True

class BimClashCreate(BaseModel):
    model_id: str
    object_a_id: str
    object_a_discipline: str
    object_b_id: str
    object_b_discipline: str
    clash_type: str = "hard"  # hard, soft, clearance
    severity: str = "MEDIUM"
    location_data: Optional[dict] = None
    estimated_cost_avoided: float = 0.0

class BimClashOut(BaseModel):
    id: str
    model_id: str
    object_a_id: str
    object_a_discipline: str
    object_b_id: str
    object_b_discipline: str
    clash_type: str
    severity: str
    status: str
    location_data: Optional[dict]
    estimated_cost_avoided: float
    resolved_by: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]
    class Config:
        from_attributes = True

class BimViewpointCreate(BaseModel):
    model_id: str
    name: str
    description: str = ""
    camera_data: dict = {}
    layers_visible: List[str] = []
    is_default: bool = False

class DisciplineLayerOut(BaseModel):
    id: str
    project_id: str
    name: str
    code: str
    color: str
    is_visible: bool
    sort_order: int
    class Config:
        from_attributes = True
