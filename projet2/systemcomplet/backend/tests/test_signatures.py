"""Signature manuscrite des documents émis, validée par code à usage unique ; cachet de l'entreprise sur tous les PDF.

Parcours couverts : devis (signature de l'entreprise, contenu modifié → signature caduque, double regard ; client par
le lien du devis = acceptation), contrat (lien personnel envoyé au client, espace client, contrat signé quand les deux
parties ont signé le même contenu), facture et reçu (entreprise), page publique de vérification, cachet remplaçable.
"""

from __future__ import annotations

import base64
import io
import uuid
from datetime import date
from typing import Any

from PIL import Image, ImageDraw
from sqlalchemy import select

from tests.conftest import as_role, login, make_user

API = "/api/v1"


def _drawing(seed: int = 0) -> str:
    """Tracé de signature tel que l'envoie le navigateur (PNG transparent en data URL)."""
    image = Image.new("RGBA", (520, 200), (0, 0, 0, 0))
    pen = ImageDraw.Draw(image)
    points = [(30 + i * 8, 100 + ((i * 37 + seed) % 70) - 35) for i in range(55)]
    pen.line(points, fill=(10, 10, 10, 255), width=6)
    pen.line([(80, 40), (140, 170), (230, 50)], fill=(10, 10, 10, 255), width=5)
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _pdf_text(data: bytes) -> str:
    from app.core.pdf import extract_text

    return extract_text(data)[0]


def _client_org(db: Any) -> tuple[Any, Any]:
    from app.modules.crm.models import Contact
    from app.modules.identity.models import Organization

    org = Organization(name=f"Famille Mballa {uuid.uuid4().hex[:4]}", kind="client")
    db.add(org)
    db.flush()
    contact = Contact(first_name="Jean", last_name="Mballa", email=f"jean.{uuid.uuid4().hex[:6]}@example.com")
    contact.organization_id = org.id
    db.add(contact)
    db.commit()
    return org, contact


def _quote(client: Any, headers: dict[str, str], org: Any = None, contact: Any = None) -> dict[str, Any]:
    body: dict[str, Any] = {
        "title": "Villa R+1 Bonamoussadi",
        "nature": "travaux",
        "lines": [{"designation": "Gros œuvre", "unit": "forfait", "quantity": 1, "unit_price": 10_000_000}],
    }
    if org is not None:
        body |= {"organization_id": str(org.id), "contact_id": str(contact.id)}
    res = client.post(f"{API}/crm/quotes", headers=headers, json=body)
    assert res.status_code == 201, res.text
    return res.json()


def _sign(client: Any, headers: dict[str, str], kind: str, entity_id: str, party: str, **extra: Any) -> Any:
    otp = client.post(f"{API}/signatures/{kind}/{entity_id}/otp", headers=headers, json={"party": party})
    assert otp.status_code == 200, otp.text
    return client.post(
        f"{API}/signatures/{kind}/{entity_id}/sign",
        headers=headers,
        json={
            "party": party,
            "image": _drawing(len(party)),
            "otp_token": otp.json()["otp_token"],
            "code": otp.json()["test_code"],
            "consent": True,
            **extra,
        },
    )


def _party(state: dict[str, Any], party: str) -> dict[str, Any]:
    return next(p for p in state["parties"] if p["party"] == party)


def _events(db: Any, event_type: str) -> list[Any]:
    from app.modules.system.models import OutboxEvent

    db.expire_all()
    return list(db.execute(select(OutboxEvent).where(OutboxEvent.event_type == event_type)).scalars())


# ------------------------------------------------------------------------------------------------ images
def test_stamp_background_removed_and_signature_normalized() -> None:
    from app.core.errors import AppError
    from app.core.stamp import decode_data_url, normalize_signature, transparent_stamp

    photo = Image.new("RGB", (400, 400), (182, 186, 180))  # papier gris d'une photo
    pen = ImageDraw.Draw(photo)
    pen.ellipse((40, 40, 360, 360), outline=(25, 99, 172), width=14)
    pen.text((150, 190), "GLOBUS", fill=(25, 99, 172))
    buf = io.BytesIO()
    photo.save(buf, format="JPEG")
    stamp = Image.open(io.BytesIO(transparent_stamp(buf.getvalue())))
    assert stamp.mode == "RGBA"
    assert stamp.getpixel((stamp.width // 2, 10))[3] > 200  # trait du cercle : encre opaque
    assert stamp.getpixel((stamp.width // 4, stamp.height // 4))[3] == 0  # papier : transparent
    assert stamp.getpixel((0, 0))[3] == 0

    sig = Image.open(io.BytesIO(normalize_signature(decode_data_url(_drawing()))))
    assert sig.mode == "RGBA" and sig.getpixel((0, 0))[3] == 0
    empty = io.BytesIO()
    Image.new("RGBA", (400, 150), (0, 0, 0, 0)).save(empty, format="PNG")
    for data in (empty.getvalue(), b"pas une image"):
        try:
            normalize_signature(data)
        except AppError as exc:
            assert exc.code in ("SIGNATURE_EMPTY", "IMAGE_INVALID")
        else:
            raise AssertionError("tracé vide accepté")


def test_every_pdf_carries_the_company_block() -> None:
    from app.core.pdf import PdfDocument

    doc = PdfDocument(title="Certificat", number="X-1")
    assert doc.blocks() == [("Pour GLOBUS ENGINEERING — la Direction", "company")]
    quote_like = PdfDocument(
        title="DEVIS",
        number="D-1",
        signature_blocks=["Pour le client — « Bon pour accord »", "Pour GLOBUS ENGINEERING"],
        signature_parties=["client", "company"],
    )
    before = quote_like.fingerprint()
    quote_like.stamp, quote_like.status_meta = "BROUILLON", [("Accepté", "le 06/11/2026")]
    assert quote_like.fingerprint() == before  # l'état ne fait pas partie du contenu signé
    quote_like.totals = [("Total TTC", "1 000 XAF")]
    assert quote_like.fingerprint() != before


# ------------------------------------------------------------------------------------------------ devis
def test_company_signs_quote_then_change_voids_it_and_double_regard(client: Any, db: Any) -> None:
    admin = make_user(db, email=f"admin-sig-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    quote = _quote(client, ah)

    state = client.get(f"{API}/signatures/quote/{quote['id']}", headers=ah).json()
    assert state["can_sign"] == ["company"] and not _party(state, "company")["signed"]
    assert client.get(f"{API}/signatures/documents", headers=ah, params={"kind": "quote"}).json()["total"] >= 1

    # Mauvais code, consentement absent : refusés
    otp = client.post(f"{API}/signatures/quote/{quote['id']}/otp", headers=ah, json={"party": "company"}).json()
    bad = client.post(
        f"{API}/signatures/quote/{quote['id']}/sign",
        headers=ah,
        json={
            "party": "company",
            "image": _drawing(),
            "otp_token": otp["otp_token"],
            "code": "000000",
            "consent": True,
        },
    )
    assert bad.status_code in (400, 401, 422) and bad.json()["error"]["code"] == "OTP_INVALID"

    signed = _sign(client, ah, "quote", quote["id"], "company", remember=True)
    assert signed.status_code == 200, signed.text
    company = _party(signed.json(), "company")
    assert company["signed"] and company["signer_name"] == admin.full_name and company["reference"].startswith("SIG-")
    pdf = client.get(f"{API}/signatures/quote/{quote['id']}/pdf", headers=ah)
    assert pdf.status_code == 200 and "Signé par" in _pdf_text(pdf.content)
    again = _sign(client, ah, "quote", quote["id"], "company")
    assert again.status_code == 409 and again.json()["error"]["code"] == "ALREADY_SIGNED"
    saved = client.get(f"{API}/signatures/me/saved", headers=ah).json()
    assert saved["saved"] and saved["image"].startswith("data:image/png;base64,")
    signed_list = client.get(f"{API}/signatures/documents", headers=ah, params={"state": "signed", "kind": "quote"})
    assert quote["id"] in [d["entity_id"] for d in signed_list.json()["items"]]

    # Le devis change (brouillon modifié) : la signature n'est plus apposée, il faut signer de nouveau
    lines = [{"designation": "Gros œuvre", "unit": "forfait", "quantity": 1, "unit_price": 12_000_000}]
    changed = client.put(
        f"{API}/crm/quotes/{quote['id']}",
        headers=ah,
        json={"title": quote["title"], "nature": "travaux", "lines": lines},
    )
    assert changed.status_code == 200, changed.text
    stale = _party(client.get(f"{API}/signatures/quote/{quote['id']}", headers=ah).json(), "company")
    assert stale["stale"] and not stale["signed"]
    assert "Signé par" not in _pdf_text(client.get(f"{API}/signatures/quote/{quote['id']}/pdf", headers=ah).content)

    # Double regard : la Direction ne signe pas au nom de l'entreprise un devis qu'elle a établi elle-même
    _director, dh = as_role(client, db, "DIRECTION")
    own = _quote(client, dh)
    refused = _sign(client, dh, "quote", own["id"], "company")
    assert refused.status_code == 422 and refused.json()["error"]["code"] == "SEGREGATION_OF_DUTIES"
    assert _sign(client, dh, "quote", quote["id"], "company").status_code == 200  # devis établi par un autre

    # Un chef de projet n'a pas le droit de signer au nom de l'entreprise
    _cp, ch = as_role(client, db, "CHEF_PROJET")
    denied = client.post(f"{API}/signatures/quote/{quote['id']}/otp", headers=ch, json={"party": "company"})
    assert denied.status_code == 403


def test_client_signs_quote_from_link_and_accepts_it(client: Any, db: Any) -> None:
    from app.modules.crm.models import Quote

    _admin, ah = as_role(client, db, "ADMIN")
    org, contact = _client_org(db)
    quote = _quote(client, ah, org, contact)
    token = client.post(f"{API}/crm/quotes/{quote['id']}/send", headers=ah).json()["public_url"].rsplit("/", 1)[-1]
    otp = client.post(f"{API}/public/quotes/{token}/otp").json()
    accepted = client.post(
        f"{API}/public/quotes/{token}/accept",
        json={
            "full_name": "Jean Mballa",
            "otp_token": otp["otp_token"],
            "code": otp["test_code"],
            "accept_terms": True,
            "signature_image": _drawing(3),
        },
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "accepted" and accepted.json()["signed"] is True
    row = db.get(Quote, uuid.UUID(quote["id"]))
    db.refresh(row)
    assert (
        row.acceptance_proof["method"] == "signature_manuscrite_otp" and row.acceptance_proof["email"] == contact.email
    )
    pdf = client.get(f"{API}/public/quotes/{token}/pdf")
    text = _pdf_text(pdf.content)
    assert "Signé par Jean Mballa" in text and "Accepté" in text

    # Page publique de vérification : signature du client listée, nom masqué
    from app.modules.documents.models import DocumentSeal

    seal = db.execute(
        select(DocumentSeal).where(DocumentSeal.kind == "quote", DocumentSeal.entity_id == row.id)
    ).scalar_one()
    signatures = client.get(f"{API}/public/verify/{seal.token}").json()["signatures"]
    assert signatures[0]["party"] == "client" and signatures[0]["signer"] == "Jean M." and signatures[0]["valid"]


# ------------------------------------------------------------------------------------------------ contrat
def test_contract_link_client_space_and_both_signatures(client: Any, db: Any) -> None:
    from app.modules.crm.models import Contract

    _admin, ah = as_role(client, db, "ADMIN")
    org, contact = _client_org(db)
    quote = _quote(client, ah, org, contact)
    token = client.post(f"{API}/crm/quotes/{quote['id']}/send", headers=ah).json()["public_url"].rsplit("/", 1)[-1]
    otp = client.post(f"{API}/public/quotes/{token}/otp").json()
    client.post(
        f"{API}/public/quotes/{token}/accept",
        json={
            "full_name": "Jean Mballa",
            "otp_token": otp["otp_token"],
            "code": otp["test_code"],
            "accept_terms": True,
        },
    )
    contract = client.post(f"{API}/crm/quotes/{quote['id']}/contract", headers=ah).json()

    # Brouillon : le client ne peut pas encore signer ; l'envoi pour signature ouvre le lien personnel
    pdf = client.get(f"{API}/signatures/contract/{contract['id']}/pdf", headers=ah)
    assert pdf.status_code == 200 and "CONTRAT DE TRAVAUX" in _pdf_text(pdf.content)
    sent = client.post(f"{API}/signatures/contract/{contract['id']}/request", headers=ah, json={})
    assert sent.status_code == 200 and sent.json()["sent_to"] == contact.email
    link = next(
        e.payload["context"]["link"]
        for e in _events(db, "notification.dispatch")
        if e.payload.get("email_template") == "signature.link"
    )
    link_token = link.rsplit("/", 1)[-1]
    state = client.get(f"{API}/public/signatures/{link_token}").json()
    assert state["reference"] == contract["number"] and state["signer_email"] == contact.email
    assert client.get(f"{API}/public/signatures/{link_token}/pdf").content.startswith(b"%PDF")

    # Espace client : le contrat est dans « Documents à signer » ; un autre client ne le voit pas
    customer = make_user(db, roles=["CLIENT"], org_id=org.id)
    cust_h = login(client, customer.email)
    mine = client.get(f"{API}/signatures/mine", headers=cust_h).json()
    assert contract["id"] in [d["entity_id"] for d in mine]
    stranger = make_user(db, roles=["CLIENT"], org_kind="client")
    other_org, _ = _client_org(db)
    stranger.organization_id = other_org.id
    db.commit()
    st_h = login(client, stranger.email)
    assert client.get(f"{API}/signatures/contract/{contract['id']}", headers=st_h).status_code == 404
    assert client.post(
        f"{API}/signatures/contract/{contract['id']}/otp", headers=st_h, json={"party": "client"}
    ).status_code in (403, 404)
    # le client ne signe pas à la place de l'entreprise
    assert (
        client.post(
            f"{API}/signatures/contract/{contract['id']}/otp", headers=cust_h, json={"party": "company"}
        ).status_code
        == 403
    )

    # Signature du client (lien personnel), puis de l'entreprise → contrat signé
    link_otp = client.post(f"{API}/public/signatures/{link_token}/otp").json()
    by_link = client.post(
        f"{API}/public/signatures/{link_token}",
        json={
            "full_name": "Jean Mballa",
            "image": _drawing(5),
            "otp_token": link_otp["otp_token"],
            "code": link_otp["test_code"],
            "consent": True,
        },
    )
    assert by_link.status_code == 200, by_link.text
    assert _party(by_link.json(), "client")["signed"]
    row = db.get(Contract, uuid.UUID(contract["id"]))
    db.refresh(row)
    assert row.status == "sent"  # l'entreprise n'a pas encore signé
    done = _sign(client, ah, "contract", contract["id"], "company")
    assert done.status_code == 200, done.text
    db.refresh(row)
    assert row.status == "signed" and row.signed_by_name == "Jean Mballa"
    assert row.signature_proof["method"] == "electronique"
    text = _pdf_text(client.get(f"{API}/signatures/contract/{contract['id']}/pdf", headers=ah).content)
    assert text.count("Signé par") == 2
    # contrat signé : visible côté client comme signé, plus signable
    mine = {d["entity_id"]: d for d in client.get(f"{API}/signatures/mine", headers=cust_h).json()}
    assert _party(mine[contract["id"]], "client")["signed"]


# ------------------------------------------------------------------------------------------------ facture, reçu, cachet
def test_invoice_signed_by_company_and_stamp_replaceable(client: Any, db: Any) -> None:
    from app.core.pdf import STAMP_SETTING
    from app.modules.billing.models import ClientInvoice
    from app.modules.documents.models import DocumentSeal
    from app.modules.system.models import Setting

    _admin, ah = as_role(client, db, "ADMIN")
    invoice = ClientInvoice(
        number=f"FAC-T-{uuid.uuid4().hex[:5]}", title="Acompte gros œuvre", status="draft", issue_date=date.today()
    )
    invoice.total, invoice.subtotal, invoice.tax_amount = 1_192_500, 1_000_000, 192_500
    db.add(invoice)
    db.commit()
    proforma = client.get(f"{API}/signatures/proforma/{invoice.id}", headers=ah).json()
    assert proforma["can_sign"] == ["company"] and _party(proforma, "company")["blocked"] is None
    blocked = _party(client.get(f"{API}/signatures/invoice/{invoice.id}", headers=ah).json(), "company")
    assert "proforma" in blocked["blocked"]
    invoice.status, invoice.authenticity_token = "validated", uuid.uuid4().hex
    db.commit()
    assert _sign(client, ah, "invoice", str(invoice.id), "company").status_code == 200
    db.refresh(invoice)
    assert invoice.pdf_file_id is not None  # PDF conservé réédité avec la signature
    seal = db.execute(
        select(DocumentSeal).where(DocumentSeal.kind == "invoice", DocumentSeal.entity_id == invoice.id)
    ).scalar_one()
    assert seal.content_hash and seal.sha256
    verified = client.get(f"{API}/public/verify/{invoice.authenticity_token}").json()  # QR propre de la facture
    assert verified["type"] == "invoice" and verified["signatures"][0]["party"] == "company"

    # Cachet remplacé par une photo (fond retiré), puis rétabli
    photo = Image.new("RGB", (300, 300), (240, 240, 236))
    ImageDraw.Draw(photo).ellipse((20, 20, 280, 280), outline=(200, 30, 40), width=12)
    buf = io.BytesIO()
    photo.save(buf, format="JPEG")
    up = client.post(
        f"{API}/signatures/stamp", headers=ah, files={"file": ("cachet.jpg", buf.getvalue(), "image/jpeg")}
    )
    assert up.status_code == 200, up.text
    assert up.json()["custom"] and up.json()["image"].startswith("data:image/png;base64,")
    assert db.get(Setting, STAMP_SETTING) is not None
    _cp, ch = as_role(client, db, "CHEF_PROJET")
    assert (
        client.post(f"{API}/signatures/stamp", headers=ch, files={"file": ("c.jpg", buf.getvalue())}).status_code == 403
    )
    reset = client.delete(f"{API}/signatures/stamp", headers=ah).json()
    assert reset["custom"] is False
