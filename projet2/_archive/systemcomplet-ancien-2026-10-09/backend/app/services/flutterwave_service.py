"""Flutterwave Payment Service — Secure wrapper around the Flutterwave v3 API.

Security measures:
- Secret key NEVER exposed to frontend
- Webhook signature verified with hmac.compare_digest (timing-safe)
- Double verification: webhook + API call to /v3/transactions/{id}/verify
- Amount and currency cross-checked against expected values
"""
import hmac
import logging
from typing import Any, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

FLW_BASE_URL = "https://api.flutterwave.com/v3"


class FlutterwaveError(Exception):
    """Raised when a Flutterwave API call fails."""

    def __init__(self, message: str, status_code: int = 0, response_data: Optional[dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data or {}


class FlutterwaveService:
    """Stateless service wrapping the Flutterwave v3 REST API."""

    def __init__(self):
        settings = get_settings()
        self._secret_key = settings.FLW_SECRET_KEY
        self._public_key = settings.FLW_PUBLIC_KEY
        self._secret_hash = settings.FLW_SECRET_HASH
        self._environment = settings.FLW_ENVIRONMENT

    # ── Headers ────────────────────────────────────────────────

    @property
    def _auth_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._secret_key}",
            "Content-Type": "application/json",
        }

    # ── Initialize Payment ─────────────────────────────────────

    async def initialize_payment(
        self,
        *,
        tx_ref: str,
        amount: float,
        currency: str = "XAF",
        redirect_url: str,
        customer_email: str,
        customer_name: str,
        customer_phone: str = "",
        title: str = "Globus BTP — Paiement",
        description: str = "",
        meta: Optional[dict] = None,
    ) -> dict[str, Any]:
        """Initialize a Flutterwave Standard payment.

        Returns the full Flutterwave response including the hosted checkout `link`.
        Raises FlutterwaveError on failure.
        """
        payload = {
            "tx_ref": tx_ref,
            "amount": str(amount),
            "currency": currency,
            "redirect_url": redirect_url,
            "payment_options": "card,mobilemoneycm",
            "customer": {
                "email": customer_email,
                "name": customer_name,
                "phonenumber": customer_phone,
            },
            "customizations": {
                "title": title,
                "description": description or f"Paiement {tx_ref}",
                "logo": "",  # Set via Flutterwave dashboard
            },
        }
        if meta:
            payload["meta"] = meta

        logger.info("FLW initialize_payment: tx_ref=%s amount=%s %s", tx_ref, amount, currency)

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{FLW_BASE_URL}/payments",
                json=payload,
                headers=self._auth_headers,
            )

        data = resp.json()
        if resp.status_code != 200 or data.get("status") != "success":
            logger.error("FLW initialize_payment failed: %s", data)
            raise FlutterwaveError(
                data.get("message", "Flutterwave payment initialization failed"),
                status_code=resp.status_code,
                response_data=data,
            )

        logger.info("FLW payment initialized: tx_ref=%s link=%s", tx_ref, data.get("data", {}).get("link"))
        return data

    # ── Verify Transaction ─────────────────────────────────────

    async def verify_transaction(self, transaction_id: str) -> dict[str, Any]:
        """Verify a transaction by its Flutterwave transaction ID.

        This is the CRITICAL security step: never trust webhook data alone.
        Always call this endpoint to confirm amount, currency, and status.
        """
        logger.info("FLW verify_transaction: id=%s", transaction_id)

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{FLW_BASE_URL}/transactions/{transaction_id}/verify",
                headers=self._auth_headers,
            )

        data = resp.json()
        if resp.status_code != 200 or data.get("status") != "success":
            logger.error("FLW verify_transaction failed: %s", data)
            raise FlutterwaveError(
                data.get("message", "Transaction verification failed"),
                status_code=resp.status_code,
                response_data=data,
            )

        return data

    # ── Webhook Signature Verification ─────────────────────────

    def validate_webhook_signature(self, verif_hash: Optional[str]) -> bool:
        """Validate the Flutterwave webhook `verif-hash` header.

        Flutterwave sends the Secret Hash you configured on their dashboard
        in the `verif-hash` header. We use hmac.compare_digest for timing-safe
        comparison to prevent timing attacks.

        Returns True if the hash matches, False otherwise.
        """
        if not verif_hash or not self._secret_hash:
            logger.warning("FLW webhook: missing verif_hash or secret_hash")
            return False

        # Timing-safe comparison
        is_valid = hmac.compare_digest(verif_hash, self._secret_hash)
        if not is_valid:
            logger.warning("FLW webhook: signature mismatch")
        return is_valid

    # ── Validate Payment Data ──────────────────────────────────

    @staticmethod
    def validate_payment_data(
        verified_data: dict,
        expected_amount: float,
        expected_currency: str = "XAF",
        expected_tx_ref: str = "",
    ) -> tuple[bool, str]:
        """Cross-check Flutterwave verified data against expected values.

        Returns (is_valid, reason).
        """
        tx_data = verified_data.get("data", {})
        status = tx_data.get("status", "")
        amount = float(tx_data.get("amount", 0))
        currency = tx_data.get("currency", "")
        tx_ref = tx_data.get("tx_ref", "")

        if status != "successful":
            return False, f"Transaction status is '{status}', expected 'successful'"

        if currency != expected_currency:
            return False, f"Currency mismatch: got '{currency}', expected '{expected_currency}'"

        if amount < expected_amount:
            return False, f"Amount mismatch: got {amount}, expected >= {expected_amount}"

        if expected_tx_ref and tx_ref != expected_tx_ref:
            return False, f"tx_ref mismatch: got '{tx_ref}', expected '{expected_tx_ref}'"

        return True, "OK"

    @property
    def public_key(self) -> str:
        """Safe to expose to the frontend."""
        return self._public_key


def get_flutterwave_service() -> FlutterwaveService:
    """Factory for dependency injection."""
    return FlutterwaveService()
