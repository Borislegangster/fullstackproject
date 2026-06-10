"""Electronic signature API.

Flow:
  1. Client calls `POST /signing/documents/{doc_id}/request-otp`
     → server generates a 6-digit code, stores its SHA-256 hash, emails the
       code to the user, returns 200 (the code is NEVER returned by the API).
  2. Client calls `POST /signing/documents/{doc_id}/verify-otp` with {code}
     → server checks the hash + expiry, marks the OTP consumed, computes the
       file SHA-256 hash, stores a DocumentSignature row, marks the document
       as signed.

Audit trail: `GET /signing/documents/{doc_id}/audit` returns every signature
attached to the document with hash, timestamp, IP, signer.
"""
from __future__ import annotations

import hashlib
import os
import secrets
from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import get_current_user
from app.database import get_db
from app import metrics
from app.models.erp import Document, DocumentSignature, DocumentSignatureOTP
from app.services.activity_service import log_activity
from app.services.email_service import send_signing_otp
from app.services.notification_service import create_notification

router = APIRouter(prefix="/signing", tags=["Signing"])

OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
UPLOAD_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")


from app.utils.time import utcnow_naive as _now


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _hash_file(file_url: str) -> str:
    """Compute SHA-256 of the document content. Returns '' when unreadable.

    The hash anchors the signature: if the file is later modified, verifiers
    can detect the tampering by recomputing and comparing.
    """
    if not file_url:
        return ""
    # Resolve /uploads/foo → backend/uploads/foo
    rel = file_url.lstrip("/")
    if rel.startswith("uploads/"):
        rel = rel[len("uploads/"):]
    path = os.path.join(UPLOAD_ROOT, rel)
    if not os.path.isfile(path):
        return ""
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


class VerifyPayload(BaseModel):
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


# ── Request OTP ──────────────────────────────────────────────

@router.post("/documents/{doc_id}/request-otp")
async def request_signing_otp(
    doc_id: str,
    bg: BackgroundTasks,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Issue a new OTP for this user + document. Old pending OTPs are invalidated."""
    r = await db.execute(select(Document).where(Document.id == doc_id, Document.deleted_at.is_(None)))
    doc = r.scalars().first()
    if not doc:
        raise HTTPException(404, "Document introuvable")

    # Clients can only sign documents shared with them.
    if user.role == "CLIENT" and not doc.shared_with_client:
        raise HTTPException(403, "Ce document ne vous est pas partagé")

    if doc.signed_at:
        raise HTTPException(400, "Document déjà signé")

    # Invalidate any pending OTP for this user+doc — keep only the latest one alive.
    pending_r = await db.execute(
        select(DocumentSignatureOTP).where(
            DocumentSignatureOTP.document_id == doc_id,
            DocumentSignatureOTP.user_id == user.id,
            DocumentSignatureOTP.consumed_at.is_(None),
        )
    )
    for old in pending_r.scalars().all():
        old.consumed_at = _now()

    code = f"{secrets.randbelow(1_000_000):06d}"
    otp = DocumentSignatureOTP(
        document_id=doc_id,
        user_id=user.id,
        code_hash=_hash_code(code),
        expires_at=_now() + timedelta(minutes=OTP_TTL_MINUTES),
        requested_ip=request.client.host if request.client else "",
    )
    db.add(otp)
    await db.commit()

    if user.email:
        bg.add_task(send_signing_otp, user.email, code, doc.name, user.first_name or "")
    metrics.inc("signing_otp_requests_total")
    return {
        "detail": "Code envoyé par email",
        "expires_at": otp.expires_at.isoformat(),
        "ttl_minutes": OTP_TTL_MINUTES,
    }


# ── Verify OTP ───────────────────────────────────────────────

@router.post("/documents/{doc_id}/verify-otp")
async def verify_signing_otp(
    doc_id: str,
    payload: VerifyPayload,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify the OTP and finalise the signature.

    On success returns the signature record (including the document hash so the
    UI can show the verifiable proof).
    """
    r = await db.execute(select(Document).where(Document.id == doc_id, Document.deleted_at.is_(None)))
    doc = r.scalars().first()
    if not doc:
        raise HTTPException(404, "Document introuvable")
    if doc.signed_at:
        raise HTTPException(400, "Document déjà signé")

    otp_r = await db.execute(
        select(DocumentSignatureOTP).where(
            DocumentSignatureOTP.document_id == doc_id,
            DocumentSignatureOTP.user_id == user.id,
            DocumentSignatureOTP.consumed_at.is_(None),
        ).order_by(DocumentSignatureOTP.created_at.desc())
    )
    otp = otp_r.scalars().first()
    if not otp:
        raise HTTPException(400, "Aucun code en attente. Demandez un nouveau code.")
    if otp.expires_at < _now():
        raise HTTPException(400, "Code expiré. Demandez un nouveau code.")
    if otp.attempts >= OTP_MAX_ATTEMPTS:
        otp.consumed_at = _now()
        await db.commit()
        raise HTTPException(400, "Trop de tentatives. Demandez un nouveau code.")

    if _hash_code(payload.code) != otp.code_hash:
        otp.attempts = (otp.attempts or 0) + 1
        await db.commit()
        metrics.inc("signing_otp_failures_total")
        raise HTTPException(400, "Code incorrect")

    # Success → consume OTP, finalize signature.
    otp.consumed_at = _now()
    document_hash = _hash_file(doc.file_url) or hashlib.sha256(doc.id.encode()).hexdigest()
    sig = DocumentSignature(
        document_id=doc_id,
        signer_id=user.id,
        document_hash=document_hash,
        ip_address=request.client.host if request.client else "",
        user_agent=request.headers.get("user-agent", "")[:255],
        method="OTP_EMAIL",
        audit_meta={
            "otp_id": otp.id,
            "file_url": doc.file_url,
            "doc_name": doc.name,
        },
    )
    db.add(sig)

    doc.signed_at = _now()
    doc.signed_by = user.id
    doc.updated_at = _now()

    await log_activity(db, user.id, "DOCUMENT_SIGNED_OTP", "document", doc.id,
                       new_value={"document_hash": document_hash})

    # Best-effort notify the document owner (if any).
    if doc.uploaded_by and doc.uploaded_by != user.id:
        await create_notification(
            db, doc.uploaded_by,
            title="Document signé", message=f"{doc.name} vient d'être signé électroniquement",
            type="success", entity_type="document", entity_id=doc.id,
        )

    await db.commit()
    await db.refresh(sig)
    metrics.inc("signing_completed_total")
    return {
        "id": sig.id,
        "document_id": sig.document_id,
        "signer_id": sig.signer_id,
        "document_hash": sig.document_hash,
        "signed_at": sig.signed_at,
        "method": sig.method,
    }


# ── Audit trail ──────────────────────────────────────────────

@router.get("/documents/{doc_id}/audit")
async def document_signature_audit(
    doc_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return every signature attached to a document — proof for legal review."""
    doc_r = await db.execute(select(Document).where(Document.id == doc_id, Document.deleted_at.is_(None)))
    doc = doc_r.scalars().first()
    if not doc:
        raise HTTPException(404, "Document introuvable")
    if user.role == "CLIENT" and not doc.shared_with_client:
        raise HTTPException(403, "Accès interdit")

    r = await db.execute(
        select(DocumentSignature).where(DocumentSignature.document_id == doc_id)
        .order_by(DocumentSignature.signed_at.desc())
    )
    return [
        {
            "id": s.id, "signer_id": s.signer_id,
            "document_hash": s.document_hash, "signed_at": s.signed_at,
            "ip_address": s.ip_address, "user_agent": s.user_agent,
            "method": s.method, "audit_meta": s.audit_meta,
        }
        for s in r.scalars().all()
    ]
