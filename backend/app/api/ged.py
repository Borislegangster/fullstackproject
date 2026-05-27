"""GED API — Documents, Folders, Versioning, Signing, Material Choices."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.models import User
from app.auth.service import require_staff, get_current_user
from app.models.erp import GEDFolder, Document, MaterialChoice
from app.services.activity_service import log_activity

router = APIRouter(prefix="/ged", tags=["GED"])


class FolderCreate(BaseModel):
    project_id: str
    name: str
    parent_id: Optional[str] = None

class DocumentCreate(BaseModel):
    project_id: str
    folder_id: Optional[str] = None
    name: str
    file_url: str
    file_size: str = ""
    mime_type: str = ""
    category: str = "general"

class MaterialChoiceCreate(BaseModel):
    project_id: str
    category: str
    options: list = []


# ── Folders ──────────────────────────────────────────────────

@router.get("/folders/{project_id}")
async def list_folders(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(GEDFolder).where(GEDFolder.project_id == project_id))
    return [{"id": f.id, "name": f.name, "parent_id": f.parent_id, "created_at": f.created_at}
            for f in r.scalars().all()]

@router.post("/folders")
async def create_folder(data: FolderCreate, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    folder = GEDFolder(**data.model_dump())
    db.add(folder)
    await db.commit()
    return {"id": folder.id}


# ── Documents ────────────────────────────────────────────────

@router.get("/documents/{project_id}")
async def list_documents(
    project_id: str, category: Optional[str] = None,
    shared_only: bool = False,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    query = select(Document).where(Document.project_id == project_id, Document.deleted_at.is_(None))
    if category:
        query = query.where(Document.category == category)
    if shared_only or user.role == "CLIENT":
        query = query.where(Document.shared_with_client == True)
    query = query.order_by(Document.created_at.desc())
    r = await db.execute(query)
    return [
        {"id": d.id, "name": d.name, "file_url": d.file_url, "file_size": d.file_size,
         "mime_type": d.mime_type, "category": d.category, "version": d.version,
         "shared_with_client": d.shared_with_client, "uploaded_by": d.uploaded_by,
         "signed_at": d.signed_at, "created_at": d.created_at}
        for d in r.scalars().all()
    ]

@router.post("/documents")
async def upload_document(data: DocumentCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    doc = Document(**data.model_dump(), uploaded_by=user.id)
    db.add(doc)
    await log_activity(db, user.id, "DOCUMENT_UPLOADED", "document", doc.id,
                       new_value={"name": data.name, "category": data.category})
    await db.commit()
    return {"id": doc.id}

@router.patch("/documents/{doc_id}/share")
async def toggle_share(doc_id: str, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Document).where(Document.id == doc_id))
    doc = r.scalars().first()
    if not doc:
        raise HTTPException(404, "Document introuvable")
    doc.shared_with_client = not doc.shared_with_client
    doc.updated_at = datetime.utcnow()
    await log_activity(db, user.id, "DOCUMENT_SHARE_TOGGLED", "document", doc.id,
                       new_value={"shared_with_client": doc.shared_with_client})
    await db.commit()
    return {"shared_with_client": doc.shared_with_client}

@router.post("/documents/{doc_id}/version")
async def upload_new_version(doc_id: str, data: DocumentCreate, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Document).where(Document.id == doc_id))
    old = r.scalars().first()
    if not old:
        raise HTTPException(404, "Document introuvable")
    new_doc = Document(
        **data.model_dump(), uploaded_by=user.id,
        version=old.version + 1, parent_document_id=old.id,
        shared_with_client=old.shared_with_client,
    )
    db.add(new_doc)
    await db.commit()
    return {"id": new_doc.id, "version": new_doc.version}

@router.get("/documents/{doc_id}/versions")
async def get_versions(doc_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Get all versions in the chain
    r = await db.execute(select(Document).where(
        (Document.id == doc_id) | (Document.parent_document_id == doc_id)
    ).order_by(Document.version))
    return [{"id": d.id, "version": d.version, "file_url": d.file_url, "created_at": d.created_at}
            for d in r.scalars().all()]

@router.post("/documents/{doc_id}/sign-otp")
async def sign_document(doc_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Document).where(Document.id == doc_id))
    doc = r.scalars().first()
    if not doc:
        raise HTTPException(404, "Document introuvable")
    doc.signed_at = datetime.utcnow()
    doc.signed_by = user.id
    doc.updated_at = datetime.utcnow()
    await log_activity(db, user.id, "DOCUMENT_SIGNED", "document", doc.id)
    await db.commit()
    return {"detail": "Document signé"}


# ── Material Choices ─────────────────────────────────────────

@router.post("/material-choices")
async def create_material_choice(data: MaterialChoiceCreate, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    mc = MaterialChoice(**data.model_dump())
    db.add(mc)
    await db.commit()
    return {"id": mc.id}

@router.get("/material-choices/{project_id}")
async def list_material_choices(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(MaterialChoice).where(MaterialChoice.project_id == project_id))
    return [
        {"id": m.id, "category": m.category, "options": m.options,
         "selected": m.selected, "selected_at": m.selected_at}
        for m in r.scalars().all()
    ]

@router.patch("/material-choices/{choice_id}/select")
async def select_material(choice_id: str, selection: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(MaterialChoice).where(MaterialChoice.id == choice_id))
    mc = r.scalars().first()
    if not mc:
        raise HTTPException(404, "Choix introuvable")
    mc.selected = selection
    mc.selected_by = user.id
    mc.selected_at = datetime.utcnow()
    mc.updated_at = datetime.utcnow()
    await db.commit()
    return {"detail": "Choix enregistré"}
