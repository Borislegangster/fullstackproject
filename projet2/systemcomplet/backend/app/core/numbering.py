"""Numérotation métier séquentielle et sans trou par préfixe/année (ex. BC-2026-00001)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.utils import utcnow
from app.modules.system.models import NumberSequence

PREFIXES = {
    "lead": "LEAD",
    "opportunity": "OPP",
    "quote": "DEV",
    "contract": "CTR",
    "project": "PRJ",
    "site": "CH",
    "purchase_request": "DA",
    "purchase_order": "BC",
    "delivery": "LIV",
    "goods_receipt": "BR",
    "supplier_return": "RET",
    "supplier_invoice": "FF",
    "subcontractor_invoice": "FST",
    "client_invoice": "FAC",
    "credit_note": "AV",
    "funds_call": "ACF",
    "payment": "PAY",
    "change_order": "AVN",
    "tender": "AO",
    "subcontract": "MST",
    "situation": "SIT",
    "dispute": "LIT",
    "ticket": "SAV",
    "incident": "INC",
    "corrective_action": "ACT",
    "inspection": "INS",
    "bim_issue": "ISS",
    "clash": "CLA",
    "decision": "DEC",
    "payroll": "PAIE",
    "employee": "EMP",
    "equipment": "MAT",
    "maintenance": "MNT",
    "document": "DOC",
    "inventory_count": "INV",
    "stock_transfer": "TRF",
    "petty_cash": "CAI",
    "intervention": "INT",
    "proof": "PRV",
    "payment_plan": "ECH",
    "referral": "PAR",
    "executive_report": "RDIR",
    "financing": "FIN",
    "escrow_release": "SEQ",
}


def next_number(db: Session, kind: str, *, width: int = 5, year: int | None = None) -> str:
    prefix = PREFIXES.get(kind, kind.upper()[:4])
    year = year or utcnow().year
    key = f"{prefix}:{year}"
    db.execute(insert(NumberSequence).values(key=key, next_value=1).on_conflict_do_nothing(index_elements=["key"]))
    seq = db.execute(select(NumberSequence).where(NumberSequence.key == key).with_for_update()).scalar_one()
    value = seq.next_value
    seq.next_value = value + 1
    db.flush()
    return f"{prefix}-{year}-{value:0{width}d}"
