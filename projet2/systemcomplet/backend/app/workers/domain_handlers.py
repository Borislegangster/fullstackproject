"""Handlers métier asynchrones (outbox) : qualification IA des leads, traduction APS des maquettes, sauvegardes et
restaurations, synthèse hebdomadaire. Exécutés par le worker avec reprise et file morte."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy.orm import Session

from app.modules.system.models import OutboxEvent
from app.workers.outbox import handler

log = logging.getLogger("globus.handlers")


def _uuid(value: object) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        return None


@handler("lead.created")
def qualify_lead(db: Session, ev: OutboxEvent) -> None:
    """Résumé et qualification IA (ou règles) d'un nouveau lead — jamais décisionnel."""
    from app.modules.ai.service import qualify_lead as qualify
    from app.modules.crm.models import Lead

    lead = db.get(Lead, _uuid((ev.payload or {}).get("id")))
    if lead is not None and not lead.ai_qualification:
        qualify(db, lead)


@handler("bim.translate")
def translate_bim(db: Session, ev: OutboxEvent) -> None:
    from app.modules.bim.models import BimVersion
    from app.modules.bim.service import start_translation

    version = db.get(BimVersion, _uuid((ev.payload or {}).get("version_id")))
    if version is None:
        return
    try:
        start_translation(db, version)
    except Exception as exc:
        version.status = "failed"
        version.translation_error = f"Envoi APS impossible : {str(exc)[:500]}"
        log.warning("aps_translation_failed", extra={"version": str(version.id)})
        raise


@handler("backup.requested")
def run_backup(db: Session, ev: OutboxEvent) -> None:
    from app.modules.admin.backups import run_backup as execute
    from app.modules.system.models import BackupJob

    job = db.get(BackupJob, _uuid((ev.payload or {}).get("job_id")))
    if job is not None and job.status == "pending":
        execute(db, job)


@handler("backup.restore_test")
def restore_test(db: Session, ev: OutboxEvent) -> None:
    from app.modules.admin.backups import get_job
    from app.modules.admin.backups import restore_test as execute

    payload = ev.payload or {}
    execute(db, get_job(db, _uuid(payload.get("source_id"))), user_id=_uuid(payload.get("user_id")))


@handler("backup.restore")
def restore(db: Session, ev: OutboxEvent) -> None:
    from app.modules.admin.backups import get_job, restore_in_place

    payload = ev.payload or {}
    user_id = _uuid(payload.get("user_id"))
    grant_id = _uuid(payload.get("break_glass_id"))
    if user_id is None or grant_id is None:
        return
    restore_in_place(db, get_job(db, _uuid(payload.get("source_id"))), user_id=user_id, break_glass_id=grant_id)


# ---------------------------------------------------------------------------- preuves opposables (R4)
@handler("document.version_published")
def certify_published_document(db: Session, ev: OutboxEvent) -> None:
    from app.modules.documents.models import Document
    from app.modules.proofs.service import certify_document_version

    document = db.get(Document, _uuid((ev.payload or {}).get("document_id")))
    if document is not None and document.published_version_id:
        certify_document_version(db, document.published_version_id, actor_id=ev.actor_id)


@handler("decision.validated")
def certify_validated_decision(db: Session, ev: OutboxEvent) -> None:
    from app.modules.proofs.service import certify_decision

    decision_id = _uuid((ev.payload or {}).get("id"))
    if decision_id:
        certify_decision(db, decision_id)


@handler("goods_receipt.validated")
def certify_validated_receipt(db: Session, ev: OutboxEvent) -> None:
    from app.modules.proofs.service import certify_goods_receipt

    receipt_id = _uuid((ev.payload or {}).get("id"))
    if receipt_id:
        certify_goods_receipt(db, receipt_id)


# ---------------------------------------------------------------------------- avis clients vérifiés (R6)
@handler("project.status_changed")
def invite_reviews_at_handover(db: Session, ev: OutboxEvent) -> None:
    from app.modules.projects.models import Project
    from app.modules.reviews.service import auto_invite, policy

    payload = ev.payload or {}
    if payload.get("status") not in policy(db)["auto_invite_statuses"]:
        return
    project = db.get(Project, _uuid(payload.get("project_id")))
    if project is not None:
        auto_invite(db, project)


@handler("contract.signed")
def referral_reward_on_signature(db: Session, ev: OutboxEvent) -> None:
    """Programme ambassadeurs (I6) : prime calculée à la signature du contrat du filleul, puis validation humaine."""
    from app.modules.crm.models import Contract
    from app.modules.referrals.service import on_contract_signed

    contract = db.get(Contract, _uuid((ev.payload or {}).get("id")))
    if contract is not None:
        on_contract_signed(db, contract)


@handler("assistant.whatsapp_inbound")
def whatsapp_assistant(db: Session, ev: OutboxEvent) -> None:
    """Assistant WhatsApp (A1) : réponse au client reconnu ou au prospect, depuis le worker."""
    from app.modules.assistant.whatsapp import handle_inbound
    from app.modules.system.models import InboundWebhookEvent

    record = db.get(InboundWebhookEvent, _uuid((ev.payload or {}).get("inbound_id")))
    if record is not None and record.event_type == "message":
        handle_inbound(db, record.payload or {})
