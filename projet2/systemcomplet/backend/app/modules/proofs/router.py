"""API Preuves opposables (R4) : registre interne, certification manuelle, certificats, reçus OpenTimestamps et
vérification publique par QR code (la page /verification/{code} réutilise `/public/verify/{token}`)."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.database import get_db
from app.core.errors import BusinessRuleError, NotFound
from app.core.pagination import PageParams, paginate
from app.core.ratelimit import rate_limit
from app.core.utils import utcnow
from app.modules.proofs import service
from app.modules.proofs.models import SUBJECT_TYPES, Proof

router = APIRouter(tags=["Preuves"])
public = APIRouter(prefix="/public/proofs", tags=["Preuves (public)"])


def _load(db: Session, access: Access, proof_id: uuid.UUID) -> Proof:
    proof = db.get(Proof, proof_id)
    if proof is None:
        raise NotFound("Preuve introuvable")
    if proof.project_id is not None:
        access.require_project(proof.project_id)
    elif not access.p.is_internal:
        raise NotFound("Preuve introuvable")
    return proof


@router.get("/proofs")
def list_proofs(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    subject_type: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("projects:read")
    stmt = access.filter_by_project(select(Proof), Proof.project_id)
    if project_id:
        stmt = stmt.where(Proof.project_id == project_id)
    if subject_type:
        stmt = stmt.where(Proof.subject_type == subject_type)
    return paginate(
        db,
        stmt,
        params,
        default_sort=Proof.created_at.desc(),
        search_columns=[Proof.title, Proof.number],
        transform=service.proof_out,
    )


class CertifyIn(BaseModel):
    subject_type: str = Field(pattern="^(" + "|".join(SUBJECT_TYPES) + ")$")
    subject_id: str = Field(min_length=3, max_length=80)


@router.post("/proofs/certify", status_code=201)
def certify(data: CertifyIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """Certification à la demande (les sujets publiés / validés sont aussi certifiés automatiquement)."""
    access.require("projects:read")
    if not (access.has("documents:publish") or access.has("projects:publish_client")):
        access.require("documents:publish")
    try:
        if data.subject_type == "photo_day":
            project_part, _, day_part = data.subject_id.partition(":")
            project_id, day = uuid.UUID(project_part), date.fromisoformat(day_part)
            access.require_project(project_id)
            proof = service.certify_photo_day(db, project_id, day)
        else:
            subject_id = uuid.UUID(data.subject_id)
            proof = {
                "document_version": lambda: service.certify_document_version(db, subject_id, actor_id=access.p.id),
                "decision": lambda: service.certify_decision(db, subject_id),
                "goods_receipt": lambda: service.certify_goods_receipt(db, subject_id),
            }[data.subject_type]()
    except ValueError as exc:
        raise BusinessRuleError("Identifiant de sujet invalide") from exc
    if proof is None:
        raise BusinessRuleError(
            "Rien à certifier : le sujet doit être publié / validé (ou contenir des photos)", code="NOTHING_TO_CERTIFY"
        )
    if proof.project_id:
        access.require_project(proof.project_id)
    audit.record(
        db,
        family="business",
        module="proofs",
        action="CERTIFY",
        resource_type="proof",
        resource_id=proof.id,
        project_id=proof.project_id,
        diff={"subject": f"{proof.subject_type}:{proof.subject_id}", "sha256": proof.sha256},
    )
    db.commit()
    return service.proof_out(proof)


@router.get("/proofs/{proof_id}")
def get_proof(
    proof_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    if access.p.is_internal:
        access.require("projects:read")
    proof = _load(db, access, proof_id)
    if not access.p.is_internal and not proof.client_visible:
        raise NotFound("Preuve introuvable")
    return service.proof_out(proof)


@router.get("/proofs/{proof_id}/certificate.pdf")
def certificate(proof_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> Response:
    proof = _load(db, access, proof_id)
    if not access.p.is_internal and not proof.client_visible:
        raise NotFound("Preuve introuvable")
    return Response(
        service.certificate_pdf(db, proof),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="certificat-{proof.number}.pdf"'},
    )


class RevokeIn(BaseModel):
    reason: str = Field(min_length=10, max_length=1000)


@router.post("/proofs/{proof_id}/revoke")
def revoke(
    proof_id: uuid.UUID, data: RevokeIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Révocation motivée (ex. document publié par erreur) : la preuve reste consultable, marquée révoquée."""
    access.require("documents:publish")
    proof = _load(db, access, proof_id)
    if proof.revoked_at is not None:
        raise BusinessRuleError("Preuve déjà révoquée")
    proof.revoked_at = utcnow()
    proof.revoked_reason = data.reason
    audit.record(
        db,
        family="security",
        module="proofs",
        action="REVOKE",
        resource_type="proof",
        resource_id=proof.id,
        project_id=proof.project_id,
        reason=data.reason,
        criticality="HIGH",
    )
    db.commit()
    return service.proof_out(proof)


# ---------------------------------------------------------------------------- public (QR)
def _public(db: Session, code: str) -> Proof:
    proof = db.execute(select(Proof).where(Proof.public_code == code)).scalar_one_or_none()
    if proof is None:
        raise NotFound("Preuve inconnue")
    return proof


@public.get("/{code}/ots", dependencies=[Depends(rate_limit("verify", "60/minute"))])
def ots_receipt(code: str, db: Session = Depends(get_db)) -> Response:
    """Reçu OpenTimestamps (.ots) vérifiable avec l'outil officiel : `ots upgrade` puis `ots verify`."""
    proof = _public(db, code)
    try:
        data = service.ots_file(proof)
    except ValueError as exc:
        raise NotFound("Aucun reçu d'horodatage public pour cette preuve") from exc
    return Response(
        data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{proof.number}.ots"'},
    )


@public.get("/{code}/certificate.pdf", dependencies=[Depends(rate_limit("verify", "60/minute"))])
def public_certificate(code: str, db: Session = Depends(get_db)) -> Response:
    proof = _public(db, code)
    return Response(
        service.certificate_pdf(db, proof),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="certificat-{proof.number}.pdf"'},
    )
