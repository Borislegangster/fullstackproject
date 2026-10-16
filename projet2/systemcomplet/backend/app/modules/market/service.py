"""Indice local des prix des matériaux et achats prédictifs (innovation A3).

1. Collecte : chaque prix vu dans l'ERP (catalogues et historiques des fournisseurs de l'extranet, bons de commande,
   factures validées) est rattaché à une famille du panier (ciment, fer HA10…) et ramené à son unité de référence.
2. Indice : médiane hebdomadaire par famille, base 100 sur la première semaine de la fenêtre ; tendance 4 semaines ;
   prévision à 4 semaines par régression linéaire sur les 12 dernières semaines.
3. Recommandations : si la hausse prévue dépasse le seuil, les besoins déjà exprimés (demandes d'achat soumises /
   approuvées non commandées, articles sous le seuil de réapprovisionnement) sont signalés à l'acheteur avec
   l'économie attendue en commandant maintenant. Jamais d'achat automatique : décision humaine.
"""

from __future__ import annotations

import logging
import statistics
import unicodedata
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.events import emit
from app.core.utils import jsonable, money, utcnow
from app.modules.market.models import PriceObservation, PurchaseRecommendation

log = logging.getLogger("globus.market")

# Panier par défaut (Setting « price_basket » pour le remplacer) : mots-clés normalisés (minuscules, sans accents),
# unité de référence et facteurs de conversion (prix dans l'unité observée × facteur = prix dans l'unité de référence).
DEFAULT_BASKET: list[dict[str, Any]] = [
    {"key": "ciment", "label": "Ciment (sac de 50 kg)", "keywords": ["ciment"], "unit": "sac",
     "conversions": {"sac": 1, "u": 1, "t": 0.05, "kg": 50}},
    {"key": "fer_ha8", "label": "Fer HA8 (barre de 12 m)", "keywords": ["ha8", "ha 8", "fer de 8", "fer 8 "],
     "unit": "barre", "conversions": {"barre": 1, "u": 1}},
    {"key": "fer_ha10", "label": "Fer HA10 (barre de 12 m)", "keywords": ["ha10", "ha 10", "fer de 10", "fer 10 "],
     "unit": "barre", "conversions": {"barre": 1, "u": 1}},
    {"key": "fer_ha12", "label": "Fer HA12 (barre de 12 m)", "keywords": ["ha12", "ha 12", "fer de 12", "fer 12 "],
     "unit": "barre", "conversions": {"barre": 1, "u": 1}},
    {"key": "sable", "label": "Sable (m³)", "keywords": ["sable"], "unit": "m3", "conversions": {"m3": 1, "t": 1.6}},
    {"key": "gravier", "label": "Gravier / concassé (m³)", "keywords": ["gravier", "gravillon", "concasse"],
     "unit": "m3", "conversions": {"m3": 1, "t": 1.5}},
    {"key": "parpaing_15", "label": "Parpaing de 15", "keywords": ["parpaing de 15", "parpaing 15", "agglo 15",
     "agglos de 15", "bloc de 15", "bloc 15"], "unit": "u", "conversions": {"u": 1}},
    {"key": "tole", "label": "Tôle de couverture (feuille)", "keywords": ["tole", "bac alu", "bac acier"],
     "unit": "u", "conversions": {"u": 1, "feuille": 1}},
]  # fmt: skip
DEFAULTS: dict[str, Any] = {"alert_pct": 3.0, "window_weeks": 26, "min_points": 4}

_UNITS = {
    "sacs": "sac", "sac": "sac", "u": "u", "unite": "u", "unites": "u", "pce": "u", "piece": "u", "pieces": "u",
    "t": "t", "tonne": "t", "tonnes": "t", "kg": "kg", "m3": "m3", "m³": "m3", "barre": "barre", "barres": "barre",
    "feuille": "feuille", "feuilles": "feuille",
}  # fmt: skip


def _norm(text: str | None) -> str:
    text = unicodedata.normalize("NFKD", (text or "").lower())
    return " ".join("".join(c for c in text if not unicodedata.combining(c)).split()) + " "


def _unit(raw: str | None) -> str:
    key = _norm(raw).strip().replace(".", "")
    return _UNITS.get(key, key)


def basket(db: Session) -> list[dict[str, Any]]:
    from app.modules.system.models import Setting

    row = db.get(Setting, "price_basket")
    return row.value if row and isinstance(row.value, list) and row.value else DEFAULT_BASKET


def policy(db: Session) -> dict[str, Any]:
    from app.modules.system.models import Setting

    row = db.get(Setting, "market")
    return {**DEFAULTS, **(row.value if row and isinstance(row.value, dict) else {})}


def classify(families: list[dict[str, Any]], label: str, unit: str | None) -> tuple[dict[str, Any], Decimal] | None:
    """(famille, facteur) si la désignation et l'unité correspondent à une famille du panier."""
    text = _norm(label)
    raw_unit = _unit(unit)
    for family in families:
        if any(k in text for k in family["keywords"]):
            factor = family.get("conversions", {}).get(raw_unit)
            if factor:
                return family, Decimal(str(factor))
    return None


# ---------------------------------------------------------------------------- collecte
def _observe(
    db: Session,
    families: list[dict[str, Any]],
    *,
    label: str,
    unit: str | None,
    price: Decimal,
    observed_on: date,
    source_type: str,
    source_id: str,
    supplier_id: Any = None,
    project_id: Any = None,
    currency: str = "XAF",
) -> bool:
    match = classify(families, label, unit)
    if match is None or price is None or Decimal(price) <= 0 or currency != "XAF":
        return False
    family, factor = match
    exists = db.execute(
        select(PriceObservation.id).where(
            PriceObservation.source_type == source_type, PriceObservation.source_id == source_id
        )
    ).first()
    if exists is not None:
        return False
    db.add(
        PriceObservation(
            family=family["key"],
            label=label[:300],
            unit=family["unit"],
            unit_price=(Decimal(price) * factor).quantize(Decimal("0.0001"), ROUND_HALF_UP),
            raw_unit=_unit(unit)[:20],
            raw_price=money(price),
            currency=currency,
            observed_on=observed_on,
            supplier_id=supplier_id,
            project_id=project_id,
            source_type=source_type,
            source_id=source_id[:80],
        )
    )
    return True


def collect(db: Session, *, days: int = 400) -> int:
    from app.modules.billing.models import SupplierInvoice, SupplierInvoiceLine
    from app.modules.procurement.models import PurchaseOrder, PurchaseOrderLine
    from app.modules.suppliers.models import SupplierPriceHistory, SupplierProduct

    families = basket(db)
    since = date.today() - timedelta(days=days)
    added = 0
    for line, po in db.execute(
        select(PurchaseOrderLine, PurchaseOrder)
        .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderLine.order_id)
        .where(
            PurchaseOrder.deleted_at.is_(None),
            PurchaseOrder.status.not_in(["draft", "cancelled", "refused"]),
            PurchaseOrder.created_at >= utcnow() - timedelta(days=days),
        )
    ).all():
        added += _observe(
            db, families, label=line.description, unit=line.unit, price=line.unit_price,
            observed_on=(po.sent_at or po.created_at).date(), source_type="po", source_id=str(line.id),
            supplier_id=po.supplier_id, project_id=po.project_id, currency=po.currency,
        )  # fmt: skip
    for line, invoice in db.execute(
        select(SupplierInvoiceLine, SupplierInvoice)
        .join(SupplierInvoice, SupplierInvoice.id == SupplierInvoiceLine.invoice_id)
        .where(
            SupplierInvoice.deleted_at.is_(None),
            SupplierInvoice.status.not_in(["received", "rejected", "disputed"]),
            SupplierInvoice.invoice_date >= since,
        )
    ).all():
        unit = None
        if line.po_line_id:
            po_line = db.get(PurchaseOrderLine, line.po_line_id)
            unit = po_line.unit if po_line else None
        added += _observe(
            db, families, label=line.description, unit=unit or "u", price=line.unit_price,
            observed_on=invoice.invoice_date, source_type="invoice", source_id=str(line.id),
            supplier_id=invoice.supplier_id, project_id=invoice.project_id, currency=invoice.currency,
        )  # fmt: skip
    for history, product in db.execute(
        select(SupplierPriceHistory, SupplierProduct)
        .join(SupplierProduct, SupplierProduct.id == SupplierPriceHistory.product_id)
        .where(SupplierPriceHistory.valid_from >= since)
    ).all():
        added += _observe(
            db, families, label=product.name, unit=product.unit, price=history.unit_price,
            observed_on=history.valid_from, source_type="price_history", source_id=str(history.id),
            supplier_id=product.supplier_id, currency=history.currency,
        )  # fmt: skip
    for product in db.execute(select(SupplierProduct).where(SupplierProduct.is_active.is_(True))).scalars():
        day = (product.updated_at or product.created_at).date()
        if day >= since:
            added += _observe(
                db, families, label=product.name, unit=product.unit, price=product.unit_price, observed_on=day,
                source_type="catalog", source_id=f"{product.id}:{day.isoformat()}", supplier_id=product.supplier_id,
                currency=product.currency,
            )  # fmt: skip
    db.flush()
    return added


# ---------------------------------------------------------------------------- indice
def _monday(day: date) -> date:
    return day - timedelta(days=day.weekday())


def _slope(values: list[float]) -> float:
    n = len(values)
    if n < 2:
        return 0.0
    xs = range(n)
    mx, my = (n - 1) / 2, statistics.fmean(values)
    den = sum((x - mx) ** 2 for x in xs)
    return sum((x - mx) * (y - my) for x, y in zip(xs, values, strict=True)) / den if den else 0.0


def family_series(db: Session, family: dict[str, Any], weeks: int) -> dict[str, Any]:
    start = _monday(date.today()) - timedelta(weeks=weeks - 1)
    rows = db.execute(
        select(PriceObservation.observed_on, PriceObservation.unit_price, PriceObservation.supplier_id).where(
            PriceObservation.family == family["key"], PriceObservation.observed_on >= start
        )
    ).all()
    buckets: dict[date, list[float]] = {}
    for day, price, _supplier in rows:
        buckets.setdefault(_monday(day), []).append(float(price))
    series = [{"week": week, "median": round(statistics.median(vals), 2), "count": len(vals)}
              for week, vals in sorted(buckets.items())]  # fmt: skip
    base = series[0]["median"] if series else None
    for point in series:
        point["index"] = round(point["median"] / base * 100, 1) if base else None
    medians = [p["median"] for p in series]
    current = medians[-1] if medians else None
    this_week = _monday(date.today())
    cut4, cut8 = this_week - timedelta(weeks=4), this_week - timedelta(weeks=8)
    last4 = [p["median"] for p in series if p["week"] > cut4]
    prev4 = [p["median"] for p in series if cut8 < p["week"] <= cut4]
    trend = round((statistics.median(last4) / statistics.median(prev4) - 1) * 100, 1) if last4 and prev4 else None
    recent = medians[-12:]
    forecast = round(current + 4 * _slope(recent), 2) if current is not None and len(recent) >= 3 else current
    forecast_pct = round((forecast / current - 1) * 100, 1) if current and forecast else None
    suppliers = db.execute(
        select(PriceObservation.supplier_id, PriceObservation.unit_price)
        .where(
            PriceObservation.family == family["key"], PriceObservation.observed_on >= date.today() - timedelta(days=60)
        )
        .order_by(PriceObservation.unit_price)
    ).all()  # fmt: skip
    return {
        "key": family["key"],
        "label": family["label"],
        "unit": family["unit"],
        "series": series,
        "current": current,
        "trend_4w_pct": trend,
        "forecast_4w": forecast,
        "forecast_pct": forecast_pct,
        "observations": len(rows),
        "best_recent": float(suppliers[0][1]) if suppliers else None,
        "best_supplier_id": suppliers[0][0] if suppliers else None,
    }


def price_index(db: Session, weeks: int | None = None) -> list[dict[str, Any]]:
    weeks = weeks or int(policy(db)["window_weeks"])
    return jsonable([family_series(db, f, weeks) for f in basket(db)])


# ---------------------------------------------------------------------------- besoins et recommandations
def needs(db: Session) -> dict[str, dict[str, Any]]:
    """Besoins exprimés non encore commandés, ramenés à l'unité de référence de chaque famille."""
    from app.modules.inventory.models import StockItem, StockLevel
    from app.modules.procurement.models import PurchaseOrder, PurchaseRequest, PurchaseRequestLine

    families = basket(db)
    out: dict[str, dict[str, Any]] = {}
    ordered = select(PurchaseOrder.request_id).where(
        PurchaseOrder.request_id.is_not(None), PurchaseOrder.status.not_in(["cancelled", "refused"])
    )
    for line, pr in db.execute(
        select(PurchaseRequestLine, PurchaseRequest)
        .join(PurchaseRequest, PurchaseRequest.id == PurchaseRequestLine.request_id)
        .where(
            PurchaseRequest.deleted_at.is_(None),
            PurchaseRequest.status.in_(["submitted", "approved"]),
            PurchaseRequest.id.not_in(ordered),
        )
    ).all():
        match = classify(families, line.description, line.unit)
        if match is None:
            continue
        family, factor = match
        entry = out.setdefault(family["key"], {"quantity": Decimal("0"), "projects": set(), "lines": [], "items": []})
        entry["quantity"] += Decimal(line.quantity) / factor
        entry["projects"].add(str(pr.project_id))
        entry["lines"].append(str(line.id))
    levels: dict[Any, Decimal] = {}
    for item_id, qty in db.execute(select(StockLevel.item_id, StockLevel.quantity)).all():
        levels[item_id] = levels.get(item_id, Decimal("0")) + Decimal(qty or 0)
    for item in db.execute(
        select(StockItem).where(
            StockItem.deleted_at.is_(None), StockItem.is_active.is_(True), StockItem.min_threshold > 0
        )
    ).scalars():
        if levels.get(item.id, Decimal("0")) >= Decimal(item.min_threshold):
            continue
        match = classify(families, item.name, item.unit)
        if match is None:
            continue
        family, factor = match
        qty = Decimal(item.reorder_quantity or 0) or Decimal(item.min_threshold)
        entry = out.setdefault(family["key"], {"quantity": Decimal("0"), "projects": set(), "lines": [], "items": []})
        entry["quantity"] += qty / factor
        entry["items"].append(str(item.id))
    return out


def recommend(db: Session) -> int:
    rules = policy(db)
    index = {f["key"]: f for f in (family_series(db, f, int(rules["window_weeks"])) for f in basket(db))}
    created = 0
    for key, need in needs(db).items():
        family = index.get(key)
        if not family or family["current"] is None or family["forecast_pct"] is None:
            continue
        if len(family["series"]) < int(rules["min_points"]) or family["forecast_pct"] < float(rules["alert_pct"]):
            continue
        current, forecast = Decimal(str(family["current"])), Decimal(str(family["forecast_4w"]))
        saving = money(need["quantity"] * (forecast - current))
        reason = (
            f"{family['label']} : hausse prévue de {family['forecast_pct']} % d'ici 4 semaines "
            f"({family['trend_4w_pct'] if family['trend_4w_pct'] is not None else '—'} % sur les 4 dernières). "
            f"Commander maintenant les {need['quantity']:.0f} {family['unit']} déjà demandés économiserait "
            f"environ {saving:,.0f} FCFA.".replace(",", " ")
        )
        rec = db.execute(
            select(PurchaseRecommendation).where(
                PurchaseRecommendation.family == key, PurchaseRecommendation.status == "open"
            )
        ).scalar_one_or_none()
        is_new = rec is None
        if rec is None:
            rec = PurchaseRecommendation(family=key, label=family["label"], unit=family["unit"])
            db.add(rec)
        rec.quantity = need["quantity"].quantize(Decimal("0.001"))
        rec.current_price, rec.forecast_price = current, forecast
        rec.trend_pct = Decimal(str(family["forecast_pct"]))
        rec.expected_saving = saving
        rec.project_ids = sorted(need["projects"])
        rec.request_line_ids = need["lines"]
        rec.stock_item_ids = need["items"]
        rec.reason = reason
        db.flush()
        if is_new:
            created += 1
            emit(
                db,
                "procurement.price_alert",
                {
                    "id": rec.id,
                    "family": family["label"],
                    "trend_pct": rec.trend_pct,
                    "quantity": f"{rec.quantity:.0f} {rec.unit}",
                    "saving": saving,
                    "link": "/erp/achats/prix",
                },
                aggregate_type="purchase_recommendation",
                aggregate_id=rec.id,
            )
    return created


def daily_job(db: Session) -> dict[str, Any]:
    added = collect(db)
    created = recommend(db)
    return {"items": added, "recommendations": created}


def recommendation_out(db: Session, rec: PurchaseRecommendation) -> dict[str, Any]:
    from app.modules.procurement.models import PurchaseRequest, PurchaseRequestLine
    from app.modules.projects.models import Project

    requests = []
    if rec.request_line_ids:
        rows = db.execute(
            select(PurchaseRequest.id, PurchaseRequest.number)
            .join(PurchaseRequestLine, PurchaseRequestLine.request_id == PurchaseRequest.id)
            .where(PurchaseRequestLine.id.in_(rec.request_line_ids))
            .distinct()
        ).all()
        requests = [{"id": r[0], "number": r[1]} for r in rows]
    projects = [
        {"id": p.id, "code": p.code, "name": p.name}
        for p in (db.get(Project, pid) for pid in rec.project_ids or [])
        if p is not None
    ]
    return jsonable(
        {
            "id": rec.id,
            "family": rec.family,
            "label": rec.label,
            "unit": rec.unit,
            "quantity": rec.quantity,
            "current_price": rec.current_price,
            "forecast_price": rec.forecast_price,
            "trend_pct": rec.trend_pct,
            "expected_saving": rec.expected_saving,
            "reason": rec.reason,
            "status": rec.status,
            "projects": projects,
            "requests": requests,
            "stock_items": len(rec.stock_item_ids or []),
            "created_at": rec.created_at,
            "updated_at": rec.updated_at,
            "decision_note": rec.decision_note,
        }
    )


__all__ = ["basket", "classify", "collect", "daily_job", "needs", "price_index", "recommend", "recommendation_out"]
