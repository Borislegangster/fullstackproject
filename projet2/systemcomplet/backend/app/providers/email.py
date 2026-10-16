"""EmailProvider : console (dev), SMTP, SendGrid, Mailgun, Amazon SES + vérification des webhooks d'événements."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import smtplib
import ssl
import uuid
from dataclasses import dataclass, field
from email.message import EmailMessage as MimeMessage
from email.utils import formataddr, make_msgid, parseaddr
from pathlib import Path
from typing import Any, Protocol

import httpx

from app.core.config import settings
from app.core.secrets import get_secret
from app.core.utils import utcnow
from app.providers.base import ProviderError, ProviderNotConfigured, SendResult

log = logging.getLogger("globus.email")


@dataclass
class EmailMessage:
    to: list[str]
    subject: str
    html: str
    text: str | None = None
    reply_to: str | None = None
    headers: dict[str, str] = field(default_factory=dict)
    attachments: list[tuple[str, bytes, str]] = field(default_factory=list)  # (nom, contenu, mime)
    tags: list[str] = field(default_factory=list)
    metadata: dict[str, str] = field(default_factory=dict)
    from_address: str | None = None


class EmailProvider(Protocol):
    name: str

    def send(self, message: EmailMessage) -> SendResult: ...


# Boîte d'envoi mémoire du provider console (tests + page « boîte de réception dev »).
DEV_OUTBOX: list[dict[str, Any]] = []


class ConsoleEmailProvider:
    """Développement : n'envoie rien, journalise et conserve les e-mails (fichiers .eml)."""

    name = "console"

    def send(self, message: EmailMessage) -> SendResult:
        msg_id = uuid.uuid4().hex
        record = {
            "id": msg_id,
            "to": message.to,
            "subject": message.subject,
            "html": message.html,
            "text": message.text,
            "metadata": message.metadata,
            "at": utcnow().isoformat(),
            "attachments": [name for name, _, _ in message.attachments],
        }
        DEV_OUTBOX.append(record)
        del DEV_OUTBOX[:-200]
        try:
            folder = Path(settings.PRIVATE_STORAGE_DIR) / "dev_mailbox"
            folder.mkdir(parents=True, exist_ok=True)
            (folder / f"{utcnow():%Y%m%d-%H%M%S}-{msg_id[:8]}.json").write_text(
                json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        except OSError:
            pass
        log.info("email_console", extra={"to": message.to, "subject": message.subject})
        return SendResult(provider=self.name, message_id=msg_id, status="sent")


def _mime(message: EmailMessage) -> MimeMessage:
    mime = MimeMessage()
    sender = message.from_address or settings.EMAIL_FROM
    name, addr = parseaddr(sender)
    mime["From"] = formataddr((name, addr))
    mime["To"] = ", ".join(message.to)
    mime["Subject"] = message.subject
    mime["Message-ID"] = make_msgid(domain=addr.split("@")[-1] if "@" in addr else None)
    if message.reply_to:
        mime["Reply-To"] = message.reply_to
    for key, value in message.headers.items():
        mime[key] = value
    mime.set_content(message.text or "Ce message est au format HTML.")
    mime.add_alternative(message.html, subtype="html")
    for filename, content, mimetype in message.attachments:
        maintype, _, subtype = mimetype.partition("/")
        mime.add_attachment(
            content, maintype=maintype or "application", subtype=subtype or "octet-stream", filename=filename
        )
    return mime


class SmtpEmailProvider:
    name = "smtp"

    def send(self, message: EmailMessage) -> SendResult:
        if not settings.SMTP_HOST:
            raise ProviderNotConfigured(self.name, "SMTP_HOST")
        mime = _mime(message)
        try:
            context = ssl.create_default_context()
            if settings.SMTP_PORT == 465:
                server: smtplib.SMTP = smtplib.SMTP_SSL(
                    settings.SMTP_HOST, settings.SMTP_PORT, context=context, timeout=30
                )
            else:
                server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30)
                if settings.SMTP_STARTTLS:
                    server.starttls(context=context)
            with server:
                password = get_secret("SMTP_PASSWORD")
                if settings.SMTP_USER and password:
                    server.login(settings.SMTP_USER, password)
                server.send_message(mime)
        except (smtplib.SMTPException, OSError) as exc:
            raise ProviderError(f"SMTP : {exc}", provider=self.name) from exc
        return SendResult(provider=self.name, message_id=str(mime["Message-ID"]), status="sent")


class SendGridEmailProvider:
    name = "sendgrid"

    def send(self, message: EmailMessage) -> SendResult:
        key = get_secret("SENDGRID_API_KEY")
        if not key:
            raise ProviderNotConfigured(self.name, "SENDGRID_API_KEY")
        name, addr = parseaddr(message.from_address or settings.EMAIL_FROM)
        payload: dict[str, Any] = {
            "personalizations": [{"to": [{"email": t} for t in message.to], "custom_args": message.metadata or None}],
            "from": {"email": addr, "name": name or None},
            "subject": message.subject,
            "content": ([{"type": "text/plain", "value": message.text}] if message.text else [])
            + [{"type": "text/html", "value": message.html}],
            "categories": message.tags[:10] or None,
            "headers": message.headers or None,
        }
        if message.reply_to:
            payload["reply_to"] = {"email": message.reply_to}
        if message.attachments:
            payload["attachments"] = [
                {"content": base64.b64encode(c).decode(), "filename": n, "type": m} for n, c, m in message.attachments
            ]
        payload = json.loads(json.dumps(payload, default=str))
        try:
            resp = httpx.post(
                "https://api.sendgrid.com/v3/mail/send",
                json=payload,
                timeout=30,
                headers={"Authorization": f"Bearer {key}"},
            )
        except httpx.HTTPError as exc:
            raise ProviderError(f"SendGrid : {exc}", provider=self.name) from exc
        if resp.status_code >= 300:
            raise ProviderError(
                f"SendGrid {resp.status_code}",
                provider=self.name,
                retryable=resp.status_code >= 500,
                details=resp.text[:500],
            )
        return SendResult(provider=self.name, message_id=resp.headers.get("X-Message-Id"), status="sent")


class MailgunEmailProvider:
    name = "mailgun"

    def send(self, message: EmailMessage) -> SendResult:
        key = get_secret("MAILGUN_API_KEY")
        if not key or not settings.MAILGUN_DOMAIN:
            raise ProviderNotConfigured(self.name, "MAILGUN_API_KEY/MAILGUN_DOMAIN")
        data: dict[str, Any] = {
            "from": message.from_address or settings.EMAIL_FROM,
            "to": message.to,
            "subject": message.subject,
            "html": message.html,
        }
        if message.text:
            data["text"] = message.text
        if message.reply_to:
            data["h:Reply-To"] = message.reply_to
        for k, v in message.metadata.items():
            data[f"v:{k}"] = v
        for tag in message.tags[:3]:
            data.setdefault("o:tag", []).append(tag)
        files = [("attachment", (n, c, m)) for n, c, m in message.attachments]
        try:
            resp = httpx.post(
                f"{settings.MAILGUN_BASE_URL}/{settings.MAILGUN_DOMAIN}/messages",
                auth=("api", key),
                data=data,
                files=files or None,
                timeout=30,
            )
        except httpx.HTTPError as exc:
            raise ProviderError(f"Mailgun : {exc}", provider=self.name) from exc
        if resp.status_code >= 300:
            raise ProviderError(
                f"Mailgun {resp.status_code}",
                provider=self.name,
                retryable=resp.status_code >= 500,
                details=resp.text[:500],
            )
        return SendResult(provider=self.name, message_id=resp.json().get("id"), status="sent")


class SesEmailProvider:
    """Amazon SES (API v2, message MIME brut : pièces jointes et en-têtes conservés). Les identifiants viennent du
    rôle IAM du serveur (profil d'instance EC2, IMDSv2) : aucun mot de passe à stocker ni à faire tourner."""

    name = "ses"

    def __init__(self, client: Any | None = None) -> None:
        self._client = client

    def _ses(self) -> Any:
        if self._client is None:
            if not settings.SES_REGION:
                raise ProviderNotConfigured(self.name, "SES_REGION")
            import boto3

            self._client = boto3.client("sesv2", region_name=settings.SES_REGION)
        return self._client

    def send(self, message: EmailMessage) -> SendResult:
        from botocore.exceptions import BotoCoreError, ClientError

        mime = _mime(message)
        params: dict[str, Any] = {
            "FromEmailAddress": str(mime["From"]),
            "Destination": {"ToAddresses": list(message.to)},
            "Content": {"Raw": {"Data": mime.as_bytes()}},
        }
        if settings.SES_CONFIGURATION_SET:
            params["ConfigurationSetName"] = settings.SES_CONFIGURATION_SET
        try:
            resp = self._ses().send_email(**params)
        except ClientError as exc:
            error = exc.response.get("Error", {})
            status = int(exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode") or 0)
            raise ProviderError(
                f"SES : {error.get('Code', 'Error')}",
                provider=self.name,
                retryable=status >= 500 or error.get("Code") in ("TooManyRequestsException", "LimitExceededException"),
                details=str(error.get("Message", ""))[:500],
            ) from exc
        except BotoCoreError as exc:
            raise ProviderError(f"SES : {exc}", provider=self.name) from exc
        return SendResult(provider=self.name, message_id=resp.get("MessageId"), status="sent")


def get_email_provider() -> EmailProvider:
    return {
        "smtp": SmtpEmailProvider,
        "sendgrid": SendGridEmailProvider,
        "mailgun": MailgunEmailProvider,
        "ses": SesEmailProvider,
    }.get(settings.EMAIL_PROVIDER, ConsoleEmailProvider)()


# ---------------------------------------------------------------------------- webhooks d'événements
def verify_mailgun_signature(timestamp: str, token: str, signature: str) -> bool:
    key = get_secret("MAILGUN_WEBHOOK_SIGNING_KEY")
    if not key:
        return False
    digest = hmac.new(key.encode(), f"{timestamp}{token}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


def verify_sendgrid_signature(payload: bytes, signature_b64: str, timestamp: str) -> bool:
    """Signature ECDSA (P-256/SHA-256) du « Signed Event Webhook » SendGrid."""
    public_key_b64 = settings.SENDGRID_WEBHOOK_PUBLIC_KEY
    if not public_key_b64:
        return False
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import ec

        key = serialization.load_der_public_key(base64.b64decode(public_key_b64))
        assert isinstance(key, ec.EllipticCurvePublicKey)
        key.verify(base64.b64decode(signature_b64), timestamp.encode() + payload, ec.ECDSA(hashes.SHA256()))
        return True
    except Exception:  # noqa: BLE001
        return False
