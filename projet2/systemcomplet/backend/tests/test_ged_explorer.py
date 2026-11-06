"""GED : arborescence de tous les projets, documents d'un dossier et de ses sous-dossiers, suppression des dossiers
vides, dossiers sans doublon (casse ignorée, double clic), mots-clés = nom du fichier, propriétés et signature de
plusieurs documents en une fois (un seul code), notification client groupée."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select

from tests.conftest import as_role, login, make_user

API = "/api/v1"


def _upload(client: Any, headers: dict[str, str], name: str, **data: Any) -> dict[str, Any]:
    res = client.post(
        f"{API}/documents",
        headers=headers,
        data={k: str(v) for k, v in {"title": name.rsplit(".", 1)[0], "doc_type": "plan", **data}.items() if v},
        files={"file": (name, f"{name} {uuid.uuid4()}".encode(), "text/plain")},
    )
    assert res.status_code == 201, res.text
    return res.json()


def _events(db: Any, event_type: str) -> list[Any]:
    from app.modules.system.models import OutboxEvent

    db.expire_all()
    return list(db.execute(select(OutboxEvent).where(OutboxEvent.event_type == event_type)).scalars())


def _admin(client: Any, db: Any) -> tuple[Any, dict[str, str]]:
    user = make_user(db, email=f"admin-gedx-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    return user, login(client, user.email)


def test_tree_of_every_project_subfolder_listing_and_empty_folder_deletion(client: Any, db: Any) -> None:
    _admin_user, ah = _admin(client, db)
    project = client.post(f"{API}/projects", headers=ah, json={"name": "Immeuble Kengni", "status": "execution"}).json()
    ids = client.post(
        f"{API}/document-folders/ensure",
        headers=ah,
        json={"project_id": project["id"], "paths": ["projetmrkengni/Structure", "Vide/Sous-vide"]},
    ).json()
    general = client.post(f"{API}/document-folders", headers=ah, json={"name": f"Modèles {uuid.uuid4().hex[:4]}"})
    assert general.status_code == 201, general.text

    # Sans filtre : dossiers généraux ET dossiers des projets, chacun avec son projet
    tree = {
        f["id"]: f for f in client.get(f"{API}/document-folders/tree", headers=ah, params={"all_projects": True}).json()
    }
    assert general.json()["id"] in tree and ids["projetmrkengni/Structure"] in tree
    assert tree[ids["projetmrkengni/Structure"]]["project"]["code"] == project["code"]
    assert tree[general.json()["id"]]["project"] is None
    # Sélecteurs de dossier des formulaires (document général) : dossiers généraux seulement
    plain = {f["id"] for f in client.get(f"{API}/document-folders/tree", headers=ah).json()}
    assert general.json()["id"] in plain and ids["projetmrkengni/Structure"] not in plain

    # Mot-clé par défaut = nom du fichier ; dossier parent : ses documents et ceux de ses sous-dossiers
    doc = _upload(client, ah, "VIDEO RDC.txt", project_id=project["id"], folder_id=ids["projetmrkengni/Structure"])
    assert doc["tags"] == ["VIDEO RDC"]
    parent_id = tree[ids["projetmrkengni/Structure"]]["parent_id"]
    direct = client.get(f"{API}/documents", headers=ah, params={"folder_id": parent_id}).json()["items"]
    deep = client.get(f"{API}/documents", headers=ah, params={"folder_id": parent_id, "recursive": True}).json()
    assert direct == [] and [d["id"] for d in deep["items"]] == [doc["id"]]

    # Suppression : refusée si un sous-dossier contient un document ; dossier vide supprimé avec ses sous-dossiers
    refused = client.delete(f"{API}/document-folders/{parent_id}", headers=ah)
    assert refused.status_code == 422 and refused.json()["error"]["code"] == "FOLDER_NOT_EMPTY"
    empty_root = tree[ids["Vide/Sous-vide"]]["parent_id"]
    removed = client.delete(f"{API}/document-folders/{empty_root}", headers=ah)
    assert removed.status_code == 200 and removed.json()["folders"] == 2
    left = {
        f["id"]
        for f in client.get(f"{API}/document-folders/tree", headers=ah, params={"project_id": project["id"]}).json()
    }
    assert ids["Vide/Sous-vide"] not in left and empty_root not in left

    # Pas de doublon : même nom à une casse près (création, renommage, import d'un dossier)
    name = general.json()["name"]
    twin = client.post(f"{API}/document-folders", headers=ah, json={"name": name.upper()})
    assert twin.status_code == 409 and twin.json()["error"]["code"] == "DUPLICATE_FOLDER"
    other = client.post(f"{API}/document-folders", headers=ah, json={"name": f"Autre {uuid.uuid4().hex[:4]}"}).json()
    clash = client.patch(f"{API}/document-folders/{other['id']}", headers=ah, json={"name": name.lower()})
    assert clash.status_code == 409, clash.text
    again = client.post(
        f"{API}/document-folders/ensure",
        headers=ah,
        json={"project_id": project["id"], "paths": ["PROJETMRKENGNI/structure"]},
    ).json()
    assert again["PROJETMRKENGNI/structure"] == ids["projetmrkengni/Structure"]


def test_bulk_properties_grouped_client_notice_and_bulk_signature(client: Any, db: Any) -> None:
    author, ah = _admin(client, db)
    _reviewer, rh = _admin(client, db)
    project = client.post(f"{API}/projects", headers=ah, json={"name": "Villa Odza", "status": "execution"}).json()
    other = client.post(f"{API}/projects", headers=ah, json={"name": "Autre projet", "status": "execution"}).json()
    elsewhere = client.post(
        f"{API}/document-folders/ensure", headers=ah, json={"project_id": other["id"], "paths": ["Ailleurs"]}
    ).json()["Ailleurs"]
    docs = [_upload(client, ah, f"Plan {i}.txt", project_id=project["id"]) for i in range(3)]
    ids = [d["id"] for d in docs]
    for target in ("in_review", "validated", "published"):  # le relecteur publie les documents de l'auteur
        res = client.post(
            f"{API}/documents/bulk-transition",
            headers=rh if target != "in_review" else ah,
            json={"document_ids": ids[:2], "target": target},
        )
        assert res.status_code == 200 and not res.json()["errors"], res.text

    # Cases cochées pour toute la sélection : un seul message au client pour les documents publiés
    before = len(_events(db, "documents.client_published"))
    bulk = client.post(
        f"{API}/documents/bulk-update",
        headers=ah,
        json={
            "document_ids": ids,
            "client_visible": True,
            "partner_visible": True,
            "paid_deliverable": True,
            "discipline": "structure",
            "add_tags": ["Lot 1"],
        },
    )
    assert bulk.status_code == 200 and len(bulk.json()["done"]) == 3 and bulk.json()["errors"] == [], bulk.text
    listed = {
        d["id"]: d
        for d in client.get(f"{API}/documents", headers=ah, params={"project_id": project["id"]}).json()["items"]
    }
    for i in ids:
        d = listed[i]
        assert d["client_visible"] and d["partner_visible"] and d["paid_deliverable"] and d["discipline"] == "structure"
        assert d["tags"][-1] == "Lot 1" and d["tags"][0].startswith("Plan ")
    grouped = _events(db, "documents.client_published")
    assert len(grouped) == before + 1 and grouped[-1].payload["count"] == 2  # le brouillon n'est pas annoncé

    # Dossier d'un autre projet : refusé document par document ; sans droit de publication : refusé
    moved = client.post(
        f"{API}/documents/bulk-update", headers=ah, json={"document_ids": ids[:1], "folder_id": elsewhere}
    )
    assert moved.json()["done"] == [] and "autre espace" in moved.json()["errors"][0]["message"]
    _site, sh = as_role(client, db, "CHEF_CHANTIER")
    denied = client.post(
        f"{API}/documents/bulk-update", headers=sh, json={"document_ids": ids, "client_visible": False}
    )
    assert denied.status_code == 403

    # Signature groupée : un seul code pour les versions publiées ; le brouillon est écarté
    otp = client.post(f"{API}/documents/bulk-sign/otp", headers=ah, json={"document_ids": ids})
    assert otp.status_code == 200, otp.text
    challenge = otp.json()
    assert {e["document_id"] for e in challenge["eligible"]} == set(ids[:2]) and challenge["skipped"][0][
        "document_id"
    ] == ids[2]
    changed = client.post(
        f"{API}/documents/bulk-sign",
        headers=ah,
        json={
            "document_ids": ids[:1],
            "otp_token": challenge["otp_token"],
            "code": challenge["test_code"],
            "consent": True,
        },
    )
    assert changed.status_code == 422 and changed.json()["error"]["code"] == "SELECTION_CHANGED"
    otp = client.post(f"{API}/documents/bulk-sign/otp", headers=ah, json={"document_ids": ids}).json()
    signed = client.post(
        f"{API}/documents/bulk-sign",
        headers=ah,
        json={
            "document_ids": ids,
            "otp_token": otp["otp_token"],
            "code": otp["test_code"],
            "consent": True,
            "role": "Gérant",
        },
    )
    assert signed.status_code == 200, signed.text
    assert {d["document_id"] for d in signed.json()["done"]} == set(ids[:2]) and len(signed.json()["skipped"]) == 1
    approvals = client.get(f"{API}/document-versions/{docs[0]['current_version']['id']}/approvals", headers=ah).json()
    signature = next(a for a in approvals if a["type"] == "signature")
    assert signature["signer_name"] == author.full_name and signature["role"] == "Gérant"
    nothing = client.post(f"{API}/documents/bulk-sign/otp", headers=ah, json={"document_ids": ids})
    assert nothing.status_code == 422 and nothing.json()["error"]["code"] == "NOTHING_TO_SIGN"
