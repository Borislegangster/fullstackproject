"""Assistant du site, gestion complète de la vitrine (modèle et services d'images simulés, aucun appel réel) :

- prestataires d'images : requêtes OpenAI / Gemini, lecture des réponses, erreurs lisibles ;
- audit page par page (bannière sans image, texte court, liste vide…) ;
- image générée → médiathèque (dossier « ia », crédit IA), plafond quotidien, coût enregistré ;
- propositions fusionnées par élément, menus, réglages du site (champs autorisés), retrait ;
- aperçu fidèle d'une proposition (page recalculée à blanc, rien d'enregistré), puis application ;
- proposition périmée refusée ; révalidation du site seulement après validation de la transaction."""

from __future__ import annotations

import base64
import io
import json
import uuid
from types import SimpleNamespace
from typing import Any

import httpx
import pytest
from PIL import Image

from app.core.config import settings
from app.modules.site_assistant import agent
from app.providers import imagegen
from tests.conftest import login, make_user

API = "/api/v1"


def _jpeg(color: tuple[int, int, int] = (180, 120, 60)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (96, 54), color).save(buf, "JPEG")
    return buf.getvalue()


# ---------------------------------------------------------------------------- prestataires d'images
class _Resp:
    def __init__(self, status: int, body: Any) -> None:
        self.status_code = status
        self._body = body
        self.text = json.dumps(body)

    def json(self) -> Any:
        return self._body


def test_image_providers_requests_responses_and_errors(monkeypatch: Any) -> None:
    calls: list[dict[str, Any]] = []
    b64 = base64.b64encode(_jpeg()).decode()

    def fake_post(url: str, *, headers: dict[str, str], json: dict[str, Any], timeout: Any) -> _Resp:
        calls.append({"url": url, "headers": headers, "json": json})
        return responses.pop(0)

    monkeypatch.setattr(imagegen.httpx, "post", fake_post)

    # OpenAI : modèle par défaut, format libre 16:9, image vérifiée
    responses = [_Resp(200, {"data": [{"b64_json": b64}], "usage": {"input_tokens": 40, "output_tokens": 4100}})]
    image = imagegen.OpenAIImages("sk-test").generate("A modern villa under construction in Douala", "16:9")
    assert calls[-1]["url"] == imagegen.OPENAI_URL
    assert calls[-1]["headers"]["Authorization"] == "Bearer sk-test"
    assert calls[-1]["json"] | {"prompt": ""} == {
        "model": imagegen.OPENAI_DEFAULT_MODEL,
        "prompt": "",
        "n": 1,
        "size": "2048x1152",
        "quality": "high",
        "output_format": "jpeg",
        "output_compression": 90,
        "moderation": "auto",
    }
    assert (image.mime, image.width, image.height, image.extension) == ("image/jpeg", 96, 54, ".jpg")
    assert image.usage["output_tokens"] == 4100
    # Modèle ancien : formats fixes
    assert imagegen.OpenAIImages("k", "gpt-image-1.5").size_for("16:9") == "1536x1024"

    # Gemini (API Interactions) : clé en en-tête, format demandé, image trouvée dans les étapes
    responses = [
        _Resp(200, {"steps": [{"type": "model_output", "content": [{"type": "image", "data": b64}]}], "usage": {}})
    ]
    image = imagegen.GeminiImages("g-key").generate("Engineers reviewing plans on site", "4:3")
    assert calls[-1]["url"] == imagegen.GEMINI_URL
    assert calls[-1]["headers"] == {"x-goog-api-key": "g-key", "Api-Revision": imagegen.GEMINI_API_REVISION}
    assert calls[-1]["json"]["model"] == imagegen.GOOGLE_DEFAULT_MODEL
    assert calls[-1]["json"]["response_format"]["aspect_ratio"] == "4:3"
    assert image.mime == "image/jpeg"
    # Forme generateContent (inlineData) également reconnue
    assert imagegen._find_image({"candidates": [{"content": {"parts": [{"inlineData": {"data": "eA=="}}]}}]})

    # Erreurs : messages lisibles, renvoyés à Claude
    cases = [
        (_Resp(401, {"error": {"message": "Incorrect API key"}}), "refusée"),
        (_Resp(403, {"error": {"message": "Your organization must be verified"}}), "vérifier l'organisation"),
        (_Resp(429, {"error": {"message": "quota"}}), "Limite ou crédit"),
        (_Resp(400, {"error": {"message": "Request was rejected by the safety system"}}), "filtre de sécurité"),
        (_Resp(404, {"error": {"message": "The model does not exist"}}), "Modèle d'images inconnu"),
        (_Resp(200, {"data": [{"b64_json": base64.b64encode(b"pas une image").decode()}]}), "image valide"),
        (_Resp(200, {"data": []}), "aucune image"),
    ]
    for resp, expected in cases:
        responses = [resp]
        with pytest.raises(imagegen.ImageGenError) as err:
            imagegen.OpenAIImages("k").generate("A construction site at dawn in Yaoundé", "3:2")
        assert expected in str(err.value), (expected, str(err.value))
    responses = [_Resp(200, {"steps": [{"type": "model_output", "content": [{"type": "text", "text": "non"}]}]})]
    with pytest.raises(imagegen.ImageGenError, match="aucune image"):
        imagegen.GeminiImages("k").generate("A construction site at dawn in Yaoundé", "3:2")

    def down(*_: Any, **__: Any) -> Any:
        raise httpx.ConnectError("boom")

    monkeypatch.setattr(imagegen.httpx, "post", down)
    with pytest.raises(imagegen.ImageGenError, match="injoignable"):
        imagegen.OpenAIImages("k").generate("A construction site at dawn in Yaoundé", "3:2")

    # Choix du prestataire selon les réglages et la clé du coffre
    monkeypatch.setattr(imagegen, "get_secret", lambda name: {"GEMINI_API_KEY": "g"}.get(name))
    monkeypatch.setattr(settings, "IMAGE_GEN_PROVIDER", "none")
    assert imagegen.get_image_provider() is None and imagegen.availability()["available"] is False
    monkeypatch.setattr(settings, "IMAGE_GEN_PROVIDER", "openai")
    assert imagegen.get_image_provider() is None
    assert "OPENAI_API_KEY" in imagegen.availability()["reason"]
    monkeypatch.setattr(settings, "IMAGE_GEN_PROVIDER", "google")
    monkeypatch.setattr(settings, "IMAGE_GEN_MODEL", "gemini-nano-banana-2.1")
    provider = imagegen.get_image_provider()
    assert isinstance(provider, imagegen.GeminiImages) and provider.model == "gemini-nano-banana-2.1"
    assert imagegen.availability()["daily_limit"] == settings.IMAGE_GEN_DAILY_LIMIT


# ---------------------------------------------------------------------------- travail d'ensemble sur la vitrine
class _Block:
    def __init__(self, **data: Any) -> None:
        self._data = data
        self.type = data["type"]

    def model_dump(self, **_: Any) -> dict[str, Any]:
        return dict(self._data)


def _response(*blocks: dict[str, Any], stop: str = "tool_use") -> Any:
    usage = SimpleNamespace(
        input_tokens=900, output_tokens=200, cache_creation_input_tokens=0, cache_read_input_tokens=0
    )
    return SimpleNamespace(
        content=[_Block(**b) for b in blocks], stop_reason=stop, model="claude-opus-5-5", usage=usage
    )


def _use(name: str, **inputs: Any) -> dict[str, Any]:
    return {"type": "tool_use", "id": f"toolu_{uuid.uuid4().hex[:12]}", "name": name, "input": inputs}


def _results(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [b for b in messages[-1]["content"] if isinstance(b, dict) and b.get("type") == "tool_result"]


def _json(result: dict[str, Any]) -> Any:
    content = result["content"]
    if isinstance(content, list):
        return json.loads(next(b["text"] for b in content if b.get("type") == "text"))
    return json.loads(content)


class _FakeImages:
    name, label, model = "openai", "OpenAI", "gpt-image-test"

    def __init__(self) -> None:
        self.prompts: list[tuple[str, str]] = []

    def generate(self, prompt: str, aspect: str) -> imagegen.GeneratedImage:
        self.prompts.append((prompt, aspect))
        color = (40 + len(self.prompts) * 30, 90, 140)
        return imagegen.GeneratedImage(
            data=_jpeg(color),
            mime="image/jpeg",
            provider="openai",
            model=self.model,
            width=96,
            height=54,
            usage={"input_tokens": 50, "output_tokens": 4000},
        )


def _page(route: str, hero: dict[str, Any], text: str) -> dict[str, Any]:
    return {
        "route_key": route,
        "path": f"/{route}",
        "title": "Construire au Cameroun",
        "sections": [
            {"key": "hero", "blocks": [{"data": {"kind": "hero", "title": "Construire au Cameroun", **hero}}]},
            {"key": "intro", "blocks": [{"data": {"kind": "rich_text", "html": text}}]},
        ],
    }


def test_whole_site_work_images_merged_proposals_preview_and_apply(client: Any, db: Any, monkeypatch: Any) -> None:
    admin = make_user(db, email=f"admin-auto-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    route = f"vitrine-{uuid.uuid4().hex[:6]}"
    created = client.post(f"{API}/cms/pages", headers=ah, json=_page(route, {}, "<p>Bienvenue.</p>"))
    assert created.status_code == 201, created.text
    page_id = created.json()["id"]
    assert (
        client.post(f"{API}/cms/pages/{page_id}/transition", headers=ah, json={"target": "published"}).status_code
        == 200
    )
    service_row = client.post(
        f"{API}/cms/services", headers=ah, json={"name": "Permis de bâtir", "summary": "Dossier."}
    ).json()
    published = client.post(
        f"{API}/cms/collections/services/{service_row['id']}/transition", headers=ah, json={"target": "published"}
    )
    assert published.status_code == 200, published.text
    faq = client.post(
        f"{API}/cms/faq-items", headers=ah, json={"question": "Ancienne question ?", "answer": "<p>x</p>"}
    )
    faq_id = faq.json()["id"]
    client.post(f"{API}/cms/collections/faq_items/{faq_id}/transition", headers=ah, json={"target": "published"})

    fake = _FakeImages()
    monkeypatch.setattr(settings, "IMAGE_GEN_PROVIDER", "openai")
    monkeypatch.setattr(imagegen, "get_image_provider", lambda: fake)
    monkeypatch.setattr(agent, "get_ai_provider", lambda: SimpleNamespace(client=object(), model="claude-opus-5-5"))
    state: dict[str, Any] = {}
    long_text = "<p>" + " ".join(["GLOBUS accompagne votre projet de construction au Cameroun."] * 12) + "</p>"

    def step1(messages: list[dict[str, Any]]) -> Any:
        return _response(_use("audit_site_content"))

    def step2(messages: list[dict[str, Any]]) -> Any:
        audit = _json(_results(messages)[0])
        page = next(p for p in audit["pages"] if p["route_key"] == route)
        issues = [i for b in page["blocks_with_issues"] for i in b["issues"]]
        assert "bannière sans image ni vidéo" in issues and any(i.startswith("texte court") for i in issues)
        assert "aucune image dans les sections de la page" in page["issues"]
        services = next(c for c in audit["collections_avec_page"] if c["collection"] == "services")
        flagged = next(i for i in services["items"] if i["id"] == service_row["id"])
        assert "sans image" in flagged["issues"]
        return _response(
            _use(
                "generate_image",
                prompt="Wide photo of a reinforced concrete villa under construction in Douala, morning light",
                aspect="16:9",
                title="Villa en construction à Douala",
                alt_text="Villa en béton armé en construction, échafaudages, lumière du matin",
                purpose="Bannière de la page Construire au Cameroun",
            )
        )

    def step3(messages: list[dict[str, Any]]) -> Any:
        result = _results(messages)[0]
        assert not result.get("is_error"), result
        # Claude voit l'image générée (rechargée depuis la médiathèque ; l'historique ne garde que la référence)
        assert result["content"][0]["type"] == "image" and result["content"][0]["source"]["type"] == "base64"
        state["media"] = _json(result)["media_id"]
        hero = {"media_id": state["media"]}
        return _response(
            _use("save_page", page_id=page_id, page=_page(route, hero, "<p>Bienvenue.</p>"), summary="Bannière"),
            _use(
                "update_content",
                kind="services",
                id=service_row["id"],
                changes={"summary": "Dossier complet."},
                summary="Résumé",
            ),
        )

    def step4(messages: list[dict[str, Any]]) -> Any:
        first = [_json(r) for r in _results(messages)]
        assert [r["status"] for r in first] == ["proposed", "proposed"]
        state["page_action"], state["service_action"] = first[0]["action_id"], first[1]["action_id"]
        hero = {"media_id": state["media"]}
        return _response(
            _use("get_content", kind="page", id=page_id),
            _use("save_page", page_id=page_id, page=_page(route, hero, long_text), summary="Bannière et texte"),
            _use(
                "update_content",
                kind="services",
                id=service_row["id"],
                changes={"media_id": state["media"]},
                summary="Image",
            ),
            _use(
                "update_navigation",
                key="footer",
                title="Pied de page",
                items=[{"label": "Construire", "link_type": "path", "url": f"/{route}"}],
                summary="Lien vers la nouvelle page",
            ),
            _use(
                "update_site_settings", changes={"slogan": "Bâtir en confiance, d'ici ou d'ailleurs"}, summary="Slogan"
            ),
            _use("update_site_settings", changes={"tracking": {}}, summary="Interdit"),
            _use("request_unpublish", kind="faq_items", id=faq_id, summary="Question obsolète"),
        )

    def step5(messages: list[dict[str, Any]]) -> Any:
        results = _results(messages)
        page_view = _json(results[0])
        assert page_view["proposition_en_attente"]["action_id"] == state["page_action"]
        merged = [_json(results[1]), _json(results[2])]
        assert [m["action_id"] for m in merged] == [state["page_action"], state["service_action"]]
        assert all("mise à jour" in m["message"] for m in merged)
        assert _json(results[3])["status"] == "proposed" and _json(results[4])["status"] == "proposed"
        assert results[5].get("is_error") is True and "tracking" in results[5]["content"]
        assert _json(results[6])["status"] == "proposed"
        return _response({"type": "text", "text": "Compte rendu : 1 image, 5 propositions."}, stop="end_turn")

    seen_tools: list[set[str]] = []
    script = iter([step1, step2, step3, step4, step5])

    failures: list[str] = []

    def fake_call(client_: Any, model: str, tools: list[dict[str, Any]], messages: list[dict[str, Any]]) -> Any:
        import traceback

        seen_tools.append({t["name"] for t in tools if "input_schema" in t})
        try:
            return next(script)(messages)
        except AssertionError:
            failures.append(traceback.format_exc())  # remonté par le test (sinon masqué en erreur d'API)
            raise

    monkeypatch.setattr(agent, "call_model", fake_call)
    status = client.get(f"{API}/site-assistant/status", headers=ah).json()
    assert status["images"]["available"] is True and status["images"]["model"] == "gpt-image-test"
    session = client.post(f"{API}/site-assistant/sessions", headers=ah, json={}).json()
    sent = client.post(
        f"{API}/site-assistant/sessions/{session['id']}/messages", headers=ah, data={"text": "Complète la vitrine"}
    )
    assert sent.status_code == 202, sent.text
    done = client.get(f"{API}/site-assistant/sessions/{session['id']}", headers=ah).json()
    assert not failures, failures[0]
    assert done["state"] == "idle", done
    from app.modules.site_assistant.models import SiteAssistantSession

    stored = json.dumps(db.get(SiteAssistantSession, uuid.UUID(session["id"])).transcript)
    assert '"media_ref"' in stored and '"base64"' not in stored
    assert {"audit_site_content", "generate_image", "update_navigation", "update_site_settings"} <= seen_tools[0]

    # Image : médiathèque, dossier « ia », crédit IA, invite complétée (pas de texte dans l'image), coût enregistré
    media = client.get(f"{API}/cms/media/{state['media']}", headers=ah).json()
    assert media["folder"] == "ia" and "générée par IA" in media["credits"] and media["alt_text"].startswith("Villa")
    assert fake.prompts[0][1] == "16:9" and "No text" in fake.prompts[0][0]
    from app.modules.ai.models import AIRequest

    rows = db.query(AIRequest).filter(AIRequest.feature == "site_assistant_image").all()
    assert [(r.status, r.provider, r.output_tokens) for r in rows] == [("ok", "openai", 4000)]

    # Une proposition par élément (fusionnées), menus, réglages, retrait
    pending = {a["tool"]: a for a in done["actions"] if a["status"] == "proposed"}
    assert sorted(pending) == [
        "request_unpublish",
        "save_page",
        "update_content",
        "update_navigation",
        "update_site_settings",
    ]
    assert [a["tool"] for a in done["actions"]].count("save_page") == 1
    assert pending["update_content"]["payload"]["changes"] == {
        "summary": "Dossier complet.",
        "media_id": state["media"],
    }
    image_action = next(a for a in done["actions"] if a["tool"] == "generate_image")
    assert image_action["status"] == "applied" and image_action["result"]["url"].endswith("/original")

    # Aperçu : page recalculée avec la proposition, rien d'enregistré
    target = client.get(f"{API}/site-assistant/actions/{pending['save_page']['id']}/preview", headers=ah).json()
    assert target["path"] == f"/{route}" and target["token"]
    preview = client.get(f"{API}/public/preview/{target['token']}")
    assert preview.status_code == 200, preview.text
    assert preview.headers["cache-control"] == "no-store"
    detail = preview.json()["detail"]
    assert preview.json()["kind"] == "page"
    assert detail["sections"][0]["blocks"][0]["media_id"] == state["media"]
    assert "GLOBUS accompagne" in detail["sections"][1]["blocks"][0]["html"]
    live = client.get(f"{API}/public/pages/{route}").json()
    assert live["sections"][0]["blocks"][0].get("media_id") is None
    service_preview = client.get(f"{API}/site-assistant/actions/{pending['update_content']['id']}/preview", headers=ah)
    token = service_preview.json()["token"]
    assert client.get(f"{API}/public/preview/{token}").json()["detail"]["summary"] == "Dossier complet."
    assert client.get(f"{API}/cms/services/{service_row['id']}", headers=ah).json()["summary"] == "Dossier."
    from app.modules.site_assistant.models import SiteAssistantAction

    action_row = db.get(SiteAssistantAction, uuid.UUID(pending["update_content"]["id"]))
    action_row.payload = {
        **action_row.payload,
        "changes": {**action_row.payload["changes"], "slug": "permis-de-batir-diaspora"},
    }
    db.commit()
    moved = client.get(f"{API}/site-assistant/actions/{pending['update_content']['id']}/preview", headers=ah).json()
    assert moved["path"] == "/services/permis-de-batir-diaspora", moved
    moved_detail = client.get(f"{API}/public/preview/{moved['token']}").json()["detail"]
    assert moved_detail["slug"] == "permis-de-batir-diaspora"
    assert (
        client.get(f"{API}/cms/services/{service_row['id']}", headers=ah).json()["slug"] != "permis-de-batir-diaspora"
    )
    no_preview = client.get(f"{API}/site-assistant/actions/{pending['update_navigation']['id']}/preview", headers=ah)
    assert no_preview.status_code == 404

    # Validation : tout s'applique, avec les droits de la personne
    applied = client.post(f"{API}/site-assistant/sessions/{session['id']}/apply-all", headers=ah).json()
    assert applied["errors"] == [] and len(applied["done"]) == 5, applied
    live = client.get(f"{API}/public/pages/{route}").json()
    assert live["sections"][0]["blocks"][0]["media_id"] == state["media"]
    assert client.get(f"{API}/cms/services/{service_row['id']}", headers=ah).json()["media_id"] == state["media"]
    assert client.get(f"{API}/cms/faq-items/{faq_id}", headers=ah).json()["status"] == "archived"
    settings_now = client.get(f"{API}/cms/site-settings", headers=ah).json()
    assert settings_now["slogan"] == "Bâtir en confiance, d'ici ou d'ailleurs"
    footer = next(menu for menu in client.get(f"{API}/cms/navigation", headers=ah).json() if menu["key"] == "footer")
    assert footer["items"][0]["url"] == f"/{route}"
    # Proposition traitée : plus d'aperçu de proposition (la page en ligne est à jour)
    assert client.get(f"{API}/public/preview/{target['token']}").status_code == 404
    after = client.get(f"{API}/site-assistant/actions/{pending['save_page']['id']}/preview", headers=ah).json()
    assert after == {"path": f"/{route}", "token": None}


def test_stale_proposal_daily_image_cap_and_draft_page_preview(client: Any, db: Any, monkeypatch: Any) -> None:
    admin = make_user(db, email=f"admin-stale-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    ah = login(client, admin.email)
    route = f"stale-{uuid.uuid4().hex[:6]}"
    page_id = client.post(f"{API}/cms/pages", headers=ah, json=_page(route, {}, "<p>Version 1.</p>")).json()["id"]
    client.post(f"{API}/cms/pages/{page_id}/transition", headers=ah, json={"target": "published"})
    fake = _FakeImages()
    monkeypatch.setattr(settings, "IMAGE_GEN_PROVIDER", "openai")
    monkeypatch.setattr(settings, "IMAGE_GEN_DAILY_LIMIT", 1)
    monkeypatch.setattr(imagegen, "get_image_provider", lambda: fake)
    monkeypatch.setattr(agent, "get_ai_provider", lambda: SimpleNamespace(client=object(), model="claude-opus-5-5"))
    draft_route = f"brouillon-{uuid.uuid4().hex[:6]}"
    image = {
        "prompt": "Architect drawing plans in a bright office in Yaoundé, natural light, realistic photo",
        "aspect": "3:2",
        "title": "Étude sur plans",
        "alt_text": "Architecte travaillant sur des plans dans un bureau lumineux",
        "purpose": "Section méthode",
    }
    outcome: dict[str, Any] = {}

    def step1(messages: list[dict[str, Any]]) -> Any:
        return _response(
            _use("generate_image", **image),
            _use("generate_image", **{**image, "title": "Deuxième"}),
            _use("save_page", page_id=page_id, page=_page(route, {}, "<p>Version 2.</p>"), summary="Texte"),
            _use("save_page", page=_page(draft_route, {}, "<p>Nouvelle page.</p>"), summary="Nouvelle page"),
        )

    def step2(messages: list[dict[str, Any]]) -> Any:
        results = _results(messages)
        outcome["first"], outcome["second"] = results[0], results[1]
        outcome["draft"] = _json(results[3])["id"]
        return _response({"type": "text", "text": "Fini."}, stop="end_turn")

    script = iter([step1, step2])
    monkeypatch.setattr(agent, "call_model", lambda c, mdl, tools, messages: next(script)(messages))
    session = client.post(f"{API}/site-assistant/sessions", headers=ah, json={}).json()
    client.post(f"{API}/site-assistant/sessions/{session['id']}/messages", headers=ah, data={"text": "Go"})
    assert not outcome["first"].get("is_error")
    assert outcome["second"]["is_error"] is True and "Plafond de 1 image" in outcome["second"]["content"]
    assert len(fake.prompts) == 1

    # Brouillon de page : aperçu sur le site par jeton « page »
    done = client.get(f"{API}/site-assistant/sessions/{session['id']}", headers=ah).json()
    draft_action = next(a for a in done["actions"] if a["tool"] == "save_page" and a["status"] == "applied")
    target = client.get(f"{API}/site-assistant/actions/{draft_action['id']}/preview", headers=ah).json()
    assert target["path"] == f"/{draft_route}" and target["token"]
    shown = client.get(f"{API}/public/preview/{target['token']}").json()
    assert shown["kind"] == "page" and shown["detail"]["route_key"] == draft_route
    assert client.get(f"{API}/public/pages/{draft_route}").status_code == 404

    # Page modifiée dans le CMS après la proposition : l'application est refusée
    proposal = next(a for a in done["actions"] if a["tool"] == "save_page" and a["status"] == "proposed")
    edited = client.put(f"{API}/cms/pages/{page_id}", headers=ah, json=_page(route, {}, "<p>Édition manuelle.</p>"))
    assert edited.status_code == 200, edited.text
    refused = client.post(f"{API}/site-assistant/actions/{proposal['id']}/apply", headers=ah)
    assert refused.status_code == 409 and refused.json()["error"]["code"] == "PROPOSAL_STALE", refused.text
    assert "Édition manuelle" in json.dumps(client.get(f"{API}/public/pages/{route}").json(), ensure_ascii=False)


def test_site_revalidated_only_after_commit(monkeypatch: Any) -> None:
    from app.core.database import SessionLocal
    from app.modules.cms import service

    sent: list[list[str]] = []
    monkeypatch.setattr(service, "refresh_site", lambda paths=None: sent.append(list(paths or [])))
    session = SessionLocal()
    try:
        session.connection()
        service.revalidate_after_commit(session, ["/offres", "/"])
        assert sent == []  # pas avant la validation : le site relirait l'ancien contenu
        session.rollback()
        session.commit()
        assert sent == []  # transaction annulée : rien à révalider
        session.connection()
        service.revalidate_after_commit(session, ["/offres"])
        service.revalidate_after_commit(session, ["/offres", "/services"])
        session.commit()
        assert sent == [["/offres", "/services"]]

        # « Tout appliquer » : une proposition appliquée (point de sauvegarde validé), une autre refusée (point de
        # sauvegarde annulé) — rien ne part avant la fin, la première est révalidée, pas la seconde.
        sent.clear()
        session.connection()
        service.revalidate_after_commit(session, ["/"])
        accepted = session.begin_nested()
        service.revalidate_after_commit(session, ["/services"])
        accepted.commit()
        assert sent == []  # point de sauvegarde libéré : la transaction principale n'est pas validée
        refused = session.begin_nested()
        service.revalidate_after_commit(session, ["/projets"])
        refused.rollback()
        session.commit()
        assert sent == [["/", "/services"]]
    finally:
        session.close()
