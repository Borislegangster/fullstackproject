"""Email provider abstraction.

Encapsulates email sending (SMTP, SendGrid, Mailgun) behind a stable interface.
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List
from app.config import get_settings

settings = get_settings()


class EmailProvider:
    async def send(
        self, to: str, subject: str, body_html: str,
        body_text: str = "", from_name: str = "GLOBUS ENGINEERING",
        reply_to: Optional[str] = None, cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None, attachments: Optional[list] = None,
    ) -> dict:
        raise NotImplementedError

    async def send_bulk(
        self, recipients: List[str], subject: str, body_html: str,
        body_text: str = "", from_name: str = "GLOBUS ENGINEERING",
    ) -> dict:
        results = []
        for recipient in recipients:
            result = await self.send(recipient, subject, body_html, body_text, from_name)
            results.append(result)
        return {"sent": len([r for r in results if r.get("success")]), "total": len(recipients)}


class SMTPProvider(EmailProvider):
    async def send(
        self, to: str, subject: str, body_html: str,
        body_text: str = "", from_name: str = "GLOBUS ENGINEERING",
        reply_to: Optional[str] = None, cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None, attachments: Optional[list] = None,
    ) -> dict:
        smtp_host = getattr(settings, "SMTP_HOST", "")
        smtp_port = int(getattr(settings, "SMTP_PORT", 587))
        smtp_user = getattr(settings, "SMTP_USER", "")
        smtp_pass = getattr(settings, "SMTP_PASS", "")
        from_email = getattr(settings, "FROM_EMAIL", smtp_user)

        if not smtp_host:
            return {"success": False, "reason": "SMTP not configured"}

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = to
        if reply_to:
            msg["Reply-To"] = reply_to
        if cc:
            msg["Cc"] = ", ".join(cc)

        if body_text:
            msg.attach(MIMEText(body_text, "plain", "utf-8"))
        msg.attach(MIMEText(body_html, "html", "utf-8"))

        try:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                if smtp_user and smtp_pass:
                    server.login(smtp_user, smtp_pass)
                all_recipients = [to] + (cc or []) + (bcc or [])
                server.sendmail(from_email, all_recipients, msg.as_string())
            return {"success": True, "to": to}
        except Exception as e:
            return {"success": False, "error": str(e)}


class SendGridProvider(EmailProvider):
    async def send(
        self, to: str, subject: str, body_html: str,
        body_text: str = "", from_name: str = "GLOBUS ENGINEERING",
        reply_to: Optional[str] = None, cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None, attachments: Optional[list] = None,
    ) -> dict:
        api_key = getattr(settings, "SENDGRID_API_KEY", "")
        from_email = getattr(settings, "FROM_EMAIL", "noreply@globus-engineering.com")
        if not api_key:
            return {"success": False, "reason": "SendGrid not configured"}
        # pyrefly: ignore [missing-import]
        import httpx
        payload = {
            "personalizations": [{"to": [{"email": to}]}],
            "from": {"email": from_email, "name": from_name},
            "subject": subject,
            "content": [
                {"type": "text/plain", "value": body_text or subject},
                {"type": "text/html", "value": body_html},
            ],
        }
        if reply_to:
            payload["reply_to"] = {"email": reply_to}
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
                timeout=15.0,
            )
            return {"success": resp.status_code in (200, 202), "status": resp.status_code}


def get_email_provider() -> EmailProvider:
    provider = getattr(settings, "EMAIL_PROVIDER", "smtp")
    if provider == "sendgrid":
        return SendGridProvider()
    return SMTPProvider()
