"""GED : import multiple / dossier entier, doublons refusés, dossiers (arborescence, cohérence projet, suppression),
emplacement affiché sur chaque document, actions groupées (revue, validation) sous double regard."""

from __future__ import annotations

import hashlib
import uuid
from typing import Any

from tests.conftest import as_role, login, make_user

API = "/api/v1"


def _upload(client: Any, headers: dict[str, str], name: str, content: bytes, **data: Any) -> Any:
    form = {"title": name.rsplit(".", 1)[0], "doc_type": "plan", "tags": name.rsplit(".", 1)[0], **data}
    return client.post(
        f"{API}/documents",
        headers=headers,
        data={k: str(v) for k, v in form.items() if v is not None},
        files={"file": (name, content, "text/plain")},
    )


def _project(client: Any, ah: dict[str, str], name: str) -> dict[str, Any]:
    return client.post(f"{API}/projects", headers=ah, json={"name": name, "status": "execution"}).json()


def test_folder_import_duplicates_and_location(client: Any, db: Any) -> None:
    admin = make_user(db, email=f"admin-ged-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    project = _project(client, ah, "Immeuble R+2 Bonamoussadi")
    other = _project(client, ah, "Villa Odza")

    # Import d'un dossier : les sous-dossiers sont recréés (et retrouvés au second passage)
    paths = ["Plans/Structure", "Plans/Architecture", "PV"]
    ensured = client.post(
        f"{API}/document-folders/ensure", headers=ah, json={"project_id": project["id"], "paths": paths}
    )
    assert ensured.status_code == 200, ensured.text
    ids = ensured.json()
    again = client.post(
        f"{API}/document-folders/ensure", headers=ah, json={"project_id": project["id"], "paths": paths}
    ).json()
    assert again == ids and len(set(ids.values())) == 3

    content = b"Plan de fondations - semelles filantes"
    first = _upload(
        client, ah, "PL-STR-001 Fondations.txt", content, project_id=project["id"], folder_id=ids["Plans/Structure"]
    )
    assert first.status_code == 201, first.text
    doc = first.json()
    assert doc["tags"] == ["PL-STR-001 Fondations"]
    assert doc["folder_path"] == "/Plans/Structure" and doc["project"]["name"] == "Immeuble R+2 Bonamoussadi"

    # Même fichier (même contenu, autre nom) dans le même projet : refusé, avec l'emplacement de l'original
    dup = _upload(client, ah, "copie.txt", content, project_id=project["id"], folder_id=ids["PV"])
    assert dup.status_code == 409, dup.text
    assert dup.json()["error"]["code"] == "DUPLICATE_DOCUMENT"
    assert doc["code"] in dup.json()["error"]["message"] and "/Plans/Structure" in dup.json()["error"]["message"]
    # … mais accepté sur un autre projet
    assert _upload(client, ah, "copie.txt", content, project_id=other["id"]).status_code == 201

    # Pré-contrôle avant import : empreintes déjà présentes
    sha = hashlib.sha256(content).hexdigest()
    check = client.post(
        f"{API}/documents/check-duplicates",
        headers=ah,
        json={"project_id": project["id"], "checksums": [sha, "0" * 64]},
    ).json()
    assert [c["code"] for c in check] == [doc["code"]]

    # Dossier d'un autre projet refusé
    wrong = _upload(client, ah, "autre.txt", b"autre contenu", project_id=other["id"], folder_id=ids["PV"])
    assert wrong.status_code == 422 and wrong.json()["error"]["code"] == "FOLDER_PROJECT_MISMATCH"
    moved = client.patch(f"{API}/documents/{doc['id']}", headers=ah, json={"folder_id": ids["PV"]})
    assert moved.status_code == 200 and moved.json()["folder_path"] == "/PV"
    general = client.post(f"{API}/document-folders", headers=ah, json={"name": "Modèles"}).json()
    cross = client.patch(f"{API}/documents/{doc['id']}", headers=ah, json={"folder_id": general["id"]})
    assert cross.status_code == 422 and cross.json()["error"]["code"] == "FOLDER_PROJECT_MISMATCH"
    client.patch(f"{API}/documents/{doc['id']}", headers=ah, json={"folder_id": ids["Plans/Structure"]})

    # Arborescence complète avec le nombre de documents ; liste avec projet + dossier
    tree = client.get(f"{API}/document-folders/tree", headers=ah, params={"project_id": project["id"]}).json()
    by_path = {f["path"]: f for f in tree}
    assert set(by_path) == {"/Plans", "/Plans/Structure", "/Plans/Architecture", "/PV"}
    assert by_path["/Plans/Structure"]["documents"] == 1 and by_path["/PV"]["documents"] == 0
    listed = client.get(f"{API}/documents", headers=ah, params={"q": "PL-STR-001"}).json()["items"]
    assert listed[0]["folder_path"] == "/Plans/Structure" and listed[0]["project"]["id"] == project["id"]

    # Dossiers : nom en double refusé, dossier non vide non supprimable, renommage → chemins mis à jour
    twin = client.post(f"{API}/document-folders", headers=ah, json={"name": "PV", "project_id": project["id"]})
    assert twin.status_code == 409, twin.text
    not_empty = client.delete(f"{API}/document-folders/{ids['Plans/Structure']}", headers=ah)
    assert not_empty.status_code == 422 and not_empty.json()["error"]["code"] == "FOLDER_NOT_EMPTY"
    renamed = client.patch(f"{API}/document-folders/{by_path['/Plans']['id']}", headers=ah, json={"name": "Plans EXE"})
    assert renamed.status_code == 200 and renamed.json()["path"] == "/Plans EXE"
    tree = {
        f["id"]: f["path"]
        for f in client.get(f"{API}/document-folders/tree", headers=ah, params={"project_id": project["id"]}).json()
    }
    assert tree[ids["Plans/Structure"]] == "/Plans EXE/Structure"
    assert client.delete(f"{API}/document-folders/{ids['PV']}", headers=ah).status_code == 200


def test_bulk_review_and_validation_follow_double_regard(client: Any, db: Any) -> None:
    _author, auth_h = as_role(client, db, "CHEF_PROJET")
    _reviewer, rev_h = as_role(client, db, "CHEF_PROJET")
    docs = []
    for i in range(3):
        res = _upload(client, auth_h, f"note-{i}.txt", f"note de calcul {i} {uuid.uuid4()}".encode())
        assert res.status_code == 201, res.text
        docs.append(res.json())
    ids = [d["id"] for d in docs]

    submitted = client.post(
        f"{API}/documents/bulk-transition", headers=auth_h, json={"document_ids": ids, "target": "in_review"}
    )
    assert submitted.status_code == 200, submitted.text
    assert len(submitted.json()["done"]) == 3 and submitted.json()["errors"] == []

    # L'auteur ne valide pas ses propres documents (double regard) …
    own = client.post(
        f"{API}/documents/bulk-transition", headers=auth_h, json={"document_ids": ids, "target": "validated"}
    ).json()
    assert own["done"] == [] and len(own["errors"]) == 3
    assert "Double regard" in own["errors"][0]["message"]

    # … un autre membre, oui ; un statut incompatible est signalé sans bloquer les autres
    client.post(
        f"{API}/documents/bulk-transition", headers=rev_h, json={"document_ids": ids[:1], "target": "validated"}
    )
    mixed = client.post(
        f"{API}/documents/bulk-transition", headers=rev_h, json={"document_ids": ids, "target": "validated"}
    ).json()
    assert [d["document_id"] for d in mixed["done"]] == ids[1:]
    assert [e["document_id"] for e in mixed["errors"]] == ids[:1]
    statuses = {
        d["id"]: d["current_version"]["status"]
        for d in client.get(f"{API}/documents", headers=rev_h, params={"page_size": 50}).json()["items"]
    }
    assert all(statuses[i] == "validated" for i in ids)

    # Publication directe d'un brouillon par son auteur : refusée aussi
    draft = _upload(client, auth_h, "brouillon.txt", f"brouillon {uuid.uuid4()}".encode()).json()
    direct = client.post(
        f"{API}/document-versions/{draft['current_version']['id']}/transition",
        headers=auth_h,
        json={"target": "published"},
    )
    assert direct.status_code == 422 and direct.json()["error"]["code"] == "SEGREGATION_OF_DUTIES"


def test_duplicates_and_folder_counts_hide_unreadable_documents(client: Any, db: Any) -> None:
    admin = make_user(db, email=f"admin-ged-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    _site, sh = as_role(client, db, "CHEF_CHANTIER")  # écriture GED, sans accès aux documents confidentiels
    folder = client.post(f"{API}/document-folders", headers=ah, json={"name": f"RH-{uuid.uuid4().hex[:6]}"}).json()
    secret = f"contrat confidentiel {uuid.uuid4()}".encode()
    up = _upload(client, ah, "Contrat Dupont.txt", secret, folder_id=folder["id"], confidentiality="confidential")
    assert up.status_code == 201, up.text
    public = _upload(client, ah, "Note.txt", f"note {uuid.uuid4()}".encode(), folder_id=folder["id"])
    assert public.status_code == 201, public.text

    # Doublon d'un document illisible : refusé, sans révéler code, titre ni dossier
    dup = _upload(client, sh, "copie.txt", secret)
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "DUPLICATE_DOCUMENT"
    message = dup.json()["error"]["message"]
    assert up.json()["code"] not in message and "Dupont" not in message and folder["name"] not in message
    assert not dup.json()["error"].get("details")
    # … alors que l'administrateur voit l'original
    assert up.json()["code"] in _upload(client, ah, "copie.txt", secret).json()["error"]["message"]

    # Compteurs de l'arborescence : seuls les documents lisibles sont comptés
    def count(headers: dict[str, str]) -> int:
        tree = client.get(f"{API}/document-folders/tree", headers=headers).json()
        return next(f["documents"] for f in tree if f["id"] == folder["id"])

    assert count(ah) == 2 and count(sh) == 1
