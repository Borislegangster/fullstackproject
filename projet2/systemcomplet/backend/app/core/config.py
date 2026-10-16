"""Configuration centralisée (variables d'environnement / fichier .env).

Règles du cahier des charges appliquées ici :
- aucun secret par défaut en production (validation stricte au démarrage) ;
- HTTPS obligatoire pour les URL publiques de production ;
- aucun simulateur : environnements de test des prestataires (MTN MoMo « sandbox », Orange Money « dev ») et
  canaux « console » (e-mail) refusés en production.
"""

from __future__ import annotations

import base64
import secrets
from decimal import Decimal
from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

CsvList = Annotated[list[str], NoDecode]
Environment = Literal["development", "test", "staging", "production"]
KNOWN_PAYMENT_PROVIDERS = frozenset({"mtn_momo", "orange_money", "stripe", "flutterwave", "cinetpay"})

# Clé utilisée uniquement en développement/test ; refusée ailleurs.
_DEV_MASTER_KEY = base64.b64encode(b"globus-dev-master-key-32-bytes!!").decode()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ------------------------------------------------------------------ général
    ENV: Environment = "development"
    APP_NAME: str = "GLOBUS ENGINEERING API"
    APP_VERSION: str = "4.0.0"
    API_PREFIX: str = "/api/v1"
    PUBLIC_BASE_URL: str = "http://localhost:3000"  # URL du site web (vitrine/ERP/espace client)
    API_PUBLIC_URL: str = "http://localhost:8000"  # URL publique de l'API (liens e-mail, webhooks)
    TIMEZONE: str = "Africa/Douala"
    VAT_RATE: Decimal = Decimal("19.25")  # TVA Cameroun (taux normal, CGI)
    DEFAULT_CURRENCY: str = "XAF"
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = True

    # ------------------------------------------------------------------ base de données
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/globus"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_ECHO: bool = False
    REDIS_URL: str | None = None

    # ------------------------------------------------------------------ sécurité
    SECRET_KEY: str = ""  # signature JWT / liens signés
    MASTER_ENCRYPTION_KEY: str = ""  # base64 32 octets — AES-256-GCM (champs + coffre de secrets)
    MASTER_KEY_ID: str = "k1"
    PREVIOUS_ENCRYPTION_KEYS: str = ""  # "kid:base64,kid2:base64" pour la rotation
    ACCESS_TOKEN_TTL_MINUTES: int = 15
    REFRESH_TOKEN_TTL_DAYS: int = 14
    MFA_CHALLENGE_TTL_MINUTES: int = 5
    PASSWORD_MIN_LENGTH: int = 12
    COOKIE_SECURE: bool | None = None  # auto: True hors développement
    COOKIE_DOMAIN: str | None = None
    COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    CORS_ORIGINS: CsvList = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "tauri://localhost",
            "http://tauri.localhost",
        ]
    )
    TRUSTED_PROXIES: int = 1
    MFA_REQUIRED_ROLES: CsvList = Field(default_factory=lambda: ["ADMIN", "DIRECTION", "FINANCE"])
    MFA_ENFORCEMENT: Literal["off", "warn", "enforce"] = "warn"
    WEBAUTHN_RP_ID: str = "localhost"
    WEBAUTHN_RP_NAME: str = "GLOBUS ENGINEERING"
    BREAK_GLASS_TTL_MINUTES: int = 15

    # ------------------------------------------------------------------ limitation de débit
    RATE_LIMIT_DEFAULT: str = "600/minute"
    RATE_LIMIT_LOGIN: str = "10/minute"
    RATE_LIMIT_PUBLIC_FORMS: str = "20/hour"
    RATE_LIMIT_ANALYTICS: str = "300/minute"

    # ------------------------------------------------------------------ stockage
    PUBLIC_MEDIA_DIR: str = "./storage/public_media"
    PRIVATE_STORAGE_BACKEND: Literal["local", "s3"] = "local"
    PRIVATE_STORAGE_DIR: str = "./storage/private"
    BACKUP_DIR: str = "./storage/backups"
    BACKUP_RETENTION_DAYS: int = 30
    BACKUP_KEEP_MIN: int = 7
    PG_BIN_DIR: str | None = None  # répertoire de pg_dump / pg_restore (sinon PATH)
    S3_ENDPOINT_URL: str | None = None
    S3_REGION: str = "auto"
    S3_BUCKET: str | None = None
    S3_ACCESS_KEY_ID: str | None = None
    S3_SECRET_ACCESS_KEY: str | None = None
    MAX_UPLOAD_MB: int = 50
    MAX_BIM_UPLOAD_MB: int = 1024
    CLAMAV_HOST: str | None = None
    CLAMAV_PORT: int = 3310
    SIGNED_URL_TTL_SECONDS: int = 300

    # ------------------------------------------------------------------ e-mail
    EMAIL_PROVIDER: Literal["console", "smtp", "sendgrid", "mailgun", "ses"] = "console"
    EMAIL_FROM: str = "GLOBUS ENGINEERING <no-reply@globus-engineering.cm>"
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_STARTTLS: bool = True
    SENDGRID_API_KEY: str | None = None
    SENDGRID_WEBHOOK_PUBLIC_KEY: str | None = None
    MAILGUN_API_KEY: str | None = None
    MAILGUN_DOMAIN: str | None = None
    MAILGUN_WEBHOOK_SIGNING_KEY: str | None = None
    MAILGUN_BASE_URL: str = "https://api.eu.mailgun.net/v3"
    # Amazon SES (API v2) : identifiants fournis par le rôle IAM du serveur (aucun secret dans la configuration).
    SES_REGION: str | None = None
    SES_CONFIGURATION_SET: str | None = None

    # ------------------------------------------------------------------ WhatsApp / SMS
    WHATSAPP_PROVIDER: Literal["console", "meta"] = "console"
    META_WA_TOKEN: str | None = None
    META_WA_PHONE_NUMBER_ID: str | None = None
    META_WA_APP_SECRET: str | None = None
    META_WA_VERIFY_TOKEN: str | None = None
    META_WA_API_VERSION: str = "v21.0"
    META_WA_PO_TEMPLATE: str = "globus_bon_de_commande"
    # modèle approuvé : en-tête vidéo + {{1}} prénom, {{2}} projet, {{3}} semaine
    META_WA_TIMELAPSE_TEMPLATE: str = "globus_timelapse_hebdo"
    META_WA_TEMPLATE_LANG: str = "fr"
    SMS_PROVIDER: Literal["console", "twilio"] = "console"
    TWILIO_ACCOUNT_SID: str | None = None
    TWILIO_AUTH_TOKEN: str | None = None
    TWILIO_FROM: str | None = None

    # ------------------------------------------------------------------ notifications push
    VAPID_PUBLIC_KEY: str | None = None
    VAPID_PRIVATE_KEY: str | None = None
    VAPID_SUBJECT: str = "mailto:contact@globus-engineering.cm"
    FCM_SERVICE_ACCOUNT_JSON: str | None = None

    # ------------------------------------------------------------------ paiements (prestataires réels uniquement)
    # mtn_momo, orange_money, stripe, flutterwave, cinetpay — vide = aucun paiement en ligne proposé.
    PAYMENT_PROVIDERS: CsvList = Field(default_factory=list)
    # MTN MoMo Open API : base sandbox https://sandbox.momodeveloper.mtn.com ; production : URL communiquée par MTN
    # (https://proxy.momoapi.mtn.com ou https://momoapi.momo.africa) et environnement cible « mtncameroon ».
    MTN_MOMO_BASE_URL: str = "https://sandbox.momodeveloper.mtn.com"
    MTN_MOMO_TARGET_ENVIRONMENT: str = "sandbox"
    MTN_MOMO_CURRENCY: str | None = None  # imposé par MTN en bac à sable (EUR) ; sinon devise de la pièce (XAF)
    MTN_MOMO_COLLECTION_USER_ID: str | None = None  # API User (UUID) du produit Collections
    MTN_MOMO_COLLECTION_API_KEY: str | None = None
    MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY: str | None = None
    MTN_MOMO_DISBURSEMENT_USER_ID: str | None = None  # API User (UUID) du produit Disbursements
    MTN_MOMO_DISBURSEMENT_API_KEY: str | None = None
    MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY: str | None = None
    # Orange Money Web Payment : pays « dev » (bac à sable Orange, devise OUV) ou code pays de production (« cm »).
    ORANGE_OM_API_BASE: str = "https://api.orange.com"
    ORANGE_OM_OAUTH_PATH: str = "/oauth/v3/token"  # point de terminaison OAuth2 (pas un secret)
    ORANGE_OM_COUNTRY: str = "dev"
    ORANGE_OM_CURRENCY: str | None = None
    ORANGE_OM_AUTHORIZATION: str | None = None  # valeur « Authorization header » fournie par Orange (Basic …)
    ORANGE_OM_MERCHANT_KEY: str | None = None
    ORANGE_OM_MERCHANT_NAME: str = "GLOBUS ENGINEERING"
    STRIPE_SECRET_KEY: str | None = None
    STRIPE_WEBHOOK_SECRET: str | None = None
    FLW_SECRET_KEY: str | None = None
    FLW_WEBHOOK_HASH: str | None = None
    CINETPAY_API_KEY: str | None = None
    CINETPAY_SITE_ID: str | None = None
    CINETPAY_SECRET_KEY: str | None = None
    EUR_XAF_RATE: float = 655.957

    # ------------------------------------------------------------------ BIM (Autodesk Platform Services)
    APS_CLIENT_ID: str | None = None
    APS_CLIENT_SECRET: str | None = None
    APS_BUCKET_KEY: str | None = None
    APS_REGION: str = "US"

    # ------------------------------------------------------------------ IA (Claude via SDK officiel Anthropic)
    AI_PROVIDER: Literal["none", "anthropic"] = "none"
    ANTHROPIC_API_KEY: str | None = None
    ANTHROPIC_MODEL: str = "claude-opus-5-5"
    AI_TIMEOUT_SECONDS: float = 120.0
    # Transcription vocale : « device » = transcription faite sur l'appareil (Web Speech / mobile),
    # « http » = endpoint de transcription compatible Whisper (auto-hébergé ou service tiers).
    STT_PROVIDER: Literal["device", "http"] = "device"
    STT_HTTP_URL: str | None = None
    STT_HTTP_TOKEN: str | None = None
    STT_MODEL: str = "whisper-1"
    STT_LANGUAGE: str = "fr"

    # ------------------------------------------------------------------ météo (planning intelligent)
    WEATHER_PROVIDER: Literal["none", "open-meteo"] = "none"
    WEATHER_API_URL: str = "https://api.open-meteo.com/v1/forecast"

    # ------------------------------------------------------------------ cartes / analytics
    GOOGLE_MAPS_API_KEY: str | None = None
    GA4_PROPERTY_ID: str | None = None
    GA4_CREDENTIALS_JSON: str | None = None

    # ------------------------------------------------------------------ WebRTC
    STUN_URLS: CsvList = Field(default_factory=lambda: ["stun:stun.l.google.com:19302"])
    TURN_URLS: CsvList = Field(default_factory=list)
    TURN_SHARED_SECRET: str | None = None
    TURN_TTL_SECONDS: int = 3600

    # ------------------------------------------------------------------ ancrage (P2)
    ANCHORING_ENABLED: bool = False
    OTS_CALENDARS: CsvList = Field(
        default_factory=lambda: [
            "https://a.pool.opentimestamps.org",
            "https://b.pool.opentimestamps.org",
        ]
    )

    # ------------------------------------------------------------------ worker
    WORKER_INLINE: bool = True  # dispatcher outbox + planificateur dans le processus API (dev)
    OUTBOX_BATCH_SIZE: int = 50
    OUTBOX_MAX_ATTEMPTS: int = 8

    # ------------------------------------------------------------------ divers
    REVALIDATE_SECRET: str | None = None  # notification Next.js lors des publications CMS
    WEB_INTERNAL_URL: str | None = None  # ex. http://web:3000 en docker
    ANALYTICS_IP_SALT_ROTATION_HOURS: int = 24
    DEMO_SEED_ALLOWED: bool = True

    # ------------------------------------------------------------------ validations
    @field_validator(
        "CORS_ORIGINS",
        "PAYMENT_PROVIDERS",
        "STUN_URLS",
        "TURN_URLS",
        "MFA_REQUIRED_ROLES",
        "OTS_CALENDARS",
        mode="before",
    )
    @classmethod
    def _split_csv(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip().startswith("["):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @model_validator(mode="after")
    def _environment_rules(self) -> Settings:
        unknown = sorted(set(self.PAYMENT_PROVIDERS) - KNOWN_PAYMENT_PROVIDERS)
        if unknown:
            raise ValueError(
                f"PAYMENT_PROVIDERS : prestataire(s) inconnu(s) {', '.join(unknown)} "
                f"(disponibles : {', '.join(sorted(KNOWN_PAYMENT_PROVIDERS))})"
            )
        if self.COOKIE_SECURE is None:
            self.COOKIE_SECURE = self.ENV not in ("development", "test")
        if self.ENV in ("development", "test"):
            # Clés éphémères en dev/test uniquement (jamais en production).
            if not self.SECRET_KEY:
                self.SECRET_KEY = secrets.token_urlsafe(64)
            if not self.MASTER_ENCRYPTION_KEY:
                self.MASTER_ENCRYPTION_KEY = _DEV_MASTER_KEY
            return self
        errors: list[str] = []
        if len(self.SECRET_KEY) < 48:
            errors.append("SECRET_KEY absent ou trop court (>= 48 caractères)")
        if self.MASTER_ENCRYPTION_KEY == _DEV_MASTER_KEY:
            errors.append("MASTER_ENCRYPTION_KEY de développement interdite hors dev/test")
        try:
            if len(base64.b64decode(self.MASTER_ENCRYPTION_KEY)) != 32:
                errors.append("MASTER_ENCRYPTION_KEY doit encoder 32 octets en base64")
        except Exception:  # noqa: BLE001
            errors.append("MASTER_ENCRYPTION_KEY invalide (base64 attendu)")
        if self.ENV == "production":
            if not self.PUBLIC_BASE_URL.startswith("https://"):
                errors.append("PUBLIC_BASE_URL doit être en HTTPS en production")
            if not self.API_PUBLIC_URL.startswith("https://"):
                errors.append("API_PUBLIC_URL doit être en HTTPS en production")
            if "mtn_momo" in self.PAYMENT_PROVIDERS and (
                self.MTN_MOMO_TARGET_ENVIRONMENT == "sandbox" or "sandbox" in self.MTN_MOMO_BASE_URL
            ):
                errors.append("MTN MoMo : environnement « sandbox » interdit en production (mtncameroon attendu)")
            if "orange_money" in self.PAYMENT_PROVIDERS and self.ORANGE_OM_COUNTRY == "dev":
                errors.append("Orange Money : environnement « dev » interdit en production (ORANGE_OM_COUNTRY=cm)")
            if self.EMAIL_PROVIDER == "console":
                errors.append("EMAIL_PROVIDER=console interdit en production (aucun e-mail ne partirait)")
            if self.EMAIL_PROVIDER == "ses" and not self.SES_REGION:
                errors.append("SES_REGION requis avec EMAIL_PROVIDER=ses (ex. eu-west-3)")
            if not self.COOKIE_SECURE:
                errors.append("COOKIE_SECURE doit être actif en production")
            if self.DEMO_SEED_ALLOWED:
                self.DEMO_SEED_ALLOWED = False
        if errors:
            raise ValueError("Configuration invalide : " + " ; ".join(errors))
        return self

    # ------------------------------------------------------------------ helpers
    @property
    def is_production(self) -> bool:
        return self.ENV == "production"

    @property
    def is_dev(self) -> bool:
        return self.ENV in ("development", "test")

    @property
    def ws_public_url(self) -> str:
        base = self.API_PUBLIC_URL.rstrip("/")
        if base.startswith("https://"):
            return "wss://" + base[len("https://") :] + "/ws"
        if base.startswith("http://"):
            return "ws://" + base[len("http://") :] + "/ws"
        return base + "/ws"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
