"""API Achats prédictifs (A3) : indice des prix des matériaux, observations, recommandations d'achat anticipé."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.database import get_db
from app.core.errors import BusinessRuleError, NotFound
from app.core.utils import jsonable, utcnow
from app.modules.market import service
from app.modules.market.models import PriceObservation, PurchaseRecommendation

router = APIRouter(prefix="/market", tags=["Achats prédictifs"])


@router.get("/index")
def price_index(
    weeks: int | None = Query(None, ge=4, le=104), db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    """Indice local des prix (base 100), tendance 4 semaines et prévision par famille du panier."""
    access.require("procurement:read")
    return service.price_index(db, weeks)


@router.get("/observations")
def observations(
    family: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    from app.modules.suppliers.models import Supplier

    access.require("procurement:read")
    stmt = select(PriceObservation, Supplier.legal_name).outerjoin(
        Supplier, Supplier.id == PriceObservation.supplier_id
    )
    if family:
        stmt = stmt.where(PriceObservation.family == family)
    rows = db.execute(stmt.order_by(PriceObservation.observed_on.desc()).limit(limit)).all()
    return jsonable(
        [
            {
                "id": o.id,
                "family": o.family,
                "label": o.label,
                "unit": o.unit,
                "unit_price": o.unit_price,
                "raw_unit": o.raw_unit,
                "raw_price": o.raw_price,
                "observed_on": o.observed_on,
                "source_type": o.source_type,
                "supplier": supplier,
            }
            for o, supplier in rows
        ]
    )


@router.get("/recommendations")
def recommendations(
    status: str | None = "open", db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require("procurement:read")
    stmt = select(PurchaseRecommendation)
    if status:
        stmt = stmt.where(PurchaseRecommendation.status == status)
    rows = db.execute(stmt.order_by(PurchaseRecommendation.expected_saving.desc())).scalars()
    return [service.recommendation_out(db, r) for r in rows]


def _rec(db: Session, rec_id: uuid.UUID) -> PurchaseRecommendation:
    rec = db.get(PurchaseRecommendation, rec_id)
    if rec is None:
        raise NotFound("Recommandation introuvable")
    if rec.status != "open":
        raise BusinessRuleError("Recommandation déjà traitée")
    return rec


class DecisionIn(BaseModel):
    note: str | None = Field(default=None, max_length=2000)


def _decide(db: Session, access: Access, rec_id: uuid.UUID, status: str, note: str | None) -> dict[str, Any]:
    rec = _rec(db, rec_id)
    rec.status = status
    rec.decided_by_id = access.p.id
    rec.decided_at = utcnow()
    rec.decision_note = note
    audit.record(
        db,
        family="business",
        module="market",
        action="RECOMMENDATION_" + status.upper(),
        resource_type="purchase_recommendation",
        resource_id=rec.id,
        reason=note,
    )
    db.commit()
    return service.recommendation_out(db, rec)


@router.post("/recommendations/{rec_id}/accept")
def accept(
    rec_id: uuid.UUID, data: DecisionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """L'acheteur s'engage à commander par anticipation (les demandes d'achat liées sont listées pour conversion)."""
    access.require("procurement:order")
    return _decide(db, access, rec_id, "accepted", data.note)


@router.post("/recommendations/{rec_id}/dismiss")
def dismiss(
    rec_id: uuid.UUID, data: DecisionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("procurement:order")
    if not (data.note or "").strip():
        raise BusinessRuleError("Motif requis pour écarter une recommandation")
    return _decide(db, access, rec_id, "dismissed", data.note)


@router.post("/refresh")
def refresh(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """Collecte immédiate des prix et recalcul des recommandations (sinon chaque nuit)."""
    access.require("procurement:approve")
    result = service.daily_job(db)
    db.commit()
    return result
