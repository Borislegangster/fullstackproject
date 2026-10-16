"""Fichiers rattachés sans saisie d'identifiant : pièces justificatives d'une qualification (dépôt, contrôle, consultation
filigranée), étapes des photos / vidéos de chantier, fichier d'un contenu immersif limité aux fichiers du chantier."""

from __future__ import annotations

import io
import uuid
from datetime import date
from typing import Any

from PIL import Image
from pypdf import PdfReader, PdfWriter

from tests.conftest import login, make_user

API = "/api/v1"


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (16, 16), (40, 90, 160)).save(buf, format="PNG")
    return buf.getvalue()


def _pdf() -> bytes:
    from app.core.pdf import PdfDocument, render

    return render(
        PdfDocument(title="ATTESTATION", number="RC-2026", issued_on=date.today(), columns=["Objet"], rows=[["RC Pro"]])
    )


def _admin(client: Any, db: Any) -> dict[str, str]:
    admin = make_user(db, email=f"admin-files-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    return login(client, admin.email)


def _project(client: Any, ah: dict[str, str], name: str) -> dict[str, Any]:
    res = client.post(f"{API}/projects", headers=ah, json={"name": name, "city": "Douala", "status": "execution"})
    assert res.status_code == 201, res.text
    return res.json()


def test_qualification_documents_uploaded_listed_and_downloadable(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    sub = client.post(
        f"{API}/subcontractors", headers=ah, json={"legal_name": "Étanchéité Plus Sarl", "trades": ["etancheite"]}
    ).json()
    sid = sub["id"]

    up = client.post(
        f"{API}/subcontractors/{sid}/documents",
        headers=ah,
        files={"file": ("attestation-rc.pdf", _pdf(), "application/pdf")},
    )
    assert up.status_code == 201, up.text
    assert up.json()["filename"] == "attestation-rc.pdf"
    file_id = up.json()["file_id"]

    criteria = {"references": 4, "capacite": 4, "securite": 4, "finances": 3, "qualite": 4}
    q = client.post(
        f"{API}/subcontractors/{sid}/qualifications",
        headers=ah,
        json={"trade": "etancheite", "criteria": criteria, "document_file_ids": [file_id], "decision": "pending"},
    )
    assert q.status_code == 201, q.text
    assert [d["name"] for d in q.json()["documents"]] == ["attestation-rc.pdf"]

    detail = client.get(f"{API}/subcontractors/{sid}", headers=ah).json()
    qual = detail["qualifications"][0]
    assert qual["documents"][0]["id"] == file_id
    assert qual["documents"][0]["name"] == "attestation-rc.pdf"

    dl = client.get(f"{API}/subcontractors/{sid}/qualifications/{qual['id']}/documents/{file_id}", headers=ah)
    assert dl.status_code == 200, dl.text
    assert dl.headers["content-type"].startswith("application/pdf")
    assert "attestation-rc.pdf" in dl.headers["content-disposition"]

    # Un fichier non joint à la qualification, ou une qualification d'un autre sous-traitant, n'est pas servi.
    other = client.post(
        f"{API}/subcontractors/{sid}/documents", headers=ah, files={"file": ("autre.png", _png(), "image/png")}
    ).json()
    assert (
        client.get(
            f"{API}/subcontractors/{sid}/qualifications/{qual['id']}/documents/{other['file_id']}", headers=ah
        ).status_code
        == 404
    )
    foreign = client.post(f"{API}/subcontractors", headers=ah, json={"legal_name": "Autre Sarl"}).json()
    broken = client.post(
        f"{API}/subcontractors/{sid}/documents",
        headers=ah,
        files={"file": ("abime.pdf", b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n", "application/pdf")},
    )
    assert broken.status_code == 422, broken.text
    assert broken.json()["error"]["code"] == "PDF_UNREADABLE"
    writer = PdfWriter()
    writer.append(PdfReader(io.BytesIO(_pdf())))
    writer.encrypt("secret")
    locked = io.BytesIO()
    writer.write(locked)
    protected = client.post(
        f"{API}/subcontractors/{sid}/documents",
        headers=ah,
        files={"file": ("protege.pdf", locked.getvalue(), "application/pdf")},
    )
    assert protected.status_code == 422, protected.text
    assert protected.json()["error"]["code"] == "PDF_PROTECTED"
    assert (
        client.get(
            f"{API}/subcontractors/{foreign['id']}/qualifications/{qual['id']}/documents/{file_id}", headers=ah
        ).status_code
        == 404
    )


def test_qualification_rejects_files_from_other_modules(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    project = _project(client, ah, "Villa Bonapriso")
    media = client.post(
        f"{API}/projects/{project['id']}/media", headers=ah, files={"file": ("photo.png", _png(), "image/png")}
    )
    assert media.status_code == 201, media.text
    sub = client.post(f"{API}/subcontractors", headers=ah, json={"legal_name": "Peinture Pro"}).json()
    criteria = {"references": 3, "capacite": 3, "securite": 3, "finances": 3, "qualite": 3}
    for bad in (media.json()["file_id"], str(uuid.uuid4())):
        res = client.post(
            f"{API}/subcontractors/{sub['id']}/qualifications",
            headers=ah,
            json={"trade": "peinture", "criteria": criteria, "document_file_ids": [bad], "decision": "pending"},
        )
        assert res.status_code == 422, res.text
        assert res.json()["error"]["code"] == "QUALIFICATION_DOCUMENT_UNKNOWN"


def test_site_media_stages(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    project = _project(client, ah, "Immeuble Akwa")
    pid = project["id"]
    for stage in ("before", "during", "after", "inspection", "delivery", "incident"):
        res = client.post(
            f"{API}/projects/{pid}/media",
            headers=ah,
            data={"stage": stage},
            files={"file": (f"{stage}.png", _png(), "image/png")},
        )
        assert res.status_code == 201, res.text
        assert res.json()["stage"] == stage
    bad = client.post(
        f"{API}/projects/{pid}/media", headers=ah, data={"stage": "x"}, files={"file": ("x.png", _png(), "image/png")}
    )
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "INVALID_MEDIA_STAGE"

    listed = client.get(f"{API}/projects/{pid}/media", headers=ah, params={"stage": "incident"}).json()["items"]
    assert len(listed) == 1
    media_id = listed[0]["id"]
    patched = client.patch(f"{API}/site-media/{media_id}", headers=ah, json={"stage": "inspection"})
    assert patched.status_code == 200, patched.text
    assert patched.json()["stage"] == "inspection"
    refused = client.patch(f"{API}/site-media/{media_id}", headers=ah, json={"stage": "pendant"})
    assert refused.status_code == 422
    assert client.get(f"{API}/projects/{pid}/media", headers=ah, params={"stage": "inspection"}).json()["total"] == 2


def test_immersive_content_file_must_belong_to_project(client: Any, db: Any) -> None:
    ah = _admin(client, db)
    project = _project(client, ah, "Résidence Bonamoussadi")
    other = _project(client, ah, "Chantier voisin")
    pid = project["id"]
    media = client.post(
        f"{API}/projects/{pid}/media", headers=ah, files={"file": ("pano.png", _png(), "image/png")}
    ).json()
    doc = client.post(
        f"{API}/documents",
        headers=ah,
        data={"title": "Plan de masse", "doc_type": "plan", "project_id": pid},
        files={"file": ("plan.pdf", _pdf(), "application/pdf")},
    )
    assert doc.status_code == 201, doc.text
    doc_file = doc.json()["current_version"]["file_id"]
    foreign = client.post(
        f"{API}/projects/{other['id']}/media", headers=ah, files={"file": ("voisin.png", _png(), "image/png")}
    ).json()

    base = {"project_id": pid, "kind": "photo_360", "title": "Vue 360° du séjour"}
    ok_media = client.post(f"{API}/immersive-contents", headers=ah, json={**base, "file_id": media["file_id"]})
    assert ok_media.status_code == 201, ok_media.text
    assert ok_media.json()["file_id"] == media["file_id"]
    ok_doc = client.post(f"{API}/immersive-contents", headers=ah, json={**base, "file_id": doc_file})
    assert ok_doc.status_code == 201, ok_doc.text
    external = client.post(
        f"{API}/immersive-contents",
        headers=ah,
        json={**base, "kind": "virtual_tour", "external_url": "https://visite.example.com/villa"},
    )
    assert external.status_code == 201, external.text

    for bad in (foreign["file_id"], str(uuid.uuid4())):
        res = client.post(f"{API}/immersive-contents", headers=ah, json={**base, "file_id": bad})
        assert res.status_code == 422, res.text
        assert res.json()["error"]["code"] == "IMMERSIVE_FILE_NOT_IN_PROJECT"

    cid = ok_media.json()["id"]
    swap = client.patch(f"{API}/immersive-contents/{cid}", headers=ah, json={"file_id": doc_file})
    assert swap.status_code == 200, swap.text
    refused = client.patch(f"{API}/immersive-contents/{cid}", headers=ah, json={"file_id": foreign["file_id"]})
    assert refused.status_code == 422
    title_only = client.patch(f"{API}/immersive-contents/{cid}", headers=ah, json={"title": "Séjour (vue 360°)"})
    assert title_only.status_code == 200, title_only.text
