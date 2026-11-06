"""Signatures manuscrites des documents émis (ERP, espace client, lien personnel) et cachet de l'entreprise."""

from __future__ import annotations

import base64
import hashlib
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import and_, exists, or_, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.database import get_db
from app.core.errors import BusinessRuleError, Forbidden, NotFound
from app.core.middleware import client_ip
from app.core.pagination import PageParams, paginate
from app.core.ratelimit import rate_limit
from app.core.utils import jsonable, utcnow
from app.modules.documents.models import DocumentSeal, Signature
from app.modules.signatures import registry, service
from app.modules.signatures.registry import CLIENT, COMPANY

router = APIRouter(prefix="/signatures", tags=["Signatures"])
public = APIRouter(prefix="/public/signatures", tags=["Signatures (lien personnel)"])

PARTY_PATTERN = "^(company|client)$"
IMAGE_MAX = 1_500_000  # data URL du tracé (≈ 1 Mo d'image)


def _pdf_response(data: bytes, filename: str) -> Response:
    """PDF affiché dans le navigateur ; nom de fichier ASCII (« rév. » → « rev. ») pour l'en-tête HTTP."""
    import unicodedata

    ascii_name = unicodedata.normalize("NFKD", filename).encode("ascii", "ignore").decode().replace('"', "")
    return Response(
        data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{ascii_name}"', "Cache-Control": "no-store"},
    )


def _document(db: Session, kind: str, entity_id: uuid.UUID) -> tuple[registry.Signable, Any]:
    signable = registry.get(kind)
    entity = signable.load(db, entity_id)
    if entity is None:
        raise NotFound("Document introuvable")
    return signable, entity


def _can_view(access: Access, signable: registry.Signable, entity: Any) -> None:
    if access.p.is_internal:
        access.require(signable.read_perm)
        project_id = getattr(entity, "project_id", None)
        if project_id:
            access.require_project(project_id)
        return
    if signable.client_scope is None or not signable.client_scope(access, entity):
        raise NotFound("Document introuvable")


# ============================================================================ ERP : documents à signer
@router.get("/documents")
def list_documents(
    params: PageParams = Depends(),
    kind: str | None = Query(None, max_length=40),
    state: str = Query("all", pattern="^(to_sign|signed|all)$"),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    """Documents émis par la plateforme, avec l'état de la signature de l'entreprise (cachet + signature)."""
    access.require("signatures:company")
    kinds = [k for k, s in registry.SIGNABLES.items() if access.has(s.read_perm) and (kind is None or k == kind)]
    company_signed = exists().where(
        and_(
            Signature.entity_type == DocumentSeal.kind,
            Signature.entity_id == DocumentSeal.entity_id,
            Signature.party == COMPANY,
            Signature.signed_hash == DocumentSeal.content_hash,
        )
    )
    stmt = select(DocumentSeal).where(
        DocumentSeal.kind.in_(kinds or ["-"]),
        DocumentSeal.revoked_at.is_(None),  # émis avant les signatures : « à signer » (empreinte à l'ouverture)
    )
    if state == "to_sign":
        stmt = stmt.where(~company_signed)
    elif state == "signed":
        stmt = stmt.where(company_signed)

    def out(row: DocumentSeal) -> dict[str, Any]:
        signable = registry.SIGNABLES[row.kind]
        entity = signable.load(db, row.entity_id)
        parties = service.parties_state(db, signable, entity, row.content_hash) if entity is not None else []
        return {
            "id": f"{row.kind}:{row.entity_id}",
            "kind": row.kind,
            "kind_label": signable.label,
            "entity_id": row.entity_id,
            "reference": row.reference,
            "title": row.title,
            "party_name": row.party,
            "amount": row.amount,
            "currency": row.currency,
            "issued_on": row.issued_on,
            "erp_link": signable.erp_link.format(id=row.entity_id),
            "parties": parties,
            "available": entity is not None,
        }

    return jsonable(
        paginate(
            db,
            stmt,
            params,
            search_columns=[DocumentSeal.reference, DocumentSeal.title, DocumentSeal.party],
            sort_fields={"issued_on": DocumentSeal.issued_on, "updated_at": DocumentSeal.updated_at},
            default_sort=DocumentSeal.updated_at.desc(),
            transform=out,
        )
    )


# ============================================================================ espace client : documents à signer
@router.get("/mine")
def my_documents(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    """Devis et contrats qui m'attendent (et ceux déjà signés), sur mes projets ou pour mon organisation."""
    from app.modules.crm.models import Contract, Quote

    access.require("client:portal")
    if access.p.is_internal:
        return []
    scope = access.project_scope()
    org_id = access.p.organization_id
    out: list[dict[str, Any]] = []
    for kind, model, statuses in (
        ("quote", Quote, ("sent", "viewed", "accepted")),
        ("contract", Contract, ("sent", "signed", "active")),
    ):
        owner = []
        if scope:
            owner.append(model.project_id.in_(scope))
        if org_id:
            owner.append(model.organization_id == org_id)
        if not owner:
            continue
        signable = registry.SIGNABLES[kind]
        rows = db.execute(
            select(model)
            .where(model.deleted_at.is_(None), model.status.in_(statuses), or_(*owner))
            .order_by(model.created_at.desc())
            .limit(100)
        ).scalars()
        for entity in rows:
            row = service.seal_row(db, signable, entity.id)
            if row is None or not row.content_hash:
                _, row = service.current_pdf(db, signable, entity)
            out.append(jsonable(service.payload(db, signable, entity, row) | {"status": entity.status}))
    db.commit()  # sceaux créés au premier affichage
    return out


# ============================================================================ signature mémorisée
@router.get("/me/saved")
def get_saved(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    from app.modules.identity.models import User

    image = service.saved_signature(db, db.get(User, access.p.id))
    return {"saved": image is not None, "image": image}


@router.delete("/me/saved")
def delete_saved(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    from app.modules.identity.models import User

    service.forget_signature(db.get(User, access.p.id))
    db.commit()
    return {"saved": False}


# ============================================================================ cachet de l'entreprise
def _stamp_payload(db: Session) -> dict[str, Any]:
    from app.core.files import read_private
    from app.core.pdf import STAMP_FILE, STAMP_SETTING
    from app.modules.system.models import Setting, StoredFile

    row = db.get(Setting, STAMP_SETTING)
    value = row.value if row is not None else {}
    stored = db.get(StoredFile, uuid.UUID(value["file_id"])) if value.get("file_id") else None
    data = read_private(stored) if stored is not None else STAMP_FILE.read_bytes()
    return {
        "custom": stored is not None,
        "updated_at": value.get("uploaded_at") if stored is not None else None,
        "original_name": value.get("original_name") if stored is not None else None,
        "image": "data:image/png;base64," + base64.b64encode(data).decode(),
    }


@router.get("/stamp")
def get_stamp(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("settings:read")
    return _stamp_payload(db)


@router.post("/stamp")
async def upload_stamp(
    file: UploadFile = File(...), db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Photo ou scan du cachet : le fond est retiré (PNG transparent) avant d'être apposé sur les documents."""
    from app.core.files import store_generated
    from app.core.pdf import STAMP_SETTING, forget_company_stamp
    from app.core.stamp import transparent_stamp
    from app.modules.system.models import Setting

    access.require("settings:write")
    png = transparent_stamp(await file.read())
    stored = store_generated(
        db,
        png,
        filename="cachet-entreprise.png",
        mime="image/png",
        purpose="brand",
        classification="internal",
        uploaded_by_id=access.p.id,
    )
    row = db.get(Setting, STAMP_SETTING) or Setting(
        key=STAMP_SETTING, category="company", description="Cachet de l'entreprise apposé sur les documents"
    )
    row.value = {
        "file_id": str(stored.id),
        "sha256": hashlib.sha256(png).hexdigest(),
        "original_name": (file.filename or "cachet")[:200],
        "uploaded_at": utcnow().isoformat(),
    }
    row.updated_by_id = access.p.id
    db.add(row)
    audit.record(
        db,
        family="system",
        module="signatures",
        action="STAMP_UPDATE",
        resource_type="setting",
        resource_id=STAMP_SETTING,
        criticality="HIGH",
    )
    db.commit()
    forget_company_stamp()
    return _stamp_payload(db)


@router.delete("/stamp")
def reset_stamp(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    from app.core.pdf import STAMP_SETTING, forget_company_stamp
    from app.modules.system.models import Setting

    access.require("settings:write")
    row = db.get(Setting, STAMP_SETTING)
    if row is not None:
        db.delete(row)
        audit.record(
            db,
            family="system",
            module="signatures",
            action="STAMP_RESET",
            resource_type="setting",
            resource_id=STAMP_SETTING,
            criticality="HIGH",
        )
        db.commit()
    forget_company_stamp()
    return _stamp_payload(db)


# ============================================================================ un document
@router.get("/{kind}/{entity_id}")
def document_state(
    kind: str, entity_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    signable, entity = _document(db, kind, entity_id)
    _can_view(access, signable, entity)
    _, row = service.current_pdf(db, signable, entity)
    can = []
    for party in signable.parties:
        try:
            service.check_party(access, signable, entity, party)
            can.append(party)
        except Forbidden:
            continue
    extra: dict[str, Any] = {"can_sign": can}
    if access.p.is_internal and signable.contact is not None:
        name, email = signable.contact(db, entity)
        extra["client_contact"] = {"name": name, "email": email}  # destinataire proposé pour la demande de signature
    db.commit()
    return jsonable(service.payload(db, signable, entity, row) | extra)


@router.get("/{kind}/{entity_id}/pdf")
def document_pdf(
    kind: str, entity_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    signable, entity = _document(db, kind, entity_id)
    _can_view(access, signable, entity)
    data, _ = service.current_pdf(db, signable, entity)
    db.commit()
    return _pdf_response(data, f"{signable.reference(entity)}.pdf".replace(" ", "-"))


class OtpIn(BaseModel):
    party: str = Field(pattern=PARTY_PATTERN)
    channel: str = Field(default="email", pattern="^(email|sms|whatsapp)$")


@router.post("/{kind}/{entity_id}/otp", dependencies=[Depends(rate_limit("doc_sign_otp", "10/hour", by="ip+path"))])
def request_otp(
    kind: str,
    entity_id: uuid.UUID,
    data: OtpIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    from app.modules.identity.models import User

    signable, entity = _document(db, kind, entity_id)
    service.check_party(access, signable, entity, data.party)
    result = service.request_otp(
        db, signable=signable, entity=entity, party=data.party, user=db.get(User, access.p.id), channel=data.channel
    )
    db.commit()
    return result


class SignIn(BaseModel):
    party: str = Field(pattern=PARTY_PATTERN)
    image: str = Field(min_length=100, max_length=IMAGE_MAX)  # tracé : data URL PNG
    otp_token: str = Field(max_length=100)
    code: str = Field(min_length=6, max_length=6)
    consent: bool
    remember: bool = False


@router.post("/{kind}/{entity_id}/sign")
def sign(
    kind: str,
    entity_id: uuid.UUID,
    data: SignIn,
    request: Request,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
    _: None = Depends(rate_limit("doc_sign", "30/hour", by="ip+path")),
) -> dict[str, Any]:
    from app.modules.identity.models import User

    if not data.consent:
        raise BusinessRuleError("Le consentement à la signature électronique est requis", code="CONSENT_REQUIRED")
    signable, entity = _document(db, kind, entity_id)
    service.check_party(access, signable, entity, data.party)
    user = db.get(User, access.p.id)
    otp = service.verify_account_otp(
        db, signable=signable, entity=entity, party=data.party, user=user, otp_token=data.otp_token, code=data.code
    )
    signature = service.sign(
        db,
        signable=signable,
        entity=entity,
        party=data.party,
        signer=service.Signer(
            name=user.full_name,
            email=user.email,
            user_id=user.id,
            via="erp" if data.party == COMPANY else "espace_client",
        ),
        image=data.image,
        otp=otp,
        ip=client_ip(request.scope),
        user_agent=request.headers.get("user-agent"),
        principal=access.p,
        remember=data.remember,
    )
    db.commit()
    _, row = service.current_pdf(db, signable, entity)
    db.commit()
    return jsonable(service.payload(db, signable, entity, row) | {"signature_id": signature.id})


class RequestIn(BaseModel):
    email: EmailStr | None = None
    name: str | None = Field(default=None, max_length=200)


@router.post("/{kind}/{entity_id}/request")
def request_client(
    kind: str,
    entity_id: uuid.UUID,
    data: RequestIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    """Envoie au client un lien personnel pour signer le document (contrat)."""
    signable, entity = _document(db, kind, entity_id)
    _can_view(access, signable, entity)
    if not access.p.is_internal:
        raise Forbidden("Action réservée à l'entreprise")
    access.require("crm:contracts" if kind == "contract" else "signatures:company")
    result = service.request_client_signature(
        db, signable=signable, entity=entity, email=data.email, name=data.name, user_id=access.p.id
    )
    db.commit()
    return result


# ============================================================================ lien personnel (sans compte)
def _link(db: Session, token: str) -> tuple[Any, registry.Signable, Any]:
    link = service.link_row(db, token)
    signable = registry.get(link.payload.get("kind", ""))
    entity = signable.load(db, uuid.UUID(link.payload["entity_id"]))
    if entity is None:
        raise NotFound("Document introuvable")
    return link, signable, entity


@public.get("/{token}")
def link_state(token: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    link, signable, entity = _link(db, token)
    _, row = service.current_pdf(db, signable, entity)
    db.commit()
    return jsonable(
        service.payload(db, signable, entity, row)
        | {"signer_name": link.payload.get("name"), "signer_email": link.email, "erp_link": None}
    )


@public.get("/{token}/pdf")
def link_pdf(token: str, db: Session = Depends(get_db)) -> Response:
    _, signable, entity = _link(db, token)
    data, _ = service.current_pdf(db, signable, entity)
    db.commit()
    return _pdf_response(data, f"{signable.reference(entity)}.pdf".replace(" ", "-"))


@public.post("/{token}/otp", dependencies=[Depends(rate_limit("link_sign_otp", "10/hour"))])
def link_otp(token: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    link, signable, entity = _link(db, token)
    result = service.issue_link_otp(db, link, signable=signable, entity=entity)
    db.commit()
    return result


class LinkSignIn(BaseModel):
    full_name: str = Field(min_length=3, max_length=200)
    image: str = Field(min_length=100, max_length=IMAGE_MAX)
    otp_token: str = Field(max_length=100)
    code: str = Field(min_length=6, max_length=6)
    consent: bool


@public.post("/{token}")
def link_sign(
    token: str,
    data: LinkSignIn,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit("link_sign", "20/hour")),
) -> dict[str, Any]:
    if not data.consent:
        raise BusinessRuleError("Le consentement à la signature électronique est requis", code="CONSENT_REQUIRED")
    link, signable, entity = _link(db, token)
    otp = service.verify_link_otp(db, link, otp_token=data.otp_token, code=data.code)
    service.sign(
        db,
        signable=signable,
        entity=entity,
        party=CLIENT,
        signer=service.Signer(name=data.full_name.strip(), email=link.email, via="lien"),
        image=data.image,
        otp=otp,
        ip=client_ip(request.scope),
        user_agent=request.headers.get("user-agent"),
    )
    link.used_at = utcnow()
    db.commit()
    _, row = service.current_pdf(db, signable, entity)
    db.commit()
    return jsonable(service.payload(db, signable, entity, row) | {"erp_link": None})


__all__ = ["public", "router"]
