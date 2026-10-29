"""Workflow achats §8.1 (étapes 26 → 42) et exceptions §8.2.

DA (chantier, zone, article, quantité, unité, budget, urgence, justification) → matrice d'approbation →
sélection fournisseur (prix, délai, qualité, stock, zone) → BC numéroté → transmission WhatsApp Business /
e-mail / SMS avec lien sécurisé → confirmation / refus / contre-offre → « livraison attendue » au chef de
chantier → expédition / ETA → réception (QR / n° BC) : quantités, qualité, lot, photos, BL, livreur, véhicule,
heure, géolocalisation → GRN → stock ou affectation directe → facture → rapprochement 3 pièces → validation
finance → paiement → KPI et clôture.
"""

from __future__ import annotations

import logging
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.errors import BusinessRuleError, Conflict, Forbidden, NotFound
from app.core.events import emit
from app.core.numbering import next_number
from app.core.security import random_token, sha256_hex
from app.core.utils import jsonable, money, qty, utcnow
from app.modules.billing.models import SupplierInvoice
from app.modules.identity.models import Role, User, UserRole
from app.modules.procurement.models import (
    Approval,
    ApprovalRule,
    Delivery,
    GoodsReceipt,
    GoodsReceiptLine,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseRequest,
    SupplierMessage,
    SupplierReturn,
)
from app.modules.projects.models import Project, ProjectMember, Site
from app.modules.suppliers.models import (
    Supplier,
    SupplierIncident,
    SupplierPriceHistory,
    SupplierProduct,
    SupplierRating,
)

log = logging.getLogger("globus.procurement")
PORTAL_TTL_DAYS = 30


# ============================================================================ demandes d'achat
def request_total(pr: PurchaseRequest) -> Decimal:
    return money(sum((Decimal(li.quantity) * Decimal(li.estimated_unit_price or 0) for li in pr.lines), Decimal("0")))


def _approvers_for(db: Session, role: str, project_id: uuid.UUID) -> list[uuid.UUID]:
    users = db.execute(
        select(User.id, Role.global_scope)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(Role.code == role, User.is_active.is_(True))
    ).all()
    members = set(db.execute(select(ProjectMember.user_id).where(ProjectMember.project_id == project_id)).scalars())
    return [uid for uid, global_scope in users if global_scope or uid in members]


def submit_request(db: Session, pr: PurchaseRequest, *, user_id: uuid.UUID) -> PurchaseRequest:
    if pr.status != "draft":
        raise BusinessRuleError("Seule une demande en brouillon peut être soumise")
    if not pr.lines:
        raise BusinessRuleError("La demande ne contient aucun article")
    if not pr.justification:
        raise BusinessRuleError("Justification obligatoire", code="JUSTIFICATION_REQUIRED")
    pr.total_estimated = request_total(pr)
    pr.status = "submitted"
    pr.submitted_at = utcnow()
    rules = (
        db.execute(
            select(ApprovalRule).where(ApprovalRule.entity == "purchase_request", ApprovalRule.is_active.is_(True))
        )
        .scalars()
        .all()
    )
    matching = [
        r
        for r in rules
        if Decimal(pr.total_estimated) >= Decimal(r.min_amount)
        and (r.max_amount is None or Decimal(pr.total_estimated) <= Decimal(r.max_amount))
        and (not r.category or r.category == pr.category)
        and (not r.cost_center or r.cost_center == pr.cost_center)
        and (not r.urgent_only or pr.urgency in ("urgent", "critical"))
    ]
    levels = sorted({r.level for r in matching})
    for level in levels:
        for rule in [r for r in matching if r.level == level]:
            db.add(
                Approval(
                    entity_type="purchase_request",
                    entity_id=pr.id,
                    level=level,
                    approver_role=rule.approver_role,
                    amount=pr.total_estimated,
                    project_id=pr.project_id,
                )
            )
    db.flush()
    if not levels:
        pr.status = "approved"
        pr.approved_at = utcnow()
    else:
        first = [r for r in matching if r.level == levels[0]]
        approver_ids = {uid for r in first for uid in _approvers_for(db, r.approver_role, pr.project_id)}
        project = db.get(Project, pr.project_id)
        requester = db.get(User, pr.requested_by_id) if pr.requested_by_id else None
        emit(
            db,
            "purchase_request.submitted",
            {
                "id": pr.id,
                "number": pr.number,
                "total": pr.total_estimated,
                "urgency": pr.urgency,
                "project_name": project.name if project else "",
                "requester": requester.full_name if requester else "",
                "approver_ids": [str(u) for u in approver_ids if u != user_id],
            },
            aggregate_type="purchase_request",
            aggregate_id=pr.id,
            project_id=pr.project_id,
        )
    audit.record(
        db,
        family="business",
        module="procurement",
        action="SUBMIT",
        resource_type="purchase_request",
        resource_id=pr.id,
        project_id=pr.project_id,
        diff={"total": str(pr.total_estimated), "levels": levels},
    )
    return pr


def decide_request(
    db: Session, pr: PurchaseRequest, *, principal: Any, approve: bool, comment: str | None
) -> PurchaseRequest:
    if pr.status != "submitted":
        raise BusinessRuleError("Demande non soumise à approbation")
    pending = (
        db.execute(
            select(Approval)
            .where(
                Approval.entity_type == "purchase_request", Approval.entity_id == pr.id, Approval.status == "pending"
            )
            .order_by(Approval.level)
        )
        .scalars()
        .all()
    )
    if not pending:
        raise BusinessRuleError("Aucune approbation en attente")
    level = pending[0].level
    current = [a for a in pending if a.level == level]
    mine = next((a for a in current if a.approver_role in principal.roles), None)
    if mine is None and "ADMIN" in principal.roles:
        mine = current[0]
    if mine is None:
        raise Forbidden(
            "Approbation réservée au(x) rôle(s) " + ", ".join(sorted({a.approver_role or "" for a in current})),
            code="APPROVAL_ROLE_REQUIRED",
        )
    from app.core.sod import require_other_person

    require_other_person(
        db,
        principal,
        pr.requested_by_id,
        "Séparation des tâches : le demandeur ne peut pas approuver sa demande",
        resource_type="purchase_request",
        resource_id=pr.id,
        project_id=pr.project_id,
    )
    mine.status = "approved" if approve else "rejected"
    mine.decided_by_id = principal.id
    mine.decided_at = utcnow()
    mine.comment = comment
    for other in current:
        if other.id != mine.id and other.status == "pending":
            other.status = "skipped"
    db.flush()
    if not approve:
        pr.status = "rejected"
        pr.rejected_reason = comment
        for rest in pending:
            if rest.status == "pending":
                rest.status = "skipped"
        emit(
            db,
            "purchase_request.rejected",
            {"id": pr.id, "number": pr.number, "reason": comment, "requested_by_id": pr.requested_by_id},
            aggregate_type="purchase_request",
            aggregate_id=pr.id,
            project_id=pr.project_id,
        )
    else:
        remaining = [a for a in pending if a.status == "pending"]
        if not remaining:
            pr.status = "approved"
            pr.approved_at = utcnow()
            emit(
                db,
                "purchase_request.approved",
                {"id": pr.id, "number": pr.number, "requested_by_id": pr.requested_by_id},
                aggregate_type="purchase_request",
                aggregate_id=pr.id,
                project_id=pr.project_id,
            )
        else:
            next_level = remaining[0].level
            approver_ids = {
                uid
                for a in remaining
                if a.level == next_level
                for uid in _approvers_for(db, a.approver_role or "", pr.project_id)
            }
            project = db.get(Project, pr.project_id)
            emit(
                db,
                "purchase_request.submitted",
                {
                    "id": pr.id,
                    "number": pr.number,
                    "total": pr.total_estimated,
                    "urgency": pr.urgency,
                    "project_name": project.name if project else "",
                    "requester": "",
                    "approver_ids": [str(u) for u in approver_ids],
                },
                aggregate_type="purchase_request",
                aggregate_id=pr.id,
                project_id=pr.project_id,
            )
    audit.record(
        db,
        family="business",
        module="procurement",
        action="APPROVE" if approve else "REJECT",
        resource_type="purchase_request",
        resource_id=pr.id,
        project_id=pr.project_id,
        diff={"level": level},
        reason=comment,
        criticality="MEDIUM",
    )
    return pr


# ============================================================================ sélection fournisseur
def rank_suppliers(db: Session, pr: PurchaseRequest) -> list[dict[str, Any]]:
    """Score multicritère : prix (40), délai (20), qualité (20), stock (10), zone de livraison (10)."""
    project = db.get(Project, pr.project_id)
    city = (project.city or "").lower() if project else ""
    suppliers = (
        db.execute(select(Supplier).where(Supplier.status == "active", Supplier.deleted_at.is_(None))).scalars().all()
    )
    results = []
    for supplier in suppliers:
        lines = []
        covered = 0
        total = Decimal("0")
        stock_ok = 0
        lead = supplier.lead_time_days or 7
        for line in pr.lines:
            product = None
            if line.supplier_product_id:
                product = db.get(SupplierProduct, line.supplier_product_id)
                if product and product.supplier_id != supplier.id:
                    product = None
            if product is None and line.stock_item_id:
                product = (
                    db.execute(
                        select(SupplierProduct).where(
                            SupplierProduct.supplier_id == supplier.id,
                            SupplierProduct.stock_item_id == line.stock_item_id,
                            SupplierProduct.is_active.is_(True),
                        )
                    )
                    .scalars()
                    .first()
                )
            if product is None:
                product = (
                    db.execute(
                        select(SupplierProduct).where(
                            SupplierProduct.supplier_id == supplier.id,
                            SupplierProduct.is_active.is_(True),
                            SupplierProduct.name.ilike(f"%{line.description[:40]}%"),
                        )
                    )
                    .scalars()
                    .first()
                )
            if product is None:
                continue
            covered += 1
            price = Decimal(product.unit_price)
            total += price * Decimal(line.quantity)
            lead = max(lead, product.lead_time_days or supplier.lead_time_days or 7)
            if product.stock_available is None or Decimal(product.stock_available) >= Decimal(line.quantity):
                stock_ok += 1
            lines.append(
                {
                    "line_id": str(line.id),
                    "product_id": str(product.id),
                    "reference": product.reference,
                    "unit_price": price,
                    "unit": product.unit,
                }
            )
        if covered == 0:
            continue
        results.append(
            {
                "supplier": supplier,
                "covered": covered,
                "total": money(total),
                "lead_time": lead,
                "stock_ok": stock_ok,
                "lines": lines,
                "zone_ok": not supplier.delivery_zones or any(z.lower() in city for z in supplier.delivery_zones),
            }
        )
    if not results:
        return []
    totals = [r["total"] for r in results if r["covered"] == len(pr.lines)] or [r["total"] for r in results]
    best_price = min(totals) if totals else Decimal("1")
    best_lead = min(r["lead_time"] for r in results) or 1
    ranked = []
    for r in results:
        coverage = r["covered"] / len(pr.lines)
        price_score = float(best_price / r["total"]) * 40 if r["total"] else 0
        lead_score = (best_lead / r["lead_time"]) * 20 if r["lead_time"] else 20
        quality_score = float(r["supplier"].quality_score or 0) / 100 * 20
        stock_score = r["stock_ok"] / len(pr.lines) * 10
        zone_score = 10 if r["zone_ok"] else 0
        score = round((price_score + lead_score + quality_score + stock_score + zone_score) * coverage, 2)
        ranked.append(
            {
                "supplier_id": str(r["supplier"].id),
                "supplier": r["supplier"].legal_name,
                "score": score,
                "coverage_pct": round(coverage * 100),
                "total": r["total"],
                "lead_time_days": r["lead_time"],
                "quality_score": r["supplier"].quality_score,
                "zone_ok": r["zone_ok"],
                "whatsapp": bool(r["supplier"].whatsapp_number and r["supplier"].whatsapp_opt_in),
                "breakdown": {
                    "prix": round(price_score, 1),
                    "delai": round(lead_score, 1),
                    "qualite": round(quality_score, 1),
                    "stock": round(stock_score, 1),
                    "zone": zone_score,
                },
                "lines": r["lines"],
            }
        )
    return sorted(ranked, key=lambda x: x["score"], reverse=True)


# ============================================================================ bons de commande
def compute_po(po: PurchaseOrder) -> None:
    subtotal = Decimal("0")
    tax = Decimal("0")
    for line in po.lines:
        line.total = money(Decimal(line.quantity) * Decimal(line.unit_price))
        subtotal += line.total
        tax += line.total * Decimal(line.tax_rate or 0) / 100
    po.subtotal = money(subtotal)
    po.tax_amount = money(tax)
    po.total = money(subtotal + tax)


def po_from_request(
    db: Session,
    pr: PurchaseRequest,
    *,
    supplier_id: uuid.UUID,
    user_id: uuid.UUID,
    prices: dict[str, Decimal] | None,
    expected_date: date | None,
    reason: dict[str, Any],
) -> PurchaseOrder:
    if pr.status not in ("approved",):
        raise BusinessRuleError(
            "La demande doit être approuvée avant émission du bon de commande", code="PR_NOT_APPROVED"
        )
    supplier = db.get(Supplier, supplier_id)
    if supplier is None or supplier.status != "active":
        raise BusinessRuleError("Fournisseur inactif ou inconnu")
    site = db.get(Site, pr.site_id) if pr.site_id else None
    po = PurchaseOrder(
        number=next_number(db, "purchase_order"),
        request_id=pr.id,
        project_id=pr.project_id,
        site_id=pr.site_id,
        lot_id=pr.lot_id,
        supplier_id=supplier.id,
        status="approved",
        urgent=pr.urgency in ("urgent", "critical"),
        payment_terms=supplier.payment_terms,
        delivery_address=(site.address if site else None) or (pr.zone or ""),
        expected_date=expected_date or pr.needed_by,
        created_by_id=user_id,
        approved_by_id=user_id,
        approved_at=utcnow(),
        selection_reason=reason,
    )
    for index, line in enumerate(pr.lines):
        product = None
        if line.supplier_product_id:
            product = db.get(SupplierProduct, line.supplier_product_id)
        if product is None and line.stock_item_id:
            product = (
                db.execute(
                    select(SupplierProduct).where(
                        SupplierProduct.supplier_id == supplier.id, SupplierProduct.stock_item_id == line.stock_item_id
                    )
                )
                .scalars()
                .first()
            )
        price = (prices or {}).get(str(line.id)) or (product.unit_price if product else line.estimated_unit_price)
        po.lines.append(
            PurchaseOrderLine(
                sort_order=index,
                tax_rate=settings.VAT_RATE,
                supplier_product_id=product.id if product else None,
                stock_item_id=line.stock_item_id,
                reference=product.reference if product else None,
                description=line.description,
                quantity=line.quantity,
                unit=line.unit,
                unit_price=money(price or 0),
            )
        )
    compute_po(po)
    db.add(po)
    pr.status = "ordered"
    db.flush()
    audit.record(
        db,
        family="business",
        module="procurement",
        action="CREATE",
        resource_type="purchase_order",
        resource_id=po.id,
        project_id=po.project_id,
        diff={"number": po.number, "supplier": supplier.legal_name, "total": str(po.total)},
    )
    return po


def po_pdf(db: Session, po: PurchaseOrder) -> bytes:
    from app.core.pdf import (
        PdfDocument,
        amount_in_words,
        company_party,
        fmt_money,
        fmt_qty,
        organization_lines,
        project_label,
    )
    from app.modules.documents.seals import sealed_pdf

    supplier = db.get(Supplier, po.supplier_id)
    project = db.get(Project, po.project_id)
    stamps = {"draft": "BROUILLON", "pending_approval": "À APPROUVER", "cancelled": "ANNULÉ", "refused": "REFUSÉ"}
    doc = PdfDocument(
        title="BON DE COMMANDE",
        number=po.number,
        stamp=stamps.get(po.status),
        issued_on=(po.sent_at or utcnow()).date(),
        parties=[
            company_party("Donneur d'ordre"),
            ("Fournisseur", organization_lines(supplier)),
            (
                "Livraison",
                [
                    f"<b>{project.name}</b>" if project else "",
                    po.delivery_address or "",
                    f"Souhaitée le {po.expected_date:%d/%m/%Y}" if po.expected_date else "",
                ],
            ),
        ],
        meta=[
            ("Projet", project_label(project)),
            ("Conditions de paiement", po.payment_terms or "—"),
            ("Urgence", "OUI" if po.urgent else "Non"),
        ],
        columns=["Désignation", "Réf.", "Qté", "PU HT", "Total HT"],
        col_widths=[200, 70, 50, 85, 85],
        rows=[
            [
                li.description,
                li.reference or "",
                f"{fmt_qty(li.quantity)} {li.unit}",
                fmt_money(li.unit_price, po.currency),
                fmt_money(li.total, po.currency),
            ]
            for li in po.lines
        ],
        totals=[
            ("Total HT", fmt_money(po.subtotal, po.currency)),
            ("TVA", fmt_money(po.tax_amount, po.currency)),
            ("Total TTC", fmt_money(po.total, po.currency)),
        ],
        paragraphs=[
            (
                "Instructions",
                "Mentionner obligatoirement le numéro de bon de commande sur le bon de livraison "
                "et sur la facture. Toute substitution d'article doit être validée par écrit.",
            )
        ]
        + ([("Notes", po.notes)] if po.notes else []),
        amount_words=amount_in_words(po.total, po.currency),
        amount_words_label="Arrêté le présent bon de commande à la somme de",
        signature_blocks=["Pour GLOBUS ENGINEERING — le Service achats", "Le fournisseur — « Bon pour accord »"],
        footer_note=f"BC {po.number} — confirmation via le lien sécurisé transmis.",
    )
    return sealed_pdf(
        db,
        doc,
        kind="purchase_order",
        entity_type="purchase_order",
        entity_id=po.id,
        reference=po.number,
        title=f"Bon de commande — {supplier.legal_name}" if supplier else "Bon de commande",
        issued_on=doc.issued_on,
        amount=po.total,
        currency=po.currency,
        party=supplier.legal_name if supplier else None,
    )


def send_po(db: Session, po: PurchaseOrder, *, user_id: uuid.UUID, channel: str | None = None) -> dict[str, Any]:
    """Transmission via WhatsApp Business Platform, e-mail ou repli SMS — canal professionnel traçable (V4-SUP-10)."""
    from app.core.files import store_generated
    from app.modules.notifications.service import queue_external
    from app.providers.messaging import WhatsAppTemplate, get_sms_provider, get_whatsapp_provider, whatsapp_available

    if po.status not in ("approved", "sent", "refused", "countered"):
        raise BusinessRuleError("Le bon de commande doit être approuvé avant envoi", code="PO_NOT_APPROVED")
    supplier = db.get(Supplier, po.supplier_id)
    if supplier is None:
        raise NotFound("Fournisseur introuvable")
    token = random_token(32)
    po.portal_token_hash = sha256_hex(token)
    po.portal_token_expires_at = utcnow() + timedelta(days=PORTAL_TTL_DAYS)
    stored = store_generated(
        db,
        po_pdf(db, po),
        filename=f"{po.number}.pdf",
        mime="application/pdf",
        purpose="purchase_orders",
        classification="confidential",
        uploaded_by_id=user_id,
    )
    po.pdf_file_id = stored.id
    link = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/fournisseur/commande/{token}"
    pdf_link = f"{settings.API_PUBLIC_URL.rstrip('/')}{settings.API_PREFIX}/public/supplier-portal/{token}/pdf"
    preferred = channel or supplier.preferred_channel
    used = None
    if preferred == "whatsapp" and supplier.whatsapp_number and supplier.whatsapp_opt_in and whatsapp_available():
        try:
            result = get_whatsapp_provider().send_template(
                supplier.whatsapp_number,
                WhatsAppTemplate(
                    name=settings.META_WA_PO_TEMPLATE,
                    language=settings.META_WA_TEMPLATE_LANG,
                    body_params=[
                        supplier.trade_name or supplier.legal_name,
                        po.number,
                        f"{po.total:,.0f}".replace(",", " "),
                        po.expected_date.strftime("%d/%m/%Y") if po.expected_date else "à convenir",
                    ],
                    header_document={"link": pdf_link, "filename": f"{po.number}.pdf"},
                    button_payloads=[f"PO_CONFIRM:{po.number}", f"PO_REFUSE:{po.number}"],
                    url_button_suffix=token,
                ),
            )
            db.add(
                SupplierMessage(
                    supplier_id=supplier.id,
                    purchase_order_id=po.id,
                    channel="whatsapp",
                    direction="out",
                    recipient=supplier.whatsapp_number,
                    template=settings.META_WA_PO_TEMPLATE,
                    content=f"BC {po.number}",
                    provider=result.provider,
                    provider_message_id=result.message_id,
                    status="sent",
                    status_at=utcnow(),
                )
            )
            used = "whatsapp"
        except Exception as exc:  # noqa: BLE001 — repli e-mail / SMS
            log.warning("po_whatsapp_failed", extra={"error": str(exc)[:200]})
            db.add(
                SupplierMessage(
                    supplier_id=supplier.id,
                    purchase_order_id=po.id,
                    channel="whatsapp",
                    direction="out",
                    recipient=supplier.whatsapp_number,
                    content=f"BC {po.number}",
                    status="failed",
                    error=str(exc)[:500],
                )
            )
    if used is None and supplier.email:
        delivery = queue_external(
            db,
            channel="email",
            recipient=supplier.email,
            template_code="purchase_order.sent",
            context={
                "number": po.number,
                "total": po.total,
                "expected_date": po.expected_date,
                "delivery_address": po.delivery_address or "",
                "link": link,
            },
            attachments_file_ids=[str(stored.id)],
        )
        db.add(
            SupplierMessage(
                supplier_id=supplier.id,
                purchase_order_id=po.id,
                channel="email",
                direction="out",
                recipient=supplier.email,
                content=f"BC {po.number}",
                status="queued",
                provider_message_id=str(delivery.id),
            )
        )
        used = "email"
    if used is None and (supplier.sms_number or supplier.phone):
        number = supplier.sms_number or supplier.phone or ""
        result = get_sms_provider().send(
            number,
            f"GLOBUS ENGINEERING : bon de commande {po.number} ({po.total:,.0f} FCFA). Confirmez ici : {link}".replace(
                ",", " "
            ),
        )
        db.add(
            SupplierMessage(
                supplier_id=supplier.id,
                purchase_order_id=po.id,
                channel="sms",
                direction="out",
                recipient=number,
                content=f"BC {po.number}",
                provider=result.provider,
                provider_message_id=result.message_id,
                status="sent",
            )
        )
        used = "sms"
    if used is None:
        raise BusinessRuleError(
            "Aucun canal professionnel disponible pour ce fournisseur (WhatsApp Business, e-mail, SMS)",
            code="NO_SUPPLIER_CHANNEL",
        )
    po.status = "sent"
    po.sent_channel = used
    po.sent_at = utcnow()
    audit.record(
        db,
        family="business",
        module="procurement",
        action="SEND",
        resource_type="purchase_order",
        resource_id=po.id,
        project_id=po.project_id,
        diff={"channel": used},
        criticality="MEDIUM",
    )
    result: dict[str, Any] = {"channel": used, "portal_url": link}
    return result


def po_by_token(db: Session, token: str) -> PurchaseOrder:
    po = db.execute(
        select(PurchaseOrder).where(PurchaseOrder.portal_token_hash == sha256_hex(token))
    ).scalar_one_or_none()
    if po is None or (po.portal_token_expires_at and po.portal_token_expires_at < utcnow()):
        raise NotFound("Lien invalide ou expiré")
    return po


def portal_view(db: Session, po: PurchaseOrder) -> dict[str, Any]:
    supplier = db.get(Supplier, po.supplier_id)
    project = db.get(Project, po.project_id)
    site = db.get(Site, po.site_id) if po.site_id else None
    deliveries = (
        db.execute(select(Delivery).where(Delivery.purchase_order_id == po.id).order_by(Delivery.created_at))
        .scalars()
        .all()
    )
    invoices = (
        db.execute(
            select(SupplierInvoice).where(
                SupplierInvoice.purchase_order_id == po.id, SupplierInvoice.deleted_at.is_(None)
            )
        )
        .scalars()
        .all()
    )
    return jsonable(
        {
            "number": po.number,
            "status": po.status,
            "currency": po.currency,
            "subtotal": po.subtotal,
            "tax_amount": po.tax_amount,
            "total": po.total,
            "expected_date": po.expected_date,
            "urgent": po.urgent,
            "payment_terms": po.payment_terms,
            "delivery_address": po.delivery_address,
            "notes": po.notes,
            "supplier": supplier.legal_name if supplier else "",
            "project": project.name if project else "",
            "site": site.name if site else None,
            "sent_at": po.sent_at,
            "supplier_response": po.supplier_response,
            "counter_offer": po.counter_offer or None,
            "eta": po.eta,
            "lines": [
                {
                    "id": li.id,
                    "reference": li.reference,
                    "description": li.description,
                    "quantity": li.quantity,
                    "unit": li.unit,
                    "unit_price": li.unit_price,
                    "total": li.total,
                    "received": li.quantity_received,
                    "accepted": li.quantity_accepted,
                    "invoiced": li.quantity_invoiced,
                }
                for li in po.lines
            ],
            "deliveries": [
                {
                    "number": d.number,
                    "status": d.status,
                    "eta": d.eta,
                    "carrier": d.carrier,
                    "tracking_ref": d.tracking_ref,
                }
                for d in deliveries
            ],
            "invoices": [
                {"reference": i.supplier_reference, "status": i.status, "total": i.total, "amount_paid": i.amount_paid}
                for i in invoices
            ],
            "actions": {
                "respond": po.status in ("sent", "countered"),
                "ship": po.status in ("confirmed", "shipped", "partially_received"),
                # Facturable tant qu'une quantité acceptée en réception reste à facturer (rapprochement 3 pièces).
                "invoice": po.status in ("partially_received", "received", "invoiced")
                and any(Decimal(li.quantity_accepted or 0) > Decimal(li.quantity_invoiced or 0) for li in po.lines),
            },
        }
    )


def _site_manager(db: Session, po: PurchaseOrder) -> uuid.UUID | None:
    site = db.get(Site, po.site_id) if po.site_id else None
    if site and site.site_manager_id:
        return site.site_manager_id
    members = (
        db.execute(
            select(ProjectMember.user_id).where(
                ProjectMember.project_id == po.project_id, ProjectMember.project_role == "chef_chantier"
            )
        )
        .scalars()
        .first()
    )
    return members


def supplier_respond(
    db: Session,
    po: PurchaseOrder,
    *,
    action: str,
    note: str | None,
    counter: dict[str, Any] | None,
    actor_label: str,
    channel: str = "portal",
) -> PurchaseOrder:
    if po.status not in ("sent", "countered") and not (action == "confirm" and po.status == "countered"):
        raise Conflict("Ce bon de commande n'attend plus de réponse", code="PO_NOT_PENDING")
    supplier = db.get(Supplier, po.supplier_id)
    project = db.get(Project, po.project_id)
    site = db.get(Site, po.site_id) if po.site_id else None
    po.supplier_viewed_at = po.supplier_viewed_at or utcnow()
    po.supplier_response = action if action != "counter" else "countered"
    po.supplier_response_note = note
    payload = {
        "id": po.id,
        "number": po.number,
        "supplier": supplier.legal_name if supplier else "",
        "note": note or "",
        "expected_date": po.expected_date,
        "project_name": project.name if project else "",
        "site_name": site.name if site else None,
        "created_by_id": po.created_by_id,
        "site_manager_id": _site_manager(db, po),
    }
    if action == "confirm":
        po.status = "confirmed"
        po.supplier_confirmed_at = utcnow()
        from app.modules.finance.service import upsert_commitment

        upsert_commitment(
            db,
            project_id=po.project_id,
            lot_id=po.lot_id,
            category="materiaux",
            source_type="purchase_order",
            source_id=po.id,
            label=f"BC {po.number} — {supplier.legal_name if supplier else ''}",
            amount=Decimal(po.subtotal),
        )
        emit(
            db,
            "purchase_order.confirmed",
            payload,
            aggregate_type="purchase_order",
            aggregate_id=po.id,
            project_id=po.project_id,
        )
    elif action == "refuse":
        po.status = "refused"
        emit(
            db,
            "purchase_order.refused",
            payload,
            aggregate_type="purchase_order",
            aggregate_id=po.id,
            project_id=po.project_id,
        )
    elif action == "counter":
        if not counter:
            raise BusinessRuleError("Contre-offre vide")
        po.status = "countered"
        po.counter_offer = {"submitted_at": utcnow().isoformat(), **counter}
        emit(
            db,
            "purchase_order.countered",
            payload,
            aggregate_type="purchase_order",
            aggregate_id=po.id,
            project_id=po.project_id,
        )
    else:
        raise BusinessRuleError("Action inconnue")
    db.add(
        SupplierMessage(
            supplier_id=po.supplier_id,
            purchase_order_id=po.id,
            channel=channel,
            direction="in",
            content=f"{action}: {note or ''}"[:2000],
            status="read",
            status_at=utcnow(),
        )
    )
    audit.record(
        db,
        family="business",
        module="procurement",
        action=f"SUPPLIER_{action.upper()}",
        resource_type="purchase_order",
        resource_id=po.id,
        project_id=po.project_id,
        actor_type="supplier",
        actor_label=actor_label,
        diff={"note": note, "counter": counter},
    )
    return po


def accept_counter(db: Session, po: PurchaseOrder, *, user_id: uuid.UUID) -> PurchaseOrder:
    if po.status != "countered" or not po.counter_offer:
        raise BusinessRuleError("Aucune contre-offre à accepter")
    offer = po.counter_offer
    by_id = {str(li.id): li for li in po.lines}
    for change in offer.get("lines", []):
        line = by_id.get(str(change.get("line_id")))
        if line is None:
            continue
        if change.get("unit_price") is not None:
            line.unit_price = money(change["unit_price"])
        if change.get("quantity") is not None:
            line.quantity = qty(change["quantity"])
    if offer.get("expected_date"):
        po.expected_date = date.fromisoformat(str(offer["expected_date"]))
    compute_po(po)
    po.status = "confirmed"
    po.supplier_confirmed_at = utcnow()
    from app.modules.finance.service import upsert_commitment

    supplier = db.get(Supplier, po.supplier_id)
    upsert_commitment(
        db,
        project_id=po.project_id,
        lot_id=po.lot_id,
        category="materiaux",
        source_type="purchase_order",
        source_id=po.id,
        label=f"BC {po.number} — {supplier.legal_name if supplier else ''}",
        amount=Decimal(po.subtotal),
    )
    emit(
        db,
        "purchase_order.confirmed",
        {
            "id": po.id,
            "number": po.number,
            "supplier": supplier.legal_name if supplier else "",
            "expected_date": po.expected_date,
            "project_name": "",
            "site_name": None,
            "created_by_id": po.created_by_id,
            "site_manager_id": _site_manager(db, po),
        },
        aggregate_type="purchase_order",
        aggregate_id=po.id,
        project_id=po.project_id,
    )
    audit.record(
        db,
        family="business",
        module="procurement",
        action="COUNTER_ACCEPT",
        resource_type="purchase_order",
        resource_id=po.id,
        project_id=po.project_id,
        actor_id=user_id,
        diff={"total": str(po.total)},
        criticality="MEDIUM",
    )
    return po


def announce_shipment(
    db: Session,
    po: PurchaseOrder,
    *,
    eta: Any,
    carrier: str | None,
    tracking: str | None,
    vehicle: str | None,
    driver: str | None,
    driver_phone: str | None,
    note_ref: str | None,
    announced_by: str = "supplier",
) -> Delivery:
    if po.status not in ("confirmed", "partially_received", "shipped"):
        raise BusinessRuleError("Le bon de commande doit être confirmé avant expédition")
    delivery = Delivery(
        number=next_number(db, "delivery"),
        purchase_order_id=po.id,
        supplier_id=po.supplier_id,
        project_id=po.project_id,
        site_id=po.site_id,
        status="in_transit",
        shipped_at=utcnow(),
        eta=eta,
        carrier=carrier,
        tracking_ref=tracking,
        vehicle_plate=vehicle,
        driver_name=driver,
        driver_phone=driver_phone,
        delivery_note_ref=note_ref,
        announced_by=announced_by,
    )
    db.add(delivery)
    po.eta = eta
    po.carrier = carrier
    po.tracking_ref = tracking
    if po.status == "confirmed":
        po.status = "shipped"
    db.flush()
    supplier = db.get(Supplier, po.supplier_id)
    emit(
        db,
        "delivery.announced",
        {
            "id": delivery.id,
            "po_number": po.number,
            "eta": eta,
            "carrier": carrier,
            "supplier": supplier.legal_name if supplier else "",
            "site_manager_id": _site_manager(db, po),
        },
        aggregate_type="delivery",
        aggregate_id=delivery.id,
        project_id=po.project_id,
    )
    audit.record(
        db,
        family="business",
        module="deliveries",
        action="ANNOUNCE",
        resource_type="delivery",
        resource_id=delivery.id,
        project_id=po.project_id,
        actor_type=announced_by,
        diff={"eta": str(eta), "carrier": carrier},
    )
    return delivery


# ============================================================================ réception (GRN)
def create_receipt(
    db: Session,
    *,
    po: PurchaseOrder | None,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    lines: list[dict[str, Any]],
    data: dict[str, Any],
) -> GoodsReceipt:
    """Réception : quantités, qualité, lot, photos, BL, livreur, véhicule, heure, géolocalisation (V4-SUP-12)."""
    if po is not None and po.status not in ("confirmed", "shipped", "partially_received", "countered"):
        raise BusinessRuleError("Réception impossible pour ce bon de commande (statut " + po.status + ")")
    receipt = GoodsReceipt(
        number=next_number(db, "goods_receipt"),
        purchase_order_id=po.id if po else None,
        supplier_id=po.supplier_id if po else data.get("supplier_id"),
        project_id=project_id,
        site_id=data.get("site_id") or (po.site_id if po else None),
        warehouse_id=data.get("warehouse_id"),
        destination=data.get("destination", "stock"),
        delivery_id=data.get("delivery_id"),
        received_by_id=user_id,
        received_at=data.get("received_at") or utcnow(),
        latitude=data.get("latitude"),
        longitude=data.get("longitude"),
        geo_accuracy_m=data.get("geo_accuracy_m"),
        driver_name=data.get("driver_name"),
        vehicle_plate=data.get("vehicle_plate"),
        delivery_note_ref=data.get("delivery_note_ref"),
        notes=data.get("notes"),
        photo_file_ids=[str(x) for x in data.get("photo_file_ids", [])],
        delivery_note_file_id=data.get("delivery_note_file_id"),
        invoice_file_id=data.get("invoice_file_id"),
        signature_file_id=data.get("signature_file_id"),
        source=data.get("source", "web"),
        status="draft",
    )
    if po is not None and receipt.delivery_id is None:
        pending_delivery = (
            db.execute(
                select(Delivery)
                .where(Delivery.purchase_order_id == po.id, Delivery.status.in_(["announced", "in_transit", "arrived"]))
                .order_by(Delivery.created_at)
            )
            .scalars()
            .first()
        )
        receipt.delivery_id = pending_delivery.id if pending_delivery else None
    po_lines = {str(li.id): li for li in (po.lines if po else [])}
    exceptions: list[dict[str, Any]] = []
    if po is None:
        exceptions.append({"type": "delivery_without_po", "message": "Livraison sans bon de commande"})
    for raw in lines:
        po_line = po_lines.get(str(raw.get("po_line_id"))) if raw.get("po_line_id") else None
        received = qty(raw.get("quantity_received", 0))
        rejected = qty(raw.get("quantity_rejected", 0))
        if rejected > received:
            raise BusinessRuleError("Quantité refusée supérieure à la quantité reçue")
        accepted = qty(raw.get("quantity_accepted", received - rejected))
        ordered = Decimal(po_line.quantity) if po_line else Decimal("0")
        line = GoodsReceiptLine(
            po_line_id=po_line.id if po_line else None,
            stock_item_id=raw.get("stock_item_id") or (po_line.stock_item_id if po_line else None),
            description=raw.get("description") or (po_line.description if po_line else "Article"),
            unit=raw.get("unit") or (po_line.unit if po_line else "u"),
            quantity_ordered=ordered,
            quantity_received=received,
            quantity_accepted=accepted,
            quantity_rejected=rejected,
            rejection_reason=raw.get("rejection_reason"),
            condition_notes=raw.get("condition_notes"),
            batch_number=raw.get("batch_number"),
            expiry_date=raw.get("expiry_date"),
            unit_price=Decimal(po_line.unit_price) if po_line else money(raw.get("unit_price", 0)),
            is_substitution=bool(raw.get("is_substitution")),
            substitution_status="pending" if raw.get("is_substitution") else None,
        )
        receipt.lines.append(line)
        if rejected > 0:
            exceptions.append(
                {"type": raw.get("rejection_reason") or "rejected", "line": line.description, "quantity": str(rejected)}
            )
        if po_line is not None:
            already = Decimal(po_line.quantity_received)
            if already + received < ordered:
                exceptions.append(
                    {"type": "partial_delivery", "line": line.description, "missing": str(ordered - already - received)}
                )
            if already + received > ordered:
                exceptions.append(
                    {"type": "excess_delivery", "line": line.description, "excess": str(already + received - ordered)}
                )
        if line.is_substitution:
            exceptions.append(
                {
                    "type": "substitution",
                    "line": line.description,
                    "message": "Substitution à valider par le responsable achats",
                }
            )
    receipt.exceptions = exceptions
    receipt.has_exceptions = bool(exceptions)
    db.add(receipt)
    db.flush()
    audit.record(
        db,
        family="business",
        module="deliveries",
        action="CREATE",
        resource_type="goods_receipt",
        resource_id=receipt.id,
        project_id=project_id,
        diff={"lines": len(lines), "exceptions": len(exceptions)},
    )
    return receipt


def validate_receipt(db: Session, receipt: GoodsReceipt, *, user_id: uuid.UUID) -> GoodsReceipt:
    from app.modules.inventory import service as stock
    from app.modules.inventory.models import StockAllocation, StockItem

    if receipt.status != "draft":
        raise BusinessRuleError("Bon de réception déjà validé")
    if any(line.is_substitution and line.substitution_status != "approved" for line in receipt.lines):
        raise BusinessRuleError("Substitution non approuvée : validation impossible", code="SUBSTITUTION_PENDING")
    if not receipt.photo_file_ids and not receipt.delivery_note_file_id:
        raise BusinessRuleError(
            "Preuve requise : photo de la livraison ou bon de livraison scanné", code="PROOF_REQUIRED"
        )
    po = db.get(PurchaseOrder, receipt.purchase_order_id) if receipt.purchase_order_id else None
    for line in receipt.lines:
        if po is not None and line.po_line_id:
            po_line = db.get(PurchaseOrderLine, line.po_line_id)
            if po_line:
                po_line.quantity_received = qty(Decimal(po_line.quantity_received) + Decimal(line.quantity_received))
                po_line.quantity_accepted = qty(Decimal(po_line.quantity_accepted) + Decimal(line.quantity_accepted))
        if Decimal(line.quantity_accepted) <= 0 or not line.stock_item_id:
            continue
        item = db.get(StockItem, line.stock_item_id)
        if item is None:
            continue
        if receipt.destination == "stock":
            if receipt.warehouse_id is None:
                raise BusinessRuleError("Entrepôt de destination requis pour une entrée en stock")
            stock.receive(
                db,
                item=item,
                warehouse_id=receipt.warehouse_id,
                quantity=Decimal(line.quantity_accepted),
                unit_cost=Decimal(line.unit_price),
                user_id=user_id,
                reference_type="goods_receipt",
                reference_id=receipt.id,
                batch_number=line.batch_number,
                supplier_id=receipt.supplier_id,
                expiry=line.expiry_date,
                project_id=receipt.project_id,
                goods_receipt_id=receipt.id,
            )
        else:
            db.add(
                StockAllocation(
                    item_id=item.id,
                    project_id=receipt.project_id,
                    site_id=receipt.site_id,
                    lot_id=po.lot_id if po else None,
                    quantity=line.quantity_accepted,
                    quantity_issued=line.quantity_accepted,
                    status="issued",
                    goods_receipt_id=receipt.id,
                    requested_by_id=user_id,
                    unit_cost=line.unit_price,
                )
            )
    if po is not None:
        complete = all(Decimal(li.quantity_received) >= Decimal(li.quantity) for li in po.lines)
        po.status = "received" if complete else "partially_received"
    receipt.status = "validated"
    receipt.validated_by_id = user_id
    receipt.validated_at = utcnow()
    if receipt.delivery_id:
        delivery = db.get(Delivery, receipt.delivery_id)
        if delivery:
            delivery.status = "received" if (po is None or po.status == "received") else "partially_received"
            delivery.arrived_at = delivery.arrived_at or receipt.received_at
    if receipt.has_exceptions and receipt.supplier_id:
        for exc in receipt.exceptions:
            if exc["type"] in ("damaged", "different", "missing", "quality", "partial_delivery"):
                db.add(
                    SupplierIncident(
                        supplier_id=receipt.supplier_id,
                        kind={
                            "damaged": "damaged",
                            "different": "wrong_product",
                            "missing": "missing",
                            "partial_delivery": "missing",
                            "quality": "damaged",
                        }[exc["type"]],
                        purchase_order_id=receipt.purchase_order_id,
                        goods_receipt_id=receipt.id,
                        description=f"{exc.get('line', '')} — {exc.get('quantity') or exc.get('missing') or ''}",
                        created_by_id=user_id,
                    )
                )
        emit(
            db,
            "goods_receipt.exception",
            {"id": receipt.id, "number": receipt.number, "summary": "; ".join(e["type"] for e in receipt.exceptions)},
            aggregate_type="goods_receipt",
            aggregate_id=receipt.id,
            project_id=receipt.project_id,
        )
    emit(
        db,
        "goods_receipt.validated",
        {
            "id": receipt.id,
            "number": receipt.number,
            "po_number": po.number if po else "sans BC",
            "lines": len(receipt.lines),
            "po_created_by_id": po.created_by_id if po else None,
        },
        aggregate_type="goods_receipt",
        aggregate_id=receipt.id,
        project_id=receipt.project_id,
    )
    if receipt.supplier_id:
        refresh_supplier_kpis(db, receipt.supplier_id)
    audit.record(
        db,
        family="business",
        module="deliveries",
        action="VALIDATE",
        resource_type="goods_receipt",
        resource_id=receipt.id,
        project_id=receipt.project_id,
        actor_id=user_id,
        diff={"po": po.number if po else None, "exceptions": len(receipt.exceptions)},
        criticality="MEDIUM",
    )
    return receipt


def approve_substitution(db: Session, line: GoodsReceiptLine, *, user_id: uuid.UUID, approve: bool) -> None:
    if not line.is_substitution:
        raise BusinessRuleError("Ligne sans substitution")
    line.substitution_status = "approved" if approve else "rejected"
    line.substitution_approved_by_id = user_id
    if not approve:
        line.quantity_rejected = line.quantity_received
        line.quantity_accepted = Decimal("0")
        line.rejection_reason = "different"


def create_return(db: Session, receipt: GoodsReceipt, *, user_id: uuid.UUID, reason: str) -> SupplierReturn:
    lines = [
        {"description": li.description, "quantity": str(li.quantity_rejected), "unit_price": str(li.unit_price)}
        for li in receipt.lines
        if Decimal(li.quantity_rejected) > 0
    ]
    if not lines:
        raise BusinessRuleError("Aucune quantité refusée à retourner")
    amount = money(sum((Decimal(li.quantity_rejected) * Decimal(li.unit_price) for li in receipt.lines), Decimal("0")))
    ret = SupplierReturn(
        number=next_number(db, "supplier_return"),
        supplier_id=receipt.supplier_id,
        goods_receipt_id=receipt.id,
        purchase_order_id=receipt.purchase_order_id,
        reason=reason,
        lines=lines,
        amount=amount,
        created_by_id=user_id,
    )
    db.add(ret)
    db.flush()
    audit.record(
        db,
        family="business",
        module="deliveries",
        action="RETURN",
        resource_type="supplier_return",
        resource_id=ret.id,
        project_id=receipt.project_id,
        diff={"amount": str(amount)},
    )
    return ret


# ============================================================================ KPI fournisseurs
def refresh_supplier_kpis(db: Session, supplier_id: uuid.UUID) -> Supplier:
    """Score qualité, taux de service, taux d'erreur, ponctualité, retard moyen (scorecard)."""
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise NotFound("Fournisseur introuvable")
    ratings = db.execute(select(SupplierRating).where(SupplierRating.supplier_id == supplier_id)).scalars().all()
    if ratings:
        supplier.quality_score = Decimal(str(round(sum(r.average for r in ratings) / len(ratings) * 20, 2)))
    receipts = (
        db.execute(
            select(GoodsReceipt).where(GoodsReceipt.supplier_id == supplier_id, GoodsReceipt.status == "validated")
        )
        .scalars()
        .all()
    )
    lines = [li for r in receipts for li in r.lines]
    if lines:
        complete = sum(
            1 for li in lines if Decimal(li.quantity_accepted) >= Decimal(li.quantity_ordered or li.quantity_received)
        )
        supplier.service_rate = Decimal(str(round(complete * 100 / len(lines), 2)))
        errors = sum(1 for li in lines if Decimal(li.quantity_rejected) > 0 or li.is_substitution)
        supplier.error_rate = Decimal(str(round(errors * 100 / len(lines), 2)))
    pos = (
        db.execute(
            select(PurchaseOrder).where(
                PurchaseOrder.supplier_id == supplier_id, PurchaseOrder.expected_date.is_not(None)
            )
        )
        .scalars()
        .all()
    )
    delays = []
    for po in pos:
        first = db.execute(
            select(func.min(GoodsReceipt.received_at)).where(
                GoodsReceipt.purchase_order_id == po.id, GoodsReceipt.status == "validated"
            )
        ).scalar()
        if first:
            delays.append((first.date() - po.expected_date).days)
    if delays:
        supplier.on_time_rate = Decimal(str(round(sum(1 for d in delays if d <= 0) * 100 / len(delays), 2)))
        supplier.avg_delay_days = Decimal(str(round(sum(max(0, d) for d in delays) / len(delays), 2)))
    if not ratings and lines:
        supplier.quality_score = Decimal(
            str(round(float(supplier.service_rate) * 0.7 + (100 - float(supplier.error_rate)) * 0.3, 2))
        )
    return supplier


def record_price_history(db: Session, po: PurchaseOrder, *, user_id: uuid.UUID) -> None:
    for line in po.lines:
        if not line.supplier_product_id:
            continue
        product = db.get(SupplierProduct, line.supplier_product_id)
        if product and Decimal(product.unit_price) != Decimal(line.unit_price):
            db.add(
                SupplierPriceHistory(
                    product_id=product.id,
                    unit_price=line.unit_price,
                    valid_from=date.today(),
                    source="po",
                    reference=po.number,
                    created_by_id=user_id,
                )
            )


def handle_whatsapp_inbound(db: Session, event: dict[str, Any]) -> None:
    """Réponse rapide WhatsApp (boutons « Confirmer » / « Refuser ») d'un fournisseur."""
    payload = event.get("payload") or ""
    if not payload.startswith(("PO_CONFIRM:", "PO_REFUSE:")):
        return
    action, _, number = payload.partition(":")
    po = db.execute(select(PurchaseOrder).where(PurchaseOrder.number == number)).scalar_one_or_none()
    if po is None:
        return
    supplier = db.get(Supplier, po.supplier_id)
    sender = (event.get("from") or "").lstrip("+")
    if supplier is None or (supplier.whatsapp_number or "").lstrip("+").replace(" ", "") != sender:
        log.warning("whatsapp_reply_unknown_sender", extra={"po": number})
        return
    try:
        supplier_respond(
            db,
            po,
            action="confirm" if action == "PO_CONFIRM" else "refuse",
            note="Réponse via WhatsApp Business",
            counter=None,
            actor_label=supplier.legal_name,
            channel="whatsapp",
        )
    except Conflict:
        return
