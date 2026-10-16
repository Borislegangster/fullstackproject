"""GED : dépôt, versions, circuit d'approbation, publication, obsolescence, ACL, comparaison,
recherche plein texte, signature OTP, suppression motivée et journal d'accès."""

from __future__ import annotations

from datetime import date
from typing import Any

from tests.conftest import as_role, login, make_user

API = "/api/v1"


def _pdf(text: str) -> bytes:
    from app.core.pdf import PdfDocument, render

    return render(
        PdfDocument(title=text, number="PLAN", issued_on=date.today(), columns=["Désignation"], rows=[[text]])
    )


def test_document_lifecycle(client: Any, db: Any) -> None:
    admin = make_user(db, roles=["ADMIN"])
    ah = login(client, admin.email)
    _tech, th = as_role(client, db, "TECHNICIEN")

    folder = client.post(f"{API}/document-folders", headers=ah, json={"name": "Plans structure"})
    assert folder.status_code == 201, folder.text
    assert folder.json()["path"] == "/Plans structure"

    created = client.post(
        f"{API}/documents",
        headers=ah,
        data={
            "title": "Plan de fondations",
            "doc_type": "plan",
            "discipline": "structure",
            "folder_id": folder.json()["id"],
        },
        files={"file": ("fondations.pdf", _pdf("Semelles filantes béton armé"), "application/pdf")},
    )
    assert created.status_code == 201, created.text
    doc = created.json()
    v1 = doc["current_version"]
    assert v1["status"] == "draft" and doc["versions"][0]["label"] == v1["label"]

    detail = client.get(f"{API}/documents/{doc['id']}", headers=ah).json()
    assert detail["folder_path"] == "/Plans structure" and detail["permissions"] == []

    # Circuit : soumission avec approbateur désigné → validation → publication
    submitted = client.post(
        f"{API}/document-versions/{v1['id']}/transition",
        headers=ah,
        json={"target": "in_review", "approvers": [{"user_id": str(admin.id)}]},
    )
    assert submitted.status_code == 200, submitted.text
    assert (
        client.post(f"{API}/document-versions/{v1['id']}/transition", headers=ah, json={"target": "validated"}).json()[
            "status"
        ]
        == "validated"
    )
    published = client.post(f"{API}/document-versions/{v1['id']}/transition", headers=ah, json={"target": "published"})
    assert published.json()["status"] == "published"
    steps = client.get(f"{API}/document-versions/{v1['id']}/approvals", headers=ah).json()
    assert [s["status"] for s in steps if s["type"] == "approval"] == ["approved"]
    invalid = client.post(f"{API}/document-versions/{v1['id']}/transition", headers=ah, json={"target": "in_review"})
    assert invalid.status_code == 422 and invalid.json()["error"]["code"] == "INVALID_TRANSITION"

    # Nouvelle version majeure : comparaison, puis la v1 devient périmée à la publication de la v2
    v2 = client.post(
        f"{API}/documents/{doc['id']}/versions",
        headers=ah,
        data={"reason": "Reprise des semelles après étude de sol", "major": "true"},
        files={"file": ("fondations-b.pdf", _pdf("Radier général béton armé"), "application/pdf")},
    )
    assert v2.status_code == 201, v2.text
    v2 = v2.json()
    diff = client.get(
        f"{API}/documents/{doc['id']}/compare", headers=ah, params={"v1": v1["id"], "v2": v2["id"]}
    ).json()
    assert diff["identical"] is False and diff["from"]["label"] == v1["label"]
    client.post(f"{API}/document-versions/{v2['id']}/transition", headers=ah, json={"target": "published"})
    status = client.get(f"{API}/document-versions/{v1['id']}/status", headers=ah).json()
    assert status["is_obsolete"] is True and status["latest_label"] == v2["label"]

    # Téléchargement tracé et recherche plein texte
    download = client.get(f"{API}/document-versions/{v2['id']}/download", headers=ah)
    assert download.status_code == 200 and download.headers["X-Document-Status"] == "published"
    log = client.get(f"{API}/documents/{doc['id']}/access-log", headers=ah).json()
    assert log and log[0]["action"] == "download"
    hits = client.get(f"{API}/documents/search", headers=ah, params={"q": "radier"}).json()
    assert any(h["id"] == doc["id"] for h in hits)

    # ACL : refus explicite pour un utilisateur, puis levée
    deny = client.post(
        f"{API}/documents/{doc['id']}/permissions",
        headers=ah,
        json={"principal_type": "user", "principal_value": str(_tech.id), "permission": "deny"},
    )
    assert deny.status_code == 201, deny.text
    assert client.get(f"{API}/documents/{doc['id']}", headers=ah).json()["permissions"][0]["permission"] == "deny"
    # Document masqué (404) plutôt qu'interdit : pas d'énumération possible
    assert client.get(f"{API}/documents/{doc['id']}", headers=th).status_code == 404
    assert client.delete(f"{API}/document-permissions/{deny.json()['id']}", headers=ah).status_code == 200

    # Signature électronique par code à usage unique
    otp = client.post(f"{API}/document-versions/{v2['id']}/sign/otp", headers=ah, json={"channel": "email"}).json()
    signed = client.post(
        f"{API}/document-versions/{v2['id']}/sign",
        headers=ah,
        json={"otp_token": otp["otp_token"], "code": otp["test_code"], "consent": True, "role": "Maître d'œuvre"},
    )
    assert signed.status_code == 200, signed.text
    assert any(
        s["type"] == "signature" for s in client.get(f"{API}/document-versions/{v2['id']}/approvals", headers=ah).json()
    )

    # Suppression logique motivée
    short = client.post(f"{API}/documents/{doc['id']}/delete", headers=ah, json={"reason": "doublon"})
    assert short.status_code == 422
    gone = client.post(f"{API}/documents/{doc['id']}/delete", headers=ah, json={"reason": "Doublon du plan PL-STR-001"})
    assert gone.status_code == 200
    assert client.get(f"{API}/documents/{doc['id']}", headers=ah).status_code == 404
