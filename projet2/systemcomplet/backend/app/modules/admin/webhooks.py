"""Webhooks sortants : abonnements configurés dans l'ERP, signature HMAC-SHA256, retries contrôlés."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
import uuid
from datetime import timedelta
from typing import Any
from urllib.parse import urlparse

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.secrets import get_secret
from app.core.utils import jsonable, utcnow
from app.modules.system.models import OutboxEvent, WebhookDelivery, WebhookEndpoint

log = logging.getLogger("globus.webhooks")

# Événements métier exposables aux intégrations (les événements internes : sauvegardes, conversions,
# messagerie, sécurité, ne sont jamais transmis à l'extérieur). « * » = tous les événements publics.
PUBLIC_EVENTS: dict[str, str] = {
    "lead.created": "Nouveau lead",
    "lead.assigned": "Lead affecté",
    "lead.sla_breached": "SLA de lead dépassé",
    "quote.accepted": "Devis accepté",
    "contract.signed": "Contrat signé",
    "project.created": "Projet créé",
    "project.member_added": "Membre ajouté à un projet",
    "decision.requested": "Décision client demandée",
    "decision.validated": "Décision client validée",
    "change_order.submitted": "Avenant soumis",
    "change_order.approved": "Avenant approuvé",
    "daily_log.critical": "Journal de chantier critique",
    "voice_report.received": "Rapport vocal de chantier reçu",
    "purchase_request.submitted": "Demande d'achat soumise",
    "purchase_request.approved": "Demande d'achat approuvée",
    "purchase_request.rejected": "Demande d'achat refusée",
    "purchase_order.confirmed": "Commande confirmée par le fournisseur",
    "purchase_order.countered": "Contre-proposition fournisseur",
    "purchase_order.refused": "Commande refusée par le fournisseur",
    "delivery.announced": "Livraison annoncée",
    "goods_receipt.validated": "Réception validée",
    "goods_receipt.exception": "Réception avec réserves",
    "stock.low": "Stock bas",
    "supplier_invoice.matched": "Facture fournisseur rapprochée",
    "supplier_invoice.match_exception": "Anomalie de rapprochement 3 pièces",
    "funds_call.issued": "Appel de fonds émis",
    "client_invoice.sent": "Facture client émise",
    "billing.payment_reminder": "Relance d'échéance envoyée",
    "client_payment.received": "Paiement client reçu",
    "payment.awaiting_approval": "Paiement à approuver",
    "payment.succeeded": "Paiement réussi",
    "payment.failed": "Paiement échoué",
    "tender.published": "Consultation publiée",
    "bid.submitted": "Offre déposée",
    "bid.awarded": "Offre attribuée",
    "situation.submitted": "Situation de travaux soumise",
    "situation.validated": "Situation validée",
    "situation.rejected": "Situation rejetée",
    "situation.blocked": "Situation bloquée (dépassement)",
    "dispute.opened": "Litige ouvert",
    "dispute.updated": "Litige mis à jour",
    "dispute.escalated": "Litige escaladé",
    "document.approval_requested": "Approbation de document demandée",
    "document.version_published": "Version de document publiée",
    "document.client_published": "Document publié au client",
    "deliverables.released": "Livrables d'études remis au client",
    "signature.requested": "Signature demandée",
    "bim.version_ready": "Maquette BIM prête",
    "bim.version_published": "Maquette BIM publiée",
    "bim.issue_assigned": "Issue BIM affectée",
    "bim.issue_resolved": "Issue BIM résolue",
    "incident.declared": "Incident QHSE déclaré",
    "corrective_action.overdue": "Action corrective en retard",
    "equipment.maintenance_due": "Maintenance d'équipement due",
    "ticket.created": "Ticket SAV créé",
    "ticket.assigned": "Ticket SAV affecté",
    "ticket.sla_breached": "SLA SAV dépassé",
    "tranquillite.due_soon": "Échéance « Tranquillité » proche",
    "anomaly.detected": "Anomalie détectée",
    "prediction.risk": "Risque projet détecté",
}


def unknown_events(events: list[str]) -> list[str]:
    return sorted({e for e in events if e != "*" and e not in PUBLIC_EVENTS})


_BLOCKED_HOSTS = ("localhost", "127.", "10.", "192.168.", "169.254.", "0.", "::1", "[::1]")


def safe_url(url: str) -> bool:
    """Protection SSRF : HTTPS public uniquement (hors réseau interne)."""
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not host:
        return False
    if host.startswith(_BLOCKED_HOSTS) or host.endswith(".internal") or host.endswith(".local"):
        return False
    if host.startswith("172."):
        try:
            second = int(host.split(".")[1])
            if 16 <= second <= 31:
                return False
        except (IndexError, ValueError):
            return False
    return True


# Champs porteurs d'un secret (lien de paiement nominatif, jeton) : jamais transmis aux webhooks sortants.
REDACTED_KEYS = frozenset({"pay_link", "token", "password", "otp"})


def enqueue_outgoing(db: Session, ev: OutboxEvent) -> int:
    endpoints = db.execute(select(WebhookEndpoint).where(WebhookEndpoint.is_active.is_(True))).scalars().all()
    count = 0
    for endpoint in endpoints:
        events = endpoint.events or []
        if "*" not in events and ev.event_type not in events:
            continue
        delivery = WebhookDelivery(
            endpoint_id=endpoint.id,
            event_type=ev.event_type,
            outbox_event_id=ev.id,
            status="pending",
            next_attempt_at=utcnow(),
        )
        db.add(delivery)
        db.flush()
        deliver(db, delivery, ev)
        count += 1
    return count


def sign(secret: str, timestamp: int, body: bytes) -> str:
    return hmac.new(secret.encode(), f"{timestamp}.".encode() + body, hashlib.sha256).hexdigest()


def deliver(db: Session, delivery: WebhookDelivery, ev: OutboxEvent | None = None) -> None:
    endpoint = db.get(WebhookEndpoint, delivery.endpoint_id)
    if endpoint is None or not endpoint.is_active:
        delivery.status = "cancelled"
        return
    if ev is None and delivery.outbox_event_id:
        ev = db.get(OutboxEvent, delivery.outbox_event_id)
    payload: dict[str, Any] = {
        "id": str(delivery.id),
        "type": delivery.event_type,
        "created_at": utcnow().isoformat(),
        "data": {k: v for k, v in jsonable(ev.payload if ev else {}).items() if k not in REDACTED_KEYS},
        "aggregate": {"type": ev.aggregate_type, "id": ev.aggregate_id} if ev else None,
    }
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode()
    secret = get_secret(endpoint.secret_name) or ""
    ts = int(time.time())
    delivery.attempts += 1
    if not safe_url(endpoint.url):
        delivery.status = "failed"
        delivery.last_error = "URL refusée (HTTPS public requis)"
        return
    try:
        resp = httpx.post(
            endpoint.url,
            content=body,
            timeout=10,
            follow_redirects=False,
            headers={
                "Content-Type": "application/json",
                "X-Globus-Event": delivery.event_type,
                "X-Globus-Delivery": str(delivery.id),
                "X-Globus-Timestamp": str(ts),
                "X-Globus-Signature": "v1=" + sign(secret, ts, body),
            },
        )
        delivery.response_code = resp.status_code
        if 200 <= resp.status_code < 300:
            delivery.status = "delivered"
            delivery.delivered_at = utcnow()
            endpoint.last_success_at = utcnow()
            endpoint.failure_count = 0
            return
        delivery.last_error = f"HTTP {resp.status_code}"
    except httpx.HTTPError as exc:
        delivery.last_error = str(exc)[:500]
    endpoint.failure_count += 1
    endpoint.last_failure_at = utcnow()
    if delivery.attempts >= 6:
        delivery.status = "failed"
        if endpoint.failure_count >= 20:
            endpoint.is_active = False  # coupe-circuit
    else:
        delivery.status = "pending"
        delivery.next_attempt_at = utcnow() + timedelta(minutes=2**delivery.attempts)


def retry_pending(db: Session) -> int:
    rows = (
        db.execute(
            select(WebhookDelivery)
            .where(WebhookDelivery.status == "pending", WebhookDelivery.next_attempt_at <= utcnow())
            .limit(100)
        )
        .scalars()
        .all()
    )
    for row in rows:
        deliver(db, row)
    return len(rows)


def new_endpoint_secret_name() -> str:
    return f"WEBHOOK_SECRET_{uuid.uuid4().hex[:12].upper()}"
