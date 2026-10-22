"""Coffre de secrets applicatif.

- Écriture / rotation via l'ERP (chiffrement AES-256-GCM, empreinte non réversible).
- Lecture en clair impossible via l'API (§22.1 « Attention — secrets », V4-SEC-02) : seuls les
  providers internes appellent `get_secret()`.
- Repli sur les variables d'environnement si le secret n'est pas stocké en base.
"""

from __future__ import annotations

import threading
import time
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decrypt_str, encrypt_str, fingerprint
from app.core.utils import utcnow

# Secrets gérables depuis l'ERP (nom → description).
MANAGED_SECRETS: dict[str, str] = {
    "SMTP_PASSWORD": "Mot de passe SMTP",
    "SENDGRID_API_KEY": "Clé API SendGrid",
    "MAILGUN_API_KEY": "Clé API Mailgun",
    "MAILGUN_WEBHOOK_SIGNING_KEY": "Clé de signature des webhooks Mailgun",
    "META_WA_TOKEN": "Jeton WhatsApp Business Platform",
    "META_WA_APP_SECRET": "Secret d'application Meta (signature webhooks)",
    "META_WA_VERIFY_TOKEN": "Jeton de vérification du webhook WhatsApp",
    "TWILIO_AUTH_TOKEN": "Jeton Twilio (SMS)",
    "VAPID_PRIVATE_KEY": "Clé privée VAPID (Web Push)",
    "FCM_SERVICE_ACCOUNT_JSON": "Compte de service Firebase (push mobile)",
    "STRIPE_SECRET_KEY": "Clé secrète Stripe",
    "STRIPE_WEBHOOK_SECRET": "Secret de signature des webhooks Stripe",
    "FLW_SECRET_KEY": "Clé secrète Flutterwave",
    "FLW_WEBHOOK_HASH": "Hash de vérification des webhooks Flutterwave",
    "CINETPAY_API_KEY": "Clé API CinetPay",
    "CINETPAY_SECRET_KEY": "Clé secrète CinetPay (HMAC webhooks)",
    "MTN_MOMO_COLLECTION_USER_ID": "MTN MoMo — identifiant API User Collections (UUID)",
    "MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY": "MTN MoMo — clé d'abonnement Collections (Ocp-Apim-Subscription-Key)",
    "MTN_MOMO_COLLECTION_API_KEY": "MTN MoMo — clé API (credential) de l'API User Collections",
    "MTN_MOMO_DISBURSEMENT_USER_ID": "MTN MoMo — identifiant API User Disbursements (UUID)",
    "MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY": "MTN MoMo — clé d'abonnement Disbursements",
    "MTN_MOMO_DISBURSEMENT_API_KEY": "MTN MoMo — clé API (credential) de l'API User Disbursements",
    "ORANGE_OM_AUTHORIZATION": "Orange Money — en-tête d'autorisation OAuth (Basic …)",
    "ORANGE_OM_MERCHANT_KEY": "Orange Money — clé marchand Web Payment",
    "APS_CLIENT_SECRET": "Secret client Autodesk Platform Services",
    "ANTHROPIC_API_KEY": "Clé API Claude (Anthropic)",
    "STT_HTTP_TOKEN": "Jeton du service de transcription",
    "GOOGLE_MAPS_API_KEY": "Clé Google Maps",
    "GA4_CREDENTIALS_JSON": "Compte de service GA4 Data API",
    "TURN_SHARED_SECRET": "Secret partagé du serveur TURN",
    "S3_SECRET_ACCESS_KEY": "Clé secrète du stockage S3/R2",
}

_cache: dict[str, tuple[float, str | None]] = {}
_lock = threading.Lock()
_TTL = 60.0


def _from_db(name: str) -> str | None:
    from app.core.database import SessionLocal
    from app.modules.system.models import SecretEntry

    try:
        db = SessionLocal()
        try:
            entry = db.execute(select(SecretEntry).where(SecretEntry.name == name)).scalar_one_or_none()
            return decrypt_str(entry.ciphertext) if entry else None
        finally:
            db.close()
    except Exception:  # noqa: BLE001 — base indisponible (démarrage, scripts) : repli env
        return None


def get_secret(name: str) -> str | None:
    """Valeur d'un secret (base chiffrée puis variable d'environnement). Usage interne uniquement."""
    now = time.monotonic()
    with _lock:
        cached = _cache.get(name)
        if cached and now - cached[0] < _TTL:
            return cached[1]
    value = _from_db(name)
    if value is None:
        env_value = getattr(settings, name, None)
        value = env_value if isinstance(env_value, str) and env_value else None
    with _lock:
        _cache[name] = (now, value)
    return value


def invalidate(name: str | None = None) -> None:
    with _lock:
        if name:
            _cache.pop(name, None)
        else:
            _cache.clear()


def set_secret(db: Session, name: str, value: str, *, user_id: uuid.UUID | None, description: str | None = None) -> Any:
    from app.modules.system.models import SecretEntry

    entry = db.execute(select(SecretEntry).where(SecretEntry.name == name)).scalar_one_or_none()
    if entry is None:
        entry = SecretEntry(
            name=name,
            ciphertext=encrypt_str(value),
            fingerprint=fingerprint(value),
            description=description or MANAGED_SECRETS.get(name),
            created_by_id=user_id,
        )
        db.add(entry)
    else:
        entry.ciphertext = encrypt_str(value)
        entry.fingerprint = fingerprint(value)
        entry.version = (entry.version or 1) + 1
        entry.rotated_at = utcnow()
        entry.rotated_by_id = user_id
    db.flush()
    invalidate(name)
    return entry


def _internal_url(url: str | None) -> bool:
    """Service joint sur le réseau interne du serveur (ex. http://stt:9000) : aucun jeton exigé."""
    if not url:
        return False
    host = url.split("://", 1)[-1].split("/", 1)[0].split(":", 1)[0]
    return "." not in host or host in ("localhost", "127.0.0.1")


def secret_need(name: str) -> tuple[str, str, str]:
    """(besoin, explication, groupe) d'un secret selon les services activés : required / optional / unused."""
    providers = set(settings.PAYMENT_PROVIDERS or [])

    def by_provider(active: bool, service: str, group: str, *, optional: bool = False) -> tuple[str, str, str]:
        if not active:
            return "unused", f"Inutile tant que {service} n'est pas activé.", group
        if optional:
            return "optional", f"Facultatif pour {service}.", group
        return "required", f"Requis : {service} est activé.", group

    email = settings.EMAIL_PROVIDER
    rules: dict[str, tuple[str, str, str]] = {
        "SMTP_PASSWORD": by_provider(email == "smtp", "l'envoi des e-mails par SMTP", "email"),
        "SENDGRID_API_KEY": by_provider(email == "sendgrid", "SendGrid (e-mails envoyés par SMTP)", "email"),
        "MAILGUN_API_KEY": by_provider(email == "mailgun", "Mailgun", "email"),
        "MAILGUN_WEBHOOK_SIGNING_KEY": by_provider(email == "mailgun", "Mailgun", "email", optional=True),
        "META_WA_TOKEN": by_provider(settings.WHATSAPP_PROVIDER == "meta", "WhatsApp Business", "whatsapp"),
        "META_WA_APP_SECRET": by_provider(settings.WHATSAPP_PROVIDER == "meta", "WhatsApp Business", "whatsapp"),
        "META_WA_VERIFY_TOKEN": by_provider(settings.WHATSAPP_PROVIDER == "meta", "WhatsApp Business", "whatsapp"),
        "TWILIO_AUTH_TOKEN": by_provider(settings.SMS_PROVIDER == "twilio", "l'envoi de SMS (Twilio)", "sms"),
        "VAPID_PRIVATE_KEY": by_provider(bool(settings.VAPID_PUBLIC_KEY), "les notifications push web", "push"),
        "FCM_SERVICE_ACCOUNT_JSON": ("optional", "Facultatif : notifications push des applications mobiles.", "push"),
        "STRIPE_SECRET_KEY": by_provider("stripe" in providers, "le paiement par carte (Stripe)", "payments"),
        "STRIPE_WEBHOOK_SECRET": by_provider("stripe" in providers, "le paiement par carte (Stripe)", "payments"),
        "FLW_SECRET_KEY": by_provider("flutterwave" in providers, "Flutterwave", "payments"),
        "FLW_WEBHOOK_HASH": by_provider("flutterwave" in providers, "Flutterwave", "payments"),
        "CINETPAY_API_KEY": by_provider("cinetpay" in providers, "CinetPay", "payments"),
        "CINETPAY_SECRET_KEY": by_provider("cinetpay" in providers, "CinetPay", "payments"),
        "MTN_MOMO_COLLECTION_USER_ID": by_provider("mtn_momo" in providers, "MTN Mobile Money", "payments"),
        "MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY": by_provider("mtn_momo" in providers, "MTN Mobile Money", "payments"),
        "MTN_MOMO_COLLECTION_API_KEY": by_provider("mtn_momo" in providers, "MTN Mobile Money", "payments"),
        "MTN_MOMO_DISBURSEMENT_USER_ID": by_provider(
            "mtn_momo" in providers,
            "les paiements sortants MTN (fournisseurs, sous-traitants)",
            "payments",
            optional=True,
        ),
        "MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY": by_provider(
            "mtn_momo" in providers,
            "les paiements sortants MTN (fournisseurs, sous-traitants)",
            "payments",
            optional=True,
        ),
        "MTN_MOMO_DISBURSEMENT_API_KEY": by_provider(
            "mtn_momo" in providers,
            "les paiements sortants MTN (fournisseurs, sous-traitants)",
            "payments",
            optional=True,
        ),
        "ORANGE_OM_AUTHORIZATION": by_provider("orange_money" in providers, "Orange Money", "payments"),
        "ORANGE_OM_MERCHANT_KEY": by_provider("orange_money" in providers, "Orange Money", "payments"),
        "APS_CLIENT_SECRET": by_provider(bool(settings.APS_CLIENT_ID), "Autodesk APS (BIM)", "bim"),
        "ANTHROPIC_API_KEY": by_provider(settings.AI_PROVIDER == "anthropic", "les assistants IA (Claude)", "ai"),
        "GOOGLE_MAPS_API_KEY": ("optional", "Facultatif : cartes Google (sinon cartes libres OpenStreetMap).", "maps"),
        "GA4_CREDENTIALS_JSON": by_provider(
            bool(settings.GA4_PROPERTY_ID), "la lecture des statistiques Google Analytics", "analytics", optional=True
        ),
        "TURN_SHARED_SECRET": by_provider(bool(settings.TURN_URLS), "le relais des appels (TURN)", "calls"),
        "S3_SECRET_ACCESS_KEY": by_provider(
            settings.PRIVATE_STORAGE_BACKEND == "s3" or bool(settings.S3_BUCKET), "le stockage S3", "storage"
        ),
    }
    if name == "STT_HTTP_TOKEN":
        if settings.STT_PROVIDER != "http":
            return "unused", "Inutile : la transcription est faite sur l'appareil.", "stt"
        if _internal_url(settings.STT_HTTP_URL):
            return (
                "unused",
                "Inutile : la transcription tourne sur votre serveur (service interne, sans jeton). "
                "À renseigner seulement pour un service de transcription externe qui l'exige.",
                "stt",
            )
        return "optional", "À renseigner si le service de transcription externe exige un jeton.", "stt"
    if name.startswith("WEBHOOK_SECRET_"):
        return "required", "Signature d'un webhook sortant.", "webhooks"
    return rules.get(name, ("optional", "", "other"))


def secret_status(db: Session) -> list[dict[str, Any]]:
    """État des secrets sans jamais révéler leur valeur."""
    from app.modules.system.models import SecretEntry

    stored = {e.name: e for e in db.execute(select(SecretEntry)).scalars()}
    out = []
    for name, label in sorted(MANAGED_SECRETS.items()):
        entry = stored.get(name)
        env_set = bool(getattr(settings, name, None))
        need, reason, group = secret_need(name)
        out.append(
            {
                "name": name,
                "label": label,
                "need": need,
                "need_reason": reason,
                "group": group,
                "configured": entry is not None or env_set,
                "source": "vault" if entry else ("environment" if env_set else None),
                "fingerprint": entry.fingerprint if entry else None,
                "version": entry.version if entry else None,
                "rotated_at": entry.rotated_at if entry else None,
                "created_at": entry.created_at if entry else None,
            }
        )
    return out
