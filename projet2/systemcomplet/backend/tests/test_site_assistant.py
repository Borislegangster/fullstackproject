"""Assistant du site (Claude) : boucle de travail avec un modèle simulé (aucun appel réel, aucun coût).

Couvert : brouillons créés et modifiés d'office, contenu publié / média / publication → propositions essayées à
blanc puis appliquées ou rejetées par une personne (avec ses droits), erreurs d'outil renvoyées au modèle, pièces
jointes (image → médiathèque, texte, Word), historique rejoué par référence, droits d'accès, clé absente."""

from __future__ import annotations

import io
import json
import uuid
from types import SimpleNamespace
from typing import Any

from PIL import Image
from sqlalchemy import select

from app.modules.site_assistant import agent
from tests.conftest import as_role, login, make_user

API = "/api/v1"


class _Block:
    def __init__(self, **data: Any) -> None:
        self._data = data
        self.type = data["type"]

    def model_dump(self, **_: Any) -> dict[str, Any]:
        return dict(self._data)


def _response(*blocks: dict[str, Any], stop: str = "tool_use") -> Any:
    usage = SimpleNamespace(
        input_tokens=1200, output_tokens=300, cache_creation_input_tokens=0, cache_read_input_tokens=0
    )
    return SimpleNamespace(
        content=[_Block(**b) for b in blocks], stop_reason=stop, model="claude-opus-5-5", usage=usage
    )


def _use(name: str, **inputs: Any) -> dict[str, Any]:
    return {"type": "tool_use", "id": f"toolu_{uuid.uuid4().hex[:12]}", "name": name, "input": inputs}


def _last_results(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [b for b in messages[-1]["content"] if isinstance(b, dict) and b.get("type") == "tool_result"]


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 48), (200, uuid.uuid4().int % 255, 40)).save(buf, "PNG")
    return buf.getvalue()


def _setup(monkeypatch: Any, script: list[Any]) -> list[list[dict[str, Any]]]:
    """Modèle simulé : chaque étape reçoit les messages envoyés et renvoie une réponse."""
    seen: list[list[dict[str, Any]]] = []
    steps = iter(script)
    monkeypatch.setattr(agent, "get_ai_provider", lambda: SimpleNamespace(client=object(), model="claude-opus-5-5"))

    def fake_call(client: Any, model: str, tools: list[dict[str, Any]], messages: list[dict[str, Any]]) -> Any:
        seen.append(messages)
        assert {t["name"] for t in tools if "input_schema" in t} >= {"create_content", "save_page", "set_seo"}
        return next(steps)(messages)

    monkeypatch.setattr(agent, "call_model", fake_call)
    return seen


def test_drafts_applied_visible_changes_proposed_then_validated(client: Any, db: Any, monkeypatch: Any) -> None:
    admin = make_user(db, email=f"admin-sa-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    # Contenu déjà en ligne et image de la médiathèque
    faq = client.post(
        f"{API}/cms/faq-items", headers=ah, json={"question": "Construisez-vous à Douala ?", "answer": "<p>Oui.</p>"}
    ).json()
    published = client.post(
        f"{API}/cms/collections/faq_items/{faq['id']}/transition", headers=ah, json={"target": "published"}
    )
    assert published.status_code == 200, published.text
    media = client.post(
        f"{API}/cms/media",
        headers=ah,
        data={"title": "Chantier"},
        files={"file": ("chantier.png", _png(), "image/png")},
    ).json()
    route = f"assistant-{uuid.uuid4().hex[:6]}"
    state: dict[str, Any] = {}

    def step1(messages: list[dict[str, Any]]) -> Any:
        return _response(
            {"type": "text", "text": "Je regarde la structure des FAQ et les images sans texte alternatif."},
            _use("describe_fields", kind="faq_items"),
            _use("search_media", missing_alt=True),
            _use("create_content", kind="nope", data={}, summary="Erreur volontaire"),
        )

    def step2(messages: list[dict[str, Any]]) -> Any:
        results = _last_results(messages)
        assert results[2].get("is_error") is True  # collection inconnue : renvoyée au modèle, le tour continue
        assert media["id"] in results[1]["content"]
        page = {
            "route_key": route,
            "path": f"/{route}",
            "title": "Construire à Douala",
            "sections": [{"key": "intro", "blocks": [{"data": {"kind": "rich_text", "html": "<p>Nos services.</p>"}}]}],
        }
        return _response(
            _use(
                "create_content",
                kind="faq_items",
                data={"question": "Quels délais ?", "answer": "<p>Selon le projet.</p>"},
                summary="Nouvelle question",
            ),
            _use("save_page", page=page, summary="Page Douala"),
        )

    def step3(messages: list[dict[str, Any]]) -> Any:
        created = [json.loads(r["content"]) for r in _last_results(messages)]
        state["faq"], state["page"] = created[0]["id"], created[1]["id"]
        return _response(
            _use(
                "set_seo",
                kind="page",
                id=state["page"],
                changes={"title": "Construire à Douala — GLOBUS"},
                summary="SEO brouillon",
            ),
            _use(
                "update_content",
                kind="faq_items",
                id=faq["id"],
                changes={"answer": "<p>Oui, partout au Cameroun.</p>"},
                summary="Réponse enrichie",
            ),
            _use(
                "update_media",
                media_id=media["id"],
                changes={"alt_text": "Chantier de gros œuvre à Douala"},
                summary="Texte alternatif",
            ),
            _use("request_publication", kind="faq_items", id=state["faq"], summary="Publier la nouvelle question"),
        )

    def step4(messages: list[dict[str, Any]]) -> Any:
        statuses = [json.loads(r["content"])["status"] for r in _last_results(messages)]
        assert statuses == ["applied_to_draft", "proposed", "proposed", "proposed"]
        return _response({"type": "text", "text": "Compte rendu : 2 brouillons, 3 propositions."}, stop="end_turn")

    _setup(monkeypatch, [step1, step2, step3, step4])
    assert client.get(f"{API}/site-assistant/status", headers=ah).json()["available"] is True
    session = client.post(f"{API}/site-assistant/sessions", headers=ah, json={}).json()
    sent = client.post(
        f"{API}/site-assistant/sessions/{session['id']}/messages",
        headers=ah,
        data={"text": "Enrichis la FAQ et crée la page Douala"},
    )
    assert sent.status_code == 202, sent.text
    done = client.get(f"{API}/site-assistant/sessions/{session['id']}", headers=ah).json()
    assert done["state"] == "idle", done
    assert done["title"].startswith("Enrichis la FAQ")
    assert [m["role"] for m in done["messages"]][:2] == ["user", "assistant"]
    assert done["messages"][-1]["text"].startswith("Compte rendu")
    assert any(m["role"] == "step" and m["text"] == "Création d'un brouillon" for m in done["messages"])
    by_status = {}
    for a in done["actions"]:
        by_status.setdefault(a["status"], []).append(a["tool"])
    assert sorted(by_status["applied"]) == ["create_content", "save_page", "set_seo"]
    assert sorted(by_status["proposed"]) == ["request_publication", "update_content", "update_media"]
    assert done["usage"]["input_tokens"] == 4 * 1200 and done["usage"]["estimated_usd"] > 0

    # Rien de visible n'a changé : la proposition a été essayée à blanc
    live = client.get(f"{API}/cms/faq-items/{faq['id']}", headers=ah).json()
    assert live["answer"] == "<p>Oui.</p>"
    assert client.get(f"{API}/cms/media/{media['id']}", headers=ah).json()["alt_text"] in (None, "")
    assert client.get(f"{API}/cms/faq-items/{state['faq']}", headers=ah).json()["status"] == "draft"
    seo = client.get(f"{API}/cms/seo/page/{route}", headers=ah).json()
    assert seo["title"] == "Construire à Douala — GLOBUS"

    # Validation humaine : un rejet, une application, puis le reste en une fois
    actions = {a["tool"]: a for a in done["actions"] if a["status"] == "proposed"}
    rejected = client.post(f"{API}/site-assistant/actions/{actions['update_content']['id']}/reject", headers=ah)
    assert rejected.json()["status"] == "rejected"
    applied = client.post(f"{API}/site-assistant/actions/{actions['update_media']['id']}/apply", headers=ah)
    assert applied.status_code == 200 and applied.json()["status"] == "accepted", applied.text
    assert (
        client.get(f"{API}/cms/media/{media['id']}", headers=ah).json()["alt_text"] == "Chantier de gros œuvre à Douala"
    )
    again = client.post(f"{API}/site-assistant/actions/{actions['update_media']['id']}/apply", headers=ah)
    assert again.status_code == 409
    rest = client.post(f"{API}/site-assistant/sessions/{session['id']}/apply-all", headers=ah).json()
    assert len(rest["done"]) == 1 and rest["errors"] == []
    assert client.get(f"{API}/cms/faq-items/{state['faq']}", headers=ah).json()["status"] == "published"
    assert client.get(f"{API}/cms/faq-items/{faq['id']}", headers=ah).json()["answer"] == "<p>Oui.</p>"


def test_attachments_history_by_reference_access_and_missing_key(client: Any, db: Any, monkeypatch: Any) -> None:
    import docx

    from app.modules.cms.models import MediaAsset
    from app.modules.site_assistant.models import SiteAssistantSession

    admin = make_user(db, email=f"admin-sa-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    _setup(monkeypatch, [lambda messages: _response({"type": "text", "text": "Bien reçu."}, stop="end_turn")])
    session = client.post(f"{API}/site-assistant/sessions", headers=ah, json={"title": "Fichiers"}).json()
    word = io.BytesIO()
    document = docx.Document()
    document.add_paragraph("Présentation : GLOBUS construit des villas R+1 à Yaoundé.")
    document.save(word)
    sent = client.post(
        f"{API}/site-assistant/sessions/{session['id']}/messages",
        headers=ah,
        data={"text": "Voici nos éléments"},
        files=[
            ("files", ("facade.png", _png(), "image/png")),
            ("files", ("notes.txt", "Délais : 6 à 9 mois".encode(), "text/plain")),
            (
                "files",
                (
                    "presentation.docx",
                    word.getvalue(),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ),
            ),
        ],
    )
    assert sent.status_code == 202, sent.text
    data = client.get(f"{API}/site-assistant/sessions/{session['id']}", headers=ah).json()
    attachments = data["messages"][0]["attachments"]
    assert [a["kind"] for a in attachments] == ["image", "text", "text"]
    asset = db.get(MediaAsset, uuid.UUID(attachments[0]["media_id"]))
    assert asset.folder == "assistant"

    db.expire_all()
    row = db.get(SiteAssistantSession, uuid.UUID(session["id"]))
    first = row.transcript[0]["content"]
    assert first[0] == {"type": "image", "source": {"type": "media_ref", "media_id": attachments[0]["media_id"]}}
    texts = " ".join(b.get("text", "") for b in first if b["type"] == "text")
    assert "6 à 9 mois" in texts and "villas R+1 à Yaoundé" in texts
    expanded = agent.expand(db, row.transcript)[0]["content"][0]
    assert expanded["type"] == "image" and expanded["source"]["type"] == "base64"
    assert row.transcript[-1]["role"] == "assistant"

    # Format non pris en charge ; profil sans droit d'écriture CMS ; clé absente
    bad = client.post(
        f"{API}/site-assistant/sessions/{session['id']}/messages",
        headers=ah,
        data={"text": "x"},
        files=[("files", ("plan.dwg", b"AC1027 binaire", "application/octet-stream"))],
    )
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"
    _site, sh = as_role(client, db, "CHEF_CHANTIER")
    assert client.get(f"{API}/site-assistant/status", headers=sh).status_code == 403
    other = client.get(
        f"{API}/site-assistant/sessions/{session['id']}", headers=login(client, make_user(db, roles=["ADMIN"]).email)
    )
    assert other.status_code == 404  # conversation personnelle
    monkeypatch.setattr(agent, "get_ai_provider", lambda: None)
    assert client.get(f"{API}/site-assistant/status", headers=ah).json()["available"] is False
    off = client.post(f"{API}/site-assistant/sessions/{session['id']}/messages", headers=ah, data={"text": "Encore"})
    assert off.status_code == 422 and off.json()["error"]["code"] == "ASSISTANT_UNAVAILABLE"
    assert db.execute(select(MediaAsset).where(MediaAsset.folder == "assistant")).first() is not None
