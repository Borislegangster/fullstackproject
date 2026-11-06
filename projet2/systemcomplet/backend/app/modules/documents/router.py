"""API GED : dossiers, documents, versions, workflow, approbations, signatures OTP, téléchargement
filigrané, comparaison, recherche, liens, journal d'accès, vérification publique d'authenticité (QR)."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import Text, cast, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.context import get_context
from app.core.crud import make_crud_router, serialize
from app.core.database import get_db
from app.core.downloads import file_response, signed_url, watermark_label
from app.core.errors import AppError, BusinessRuleError, Conflict, Forbidden, NotFound
from app.core.files import validate_upload
from app.core.middleware import client_ip
from app.core.pagination import PageParams, paginate
from app.core.ratelimit import rate_limit
from app.core.utils import jsonable
from app.modules.documents import deliverables, service
from app.modules.documents.models import (
    Document,
    DocumentAccessLog,
    DocumentApprovalStep,
    DocumentLink,
    DocumentPermission,
    DocumentVersion,
    Folder,
    Signature,
)
from app.modules.system.models import StoredFile

router = APIRouter(tags=["GED"])
public = APIRouter(prefix="/public", tags=["Vérification (public)"])


def _version_out(v: DocumentVersion) -> dict[str, Any]:
    data = serialize(v)
    data.pop("extracted_text", None)
    data["label"] = v.label
    return jsonable(data)


def _place(db: Session, doc: Document) -> dict[str, Any]:
    """Où se trouve le document : projet (code + nom) et chemin du dossier."""
    from app.modules.projects.models import Project

    project = db.get(Project, doc.project_id) if doc.project_id else None
    folder = db.get(Folder, doc.folder_id) if doc.folder_id else None
    return {
        "project": {"id": project.id, "code": project.code, "name": project.name} if project else None,
        "folder_path": folder.path if folder else None,
    }


def _doc_out(db: Session, doc: Document, *, versions: bool = False) -> dict[str, Any]:
    data = serialize(doc)
    current = db.get(DocumentVersion, doc.current_version_id) if doc.current_version_id else None
    published = db.get(DocumentVersion, doc.published_version_id) if doc.published_version_id else None
    data["current_version"] = _version_out(current) if current else None
    data["published_version"] = _version_out(published) if published else None
    data["deliverable"] = deliverables.state(db, doc)
    data.update(_place(db, doc))
    if versions:
        data["versions"] = [
            _version_out(v)
            for v in sorted(doc.versions, key=lambda x: (x.version_major, x.version_minor), reverse=True)
        ]
    return jsonable(data)


@router.get("/documents")
def list_documents(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    folder_id: uuid.UUID | None = None,
    doc_type: str | None = None,
    discipline: str | None = None,
    status: str | None = None,
    client_visible: bool | None = None,
    recursive: bool = False,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    """`recursive` : documents du dossier et de tous ses sous-dossiers (explorateur GED)."""
    stmt = select(Document).where(Document.deleted_at.is_(None))
    if not access.p.is_internal:
        stmt = access.filter_by_project(stmt, Document.project_id, allow_null=False)
    elif access.project_scope() is not None:
        stmt = access.filter_by_project(stmt, Document.project_id)
    if folder_id is not None and recursive:
        stmt = stmt.where(Document.folder_id.in_(service.subtree_ids(db, folder_id)))
        folder_id = None
    for col, value in (
        (Document.project_id, project_id),
        (Document.folder_id, folder_id),
        (Document.doc_type, doc_type),
        (Document.discipline, discipline),
        (Document.client_visible, client_visible),
    ):
        if value is not None:
            stmt = stmt.where(col == value)
    stmt = stmt.where(
        Document.confidentiality.in_(access.allowed_confidentialities())
        if access.p.is_internal
        else Document.confidentiality.in_(["public", "internal", "confidential", "very_sensitive"])
    )
    if status:
        stmt = stmt.join(DocumentVersion, DocumentVersion.id == Document.current_version_id).where(
            DocumentVersion.status == status
        )
    result = paginate(
        db,
        stmt,
        params,
        sort_fields={"title": Document.title, "updated_at": Document.updated_at, "code": Document.code},
        default_sort=Document.updated_at.desc(),
        search_columns=[Document.title, Document.code, cast(Document.tags, Text)],
    )
    result["items"] = [_doc_out(db, d) for d in result["items"] if service.can_read(access, db, d)]
    return result


@router.post("/documents", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    doc_type: str = Form("autre"),
    project_id: uuid.UUID | None = Form(None),
    site_id: uuid.UUID | None = Form(None),
    lot_id: uuid.UUID | None = Form(None),
    folder_id: uuid.UUID | None = Form(None),
    discipline: str | None = Form(None),
    confidentiality: str = Form("internal"),
    description: str | None = Form(None),
    tags: str = Form(""),
    code: str | None = Form(None),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    if confidentiality not in ("public", "internal", "confidential", "very_sensitive"):
        raise BusinessRuleError("Niveau de confidentialité invalide")
    upload = validate_upload(file.filename or "document", await file.read(), category="any", allow_bim=True)
    document, _ = service.create_document(
        db,
        access=access,
        upload=upload,
        title=title,
        doc_type=doc_type,
        project_id=project_id,
        site_id=site_id,
        lot_id=lot_id,
        folder_id=folder_id,
        discipline=discipline,
        confidentiality=confidentiality,
        description=description,
        tags=list(dict.fromkeys(t.strip()[:100] for t in tags.split(",") if t.strip()))[:30],
        code=code,
        reject_duplicates=True,
    )
    db.commit()
    return _doc_out(db, document, versions=True)


class DuplicateCheckIn(BaseModel):
    project_id: uuid.UUID | None = None
    checksums: list[str] = Field(default_factory=list, max_length=2000)


@router.post("/documents/check-duplicates")
def check_duplicates(
    data: DuplicateCheckIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    """Avant un import multiple : quels fichiers (empreinte SHA-256) sont déjà dans la GED de ce projet ?"""
    access.require("documents:write")
    if data.project_id:
        access.require_project(data.project_id)
    wanted = [c.lower() for c in data.checksums if len(c) == 64]
    found = service.find_duplicates(db, wanted, data.project_id)
    return jsonable(
        [
            {"checksum": checksum, "document_id": doc.id, "code": doc.code, "where": service.describe(db, doc)}
            for checksum, doc in found.items()
            if service.can_read(access, db, doc)
        ]
    )


class BulkTransitionIn(BaseModel):
    document_ids: list[uuid.UUID] = Field(min_length=1, max_length=200)
    target: str = Field(pattern="^(in_review|validated|published|archived)$")
    comment: str | None = Field(default=None, max_length=2000)


@router.post("/documents/bulk-transition")
def bulk_transition(
    data: BulkTransitionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Soumettre en revue / valider / publier / archiver plusieurs documents en une fois (version courante)."""
    result = service.bulk_transition(
        db, access=access, document_ids=data.document_ids, target=data.target, comment=data.comment
    )
    db.commit()
    return result


class BulkUpdateIn(BaseModel):
    document_ids: list[uuid.UUID] = Field(min_length=1, max_length=500)
    doc_type: str | None = Field(default=None, max_length=30)
    discipline: str | None = Field(default=None, max_length=40)
    confidentiality: str | None = Field(default=None, pattern="^(public|internal|confidential|very_sensitive)$")
    folder_id: uuid.UUID | None = None
    client_visible: bool | None = None
    partner_visible: bool | None = None
    paid_deliverable: bool | None = None
    add_tags: list[str] = Field(default_factory=list, max_length=30)


@router.post("/documents/bulk-update")
def bulk_update(
    data: BulkUpdateIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Mêmes propriétés sur plusieurs documents : visibles par le client / les partenaires, livrable d'études payant,
    type, discipline, confidentialité, dossier, mots-clés ajoutés. Seuls les champs envoyés sont modifiés."""
    values = data.model_dump(exclude_unset=True, exclude={"document_ids", "add_tags"})
    for key in ("doc_type", "confidentiality", "client_visible", "partner_visible", "paid_deliverable"):
        if key in values and values[key] is None:
            values.pop(key)  # champ obligatoire : « non renseigné » = inchangé
    result = service.bulk_update(
        db, access=access, document_ids=data.document_ids, values=values, add_tags=data.add_tags
    )
    db.commit()
    return result


class BulkSignOtpIn(BaseModel):
    document_ids: list[uuid.UUID] = Field(min_length=1, max_length=500)
    channel: str = Field(default="email", pattern="^(email|sms|whatsapp)$")


@router.post("/documents/bulk-sign/otp")
def bulk_sign_otp(
    data: BulkSignOtpIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Un seul code pour signer toute la sélection : il ne vaut que pour les versions listées (empreinte)."""
    from app.modules.identity.models import User
    from app.modules.identity.service import issue_otp

    access.require("documents:read")
    eligible, skipped = service.sign_selection(db, access=access, user_id=access.p.id, document_ids=data.document_ids)
    if not eligible:
        raise BusinessRuleError(
            "Aucun document de la sélection n'est à signer (version validée ou publiée requise, ou déjà signée)",
            code="NOTHING_TO_SIGN",
            details={"skipped": skipped},
        )
    count = len(eligible)
    result = issue_otp(
        db,
        db.get(User, access.p.id),
        purpose="otp_sign_bulk",
        channel=data.channel,
        payload={
            "selection": service.selection_digest(eligible),
            "count": count,
            "label": f"signature de {count} document{'s' if count > 1 else ''} de la GED",
        },
    )
    db.commit()
    return jsonable(
        {
            **result,
            "eligible": [
                {"document_id": d.id, "code": d.code, "title": d.title, "version": v.label} for d, v in eligible
            ],
            "skipped": skipped,
        }
    )


class BulkSignIn(BaseModel):
    document_ids: list[uuid.UUID] = Field(min_length=1, max_length=500)
    otp_token: str = Field(max_length=100)
    code: str = Field(min_length=6, max_length=6)
    role: str | None = Field(default=None, max_length=60)
    consent: bool


@router.post("/documents/bulk-sign")
def bulk_sign(
    data: BulkSignIn,
    request: Request,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
    _: None = Depends(rate_limit("sign-bulk", "20/hour")),
) -> dict[str, Any]:
    """Signe la version validée ou publiée de chaque document de la sélection, avec le code reçu."""
    from app.modules.identity.models import User
    from app.modules.identity.service import verify_otp

    if not data.consent:
        raise BusinessRuleError("Le consentement à la signature électronique est requis")
    user = db.get(User, access.p.id)
    otp = verify_otp(db, user, purpose="otp_sign_bulk", otp_token=data.otp_token, code=data.code)
    eligible, skipped = service.sign_selection(db, access=access, user_id=user.id, document_ids=data.document_ids)
    if not eligible or otp["payload"].get("selection") != service.selection_digest(eligible):
        raise BusinessRuleError(
            "La sélection a changé depuis l'envoi du code : demandez un nouveau code", code="SELECTION_CHANGED"
        )
    done: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for document, version in eligible:
        try:
            with db.begin_nested():
                signature = service.sign_version(
                    db,
                    user=user,
                    document=document,
                    version=version,
                    otp=otp,
                    ip=client_ip(request.scope),
                    user_agent=request.headers.get("user-agent"),
                    role=data.role,
                )
            done.append(
                {"document_id": document.id, "code": document.code, "version": version.label, "id": signature.id}
            )
        except AppError as exc:
            errors.append({"document_id": document.id, "code": document.code, "message": exc.message})
    db.commit()
    return jsonable({"done": done, "errors": errors, "skipped": skipped})


@router.get("/documents/search")
def search_documents(
    q: str = Query(..., min_length=2, max_length=200),
    project_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    access.require("documents:read")
    return jsonable(service.search(db, access, q, project_id=project_id))


@router.get("/documents/{document_id}")
def get_document(
    document_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    document = service.get_document(db, document_id)
    service.require_read(access, db, document)
    data = _doc_out(db, document, versions=access.p.is_internal)
    if not access.p.is_internal:
        data["versions"] = [data["published_version"]] if data.get("published_version") else []
    data["links"] = jsonable(
        [
            serialize(link)
            for link in db.execute(select(DocumentLink).where(DocumentLink.document_id == document.id)).scalars()
        ]
    )
    if access.p.is_internal and access.has("documents:approve"):
        data["permissions"] = jsonable(
            [
                serialize(perm)
                for perm in db.execute(
                    select(DocumentPermission)
                    .where(DocumentPermission.document_id == document.id)
                    .order_by(DocumentPermission.created_at)
                ).scalars()
            ]
        )
    return data


class DocumentPatch(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    description: str | None = None
    doc_type: str | None = None
    discipline: str | None = None
    folder_id: uuid.UUID | None = None
    confidentiality: str | None = Field(default=None, pattern="^(public|internal|confidential|very_sensitive)$")
    client_visible: bool | None = None
    partner_visible: bool | None = None
    tags: list[str] | None = None
    retention_until: date | None = None
    paid_deliverable: bool | None = None
    unlock_invoice_id: uuid.UUID | None = None


@router.patch("/documents/{document_id}")
def update_document(
    document_id: uuid.UUID, data: DocumentPatch, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    document = service.get_document(db, document_id)
    if service.update_document(db, access=access, document=document, values=data.model_dump(exclude_unset=True)):
        service.notify_client_published(db, [document])
    db.commit()
    return _doc_out(db, document, versions=True)


@router.post("/documents/{document_id}/versions", status_code=201)
async def add_version(
    document_id: uuid.UUID,
    file: UploadFile = File(...),
    reason: str = Form(...),
    major: bool = Form(False),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    document = service.get_document(db, document_id)
    upload = validate_upload(file.filename or "document", await file.read(), category="any", allow_bim=True)
    version = service.new_version(db, access=access, document=document, upload=upload, reason=reason, major=major)
    db.commit()
    return _version_out(version)


class TransitionIn(BaseModel):
    target: str = Field(pattern="^(draft|in_review|correction|validated|published|obsolete|archived)$")
    comment: str | None = Field(default=None, max_length=2000)
    approvers: list[dict[str, Any]] = Field(default_factory=list, max_length=10)


@router.post("/document-versions/{version_id}/transition")
def transition(
    version_id: uuid.UUID, data: TransitionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    version = db.get(DocumentVersion, version_id)
    if version is None:
        raise NotFound("Version introuvable")
    service.transition_version(
        db, access=access, version=version, target=data.target, comment=data.comment, approvers=data.approvers
    )
    db.commit()
    return _version_out(version)


@router.get("/document-versions/{version_id}/approvals")
def approvals(
    version_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    version = db.get(DocumentVersion, version_id)
    if version is None:
        raise NotFound("Version introuvable")
    service.require_read(access, db, service.get_document(db, version.document_id))
    rows = (
        db.execute(
            select(DocumentApprovalStep)
            .where(DocumentApprovalStep.version_id == version_id)
            .order_by(DocumentApprovalStep.step_order)
        )
        .scalars()
        .all()
    )
    sigs = db.execute(select(Signature).where(Signature.version_id == version_id)).scalars().all()
    return jsonable(
        [{**serialize(r), "type": "approval"} for r in rows] + [{**serialize(s), "type": "signature"} for s in sigs]
    )


def _download(db: Session, access: Access, version: DocumentVersion, *, action: str) -> Response:
    document = service.get_document(db, version.document_id)
    service.require_read(access, db, document)
    if not access.p.is_internal and version.id != document.published_version_id:
        raise NotFound("Version introuvable")
    if not access.p.is_internal and deliverables.is_locked(db, document):
        raise Forbidden("Livrable remis après règlement de la facture d'études", code="DELIVERABLE_LOCKED")
    stored = db.get(StoredFile, version.file_id)
    watermark = (
        watermark_label(access.p.user)
        if document.confidentiality in ("confidential", "very_sensitive") or not access.p.is_internal
        else None
    )
    service.log_access(
        db,
        document=document,
        version=version,
        user_id=access.p.id,
        action=action,
        application=get_context().application,
        watermarked=bool(watermark and version.mime_type == "application/pdf"),
    )
    db.commit()
    response = file_response(stored, inline=action == "view", watermark_text=watermark)
    response.headers["X-Document-Status"] = version.status
    if version.status == "obsolete":
        response.headers["X-Document-Obsolete"] = "true"
        superseded = db.get(DocumentVersion, version.superseded_by_id) if version.superseded_by_id else None
        response.headers["X-Document-Latest"] = superseded.label if superseded else ""
    return response


@router.get("/document-versions/{version_id}/download")
def download(
    version_id: uuid.UUID, inline: bool = False, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    version = db.get(DocumentVersion, version_id)
    if version is None:
        raise NotFound("Version introuvable")
    return _download(db, access, version, action="view" if inline else "download")


@router.get("/document-versions/{version_id}/status")
def version_status(
    version_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Contrôle « plan périmé » (mobile hors ligne) : la version détenue est-elle encore la bonne ?"""
    version = db.get(DocumentVersion, version_id)
    if version is None:
        raise NotFound("Version introuvable")
    document = service.get_document(db, version.document_id)
    service.require_read(access, db, document)
    latest = db.get(DocumentVersion, document.published_version_id) if document.published_version_id else None
    return jsonable(
        {
            "version": version.label,
            "status": version.status,
            "is_obsolete": version.status == "obsolete"
            or (latest is not None and latest.id != version.id and version.status == "published"),
            "latest_version_id": latest.id if latest else None,
            "latest_label": latest.label if latest else None,
        }
    )


@router.get("/document-versions/{version_id}/signed-url")
def version_signed_url(
    version_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, str]:
    version = db.get(DocumentVersion, version_id)
    if version is None:
        raise NotFound("Version introuvable")
    document = service.get_document(db, version.document_id)
    service.require_read(access, db, document)
    service.log_access(
        db,
        document=document,
        version=version,
        user_id=access.p.id,
        action="view",
        application=get_context().application,
        watermarked=False,
    )
    db.commit()
    if not access.p.is_internal and deliverables.is_locked(db, document):
        label = deliverables.preview_label(db, document, access.p.user)
        return {"url": signed_url(version.file_id, user_id=access.p.id, ttl=900, watermark_text=label, preview=True)}
    wm = watermark_label(access.p.user) if document.confidentiality in ("confidential", "very_sensitive") else None
    return {"url": signed_url(version.file_id, user_id=access.p.id, ttl=900, watermark_text=wm)}


# ---------------------------------------------------------------------------- livrables d'études
@router.get("/projects/{project_id}/deliverables")
def project_deliverables(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Livrables d'études du projet : validation client, facture liée, verrouillage, remise."""
    from app.modules.billing.models import ClientInvoice
    from app.modules.projects.models import Decision

    access.require("documents:read")
    access.require_project(project_id)
    docs = (
        db.execute(
            select(Document)
            .where(
                Document.project_id == project_id, Document.paid_deliverable.is_(True), Document.deleted_at.is_(None)
            )
            .order_by(Document.doc_type, Document.title)
        )
        .scalars()
        .all()
    )
    items = []
    for doc in docs:
        version_ids = [v.id for v in doc.versions]
        decision = (
            db.execute(
                select(Decision)
                .where(Decision.reference_type == "document_version", Decision.reference_id.in_(version_ids))
                .order_by(Decision.created_at.desc())
            )
            .scalars()
            .first()
            if version_ids
            else None
        )
        out = _doc_out(db, doc)
        out["client_decision"] = (
            {
                "id": decision.id,
                "number": decision.number,
                "status": decision.status,
                "validated_at": decision.validated_at,
            }
            if decision
            else None
        )
        items.append(out)
    invoices = db.execute(
        select(ClientInvoice)
        .where(ClientInvoice.project_id == project_id, ClientInvoice.deleted_at.is_(None))
        .order_by(ClientInvoice.created_at.desc())
    ).scalars()
    return jsonable(
        {
            "items": items,
            "validated": sum(1 for i in items if (i["client_decision"] or {}).get("status") == "validated"),
            "invoices": [
                {"id": i.id, "number": i.number, "title": i.title, "kind": i.kind, "status": i.status, "total": i.total}
                for i in invoices
                if i.status not in ("cancelled", "credited")
            ],
        }
    )


class LinkInvoiceIn(BaseModel):
    invoice_id: uuid.UUID
    document_ids: list[uuid.UUID] = Field(default_factory=list, max_length=500)


@router.post("/projects/{project_id}/deliverables/link-invoice")
def link_deliverables_invoice(
    project_id: uuid.UUID, data: LinkInvoiceIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Rattacher les livrables d'études (tous ceux sans facture, ou la sélection) à la facture d'études."""
    access.require("documents:write")
    access.require("billing:read")
    access.require_project(project_id)
    count = deliverables.link_invoice(
        db, project_id=project_id, invoice_id=data.invoice_id, user_id=access.p.id, document_ids=data.document_ids
    )
    db.commit()
    return {"linked": count}


@router.get("/documents/{document_id}/compare")
def compare(
    document_id: uuid.UUID,
    v1: uuid.UUID,
    v2: uuid.UUID,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    document = service.get_document(db, document_id)
    service.require_read(access, db, document)
    access.require("documents:read")
    a, b = db.get(DocumentVersion, v1), db.get(DocumentVersion, v2)
    if not a or not b or a.document_id != document.id or b.document_id != document.id:
        raise NotFound("Versions introuvables")
    return jsonable(service.compare(db, a, b))


class DeleteIn(BaseModel):
    reason: str = Field(min_length=10, max_length=2000)


@router.post("/documents/{document_id}/delete")
def delete_document(
    document_id: uuid.UUID, data: DeleteIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, str]:
    service.soft_delete(db, access=access, document=service.get_document(db, document_id), reason=data.reason)
    db.commit()
    return {"status": "deleted"}


@router.get("/documents/{document_id}/access-log")
def access_log(
    document_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    document = service.get_document(db, document_id)
    service.require_read(access, db, document)
    access.require("documents:approve")
    rows = (
        db.execute(
            select(DocumentAccessLog)
            .where(DocumentAccessLog.document_id == document_id)
            .order_by(DocumentAccessLog.created_at.desc())
            .limit(500)
        )
        .scalars()
        .all()
    )
    return jsonable([serialize(r) for r in rows])


class PermissionIn(BaseModel):
    principal_type: str = Field(pattern="^(user|role|organization)$")
    principal_value: str = Field(max_length=120)
    permission: str = Field(pattern="^(read|write|approve|sign|deny)$")


@router.post("/documents/{document_id}/permissions", status_code=201)
def add_permission(
    document_id: uuid.UUID, data: PermissionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    document = service.get_document(db, document_id)
    service.require_write(access, db, document)
    access.require("documents:approve")
    perm = DocumentPermission(document_id=document.id, granted_by_id=access.p.id, **data.model_dump())
    db.add(perm)
    db.flush()
    audit.record(
        db,
        family="security",
        module="documents",
        action="ACL_GRANT",
        resource_type="document",
        resource_id=document.id,
        project_id=document.project_id,
        diff=data.model_dump(),
    )
    db.commit()
    return jsonable(serialize(perm))


@router.delete("/document-permissions/{permission_id}")
def remove_permission(
    permission_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, str]:
    perm = db.get(DocumentPermission, permission_id)
    if perm is None:
        raise NotFound("Permission introuvable")
    if perm.document_id:
        service.require_write(access, db, service.get_document(db, perm.document_id))
    access.require("documents:approve")
    db.delete(perm)
    audit.record(
        db,
        family="security",
        module="documents",
        action="ACL_REVOKE",
        resource_type="document_permission",
        resource_id=permission_id,
    )
    db.commit()
    return {"status": "deleted"}


class LinkIn(BaseModel):
    entity_type: str = Field(max_length=40)
    entity_id: uuid.UUID
    version_id: uuid.UUID | None = None


@router.post("/documents/{document_id}/links", status_code=201)
def add_link(
    document_id: uuid.UUID, data: LinkIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    document = service.get_document(db, document_id)
    service.require_read(access, db, document)
    access.require("documents:write")
    row = service.link(
        db,
        document_id=document.id,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        version_id=data.version_id,
        user_id=access.p.id,
    )
    db.commit()
    return jsonable(serialize(row))


@router.get("/document-links")
def entity_documents(
    entity_type: str, entity_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    rows = db.execute(
        select(DocumentLink, Document)
        .join(Document, Document.id == DocumentLink.document_id)
        .where(
            DocumentLink.entity_type == entity_type, DocumentLink.entity_id == entity_id, Document.deleted_at.is_(None)
        )
    ).all()
    return [
        {
            **_doc_out(db, d),
            "link_id": str(link.id),
            "pinned_version_id": str(link.version_id) if link.version_id else None,
        }
        for link, d in rows
        if service.can_read(access, db, d)
    ]


# ---------------------------------------------------------------------------- signature OTP
class OtpRequestIn(BaseModel):
    channel: str = Field(default="email", pattern="^(email|sms|whatsapp)$")


@router.post("/document-versions/{version_id}/sign/otp")
def request_sign_otp(
    version_id: uuid.UUID, data: OtpRequestIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.identity.models import User
    from app.modules.identity.service import issue_otp

    version = db.get(DocumentVersion, version_id)
    if version is None:
        raise NotFound("Version introuvable")
    document = service.get_document(db, version.document_id)
    service.require_read(access, db, document)
    user = db.get(User, access.p.id)
    result = issue_otp(
        db,
        user,
        purpose="otp_sign",
        channel=data.channel,
        payload={"version_id": str(version.id), "label": f"signature de « {document.title} » {version.label}"},
    )
    db.commit()
    return result


class SignIn(BaseModel):
    otp_token: str = Field(max_length=100)
    code: str = Field(min_length=6, max_length=6)
    role: str | None = Field(default=None, max_length=60)
    consent: bool


@router.post("/document-versions/{version_id}/sign")
def sign(
    version_id: uuid.UUID,
    data: SignIn,
    request: Request,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
    _: None = Depends(rate_limit("sign", "20/hour")),
) -> dict[str, Any]:
    from app.modules.identity.models import User
    from app.modules.identity.service import verify_otp

    if not data.consent:
        raise BusinessRuleError("Le consentement à la signature électronique est requis")
    version = db.get(DocumentVersion, version_id)
    if version is None:
        raise NotFound("Version introuvable")
    document = service.get_document(db, version.document_id)
    service.require_read(access, db, document)
    user = db.get(User, access.p.id)
    otp = verify_otp(db, user, purpose="otp_sign", otp_token=data.otp_token, code=data.code)
    if otp["payload"].get("version_id") != str(version.id):
        raise BusinessRuleError("Code émis pour un autre document")
    signature = service.sign_version(
        db,
        user=user,
        document=document,
        version=version,
        otp=otp,
        ip=client_ip(request.scope),
        user_agent=request.headers.get("user-agent"),
        role=data.role,
    )
    db.commit()
    return jsonable(serialize(signature))


# ---------------------------------------------------------------------------- dossiers
def _folder_scope(access: Access, project_id: uuid.UUID | None) -> None:
    access.require("documents:read")
    if project_id:
        access.require_project(project_id)
    elif not access.p.is_internal:
        raise NotFound("Dossier introuvable")


@router.get("/document-folders/tree")
def folder_tree(
    project_id: uuid.UUID | None = None,
    all_projects: bool = False,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    """Dossiers d'un projet, de la GED générale, ou (`all_projects`) de la GED générale et de tous les projets
    accessibles, avec le projet de chacun et le nombre de documents lisibles."""
    from app.modules.projects.models import Project

    _folder_scope(access, project_id)
    stmt = select(Folder)
    if project_id:
        stmt = stmt.where(Folder.project_id == project_id)
    elif all_projects:
        stmt = access.filter_by_project(stmt, Folder.project_id)
    else:
        stmt = stmt.where(Folder.project_id.is_(None))
    folders = db.execute(stmt.order_by(Folder.path).limit(5000)).scalars().all()
    project_ids = {f.project_id for f in folders if f.project_id}
    projects = (
        {
            p.id: p
            for p in db.execute(
                select(Project).where(Project.id.in_(project_ids), Project.deleted_at.is_(None))
            ).scalars()
        }
        if project_ids
        else {}
    )
    folders = [f for f in folders if f.project_id is None or f.project_id in projects]  # projets archivés écartés
    # Seuls les documents que l'appelant peut lire sont comptés (confidentialité, ACL, lots, disciplines).
    counts = service.readable_counts_by_folder(db, access, [f.id for f in folders])
    out = []
    for folder in folders:
        project = projects.get(folder.project_id) if folder.project_id else None
        out.append(
            {
                **serialize(folder),
                "documents": counts.get(folder.id, 0),
                "project": {"id": project.id, "code": project.code, "name": project.name} if project else None,
            }
        )
    return jsonable(out)


class FolderPathsIn(BaseModel):
    project_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None
    paths: list[str] = Field(min_length=1, max_length=1000)
    default_confidentiality: str = Field(default="internal", pattern="^(public|internal|confidential|very_sensitive)$")


@router.post("/document-folders/ensure")
def ensure_folders(
    data: FolderPathsIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Import d'un dossier : crée (ou retrouve) chaque sous-dossier « A/B/C » ; renvoie chemin → id."""
    access.require("documents:write")
    if data.project_id:
        access.require_project(data.project_id, "documents:write")
    out: dict[str, Any] = {}
    for path in dict.fromkeys(p.strip().strip("/") for p in data.paths):
        if not path or len(path) > 1000:
            continue
        folder = service.ensure_folder_path(
            db,
            access=access,
            project_id=data.project_id,
            parent_id=data.parent_id,
            relative_path=path,
            default_confidentiality=data.default_confidentiality,
        )
        out[path] = folder.id if folder else data.parent_id
    db.commit()
    return jsonable(out)


@router.delete("/document-folders/{folder_id}")
def delete_folder(
    folder_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Suppression d'un dossier vide : ni document dans le dossier ni dans ses sous-dossiers (supprimés avec lui)."""
    access.require("documents:write")
    folder = db.get(Folder, folder_id)
    if folder is None:
        raise NotFound("Dossier introuvable")
    if folder.project_id:
        access.require_project(folder.project_id, "documents:write")
    elif not access.p.is_internal:
        raise NotFound("Dossier introuvable")
    subtree = service.subtree_ids(db, folder.id)
    if db.execute(
        select(Document.id).where(Document.folder_id.in_(subtree), Document.deleted_at.is_(None)).limit(1)
    ).first():
        raise BusinessRuleError(
            "Le dossier ou un de ses sous-dossiers contient des documents : déplacez-les ou supprimez-les d'abord",
            code="FOLDER_NOT_EMPTY",
        )
    for doc in db.execute(select(Document).where(Document.folder_id.in_(subtree))).scalars():
        doc.folder_id = None  # documents supprimés (logiquement) : on les détache
    db.flush()
    db.delete(folder)  # sous-dossiers vides supprimés en cascade
    audit.record(
        db,
        family="business",
        module="documents",
        action="DELETE",
        resource_type="document_folder",
        resource_id=folder_id,
        project_id=folder.project_id,
        diff={"path": folder.path, "subfolders": len(subtree) - 1},
    )
    db.commit()
    return {"status": "deleted", "folders": len(subtree)}


def _folder_before_create(db: Session, obj: Folder, access: Access, values: dict[str, Any]) -> None:
    obj.name = (obj.name or "").strip()
    if not obj.name or "/" in obj.name:
        raise BusinessRuleError("Nom de dossier invalide (le caractère « / » est interdit)")
    parent = db.get(Folder, obj.parent_id) if obj.parent_id else None
    if obj.parent_id and parent is None:
        raise NotFound("Dossier parent introuvable")
    if parent is not None and parent.project_id != obj.project_id:
        raise BusinessRuleError("Le dossier parent appartient à un autre projet", code="FOLDER_PROJECT_MISMATCH")
    service.lock_folder_level(db, obj.project_id, obj.parent_id)
    twin = service.sibling_named(db, project_id=obj.project_id, parent_id=obj.parent_id, name=obj.name)
    if twin is not None:
        raise Conflict(f"Un dossier « {twin.name} » existe déjà à cet endroit", code="DUPLICATE_FOLDER")
    obj.path = (parent.path.rstrip("/") if parent else "") + "/" + obj.name


def _folder_before_update(db: Session, obj: Folder, access: Access, values: dict[str, Any]) -> None:
    if ("parent_id" in values and values["parent_id"] != obj.parent_id) or (
        "project_id" in values and values["project_id"] != obj.project_id
    ):
        raise BusinessRuleError("Un dossier ne peut pas changer d'emplacement ; créez-en un nouveau")
    if "name" in values and values["name"] and values["name"].strip() != obj.name:
        name = values["name"].strip()
        if "/" in name:
            raise BusinessRuleError("Nom de dossier invalide (le caractère « / » est interdit)")
        service.lock_folder_level(db, obj.project_id, obj.parent_id)
        twin = service.sibling_named(
            db, project_id=obj.project_id, parent_id=obj.parent_id, name=name, exclude_id=obj.id
        )
        if twin is not None:
            raise Conflict(f"Un dossier « {twin.name} » existe déjà à cet endroit", code="DUPLICATE_FOLDER")
        values["name"] = name
        old = obj.path
        new = old.rsplit("/", 1)[0] + "/" + name
        values["path"] = new
        # Sous-dossiers suivis par parent_id (et non par préfixe de chemin : « _ » et « % » sont des jokers SQL)
        children = [i for i in service.subtree_ids(db, obj.id) if i != obj.id]
        for child in db.execute(select(Folder).where(Folder.id.in_(children))).scalars() if children else ():
            child.path = new + child.path[len(old) :]


router.include_router(
    make_crud_router(
        Folder,
        prefix="/document-folders",
        tags=["GED"],
        module="documents",
        read_perm="documents:read",
        write_perm="documents:write",
        label="Dossier",
        project_attr="project_id",
        filters=["project_id", "parent_id"],
        search=["name"],
        sort=["name", "path"],
        default_sort="path",
        before_create=_folder_before_create,
        before_update=_folder_before_update,
        exclude_in={"path"},
        allow_delete=False,  # suppression contrôlée ci-dessus (dossier vide uniquement)
        creator_attr="created_by_id",
    )
)


# ---------------------------------------------------------------------------- vérification publique (QR)
@public.get("/verify/{token}")
def verify_authenticity(
    token: str, db: Session = Depends(get_db), _: None = Depends(rate_limit("verify", "60/minute"))
) -> dict[str, Any]:
    """QR d'authenticité : confirme l'existence, l'empreinte et le statut d'un document émis par GLOBUS."""
    version = db.execute(
        select(DocumentVersion).where(DocumentVersion.authenticity_token == token)
    ).scalar_one_or_none()
    if version is not None:
        document = db.get(Document, version.document_id)
        signatures = db.execute(select(Signature).where(Signature.version_id == version.id)).scalars().all()
        return jsonable(
            {
                "valid": True,
                "type": "document",
                "code": document.code if document else None,
                "title": document.title if document and document.confidentiality == "public" else "Document GLOBUS",
                "version": version.label,
                "status": version.status,
                "is_obsolete": version.status == "obsolete",
                "sha256": version.checksum_sha256,
                "issued_at": version.created_at,
                "published_at": version.published_at,
                "signatures": [
                    {"signer": s.signer_name, "signed_at": s.signed_at, "method": s.method} for s in signatures
                ],
            }
        )
    from app.modules.billing.models import ClientInvoice

    invoice = db.execute(select(ClientInvoice).where(ClientInvoice.authenticity_token == token)).scalar_one_or_none()
    if invoice is not None:
        from app.modules.documents.models import DocumentSeal
        from app.modules.documents.seals import public_signatures

        seal = db.execute(
            select(DocumentSeal).where(DocumentSeal.kind == "invoice", DocumentSeal.entity_id == invoice.id)
        ).scalar_one_or_none()
        return jsonable(
            {
                "valid": True,
                "type": "invoice",
                "number": invoice.number,
                "issue_date": invoice.issue_date,
                "total": invoice.total,
                "currency": invoice.currency,
                "status": invoice.status,
                "signatures": public_signatures(db, seal) if seal is not None else [],
            }
        )
    from app.modules.proofs.models import Proof
    from app.modules.proofs.service import public_payload

    proof = db.execute(select(Proof).where(Proof.public_code == token)).scalar_one_or_none()
    if proof is not None:
        return public_payload(proof)
    from app.modules.documents.seals import public_payload as sealed_payload

    sealed = sealed_payload(db, token)  # reçus, devis, proformas, avoirs, bons de commande, marchés, bulletins…
    if sealed is not None:
        return sealed
    return {"valid": False, "message": "Aucun document GLOBUS ne correspond à ce code."}
