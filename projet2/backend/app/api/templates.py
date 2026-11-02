"""Document templates — Generate recurring documents from templates."""
from typing import Optional
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import require_admin, require_staff
from app.database import get_db
from app.models.erp import DocumentTemplate, GeneratedDocument
from app.services.activity_service import log_activity
from app.services.pdf_service import render_pdf

UPLOAD_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
GENERATED_DIR = os.path.join(UPLOAD_ROOT, "generated")
os.makedirs(GENERATED_DIR, exist_ok=True)

router = APIRouter(prefix="/templates", tags=["Document Templates"])


from app.utils.time import utcnow_naive as _now


class TemplateCreate(BaseModel):
    name: str
    description: str = ""
    category: str = "general"
    icon_key: str = "FileTextIcon"
    template_body: str = ""
    placeholders: list = []


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    icon_key: Optional[str] = None
    template_body: Optional[str] = None
    placeholders: Optional[list] = None
    is_active: Optional[bool] = None


class GenerateRequest(BaseModel):
    payload: dict
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    name: Optional[str] = None


# ── Templates CRUD ───────────────────────────────────────────

@router.get("")
async def list_templates(
    category: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    q = select(DocumentTemplate).where(DocumentTemplate.is_active == True).order_by(DocumentTemplate.name)  # noqa: E712
    if category:
        q = q.where(DocumentTemplate.category == category)
    r = await db.execute(q)
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "category": t.category,
            "icon_key": t.icon_key,
            "placeholders": t.placeholders or [],
            "generated_count": t.generated_count,
            "is_active": t.is_active,
        }
        for t in r.scalars().all()
    ]


@router.get("/{template_id}")
async def get_template(
    template_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(DocumentTemplate).where(DocumentTemplate.id == template_id))
    t = r.scalars().first()
    if not t:
        raise HTTPException(404, "Modèle introuvable")
    return {
        "id": t.id, "name": t.name, "description": t.description,
        "category": t.category, "icon_key": t.icon_key,
        "template_body": t.template_body, "placeholders": t.placeholders or [],
        "generated_count": t.generated_count, "is_active": t.is_active,
    }


@router.post("")
async def create_template(
    data: TemplateCreate,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    t = DocumentTemplate(**data.model_dump())
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return {"id": t.id}


@router.patch("/{template_id}")
async def update_template(
    template_id: str,
    data: TemplateUpdate,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(DocumentTemplate).where(DocumentTemplate.id == template_id))
    t = r.scalars().first()
    if not t:
        raise HTTPException(404, "Modèle introuvable")
    updates = data.model_dump(exclude_unset=True)
    for k, v in updates.items():
        if v is not None:
            setattr(t, k, v)
    t.updated_at = _now()
    await db.commit()
    return {"detail": "Modèle mis à jour"}


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(DocumentTemplate).where(DocumentTemplate.id == template_id))
    t = r.scalars().first()
    if not t:
        raise HTTPException(404, "Modèle introuvable")
    t.is_active = False
    t.updated_at = _now()
    await db.commit()
    return {"detail": "Modèle désactivé"}


# ── Generation ───────────────────────────────────────────────

@router.post("/{template_id}/generate")
async def generate_document(
    template_id: str,
    data: GenerateRequest,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Render the template into a real PDF and persist it under /uploads/generated/.

    The template body is treated as Jinja2 HTML — placeholders in `data.payload`
    get substituted, the result is wrapped in the base layout, then converted to
    PDF via xhtml2pdf. The resulting file URL is publicly downloadable through
    the regular `/uploads` static mount.
    """
    r = await db.execute(select(DocumentTemplate).where(DocumentTemplate.id == template_id))
    t = r.scalars().first()
    if not t or not t.is_active:
        raise HTTPException(404, "Modèle introuvable ou inactif")

    name = data.name or f"{t.name} — {_now().strftime('%Y-%m-%d %H:%M')}"

    # Render the user-defined body as Jinja2, then drop it into the generic shell.
    from jinja2 import Environment, BaseLoader, select_autoescape
    body_env = Environment(loader=BaseLoader(), autoescape=select_autoescape(["html", "xml"]))
    try:
        rendered_body = body_env.from_string(t.template_body or "").render(**(data.payload or {}))
    except Exception as exc:
        raise HTTPException(400, f"Échec rendu modèle : {exc}")

    pdf_bytes = render_pdf(
        "generic.html",
        {
            "document": {
                "title": name,
                "subtitle": t.description,
                "body": rendered_body,
                "metadata": data.payload if isinstance(data.payload, dict) else {},
                "signature_required": (t.category or "").lower() in {"contrat", "attestation", "paie"},
            },
            "generated_at": _now(),
        },
    )

    # Persist on disk so the file URL keeps working.
    filename = f"{template_id}-{uuid.uuid4().hex[:10]}.pdf"
    out_path = os.path.join(GENERATED_DIR, filename)
    with open(out_path, "wb") as fh:
        fh.write(pdf_bytes)
    file_url = f"/uploads/generated/{filename}"

    doc = GeneratedDocument(
        template_id=template_id,
        name=name,
        category=t.category,
        target_type=data.target_type or "",
        target_id=data.target_id,
        file_url=file_url,
        payload=data.payload,
        generated_by=user.id,
    )
    db.add(doc)
    t.generated_count = (t.generated_count or 0) + 1
    await log_activity(db, user.id, "DOCUMENT_GENERATED", "generated_document",
                        new_value={"template": t.name})
    await db.commit()
    await db.refresh(doc)
    return {"id": doc.id, "file_url": doc.file_url, "name": doc.name}


@router.get("/{template_id}/preview-pdf")
async def preview_template_pdf(
    template_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Stream a sample PDF using placeholder values — handy for the admin editor."""
    r = await db.execute(select(DocumentTemplate).where(DocumentTemplate.id == template_id))
    t = r.scalars().first()
    if not t:
        raise HTTPException(404, "Modèle introuvable")
    sample = {p.get("key", f"field_{i}"): p.get("label") or "[exemple]"
              for i, p in enumerate(t.placeholders or [])}
    from jinja2 import Environment, BaseLoader, select_autoescape
    body_env = Environment(loader=BaseLoader(), autoescape=select_autoescape(["html", "xml"]))
    rendered_body = body_env.from_string(t.template_body or "").render(**sample)
    pdf_bytes = render_pdf(
        "generic.html",
        {
            "document": {
                "title": f"Aperçu — {t.name}",
                "subtitle": t.description,
                "body": rendered_body,
                "metadata": sample,
            },
            "generated_at": _now(),
        },
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="apercu-{t.name}.pdf"'},
    )


# ── Generated documents listing ──────────────────────────────

@router.get("/generated/list")
async def list_generated(
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    category: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    q = select(GeneratedDocument).order_by(GeneratedDocument.created_at.desc())
    if target_type:
        q = q.where(GeneratedDocument.target_type == target_type)
    if target_id:
        q = q.where(GeneratedDocument.target_id == target_id)
    if category:
        q = q.where(GeneratedDocument.category == category)
    r = await db.execute(q)
    return [
        {
            "id": d.id,
            "template_id": d.template_id,
            "name": d.name,
            "category": d.category,
            "target_type": d.target_type,
            "target_id": d.target_id,
            "file_url": d.file_url,
            "created_at": d.created_at,
        }
        for d in r.scalars().all()
    ]
