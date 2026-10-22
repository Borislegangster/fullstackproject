"""Activation des prestataires depuis l'ERP (Paramètres › Intégrations), sans modifier le fichier du serveur.

Seuls des réglages NON secrets sont concernés (choix du prestataire, identifiants publics, environnement) ; les clés
restent dans le coffre chiffré (`app.core.secrets`). Les valeurs enregistrées en base priment sur les variables
d'environnement ; chaque processus (API, worker) les relit au plus toutes les 15 secondes.
"""

from __future__ import annotations

import threading
import time
from typing import Any

from app.core.config import KNOWN_PAYMENT_PROVIDERS, Settings, settings

SETTING_KEY = "integrations.config"
_TTL = 15.0

# Réglage → (groupe, libellé, choix éventuels [(valeur, libellé)], aide)
OVERRIDABLE: dict[str, dict[str, Any]] = {
    "WHATSAPP_PROVIDER": {
        "group": "whatsapp",
        "label": "Envoi des messages WhatsApp",
        "choices": [("console", "Désactivé"), ("meta", "WhatsApp Business (Meta)")],
    },
    "META_WA_PHONE_NUMBER_ID": {
        "group": "whatsapp",
        "label": "Identifiant du numéro (Phone number ID)",
        "help": "Meta for Developers › votre application › WhatsApp › Configuration de l'API.",
    },
    "META_WA_PO_TEMPLATE": {
        "group": "whatsapp",
        "label": "Modèle approuvé — bon de commande",
        "help": "Nom exact du modèle de message approuvé par Meta.",
    },
    "META_WA_TIMELAPSE_TEMPLATE": {"group": "whatsapp", "label": "Modèle approuvé — timelapse hebdomadaire"},
    "META_WA_TEMPLATE_LANG": {"group": "whatsapp", "label": "Langue des modèles", "help": "Code de langue Meta (fr)."},
    "SMS_PROVIDER": {
        "group": "sms",
        "label": "Envoi des SMS",
        "choices": [("console", "Désactivé"), ("twilio", "Twilio")],
    },
    "TWILIO_ACCOUNT_SID": {"group": "sms", "label": "Identifiant du compte Twilio (Account SID)"},
    "TWILIO_FROM": {
        "group": "sms",
        "label": "Expéditeur des SMS",
        "help": "Numéro Twilio au format international (+1…) ou nom d'expéditeur autorisé.",
    },
    "PAYMENT_PROVIDERS": {
        "group": "payments",
        "label": "Prestataires de paiement activés",
        "choices": [
            ("mtn_momo", "MTN Mobile Money"),
            ("orange_money", "Orange Money"),
            ("stripe", "Carte bancaire (Stripe)"),
            ("flutterwave", "Flutterwave"),
            ("cinetpay", "CinetPay"),
        ],
        "multiple": True,
    },
    "MTN_MOMO_BASE_URL": {
        "group": "payments",
        "label": "MTN MoMo — adresse de l'API",
        "help": "Communiquée par MTN à la mise en production (ex. https://proxy.momoapi.mtn.com).",
    },
    "MTN_MOMO_TARGET_ENVIRONMENT": {
        "group": "payments",
        "label": "MTN MoMo — environnement",
        "help": "« mtncameroon » en production (« sandbox » refusé en production).",
    },
    "MTN_MOMO_CURRENCY": {"group": "payments", "label": "MTN MoMo — devise imposée (vide = devise de la pièce)"},
    "ORANGE_OM_API_BASE": {"group": "payments", "label": "Orange Money — adresse de l'API"},
    "ORANGE_OM_COUNTRY": {
        "group": "payments",
        "label": "Orange Money — pays",
        "help": "« cm » en production (« dev » = bac à sable, refusé en production).",
    },
    "ORANGE_OM_MERCHANT_NAME": {"group": "payments", "label": "Orange Money — nom du marchand affiché"},
    "CINETPAY_SITE_ID": {"group": "payments", "label": "CinetPay — identifiant du site (Site ID)"},
    "AI_PROVIDER": {
        "group": "ai",
        "label": "Assistants IA",
        "choices": [("none", "Désactivés (règles automatiques)"), ("anthropic", "Claude (Anthropic)")],
    },
    "ANTHROPIC_MODEL": {
        "group": "ai",
        "label": "Modèle Claude",
        "help": "Laisser la valeur proposée sauf avis contraire.",
    },
}

_lock = threading.Lock()
_loaded_at = 0.0
_baseline: dict[str, Any] = {}


def _coerce(name: str, value: Any) -> Any:
    if name == "PAYMENT_PROVIDERS":
        if isinstance(value, str):
            value = [v.strip() for v in value.split(",") if v.strip()]
        return [str(v) for v in (value or [])]
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _load() -> dict[str, Any] | None:
    from app.core.database import SessionLocal
    from app.modules.system.models import Setting

    try:
        db = SessionLocal()
        try:
            row = db.get(Setting, SETTING_KEY)
            return dict(row.value or {}) if row else {}
        finally:
            db.close()
    except Exception:  # noqa: BLE001 — base indisponible (démarrage, scripts) : configuration du serveur
        return None


def apply(overrides: dict[str, Any]) -> None:
    """Applique les réglages enregistrés ; une clé retirée revient à la valeur du serveur."""
    with _lock:
        for name in OVERRIDABLE:
            if name not in _baseline:
                _baseline[name] = getattr(settings, name)
            if name in overrides and overrides[name] is not None:
                setattr(settings, name, _coerce(name, overrides[name]))
            elif getattr(settings, name) != _baseline[name]:
                setattr(settings, name, _baseline[name])


def refresh(force: bool = False) -> None:
    """Relit les réglages en base (au plus toutes les 15 s, ou immédiatement après un enregistrement)."""
    global _loaded_at
    now = time.monotonic()
    if not force and now - _loaded_at < _TTL:
        return
    _loaded_at = now
    overrides = _load()
    if overrides is not None:
        apply(overrides)


def server_value(name: str) -> Any:
    """Valeur définie par le fichier de configuration du serveur (avant tout réglage ERP)."""
    return _baseline.get(name, getattr(settings, name))


def validate(overrides: dict[str, Any]) -> list[str]:
    """Contrôle d'une configuration candidate avec les règles du serveur (environnements de test refusés…)."""
    errors: list[str] = []
    for name, value in overrides.items():
        meta = OVERRIDABLE.get(name)
        if meta is None:
            errors.append(f"Réglage non modifiable depuis l'ERP : {name}")
            continue
        allowed = {c[0] for c in meta.get("choices", [])}
        if allowed:
            values = value if isinstance(value, list) else [value]
            unknown = [v for v in values if v not in allowed and v is not None]
            if unknown:
                errors.append(f"{meta['label']} : valeur inconnue ({', '.join(map(str, unknown))})")
    providers = overrides.get("PAYMENT_PROVIDERS", settings.PAYMENT_PROVIDERS) or []
    unknown = sorted(set(providers) - KNOWN_PAYMENT_PROVIDERS)
    if unknown:
        errors.append(f"Prestataire de paiement inconnu : {', '.join(unknown)}")
    if errors:
        return errors
    # Règles complètes du serveur (production : MTN « sandbox » et Orange « dev » refusés…).
    candidate = {k: v for k, v in settings.model_dump().items() if k in Settings.model_fields}
    candidate.update({k: _coerce(k, v) for k, v in overrides.items() if v is not None})
    for name in OVERRIDABLE:
        if name not in overrides and name in _baseline:
            candidate[name] = _baseline[name]
    try:
        Settings.model_validate(candidate)
    except ValueError as exc:
        text = str(exc)
        marker = "Configuration invalide : "
        errors.append(text.split(marker, 1)[1].split("[type=")[0].strip() if marker in text else text[:300])
    return errors


def reset() -> None:
    """Retour à la configuration du serveur (tests) ; prochaine requête : relecture en base."""
    global _loaded_at
    apply({})
    _loaded_at = 0.0
