"""§26.2 — Test critique : DA → approbations → BC → WhatsApp Business → confirmation fournisseur → « livraison
attendue » → expédition → réception (preuves, géolocalisation) → stock → facture → rapprochement 3 pièces →
validation finance → paiement (séparation des tâches) → clôture. + exceptions §8.2."""

from __future__ import annotations

import io
import json
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from PIL import Image
from sqlalchemy import select

from tests.conftest import as_role, drain_outbox, login, make_user

API = "/api/v1"


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (16, 16), (56, 90, 166)).save(buf, format="PNG")
    return buf.getvalue()


def _pdf() -> bytes:
    from app.core.pdf import PdfDocument, render

    return render(
        PdfDocument(
            title="FACTURE", number="FQ-TEST", issued_on=date.today(), columns=["Désignation"], rows=[["Ciment"]]
        )
    )


def _idem() -> dict[str, str]:
    return {"Idempotency-Key": uuid.uuid4().hex}


def _setup(client: Any, db: Any) -> dict[str, Any]:
    admin = make_user(db, email=f"admin-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    chef_projet, cph = as_role(client, db, "CHEF_PROJET")
    chef_chantier, cch = as_role(client, db, "CHEF_CHANTIER")
    acheteur, ach = as_role(client, db, "ACHETEUR")
    finance, fh = as_role(client, db, "FINANCE")
    finance2, fh2 = as_role(client, db, "FINANCE")

    project = client.post(
        f"{API}/projects", headers=ah, json={"name": "Villa R+1 Bonamoussadi", "city": "Douala", "status": "execution"}
    ).json()
    site = client.post(
        f"{API}/sites",
        headers=ah,
        json={
            "project_id": project["id"],
            "code": f"CH-{uuid.uuid4().hex[:6]}",
            "name": "Chantier Bonamoussadi",
            "address": "Rue des Palmiers, Bonamoussadi, Douala",
            "city": "Douala",
            "site_manager_id": str(chef_chantier.id),
        },
    )
    assert site.status_code == 201, site.text
    for user, role in ((chef_projet, "chef_projet"), (chef_chantier, "chef_chantier")):
        r = client.post(
            f"{API}/projects/{project['id']}/members",
            headers=ah,
            json={"user_id": str(user.id), "project_role": role, "can_view_finance": role == "chef_projet"},
        )
        assert r.status_code == 201, r.text

    supplier = client.post(
        f"{API}/suppliers",
        headers=ah,
        json={
            "legal_name": "Quincaillerie du Littoral SARL",
            "city": "Douala",
            "email": "commandes@qdl.example.com",
            "whatsapp_number": "690112233",
            "whatsapp_opt_in": True,
            "preferred_channel": "whatsapp",
            "delivery_zones": ["Douala"],
            "lead_time_days": 3,
            "payment_terms_days": 30,
            "bank_account": "CM21 10005 00001 1234567890 12",
        },
    )
    assert supplier.status_code == 201, supplier.text
    supplier = supplier.json()
    assert "bank_account" not in supplier and supplier["bank_account_masked"].endswith("0 12")
    item = client.post(
        f"{API}/stock-items",
        headers=ah,
        json={
            "sku": f"CIM-{uuid.uuid4().hex[:5]}",
            "name": "Ciment CPJ 45 (sac 50 kg)",
            "unit": "sac",
            "category": "gros_oeuvre",
            "min_threshold": 20,
        },
    )
    assert item.status_code == 201, item.text
    item = item.json()
    product = client.post(
        f"{API}/supplier-products",
        headers=ah,
        json={
            "supplier_id": supplier["id"],
            "stock_item_id": item["id"],
            "reference": "CPJ45-50",
            "name": "Ciment CPJ 45 50kg",
            "unit": "sac",
            "unit_price": 6000,
            "lead_time_days": 2,
            "stock_available": 1000,
        },
    )
    assert product.status_code == 201, product.text
    warehouse = client.post(
        f"{API}/warehouses",
        headers=ah,
        json={"code": f"MAG-{uuid.uuid4().hex[:5]}", "name": "Magasin central Douala", "kind": "central"},
    )
    assert warehouse.status_code == 201, warehouse.text
    return {
        "admin": admin,
        "ah": ah,
        "chef_projet": chef_projet,
        "cph": cph,
        "chef_chantier": chef_chantier,
        "cch": cch,
        "acheteur": acheteur,
        "ach": ach,
        "finance": finance,
        "fh": fh,
        "finance2": finance2,
        "fh2": fh2,
        "project": project,
        "site": site.json(),
        "supplier": supplier,
        "item": item,
        "product": product.json(),
        "warehouse": warehouse.json(),
    }


def _approved_request(client: Any, env: dict[str, Any], quantity: int = 200) -> dict[str, Any]:
    pr = client.post(
        f"{API}/procurement/requests",
        headers=env["cch"],
        json={
            "project_id": env["project"]["id"],
            "site_id": env["site"]["id"],
            "zone": "Dalle haute R+1",
            "urgency": "urgent",
            "justification": "Coulage de la dalle haute R+1 prévu la semaine prochaine",
            "needed_by": (date.today() + timedelta(days=5)).isoformat(),
            "submit": True,
            "lines": [
                {
                    "stock_item_id": env["item"]["id"],
                    "description": "Ciment CPJ 45 (sac 50 kg)",
                    "quantity": quantity,
                    "unit": "sac",
                    "estimated_unit_price": 6000,
                }
            ],
        },
    )
    assert pr.status_code == 201, pr.text
    pr = pr.json()
    assert pr["status"] == "submitted"
    for role_header in ("cph", "ach"):  # niveaux requis selon le montant (matrice d'approbation)
        if pr["status"] != "submitted":
            break
        r = client.post(
            f"{API}/procurement/requests/{pr['id']}/decision",
            headers=env[role_header],
            json={"approve": True, "comment": "OK"},
        )
        assert r.status_code == 200, r.text
        pr = r.json()
    assert pr["status"] == "approved"
    return pr


def test_po_whatsapp_reception_three_way_match_payment(client: Any, db: Any) -> None:
    from app.modules.finance.models import Commitment
    from app.modules.notifications.models import Notification
    from app.providers.messaging import DEV_WHATSAPP_OUTBOX

    env = _setup(client, db)

    # 1. DA terrain (chef de chantier) : 200 sacs x 6 000 = 1 200 000 FCFA → 2 niveaux (CHEF_PROJET puis ACHETEUR)
    pr = client.post(
        f"{API}/procurement/requests",
        headers=env["cch"],
        json={
            "project_id": env["project"]["id"],
            "site_id": env["site"]["id"],
            "zone": "Dalle haute R+1",
            "urgency": "urgent",
            "justification": "Coulage de la dalle haute R+1 prévu la semaine prochaine",
            "lines": [
                {
                    "stock_item_id": env["item"]["id"],
                    "description": "Ciment CPJ 45 (sac 50 kg)",
                    "quantity": 200,
                    "unit": "sac",
                    "estimated_unit_price": 6000,
                }
            ],
            "submit": True,
        },
    ).json()
    assert pr["status"] == "submitted" and Decimal(pr["total_estimated"]) == Decimal("1200000")
    assert [(a["level"], a["approver_role"]) for a in pr["approvals"]] == [(1, "CHEF_PROJET"), (2, "ACHETEUR")]
    drain_outbox()
    notified = (
        db.execute(
            select(Notification).where(
                Notification.user_id == env["chef_projet"].id, Notification.event_type == "purchase_request.submitted"
            )
        )
        .scalars()
        .all()
    )
    assert notified, "le chef de projet doit être notifié de la DA à approuver"

    # L'acheteur ne peut pas court-circuiter le niveau 1
    early = client.post(f"{API}/procurement/requests/{pr['id']}/decision", headers=env["ach"], json={"approve": True})
    assert early.status_code == 403 and early.json()["error"]["code"] == "APPROVAL_ROLE_REQUIRED"
    assert (
        client.post(
            f"{API}/procurement/requests/{pr['id']}/decision", headers=env["cph"], json={"approve": True}
        ).json()["status"]
        == "submitted"
    )
    pending = client.get(f"{API}/procurement/approvals/pending", headers=env["ach"]).json()
    assert any(p["request"]["id"] == pr["id"] for p in pending)
    assert (
        client.post(
            f"{API}/procurement/requests/{pr['id']}/decision", headers=env["ach"], json={"approve": True}
        ).json()["status"]
        == "approved"
    )

    # 2. Sélection fournisseur scorée puis BC + envoi WhatsApp Business (modèle approuvé, PDF en en-tête)
    ranking = client.get(f"{API}/procurement/requests/{pr['id']}/suppliers", headers=env["ach"]).json()
    assert ranking[0]["supplier_id"] == env["supplier"]["id"] and ranking[0]["whatsapp"] is True
    no_key = client.post(
        f"{API}/procurement/requests/{pr['id']}/order",
        headers=env["ach"],
        json={"supplier_id": env["supplier"]["id"], "send": True},
    )
    assert no_key.status_code == 400 and no_key.json()["error"]["code"] == "IDEMPOTENCY_KEY_REQUIRED"
    key = _idem()
    order = client.post(
        f"{API}/procurement/requests/{pr['id']}/order",
        headers={**env["ach"], **key},
        json={"supplier_id": env["supplier"]["id"], "send": True},
    )
    assert order.status_code == 201, order.text
    po = order.json()
    replay = client.post(
        f"{API}/procurement/requests/{pr['id']}/order",
        headers={**env["ach"], **key},
        json={"supplier_id": env["supplier"]["id"], "send": True},
    )
    assert replay.status_code == 201 and replay.json()["id"] == po["id"], "rejeu idempotent : pas de second BC"
    assert po["status"] == "sent" and po["sent"]["channel"] == "whatsapp"
    assert Decimal(po["total"]) == Decimal("1431000.00")  # 1 200 000 + TVA 19,25 %
    message = next(m for m in reversed(DEV_WHATSAPP_OUTBOX) if po["number"] in m["content"].get("params", []))
    assert message["kind"] == "template" and message["to"].endswith("690112233")
    assert message["content"]["document"]["filename"] == f"{po['number']}.pdf"
    assert message["content"]["buttons"] == [f"PO_CONFIRM:{po['number']}", f"PO_REFUSE:{po['number']}"]
    token = message["content"]["url_suffix"]
    portal = client.get(f"{API}/public/supplier-portal/{token}")
    assert portal.status_code == 200 and portal.json()["actions"]["respond"] is True
    assert client.get(f"{API}/public/supplier-portal/{token}/pdf").content[:4] == b"%PDF"

    # 3. Confirmation par réponse rapide WhatsApp (webhook Meta) → engagement budgétaire + « livraison attendue »
    webhook = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "messages": [
                                {
                                    "id": f"wamid.{uuid.uuid4().hex}",
                                    "from": "237690112233",
                                    "type": "button",
                                    "button": {"text": "Confirmer", "payload": f"PO_CONFIRM:{po['number']}"},
                                }
                            ]
                        }
                    }
                ]
            }
        ]
    }
    r = client.post(
        f"{API}/webhooks/whatsapp", content=json.dumps(webhook), headers={"Content-Type": "application/json"}
    )
    assert r.status_code == 200 and r.json()["processed"] == 1
    again = client.post(
        f"{API}/webhooks/whatsapp", content=json.dumps(webhook), headers={"Content-Type": "application/json"}
    )
    assert again.json()["processed"] == 0, "webhook rejoué : ignoré"
    po = client.get(f"{API}/procurement/orders/{po['id']}", headers=env["ach"]).json()
    assert po["status"] == "confirmed" and po["supplier_confirmed_at"]
    assert any(m["direction"] == "in" and m["channel"] == "whatsapp" for m in po["messages"])
    commitment = db.execute(
        select(Commitment).where(
            Commitment.source_type == "purchase_order", Commitment.source_id == uuid.UUID(po["id"])
        )
    ).scalar_one()
    assert commitment.amount == Decimal("1200000.00")
    drain_outbox()
    expected = (
        db.execute(
            select(Notification).where(
                Notification.user_id == env["chef_chantier"].id, Notification.event_type == "purchase_order.confirmed"
            )
        )
        .scalars()
        .all()
    )
    assert expected and expected[0].title.startswith("Livraison attendue")

    # 4. Expédition annoncée par le fournisseur (portail sécurisé) → visible côté chantier
    eta = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    shipped = client.post(
        f"{API}/public/supplier-portal/{token}/shipment",
        json={
            "eta": eta,
            "carrier": "Transports Express",
            "vehicle_plate": "LT 123 AB",
            "driver_name": "Paul",
            "delivery_note_ref": "BL-778",
        },
    )
    assert shipped.status_code == 201, shipped.text
    expected_list = client.get(f"{API}/deliveries/expected", headers=env["cch"]).json()
    assert any(d["number"] == po["number"] and d["status"] == "shipped" for d in expected_list)

    # 5. Réception par QR : preuve obligatoire, géolocalisation, GRN, entrée en stock au CMUP
    lookup = client.get(
        f"{API}/goods-receipts/lookup", params={"code": f"GLOBUS:PO:{po['number']}"}, headers=env["cch"]
    )
    assert lookup.status_code == 200
    line = lookup.json()["remaining"][0]
    assert Decimal(line["remaining"]) == Decimal("200")
    grn = client.post(
        f"{API}/goods-receipts",
        headers=env["cch"],
        json={
            "purchase_order_id": po["id"],
            "destination": "stock",
            "warehouse_id": env["warehouse"]["id"],
            "latitude": 4.0511,
            "longitude": 9.7679,
            "geo_accuracy_m": 8,
            "driver_name": "Paul",
            "vehicle_plate": "LT 123 AB",
            "delivery_note_ref": "BL-778",
            "source": "mobile",
            "lines": [{"po_line_id": line["po_line_id"], "quantity_received": 200, "batch_number": "LOT-2026-10"}],
        },
    )
    assert grn.status_code == 201, grn.text
    grn = grn.json()
    assert grn["has_exceptions"] is False and grn["status"] == "draft"
    no_proof = client.post(f"{API}/goods-receipts/{grn['id']}/validate", headers=env["cch"])
    assert no_proof.status_code == 422 and no_proof.json()["error"]["code"] == "PROOF_REQUIRED"
    photo = client.post(
        f"{API}/goods-receipts/{grn['id']}/attachments",
        headers=env["cch"],
        data={"kind": "photo", "latitude": "4.0511", "longitude": "9.7679"},
        files={"file": ("livraison.png", _png(), "image/png")},
    )
    assert photo.status_code == 201, photo.text
    assert photo.json()["geo"] == {"lat": 4.0511, "lng": 9.7679}
    validated = client.post(f"{API}/goods-receipts/{grn['id']}/validate", headers=env["cch"])
    assert validated.status_code == 200, validated.text
    po = client.get(f"{API}/procurement/orders/{po['id']}", headers=env["ach"]).json()
    assert po["status"] == "received"
    levels = client.get(f"{API}/stock-items/{env['item']['id']}/levels", headers=env["ach"]).json()
    assert Decimal(levels["on_hand"]) == Decimal("200") and Decimal(levels["item"]["average_cost"]) == Decimal("6000")
    assert levels["levels"][0]["batch"] == "LOT-2026-10"

    # 6. Facture déposée par le fournisseur → rapprochement 3 pièces automatique (BC / GRN / facture)
    invoice = client.post(
        f"{API}/public/supplier-portal/{token}/invoice",
        data={
            "supplier_reference": "FQ-2026-1501",
            "invoice_date": date.today().isoformat(),
            "tax_amount": "231000",
            "lines_json": json.dumps([{"po_line_id": line["po_line_id"], "quantity": 200, "unit_price": 6000}]),
        },
        files={"file": ("facture.pdf", _pdf(), "application/pdf")},
    )
    assert invoice.status_code == 201, invoice.text
    invoices = client.get(f"{API}/supplier-invoices", headers=env["fh"], params={"supplier_id": env["supplier"]["id"]})
    inv = invoices.json()["items"][0]
    detail = client.get(f"{API}/supplier-invoices/{inv['id']}", headers=env["fh"]).json()
    assert detail["status"] == "matched" and detail["match"]["result"] == "matched", detail
    # Tout le reçu est facturé : le portail ne propose plus de facture.
    assert client.get(f"{API}/public/supplier-portal/{token}").json()["actions"]["invoice"] is False
    duplicate = client.post(
        f"{API}/public/supplier-portal/{token}/invoice",
        data={
            "supplier_reference": "FQ-2026-1501",
            "invoice_date": date.today().isoformat(),
            "lines_json": json.dumps([{"po_line_id": line["po_line_id"], "quantity": 1, "unit_price": 6000}]),
        },
        files={"file": ("facture.pdf", _pdf(), "application/pdf")},
    )
    assert duplicate.status_code in (409, 422), "doublon de facture refusé"

    # 7. Validation finance → paiement : initiateur ≠ approbateur, preuve obligatoire
    ok = client.post(f"{API}/supplier-invoices/{inv['id']}/validate", headers=env["fh"])
    assert ok.status_code == 200 and ok.json()["status"] == "approved_for_payment"
    db.refresh(commitment)
    assert commitment.status == "closed", "marchandise en stock : engagement soldé sans double imputation projet"
    payment = client.post(
        f"{API}/payments/outgoing",
        headers={**env["fh"], **_idem()},
        json={"target_type": "supplier_invoice", "target_id": inv["id"], "method": "bank_transfer"},
    )
    assert payment.status_code == 201, payment.text
    payment = payment.json()
    assert payment["status"] == "awaiting_approval" and Decimal(payment["amount"]) == Decimal("1431000.00")
    self_approve = client.post(f"{API}/payments/{payment['id']}/approve", headers=env["fh"])
    assert self_approve.status_code == 422 and self_approve.json()["error"]["code"] == "SEGREGATION_OF_DUTIES"
    assert client.post(f"{API}/payments/{payment['id']}/approve", headers=env["fh2"]).json()["status"] == "pending"
    no_proof_pay = client.post(
        f"{API}/payments/{payment['id']}/execute", headers=env["fh"], data={"bank_reference": "VIR-889900"}
    )
    assert no_proof_pay.status_code == 422 and no_proof_pay.json()["error"]["code"] == "PROOF_REQUIRED"
    executed = client.post(
        f"{API}/payments/{payment['id']}/execute",
        headers=env["fh"],
        data={"bank_reference": "VIR-889900"},
        files={"proof": ("ordre-virement.pdf", _pdf(), "application/pdf")},
    )
    assert executed.status_code == 200, executed.text
    assert executed.json()["status"] == "succeeded" and executed.json()["receipt_file_id"]
    pay_detail = client.get(f"{API}/payments/{payment['id']}", headers=env["fh"])
    assert pay_detail.status_code == 200, pay_detail.text
    pay_detail = pay_detail.json()
    assert pay_detail["status"] == "succeeded" and "idempotency_key" not in pay_detail
    assert pay_detail["allocations"][0]["link"] == f"/erp/facturation/fournisseurs/{inv['id']}"
    assert pay_detail["allocations"][0]["label"].startswith(inv["number"])
    receipts_of_supplier = client.get(
        f"{API}/goods-receipts", headers=env["cch"], params={"supplier_id": env["supplier"]["id"]}
    ).json()
    assert receipts_of_supplier["total"] >= 1
    assert all(r["supplier_id"] == env["supplier"]["id"] for r in receipts_of_supplier["items"])

    # 8. Clôture : facture soldée, BC clos, KPI fournisseur recalculés, portail fournisseur à jour
    detail = client.get(f"{API}/supplier-invoices/{inv['id']}", headers=env["fh"]).json()
    assert detail["status"] == "paid"
    assert [p["number"] for p in detail["payments"]] == [payment["number"]]
    assert Decimal(detail["payments"][0]["allocated"]) == Decimal("1431000.00")
    po = client.get(f"{API}/procurement/orders/{po['id']}", headers=env["ach"]).json()
    assert po["status"] == "closed"
    scorecard = client.get(f"{API}/suppliers/{env['supplier']['id']}/scorecard", headers=env["ach"]).json()
    assert Decimal(str(scorecard["kpis"]["service_rate"])) == Decimal("100")
    assert client.get(f"{API}/public/supplier-portal/{token}").json()["invoices"][0]["status"] == "paid"
    kpis = client.get(f"{API}/procurement/kpis", headers=env["ach"]).json()
    assert kpis["orders_by_status"].get("closed") == 1


def test_procurement_exceptions(client: Any, db: Any) -> None:
    from app.modules.suppliers.models import SupplierIncident
    from app.modules.system.models import ActionItem

    env = _setup(client, db)

    # Séparation des tâches : un chef de projet ne valide pas sa propre DA
    own = client.post(
        f"{API}/procurement/requests",
        headers=env["cph"],
        json={
            "project_id": env["project"]["id"],
            "justification": "Petit outillage pour l'équipe coffrage",
            "lines": [{"description": "Marteaux de coffreur", "quantity": 5, "estimated_unit_price": 4500}],
            "submit": True,
        },
    )
    assert own.status_code == 201, own.text
    refused = client.post(
        f"{API}/procurement/requests/{own.json()['id']}/decision", headers=env["cph"], json={"approve": True}
    )
    assert refused.status_code == 422 and refused.json()["error"]["code"] == "SEGREGATION_OF_DUTIES"

    # Refus fournisseur via le portail (motif obligatoire)
    pr = _approved_request(client, env, quantity=100)
    po = client.post(
        f"{API}/procurement/requests/{pr['id']}/order",
        headers={**env["ach"], **_idem()},
        json={"supplier_id": env["supplier"]["id"], "send": True, "channel": "email"},
    ).json()
    assert po["sent"]["channel"] == "email"
    token = po["sent"]["portal_url"].rsplit("/", 1)[1]
    assert client.post(f"{API}/public/supplier-portal/{token}/respond", json={"action": "refuse"}).status_code == 422

    # Contre-offre (prix + date) acceptée par l'acheteur → BC recalculé puis confirmé
    line_id = po["lines"][0]["id"]
    counter = client.post(
        f"{API}/public/supplier-portal/{token}/respond",
        json={
            "action": "counter",
            "note": "Hausse cimenterie",
            "counter": {
                "lines": [{"line_id": line_id, "unit_price": 6100}],
                "expected_date": (date.today() + timedelta(days=4)).isoformat(),
            },
        },
    )
    assert counter.status_code == 200 and counter.json()["status"] == "countered"
    accepted = client.post(f"{API}/procurement/orders/{po['id']}/accept-counter", headers=env["ach"]).json()
    assert accepted["status"] == "confirmed" and Decimal(accepted["subtotal"]) == Decimal("610000.00")

    # Réception partielle avec casse → écarts, incident fournisseur, retour
    grn = client.post(
        f"{API}/goods-receipts",
        headers=env["cch"],
        json={
            "purchase_order_id": po["id"],
            "destination": "site_allocation",
            "lines": [
                {
                    "po_line_id": line_id,
                    "quantity_received": 90,
                    "quantity_rejected": 5,
                    "rejection_reason": "damaged",
                    "condition_notes": "5 sacs éventrés",
                }
            ],
        },
    ).json()
    assert grn["has_exceptions"] is True
    types = {e["type"] for e in grn["exceptions"]}
    assert {"damaged", "partial_delivery"} <= types
    client.post(
        f"{API}/goods-receipts/{grn['id']}/attachments",
        headers=env["cch"],
        data={"kind": "photo"},
        files={"file": ("casse.png", _png(), "image/png")},
    )
    assert client.post(f"{API}/goods-receipts/{grn['id']}/validate", headers=env["cch"]).status_code == 200
    po_after = client.get(f"{API}/procurement/orders/{po['id']}", headers=env["ach"]).json()
    assert po_after["status"] == "partially_received"
    assert Decimal(po_after["lines"][0]["quantity_accepted"]) == Decimal("85")
    incidents = (
        db.execute(select(SupplierIncident).where(SupplierIncident.supplier_id == uuid.UUID(env["supplier"]["id"])))
        .scalars()
        .all()
    )
    assert {i.kind for i in incidents} >= {"damaged", "missing"}
    ret = client.post(f"{API}/goods-receipts/{grn['id']}/returns", headers=env["cch"], json={"reason": "damaged"})
    assert ret.status_code == 201 and Decimal(ret.json()["amount"]) == Decimal("30500.00")

    # Facture au-dessus des quantités acceptées et du prix → anomalie → tâche finance, validation bloquée
    inv = client.post(
        f"{API}/supplier-invoices",
        headers=env["fh"],
        json={
            "supplier_id": env["supplier"]["id"],
            "supplier_reference": "FQ-2026-1600",
            "purchase_order_id": po["id"],
            "invoice_date": date.today().isoformat(),
            "tax_amount": 0,
            "lines": [{"po_line_id": line_id, "description": "Ciment", "quantity": 90, "unit_price": 6500}],
        },
    )
    assert inv.status_code == 201, inv.text
    inv = inv.json()
    assert inv["status"] == "exception"
    assert {e["type"] for e in inv["match"]["exceptions"]} >= {"qty_variance", "price_variance"}
    assert db.execute(
        select(ActionItem).where(ActionItem.entity_id == inv["id"], ActionItem.assignee_role == "FINANCE")
    ).scalar_one()
    blocked = client.post(f"{API}/supplier-invoices/{inv['id']}/validate", headers=env["fh"])
    assert blocked.status_code == 422 and blocked.json()["error"]["code"] == "MATCH_REQUIRED"
    pay_blocked = client.post(
        f"{API}/payments/outgoing",
        headers={**env["fh"], **_idem()},
        json={"target_type": "supplier_invoice", "target_id": inv["id"]},
    )
    assert pay_blocked.status_code == 422 and pay_blocked.json()["error"]["code"] == "NOT_APPROVED"
    rejected = client.post(
        f"{API}/supplier-invoices/{inv['id']}/resolve",
        headers=env["fh"],
        json={"decision": "reject", "justification": "Quantité et prix non conformes au BC"},
    )
    assert rejected.json()["status"] == "rejected"

    # Livraison sans bon de commande : exception tracée
    orphan = client.post(
        f"{API}/goods-receipts",
        headers=env["cch"],
        json={
            "project_id": env["project"]["id"],
            "supplier_id": env["supplier"]["id"],
            "destination": "site_allocation",
            "lines": [{"description": "Fers HA 12 non commandés", "quantity_received": 10, "unit": "barre"}],
        },
    ).json()
    assert {e["type"] for e in orphan["exceptions"]} == {"delivery_without_po"}

    # Signature WhatsApp exigée hors console de développement
    from app.core.config import settings

    original = settings.WHATSAPP_PROVIDER
    settings.WHATSAPP_PROVIDER = "meta"
    try:
        forged = client.post(f"{API}/webhooks/whatsapp", content=b"{}", headers={"X-Hub-Signature-256": "sha256=00"})
        assert forged.status_code == 401
    finally:
        settings.WHATSAPP_PROVIDER = original


def test_supplier_extranet_scoping(client: Any, db: Any) -> None:
    from app.modules.identity.models import Organization
    from app.modules.suppliers.models import Supplier

    env = _setup(client, db)
    org = Organization(name="Quincaillerie du Littoral SARL", kind="supplier")
    other_org = Organization(name="Autre fournisseur", kind="supplier")
    db.add_all([org, other_org])
    db.flush()
    supplier = db.get(Supplier, uuid.UUID(env["supplier"]["id"]))
    supplier.organization_id = org.id
    db.commit()
    _, sh = as_role(client, db, "FOURNISSEUR", org_id=org.id)
    _, other = as_role(client, db, "FOURNISSEUR", org_id=other_org.id)

    pr = _approved_request(client, env, quantity=50)
    po = client.post(
        f"{API}/procurement/requests/{pr['id']}/order",
        headers={**env["ach"], **_idem()},
        json={"supplier_id": env["supplier"]["id"], "send": True},
    ).json()
    mine = client.get(f"{API}/extranet/supplier/orders", headers=sh).json()
    assert [o["number"] for o in mine["items"]] == [po["number"]]
    assert client.get(f"{API}/extranet/supplier/orders/{po['id']}", headers=other).status_code == 403
    assert client.get(f"{API}/procurement/orders/{po['id']}", headers=sh).status_code == 403
    confirmed = client.post(
        f"{API}/extranet/supplier/orders/{po['id']}/respond",
        headers=sh,
        json={"action": "confirm", "note": "Livraison jeudi"},
    )
    assert confirmed.status_code == 200 and confirmed.json()["status"] == "confirmed"
    profile = client.get(f"{API}/extranet/supplier/profile", headers=sh).json()
    assert "bank_account" not in profile and "notes" not in profile
    card = client.get(f"{API}/extranet/supplier/scorecard", headers=sh)
    assert card.status_code == 200 and set(card.json()) >= {"quality_score", "service_rate", "on_time_rate"}
    uploaded = client.post(
        f"{API}/extranet/supplier/documents",
        headers=sh,
        data={"kind": "attestation", "title": "Attestation de non-redevance", "valid_until": "2027-06-30"},
        files={"file": ("attestation.pdf", _pdf(), "application/pdf")},
    )
    assert uploaded.status_code == 201, uploaded.text
    own = client.get(f"{API}/extranet/supplier/documents/{uploaded.json()['id']}/file", headers=sh)
    assert own.status_code == 200 and own.content.startswith(b"%PDF")
    assert client.get(f"{API}/extranet/supplier/documents/{uploaded.json()['id']}/file", headers=other).status_code in (
        403,
        404,
    )
