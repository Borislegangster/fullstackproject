"""PaymentProvider — prestataires réels uniquement (aucun simulateur, V4-DEPLOY-42) :

- MTN MoMo Open API : Collections (demande de paiement validée sur le téléphone du payeur) et Disbursements
  (transferts sortants vers un compte MoMo) ;
- Orange Money Web Payment : page de paiement Orange (code temporaire), notification à jeton par transaction ;
- Stripe (cartes internationales), Flutterwave et CinetPay (Mobile Money / cartes, XAF).

Exigences §16.1 : webhook à signature vérifiée + idempotence ; un échec ne clôt jamais un workflow ;
le statut final est toujours re-vérifié côté serveur auprès du prestataire avant d'être appliqué.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import re
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any, Protocol
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.core.secrets import get_secret
from app.core.security import hmac_sign
from app.providers.base import ProviderError, ProviderNotConfigured

ZERO_DECIMAL = {
    "BIF",
    "CLP",
    "DJF",
    "GNF",
    "JPY",
    "KMF",
    "KRW",
    "MGA",
    "OUV",
    "PYG",
    "RWF",
    "UGX",
    "VND",
    "VUV",
    "XAF",
    "XOF",
    "XPF",
}


class InvalidWebhookSignature(ProviderError):
    def __init__(self, provider: str) -> None:
        super().__init__("Signature de webhook invalide", provider=provider, retryable=False)


@dataclass
class CheckoutRequest:
    reference: str
    amount: Decimal
    currency: str
    description: str
    return_url: str
    cancel_url: str
    notify_url: str
    customer_email: str | None = None
    customer_phone: str | None = None
    customer_name: str | None = None
    customer_city: str | None = None
    customer_country: str | None = "CM"
    method: str = "any"  # any / card / mobile_money
    payer_phone: str | None = None  # numéro Mobile Money débité (paiement « push » MTN MoMo)
    metadata: dict[str, str] = field(default_factory=dict)


@dataclass
class CheckoutSession:
    provider: str
    session_id: str | None
    checkout_url: str
    expires_at: datetime | None = None
    flow: str = "redirect"  # redirect : page du prestataire ; push : validation sur le téléphone du payeur
    webhook_token: str | None = None  # secret propre à la transaction, renvoyé par le prestataire dans sa notification
    instructions: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class PaymentStatus:
    status: str  # succeeded / failed / pending / cancelled / expired
    amount: Decimal | None = None
    currency: str | None = None
    provider_transaction_id: str | None = None
    reason: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class WebhookEvent:
    provider: str
    event_id: str
    event_type: str
    reference: str | None
    session_id: str | None = None
    provider_transaction_id: str | None = None
    status_hint: str | None = None  # indicatif : le statut final est re-vérifié via fetch_status
    token: str | None = None  # jeton de la transaction (comparé à son empreinte enregistrée)
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class PayoutRequest:
    reference: str
    amount: Decimal
    currency: str
    account: str  # numéro Mobile Money ou compte bancaire du bénéficiaire
    bank_code: str | None
    beneficiary_name: str
    narration: str
    notify_url: str | None = None


@dataclass
class PayoutResult:
    provider_transaction_id: str | None
    status: str = "pending"
    raw: dict[str, Any] = field(default_factory=dict)


class PaymentProvider(Protocol):
    name: str
    label: str
    methods: set[str]
    flow: str
    payouts: bool

    def create_checkout(self, req: CheckoutRequest, idempotency_key: str) -> CheckoutSession: ...
    def parse_webhook(
        self, headers: dict[str, str], body: bytes, query: dict[str, str] | None = None
    ) -> WebhookEvent: ...
    def fetch_status(
        self,
        *,
        reference: str,
        session_id: str | None,
        provider_transaction_id: str | None,
        amount: Decimal | None = None,
    ) -> PaymentStatus: ...


# ============================================================================ outils communs
_http_client: httpx.Client | None = None


def http() -> httpx.Client:
    """Client HTTP partagé des prestataires (connexions réutilisées, délai borné)."""
    global _http_client
    if _http_client is None:
        _http_client = httpx.Client(timeout=httpx.Timeout(30.0, connect=10.0))
    return _http_client


def use_http_client(client: httpx.Client | None) -> None:
    """Injection d'un client HTTP (transport dédié en tests d'intégration)."""
    global _http_client
    _http_client = client


def to_minor(amount: Decimal, currency: str) -> int:
    if currency.upper() in ZERO_DECIMAL:
        return int(amount.quantize(Decimal("1")))
    return int((amount * 100).quantize(Decimal("1")))


def from_minor(value: int | str, currency: str) -> Decimal:
    v = Decimal(str(value))
    return v if currency.upper() in ZERO_DECIMAL else (v / 100)


def amount_text(amount: Decimal, currency: str) -> str:
    """Montant au format attendu par les API Mobile Money (entier pour les devises sans décimales)."""
    value = Decimal(amount)
    if currency.upper() in ZERO_DECIMAL or value == value.to_integral_value():
        return str(int(value.quantize(Decimal("1"))))
    return f"{value.quantize(Decimal('0.01'))}"


def normalize_msisdn(value: str | None, *, country_code: str = "237") -> str | None:
    """Numéro international sans « + » ni séparateurs (ex. 2376XXXXXXXX) ; None si invalide."""
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    if digits.startswith("00"):
        digits = digits[2:]
    if len(digits) == 9 and country_code == "237" and digits.startswith("6"):
        digits = country_code + digits
    return digits if 8 <= len(digits) <= 15 else None


def callback_signature(provider: str, reference: str) -> str:
    return hmac_sign(f"payment-callback:{provider}:{reference}")


def verify_callback(provider: str, query: dict[str, str] | None) -> str:
    """URL de notification signée par transaction : seul le prestataire qui l'a reçue peut l'appeler."""
    query = query or {}
    reference, signature = query.get("ref", ""), query.get("sig", "")
    if not reference or not signature or not hmac.compare_digest(callback_signature(provider, reference), signature):
        raise InvalidWebhookSignature(provider)
    return reference


class _TokenCache:
    """Jetons OAuth des prestataires mis en cache jusqu'à expiration (marge d'une minute)."""

    def __init__(self) -> None:
        self._tokens: dict[str, tuple[str, float]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> str | None:
        with self._lock:
            entry = self._tokens.get(key)
            return entry[0] if entry and entry[1] > time.time() + 60 else None

    def put(self, key: str, token: str, ttl: int) -> None:
        with self._lock:
            self._tokens[key] = (token, time.time() + max(ttl, 120))

    def clear(self) -> None:
        with self._lock:
            self._tokens.clear()


tokens = _TokenCache()


def _json(resp: httpx.Response) -> dict[str, Any]:
    try:
        body = resp.json() if resp.content else {}
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}


# ============================================================================ MTN MoMo Open API
_MOMO_STATUS = {
    "SUCCESSFUL": "succeeded",
    "FAILED": "failed",
    "REJECTED": "failed",
    "TIMEOUT": "expired",
    "EXPIRED": "expired",
    "CANCELLED": "cancelled",
}


class MtnMomoProvider:
    """MTN Mobile Money (Open API, momodeveloper.mtn.com).

    Collections : `POST /collection/v1_0/requesttopay` (X-Reference-Id = identifiant de transaction GLOBUS), le payeur
    valide sur son téléphone ; statut lu par `GET /collection/v1_0/requesttopay/{id}`. Disbursements :
    `POST /disbursement/v1_0/transfer`. Authentification : jeton `/{produit}/token/` (Basic API user / API key) +
    `Ocp-Apim-Subscription-Key` du produit. Les rappels MTN ne sont pas signés : l'URL de rappel est signée par
    transaction et le statut est toujours relu auprès de MTN.
    """

    name = "mtn_momo"
    label = "MTN Mobile Money"
    methods = {"mobile_money"}
    flow = "push"
    payouts = True

    @property
    def base(self) -> str:
        return settings.MTN_MOMO_BASE_URL.rstrip("/")

    @property
    def environment(self) -> str:
        return settings.MTN_MOMO_TARGET_ENVIRONMENT

    def currency(self, currency: str) -> str:
        # Le bac à sable MTN n'accepte que l'EUR ; en production la devise de la pièce (XAF).
        override = settings.MTN_MOMO_CURRENCY or ("EUR" if self.environment == "sandbox" else None)
        return (override or currency).upper()

    def _credentials(self, product: str) -> tuple[str, str, str]:
        prefix = f"MTN_MOMO_{product.upper()}"
        user = get_secret(f"{prefix}_USER_ID")
        api_key = get_secret(f"{prefix}_API_KEY")
        subscription = get_secret(f"{prefix}_SUBSCRIPTION_KEY")
        if not (user and api_key and subscription):
            raise ProviderNotConfigured(self.name, f"{prefix}_USER_ID / {prefix}_API_KEY / {prefix}_SUBSCRIPTION_KEY")
        return user, api_key, subscription

    def _token(self, product: str) -> str:
        cached = tokens.get(f"{self.name}:{product}")
        if cached:
            return cached
        user, api_key, subscription = self._credentials(product)
        try:
            resp = http().post(
                f"{self.base}/{product}/token/",
                auth=(user, api_key),
                headers={"Ocp-Apim-Subscription-Key": subscription, "X-Target-Environment": self.environment},
            )
        except httpx.HTTPError as exc:
            raise ProviderError(f"MTN MoMo injoignable : {exc}", provider=self.name) from exc
        body = _json(resp)
        if resp.status_code != 200 or not body.get("access_token"):
            raise ProviderError(
                f"MTN MoMo : authentification refusée ({resp.status_code})",
                provider=self.name,
                retryable=resp.status_code >= 500,
                details=body.get("error") or body.get("message"),
            )
        tokens.put(f"{self.name}:{product}", body["access_token"], int(body.get("expires_in") or 3600))
        return body["access_token"]

    def _headers(self, product: str, *, reference: str | None = None, callback: str | None = None) -> dict[str, str]:
        _user, _key, subscription = self._credentials(product)
        headers = {
            "Authorization": f"Bearer {self._token(product)}",
            "Ocp-Apim-Subscription-Key": subscription,
            "X-Target-Environment": self.environment,
            "Content-Type": "application/json",
        }
        if reference:
            headers["X-Reference-Id"] = reference
        # Pas de rappel en bac à sable (non supporté) ; en production l'hôte doit être celui déclaré chez MTN.
        if callback and self.environment != "sandbox" and urlparse(callback).scheme == "https":
            headers["X-Callback-Url"] = callback
        return headers

    def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        try:
            return http().request(method, f"{self.base}{path}", **kwargs)
        except httpx.HTTPError as exc:
            raise ProviderError(f"MTN MoMo injoignable : {exc}", provider=self.name) from exc

    def _error(self, resp: httpx.Response, action: str) -> ProviderError:
        body = _json(resp)
        code = body.get("code") or body.get("errorCode") or resp.status_code
        message = body.get("message") or body.get("errorMessage") or ""
        return ProviderError(
            f"MTN MoMo : {action} refusé ({code}) {message}".strip(),
            provider=self.name,
            retryable=resp.status_code >= 500 or resp.status_code == 429,
            details=code,
        )

    def account_active(self, msisdn: str) -> bool | None:
        """Vérifie qu'un numéro est un compte MoMo actif (None si l'information est indisponible)."""
        try:
            resp = self._request(
                "GET",
                f"/collection/v1_0/accountholder/msisdn/{msisdn}/active",
                headers=self._headers("collection"),
            )
        except ProviderError:
            return None
        if resp.status_code != 200:
            return None
        result = _json(resp).get("result")
        return result if isinstance(result, bool) else None

    def create_checkout(self, req: CheckoutRequest, idempotency_key: str) -> CheckoutSession:
        msisdn = normalize_msisdn(req.payer_phone or req.customer_phone)
        if not msisdn:
            raise ProviderError(
                "Numéro MTN Mobile Money requis (ex. 6 7X XX XX XX)", provider=self.name, retryable=False
            )
        uuid.UUID(req.reference)  # X-Reference-Id : UUID v4 exigé par MTN
        if self.account_active(msisdn) is False:
            raise ProviderError(
                "Ce numéro n'est pas un compte MTN Mobile Money actif", provider=self.name, retryable=False
            )
        currency = self.currency(req.currency)
        resp = self._request(
            "POST",
            "/collection/v1_0/requesttopay",
            headers=self._headers("collection", reference=req.reference, callback=req.notify_url),
            json={
                "amount": amount_text(req.amount, currency),
                "currency": currency,
                "externalId": req.reference,
                "payer": {"partyIdType": "MSISDN", "partyId": msisdn},
                "payerMessage": re.sub(r"\s+", " ", req.description)[:160],
                "payeeNote": f"GLOBUS {req.metadata.get('payment', '')}".strip()[:160],
            },
        )
        if resp.status_code not in (202, 409):  # 409 : même X-Reference-Id déjà soumis (rejeu idempotent)
            raise self._error(resp, "demande de paiement")
        return CheckoutSession(
            provider=self.name,
            session_id=req.reference,
            checkout_url=req.return_url,
            expires_at=datetime.now(UTC) + timedelta(minutes=15),
            flow="push",
            instructions=(
                f"Une demande de paiement a été envoyée au {msisdn}. Validez-la sur votre téléphone "
                "(notification MTN MoMo ou menu *126#) en saisissant votre code secret."
            ),
            raw={"msisdn": msisdn[:5] + "•••" + msisdn[-2:]},
        )

    def parse_webhook(self, headers: dict[str, str], body: bytes, query: dict[str, str] | None = None) -> WebhookEvent:
        reference = verify_callback(self.name, query)
        try:
            data = json.loads(body or b"{}")
        except ValueError as exc:
            raise InvalidWebhookSignature(self.name) from exc
        external = str(data.get("externalId") or reference)
        if external != reference:
            raise InvalidWebhookSignature(self.name)
        status = str(data.get("status", "")).upper()
        return WebhookEvent(
            provider=self.name,
            event_id=f"{reference}:{status}:{data.get('financialTransactionId') or ''}",
            event_type="momo.callback",
            reference=reference,
            provider_transaction_id=data.get("financialTransactionId"),
            status_hint=_MOMO_STATUS.get(status, "pending"),
            raw={"status": status},
        )

    def _status(self, path: str, product: str, reference: str) -> PaymentStatus:
        resp = self._request("GET", path, headers=self._headers(product))
        if resp.status_code == 404:
            return PaymentStatus(status="pending", reason="Demande inconnue chez MTN (en cours de création)")
        if resp.status_code != 200:
            raise self._error(resp, "lecture du statut")
        data = _json(resp)
        external = data.get("externalId")
        if external not in (None, "", reference):
            return PaymentStatus(status="failed", reason="Référence incohérente")
        raw_status = str(data.get("status", "")).upper()
        reason = data.get("reason")
        if isinstance(reason, dict):
            reason = reason.get("message") or reason.get("code")
        overridden = bool(settings.MTN_MOMO_CURRENCY or self.environment == "sandbox")
        return PaymentStatus(
            status=_MOMO_STATUS.get(raw_status, "pending"),
            amount=Decimal(str(data["amount"])) if data.get("amount") not in (None, "") else None,
            # Devise de test imposée par MTN (EUR) : non comparée à la devise de la pièce.
            currency=None if overridden else (str(data.get("currency", "")).upper() or None),
            provider_transaction_id=data.get("financialTransactionId"),
            reason=str(reason) if reason else None,
            raw={"status": raw_status},
        )

    def fetch_status(
        self,
        *,
        reference: str,
        session_id: str | None,
        provider_transaction_id: str | None,
        amount: Decimal | None = None,
    ) -> PaymentStatus:
        return self._status(f"/collection/v1_0/requesttopay/{reference}", "collection", reference)

    def transfer(self, req: PayoutRequest) -> PayoutResult:
        msisdn = normalize_msisdn(req.account)
        if not msisdn:
            raise ProviderError("Numéro MTN Mobile Money du bénéficiaire invalide", provider=self.name, retryable=False)
        uuid.UUID(req.reference)
        currency = self.currency(req.currency)
        resp = self._request(
            "POST",
            "/disbursement/v1_0/transfer",
            headers=self._headers("disbursement", reference=req.reference, callback=req.notify_url),
            json={
                "amount": amount_text(req.amount, currency),
                "currency": currency,
                "externalId": req.reference,
                "payee": {"partyIdType": "MSISDN", "partyId": msisdn},
                "payerMessage": req.narration[:160],
                "payeeNote": req.narration[:160],
            },
        )
        if resp.status_code not in (202, 409):
            raise self._error(resp, "transfert")
        return PayoutResult(provider_transaction_id=None, status="pending", raw={"msisdn": msisdn[:5] + "•••"})

    def fetch_transfer_status(self, *, reference: str, provider_transaction_id: str | None) -> PaymentStatus:
        return self._status(f"/disbursement/v1_0/transfer/{reference}", "disbursement", reference)


# ============================================================================ Orange Money Web Payment
_OM_STATUS = {"SUCCESS": "succeeded", "FAILED": "failed", "EXPIRED": "expired", "CANCELLED": "cancelled"}


class OrangeMoneyProvider:
    """Orange Money Web Payment / M Payment (developer.orange.com/apis/om-webpay).

    Jeton OAuth2 (`/oauth/v3/token`, en-tête « Authorization » fourni par Orange), création du paiement
    (`/orange-money-webpay/{pays}/v1/webpayment` → `payment_url`, `pay_token`, `notif_token`), notification POST
    `{status, notif_token, txnid}` authentifiée par le `notif_token` propre à la transaction, statut relu par
    `/transactionstatus` (order_id, amount, pay_token).
    """

    name = "orange_money"
    label = "Orange Money"
    methods = {"mobile_money"}
    flow = "redirect"
    payouts = False

    @property
    def api(self) -> str:
        return f"{settings.ORANGE_OM_API_BASE.rstrip('/')}/orange-money-webpay/{settings.ORANGE_OM_COUNTRY}/v1"

    def currency(self, currency: str) -> str:
        override = settings.ORANGE_OM_CURRENCY or ("OUV" if settings.ORANGE_OM_COUNTRY == "dev" else None)
        return (override or currency).upper()

    @staticmethod
    def order_id(reference: str) -> str:
        return reference.replace("-", "")

    def _token(self) -> str:
        cached = tokens.get(self.name)
        if cached:
            return cached
        authorization = get_secret("ORANGE_OM_AUTHORIZATION")
        if not authorization:
            raise ProviderNotConfigured(self.name, "ORANGE_OM_AUTHORIZATION")
        if not authorization.lower().startswith("basic "):
            authorization = f"Basic {authorization}"
        try:
            resp = http().post(
                f"{settings.ORANGE_OM_API_BASE.rstrip('/')}{settings.ORANGE_OM_OAUTH_PATH}",
                headers={"Authorization": authorization, "Accept": "application/json"},
                data={"grant_type": "client_credentials"},
            )
        except httpx.HTTPError as exc:
            raise ProviderError(f"Orange Money injoignable : {exc}", provider=self.name) from exc
        body = _json(resp)
        if resp.status_code != 200 or not body.get("access_token"):
            raise ProviderError(
                f"Orange Money : authentification refusée ({resp.status_code})",
                provider=self.name,
                retryable=resp.status_code >= 500,
            )
        tokens.put(self.name, body["access_token"], int(body.get("expires_in") or 3600))
        return body["access_token"]

    def _post(self, operation: str, payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
        try:
            resp = http().post(
                f"{self.api}/{operation}",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self._token()}",
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
            )
        except httpx.HTTPError as exc:
            raise ProviderError(f"Orange Money injoignable : {exc}", provider=self.name) from exc
        return resp.status_code, _json(resp)

    def create_checkout(self, req: CheckoutRequest, idempotency_key: str) -> CheckoutSession:
        merchant_key = get_secret("ORANGE_OM_MERCHANT_KEY")
        if not merchant_key:
            raise ProviderNotConfigured(self.name, "ORANGE_OM_MERCHANT_KEY")
        currency = self.currency(req.currency)
        status, body = self._post(
            "webpayment",
            {
                "merchant_key": merchant_key,
                "currency": currency,
                "order_id": self.order_id(req.reference),
                "amount": int(Decimal(req.amount).quantize(Decimal("1"))),
                "return_url": req.return_url,
                "cancel_url": req.cancel_url,
                "notif_url": req.notify_url,
                "lang": "fr",
                "reference": settings.ORANGE_OM_MERCHANT_NAME[:30],
            },
        )
        url = str(body.get("payment_url") or "")
        host = urlparse(url).hostname or ""
        if status not in (200, 201) or not body.get("pay_token") or not body.get("notif_token"):
            raise ProviderError(
                f"Orange Money n'a pas créé le paiement ({status}) {body.get('message') or ''}".strip(),
                provider=self.name,
                retryable=status >= 500,
            )
        if urlparse(url).scheme != "https" or not (host.endswith("orange-money.com") or host.endswith("orange.com")):
            raise ProviderError("URL de paiement Orange Money inattendue", provider=self.name)
        return CheckoutSession(
            provider=self.name,
            session_id=body["pay_token"],
            checkout_url=url,
            expires_at=datetime.now(UTC) + timedelta(minutes=30),
            flow="redirect",
            webhook_token=body["notif_token"],
            instructions=(
                "Sur la page Orange Money, saisissez votre numéro puis le code temporaire obtenu via #150*4*4#."
            ),
        )

    def parse_webhook(self, headers: dict[str, str], body: bytes, query: dict[str, str] | None = None) -> WebhookEvent:
        reference = verify_callback(self.name, query)
        try:
            data = json.loads(body or b"{}")
        except ValueError as exc:
            raise InvalidWebhookSignature(self.name) from exc
        token = str(data.get("notif_token") or "")
        if not token:
            raise InvalidWebhookSignature(self.name)
        status = str(data.get("status", "")).upper()
        return WebhookEvent(
            provider=self.name,
            event_id=f"{reference}:{status}:{data.get('txnid') or ''}",
            event_type="om.notification",
            reference=reference,
            provider_transaction_id=data.get("txnid"),
            status_hint=_OM_STATUS.get(status, "pending"),
            token=token,
            raw={"status": status},
        )

    def fetch_status(
        self,
        *,
        reference: str,
        session_id: str | None,
        provider_transaction_id: str | None,
        amount: Decimal | None = None,
    ) -> PaymentStatus:
        if not session_id or amount is None:
            return PaymentStatus(status="pending", reason="Paiement Orange Money non initialisé")
        order_id = self.order_id(reference)
        status, body = self._post(
            "transactionstatus",
            {"order_id": order_id, "amount": int(Decimal(amount).quantize(Decimal("1"))), "pay_token": session_id},
        )
        if status >= 400:
            if status >= 500:
                raise ProviderError(f"Orange Money : statut indisponible ({status})", provider=self.name)
            return PaymentStatus(status="pending", reason=str(body.get("message") or status))
        if body.get("order_id") not in (None, "", order_id):
            return PaymentStatus(status="failed", reason="Référence incohérente")
        raw_status = str(body.get("status", "")).upper()
        mapped = _OM_STATUS.get(raw_status, "pending")
        return PaymentStatus(
            status=mapped,
            # Orange valide le couple (order_id, montant, pay_token) : le montant confirmé est celui interrogé.
            amount=Decimal(amount) if mapped == "succeeded" else None,
            currency=None,
            provider_transaction_id=body.get("txnid") or provider_transaction_id,
            reason=None if mapped == "succeeded" else (body.get("message") or raw_status or None),
            raw={"status": raw_status},
        )


# ============================================================================ Stripe
class StripeProvider:
    name = "stripe"
    label = "Carte bancaire internationale"
    methods = {"card"}
    flow = "redirect"
    payouts = False
    api = "https://api.stripe.com/v1"

    def _key(self) -> str:
        key = get_secret("STRIPE_SECRET_KEY")
        if not key:
            raise ProviderNotConfigured(self.name, "STRIPE_SECRET_KEY")
        return key

    def _request(
        self, method: str, path: str, data: dict[str, Any] | None = None, idempotency_key: str | None = None
    ) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {self._key()}", "Stripe-Version": "2024-06-20"}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        try:
            resp = http().request(method, f"{self.api}/{path}", data=data, headers=headers)
        except httpx.HTTPError as exc:
            raise ProviderError(f"Stripe : {exc}", provider=self.name) from exc
        body = _json(resp)
        if resp.status_code >= 300:
            err = body.get("error", {}) if isinstance(body.get("error"), dict) else {}
            raise ProviderError(
                f"Stripe {resp.status_code} : {err.get('message', '')}",
                provider=self.name,
                retryable=resp.status_code >= 500 or resp.status_code == 429,
                details=err.get("code"),
            )
        return body

    def create_checkout(self, req: CheckoutRequest, idempotency_key: str) -> CheckoutSession:
        currency = req.currency.lower()
        expires = int(time.time()) + 3600
        data: dict[str, Any] = {
            "mode": "payment",
            "success_url": req.return_url,
            "cancel_url": req.cancel_url,
            "client_reference_id": req.reference,
            "line_items[0][quantity]": "1",
            "line_items[0][price_data][currency]": currency,
            "line_items[0][price_data][unit_amount]": str(to_minor(req.amount, req.currency)),
            "line_items[0][price_data][product_data][name]": req.description[:250],
            "payment_intent_data[metadata][reference]": req.reference,
            "metadata[reference]": req.reference,
            "expires_at": str(expires),
            "locale": "fr",
        }
        for key, value in req.metadata.items():
            data[f"metadata[{key}]"] = str(value)[:450]
        if req.customer_email:
            data["customer_email"] = req.customer_email
        body = self._request("POST", "checkout/sessions", data, idempotency_key)
        return CheckoutSession(
            provider=self.name,
            session_id=body["id"],
            checkout_url=body["url"],
            expires_at=datetime.fromtimestamp(body.get("expires_at", expires), UTC),
        )

    def parse_webhook(self, headers: dict[str, str], body: bytes, query: dict[str, str] | None = None) -> WebhookEvent:
        secret = get_secret("STRIPE_WEBHOOK_SECRET")
        sig_header = headers.get("stripe-signature", "")
        if not secret or not sig_header:
            raise InvalidWebhookSignature(self.name)
        parts = dict(p.split("=", 1) for p in sig_header.split(",") if "=" in p)
        timestamp = parts.get("t", "0")
        signatures = [v for k, v in (p.split("=", 1) for p in sig_header.split(",") if "=" in p) if k == "v1"]
        expected = hmac.new(secret.encode(), f"{timestamp}.".encode() + body, hashlib.sha256).hexdigest()
        if not any(hmac.compare_digest(expected, s) for s in signatures):
            raise InvalidWebhookSignature(self.name)
        if abs(time.time() - int(timestamp)) > 300:
            raise InvalidWebhookSignature(self.name)
        event = json.loads(body)
        obj = (event.get("data") or {}).get("object") or {}
        reference = obj.get("client_reference_id") or (obj.get("metadata") or {}).get("reference")
        hint = None
        etype = event.get("type", "")
        if etype in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
            hint = "succeeded" if obj.get("payment_status") == "paid" else "pending"
        elif etype in ("checkout.session.async_payment_failed", "payment_intent.payment_failed"):
            hint = "failed"
        elif etype == "checkout.session.expired":
            hint = "expired"
        return WebhookEvent(
            provider=self.name,
            event_id=event.get("id", ""),
            event_type=etype,
            reference=reference,
            session_id=obj.get("id") if str(obj.get("id", "")).startswith("cs_") else None,
            provider_transaction_id=obj.get("payment_intent"),
            status_hint=hint,
            raw={"type": etype, "id": event.get("id")},
        )

    def fetch_status(
        self,
        *,
        reference: str,
        session_id: str | None,
        provider_transaction_id: str | None,
        amount: Decimal | None = None,
    ) -> PaymentStatus:
        if not session_id:
            return PaymentStatus(status="pending", reason="session inconnue")
        body = self._request("GET", f"checkout/sessions/{session_id}")
        if body.get("client_reference_id") not in (None, reference):
            return PaymentStatus(status="failed", reason="Référence incohérente")
        currency = str(body.get("currency", "")).upper()
        paid = from_minor(body.get("amount_total") or 0, currency) if currency else None
        if body.get("payment_status") == "paid":
            status = "succeeded"
        elif body.get("status") == "expired":
            status = "expired"
        else:
            status = "pending"
        return PaymentStatus(
            status=status,
            amount=paid,
            currency=currency or None,
            provider_transaction_id=body.get("payment_intent"),
            raw={"status": body.get("status")},
        )


# ============================================================================ Flutterwave
class FlutterwaveProvider:
    name = "flutterwave"
    label = "Flutterwave"
    methods = {"card", "mobile_money"}
    flow = "redirect"
    payouts = True
    api = "https://api.flutterwave.com/v3"

    def _key(self) -> str:
        key = get_secret("FLW_SECRET_KEY")
        if not key:
            raise ProviderNotConfigured(self.name, "FLW_SECRET_KEY")
        return key

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        try:
            resp = http().request(
                method,
                f"{self.api}/{path}",
                json=payload,
                headers={"Authorization": f"Bearer {self._key()}"},
            )
        except httpx.HTTPError as exc:
            raise ProviderError(f"Flutterwave : {exc}", provider=self.name) from exc
        body = _json(resp)
        if resp.status_code >= 300 or body.get("status") == "error":
            raise ProviderError(
                f"Flutterwave {resp.status_code} : {body.get('message', '')}",
                provider=self.name,
                retryable=resp.status_code >= 500,
            )
        return body

    def create_checkout(self, req: CheckoutRequest, idempotency_key: str) -> CheckoutSession:
        options = {"card": "card", "mobile_money": "mobilemoneyfranco"}.get(req.method, "card,mobilemoneyfranco")
        body = self._request(
            "POST",
            "payments",
            {
                "tx_ref": req.reference,
                "amount": str(req.amount),
                "currency": req.currency.upper(),
                "redirect_url": req.return_url,
                "payment_options": options,
                "customer": {
                    "email": req.customer_email or "client@globus-engineering.cm",
                    "phonenumber": req.customer_phone or "",
                    "name": req.customer_name or "Client GLOBUS",
                },
                "customizations": {"title": "GLOBUS ENGINEERING", "description": req.description[:200]},
                "meta": {**req.metadata, "idempotency_key": idempotency_key},
            },
        )
        link = (body.get("data") or {}).get("link")
        if not link or urlparse(link).scheme != "https":
            raise ProviderError("Flutterwave n'a pas retourné de lien de paiement", provider=self.name)
        return CheckoutSession(
            provider=self.name,
            session_id=req.reference,
            checkout_url=link,
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        )

    def parse_webhook(self, headers: dict[str, str], body: bytes, query: dict[str, str] | None = None) -> WebhookEvent:
        secret_hash = get_secret("FLW_WEBHOOK_HASH")
        if not secret_hash:
            raise InvalidWebhookSignature(self.name)
        signature = headers.get("flutterwave-signature")
        verif = headers.get("verif-hash")
        if signature:
            import base64

            expected = base64.b64encode(hmac.new(secret_hash.encode(), body, hashlib.sha256).digest()).decode()
            if not hmac.compare_digest(expected, signature):
                raise InvalidWebhookSignature(self.name)
        elif not verif or not hmac.compare_digest(verif, secret_hash):
            raise InvalidWebhookSignature(self.name)
        event = json.loads(body)
        data = event.get("data") or {}
        status = str(data.get("status", "")).lower()
        hint = "succeeded" if status == "successful" else ("failed" if status == "failed" else "pending")
        return WebhookEvent(
            provider=self.name,
            event_id=str(data.get("id") or data.get("flw_ref") or ""),
            event_type=str(event.get("event") or event.get("event.type") or "charge.completed"),
            reference=data.get("tx_ref") or data.get("reference"),
            session_id=data.get("tx_ref"),
            provider_transaction_id=str(data.get("id")) if data.get("id") else None,
            status_hint=hint,
            raw={"event": event.get("event")},
        )

    def fetch_status(
        self,
        *,
        reference: str,
        session_id: str | None,
        provider_transaction_id: str | None,
        amount: Decimal | None = None,
    ) -> PaymentStatus:
        path = (
            f"transactions/{provider_transaction_id}/verify"
            if provider_transaction_id
            else f"transactions/verify_by_reference?tx_ref={reference}"
        )
        body = self._request("GET", path)
        data = body.get("data") or {}
        if data.get("tx_ref") not in (None, reference):
            return PaymentStatus(status="failed", reason="Référence incohérente")
        status = str(data.get("status", "")).lower()
        mapped = {"successful": "succeeded", "failed": "failed", "cancelled": "cancelled"}.get(status, "pending")
        paid = Decimal(str(data["amount"])) if data.get("amount") is not None else None
        return PaymentStatus(
            status=mapped,
            amount=paid,
            currency=str(data.get("currency", "")).upper() or None,
            provider_transaction_id=str(data.get("id")) if data.get("id") else None,
            reason=data.get("processor_response"),
            raw={"status": status},
        )

    def transfer(self, req: PayoutRequest) -> PayoutResult:
        """Paiement sortant (fournisseur / sous-traitant) — virement bancaire ou Mobile Money (code FMM)."""
        body = self._request(
            "POST",
            "transfers",
            {
                "account_bank": req.bank_code or "",
                "account_number": req.account,
                "amount": str(req.amount),
                "currency": req.currency.upper(),
                "beneficiary_name": req.beneficiary_name,
                "narration": req.narration[:100],
                "reference": req.reference,
                "debit_currency": req.currency.upper(),
                **({"callback_url": req.notify_url} if req.notify_url else {}),
            },
        )
        data = body.get("data") or {}
        return PayoutResult(provider_transaction_id=str(data["id"]) if data.get("id") else None, raw={})

    def fetch_transfer_status(self, *, reference: str, provider_transaction_id: str | None) -> PaymentStatus:
        if not provider_transaction_id:
            return PaymentStatus(status="pending", reason="Transfert sans identifiant prestataire")
        data = self._request("GET", f"transfers/{provider_transaction_id}").get("data") or {}
        status = str(data.get("status", "")).upper()
        mapped = {"SUCCESSFUL": "succeeded", "FAILED": "failed"}.get(status, "pending")
        return PaymentStatus(
            status=mapped,
            amount=Decimal(str(data["amount"])) if data.get("amount") is not None else None,
            currency=str(data.get("currency", "")).upper() or None,
            provider_transaction_id=provider_transaction_id,
            reason=data.get("complete_message") if mapped == "failed" else None,
            raw={"status": status},
        )


# ============================================================================ CinetPay
class CinetPayProvider:
    name = "cinetpay"
    label = "CinetPay"
    methods = {"card", "mobile_money"}
    flow = "redirect"
    payouts = False
    api = "https://api-checkout.cinetpay.com/v2"
    _webhook_fields = (
        "cpm_site_id",
        "cpm_trans_id",
        "cpm_trans_date",
        "cpm_amount",
        "cpm_currency",
        "signature",
        "payment_method",
        "cel_phone_num",
        "cpm_phone_prefixe",
        "cpm_language",
        "cpm_version",
        "cpm_payment_config",
        "cpm_page_action",
        "cpm_custom",
        "cpm_designation",
        "cpm_error_message",
    )

    def _creds(self) -> tuple[str, str]:
        key = get_secret("CINETPAY_API_KEY")
        if not key or not settings.CINETPAY_SITE_ID:
            raise ProviderNotConfigured(self.name, "CINETPAY_API_KEY/CINETPAY_SITE_ID")
        return key, settings.CINETPAY_SITE_ID

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            resp = http().post(f"{self.api}/{path}", json=payload)
        except httpx.HTTPError as exc:
            raise ProviderError(f"CinetPay : {exc}", provider=self.name) from exc
        body = _json(resp)
        if not body:
            raise ProviderError("Réponse CinetPay illisible", provider=self.name)
        return body

    def create_checkout(self, req: CheckoutRequest, idempotency_key: str) -> CheckoutSession:
        api_key, site_id = self._creds()
        amount = int(req.amount.quantize(Decimal("1")))
        if req.currency.upper() in ("XAF", "XOF") and amount % 5 != 0:
            raise ProviderError("CinetPay exige un montant multiple de 5", provider=self.name, retryable=False)
        channels = {"card": "CREDIT_CARD", "mobile_money": "MOBILE_MONEY"}.get(req.method, "ALL")
        payload: dict[str, Any] = {
            "apikey": api_key,
            "site_id": site_id,
            "transaction_id": req.reference,
            "amount": amount,
            "currency": req.currency.upper(),
            "description": re.sub(r"[^A-Za-z0-9 .-]", " ", req.description)[:120].strip() or "Paiement GLOBUS",
            "notify_url": req.notify_url,
            "return_url": req.return_url,
            "channels": channels,
            "lang": "fr",
            "metadata": json.dumps(req.metadata)[:1000],
        }
        if channels in ("ALL", "CREDIT_CARD"):
            name = (req.customer_name or "Client GLOBUS").split(" ", 1)
            payload.update(
                {
                    "customer_name": name[0],
                    "customer_surname": name[1] if len(name) > 1 else name[0],
                    "customer_email": req.customer_email or "client@globus-engineering.cm",
                    "customer_phone_number": req.customer_phone or "",
                    "customer_address": req.customer_city or "Douala",
                    "customer_city": req.customer_city or "Douala",
                    "customer_country": req.customer_country or "CM",
                    "customer_state": req.customer_country or "CM",
                    "customer_zip_code": "00000",
                }
            )
        result = self._post("payment", payload)
        if str(result.get("code", "")) != "201":
            raise ProviderError("CinetPay n'a pas créé le paiement", provider=self.name, details=result.get("message"))
        url = (result.get("data") or {}).get("payment_url", "")
        parsed = urlparse(url)
        if parsed.scheme != "https" or not (parsed.hostname or "").endswith("cinetpay.com"):
            raise ProviderError("URL de paiement CinetPay inattendue", provider=self.name)
        return CheckoutSession(
            provider=self.name,
            session_id=(result.get("data") or {}).get("payment_token"),
            checkout_url=url,
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        )

    def parse_webhook(self, headers: dict[str, str], body: bytes, query: dict[str, str] | None = None) -> WebhookEvent:
        from urllib.parse import parse_qsl

        secret = get_secret("CINETPAY_SECRET_KEY")
        token = headers.get("x-token", "")
        try:
            fields = dict(parse_qsl(body.decode("utf-8"), keep_blank_values=True))
        except UnicodeDecodeError as exc:
            raise InvalidWebhookSignature(self.name) from exc
        if not fields and body.strip().startswith(b"{"):
            fields = {k: str(v) for k, v in json.loads(body).items()}
        if not secret or not token or fields.get("cpm_site_id") != settings.CINETPAY_SITE_ID:
            raise InvalidWebhookSignature(self.name)
        message = "".join(str(fields.get(name, "")) for name in self._webhook_fields).encode("utf-8")
        expected = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected.lower(), token.strip().lower()):
            raise InvalidWebhookSignature(self.name)
        ref = fields.get("cpm_trans_id")
        return WebhookEvent(
            provider=self.name,
            event_id=f"{ref}:{fields.get('cpm_trans_date', '')}",
            event_type="payment.notification",
            reference=ref,
            session_id=None,
            status_hint=None,
            raw={"payment_method": fields.get("payment_method")},
        )

    def fetch_status(
        self,
        *,
        reference: str,
        session_id: str | None,
        provider_transaction_id: str | None,
        amount: Decimal | None = None,
    ) -> PaymentStatus:
        api_key, site_id = self._creds()
        result = self._post("payment/check", {"apikey": api_key, "site_id": site_id, "transaction_id": reference})
        data = result.get("data") or {}
        raw_status = str(data.get("status", "")).upper()
        mapped = {"ACCEPTED": "succeeded", "REFUSED": "failed", "CANCELED": "cancelled", "CANCELLED": "cancelled"}.get(
            raw_status, "pending"
        )
        paid = Decimal(str(data["amount"])) if data.get("amount") is not None else None
        return PaymentStatus(
            status=mapped,
            amount=paid,
            currency=str(data.get("currency", "")).upper() or None,
            provider_transaction_id=data.get("operator_id") or reference,
            reason=result.get("message"),
            raw={"status": raw_status},
        )


PROVIDERS: dict[str, type] = {
    "mtn_momo": MtnMomoProvider,
    "orange_money": OrangeMoneyProvider,
    "stripe": StripeProvider,
    "flutterwave": FlutterwaveProvider,
    "cinetpay": CinetPayProvider,
}
_instances: dict[str, Any] = {}


def get_payment_provider(name: str) -> PaymentProvider:
    if name not in settings.PAYMENT_PROVIDERS:
        raise ProviderNotConfigured(name, "PAYMENT_PROVIDERS")
    if name not in PROVIDERS:
        raise ProviderNotConfigured(name, "provider inconnu")
    if name not in _instances:
        _instances[name] = PROVIDERS[name]()
    return _instances[name]


def payout_providers() -> list[str]:
    """Prestataires activés et configurés capables d'exécuter un paiement sortant (transfert)."""
    ready = {row["provider"]: row.get("payouts_configured", row["configured"]) for row in provider_configuration()}
    return [
        name
        for name in settings.PAYMENT_PROVIDERS
        if getattr(PROVIDERS.get(name), "payouts", False) and ready.get(name)
    ]


def available_payment_methods() -> list[dict[str, Any]]:
    """Moyens de paiement proposés au client : prestataires activés ET dont les clés sont configurées."""
    configured = {row["provider"]: row["configured"] for row in provider_configuration()}
    out = []
    for name in settings.PAYMENT_PROVIDERS:
        cls = PROVIDERS.get(name)
        if cls is None or not configured.get(name):
            continue
        for method in sorted(cls.methods):
            label = cls.label
            if len(cls.methods) > 1:
                label = {"card": "Carte bancaire", "mobile_money": "Mobile Money"}[method] + f" ({cls.label})"
            out.append(
                {
                    "provider": name,
                    "method": method,
                    "label": label,
                    "flow": cls.flow,
                    "requires_phone": cls.flow == "push",
                }
            )
    return out


def provider_configuration() -> list[dict[str, Any]]:
    """État de configuration par prestataire (booléens et environnement uniquement — aucune valeur secrète)."""

    def has(*names: str) -> bool:
        return all(bool(get_secret(n) or getattr(settings, n, None)) for n in names)

    stripe_key = get_secret("STRIPE_SECRET_KEY") or ""
    rows = {
        "mtn_momo": {
            "configured": has(
                "MTN_MOMO_COLLECTION_USER_ID", "MTN_MOMO_COLLECTION_API_KEY", "MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY"
            ),
            "payouts_configured": has(
                "MTN_MOMO_DISBURSEMENT_USER_ID",
                "MTN_MOMO_DISBURSEMENT_API_KEY",
                "MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY",
            ),
            "environment": settings.MTN_MOMO_TARGET_ENVIRONMENT,
        },
        "orange_money": {
            "configured": has("ORANGE_OM_AUTHORIZATION", "ORANGE_OM_MERCHANT_KEY"),
            "environment": settings.ORANGE_OM_COUNTRY,
        },
        "stripe": {
            "configured": has("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"),
            "environment": "test" if stripe_key.startswith("sk_test") else ("live" if stripe_key else None),
        },
        "flutterwave": {"configured": has("FLW_SECRET_KEY", "FLW_WEBHOOK_HASH"), "environment": None},
        "cinetpay": {
            "configured": has("CINETPAY_API_KEY", "CINETPAY_SITE_ID", "CINETPAY_SECRET_KEY"),
            "environment": None,
        },
    }
    return [
        {
            "provider": name,
            "label": cls.label,
            "enabled": name in settings.PAYMENT_PROVIDERS,
            "flow": cls.flow,
            "payouts": cls.payouts,
            **rows[name],
        }
        for name, cls in PROVIDERS.items()
    ]
