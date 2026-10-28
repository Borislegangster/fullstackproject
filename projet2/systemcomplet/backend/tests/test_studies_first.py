"""Parcours « études d'abord » : lead → opportunité → études (projet + espace client, sans devis) → livrables payants
en aperçu filigrané → facture d'études réglée → remise des originaux → devis et contrat de travaux rattachés au même
projet (budget, lots, jalons)."""

from __future__ import annotations

import io
import time
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from PIL import Image

from tests.conftest import as_role, login, make_user

API = "/api/v1"


def _pdf(text: str) -> bytes:
    from app.core.pdf import PdfDocument, render

    return render(
        PdfDocument(title=text, number="PLAN", issued_on=date.today(), columns=["Désignation"], rows=[[text]])
    )


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (400, 300), (56, 90, 166)).save(buf, format="PNG")
    return buf.getvalue()


def _publish(client: Any, ah: dict[str, str], approver_id: uuid.UUID, project_id: str, title: str, file: tuple) -> dict:
    doc = client.post(
        f"{API}/documents",
        headers=ah,
        data={"title": title, "doc_type": "plan", "project_id": project_id},
        files={"file": file},
    )
    assert doc.status_code == 201, doc.text
    doc = doc.json()
    version = doc["current_version"]["id"]
    client.post(
        f"{API}/document-versions/{version}/transition",
        headers=ah,
        json={"target": "in_review", "approvers": [{"user_id": str(approver_id)}]},
    )
    client.post(f"{API}/document-versions/{version}/transition", headers=ah, json={"target": "validated"})
    assert (
        client.post(f"{API}/document-versions/{version}/transition", headers=ah, json={"target": "published"}).json()[
            "status"
        ]
        == "published"
    )
    patched = client.patch(
        f"{API}/documents/{doc['id']}", headers=ah, json={"client_visible": True, "paid_deliverable": True}
    )
    assert patched.status_code == 200, patched.text
    return patched.json()


def test_studies_first_then_paid_deliverables_then_works_contract_on_same_project(client: Any, db: Any) -> None:
    admin = make_user(db, email=f"admin-etudes-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    _f1, fh = as_role(client, db, "FINANCE")
    _f2, fh2 = as_role(client, db, "FINANCE")

    # 1. Lead → opportunité
    email = f"paul-{uuid.uuid4().hex[:6]}@example.com"
    lead = client.post(
        f"{API}/public/describe-project",
        json={
            "universe": "HOME",
            "project_type": "construction_neuve",
            "project_location": "Douala, Bonamoussadi",
            "has_land": True,
            "land_status": "titre_foncier",
            "surface_m2": 180,
            "levels": 1,
            "budget_max": 60000000,
            "timeline": "3_months",
            "first_name": "Paul",
            "last_name": "Mballa",
            "email": email,
            "phone": "+237677000001",
            "country": "Cameroun",
            "consents": {"contact": True},
            "rendered_at": int(time.time()) - 60,
        },
    )
    assert lead.status_code == 201, lead.text
    lead_id = client.get(f"{API}/crm/leads", headers=ah, params={"q": email}).json()["items"][0]["id"]
    opp_id = client.post(f"{API}/crm/leads/{lead_id}/convert", headers=ah, json={}).json()["opportunity_id"]

    # 2. Démarrer les études : projet « Étude », client invité, sans devis
    started = client.post(f"{API}/crm/opportunities/{opp_id}/start-studies", headers=ah, json={"name": "Villa Mballa"})
    assert started.status_code == 201, started.text
    project_id = started.json()["project_id"]
    project = client.get(f"{API}/projects/{project_id}", headers=ah).json()
    assert project["status"] == "etude" and Decimal(project["contract_amount"]) == 0
    again = client.post(f"{API}/crm/opportunities/{opp_id}/start-studies", headers=ah, json={})
    assert again.json()["project_id"] == project_id  # idempotent
    from app.modules.identity.models import Invitation

    assert db.query(Invitation).filter(Invitation.email == email).count() == 1

    customer, custh = as_role(client, db, "CLIENT")
    client.post(
        f"{API}/projects/{project_id}/members",
        headers=ah,
        json={"user_id": str(customer.id), "project_role": "client", "can_view_finance": True},
    )

    # 3. Livrables d'études publiés au client : aperçu filigrané seulement
    _publish(client, ah, admin.id, project_id, "Plan RDC", ("plan.pdf", _pdf("Plan RDC"), "application/pdf"))
    _publish(client, ah, admin.id, project_id, "Rendu 3D façade", ("facade.png", _png(), "image/png"))
    docs = {d["title"]: d for d in client.get(f"{API}/client/projects/{project_id}/documents", headers=custh).json()}
    assert (
        docs["Plan RDC"]["deliverable"]["locked"] is True and docs["Rendu 3D façade"]["deliverable"]["locked"] is True
    )
    preview_pdf = client.get(docs["Plan RDC"]["url"])
    assert preview_pdf.status_code == 200 and preview_pdf.headers["content-type"].startswith("application/pdf")
    preview_img = client.get(docs["Rendu 3D façade"]["url"])
    assert preview_img.status_code == 200 and preview_img.headers["content-type"] == "image/jpeg"
    assert Image.open(io.BytesIO(preview_img.content)).size == (400, 300)  # aperçu recomprimé et filigrané

    # 4. Facture d'études, rattachement des livrables, règlement (double regard) → remise
    invoice = client.post(
        f"{API}/client-invoices",
        headers=fh,
        json={
            "project_id": project_id,
            "kind": "studies",
            "title": "Études et conception — Villa Mballa",
            "issue_date": date.today().isoformat(),
            "tax_rate": 0,
            "lines": [{"designation": "Plans, 3D et notes de calcul", "quantity": 1, "unit_price": 1500000}],
        },
    )
    assert invoice.status_code == 201, invoice.text
    invoice = invoice.json()
    client.post(f"{API}/client-invoices/{invoice['id']}/validate", headers=fh)
    linked = client.post(
        f"{API}/projects/{project_id}/deliverables/link-invoice", headers=ah, json={"invoice_id": invoice["id"]}
    )
    assert linked.status_code == 200 and linked.json()["linked"] == 2, linked.text
    summary = client.get(f"{API}/projects/{project_id}/deliverables", headers=ah).json()
    assert len(summary["items"]) == 2 and summary["invoices"][0]["kind"] == "studies"
    assert all(i["deliverable"]["locked"] for i in summary["items"])
    receipt = client.post(
        f"{API}/client-invoices/{invoice['id']}/payments",
        headers=fh,
        data={
            "method": "bank_transfer",
            "value_date": (date.today() - timedelta(days=1)).isoformat(),
            "reference": f"VIR-ETUDES-{uuid.uuid4().hex[:6]}",
        },
        files={"proof": ("avis.png", _png(), "image/png")},
    )
    assert receipt.status_code == 201, receipt.text
    assert client.get(f"{API}/client/projects/{project_id}/documents", headers=custh).json()[0]["deliverable"]["locked"]
    approved = client.post(f"{API}/payments/{receipt.json()['id']}/approve", headers=fh2)
    assert approved.status_code == 200, approved.text
    docs = {d["title"]: d for d in client.get(f"{API}/client/projects/{project_id}/documents", headers=custh).json()}
    assert docs["Plan RDC"]["deliverable"]["locked"] is False and docs["Plan RDC"]["deliverable"]["delivered_at"]
    original = client.get(docs["Rendu 3D façade"]["url"])
    assert original.status_code == 200 and original.headers["content-type"] == "image/png"  # original remis

    # 5. Devis de travaux depuis l'opportunité → rattaché au projet d'études ; contrat → même projet
    quote = client.post(
        f"{API}/crm/quotes",
        headers=ah,
        json={
            "title": "Travaux Villa Mballa",
            "opportunity_id": opp_id,
            "payment_schedule": [{"label": "Démarrage", "pct": 30}, {"label": "Gros œuvre", "pct": 70}],
            "lines": [
                {
                    "lot_code": "GO",
                    "section": "Gros œuvre",
                    "designation": "Fondations",
                    "quantity": 1,
                    "unit_price": 20000000,
                }
            ],
        },
    ).json()
    assert quote["project_id"] == project_id and quote["nature"] == "travaux"
    token = client.post(f"{API}/crm/quotes/{quote['id']}/send", headers=ah).json()["public_url"].rsplit("/", 1)[-1]
    otp = client.post(f"{API}/public/quotes/{token}/otp").json()
    accepted = client.post(
        f"{API}/public/quotes/{token}/accept",
        json={
            "full_name": "Paul Mballa",
            "otp_token": otp["otp_token"],
            "code": otp["test_code"],
            "accept_terms": True,
        },
    )
    assert accepted.status_code == 200, accepted.text
    contract = client.post(f"{API}/crm/quotes/{quote['id']}/contract", headers=ah).json()
    scan = client.post(
        f"{API}/crm/files", headers=ah, files={"file": ("contrat.pdf", b"%PDF-1.4 contrat %%EOF", "application/pdf")}
    ).json()
    signed = client.post(
        f"{API}/crm/contracts/{contract['id']}/sign",
        headers=ah,
        json={"signed_by_name": "Paul Mballa", "method": "manuscrite_scannee", "evidence_file_id": scan["file_id"]},
    )
    assert signed.status_code == 200, signed.text
    attached = client.post(f"{API}/crm/contracts/{contract['id']}/project", headers=ah, json={})
    assert attached.status_code == 201 and attached.json()["project_id"] == project_id, attached.text
    project = client.get(f"{API}/projects/{project_id}", headers=ah).json()
    assert Decimal(project["contract_amount"]) == Decimal(quote["total"]) and project["contract_id"] == contract["id"]
    lots = client.get(f"{API}/lots", headers=ah, params={"project_id": project_id}).json()
    assert [lot["code"] for lot in lots["items"]] == ["GO"]
