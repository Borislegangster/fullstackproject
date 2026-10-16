"""API opérateurs Mobile Money reproduites pour les tests d'intégration (MTN MoMo Open API, Orange Money Web
Payment) : mêmes chemins, en-têtes, codes et corps que les API réelles, servis par un transport httpx en mémoire.

Le code de production est exercé de bout en bout (jetons OAuth, requêtes, relecture du statut, notifications) :
seul le réseau est remplacé.
"""

from __future__ import annotations

import base64
import json
import uuid
from dataclasses import dataclass, field
from typing import Any

import httpx

MOMO_HOST = "sandbox.momodeveloper.mtn.com"
ORANGE_HOST = "api.orange.com"
INACTIVE_MSISDN = "237650000000"


@dataclass
class MomoApi:
    user_id: str
    api_key: str
    subscriptions: dict[str, str]  # produit → clé d'abonnement
    requests: dict[str, dict[str, Any]] = field(default_factory=dict)
    transfers: dict[str, dict[str, Any]] = field(default_factory=dict)
    calls: list[tuple[str, str, dict[str, str], Any]] = field(default_factory=list)

    def complete(self, reference: str, status: str = "SUCCESSFUL", *, transfer: bool = False) -> None:
        store = self.transfers if transfer else self.requests
        store[reference]["status"] = status
        if status == "SUCCESSFUL":
            store[reference]["financialTransactionId"] = str(uuid.uuid4().int)[:10]
        else:
            store[reference]["reason"] = {"code": "APPROVAL_REJECTED", "message": "Refusé par le payeur"}

    def _authorized(self, request: httpx.Request, product: str) -> bool:
        return (
            request.headers.get("Ocp-Apim-Subscription-Key") == self.subscriptions[product]
            and request.headers.get("Authorization") == f"Bearer token-{product}"
        )

    def handle(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        body = json.loads(request.content) if request.content else None
        self.calls.append((request.method, path, dict(request.headers), body))
        product = path.strip("/").split("/")[0]
        if product not in self.subscriptions:
            return httpx.Response(404)
        if request.headers.get("X-Target-Environment") != "sandbox":
            return httpx.Response(400, json={"error": "Invalid or missing X-Target-Environment header"})
        if path == f"/{product}/token/" and request.method == "POST":
            expected = "Basic " + base64.b64encode(f"{self.user_id}:{self.api_key}".encode()).decode()
            if request.headers.get("Authorization") != expected:
                return httpx.Response(401, json={"error": "login_failed"})
            return httpx.Response(
                200, json={"access_token": f"token-{product}", "token_type": "access_token", "expires_in": 3600}
            )
        if not self._authorized(request, product):
            return httpx.Response(401, json={"code": "INVALID_CREDENTIALS"})
        if path.startswith("/collection/v1_0/accountholder/msisdn/"):
            msisdn = path.split("/")[-2]
            return httpx.Response(200, json={"result": msisdn != INACTIVE_MSISDN})
        if path in ("/collection/v1_0/requesttopay", "/disbursement/v1_0/transfer") and request.method == "POST":
            reference = request.headers.get("X-Reference-Id", "")
            uuid.UUID(reference)
            store = self.requests if product == "collection" else self.transfers
            if reference in store:
                return httpx.Response(409, json={"code": "RESOURCE_ALREADY_EXIST"})
            store[reference] = {**(body or {}), "status": "PENDING"}
            return httpx.Response(202)
        for prefix, store in (
            ("/collection/v1_0/requesttopay/", self.requests),
            ("/disbursement/v1_0/transfer/", self.transfers),
        ):
            if path.startswith(prefix) and request.method == "GET":
                reference = path[len(prefix) :]
                if reference not in store:
                    return httpx.Response(404, json={"code": "RESOURCE_NOT_FOUND"})
                return httpx.Response(200, json=store[reference])
        return httpx.Response(404)


@dataclass
class OrangeApi:
    authorization: str
    merchant_key: str
    orders: dict[str, dict[str, Any]] = field(default_factory=dict)
    calls: list[tuple[str, str, Any]] = field(default_factory=list)

    def complete(self, order_id: str, status: str = "SUCCESS") -> None:
        self.orders[order_id]["status"] = status
        self.orders[order_id]["txnid"] = "MP" + str(uuid.uuid4().int)[:12]

    def handle(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        self.calls.append((request.method, path, request.content))
        if path == "/oauth/v3/token":
            if (
                request.headers.get("Authorization") != self.authorization
                or b"grant_type=client_credentials" not in request.content
            ):
                return httpx.Response(401, json={"error": "invalid_client"})
            return httpx.Response(200, json={"token_type": "Bearer", "access_token": "om-token", "expires_in": 7776000})
        if request.headers.get("Authorization") != "Bearer om-token":
            return httpx.Response(401, json={"code": 42, "message": "Expired credentials"})
        body = json.loads(request.content)
        if path == "/orange-money-webpay/dev/v1/webpayment":
            if body.get("merchant_key") != self.merchant_key or body.get("currency") != "OUV":
                return httpx.Response(400, json={"status": 400, "message": "Bad request"})
            pay_token = "pt_" + uuid.uuid4().hex
            self.orders[body["order_id"]] = {
                "amount": body["amount"],
                "pay_token": pay_token,
                "notif_token": "nt_" + uuid.uuid4().hex,
                "status": "INITIATED",
                "notif_url": body["notif_url"],
            }
            return httpx.Response(
                201,
                json={
                    "status": 201,
                    "message": "OK",
                    "pay_token": pay_token,
                    "payment_url": f"https://mpayment.orange-money.com/cm/mpayment/abstract/{pay_token}",
                    "notif_token": self.orders[body["order_id"]]["notif_token"],
                },
            )
        if path == "/orange-money-webpay/dev/v1/transactionstatus":
            order = self.orders.get(body.get("order_id"))
            if order is None or order["pay_token"] != body.get("pay_token") or order["amount"] != body.get("amount"):
                return httpx.Response(404, json={"status": 404, "message": "Transaction not found"})
            return httpx.Response(
                201,
                json={"status": order["status"], "order_id": body["order_id"], "txnid": order.get("txnid")},
            )
        return httpx.Response(404)


def transport(momo: MomoApi | None, orange: OrangeApi | None) -> httpx.MockTransport:
    def route(request: httpx.Request) -> httpx.Response:
        if momo and request.url.host == MOMO_HOST:
            return momo.handle(request)
        if orange and request.url.host == ORANGE_HOST:
            return orange.handle(request)
        return httpx.Response(503, json={"error": "hôte non servi en test"})

    return httpx.MockTransport(route)
