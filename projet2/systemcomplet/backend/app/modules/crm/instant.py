"""Devis budgétaire instantané (innovation A2) : photo du terrain, croquis / plan et note vocale analysés par Claude
(vision), combinés aux barèmes internes de l'estimateur — fourchette affichée en quelques secondes, puis validée ou
ajustée par un ingénieur avant tout engagement.

Garde-fous : l'IA n'invente aucun prix (le montant vient exclusivement des ratios paramétrés par GLOBUS) ; ce que le
prospect déclare prime sur ce que l'IA déduit ; les fichiers restent privés ; la fourchette est marquée « indicative »
tant qu'un ingénieur ne l'a pas validée ; quota par adresse IP (coût IA maîtrisé).
"""

from __future__ import annotations

import json
import logging
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import BusinessRuleError, NotFound
from app.core.utils import jsonable, money, utcnow

log = logging.getLogger("globus.instant_estimate")

MAX_IMAGES = 3
MAX_IMAGE_MB = 8
MAX_AUDIO_MB = 10
VISION_MIMES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

ANALYSIS_FIELDS: dict[str, Any] = {
    "project_type": {"type": "string"},
    "surface_m2": {"type": "number"},  # 0 = inconnu
    "levels": {"type": "integer"},  # 0 = inconnu
    "rooms": {"type": "integer"},  # 0 = inconnu
    "standing": {"type": "string", "enum": ["standard", "confort", "premium", "inconnu"]},
    "slope": {"type": "string", "enum": ["plat", "faible", "forte", "inconnu"]},
    "access": {"type": "string", "enum": ["facile", "difficile", "inconnu"]},
    "observations": {"type": "array", "items": {"type": "string"}},
    "assumptions": {"type": "array", "items": {"type": "string"}},
    "to_verify": {"type": "array", "items": {"type": "string"}},
    "confidence": {"type": "string", "enum": ["faible", "moyenne", "bonne"]},
}


def _system() -> str:
    from app.modules.ai.service import SYSTEM_BASE

    return (
        SYSTEM_BASE
        + " Tu assistes un ingénieur pour une première estimation de projet de construction. À partir des photos "
        "(terrain, croquis, plan) et de la description, extrais les paramètres utiles au chiffrage : type d'ouvrage, "
        "surface habitable (m²), niveaux, pièces, standing, pente et accès du terrain, observations factuelles. "
        "N'annonce AUCUN prix. Mets 0 ou « inconnu » quand une valeur n'est pas déterminable. « assumptions » = "
        "hypothèses retenues ; « to_verify » = points qu'un ingénieur doit confirmer sur place (sol, mitoyenneté, "
        "réseaux, servitudes…). Réponds en français."
    )


def analyze(
    *, description: str, declared: dict[str, Any], images: list[tuple[str, bytes, str]], transcript: str | None
) -> tuple[dict[str, Any] | None, Any, str | None]:
    from app.modules.ai.service import _json
    from app.providers.ai import Attachment, strict_schema

    attachments = [Attachment(data=data, media_type=mime) for _, data, mime in images if mime in VISION_MIMES]
    prompt = json.dumps(
        {"description": description, "note_vocale": transcript, "declare_par_le_prospect": declared},
        ensure_ascii=False,
    )
    return _json(
        "instant_estimate",
        system=_system(),
        prompt="Demande d'estimation (JSON) :\n" + prompt[:8000],
        schema=strict_schema(ANALYSIS_FIELDS),
        effort="medium",
        attachments=attachments or None,
    )


def merge(declared: dict[str, Any], ai: dict[str, Any] | None) -> dict[str, Any]:
    """Ce que le prospect déclare prime ; l'IA ne fait que compléter les trous."""
    out = {k: v for k, v in declared.items() if v not in (None, "", 0)}
    if ai:
        for key in ("project_type", "surface_m2", "levels", "rooms", "standing"):
            value = ai.get(key)
            if key not in out and value not in (None, "", 0, "inconnu"):
                out[key] = value
    return out


def _adjusted(db: Session, base: dict[str, Any] | None, ai: dict[str, Any] | None) -> dict[str, Any] | None:
    """Majorations paramétrées (Setting « estimator ».adjustments, en %) : pente forte, accès difficile."""
    from app.modules.system.models import Setting

    if base is None:
        return None
    setting = db.get(Setting, "estimator")
    adjustments = ((setting.value or {}) if setting else {}).get("adjustments", {})
    pct = Decimal("0")
    applied = []
    if ai and ai.get("slope") == "forte" and adjustments.get("slope_strong"):
        pct += Decimal(str(adjustments["slope_strong"]))
        applied.append(f"Terrain en forte pente : +{adjustments['slope_strong']} %")
    if ai and ai.get("access") == "difficile" and adjustments.get("access_difficult"):
        pct += Decimal(str(adjustments["access_difficult"]))
        applied.append(f"Accès difficile : +{adjustments['access_difficult']} %")
    factor = 1 + pct / 100
    return {
        **base,
        "min": money(Decimal(str(base["min"])) * factor),
        "max": money(Decimal(str(base["max"])) * factor),
        "adjustments": applied,
    }


def submit(
    db: Session,
    *,
    contact: dict[str, Any],
    consents: dict[str, bool],
    declared: dict[str, Any],
    description: str,
    images: list[tuple[str, bytes, str]],
    audio: tuple[str, bytes, str] | None,
    transcript: str | None,
    ip: str | None,
    user_agent: str | None,
    referral_code: str | None = None,
) -> dict[str, Any]:
    from app.core.files import store_private, validate_upload
    from app.modules.ai.service import _record
    from app.modules.crm.models import ProjectBrief
    from app.modules.crm.service import create_lead, estimate_budget

    if len(images) > MAX_IMAGES:
        raise BusinessRuleError(f"{MAX_IMAGES} images au maximum", code="TOO_MANY_FILES")
    uploads = [validate_upload(n, d, category="image", max_mb=MAX_IMAGE_MB) for n, d, _ in images]
    audio_upload = validate_upload(audio[0], audio[1], category="audio", max_mb=MAX_AUDIO_MB) if audio else None
    if not transcript and audio_upload is not None:
        from app.providers.base import ProviderError
        from app.providers.stt import transcribe, transcription_available

        if transcription_available():
            try:
                transcript = transcribe(audio_upload.data, audio_upload.filename, audio_upload.mime).text
            except ProviderError as exc:
                log.warning("instant_estimate_stt_failed", extra={"error": str(exc)[:200]})
    ai, result, error = analyze(
        description=description,
        declared=declared,
        images=[(u.filename, u.data, u.mime) for u in uploads],
        transcript=transcript,
    )
    answers = merge(declared, ai)
    universe = declared.get("universe") or "HOME"
    estimate = _adjusted(db, estimate_budget(db, universe, answers), ai)
    analysis = {
        "ai_used": ai is not None,
        "ai": ai,
        "declared": declared,
        "transcript": transcript,
        "estimate": estimate,
        "validated": False,
    }
    lead = create_lead(
        db,
        data={
            **contact,
            "universe": universe,
            "project_type": answers.get("project_type"),
            "project_location": declared.get("location"),
            "message": (description or transcript or "Estimation instantanée par photo / croquis")[:4000],
            "referral_code": referral_code,
        },
        source="instant_estimate",
        form_key="instant_estimate",
        consents=consents,
        ip=ip,
        user_agent=user_agent,
        brief_answers={**answers, "instant_estimate": jsonable(analysis)},
    )
    brief = db.execute(select(ProjectBrief).where(ProjectBrief.lead_id == lead.id)).scalar_one()
    files = [
        store_private(db, u, purpose="lead_attachments", classification="internal").id
        for u in [*uploads, *([audio_upload] if audio_upload else [])]
    ]
    brief.file_ids = [str(f) for f in files]
    if estimate:
        brief.estimate_min, brief.estimate_max = Decimal(str(estimate["min"])), Decimal(str(estimate["max"]))
    _record(
        db,
        feature="instant_estimate",
        user_id=None,
        entity_type="lead",
        entity_id=lead.id,
        source=json.dumps({"declared": declared, "description": description}, ensure_ascii=False, default=str),
        result=result,
        output=ai,
        error=error,
        validation="pending",
    )
    return jsonable(
        {
            "reference": lead.number,
            "estimate": estimate,
            "parameters": {k: answers.get(k) for k in ("project_type", "surface_m2", "levels", "rooms", "standing")},
            "observations": (ai or {}).get("observations", []),
            "assumptions": (ai or {}).get("assumptions", []),
            "to_verify": (ai or {}).get("to_verify", []),
            "confidence": (ai or {}).get("confidence"),
            "ai_used": ai is not None,
            "message": "Estimation indicative, non contractuelle : un ingénieur la valide et vous recontacte."
            if estimate
            else "Merci ! Un ingénieur étudie vos éléments et vous envoie une première fourchette très vite.",
        }
    )


# ---------------------------------------------------------------------------- validation par un ingénieur
def _brief(db: Session, lead_id: Any) -> Any:
    from app.modules.crm.models import ProjectBrief

    brief = db.execute(select(ProjectBrief).where(ProjectBrief.lead_id == lead_id)).scalars().first()
    if brief is None or "instant_estimate" not in (brief.answers or {}):
        raise NotFound("Aucune estimation instantanée pour ce lead")
    return brief


def detail(db: Session, lead: Any, *, user_id: Any) -> dict[str, Any]:
    from app.core.downloads import signed_url
    from app.modules.system.models import StoredFile

    brief = _brief(db, lead.id)
    files = []
    for fid in brief.file_ids or []:
        stored = db.get(StoredFile, fid)
        if stored is not None and stored.deleted_at is None:
            files.append(
                {
                    "id": stored.id,
                    "name": stored.original_name,
                    "mime": stored.mime_type,
                    "url": signed_url(stored.id, user_id=user_id, ttl=1800),
                }
            )
    return jsonable(
        {
            "analysis": brief.answers.get("instant_estimate"),
            "estimate_min": brief.estimate_min,
            "estimate_max": brief.estimate_max,
            "files": files,
        }
    )


def validate(
    db: Session, lead: Any, *, user: Any, minimum: Decimal, maximum: Decimal, note: str | None, notify: bool
) -> dict[str, Any]:
    from app.core.pdf import fmt_money
    from app.modules.notifications.service import queue_external

    if minimum <= 0 or maximum < minimum:
        raise BusinessRuleError("Fourchette invalide", code="INVALID_RANGE")
    brief = _brief(db, lead.id)
    brief.estimate_min, brief.estimate_max = money(minimum), money(maximum)
    analysis = dict(brief.answers["instant_estimate"])
    analysis.update(
        {
            "validated": True,
            "validated_by": user.full_name,
            "validated_at": utcnow().isoformat(),
            "validated_range": {"min": str(money(minimum)), "max": str(money(maximum))},
            "engineer_note": note,
        }
    )
    brief.answers = {**brief.answers, "instant_estimate": analysis}
    audit.record(
        db,
        family="business",
        module="crm",
        action="ESTIMATE_VALIDATE",
        resource_type="lead",
        resource_id=lead.id,
        diff={"min": str(minimum), "max": str(maximum)},
    )
    if notify:
        context = {
            "first_name": lead.first_name,
            "range": f"{fmt_money(minimum)} – {fmt_money(maximum)}",
            "note": note or "",
            "engineer": user.full_name,
            "link": "/decrire-mon-projet",
            "title": "Votre estimation validée par notre ingénieur",
            "body": f"Fourchette validée : {fmt_money(minimum)} – {fmt_money(maximum)}. {note or ''}".strip(),
        }
        code = "lead.estimate_validated"
        if lead.email:
            queue_external(db, channel="email", recipient=lead.email, template_code=code, context=context)
        if lead.whatsapp and lead.whatsapp_consent:
            queue_external(db, channel="whatsapp", recipient=lead.whatsapp, template_code=code, context=context)
    return jsonable({"estimate_min": brief.estimate_min, "estimate_max": brief.estimate_max, "analysis": analysis})


__all__ = ["analyze", "detail", "merge", "submit", "validate"]
