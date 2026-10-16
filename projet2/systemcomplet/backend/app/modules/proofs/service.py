"""Preuves opposables — certification des empreintes et ancrage OpenTimestamps (innovation R4).

Principe : on ne certifie jamais un document « en clair » mais son empreinte SHA-256 (fichier) ou celle d'une
représentation canonique (JSON trié) d'un enregistrement figé (décision client, réception). Les lots (photos d'une
journée) sont réduits à une racine de Merkle : chaque photo reste vérifiable individuellement.
Le QR code renvoie vers /verification/{code} ; n'importe qui peut y recalculer l'empreinte d'un fichier dans son
navigateur (rien n'est envoyé au serveur). L'ancrage OpenTimestamps (si activé) est fait par un job, jamais dans la
requête utilisateur ; le reçu `.ots` téléchargeable se vérifie avec l'outil officiel (`ots verify`).
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import uuid
from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.numbering import next_number
from app.core.security import random_token
from app.core.utils import jsonable, utcnow
from app.modules.proofs.models import Proof

log = logging.getLogger("globus.proofs")

OTS_MAGIC = b"\x00OpenTimestamps\x00\x00Proof\x00\xbf\x89\xe2\xe8\x84\xe8\x92\x94"
SUBJECT_LABELS = {
    "document_version": "Document publié",
    "decision": "Décision client validée",
    "goods_receipt": "Réception de livraison",
    "photo_day": "Photos de chantier du jour",
    "building_passport": "Passeport du bâtiment",
    "progress_observation": "Avancement mesuré du chantier",
}


def canonical_sha256(data: Any) -> str:
    """Empreinte d'une représentation JSON canonique (clés triées, sans espaces, UTF-8)."""
    raw = json.dumps(jsonable(data), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def merkle_root(hashes: list[str]) -> str:
    """Racine de Merkle SHA-256 (feuilles hexadécimales ; une feuille impaire est dupliquée)."""
    if not hashes:
        raise ValueError("Lot vide")
    level = [bytes.fromhex(h) for h in hashes]
    while len(level) > 1:
        if len(level) % 2:
            level.append(level[-1])
        level = [hashlib.sha256(level[i] + level[i + 1]).digest() for i in range(0, len(level), 2)]
    return level[0].hex()


def certify(
    db: Session,
    *,
    subject_type: str,
    subject_id: Any,
    title: str,
    sha256: str,
    project_id: uuid.UUID | None,
    summary: dict[str, Any] | None = None,
    leaves: list[dict[str, Any]] | None = None,
    client_visible: bool = False,
    actor_id: uuid.UUID | None = None,
) -> Proof:
    """Enregistre (ou met à jour, pour un lot qui grossit) la preuve d'un sujet ; idempotent."""
    proof = db.execute(
        select(Proof).where(Proof.subject_type == subject_type, Proof.subject_id == str(subject_id))
    ).scalar_one_or_none()
    if proof is not None:
        if proof.sha256 == sha256:
            proof.client_visible = proof.client_visible or client_visible
            return proof
        if subject_type != "photo_day":
            # un sujet figé ne change jamais d'empreinte : toute divergence est tracée, la preuve d'origine reste
            log.warning("proof_hash_mismatch", extra={"subject": f"{subject_type}:{subject_id}"})
            return proof
        proof.sha256 = sha256
        proof.leaves = leaves or []
        proof.summary = jsonable(summary or {})
        proof.client_visible = proof.client_visible or client_visible
        proof.anchor_status = "queued" if settings.ANCHORING_ENABLED else "none"
        proof.anchor_receipt = {}
        proof.anchored_at = None
        db.flush()
        return proof
    proof = Proof(
        number=next_number(db, "proof"),
        project_id=project_id,
        subject_type=subject_type,
        subject_id=str(subject_id),
        title=title[:250],
        summary=jsonable(summary or {}),
        sha256=sha256,
        algorithm="merkle-sha256" if leaves else "sha256",
        leaves=leaves or [],
        public_code=random_token(18),
        client_visible=client_visible,
        anchor_status="queued" if settings.ANCHORING_ENABLED else "none",
        created_by_id=actor_id,
    )
    db.add(proof)
    db.flush()
    return proof


# ---------------------------------------------------------------------------- sujets certifiables
def certify_document_version(db: Session, version_id: uuid.UUID, *, actor_id: uuid.UUID | None = None) -> Proof | None:
    from app.modules.documents.models import Document, DocumentVersion

    version = db.get(DocumentVersion, version_id)
    if version is None or version.status not in ("published", "obsolete") or not version.checksum_sha256:
        return None
    document = db.get(Document, version.document_id)
    if document is None:
        return None
    public_title = document.title if document.confidentiality in ("public", "internal") else "Document GLOBUS"
    return certify(
        db,
        subject_type="document_version",
        subject_id=version.id,
        title=f"{public_title} — version {version.label}",
        sha256=version.checksum_sha256,
        project_id=document.project_id,
        summary={
            "code": document.code,
            "type": document.doc_type,
            "version": version.label,
            "published_at": version.published_at,
            "file_name": version.original_name if document.confidentiality in ("public", "internal") else None,
        },
        client_visible=bool(document.client_visible),
        actor_id=actor_id,
    )


def certify_decision(db: Session, decision_id: uuid.UUID) -> Proof | None:
    from app.modules.projects.models import Decision

    decision = db.get(Decision, decision_id)
    if decision is None or decision.status != "validated" or decision.validated_at is None:
        return None
    record = {
        "number": decision.number,
        "title": decision.title,
        "selected_option": decision.selected_option,
        "price_impact": decision.price_impact,
        "delay_impact_days": decision.delay_impact_days,
        "version_label": decision.version_label,
        "validated_at": decision.validated_at,
        "validated_by_id": decision.validated_by_id,
        "method": decision.validation_method,
        "content_hash": decision.content_hash,
    }
    return certify(
        db,
        subject_type="decision",
        subject_id=decision.id,
        title=f"Décision {decision.number} — {decision.title}",
        sha256=canonical_sha256(record),
        project_id=decision.project_id,
        summary={
            "number": decision.number,
            "title": decision.title,
            "option": decision.selected_option,
            "validated_at": decision.validated_at,
            "method": "Code à usage unique (OTP)"
            if decision.validation_method == "otp"
            else decision.validation_method,
        },
        client_visible=True,
        actor_id=decision.validated_by_id,
    )


def certify_goods_receipt(db: Session, receipt_id: uuid.UUID) -> Proof | None:
    from app.modules.procurement.models import GoodsReceipt
    from app.modules.system.models import StoredFile

    receipt = db.get(GoodsReceipt, receipt_id)
    if receipt is None or receipt.status != "validated":
        return None
    file_ids = [uuid.UUID(str(f)) for f in (receipt.photo_file_ids or [])]
    for extra in (receipt.delivery_note_file_id, receipt.signature_file_id):
        if extra:
            file_ids.append(extra)
    files = [db.get(StoredFile, f) for f in file_ids]
    leaves = [{"label": f"Pièce {i + 1}", "sha256": f.checksum_sha256} for i, f in enumerate(files) if f is not None]
    record = {
        "number": receipt.number,
        "received_at": receipt.received_at,
        "validated_at": receipt.validated_at,
        "gps": [receipt.latitude, receipt.longitude],
        "delivery_note_ref": receipt.delivery_note_ref,
        "lines": [
            {"description": li.description, "received": li.quantity_received, "accepted": li.quantity_accepted}
            for li in receipt.lines
        ],
        "files": [leaf["sha256"] for leaf in leaves],
    }
    record_hash = canonical_sha256(record)
    return certify(
        db,
        subject_type="goods_receipt",
        subject_id=receipt.id,
        title=f"Réception {receipt.number}",
        sha256=merkle_root([record_hash, *[leaf["sha256"] for leaf in leaves]]),
        project_id=receipt.project_id,
        summary={
            "number": receipt.number,
            "received_at": receipt.received_at,
            "lines": len(receipt.lines),
            "pieces": len(leaves),
            "geolocated": receipt.latitude is not None,
        },
        leaves=[{"label": "Enregistrement de la réception", "sha256": record_hash}, *leaves],
        client_visible=False,
        actor_id=receipt.validated_by_id,
    )


def certify_photo_day(db: Session, project_id: uuid.UUID, day: date) -> Proof | None:
    from app.modules.projects.models import SiteMedia
    from app.modules.system.models import StoredFile

    start = datetime.combine(day, time.min).replace(tzinfo=utcnow().tzinfo)
    end = start + timedelta(days=1)
    rows = db.execute(
        select(SiteMedia, StoredFile)
        .join(StoredFile, StoredFile.id == SiteMedia.file_id)
        .where(
            SiteMedia.project_id == project_id,
            func.coalesce(SiteMedia.taken_at, SiteMedia.created_at) >= start,
            func.coalesce(SiteMedia.taken_at, SiteMedia.created_at) < end,
        )
        .order_by(SiteMedia.created_at, SiteMedia.id)
    ).all()
    if not rows:
        return None
    leaves = [
        {
            "label": f"Photo {index + 1}" + (" (géolocalisée)" if media.latitude is not None else ""),
            "sha256": stored.checksum_sha256,
        }
        for index, (media, stored) in enumerate(rows)
    ]
    published = sum(1 for media, _ in rows if media.published_to_client)
    return certify(
        db,
        subject_type="photo_day",
        subject_id=f"{project_id}:{day.isoformat()}",
        title=f"Photos de chantier du {day:%d/%m/%Y}",
        sha256=merkle_root([leaf["sha256"] for leaf in leaves]),
        project_id=project_id,
        summary={"day": day, "photos": len(leaves), "published_to_client": published},
        leaves=leaves,
        client_visible=published > 0,
    )


# ---------------------------------------------------------------------------- ancrage et reçus
def anchor_pending(db: Session) -> dict[str, Any]:
    """Job : soumet aux calendriers OpenTimestamps les empreintes en attente (jamais dans une requête web)."""
    if not settings.ANCHORING_ENABLED:
        return {"items": 0, "skipped": "ANCHORING_ENABLED=false"}
    from app.providers.anchoring import anchor_digest
    from app.providers.base import ProviderError

    queued = (
        db.execute(
            select(Proof)
            .where(Proof.anchor_status.in_(["queued", "failed"]), Proof.revoked_at.is_(None))
            .order_by(Proof.created_at)
            .limit(50)
        )
        .scalars()
        .all()
    )
    done = 0
    for proof in queued:
        try:
            proof.anchor_receipt = anchor_digest(proof.sha256)
            proof.anchor_status = "pending"
            proof.anchored_at = utcnow()
            proof.anchor_error = None
            done += 1
        except ProviderError as exc:
            proof.anchor_status = "failed"
            proof.anchor_error = str(exc)[:500]
    return {"items": done}


def certify_recent_photos(db: Session) -> dict[str, Any]:
    """Job : certifie les lots de photos d'hier et d'aujourd'hui (racine de Merkle par chantier et par jour)."""
    from app.modules.projects.models import SiteMedia

    count = 0
    for day in (date.today() - timedelta(days=1), date.today()):
        start = datetime.combine(day, time.min).replace(tzinfo=utcnow().tzinfo)
        project_ids = (
            db.execute(
                select(func.distinct(SiteMedia.project_id)).where(
                    func.coalesce(SiteMedia.taken_at, SiteMedia.created_at) >= start,
                    func.coalesce(SiteMedia.taken_at, SiteMedia.created_at) < start + timedelta(days=1),
                )
            )
            .scalars()
            .all()
        )
        for project_id in project_ids:
            if certify_photo_day(db, project_id, day) is not None:
                count += 1
    return {"items": count}


def ots_file(proof: Proof) -> bytes:
    """Fichier `.ots` détaché (format OpenTimestamps) : en-tête, empreinte SHA-256, branches des calendriers."""
    receipts = [base64.b64decode(r["receipt_b64"]) for r in (proof.anchor_receipt or {}).get("receipts", [])]
    if not receipts:
        raise ValueError("Aucun reçu d'horodatage pour cette preuve")
    body = b"".join(b"\xff" + r for r in receipts[:-1]) + receipts[-1]
    return OTS_MAGIC + b"\x01" + b"\x08" + bytes.fromhex(proof.sha256) + body


def verification_url(proof: Proof) -> str:
    return f"{settings.PUBLIC_BASE_URL.rstrip('/')}/verification/{proof.public_code}"


def public_payload(proof: Proof) -> dict[str, Any]:
    return jsonable(
        {
            "valid": proof.revoked_at is None,
            "type": "proof",
            "number": proof.number,
            "title": proof.title,
            "subject": SUBJECT_LABELS.get(proof.subject_type, proof.subject_type),
            "subject_type": proof.subject_type,
            "sha256": proof.sha256,
            "algorithm": proof.algorithm,
            "issued_at": proof.created_at,
            "summary": proof.summary,
            "leaves": [{"label": leaf.get("label"), "sha256": leaf.get("sha256")} for leaf in proof.leaves or []],
            "anchor_status": proof.anchor_status,
            "anchored_at": proof.anchored_at,
            "ots_available": bool((proof.anchor_receipt or {}).get("receipts")),
            "revoked": proof.revoked_at is not None,
            "revoked_reason": proof.revoked_reason,
            "message": None if proof.revoked_at is None else "Preuve révoquée",
        }
    )


def proof_out(proof: Proof) -> dict[str, Any]:
    data = public_payload(proof)
    data.update({"id": proof.id, "project_id": proof.project_id, "subject_id": proof.subject_id})
    data["verification_url"] = verification_url(proof)
    data["public_code"] = proof.public_code
    data["client_visible"] = proof.client_visible
    data["anchor_error"] = proof.anchor_error
    return data


def certificate_pdf(db: Session, proof: Proof) -> bytes:
    """Certificat imprimable (QR de vérification, empreinte, horodatage) au format de la charte."""
    from app.core.pdf import PdfDocument, render

    meta = [
        ("Objet", proof.title),
        ("Nature", SUBJECT_LABELS.get(proof.subject_type, proof.subject_type)),
        ("Algorithme", proof.algorithm),
        ("Émise le", proof.created_at.strftime("%d/%m/%Y %H:%M UTC")),
        (
            "Horodatage",
            "OpenTimestamps, soumis le " + proof.anchored_at.strftime("%d/%m/%Y %H:%M UTC")
            if proof.anchored_at
            else "registre GLOBUS (ancrage public non demandé)",
        ),
    ]
    rows = [
        [leaf.get("label") or f"Pièce {i + 1}", leaf.get("sha256") or ""] for i, leaf in enumerate(proof.leaves or [])
    ]
    doc = PdfDocument(
        title="Certificat de preuve",
        number=proof.number,
        issued_on=proof.created_at.date(),
        meta=meta,
        columns=["Pièce du lot", "Empreinte SHA-256"] if rows else [],
        rows=rows[:80],
        col_widths=[150, 330] if rows else None,
        paragraphs=[
            ("Empreinte certifiée", proof.sha256),
            (
                "Vérification",
                "Scannez le QR code : la page de vérification recalcule l'empreinte de votre fichier dans votre "
                "navigateur, sans jamais l'envoyer. Une empreinte identique prouve que le fichier n'a pas été modifié "
                "depuis sa certification.",
            ),
        ],
        verify_token=proof.public_code,
        footer_note="Preuve émise par la plateforme GLOBUS ENGINEERING — registre infalsifiable des empreintes.",
    )
    return render(doc)


__all__ = [
    "SUBJECT_LABELS",
    "anchor_pending",
    "canonical_sha256",
    "certificate_pdf",
    "certify",
    "certify_decision",
    "certify_document_version",
    "certify_goods_receipt",
    "certify_photo_day",
    "certify_recent_photos",
    "merkle_root",
    "ots_file",
    "proof_out",
    "public_payload",
]
