"""GED API — Documents, Folders, Versioning, Signing, Material Choices."""
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.models import User
from app.auth.service import require_staff, get_current_user
from app.models.erp import GEDFolder, Document, MaterialChoice, Project
from app.services.activity_service import log_activity

router = APIRouter(prefix="/ged", tags=["GED"])


from app.utils.time import utcnow_naive as _now


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


class MaterialSelect(BaseModel):
    selection: str


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
         "version_note": d.version_note,
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
    doc.updated_at = _now()
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

async def _store_upload_secure(file: UploadFile, content: bytes, prefix: str = "ged") -> tuple[str, str, str]:
    """Validate + persist bytes to S3/R2 (or local) via the shared storage helper."""
    from app.api.admin_media import _validate_upload
    from app.services.storage_service import store_upload

    content = _validate_upload(file, content)
    url, size_str, storage_key = await store_upload(
        content, file.filename or "file",
        file.content_type or "application/octet-stream",
        prefix, public=False,
    )
    # Private cloud uploads have no direct URL yet — the caller overrides file_url
    # with the per-document secure download route once the row id exists.
    if not url:
        url = f"/api/v1/ged/documents/download?storage_key={storage_key}"
    return url, size_str, storage_key


@router.post("/documents/upload")
async def upload_document_binary(
    file: UploadFile = File(...),
    project_id: str = Form(...),
    name: str = Form(""),
    category: str = Form("general"),
    note: str = Form(""),
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Upload a *real* binary document (plan/PDF/…) and create its row."""
    content = await file.read()
    url, size_str, storage_key = await _store_upload_secure(file, content)
    doc = Document(
        project_id=project_id, name=name or file.filename or "Document",
        file_url=url, storage_key=storage_key, file_size=size_str, mime_type=file.content_type or "",
        category=category, version_note=note, uploaded_by=user.id,
    )
    db.add(doc)
    await log_activity(db, user.id, "DOCUMENT_UPLOADED", "document", doc.id,
                       new_value={"name": doc.name, "category": category})
    await db.commit()
    await db.refresh(doc)
    # Update url to point to the secure download endpoint if we have an ID
    doc.file_url = f"/api/v1/ged/documents/{doc.id}/download"
    await db.commit()
    
    return {"id": doc.id, "name": doc.name, "file_url": doc.file_url, "version": doc.version}


@router.post("/documents/{doc_id}/version-upload")
async def upload_new_version_binary(
    doc_id: str,
    file: UploadFile = File(...),
    note: str = Form(""),
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Upload a *real* binary as a new version of an existing document."""
    r = await db.execute(select(Document).where(Document.id == doc_id))
    old = r.scalars().first()
    if not old:
        raise HTTPException(404, "Document introuvable")
    content = await file.read()
    url, size_str, storage_key = await _store_upload_secure(file, content)
    new_doc = Document(
        project_id=old.project_id, folder_id=old.folder_id,
        name=old.name, file_url=url, storage_key=storage_key, file_size=size_str,
        mime_type=file.content_type or "", category=old.category,
        version_note=note, uploaded_by=user.id, version=old.version + 1,
        parent_document_id=old.id, shared_with_client=old.shared_with_client,
    )
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)
    new_doc.file_url = f"/api/v1/ged/documents/{new_doc.id}/download"
    await db.commit()
    return {"id": new_doc.id, "version": new_doc.version, "file_url": new_doc.file_url}


from fastapi.responses import RedirectResponse

@router.get("/documents/{doc_id}/download")
async def download_document(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a secure presigned URL for downloading a document."""
    from app.services.storage_service import get_storage_service

    r = await db.execute(select(Document).where(Document.id == doc_id))
    doc = r.scalars().first()
    if not doc or doc.deleted_at:
        raise HTTPException(404, "Document introuvable")

    # Access check: a client may only download documents shared with them AND
    # belonging to one of their own projects (guards against IDOR by doc id).
    if user.role == "CLIENT":
        if not doc.shared_with_client:
            raise HTTPException(403, "Accès refusé au document")
        owns = await db.execute(
            select(Project.id).where(Project.id == doc.project_id, Project.client_id == user.id)
        )
        if not owns.scalars().first():
            raise HTTPException(403, "Accès refusé au document")

    storage = get_storage_service()
    if doc.storage_key and storage.use_cloud:
        # Cloud: hand back a short-lived presigned URL.
        url = await storage.generate_presigned_url(doc.storage_key)
        return RedirectResponse(url, status_code=307)

    # Local fallback: old rows keep the /uploads/ path directly in file_url;
    # newer rows store only the storage_key (file lives at /uploads/<basename>).
    if doc.file_url and doc.file_url.startswith("/uploads/"):
        return RedirectResponse(doc.file_url, status_code=307)
    if doc.storage_key:
        import os as _os
        return RedirectResponse(f"/uploads/{_os.path.basename(doc.storage_key)}", status_code=307)

    raise HTTPException(404, "Fichier non trouvé")


@router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a document."""
    r = await db.execute(select(Document).where(Document.id == doc_id))
    doc = r.scalars().first()
    if not doc:
        raise HTTPException(404, "Document introuvable")
    doc.deleted_at = _now()
    await log_activity(db, user.id, "DOCUMENT_DELETED", "document", doc.id,
                       new_value={"name": doc.name})
    await db.commit()
    return {"detail": "Document supprimé"}


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
    doc.signed_at = _now()
    doc.signed_by = user.id
    doc.updated_at = _now()
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
async def select_material(
    choice_id: str,
    data: MaterialSelect = None,
    selection: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Select a material. Accepts JSON body or query param for backward compat."""
    final_selection = (data.selection if data else None) or selection
    if not final_selection:
        raise HTTPException(400, "selection requis")
    r = await db.execute(select(MaterialChoice).where(MaterialChoice.id == choice_id))
    mc = r.scalars().first()
    if not mc:
        raise HTTPException(404, "Choix introuvable")
    mc.selected = final_selection
    mc.selected_by = user.id
    mc.selected_at = _now()
    mc.updated_at = _now()
    await db.commit()
    return {"detail": "Choix enregistré"}
