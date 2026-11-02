"""WhatsApp Business Platform provider abstraction.

Encapsulates WhatsApp messaging behind a provider interface so the underlying
service (Cloud API, third-party BSP) can be swapped without rewriting callers.
"""
# pyrefly: ignore [missing-import]
import httpx
from typing import Optional
from app.config import get_settings

settings = get_settings()


class WhatsAppProvider:
    def __init__(self):
        self.api_url = getattr(settings, "WHATSAPP_API_URL", "")
        self.token = getattr(settings, "WHATSAPP_TOKEN", "")
        self.phone_number_id = getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "")

    async def send_template(
        self, to: str, template_name: str, language: str = "fr",
        components: Optional[list] = None
    ) -> dict:
        if not self.api_url or not self.token:
            return {"status": "skipped", "reason": "WhatsApp not configured"}
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language},
            }
        }
        if components:
            payload["template"]["components"] = components
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.api_url}/{self.phone_number_id}/messages",
                headers={"Authorization": f"Bearer {self.token}"},
                json=payload,
                timeout=15.0,
            )
            return resp.json()

    async def send_text(self, to: str, body: str) -> dict:
        if not self.api_url or not self.token:
            return {"status": "skipped", "reason": "WhatsApp not configured"}
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"body": body},
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.api_url}/{self.phone_number_id}/messages",
                headers={"Authorization": f"Bearer {self.token}"},
                json=payload,
                timeout=15.0,
            )
            return resp.json()

    async def send_purchase_order(
        self, to: str, po_code: str, po_link: str, supplier_name: str
    ) -> dict:
        body = (
            f"GLOBUS ENGINEERING - Bon de Commande {po_code}\n\n"
            f"Bonjour {supplier_name},\n"
            f"Veuillez trouver notre bon de commande : {po_link}\n\n"
            f"Merci de confirmer la réception et le délai de livraison."
        )
        return await self.send_text(to, body)


whatsapp_provider = WhatsAppProvider()
