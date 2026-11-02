"""Payment provider abstraction.

Encapsulates payment gateways (Stripe, Flutterwave, Mobile Money) behind a
stable interface so the underlying provider can be swapped.
"""
from typing import Optional
from app.config import get_settings

settings = get_settings()


class PaymentProvider:
    async def initiate_payment(
        self, amount: float, currency: str, customer_email: str,
        customer_name: str, tx_ref: str, description: str,
        redirect_url: str, metadata: Optional[dict] = None,
    ) -> dict:
        raise NotImplementedError

    async def verify_payment(self, transaction_id: str) -> dict:
        raise NotImplementedError

    async def handle_webhook(self, payload: dict, signature: str) -> dict:
        raise NotImplementedError


class FlutterwaveProvider(PaymentProvider):
    def __init__(self):
        self.secret_key = getattr(settings, "FLW_SECRET_KEY", "")
        self.base_url = "https://api.flutterwave.com/v3"

    async def initiate_payment(
        self, amount: float, currency: str, customer_email: str,
        customer_name: str, tx_ref: str, description: str,
        redirect_url: str, metadata: Optional[dict] = None,
    ) -> dict:
        # pyrefly: ignore [missing-import]
        import httpx
        payload = {
            "tx_ref": tx_ref,
            "amount": amount,
            "currency": currency,
            "redirect_url": redirect_url,
            "customer": {"email": customer_email, "name": customer_name},
            "customizations": {
                "title": "GLOBUS ENGINEERING",
                "description": description,
            },
            "meta": metadata or {},
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/payments",
                headers={"Authorization": f"Bearer {self.secret_key}"},
                json=payload,
                timeout=30.0,
            )
            return resp.json()

    async def verify_payment(self, transaction_id: str) -> dict:
        # pyrefly: ignore [missing-import]
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/transactions/{transaction_id}/verify",
                headers={"Authorization": f"Bearer {self.secret_key}"},
                timeout=15.0,
            )
            return resp.json()

    async def handle_webhook(self, payload: dict, signature: str) -> dict:
        import hashlib
        secret_hash = getattr(settings, "FLW_WEBHOOK_SECRET", "")
        expected = hashlib.sha256(secret_hash.encode()).hexdigest()
        if signature != expected:
            return {"verified": False, "error": "Invalid signature"}
        return {"verified": True, "data": payload.get("data", {})}


class StripeProvider(PaymentProvider):
    def __init__(self):
        self.secret_key = getattr(settings, "STRIPE_SECRET_KEY", "")

    async def initiate_payment(
        self, amount: float, currency: str, customer_email: str,
        customer_name: str, tx_ref: str, description: str,
        redirect_url: str, metadata: Optional[dict] = None,
    ) -> dict:
        if not self.secret_key:
            return {"status": "skipped", "reason": "Stripe not configured"}
        # pyrefly: ignore [missing-import]
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.stripe.com/v1/checkout/sessions",
                auth=(self.secret_key, ""),
                data={
                    "mode": "payment",
                    "success_url": redirect_url,
                    "cancel_url": redirect_url,
                    "customer_email": customer_email,
                    "line_items[0][price_data][currency]": currency.lower(),
                    "line_items[0][price_data][product_data][name]": description,
                    "line_items[0][price_data][unit_amount]": int(amount * 100),
                    "line_items[0][quantity]": 1,
                    "metadata[tx_ref]": tx_ref,
                },
                timeout=30.0,
            )
            return resp.json()

    async def verify_payment(self, transaction_id: str) -> dict:
        if not self.secret_key:
            return {"status": "skipped"}
        # pyrefly: ignore [missing-import]
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.stripe.com/v1/checkout/sessions/{transaction_id}",
                auth=(self.secret_key, ""),
                timeout=15.0,
            )
            return resp.json()


def get_payment_provider() -> PaymentProvider:
    provider_name = getattr(settings, "PAYMENT_PROVIDER", "flutterwave")
    if provider_name == "stripe":
        return StripeProvider()
    return FlutterwaveProvider()
