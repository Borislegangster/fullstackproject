"""Signature manuscrite des documents émis, validée électroniquement.

1. Le signataire dessine sa signature (souris, doigt, stylet) ; elle est normalisée (PNG transparent, encre bleu nuit).
2. Il la valide avec un code à usage unique reçu personnellement (e-mail, SMS, WhatsApp) et son consentement
   explicite : c'est la signature électronique, qui l'authentifie et l'engage.
3. La preuve (`documents.Signature`, method = otp_drawn) lie le tracé, l'identité, le canal du code, l'adresse IP,
   le navigateur et l'empreinte du contenu signé ; l'audit trace l'opération.
4. Le PDF est réédité : la signature est apposée dans le bloc de sa partie, par-dessus le cachet de l'entreprise pour
   GLOBUS ENGINEERING. Si le contenu change ensuite, la signature n'est plus apposée (empreinte différente).
"""

from __future__ import annotations

import base64
import hashlib
import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.errors import AppError, BusinessRuleError, Conflict, Forbidden, NotFound
from app.core.events import emit
from app.core.security import generate_numeric_code, random_token, sha256_hex
from app.core.utils import utcnow
from app.modules.documents.models import DocumentSeal, Signature
from app.modules.documents.seals import PARTY_LABELS, signature_reference, signatures_of
from app.modules.signatures.registry import CLIENT, COMPANY, Signable

CONSENT = (
    "Je reconnais que la signature manuscrite apposée est la mienne. Je l'authentifie par le code à usage unique "
    "reçu personnellement et j'approuve le présent document dans son contenu actuel."
)
LINK_TTL_DAYS = 30
LINK_PURPOSE = "sign_link"
LINK_OTP_PURPOSE = "otp_sign_link"
OTP_PURPOSE = "otp_doc_sign"


@dataclass
class Signer:
    name: str
    email: str | None
    user_id: uuid.UUID | None = None
    via: str = "erp"  # erp / espace_client / lien


# ---------------------------------------------------------------------------- état d'un document
def seal_row(db: Session, signable: Signable, entity_id: uuid.UUID) -> DocumentSeal | None:
    return db.execute(
        select(DocumentSeal).where(
            DocumentSeal.kind == signable.kind,
            DocumentSeal.entity_type == signable.entity_type,
            DocumentSeal.entity_id == entity_id,
        )
    ).scalar_one_or_none()


def current_pdf(db: Session, signable: Signable, entity: Any) -> tuple[bytes, DocumentSeal]:
    """PDF à jour (cachet, signatures valables) et son sceau, dont l'empreinte du contenu engageant."""
    data = signable.render(db, entity)
    row = seal_row(db, signable, entity.id)
    if row is None or not row.content_hash:
        raise AppError("Document sans sceau d'authenticité", code="SEAL_MISSING", status_code=500)
    return data, row


def block_reason(db: Session, signable: Signable, entity: Any, party: str) -> str | None:
    if party == COMPANY:
        return signable.company_block(db, entity)
    if party == CLIENT and signable.client_block is not None:
        return signable.client_block(db, entity)
    return "Cette partie ne signe pas ce document"


def parties_state(db: Session, signable: Signable, entity: Any, content_hash: str | None) -> list[dict[str, Any]]:
    latest: dict[str, Signature] = {}
    for sig in signatures_of(db, kind=signable.kind, entity_id=entity.id):
        latest.setdefault(sig.party or "", sig)
    out = []
    for party in signable.parties:
        sig = latest.get(party)
        valid = sig is not None and bool(content_hash) and sig.signed_hash == content_hash
        out.append(
            {
                "party": party,
                "label": PARTY_LABELS.get(party, party),
                "signed": valid,
                "stale": sig is not None and not valid,  # signé, puis le document a changé : à signer de nouveau
                "signer_name": sig.signer_name if sig else None,
                "signed_at": sig.signed_at if sig else None,
                "reference": signature_reference(sig) if sig else None,
                "blocked": None if valid else block_reason(db, signable, entity, party),
            }
        )
    return out


def payload(db: Session, signable: Signable, entity: Any, row: DocumentSeal) -> dict[str, Any]:
    return {
        "kind": signable.kind,
        "kind_label": signable.label,
        "entity_id": entity.id,
        "reference": signable.reference(entity),
        "title": signable.title(entity),
        "party_name": row.party,
        "amount": row.amount,
        "currency": row.currency,
        "issued_on": row.issued_on,
        "verify_url": f"/verification/{row.token}",
        "erp_link": signable.erp_link.format(id=entity.id),
        "parties": parties_state(db, signable, entity, row.content_hash),
        "consent": CONSENT,
    }


# ---------------------------------------------------------------------------- droits
def check_party(access: Any, signable: Signable, entity: Any, party: str) -> None:
    """Entreprise : droit « signer au nom de l'entreprise » + consultation du document. Client : son document."""
    if party == COMPANY:
        if not access.p.is_internal:
            raise Forbidden("Seule l'entreprise signe ce bloc", code="SIGNATURE_PARTY_DENIED")
        access.require("signatures:company", signable.read_perm)
        project_id = getattr(entity, "project_id", None)
        if project_id:
            access.require_project(project_id)
        return
    if party == CLIENT and signable.client_scope is not None and signable.client_scope(access, entity):
        access.require("client:decide")
        return
    raise Forbidden("Vous ne pouvez pas signer ce document", code="SIGNATURE_PARTY_DENIED")


# ---------------------------------------------------------------------------- code à usage unique (compte)
def request_otp(db: Session, *, signable: Signable, entity: Any, party: str, user: Any, channel: str) -> dict[str, Any]:
    from app.modules.identity.service import issue_otp

    reason = block_reason(db, signable, entity, party)
    if reason:
        raise BusinessRuleError(reason, code="NOT_SIGNABLE")
    return issue_otp(
        db,
        user,
        purpose=OTP_PURPOSE,
        channel=channel,
        payload={
            "kind": signable.kind,
            "entity_id": str(entity.id),
            "party": party,
            "label": f"signature : {signable.label} {signable.reference(entity)}",
        },
    )


def verify_account_otp(
    db: Session, *, signable: Signable, entity: Any, party: str, user: Any, otp_token: str, code: str
) -> dict[str, Any]:
    from app.modules.identity.service import verify_otp

    proof = verify_otp(db, user, purpose=OTP_PURPOSE, otp_token=otp_token, code=code)
    data = proof["payload"]
    if data.get("kind") != signable.kind or data.get("entity_id") != str(entity.id) or data.get("party") != party:
        raise BusinessRuleError("Code émis pour un autre document", code="OTP_WRONG_DOCUMENT")
    return proof


# ---------------------------------------------------------------------------- signature
def sign(
    db: Session,
    *,
    signable: Signable,
    entity: Any,
    party: str,
    signer: Signer,
    image: str,
    otp: dict[str, Any],
    ip: str | None,
    user_agent: str | None,
    principal: Any = None,
    remember: bool = False,
) -> Signature:
    """Appose la signature manuscrite validée par le code ; réédite le PDF. `otp` = preuve du code vérifié."""
    from app.core.files import store_generated
    from app.core.stamp import decode_data_url, normalize_signature

    reason = block_reason(db, signable, entity, party)
    if reason:
        raise BusinessRuleError(reason, code="NOT_SIGNABLE")
    if party == COMPANY and principal is not None:
        from app.core.sod import require_other_person

        require_other_person(
            db,
            principal,
            getattr(entity, "created_by_id", None),
            "Double regard : la personne qui a établi le document ne le signe pas au nom de l'entreprise",
            resource_type=signable.kind,
            resource_id=entity.id,
            project_id=getattr(entity, "project_id", None),
        )
    unsigned, row = current_pdf(db, signable, entity)
    for sig in signatures_of(db, kind=signable.kind, entity_id=entity.id):
        if sig.party == party and sig.signed_hash == row.content_hash:
            raise Conflict("Ce document est déjà signé pour cette partie", code="ALREADY_SIGNED")
    png = normalize_signature(decode_data_url(image))
    reference = signable.reference(entity)
    stored = store_generated(
        db,
        png,
        filename=f"signature-{signable.kind}-{reference}.png",
        mime="image/png",
        purpose="signatures",
        classification="confidential",
        uploaded_by_id=signer.user_id,
    )
    signature = Signature(
        entity_type=signable.kind,
        entity_id=entity.id,
        party=party,
        role=PARTY_LABELS.get(party, party),
        signer_id=signer.user_id,
        signer_name=signer.name[:200],
        signer_email=signer.email,
        method="otp_drawn",
        signed_hash=row.content_hash,
        signature_image_file_id=stored.id,
        otp_channel=otp.get("channel"),
        ip=ip,
        user_agent=(user_agent or "")[:400],
        certificate={
            "document": signable.label,
            "reference": reference,
            "title": signable.title(entity),
            "content_hash": row.content_hash,
            "pdf_sha256_before": hashlib.sha256(unsigned).hexdigest(),
            "image_sha256": hashlib.sha256(png).hexdigest(),
            "otp_verified_at": str(otp.get("verified_at")),
            "otp_token_id": otp.get("token_id"),
            "consent": CONSENT,
            "via": signer.via,
        },
    )
    db.add(signature)
    db.flush()
    audit.record(
        db,
        family="business",
        module="signatures",
        action="SIGN",
        resource_type=signable.kind,
        resource_id=entity.id,
        actor_id=signer.user_id,
        actor_type="user" if signer.user_id else "client",
        actor_label=signer.name,
        diff={"party": party, "fingerprint": row.content_hash, "reference": reference, "via": signer.via},
        criticality="HIGH",
        project_id=getattr(entity, "project_id", None),
    )
    if signable.on_signed is not None:
        signable.on_signed(db, entity, signature)
    data = signable.render(db, entity)
    if signable.persist is not None:
        signable.persist(db, entity, data)
    if remember and signer.user_id:
        remember_signature(db, signer.user_id, stored.id)
    return signature


# ---------------------------------------------------------------------------- signature mémorisée
def remember_signature(db: Session, user_id: uuid.UUID, file_id: uuid.UUID) -> None:
    from app.modules.identity.models import User

    user = db.get(User, user_id)
    if user is not None:
        user.preferences = {**(user.preferences or {}), "signature_file_id": str(file_id)}


def saved_signature(db: Session, user: Any) -> str | None:
    """Signature mémorisée (data URL PNG) pour la réapposer sans la redessiner."""
    from app.core.files import read_private
    from app.modules.system.models import StoredFile

    file_id = (user.preferences or {}).get("signature_file_id")
    stored = db.get(StoredFile, uuid.UUID(file_id)) if file_id else None
    if stored is None:
        return None
    return "data:image/png;base64," + base64.b64encode(read_private(stored)).decode()


def forget_signature(user: Any) -> None:
    user.preferences = {k: v for k, v in (user.preferences or {}).items() if k != "signature_file_id"}


# ---------------------------------------------------------------------------- demande de signature au client
def request_client_signature(
    db: Session, *, signable: Signable, entity: Any, email: str | None, name: str | None, user_id: uuid.UUID
) -> dict[str, Any]:
    """Envoie au client un lien personnel de signature (sans compte) et le prévient dans son espace client."""
    from app.modules.notifications.service import queue_external

    if signable.client_block is None or signable.kind == "quote":
        raise BusinessRuleError("Utilisez l'envoi du devis : le lien reçu permet de le signer", code="USE_QUOTE_SEND")
    if signable.kind == "contract" and entity.status == "draft":
        entity.status = "sent"
        entity.sent_at = utcnow()
    reason = signable.client_block(db, entity)
    if reason:
        raise BusinessRuleError(reason, code="NOT_SIGNABLE")
    contact_name, contact_email = signable.contact(db, entity) if signable.contact else (None, None)
    email = (email or contact_email or "").strip().lower()
    if not email:
        raise BusinessRuleError("Aucun e-mail de contact : indiquez l'adresse du signataire", code="NO_CONTACT_EMAIL")
    name = name or contact_name
    token = random_token(32)
    db.add(
        _user_token(
            email=email,
            purpose=LINK_PURPOSE,
            token=token,
            payload={"kind": signable.kind, "entity_id": str(entity.id), "party": CLIENT, "name": name},
            ttl=timedelta(days=LINK_TTL_DAYS),
        )
    )
    link = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/signature/{token}"
    reference = signable.reference(entity)
    queue_external(
        db,
        channel="email",
        recipient=email,
        template_code="signature.link",
        context={
            "first_name": (name or "").split(" ")[0],
            "document": signable.label,
            "reference": reference,
            "title": signable.title(entity),
            "link": link,
            "ttl_days": LINK_TTL_DAYS,
        },
    )
    signer_ids = _client_user_ids(db, entity)
    if signer_ids:
        emit(
            db,
            "signature.requested",
            {
                "title": f"{signable.label} {reference}",
                "link": "/espace-client/signatures",
                "signer_ids": [str(u) for u in signer_ids],
            },
            aggregate_type=signable.kind,
            aggregate_id=entity.id,
            project_id=getattr(entity, "project_id", None),
        )
    audit.record(
        db,
        family="business",
        module="signatures",
        action="REQUEST",
        resource_type=signable.kind,
        resource_id=entity.id,
        actor_id=user_id,
        diff={"email": email, "reference": reference},
        project_id=getattr(entity, "project_id", None),
    )
    return {"sent_to": email, "expires_in_days": LINK_TTL_DAYS}


def _client_user_ids(db: Session, entity: Any) -> list[uuid.UUID]:
    from app.modules.identity.models import User

    org_id = getattr(entity, "organization_id", None)
    if not org_id:
        return []
    return list(db.execute(select(User.id).where(User.organization_id == org_id, User.is_active.is_(True))).scalars())


def _user_token(*, email: str, purpose: str, token: str, payload: dict[str, Any], ttl: timedelta) -> Any:
    from app.core.context import get_context
    from app.modules.identity.models import UserToken

    return UserToken(
        email=email,
        purpose=purpose,
        token_hash=sha256_hex(token),
        payload=payload,
        expires_at=utcnow() + ttl,
        ip=get_context().ip,
    )


# ---------------------------------------------------------------------------- lien personnel (sans compte)
def link_row(db: Session, token: str) -> Any:
    from app.modules.identity.models import UserToken

    row = db.execute(
        select(UserToken).where(UserToken.purpose == LINK_PURPOSE, UserToken.token_hash == sha256_hex(token))
    ).scalar_one_or_none()
    if row is None or row.expires_at < utcnow():
        raise NotFound("Lien de signature introuvable ou expiré")
    return row


def issue_link_otp(db: Session, link: Any, *, signable: Signable, entity: Any) -> dict[str, Any]:
    from app.modules.notifications.service import queue_external

    reason = block_reason(db, signable, entity, CLIENT)
    if reason:
        raise BusinessRuleError(reason, code="NOT_SIGNABLE")
    code = generate_numeric_code(6)
    otp_token = random_token(24)
    db.add(
        _user_token(
            email=link.email,
            purpose=LINK_OTP_PURPOSE,
            token=otp_token,
            payload={"link_id": str(link.id), "code_hash": sha256_hex(f"{otp_token}:{code}")},
            ttl=timedelta(minutes=10),
        )
    )
    queue_external(
        db,
        channel="email",
        recipient=link.email,
        template_code="auth.otp",
        context={
            "first_name": (link.payload.get("name") or "").split(" ")[0],
            "code": code,
            "ttl_minutes": 10,
            "purpose": f"signature : {signable.label} {signable.reference(entity)}",
        },
    )
    result: dict[str, Any] = {
        "otp_token": otp_token,
        "channel": "email",
        "sent_to": link.email[:3] + "•••" + link.email[-6:],
    }
    if settings.ENV == "test":
        result["test_code"] = code
    return result


def verify_link_otp(db: Session, link: Any, *, otp_token: str, code: str) -> dict[str, Any]:
    from app.modules.identity.models import UserToken

    row = db.execute(
        select(UserToken)
        .where(UserToken.purpose == LINK_OTP_PURPOSE, UserToken.token_hash == sha256_hex(otp_token))
        .with_for_update()
    ).scalar_one_or_none()
    if row is None or row.used_at or row.expires_at < utcnow() or row.payload.get("link_id") != str(link.id):
        raise AppError("Code expiré, demandez-en un nouveau", code="OTP_EXPIRED")
    if row.attempts >= 5:
        raise AppError("Trop de tentatives, demandez un nouveau code", code="OTP_LOCKED")
    if sha256_hex(f"{otp_token}:{code.strip()}") != row.payload.get("code_hash"):
        row.attempts += 1
        db.commit()
        raise AppError("Code incorrect", code="OTP_INVALID")
    row.used_at = utcnow()
    return {"verified_at": row.used_at, "channel": "email", "token_id": str(row.id)}


__all__ = [
    "CONSENT",
    "Signer",
    "block_reason",
    "check_party",
    "current_pdf",
    "forget_signature",
    "issue_link_otp",
    "link_row",
    "payload",
    "remember_signature",
    "request_client_signature",
    "request_otp",
    "saved_signature",
    "seal_row",
    "sign",
    "verify_account_otp",
    "verify_link_otp",
]
