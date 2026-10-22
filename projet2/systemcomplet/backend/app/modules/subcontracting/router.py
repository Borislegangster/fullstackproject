"""API Sous-traitance (§9) + litiges (§9.3) + extranet sous-traitant (V4-SUB-14/15/16)."""

from __future__ import annotations

import io
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import cast, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.crud import serialize
from app.core.database import get_db
from app.core.downloads import file_response, signed_url, watermark_label
from app.core.errors import BusinessRuleError, Conflict, Forbidden, NotFound
from app.core.files import store_private, validate_upload
from app.core.pagination import PageParams, paginate
from app.core.utils import clean_phone, jsonable, money, utcnow
from app.modules.documents.models import Document, DocumentVersion
from app.modules.identity import service as identity
from app.modules.projects.models import Lot, Project
from app.modules.subcontracting import service
from app.modules.subcontracting.models import (
    Bid,
    BidNegotiation,
    Claim,
    Dispute,
    DisputeEvent,
    Mobilization,
    Situation,
    Subcontract,
    SubcontractItem,
    Subcontractor,
    SubcontractorInvoice,
    SubcontractorQualification,
    SubcontractorRating,
    Tender,
    TenderInvitation,
    TenderItem,
    TenderLot,
)
from app.modules.subcontracting.trades import ensure_known as ensure_known_trades
from app.modules.system.models import StoredFile

TAG = "Sous-traitance"
router = APIRouter(tags=[TAG])
extranet = APIRouter(prefix="/extranet/subcontractor", tags=["Extranet sous-traitant"])
SENSITIVE = ("bank_account", "mobile_money_number")


def _mask(value: str | None) -> str | None:
    return ("•" * max(0, len(value) - 4) + value[-4:]) if value else None


def _get(db: Session, model: Any, obj_id: uuid.UUID, label: str) -> Any:
    obj = db.get(model, obj_id)
    if obj is None or getattr(obj, "deleted_at", None) is not None:
        raise NotFound(f"{label} introuvable")
    return obj


def _qualification_files(db: Session, file_ids: list[Any]) -> list[StoredFile]:
    """Pièces justificatives d'une qualification, dans l'ordre de dépôt (fichiers supprimés ignorés)."""
    ids = []
    for raw in file_ids or []:
        try:
            ids.append(uuid.UUID(str(raw)))
        except ValueError:
            continue
    if not ids:
        return []
    found = {
        f.id: f
        for f in db.execute(select(StoredFile).where(StoredFile.id.in_(ids), StoredFile.deleted_at.is_(None))).scalars()
    }
    return [found[i] for i in ids if i in found]


def _qualification_out(db: Session, q: SubcontractorQualification) -> dict[str, Any]:
    data = serialize(q)
    data["documents"] = [
        {"id": f.id, "name": f.original_name, "mime": f.mime_type, "size": f.size_bytes}
        for f in _qualification_files(db, q.document_file_ids)
    ]
    return data


def subcontractor_out(db: Session, sub: Subcontractor, *, detail: bool = False) -> dict[str, Any]:
    data = serialize(sub)
    for key in SENSITIVE:
        data.pop(key, None)
    data["bank_account_masked"] = _mask(sub.bank_account)
    data["mobile_money_masked"] = _mask(sub.mobile_money_number)
    today = date.today()
    data["insurance_ok"] = bool(sub.insurance_rc_until and sub.insurance_rc_until >= today)
    if detail:
        qualifications = (
            db.execute(
                select(SubcontractorQualification)
                .where(SubcontractorQualification.subcontractor_id == sub.id)
                .order_by(SubcontractorQualification.created_at.desc())
            )
            .scalars()
            .all()
        )
        data["qualifications"] = [_qualification_out(db, q) for q in qualifications]
        data["history"] = service.partner_history(db, sub)
        data["contracts"] = [
            {"id": c.id, "number": c.number, "title": c.title, "status": c.status, "amount": c.amount}
            for c in db.execute(
                select(Subcontract)
                .where(Subcontract.subcontractor_id == sub.id, Subcontract.deleted_at.is_(None))
                .order_by(Subcontract.created_at.desc())
            ).scalars()
        ]
    return jsonable(data)


# ============================================================================ sous-traitants
class SubcontractorIn(BaseModel):
    code: str | None = Field(default=None, max_length=30)
    legal_name: str = Field(min_length=2, max_length=250)
    trade_name: str | None = Field(default=None, max_length=250)
    trades: list[str] = Field(default_factory=list, max_length=30)
    zones: list[str] = Field(default_factory=list, max_length=50)
    tax_id: str | None = Field(default=None, max_length=60)
    trade_register: str | None = Field(default=None, max_length=80)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    whatsapp: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=1000)
    city: str | None = Field(default=None, max_length=120)
    workforce_size: int = Field(default=0, ge=0, le=100000)
    insurance_rc_until: date | None = None
    insurance_decennale_until: date | None = None
    bank_account: str | None = Field(default=None, max_length=80)
    mobile_money_number: str | None = Field(default=None, max_length=40)
    organization_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=4000)


class SubcontractorUpdate(BaseModel):
    legal_name: str | None = Field(default=None, min_length=2, max_length=250)
    trade_name: str | None = Field(default=None, max_length=250)
    trades: list[str] | None = Field(default=None, max_length=30)
    zones: list[str] | None = Field(default=None, max_length=50)
    tax_id: str | None = Field(default=None, max_length=60)
    trade_register: str | None = Field(default=None, max_length=80)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    whatsapp: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=1000)
    city: str | None = Field(default=None, max_length=120)
    workforce_size: int | None = Field(default=None, ge=0, le=100000)
    insurance_rc_until: date | None = None
    insurance_decennale_until: date | None = None
    bank_account: str | None = Field(default=None, max_length=80)
    mobile_money_number: str | None = Field(default=None, max_length=40)
    organization_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=4000)


def _normalize(values: dict[str, Any]) -> dict[str, Any]:
    for key in ("phone", "whatsapp", "mobile_money_number"):
        if values.get(key):
            values[key] = clean_phone(values[key])
    if values.get("email"):
        values["email"] = str(values["email"]).lower()
    return values


@router.get("/subcontractors")
def list_subcontractors(
    params: PageParams = Depends(),
    status: str | None = None,
    trade: str | None = None,
    city: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("subcontracting:read")
    stmt = select(Subcontractor).where(Subcontractor.deleted_at.is_(None))
    if status:
        stmt = stmt.where(Subcontractor.status == status)
    if trade:
        stmt = stmt.where(cast(Subcontractor.trades, JSONB).contains([trade]))
    if city:
        stmt = stmt.where(Subcontractor.city.ilike(city))
    return paginate(
        db,
        stmt,
        params,
        sort_fields={"legal_name": Subcontractor.legal_name, "score": Subcontractor.score},
        default_sort=Subcontractor.legal_name.asc(),
        search_columns=[Subcontractor.legal_name, Subcontractor.trade_name, Subcontractor.code],
        transform=lambda s: subcontractor_out(db, s),
    )


@router.post("/subcontractors", status_code=201)
def create_subcontractor(
    data: SubcontractorIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("subcontracting:write")
    ensure_known_trades(data.trades)
    values = _normalize(data.model_dump())
    values["trades"] = list(dict.fromkeys(values["trades"]))
    if not values.get("code"):
        count = db.execute(select(func.count()).select_from(Subcontractor)).scalar_one()
        values["code"] = f"ST-{count + 1:05d}"
    if values.get("organization_id"):
        identity.check_linked_organization(db, values["organization_id"], kind="subcontractor", model=Subcontractor)
    sub = Subcontractor(**values, status="prospect")
    db.add(sub)
    try:
        db.flush()
    except IntegrityError as exc:
        raise Conflict("Code sous-traitant déjà utilisé", code="DUPLICATE_CODE") from exc
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="CREATE",
        resource_type="subcontractor",
        resource_id=sub.id,
        diff={"legal_name": sub.legal_name},
    )
    db.commit()
    return subcontractor_out(db, sub, detail=True)


@router.get("/subcontractors/{subcontractor_id}")
def get_subcontractor(
    subcontractor_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("subcontracting:read")
    return subcontractor_out(db, _get(db, Subcontractor, subcontractor_id, "Sous-traitant"), detail=True)


@router.patch("/subcontractors/{subcontractor_id}")
def update_subcontractor(
    subcontractor_id: uuid.UUID,
    data: SubcontractorUpdate,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("subcontracting:write")
    sub = _get(db, Subcontractor, subcontractor_id, "Sous-traitant")
    values = _normalize(data.model_dump(exclude_unset=True))
    if "trades" in values:
        values["trades"] = list(dict.fromkeys(values["trades"] or []))
        ensure_known_trades(values["trades"], tolerated=sub.trades)
    if values.get("organization_id"):
        identity.check_linked_organization(
            db, values["organization_id"], kind="subcontractor", model=Subcontractor, current_id=sub.id
        )
    diff = {}
    for key, value in values.items():
        previous = getattr(sub, key)
        if previous != value:
            diff[key] = ("***modifié" if previous else "***ajouté") if key in SENSITIVE else jsonable(value)
            setattr(sub, key, value)
    if diff:
        audit.record(
            db,
            family="business",
            module="subcontracting",
            action="UPDATE",
            resource_type="subcontractor",
            resource_id=sub.id,
            diff=diff,
            criticality="HIGH" if any(k in SENSITIVE for k in diff) else "LOW",
        )
    db.commit()
    return subcontractor_out(db, sub, detail=True)


class StatusIn(BaseModel):
    status: str = Field(pattern="^(prospect|qualified|approved|suspended|blacklisted)$")
    reason: str = Field(min_length=5, max_length=2000)


@router.post("/subcontractors/{subcontractor_id}/status")
def set_status(
    subcontractor_id: uuid.UUID, data: StatusIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("subcontracting:award")
    sub = _get(db, Subcontractor, subcontractor_id, "Sous-traitant")
    previous = sub.status
    sub.status = data.status
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="STATUS",
        resource_type="subcontractor",
        resource_id=sub.id,
        reason=data.reason,
        diff={"from": previous, "to": data.status},
        criticality="MEDIUM",
    )
    db.commit()
    return subcontractor_out(db, sub, detail=True)


class QualificationIn(BaseModel):
    trade: str = Field(min_length=2, max_length=60)
    criteria: dict[str, Decimal]
    references: list[dict[str, Any]] = Field(default_factory=list, max_length=50)
    document_file_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)
    decision: str = Field(pattern="^(pending|approved|rejected)$")
    comment: str | None = Field(default=None, max_length=4000)


@router.post("/subcontractors/{subcontractor_id}/qualifications", status_code=201)
def qualify(
    subcontractor_id: uuid.UUID,
    data: QualificationIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("subcontracting:write")
    if data.decision == "approved":
        access.require("subcontracting:award")
    sub = _get(db, Subcontractor, subcontractor_id, "Sous-traitant")
    ensure_known_trades([data.trade], tolerated=sub.trades)
    if data.document_file_ids:
        known = set(
            db.execute(
                select(StoredFile.id).where(
                    StoredFile.id.in_(data.document_file_ids),
                    StoredFile.purpose == "subcontractor_documents",
                    StoredFile.deleted_at.is_(None),
                )
            ).scalars()
        )
        if any(fid not in known for fid in data.document_file_ids):
            raise BusinessRuleError(
                "Pièce justificative inconnue : déposez-la depuis la fenêtre de qualification",
                code="QUALIFICATION_DOCUMENT_UNKNOWN",
            )
    row = service.qualify(
        db,
        sub,
        trade=data.trade,
        criteria={k: str(v) for k, v in data.criteria.items()},
        references=data.references,
        document_file_ids=[str(x) for x in data.document_file_ids],
        decision=data.decision,
        comment=data.comment,
        user_id=access.p.id,
    )
    db.commit()
    return jsonable({**_qualification_out(db, row), "subcontractor_status": sub.status})


@router.get("/subcontractors/{subcontractor_id}/qualifications/{qualification_id}/documents/{file_id}")
def qualification_document(
    subcontractor_id: uuid.UUID,
    qualification_id: uuid.UUID,
    file_id: uuid.UUID,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> Response:
    """Consultation d'une pièce justificative jointe à une qualification (filigrane au nom du lecteur)."""
    access.require("subcontracting:read")
    qualification = db.get(SubcontractorQualification, qualification_id)
    if qualification is None or qualification.subcontractor_id != subcontractor_id:
        raise NotFound("Qualification introuvable")
    stored = next((f for f in _qualification_files(db, qualification.document_file_ids) if f.id == file_id), None)
    if stored is None:
        raise NotFound("Pièce introuvable")
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="DOWNLOAD",
        resource_type="qualification_document",
        resource_id=qualification.id,
        diff={"file": stored.original_name},
    )
    db.commit()
    return file_response(stored, watermark_text=watermark_label(access.p.user))


def _ensure_readable_pdf(mime: str, data: bytes) -> None:
    """Les pièces justificatives ne sont diffusées que filigranées : un PDF endommagé ou protégé par mot de passe,
    que le filigrane ne peut pas lire, est refusé dès le dépôt plutôt que de devenir impossible à consulter."""
    if mime != "application/pdf":
        return
    from pypdf import PdfReader
    from pypdf.errors import PyPdfError

    encrypted = False
    try:
        reader = PdfReader(io.BytesIO(data))
        encrypted = reader.is_encrypted
        readable = encrypted or len(reader.pages) > 0
    except (PyPdfError, ValueError, KeyError, TypeError, AttributeError, OSError):
        readable = False
    if encrypted:
        raise BusinessRuleError(
            "PDF protégé par mot de passe : enregistrez-en une copie sans protection puis déposez-la",
            code="PDF_PROTECTED",
        )
    if not readable:
        raise BusinessRuleError(
            "PDF illisible ou endommagé : ré-enregistrez-le (par exemple Imprimer › Enregistrer en PDF) puis "
            "déposez-le à nouveau",
            code="PDF_UNREADABLE",
        )


@router.post("/subcontractors/{subcontractor_id}/documents", status_code=201)
async def upload_qualification_document(
    subcontractor_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("subcontracting:write")
    _get(db, Subcontractor, subcontractor_id, "Sous-traitant")
    upload = validate_upload(file.filename or "document", await file.read(), category="media")
    _ensure_readable_pdf(upload.mime, upload.data)
    stored = store_private(
        db, upload, purpose="subcontractor_documents", classification="confidential", uploaded_by_id=access.p.id
    )
    db.commit()
    return jsonable({"file_id": stored.id, "filename": stored.original_name})


class RatingIn(BaseModel):
    subcontract_id: uuid.UUID | None = None
    quality: int = Field(ge=1, le=5)
    delay: int = Field(ge=1, le=5)
    safety: int = Field(ge=1, le=5)
    cleanliness: int = Field(ge=1, le=5)
    compliance: int = Field(ge=1, le=5)
    cooperation: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


@router.post("/subcontractors/{subcontractor_id}/ratings", status_code=201)
def rate_subcontractor(
    subcontractor_id: uuid.UUID, data: RatingIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("subcontracting:write")
    sub = _get(db, Subcontractor, subcontractor_id, "Sous-traitant")
    contract = db.get(Subcontract, data.subcontract_id) if data.subcontract_id else None
    if contract is not None and contract.subcontractor_id != sub.id:
        raise BusinessRuleError("Marché d'un autre sous-traitant")
    row = service.rate(
        db,
        contract,
        sub,
        scores=data.model_dump(exclude={"subcontract_id", "comment"}),
        comment=data.comment,
        user_id=access.p.id,
    )
    db.commit()
    return jsonable({**serialize(row), "average": row.average, "subcontractor_score": sub.score})


@router.get("/subcontractors/{subcontractor_id}/ratings")
def list_ratings(
    subcontractor_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require("subcontracting:read")
    rows = db.execute(
        select(SubcontractorRating)
        .where(SubcontractorRating.subcontractor_id == subcontractor_id)
        .order_by(SubcontractorRating.created_at.desc())
    ).scalars()
    return [jsonable({**serialize(r), "average": r.average}) for r in rows]


# ============================================================================ consultations (RFQ)
class CriterionIn(BaseModel):
    key: str = Field(pattern="^(prix|delai|technique|historique)$")
    weight: int = Field(ge=0, le=100)


class TenderItemIn(BaseModel):
    code: str | None = Field(default=None, max_length=30)
    designation: str = Field(min_length=2, max_length=300)
    unit: str = Field(default="u", min_length=1, max_length=20)
    quantity: Decimal = Field(gt=0)


class TenderLotIn(BaseModel):
    lot_id: uuid.UUID | None = None
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    estimated_amount: Decimal = Field(default=Decimal("0"), ge=0)
    items: list[TenderItemIn] = Field(min_length=1, max_length=500)


class TenderIn(BaseModel):
    project_id: uuid.UUID
    title: str = Field(min_length=3, max_length=250)
    description: str | None = Field(default=None, max_length=8000)
    technical_spec: str | None = Field(default=None, max_length=50000)
    document_version_ids: list[uuid.UUID] = Field(default_factory=list, max_length=200)
    deadline: datetime
    start_date_target: date | None = None
    duration_days_target: int | None = Field(default=None, ge=1, le=3650)
    quality_criteria: list[CriterionIn] = Field(default_factory=list, max_length=4)
    variants_allowed: bool = False
    exclusions: str | None = Field(default=None, max_length=4000)
    lots: list[TenderLotIn] = Field(min_length=1, max_length=50)


def _check_versions(db: Session, project_id: uuid.UUID, version_ids: list[uuid.UUID]) -> None:
    for vid in version_ids:
        version = db.get(DocumentVersion, vid)
        document = db.get(Document, version.document_id) if version else None
        if document is None or document.project_id != project_id:
            raise BusinessRuleError("Version de plan hors projet", code="DOCUMENT_NOT_IN_PROJECT")


def _build_lots(db: Session, tender: Tender, lots: list[TenderLotIn]) -> None:
    for lot in lots:
        if lot.lot_id:
            project_lot = db.get(Lot, lot.lot_id)
            if project_lot is None or project_lot.project_id != tender.project_id:
                raise BusinessRuleError("Lot hors projet")
        row = TenderLot(
            lot_id=lot.lot_id,
            code=lot.code,
            name=lot.name,
            description=lot.description,
            estimated_amount=money(lot.estimated_amount),
        )
        for index, item in enumerate(lot.items):
            row.items.append(TenderItem(sort_order=index, **item.model_dump()))
        tender.lots.append(row)


def _tender_out(db: Session, tender: Tender, access: Access | None = None) -> dict[str, Any]:
    invitations = db.execute(
        select(TenderInvitation, Subcontractor.legal_name)
        .join(Subcontractor, Subcontractor.id == TenderInvitation.subcontractor_id)
        .where(TenderInvitation.tender_id == tender.id)
    ).all()
    bids_count = db.execute(
        select(func.count()).select_from(Bid).where(Bid.tender_id == tender.id, Bid.status != "withdrawn")
    ).scalar_one()
    documents = []  # pièces du DCE (versions exactes)
    for vid in tender.document_version_ids or []:
        version = db.get(DocumentVersion, uuid.UUID(str(vid)))
        document = db.get(Document, version.document_id) if version else None
        if version is not None and document is not None:
            documents.append(
                {
                    "version_id": version.id,
                    "document_id": document.id,
                    "code": document.code,
                    "title": document.title,
                    "version": f"{version.version_major}.{version.version_minor}",
                }
            )
    return jsonable(
        {
            **serialize(tender),
            "documents": documents,
            "sealed": not _bids_open(tender),
            "lots": [{**serialize(lot), "items": [serialize(i) for i in lot.items]} for lot in tender.lots],
            "invitations": [{**serialize(inv), "subcontractor": name} for inv, name in invitations],
            "bids_count": bids_count,
        }
    )


def _bids_open(tender: Tender) -> bool:
    """Offres sous pli scellé jusqu'à la date limite (ou clôture anticipée)."""
    return tender.status in ("closed", "awarded", "cancelled") or service.deadline_reached(tender)


@router.get("/tenders")
def list_tenders(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("subcontracting:read")
    stmt = access.filter_by_project(
        select(Tender).where(Tender.deleted_at.is_(None)), Tender.project_id, allow_null=False
    )
    if project_id:
        stmt = stmt.where(Tender.project_id == project_id)
    if status:
        stmt = stmt.where(Tender.status == status)
    return paginate(
        db,
        stmt,
        params,
        sort_fields={"deadline": Tender.deadline, "created_at": Tender.created_at},
        default_sort=Tender.created_at.desc(),
        search_columns=[Tender.number, Tender.title],
        transform=lambda t: _tender_out(db, t),
    )


@router.post("/tenders", status_code=201)
def create_tender(
    data: TenderIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require_project(data.project_id, "subcontracting:write")
    _check_versions(db, data.project_id, data.document_version_ids)
    from app.core.numbering import next_number

    tender = Tender(
        number=next_number(db, "tender"),
        project_id=data.project_id,
        title=data.title,
        description=data.description,
        technical_spec=data.technical_spec,
        document_version_ids=[str(v) for v in data.document_version_ids],
        deadline=data.deadline,
        start_date_target=data.start_date_target,
        duration_days_target=data.duration_days_target,
        quality_criteria=[c.model_dump() for c in data.quality_criteria] or service.DEFAULT_CRITERIA,
        variants_allowed=data.variants_allowed,
        exclusions=data.exclusions,
        created_by_id=access.p.id,
    )
    _build_lots(db, tender, data.lots)
    db.add(tender)
    db.flush()
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="CREATE",
        resource_type="tender",
        resource_id=tender.id,
        project_id=tender.project_id,
        diff={"number": tender.number, "lots": len(data.lots)},
    )
    db.commit()
    return _tender_out(db, tender)


def _tender(db: Session, access: Access, tender_id: uuid.UUID, *perms: str) -> Tender:
    tender = _get(db, Tender, tender_id, "Consultation")
    access.require_project(tender.project_id, *perms)
    return tender


@router.get("/tenders/{tender_id}")
def get_tender(
    tender_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    return _tender_out(db, _tender(db, access, tender_id, "subcontracting:read"))


@router.put("/tenders/{tender_id}")
def update_tender(
    tender_id: uuid.UUID, data: TenderIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    tender = _tender(db, access, tender_id, "subcontracting:write")
    if tender.status != "draft":
        raise BusinessRuleError("Consultation publiée : modification par additif uniquement", code="TENDER_LOCKED")
    if data.project_id != tender.project_id:
        raise BusinessRuleError("Changement de projet interdit")
    _check_versions(db, tender.project_id, data.document_version_ids)
    for key in (
        "title",
        "description",
        "technical_spec",
        "deadline",
        "start_date_target",
        "duration_days_target",
        "variants_allowed",
        "exclusions",
    ):
        setattr(tender, key, getattr(data, key))
    tender.document_version_ids = [str(v) for v in data.document_version_ids]
    tender.quality_criteria = [c.model_dump() for c in data.quality_criteria] or service.DEFAULT_CRITERIA
    tender.lots.clear()
    db.flush()
    _build_lots(db, tender, data.lots)
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="UPDATE",
        resource_type="tender",
        resource_id=tender.id,
        project_id=tender.project_id,
    )
    db.commit()
    return _tender_out(db, tender)


class InviteIn(BaseModel):
    subcontractor_ids: list[uuid.UUID] = Field(min_length=1, max_length=100)


@router.post("/tenders/{tender_id}/invitations", status_code=201)
def invite(
    tender_id: uuid.UUID, data: InviteIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    tender = _tender(db, access, tender_id, "subcontracting:write")
    service.invite(db, tender, data.subcontractor_ids, user_id=access.p.id)
    db.commit()
    return _tender_out(db, tender)


@router.post("/tenders/{tender_id}/publish")
def publish(
    tender_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    tender = _tender(db, access, tender_id, "subcontracting:write")
    service.publish_tender(db, tender, user_id=access.p.id)
    db.commit()
    return _tender_out(db, tender)


class ReasonIn(BaseModel):
    reason: str = Field(min_length=5, max_length=4000)


@router.post("/tenders/{tender_id}/close")
def close_tender(
    tender_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    tender = _tender(db, access, tender_id, "subcontracting:write")
    if tender.status != "published":
        raise BusinessRuleError("Consultation non publiée")
    tender.status = "closed"
    tender.closed_at = utcnow()
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="CLOSE",
        resource_type="tender",
        resource_id=tender.id,
        project_id=tender.project_id,
    )
    db.commit()
    return _tender_out(db, tender)


@router.post("/tenders/{tender_id}/cancel")
def cancel_tender(
    tender_id: uuid.UUID, data: ReasonIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    tender = _tender(db, access, tender_id, "subcontracting:award")
    if tender.status in ("awarded", "cancelled"):
        raise BusinessRuleError("Consultation attribuée ou déjà annulée")
    tender.status = "cancelled"
    tender.closed_at = utcnow()
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="CANCEL",
        resource_type="tender",
        resource_id=tender.id,
        project_id=tender.project_id,
        reason=data.reason,
        criticality="MEDIUM",
    )
    db.commit()
    return _tender_out(db, tender)


def _bid_out(db: Session, bid: Bid, *, with_lines: bool = True) -> dict[str, Any]:
    sub = db.get(Subcontractor, bid.subcontractor_id)
    negotiations = (
        db.execute(select(BidNegotiation).where(BidNegotiation.bid_id == bid.id).order_by(BidNegotiation.round))
        .scalars()
        .all()
    )
    out = {
        **serialize(bid),
        "subcontractor": sub.legal_name if sub else "",
        "negotiations": [serialize(n) for n in negotiations],
    }
    if with_lines:
        out["lines"] = [serialize(line) for line in bid.lines]
    return jsonable(out)


@router.get("/tenders/{tender_id}/bids")
def tender_bids(
    tender_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    tender = _tender(db, access, tender_id, "subcontracting:read")
    bids = db.execute(select(Bid).where(Bid.tender_id == tender.id, Bid.status != "withdrawn")).scalars().all()
    if not _bids_open(tender):
        return {"sealed": True, "count": len(bids), "bids": []}
    return {"sealed": False, "count": len(bids), "bids": [_bid_out(db, b) for b in bids]}


@router.get("/tenders/{tender_id}/lots/{lot_id}/comparison")
def comparison(
    tender_id: uuid.UUID, lot_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    tender = _tender(db, access, tender_id, "subcontracting:read")
    if not _bids_open(tender):
        raise BusinessRuleError("Offres sous pli scellé jusqu'à la date limite", code="BIDS_SEALED")
    result = service.compare_bids(db, tender, lot_id)
    db.commit()
    return jsonable(result)


class EvaluationIn(BaseModel):
    technical_score: Decimal = Field(ge=0, le=100)
    evaluation: dict[str, Any] = Field(default_factory=dict)


def _bid(db: Session, access: Access, bid_id: uuid.UUID, *perms: str) -> tuple[Bid, Tender]:
    bid = _get(db, Bid, bid_id, "Offre")
    tender = _tender(db, access, bid.tender_id, *perms)
    return bid, tender


@router.post("/bids/{bid_id}/evaluation")
def evaluate_bid(
    bid_id: uuid.UUID, data: EvaluationIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    bid, tender = _bid(db, access, bid_id, "subcontracting:write")
    if not _bids_open(tender):
        raise BusinessRuleError("Offres sous pli scellé jusqu'à la date limite", code="BIDS_SEALED")
    bid.technical_score = data.technical_score
    bid.evaluation = jsonable(data.evaluation)
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="EVALUATE",
        resource_type="bid",
        resource_id=bid.id,
        project_id=tender.project_id,
        diff={"technical_score": str(data.technical_score)},
    )
    db.commit()
    return _bid_out(db, bid)


class NegotiationIn(BaseModel):
    amount: Decimal = Field(gt=0)
    duration_days: int | None = Field(default=None, ge=1, le=3650)
    comment: str | None = Field(default=None, max_length=4000)


@router.post("/bids/{bid_id}/negotiations", status_code=201)
def negotiate(
    bid_id: uuid.UUID, data: NegotiationIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    bid, tender = _bid(db, access, bid_id, "subcontracting:write")
    if not _bids_open(tender):
        raise BusinessRuleError("Négociation après ouverture des plis", code="BIDS_SEALED")
    service.negotiate(
        db,
        bid,
        proposed_by="globus",
        amount=data.amount,
        duration_days=data.duration_days,
        comment=data.comment,
        author_id=access.p.id,
    )
    db.commit()
    return _bid_out(db, bid)


@router.post("/bids/{bid_id}/negotiations/accept")
def accept_negotiation(
    bid_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    bid, _tender_obj = _bid(db, access, bid_id, "subcontracting:write")
    service.accept_negotiation(db, bid, accepted_by="globus")
    db.commit()
    return _bid_out(db, bid)


class AwardIn(BaseModel):
    bid_id: uuid.UUID
    title: str | None = Field(default=None, max_length=250)
    retention_pct: Decimal = Field(default=Decimal("5"), ge=0, le=20)
    advance_amount: Decimal = Field(default=Decimal("0"), ge=0)
    advance_recovery_pct: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    penalty_per_day: Decimal = Field(default=Decimal("0"), ge=0)
    start_date: date | None = None
    end_date: date | None = None
    terms: str | None = Field(default=None, max_length=50000)


@router.post("/tenders/{tender_id}/award", status_code=201)
def award(
    tender_id: uuid.UUID, data: AwardIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    tender = _tender(db, access, tender_id, "subcontracting:award")
    if not _bids_open(tender):
        raise BusinessRuleError("Attribution après ouverture des plis", code="BIDS_SEALED")
    bid = _get(db, Bid, data.bid_id, "Offre")
    if data.end_date and data.start_date and data.end_date < data.start_date:
        raise BusinessRuleError("Dates de marché incohérentes")
    if data.advance_amount > 0 and data.advance_recovery_pct == 0:
        raise BusinessRuleError("Taux de récupération de l'avance requis")
    contract = service.award(
        db,
        tender,
        bid,
        user_id=access.p.id,
        title=data.title,
        retention_pct=data.retention_pct,
        advance_amount=data.advance_amount,
        advance_recovery_pct=data.advance_recovery_pct,
        penalty_per_day=data.penalty_per_day,
        start_date=data.start_date,
        end_date=data.end_date,
        terms=data.terms,
    )
    db.commit()
    return _contract_out(db, contract)


# ============================================================================ marchés
class ContractItemIn(BaseModel):
    code: str | None = Field(default=None, max_length=30)
    designation: str = Field(min_length=2, max_length=300)
    unit: str = Field(default="u", min_length=1, max_length=20)
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)


class ContractIn(BaseModel):
    project_id: uuid.UUID
    lot_id: uuid.UUID | None = None
    subcontractor_id: uuid.UUID
    title: str = Field(min_length=3, max_length=250)
    justification: str = Field(min_length=10, max_length=4000)  # marché de gré à gré : exception tracée
    retention_pct: Decimal = Field(default=Decimal("5"), ge=0, le=20)
    advance_amount: Decimal = Field(default=Decimal("0"), ge=0)
    advance_recovery_pct: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    penalty_per_day: Decimal = Field(default=Decimal("0"), ge=0)
    penalty_cap_pct: Decimal = Field(default=Decimal("10"), ge=0, le=100)  # plafond des pénalités (% du marché)
    tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    start_date: date | None = None
    end_date: date | None = None
    terms: str | None = Field(default=None, max_length=50000)
    items: list[ContractItemIn] = Field(min_length=1, max_length=500)


class ContractUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=250)
    retention_pct: Decimal | None = Field(default=None, ge=0, le=20)
    advance_amount: Decimal | None = Field(default=None, ge=0)
    advance_recovery_pct: Decimal | None = Field(default=None, ge=0, le=100)
    penalty_per_day: Decimal | None = Field(default=None, ge=0)
    penalty_cap_pct: Decimal | None = Field(default=None, ge=0, le=100)
    tax_rate: Decimal | None = Field(default=None, ge=0, le=100)
    start_date: date | None = None
    end_date: date | None = None
    terms: str | None = Field(default=None, max_length=50000)
    items: list[ContractItemIn] | None = Field(default=None, min_length=1, max_length=500)


def _contract_out(db: Session, contract: Subcontract, *, detail: bool = False) -> dict[str, Any]:
    sub = db.get(Subcontractor, contract.subcontractor_id)
    project = db.get(Project, contract.project_id)
    out: dict[str, Any] = {
        **serialize(contract),
        "items": [serialize(i) for i in contract.items],
        "subcontractor": sub.legal_name if sub else "",
        "project": {"id": project.id, "code": project.code, "name": project.name} if project else None,
        "summary": service.subcontract_summary(db, contract),
    }
    if detail:
        out["mobilizations"] = [
            serialize(m)
            for m in db.execute(
                select(Mobilization).where(Mobilization.subcontract_id == contract.id).order_by(Mobilization.created_at)
            ).scalars()
        ]
        out["situations"] = [
            serialize(s)
            for s in db.execute(
                select(Situation).where(Situation.subcontract_id == contract.id).order_by(Situation.sequence)
            ).scalars()
        ]
        out["invoices"] = [
            serialize(i)
            for i in db.execute(
                select(SubcontractorInvoice)
                .where(SubcontractorInvoice.subcontract_id == contract.id)
                .order_by(SubcontractorInvoice.created_at)
            ).scalars()
        ]
    return jsonable(out)


def _contract(db: Session, access: Access, contract_id: uuid.UUID, *perms: str) -> Subcontract:
    contract = _get(db, Subcontract, contract_id, "Marché")
    access.require_project(contract.project_id, *perms)
    return contract


@router.get("/subcontracts")
def list_contracts(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    subcontractor_id: uuid.UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("subcontracting:read")
    stmt = access.filter_by_project(
        select(Subcontract).where(Subcontract.deleted_at.is_(None)), Subcontract.project_id, allow_null=False
    )
    for col, value in (
        (Subcontract.project_id, project_id),
        (Subcontract.subcontractor_id, subcontractor_id),
        (Subcontract.status, status),
    ):
        if value:
            stmt = stmt.where(col == value)
    return paginate(
        db,
        stmt,
        params,
        default_sort=Subcontract.created_at.desc(),
        search_columns=[Subcontract.number, Subcontract.title],
        transform=lambda c: _contract_out(db, c),
    )


@router.post("/subcontracts", status_code=201)
def create_contract(
    data: ContractIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require_project(data.project_id, "subcontracting:award")
    sub = _get(db, Subcontractor, data.subcontractor_id, "Sous-traitant")
    if sub.status not in service.ACTIVE_STATUSES:
        raise BusinessRuleError("Sous-traitant non qualifié", code="NOT_QUALIFIED")
    if data.lot_id:
        lot = db.get(Lot, data.lot_id)
        if lot is None or lot.project_id != data.project_id:
            raise BusinessRuleError("Lot hors projet")
    from app.core.numbering import next_number

    contract = Subcontract(
        number=next_number(db, "subcontract"),
        status="draft",
        created_by_id=access.p.id,
        **data.model_dump(exclude={"items", "justification"}),
    )
    for index, item in enumerate(data.items):
        contract.items.append(SubcontractItem(sort_order=index, **item.model_dump()))
    service.compute_contract(contract)
    db.add(contract)
    db.flush()
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="CREATE_DIRECT",
        resource_type="subcontract",
        resource_id=contract.id,
        project_id=contract.project_id,
        reason=data.justification,
        diff={"amount": str(contract.amount), "subcontractor": sub.legal_name},
        criticality="HIGH",
    )
    db.commit()
    return _contract_out(db, contract, detail=True)


@router.get("/subcontracts/{contract_id}")
def get_contract(
    contract_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    return _contract_out(db, _contract(db, access, contract_id, "subcontracting:read"), detail=True)


@router.patch("/subcontracts/{contract_id}")
def update_contract(
    contract_id: uuid.UUID, data: ContractUpdate, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    contract = _contract(db, access, contract_id, "subcontracting:write")
    if contract.status != "draft":
        raise BusinessRuleError("Marché transmis : modification par avenant uniquement", code="CONTRACT_LOCKED")
    values = data.model_dump(exclude_unset=True)
    items = values.pop("items", None)
    for key, value in values.items():
        setattr(contract, key, value)
    if items is not None:
        contract.items.clear()
        db.flush()
        for index, item in enumerate(items):
            contract.items.append(SubcontractItem(sort_order=index, **item))
    service.compute_contract(contract)
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="UPDATE",
        resource_type="subcontract",
        resource_id=contract.id,
        project_id=contract.project_id,
        diff={"fields": sorted(values)},
    )
    db.commit()
    return _contract_out(db, contract, detail=True)


@router.post("/subcontracts/{contract_id}/send")
def send_contract(
    contract_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    contract = _contract(db, access, contract_id, "subcontracting:award")
    service.send_contract(db, contract, user_id=access.p.id)
    db.commit()
    return _contract_out(db, contract, detail=True)


@router.get("/subcontracts/{contract_id}/pdf")
def contract_pdf(
    contract_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    contract = _contract(db, access, contract_id, "subcontracting:read")
    if contract.document_id and db.get(StoredFile, contract.document_id):
        return file_response(db.get(StoredFile, contract.document_id))
    return Response(
        service.contract_pdf(db, contract),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{contract.number}.pdf"'},
    )


class MobilizationIn(BaseModel):
    mobilization_date: date
    team_size: int = Field(ge=0, le=10000)
    supervisor_name: str | None = Field(default=None, max_length=200)
    equipment: str | None = Field(default=None, max_length=4000)
    site_access_granted: bool = False
    safety_induction_done: bool = False
    notes: str | None = Field(default=None, max_length=4000)


@router.post("/subcontracts/{contract_id}/mobilizations", status_code=201)
def mobilize(
    contract_id: uuid.UUID, data: MobilizationIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    contract = _contract(db, access, contract_id, "subcontracting:write")
    service.mobilize(db, contract, data=data.model_dump(), user_id=access.p.id)
    db.commit()
    return _contract_out(db, contract, detail=True)


@router.post("/subcontracts/{contract_id}/advance-invoice", status_code=201)
def advance_invoice(
    contract_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    contract = _contract(db, access, contract_id, "billing:write")
    invoice = service.advance_invoice(db, contract, user_id=access.p.id)
    db.commit()
    return jsonable(serialize(invoice))


class ReleaseIn(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0)
    reason: str = Field(min_length=5, max_length=2000)


@router.post("/subcontracts/{contract_id}/retention/release", status_code=201)
def release_retention(
    contract_id: uuid.UUID, data: ReleaseIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    contract = _contract(db, access, contract_id, "finance:approve")
    invoice = service.release_retention(db, contract, amount=data.amount, user_id=access.p.id, reason=data.reason)
    db.commit()
    return jsonable(serialize(invoice))


@router.post("/subcontracts/{contract_id}/close")
def close_contract(
    contract_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    contract = _contract(db, access, contract_id, "subcontracting:award")
    service.close_contract(db, contract, user_id=access.p.id)
    db.commit()
    return _contract_out(db, contract, detail=True)


@router.post("/subcontracts/{contract_id}/terminate")
def terminate_contract(
    contract_id: uuid.UUID, data: ReasonIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    contract = _contract(db, access, contract_id, "subcontracting:award")
    if contract.status in ("closed", "terminated"):
        raise BusinessRuleError("Marché déjà clos")
    contract.status = "terminated"
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="TERMINATE",
        resource_type="subcontract",
        resource_id=contract.id,
        project_id=contract.project_id,
        reason=data.reason,
        criticality="HIGH",
    )
    db.commit()
    return _contract_out(db, contract, detail=True)


# ============================================================================ situations
class SituationLineIn(BaseModel):
    item_id: uuid.UUID
    period_quantity: Decimal = Field(ge=0)


class SituationIn(BaseModel):
    period_start: date
    period_end: date
    lines: list[SituationLineIn] = Field(min_length=1, max_length=500)


def situation_out(db: Session, situation: Situation) -> dict[str, Any]:
    contract = db.get(Subcontract, situation.subcontract_id)
    items = {i.id: i for i in (contract.items if contract else [])}
    return jsonable(
        {
            **serialize(situation),
            "subcontract": {
                "id": contract.id,
                "number": contract.number,
                "title": contract.title,
                "amount": contract.amount,
            }
            if contract
            else None,
            "lines": [
                {
                    **serialize(line),
                    "designation": items[line.item_id].designation if line.item_id in items else "",
                    "unit": items[line.item_id].unit if line.item_id in items else "",
                    "contract_quantity": items[line.item_id].quantity if line.item_id in items else None,
                    "unit_price": items[line.item_id].unit_price if line.item_id in items else None,
                }
                for line in situation.lines
            ],
        }
    )


def _situation(db: Session, access: Access, situation_id: uuid.UUID, *perms: str) -> tuple[Situation, Subcontract]:
    situation = _get(db, Situation, situation_id, "Situation")
    contract = _contract(db, access, situation.subcontract_id, *perms)
    return situation, contract


@router.get("/situations")
def list_situations(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    subcontract_id: uuid.UUID | None = None,
    subcontractor_id: uuid.UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("subcontracting:read")
    stmt = select(Situation).join(Subcontract, Subcontract.id == Situation.subcontract_id)
    stmt = access.filter_by_project(stmt, Subcontract.project_id, allow_null=False)
    if project_id:
        stmt = stmt.where(Subcontract.project_id == project_id)
    if subcontract_id:
        stmt = stmt.where(Situation.subcontract_id == subcontract_id)
    if subcontractor_id:
        stmt = stmt.where(Subcontract.subcontractor_id == subcontractor_id)
    if status:
        stmt = stmt.where(Situation.status == status)
    return paginate(
        db,
        stmt,
        params,
        default_sort=Situation.created_at.desc(),
        search_columns=[Situation.number],
        transform=lambda s: situation_out(db, s),
    )


@router.get("/situations/{situation_id}")
def get_situation(
    situation_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    situation, _contract_obj = _situation(db, access, situation_id, "subcontracting:read")
    return situation_out(db, situation)


@router.post("/subcontracts/{contract_id}/situations", status_code=201)
def create_situation(
    contract_id: uuid.UUID, data: SituationIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    contract = _contract(db, access, contract_id, "subcontracting:write")
    situation = service.create_situation(
        db,
        contract,
        period_start=data.period_start,
        period_end=data.period_end,
        lines=[line.model_dump() for line in data.lines],
        user_id=access.p.id,
    )
    db.commit()
    return situation_out(db, situation)


async def _store_photo(
    db: Session,
    situation: Situation,
    file: UploadFile,
    user_id: uuid.UUID,
    latitude: float | None,
    longitude: float | None,
) -> StoredFile:
    if situation.status != "draft":
        raise BusinessRuleError("Situation soumise : pièces verrouillées")
    upload = validate_upload(file.filename or "photo", await file.read(), category="image")
    extra = {"geo": {"lat": latitude, "lng": longitude}} if latitude is not None and longitude is not None else None
    stored = store_private(
        db, upload, purpose="situations", classification="internal", uploaded_by_id=user_id, extra=extra
    )
    situation.photo_file_ids = [*situation.photo_file_ids, str(stored.id)]
    return stored


@router.post("/situations/{situation_id}/photos", status_code=201)
async def situation_photo(
    situation_id: uuid.UUID,
    file: UploadFile = File(...),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    situation, _contract_obj = _situation(db, access, situation_id, "subcontracting:write")
    stored = await _store_photo(db, situation, file, access.p.id, latitude, longitude)
    db.commit()
    return jsonable({"file_id": stored.id, "geo": stored.geo})


@router.get("/situations/{situation_id}/photos/{file_id}")
def situation_photo_file(
    situation_id: uuid.UUID, file_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    situation, _contract_obj = _situation(db, access, situation_id, "subcontracting:read")
    if str(file_id) not in situation.photo_file_ids:
        raise NotFound("Photo introuvable")
    return file_response(db.get(StoredFile, file_id))


@router.post("/situations/{situation_id}/submit")
def submit_situation(
    situation_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    situation, contract = _situation(db, access, situation_id, "subcontracting:write")
    service.submit_situation(db, situation, contract, user_id=access.p.id)
    db.commit()
    return situation_out(db, situation)


class FieldCheckIn(BaseModel):
    checked: dict[uuid.UUID, Decimal] = Field(default_factory=dict)
    notes: str | None = Field(default=None, max_length=4000)


@router.post("/situations/{situation_id}/field-check")
def field_check(
    situation_id: uuid.UUID, data: FieldCheckIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    situation, contract = _situation(db, access, situation_id, "subcontracting:read")
    if not access.p.has_any("subcontracting:validate", "site:report"):
        raise Forbidden("Constat réservé au conducteur / chef de chantier", code="PERMISSION_DENIED")
    service.field_check(
        db,
        situation,
        contract,
        checked={str(k): v for k, v in data.checked.items()},
        notes=data.notes,
        user_id=access.p.id,
    )
    db.commit()
    return situation_out(db, situation)


@router.post("/situations/{situation_id}/derogation")
def derogation(
    situation_id: uuid.UUID, data: ReasonIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    situation, contract = _situation(db, access, situation_id, "subcontracting:derogate")
    service.grant_derogation(db, situation, contract, user_id=access.p.id, reason=data.reason)
    db.commit()
    return situation_out(db, situation)


class ValidateIn(BaseModel):
    penalties_override: Decimal | None = Field(default=None, ge=0)
    penalties_reason: str | None = Field(default=None, max_length=2000)


@router.post("/situations/{situation_id}/validate")
def validate_situation(
    situation_id: uuid.UUID,
    data: ValidateIn | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    situation, contract = _situation(db, access, situation_id, "subcontracting:validate")
    try:
        service.validate_situation(
            db,
            situation,
            contract,
            user_id=access.p.id,
            penalties_override=data.penalties_override if data else None,
            penalties_reason=data.penalties_reason if data else None,
        )
    except BusinessRuleError as exc:
        if exc.code == "SITUATION_EXCEEDS_CONTRACT":
            db.commit()  # trace du blocage (alerte + tâche direction)
        raise
    db.commit()
    return situation_out(db, situation)


@router.post("/situations/{situation_id}/reject")
def reject_situation(
    situation_id: uuid.UUID, data: ReasonIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    situation, contract = _situation(db, access, situation_id, "subcontracting:validate")
    service.reject_situation(db, situation, contract, user_id=access.p.id, reason=data.reason)
    db.commit()
    return situation_out(db, situation)


# ============================================================================ factures sous-traitants
def _invoice(db: Session, access: Access, invoice_id: uuid.UUID, *perms: str) -> SubcontractorInvoice:
    invoice = _get(db, SubcontractorInvoice, invoice_id, "Facture sous-traitant")
    access.require(*perms)
    if invoice.project_id:
        access.require_project(invoice.project_id)
    return invoice


@router.get("/subcontractor-invoices")
def list_invoices(
    params: PageParams = Depends(),
    status: str | None = None,
    subcontractor_id: uuid.UUID | None = None,
    project_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("billing:read")
    stmt = access.filter_by_project(select(SubcontractorInvoice), SubcontractorInvoice.project_id)
    for col, value in (
        (SubcontractorInvoice.status, status),
        (SubcontractorInvoice.subcontractor_id, subcontractor_id),
        (SubcontractorInvoice.project_id, project_id),
    ):
        if value:
            stmt = stmt.where(col == value)
    return paginate(
        db,
        stmt,
        params,
        default_sort=SubcontractorInvoice.invoice_date.desc(),
        search_columns=[SubcontractorInvoice.number, SubcontractorInvoice.reference],
        transform=lambda i: jsonable(serialize(i)),
    )


@router.get("/subcontractor-invoices/{invoice_id}")
def get_invoice(
    invoice_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.finance.service import allocated_payments

    invoice = _invoice(db, access, invoice_id, "billing:read")
    situation = db.get(Situation, invoice.situation_id) if invoice.situation_id else None
    return jsonable(
        {
            **serialize(invoice),
            "situation": situation_out(db, situation) if situation else None,
            "payments": allocated_payments(db, "subcontractor_invoice", invoice.id),
        }
    )


@router.get("/subcontractor-invoices/{invoice_id}/file")
def get_invoice_file(
    invoice_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    invoice = _invoice(db, access, invoice_id, "billing:read")
    if not invoice.file_id:
        raise NotFound("Aucun fichier")
    return file_response(db.get(StoredFile, invoice.file_id))


@router.post("/situations/{situation_id}/invoice", status_code=201)
async def register_invoice(
    situation_id: uuid.UUID,
    reference: str = Form(..., min_length=1, max_length=80),
    invoice_date: date = Form(...),
    amount: Decimal = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    situation, contract = _situation(db, access, situation_id, "billing:write")
    upload = validate_upload(file.filename or "facture.pdf", await file.read(), category="media")
    stored = store_private(
        db, upload, purpose="subcontractor_invoices", classification="confidential", uploaded_by_id=access.p.id
    )
    invoice = service.submit_invoice(
        db,
        situation,
        contract,
        reference=reference,
        invoice_date=invoice_date,
        amount=amount,
        file_id=stored.id,
        user_id=access.p.id,
        source="manual",
    )
    db.commit()
    return jsonable(serialize(invoice))


@router.post("/subcontractor-invoices/{invoice_id}/validate")
def validate_invoice(
    invoice_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    invoice = _invoice(db, access, invoice_id, "billing:validate")
    service.validate_invoice(db, invoice, user_id=access.p.id)
    db.commit()
    return jsonable(serialize(invoice))


@router.post("/subcontractor-invoices/{invoice_id}/reject")
def reject_invoice(
    invoice_id: uuid.UUID, data: ReasonIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    invoice = _invoice(db, access, invoice_id, "billing:validate")
    service.reject_invoice(db, invoice, user_id=access.p.id, reason=data.reason)
    db.commit()
    return jsonable(serialize(invoice))


# ============================================================================ réclamations & litiges
class ClaimIn(BaseModel):
    subcontract_id: uuid.UUID | None = None
    subcontractor_id: uuid.UUID | None = None
    supplier_id: uuid.UUID | None = None
    title: str = Field(min_length=3, max_length=250)
    description: str | None = Field(default=None, max_length=8000)
    amount: Decimal = Field(default=Decimal("0"), ge=0)


@router.get("/claims")
def list_claims(
    params: PageParams = Depends(),
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("disputes:read")
    stmt = select(Claim)
    if status:
        stmt = stmt.where(Claim.status == status)
    return paginate(
        db,
        stmt,
        params,
        default_sort=Claim.created_at.desc(),
        search_columns=[Claim.title],
        transform=lambda c: jsonable(serialize(c)),
    )


@router.post("/claims", status_code=201)
def create_claim(data: ClaimIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("disputes:write")
    contract = db.get(Subcontract, data.subcontract_id) if data.subcontract_id else None
    if not (data.subcontractor_id or data.supplier_id or contract):
        raise BusinessRuleError("Partie requise (sous-traitant ou fournisseur)")
    claim = service.create_claim(
        db,
        subcontract=contract,
        subcontractor_id=data.subcontractor_id or (contract.subcontractor_id if contract else None),
        supplier_id=data.supplier_id,
        title=data.title,
        description=data.description,
        amount=data.amount,
        user_id=access.p.id,
    )
    db.commit()
    return jsonable(serialize(claim))


class ClaimAnswerIn(BaseModel):
    decision: str = Field(pattern="^(accept|reject|escalate)$")
    response: str = Field(min_length=5, max_length=8000)


@router.post("/claims/{claim_id}/answer")
def answer_claim(
    claim_id: uuid.UUID, data: ClaimAnswerIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("disputes:write")
    claim = _get(db, Claim, claim_id, "Réclamation")
    result = service.answer_claim(db, claim, decision=data.decision, response=data.response, user_id=access.p.id)
    db.commit()
    out = {"claim": serialize(claim)}
    if isinstance(result, Dispute):
        out["dispute"] = serialize(result)
    return jsonable(out)


class DisputeIn(BaseModel):
    party_type: str = Field(pattern="^(subcontractor|supplier|client)$")
    party_id: uuid.UUID
    related_type: str | None = Field(
        default=None,
        pattern="^(situation|subcontractor_invoice|supplier_invoice|purchase_order|goods_receipt|subcontract)$",
    )
    related_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    title: str = Field(min_length=3, max_length=250)
    description: str | None = Field(default=None, max_length=8000)
    amount_disputed: Decimal = Field(default=Decimal("0"), ge=0)
    freeze: bool = True
    owner_id: uuid.UUID | None = None
    file_ids: list[uuid.UUID] = Field(default_factory=list, max_length=30)


def dispute_out(db: Session, dispute: Dispute, *, party_view: bool = False) -> dict[str, Any]:
    events = (
        db.execute(
            select(DisputeEvent)
            .where(DisputeEvent.dispute_id == dispute.id)
            .order_by(DisputeEvent.created_at, DisputeEvent.id)
        )
        .scalars()
        .all()
    )
    out = {**serialize(dispute), "events": [serialize(e) for e in events]}
    if party_view:
        out.pop("owner_id", None)
        out.pop("decided_by_id", None)
    return jsonable(out)


@router.get("/disputes")
def list_disputes(
    params: PageParams = Depends(),
    status: str | None = None,
    party_type: str | None = None,
    project_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("disputes:read")
    stmt = access.filter_by_project(select(Dispute), Dispute.project_id)
    for col, value in ((Dispute.status, status), (Dispute.party_type, party_type), (Dispute.project_id, project_id)):
        if value:
            stmt = stmt.where(col == value)
    return paginate(
        db,
        stmt,
        params,
        default_sort=Dispute.created_at.desc(),
        search_columns=[Dispute.number, Dispute.title, Dispute.party_label],
        transform=lambda d: jsonable(serialize(d)),
    )


def _dispute(db: Session, access: Access, dispute_id: uuid.UUID, *perms: str) -> Dispute:
    dispute = _get(db, Dispute, dispute_id, "Litige")
    access.require(*perms)
    if dispute.project_id:
        access.require_project(dispute.project_id)
    return dispute


def _check_files(db: Session, file_ids: list[uuid.UUID], user_id: uuid.UUID) -> list[str]:
    for fid in file_ids:
        stored = db.get(StoredFile, fid)
        if stored is None or stored.uploaded_by_id != user_id:
            raise BusinessRuleError("Pièce jointe inconnue")
    return [str(f) for f in file_ids]


@router.post("/disputes", status_code=201)
def open_dispute(
    data: DisputeIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("disputes:write")
    if data.project_id:
        access.require_project(data.project_id)
    if data.related_type and not data.related_id:
        raise BusinessRuleError("Objet lié requis")
    dispute = service.open_dispute(
        db,
        party_type=data.party_type,
        party_id=data.party_id,
        related_type=data.related_type,
        related_id=data.related_id,
        title=data.title,
        description=data.description,
        amount_disputed=data.amount_disputed,
        freeze=data.freeze,
        owner_id=data.owner_id or access.p.id,
        opened_by_id=access.p.id,
        by_party=False,
        project_id=data.project_id,
        files=_check_files(db, data.file_ids, access.p.id),
    )
    db.commit()
    return dispute_out(db, dispute)


@router.get("/disputes/{dispute_id}")
def get_dispute(
    dispute_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    return dispute_out(db, _dispute(db, access, dispute_id, "disputes:read"))


class TransitionIn(BaseModel):
    to_status: str = Field(pattern="^(EN_ANALYSE|EN_NEGOCIATION|ESCALADE)$")
    content: str | None = Field(default=None, max_length=8000)
    file_ids: list[uuid.UUID] = Field(default_factory=list, max_length=30)


@router.post("/disputes/{dispute_id}/transition")
def transition_dispute(
    dispute_id: uuid.UUID, data: TransitionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    dispute = _dispute(db, access, dispute_id, "disputes:write")
    if data.to_status == "ESCALADE":
        access.require("disputes:decide")
    service.transition_dispute(
        db,
        dispute,
        to_status=data.to_status,
        content=data.content,
        user_id=access.p.id,
        files=_check_files(db, data.file_ids, access.p.id),
    )
    db.commit()
    return dispute_out(db, dispute)


class DisputeEventIn(BaseModel):
    kind: str = Field(pattern="^(comment|evidence|proposal|counter_proposal|agreement)$")
    content: str | None = Field(default=None, max_length=8000)
    amount: Decimal | None = Field(default=None, ge=0)
    file_ids: list[uuid.UUID] = Field(default_factory=list, max_length=30)


@router.post("/disputes/{dispute_id}/events", status_code=201)
def dispute_event(
    dispute_id: uuid.UUID, data: DisputeEventIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    dispute = _dispute(db, access, dispute_id, "disputes:write")
    service.add_dispute_event(
        db,
        dispute,
        kind=data.kind,
        content=data.content,
        amount=data.amount,
        files=_check_files(db, data.file_ids, access.p.id),
        user_id=access.p.id,
        side="globus",
    )
    db.commit()
    return dispute_out(db, dispute)


@router.post("/disputes/{dispute_id}/files", status_code=201)
async def dispute_file(
    dispute_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    _dispute(db, access, dispute_id, "disputes:write")
    upload = validate_upload(file.filename or "preuve", await file.read(), category="any")
    stored = store_private(db, upload, purpose="disputes", classification="confidential", uploaded_by_id=access.p.id)
    db.commit()
    return jsonable({"file_id": stored.id, "filename": stored.original_name})


@router.get("/disputes/{dispute_id}/files/{file_id}")
def dispute_file_download(
    dispute_id: uuid.UUID, file_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    dispute = _dispute(db, access, dispute_id, "disputes:read")
    allowed = {
        f
        for e in db.execute(select(DisputeEvent).where(DisputeEvent.dispute_id == dispute.id)).scalars()
        for f in e.file_ids
    }
    if str(file_id) not in allowed:
        raise NotFound("Pièce introuvable")
    return file_response(db.get(StoredFile, file_id), watermark_text=watermark_label(access.p.user))


class DecisionIn(BaseModel):
    amount_accepted: Decimal = Field(ge=0)
    amount_refused: Decimal = Field(ge=0)
    summary: str = Field(min_length=5, max_length=8000)
    file_ids: list[uuid.UUID] = Field(default_factory=list, max_length=30)


@router.post("/disputes/{dispute_id}/decision")
def decide_dispute(
    dispute_id: uuid.UUID, data: DecisionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    dispute = _dispute(db, access, dispute_id, "disputes:decide")
    service.decide_dispute(
        db,
        dispute,
        amount_accepted=data.amount_accepted,
        amount_refused=data.amount_refused,
        summary=data.summary,
        files=_check_files(db, data.file_ids, access.p.id),
        user_id=access.p.id,
    )
    db.commit()
    return dispute_out(db, dispute)


class ResolveIn(BaseModel):
    comment: str | None = Field(default=None, max_length=8000)


@router.post("/disputes/{dispute_id}/resolve")
def resolve_dispute(
    dispute_id: uuid.UUID,
    data: ResolveIn | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    dispute = _dispute(db, access, dispute_id, "disputes:decide")
    service.resolve_dispute(db, dispute, user_id=access.p.id, comment=data.comment if data else None)
    db.commit()
    return dispute_out(db, dispute)


# ============================================================================ extranet sous-traitant
def my_subcontractor(db: Session, access: Access) -> Subcontractor:
    access.require("extranet:subcontractor")
    if not access.p.organization_id:
        raise Forbidden("Compte non rattaché à un sous-traitant", code="ORGANIZATION_REQUIRED")
    sub = db.execute(
        select(Subcontractor).where(
            Subcontractor.organization_id == access.p.organization_id, Subcontractor.deleted_at.is_(None)
        )
    ).scalar_one_or_none()
    if sub is None:
        raise Forbidden("Aucun sous-traitant rattaché à votre organisation", code="ORGANIZATION_REQUIRED")
    return sub


def _my_contract(db: Session, sub: Subcontractor, contract_id: uuid.UUID) -> Subcontract:
    contract = db.get(Subcontract, contract_id)
    if (
        contract is None
        or contract.subcontractor_id != sub.id
        or contract.deleted_at is not None
        or contract.status == "draft"
    ):
        raise NotFound("Marché introuvable")
    return contract


def _my_situation(db: Session, sub: Subcontractor, situation_id: uuid.UUID) -> tuple[Situation, Subcontract]:
    situation = db.get(Situation, situation_id)
    if situation is None:
        raise NotFound("Situation introuvable")
    return situation, _my_contract(db, sub, situation.subcontract_id)


def _my_invitation(db: Session, sub: Subcontractor, tender_id: uuid.UUID) -> tuple[Tender, TenderInvitation]:
    tender = db.get(Tender, tender_id)
    invitation = db.execute(
        select(TenderInvitation).where(
            TenderInvitation.tender_id == tender_id, TenderInvitation.subcontractor_id == sub.id
        )
    ).scalar_one_or_none()
    if tender is None or invitation is None or tender.status == "draft" or tender.deleted_at is not None:
        raise NotFound("Consultation introuvable")
    return tender, invitation


@extranet.get("/profile")
def ext_profile(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    sub = my_subcontractor(db, access)
    data = subcontractor_out(db, sub, detail=True)
    data.pop("notes", None)
    return data


class ExtProfileIn(BaseModel):
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    whatsapp: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=1000)
    workforce_size: int | None = Field(default=None, ge=0, le=100000)
    zones: list[str] | None = Field(default=None, max_length=50)
    insurance_rc_until: date | None = None
    insurance_decennale_until: date | None = None


@extranet.patch("/profile")
def ext_update_profile(
    data: ExtProfileIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    sub = my_subcontractor(db, access)
    values = _normalize(data.model_dump(exclude_unset=True))
    for key, value in values.items():
        setattr(sub, key, value)
    audit.record(
        db,
        family="business",
        module="extranet",
        action="PROFILE_UPDATE",
        resource_type="subcontractor",
        resource_id=sub.id,
        diff={"fields": sorted(values)},
    )
    db.commit()
    return subcontractor_out(db, sub, detail=True)


@extranet.post("/files", status_code=201)
async def ext_upload(
    file: UploadFile = File(...), db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Dépôt de pièce (mémoire technique, attestation, preuve de litige, facture)."""
    my_subcontractor(db, access)
    upload = validate_upload(file.filename or "document", await file.read(), category="media")
    stored = store_private(
        db, upload, purpose="extranet_subcontractor", classification="confidential", uploaded_by_id=access.p.id
    )
    db.commit()
    return jsonable({"file_id": stored.id, "filename": stored.original_name})


@extranet.get("/tenders")
def ext_tenders(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    sub = my_subcontractor(db, access)
    rows = db.execute(
        select(Tender, TenderInvitation)
        .join(TenderInvitation, TenderInvitation.tender_id == Tender.id)
        .where(TenderInvitation.subcontractor_id == sub.id, Tender.status != "draft", Tender.deleted_at.is_(None))
        .order_by(Tender.deadline.desc())
    ).all()
    return jsonable(
        [
            {
                "id": t.id,
                "number": t.number,
                "title": t.title,
                "deadline": t.deadline,
                "status": t.status,
                "invitation_status": inv.status,
                "open": t.status == "published" and not service.deadline_reached(t),
            }
            for t, inv in rows
        ]
    )


@extranet.get("/tenders/{tender_id}")
def ext_tender(
    tender_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    sub = my_subcontractor(db, access)
    tender, invitation = _my_invitation(db, sub, tender_id)
    if invitation.viewed_at is None:
        invitation.viewed_at = utcnow()
        if invitation.status == "invited":
            invitation.status = "viewed"
        db.commit()
    documents = []
    for vid in tender.document_version_ids or []:
        version = db.get(DocumentVersion, uuid.UUID(str(vid)))
        document = db.get(Document, version.document_id) if version else None
        if version is None or document is None:
            continue
        documents.append(
            {
                "title": document.title,
                "version": f"{version.version_major}.{version.version_minor}",
                "status": version.status,
                "original_name": version.original_name,
                "url": signed_url(version.file_id, user_id=access.p.id, watermark_text=watermark_label(access.p.user)),
            }
        )
    my_bids = db.execute(select(Bid).where(Bid.tender_id == tender.id, Bid.subcontractor_id == sub.id)).scalars().all()
    project = db.get(Project, tender.project_id)
    return jsonable(
        {
            "id": tender.id,
            "number": tender.number,
            "title": tender.title,
            "description": tender.description,
            "technical_spec": tender.technical_spec,
            "deadline": tender.deadline,
            "status": tender.status,
            "project": {"name": project.name, "city": project.city} if project else None,
            "start_date_target": tender.start_date_target,
            "duration_days_target": tender.duration_days_target,
            "quality_criteria": tender.quality_criteria,
            "variants_allowed": tender.variants_allowed,
            "exclusions": tender.exclusions,
            "documents": documents,
            "lots": [{**serialize(lot), "items": [serialize(i) for i in lot.items]} for lot in tender.lots],
            "invitation_status": invitation.status,
            "my_bids": [_bid_out(db, b) for b in my_bids],
        }
    )


@extranet.post("/tenders/{tender_id}/decline")
def ext_decline(
    tender_id: uuid.UUID, data: ReasonIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, str]:
    sub = my_subcontractor(db, access)
    tender, invitation = _my_invitation(db, sub, tender_id)
    if invitation.status == "submitted":
        raise BusinessRuleError("Offre déjà déposée : la retirer avant de décliner")
    invitation.status = "declined"
    invitation.responded_at = utcnow()
    audit.record(
        db,
        family="business",
        module="extranet",
        action="TENDER_DECLINE",
        resource_type="tender",
        resource_id=tender.id,
        project_id=tender.project_id,
        reason=data.reason,
    )
    db.commit()
    return {"status": "declined"}


class BidLineIn(BaseModel):
    tender_item_id: uuid.UUID | None = None
    designation: str | None = Field(default=None, max_length=300)
    unit: str | None = Field(default=None, max_length=20)
    quantity: Decimal | None = Field(default=None, ge=0)
    unit_price: Decimal = Field(ge=0)


class BidIn(BaseModel):
    tender_lot_id: uuid.UUID
    duration_days: int | None = Field(default=None, ge=1, le=3650)
    is_variant: bool = False
    variant_description: str | None = Field(default=None, max_length=8000)
    exclusions: str | None = Field(default=None, max_length=8000)
    technical_memo_file_id: uuid.UUID | None = None
    lines: list[BidLineIn] = Field(min_length=1, max_length=1000)


@extranet.post("/tenders/{tender_id}/bids", status_code=201)
def ext_submit_bid(
    tender_id: uuid.UUID, data: BidIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Le sous-traitant soumet son devis (V4-SUB-14)."""
    sub = my_subcontractor(db, access)
    tender, _invitation = _my_invitation(db, sub, tender_id)
    if data.technical_memo_file_id:
        _check_files(db, [data.technical_memo_file_id], access.p.id)
    if data.is_variant and not (data.variant_description or "").strip():
        raise BusinessRuleError("Description de la variante requise")
    bid = service.submit_bid(
        db,
        tender,
        tender_lot_id=data.tender_lot_id,
        subcontractor=sub,
        lines=[line.model_dump() for line in data.lines],
        duration_days=data.duration_days,
        is_variant=data.is_variant,
        variant_description=data.variant_description,
        exclusions=data.exclusions,
        memo_file_id=data.technical_memo_file_id,
        user_id=access.p.id,
    )
    db.commit()
    return _bid_out(db, bid)


def _my_bid(db: Session, sub: Subcontractor, bid_id: uuid.UUID) -> Bid:
    bid = db.get(Bid, bid_id)
    if bid is None or bid.subcontractor_id != sub.id:
        raise NotFound("Offre introuvable")
    return bid


@extranet.post("/bids/{bid_id}/withdraw")
def ext_withdraw(
    bid_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    sub = my_subcontractor(db, access)
    bid = _my_bid(db, sub, bid_id)
    tender = db.get(Tender, bid.tender_id)
    if bid.status != "submitted" or tender is None or service.deadline_reached(tender):
        raise BusinessRuleError("Retrait impossible (date limite passée ou offre en cours d'instruction)")
    bid.status = "withdrawn"
    audit.record(
        db,
        family="business",
        module="extranet",
        action="BID_WITHDRAW",
        resource_type="bid",
        resource_id=bid.id,
        project_id=tender.project_id,
    )
    db.commit()
    return _bid_out(db, bid)


@extranet.post("/bids/{bid_id}/negotiations", status_code=201)
def ext_counter(
    bid_id: uuid.UUID, data: NegotiationIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    sub = my_subcontractor(db, access)
    bid = _my_bid(db, sub, bid_id)
    service.negotiate(
        db,
        bid,
        proposed_by="subcontractor",
        amount=data.amount,
        duration_days=data.duration_days,
        comment=data.comment,
        author_id=access.p.id,
    )
    db.commit()
    return _bid_out(db, bid)


@extranet.post("/bids/{bid_id}/negotiations/accept")
def ext_accept(
    bid_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    sub = my_subcontractor(db, access)
    bid = _my_bid(db, sub, bid_id)
    service.accept_negotiation(db, bid, accepted_by="subcontractor")
    db.commit()
    return _bid_out(db, bid)


@extranet.get("/subcontracts")
def ext_contracts(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    sub = my_subcontractor(db, access)
    rows = db.execute(
        select(Subcontract)
        .where(Subcontract.subcontractor_id == sub.id, Subcontract.status != "draft", Subcontract.deleted_at.is_(None))
        .order_by(Subcontract.created_at.desc())
    ).scalars()
    return [_contract_out(db, c) for c in rows]


@extranet.get("/subcontracts/{contract_id}")
def ext_contract(
    contract_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    sub = my_subcontractor(db, access)
    return _contract_out(db, _my_contract(db, sub, contract_id), detail=True)


@extranet.get("/subcontracts/{contract_id}/pdf")
def ext_contract_pdf(
    contract_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    sub = my_subcontractor(db, access)
    contract = _my_contract(db, sub, contract_id)
    if contract.document_id and db.get(StoredFile, contract.document_id):
        return file_response(db.get(StoredFile, contract.document_id), inline=False)
    return Response(
        service.contract_pdf(db, contract),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{contract.number}.pdf"'},
    )


@extranet.post("/subcontracts/{contract_id}/sign/otp")
def ext_sign_otp(
    contract_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.identity.service import issue_otp

    sub = my_subcontractor(db, access)
    contract = _my_contract(db, sub, contract_id)
    if contract.status != "sent":
        raise BusinessRuleError("Marché non transmis pour signature")
    result = issue_otp(
        db,
        access.p.user,
        purpose="subcontract_sign",
        payload={"subcontract_id": str(contract.id), "label": f"Signature du marché {contract.number}"},
    )
    db.commit()
    return result


class SignIn(BaseModel):
    otp_token: str = Field(min_length=10, max_length=200)
    code: str = Field(min_length=4, max_length=10)
    signer_name: str = Field(min_length=3, max_length=200)
    accept_terms: bool


@extranet.post("/subcontracts/{contract_id}/sign")
def ext_sign(
    contract_id: uuid.UUID, data: SignIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.identity.service import verify_otp

    sub = my_subcontractor(db, access)
    contract = _my_contract(db, sub, contract_id)
    if not data.accept_terms:
        raise BusinessRuleError("Acceptation des conditions du marché requise")
    proof = verify_otp(db, access.p.user, purpose="subcontract_sign", otp_token=data.otp_token, code=data.code)
    if proof["payload"].get("subcontract_id") != str(contract.id):
        raise BusinessRuleError("Code émis pour un autre marché", code="OTP_INVALID")
    service.sign_contract(
        db,
        contract,
        signer_name=data.signer_name,
        user_id=access.p.id,
        otp={"verified_at": proof["verified_at"], "channel": proof["channel"], "token_id": proof["token_id"]},
    )
    db.commit()
    return _contract_out(db, contract, detail=True)


@extranet.get("/situations")
def ext_situations(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    sub = my_subcontractor(db, access)
    rows = db.execute(
        select(Situation)
        .join(Subcontract, Subcontract.id == Situation.subcontract_id)
        .where(Subcontract.subcontractor_id == sub.id)
        .order_by(Situation.created_at.desc())
    ).scalars()
    return [situation_out(db, s) for s in rows]


@extranet.post("/subcontracts/{contract_id}/situations", status_code=201)
def ext_create_situation(
    contract_id: uuid.UUID, data: SituationIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Le sous-traitant soumet sa situation (V4-SUB-14) ; blocage au-delà du marché (V4-SUB-15)."""
    sub = my_subcontractor(db, access)
    contract = _my_contract(db, sub, contract_id)
    situation = service.create_situation(
        db,
        contract,
        period_start=data.period_start,
        period_end=data.period_end,
        lines=[line.model_dump() for line in data.lines],
        user_id=access.p.id,
    )
    db.commit()
    return situation_out(db, situation)


@extranet.get("/situations/{situation_id}")
def ext_situation(
    situation_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    sub = my_subcontractor(db, access)
    situation, _contract_obj = _my_situation(db, sub, situation_id)
    return situation_out(db, situation)


@extranet.post("/situations/{situation_id}/photos", status_code=201)
async def ext_situation_photo(
    situation_id: uuid.UUID,
    file: UploadFile = File(...),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    sub = my_subcontractor(db, access)
    situation, _contract_obj = _my_situation(db, sub, situation_id)
    stored = await _store_photo(db, situation, file, access.p.id, latitude, longitude)
    db.commit()
    return jsonable({"file_id": stored.id, "geo": stored.geo})


@extranet.get("/situations/{situation_id}/photos/{file_id}")
def ext_situation_photo_file(
    situation_id: uuid.UUID, file_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    sub = my_subcontractor(db, access)
    situation, _contract_obj = _my_situation(db, sub, situation_id)
    if str(file_id) not in situation.photo_file_ids:
        raise NotFound("Photo introuvable")
    return file_response(db.get(StoredFile, file_id))


@extranet.post("/situations/{situation_id}/submit")
def ext_submit_situation(
    situation_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    sub = my_subcontractor(db, access)
    situation, contract = _my_situation(db, sub, situation_id)
    service.submit_situation(db, situation, contract, user_id=access.p.id)
    db.commit()
    return situation_out(db, situation)


@extranet.post("/situations/{situation_id}/invoice", status_code=201)
async def ext_invoice(
    situation_id: uuid.UUID,
    reference: str = Form(..., min_length=1, max_length=80),
    invoice_date: date = Form(...),
    amount: Decimal = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    """Le sous-traitant soumet sa facture sur situation validée (V4-SUB-14)."""
    sub = my_subcontractor(db, access)
    situation, contract = _my_situation(db, sub, situation_id)
    if situation.status != "validated":
        raise BusinessRuleError("Facturation possible uniquement sur situation validée", code="SITUATION_NOT_VALIDATED")
    duplicate = db.execute(
        select(SubcontractorInvoice.id).where(
            SubcontractorInvoice.subcontractor_id == sub.id, SubcontractorInvoice.reference == reference
        )
    ).first()
    if duplicate:
        raise Conflict("Référence de facture déjà utilisée", code="DUPLICATE_INVOICE")
    upload = validate_upload(file.filename or "facture.pdf", await file.read(), category="media")
    stored = store_private(
        db, upload, purpose="subcontractor_invoices", classification="confidential", uploaded_by_id=access.p.id
    )
    invoice = service.submit_invoice(
        db,
        situation,
        contract,
        reference=reference,
        invoice_date=invoice_date,
        amount=amount,
        file_id=stored.id,
        user_id=access.p.id,
    )
    db.commit()
    return jsonable(serialize(invoice))


@extranet.get("/invoices")
def ext_invoices(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    sub = my_subcontractor(db, access)
    rows = db.execute(
        select(SubcontractorInvoice)
        .where(SubcontractorInvoice.subcontractor_id == sub.id)
        .order_by(SubcontractorInvoice.invoice_date.desc())
    ).scalars()
    return [jsonable({k: v for k, v in serialize(i).items() if k not in ("validated_by_id",)}) for i in rows]


@extranet.get("/payments")
def ext_payments(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    from app.modules.finance.models import Payment

    sub = my_subcontractor(db, access)
    rows = db.execute(
        select(Payment)
        .where(
            Payment.counterparty_type == "subcontractor", Payment.counterparty_id == sub.id, Payment.direction == "out"
        )
        .order_by(Payment.created_at.desc())
        .limit(200)
    ).scalars()
    return jsonable(
        [
            {"number": p.number, "amount": p.amount, "status": p.status, "method": p.method, "paid_at": p.paid_at}
            for p in rows
        ]
    )


class ExtClaimIn(BaseModel):
    subcontract_id: uuid.UUID | None = None
    title: str = Field(min_length=3, max_length=250)
    description: str | None = Field(default=None, max_length=8000)
    amount: Decimal = Field(default=Decimal("0"), ge=0)


@extranet.get("/claims")
def ext_claims(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    sub = my_subcontractor(db, access)
    rows = db.execute(select(Claim).where(Claim.subcontractor_id == sub.id).order_by(Claim.created_at.desc())).scalars()
    return [jsonable(serialize(c)) for c in rows]


@extranet.post("/claims", status_code=201)
def ext_create_claim(
    data: ExtClaimIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    sub = my_subcontractor(db, access)
    contract = _my_contract(db, sub, data.subcontract_id) if data.subcontract_id else None
    claim = service.create_claim(
        db,
        subcontract=contract,
        subcontractor_id=sub.id,
        supplier_id=None,
        title=data.title,
        description=data.description,
        amount=data.amount,
        user_id=access.p.id,
    )
    db.commit()
    return jsonable(serialize(claim))


def _my_dispute(db: Session, sub: Subcontractor, dispute_id: uuid.UUID) -> Dispute:
    dispute = db.get(Dispute, dispute_id)
    if dispute is None or dispute.party_type != "subcontractor" or dispute.party_id != sub.id:
        raise NotFound("Litige introuvable")
    return dispute


@extranet.get("/disputes")
def ext_disputes(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    sub = my_subcontractor(db, access)
    rows = db.execute(
        select(Dispute)
        .where(Dispute.party_type == "subcontractor", Dispute.party_id == sub.id)
        .order_by(Dispute.created_at.desc())
    ).scalars()
    return [jsonable({k: v for k, v in serialize(d).items() if k not in ("owner_id", "decided_by_id")}) for d in rows]


@extranet.get("/disputes/{dispute_id}")
def ext_dispute(
    dispute_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    sub = my_subcontractor(db, access)
    return dispute_out(db, _my_dispute(db, sub, dispute_id), party_view=True)


class ExtDisputeIn(BaseModel):
    subcontract_id: uuid.UUID | None = None
    situation_id: uuid.UUID | None = None
    title: str = Field(min_length=3, max_length=250)
    description: str = Field(min_length=10, max_length=8000)
    amount_disputed: Decimal = Field(default=Decimal("0"), ge=0)
    file_ids: list[uuid.UUID] = Field(default_factory=list, max_length=30)


@extranet.post("/disputes", status_code=201)
def ext_open_dispute(
    data: ExtDisputeIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    sub = my_subcontractor(db, access)
    related_type, related_id, project_id = None, None, None
    if data.situation_id:
        situation, contract = _my_situation(db, sub, data.situation_id)
        related_type, related_id, project_id = "situation", situation.id, contract.project_id
    elif data.subcontract_id:
        contract = _my_contract(db, sub, data.subcontract_id)
        related_type, related_id, project_id = "subcontract", contract.id, contract.project_id
    dispute = service.open_dispute(
        db,
        party_type="subcontractor",
        party_id=sub.id,
        related_type=related_type,
        related_id=related_id,
        title=data.title,
        description=data.description,
        amount_disputed=data.amount_disputed,
        freeze=False,
        owner_id=None,
        opened_by_id=access.p.id,
        by_party=True,
        project_id=project_id,
        files=_check_files(db, data.file_ids, access.p.id),
    )
    db.commit()
    return dispute_out(db, dispute, party_view=True)


@extranet.get("/disputes/{dispute_id}/files/{file_id}")
def ext_dispute_file(
    dispute_id: uuid.UUID, file_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    """Pièces de la chronologie du litige, filigranées au nom du partenaire."""
    sub = my_subcontractor(db, access)
    dispute = _my_dispute(db, sub, dispute_id)
    allowed = {
        f
        for e in db.execute(select(DisputeEvent).where(DisputeEvent.dispute_id == dispute.id)).scalars()
        for f in e.file_ids
    }
    if str(file_id) not in allowed:
        raise NotFound("Pièce introuvable")
    return file_response(db.get(StoredFile, file_id), watermark_text=watermark_label(access.p.user))


class ExtDisputeEventIn(BaseModel):
    kind: str = Field(pattern="^(comment|evidence|counter_proposal|agreement)$")
    content: str | None = Field(default=None, max_length=8000)
    amount: Decimal | None = Field(default=None, ge=0)
    file_ids: list[uuid.UUID] = Field(default_factory=list, max_length=30)


@extranet.post("/disputes/{dispute_id}/events", status_code=201)
def ext_dispute_event(
    dispute_id: uuid.UUID, data: ExtDisputeEventIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    sub = my_subcontractor(db, access)
    dispute = _my_dispute(db, sub, dispute_id)
    service.add_dispute_event(
        db,
        dispute,
        kind=data.kind,
        content=data.content,
        amount=data.amount,
        files=_check_files(db, data.file_ids, access.p.id),
        user_id=access.p.id,
        side="party",
    )
    db.commit()
    return dispute_out(db, dispute, party_view=True)
