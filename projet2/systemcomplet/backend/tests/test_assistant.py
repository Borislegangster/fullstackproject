"""Assistant de la vitrine : réponses sourcées dans le CMS (mode règles) ; mode IA nourri de TOUTES les informations
publiées (jamais des brouillons), recherche web (reprise après pause, désactivation si refusée), liens limités aux pages
publiées, historique transmis, repli sur les règles ; prise de coordonnées avec consentement → lead « chatbot »."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select

API = "/api/v1"


def _publish_faq(db: Any) -> None:
    from app.core.utils import utcnow
    from app.modules.cms.models import FaqItem

    db.add(
        FaqItem(
            question="Proposez-vous une garantie décennale ?",
            answer="<p>Oui : tous nos ouvrages sont couverts par une <strong>assurance décennale</strong>.</p>",
            status="published",
            published_at=utcnow(),
        )
    )
    db.commit()


def test_rules_mode_answers_from_cms_and_keeps_context(client: Any, db: Any) -> None:
    _publish_faq(db)
    hello = client.post(f"{API}/public/assistant/messages", json={"message": "Bonjour", "page_path": "/"})
    assert hello.status_code == 200, hello.text
    body = hello.json()
    assert body["mode"] == "rules" and "Bonjour" in body["reply"] and body["suggestions"]
    conversation_id = body["conversation_id"]

    faq = client.post(
        f"{API}/public/assistant/messages",
        json={"conversation_id": conversation_id, "message": "Et la garantie décennale ?"},
    ).json()
    assert "assurance décennale" in faq["reply"] and "<strong>" not in faq["reply"]

    budget = client.post(
        f"{API}/public/assistant/messages",
        json={"conversation_id": conversation_id, "message": "Quel budget pour une villa ?"},
    ).json()
    assert {"type": "link", "label": "Décrire mon projet", "href": "/decrire-mon-projet"} in budget["actions"]

    from app.modules.assistant.models import AssistantConversation

    db.expire_all()
    conversation = db.get(AssistantConversation, uuid.UUID(conversation_id))
    assert len(conversation.messages) == 6 and conversation.page_path == "/"


class _Block:
    """Bloc de réponse de l'API (texte, appel d'outil…) tel que le SDK le renvoie."""

    def __init__(self, **data: Any) -> None:
        self.__dict__.update(data)
        self._data = data

    def model_dump(self, **_: Any) -> dict[str, Any]:
        return dict(self._data)


class _Response:
    def __init__(self, blocks: list[_Block], stop: str, searches: int = 0) -> None:
        from types import SimpleNamespace

        self.content = blocks
        self.stop_reason = stop
        self.model = "claude-opus-5-5"
        self.usage = SimpleNamespace(
            input_tokens=900,
            output_tokens=120,
            cache_creation_input_tokens=0,
            cache_read_input_tokens=4000,
            server_tool_use=SimpleNamespace(web_search_requests=searches),
        )


def _answer(reply: str, *, link: str = "", label: str = "", callback: bool = False, **extra: Any) -> _Response:
    data = {
        "reply": reply,
        "suggestions": ["Voir nos offres", "Être rappelé"],
        "offer_callback": callback,
        "link_path": link,
        "link_label": label,
    }
    return _Response([_Block(type="tool_use", id="toolu_1", name="repondre", input=data)], "tool_use", **extra)


class _Claude:
    """Faux fournisseur : rejoue un scénario de réponses et garde une copie de chaque requête."""

    def __init__(self, script: list[Any]) -> None:
        from types import SimpleNamespace

        self.script = list(script)
        self.calls: list[dict[str, Any]] = []
        self.model = "claude-opus-5-5"
        self.client = SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(create=self._create)))

    def _create(self, **kwargs: Any) -> Any:
        import copy

        self.calls.append(copy.deepcopy(kwargs))
        item = self.script.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def _use(monkeypatch: Any, script: list[Any]) -> _Claude:
    from app.modules.assistant import knowledge, service
    from app.providers import ai

    fake = _Claude(script)
    monkeypatch.setattr(ai, "get_ai_provider", lambda: fake)
    monkeypatch.setattr(service, "_web_tools_enabled", True)
    knowledge.reset_cache()
    return fake


def _company(db: Any) -> None:
    """Coordonnées, mentions légales et contenus publiés (plus un brouillon qui ne doit jamais sortir)."""
    from app.core.utils import utcnow
    from app.modules.cms.models import FaqItem, PortfolioProject, SiteSettings, TeamMember

    site = db.execute(select(SiteSettings)).scalars().first() or SiteSettings(company_name="GLOBUS ENGINEERING")
    site.address = "23 Rue LT0005DO3, 21103 Douala III, Cameroun"
    site.city = "Douala"
    site.country = "Cameroun"
    site.phone = "+237 678 261 382"
    site.opening_hours = [{"days": "Lundi-Samedi", "hours": "8h00-18h00"}]
    site.legal_info = {"forme": "SARL", "siege": "DOUALA, Yassa - derrière Eneo"}
    site.google_business_url = "https://maps.app.goo.gl/globus-test"
    db.add(site)
    now = utcnow()
    db.add_all(
        [
            FaqItem(question="Intervenez-vous hors de Douala ?", answer="<p>Partout au Cameroun.</p>",
                    status="published", published_at=now),
            FaqItem(question="Question en brouillon secrète", answer="Pas encore publiée.", status="draft"),
            PortfolioProject(slug="immeuble-bastos", title="Immeuble R+4 à Bastos", city="Yaoundé",
                             country="Cameroun", status="published", published_at=now),
            PortfolioProject(slug="projet-brouillon", title="Chantier non publié", city="Bertoua", status="draft"),
            TeamMember(name="Awa Ngono", role="Directrice technique", status="published", published_at=now),
        ]
    )  # fmt: skip
    db.commit()


def test_ai_mode_uses_all_published_information(client: Any, db: Any, monkeypatch: Any) -> None:
    from app.modules.ai.models import AIRequest

    _company(db)
    fake = _use(
        monkeypatch,
        [
            _answer("Notre siège se trouve au 23 Rue LT0005DO3, Douala III.", link="https://maps.app.goo.gl/globus-test",
                    label="Itinéraire"),
            _answer("Nous intervenons dans tout le Cameroun.", link="https://site-externe.example/arnaque",
                    label="Cliquez ici", callback=True),
            _answer("Voici nos réalisations.", link="/projets/immeuble-bastos", label="Immeuble de Bastos"),
        ],
    )  # fmt: skip
    first = client.post(
        f"{API}/public/assistant/messages", json={"message": "Où est située l'entreprise ?", "page_path": "/contact"}
    )
    assert first.status_code == 200, first.text
    body = first.json()
    assert body["mode"] == "ai" and body["reply"].startswith("Notre siège")
    assert body["actions"] == [{"type": "link", "label": "Itinéraire", "href": "https://maps.app.goo.gl/globus-test"}]

    request = fake.calls[0]
    instructions, kb = request["system"]
    assert kb["cache_control"] == {"type": "ephemeral"}, "base de connaissances mise en cache"
    for published in ("23 Rue LT0005DO3", "Yassa", "Lundi-Samedi 8h00-18h00", "+237 678 261 382", "SARL",
                      "Intervenez-vous hors de Douala ?", "Immeuble R+4 à Bastos", "Yaoundé", "Awa Ngono",
                      "/projets/immeuble-bastos"):  # fmt: skip
        assert published in kb["text"], published
    assert "brouillon secrète" not in kb["text"] and "Bertoua" not in kb["text"], "aucun contenu non publié"
    assert "tout le Cameroun" in instructions["text"] and "recherche web" in instructions["text"]
    assert "dont je dispose" in instructions["text"], "formulations à proscrire listées"
    assert {t["name"] for t in request["tools"]} == {"repondre", "web_search", "web_fetch"}
    assert request["thinking"] == {"type": "adaptive"} and request["model"] == "claude-opus-5-5"
    context, question = request["messages"][-1]["content"]
    assert "Page consultée : /contact" in context["text"] and question["text"] == "Où est située l'entreprise ?"

    second = client.post(
        f"{API}/public/assistant/messages",
        json={"conversation_id": body["conversation_id"], "message": "Et à Yaoundé ?"},
    ).json()
    assert second["actions"] == [{"type": "lead_form", "label": "Être rappelé"}], "lien externe inconnu écarté"
    assert [m["role"] for m in fake.calls[1]["messages"]] == ["user", "assistant", "user"], "historique transmis"

    third = client.post(
        f"{API}/public/assistant/messages",
        json={"conversation_id": body["conversation_id"], "message": "Un exemple ?"},
    ).json()
    assert third["actions"] == [{"type": "link", "label": "Immeuble de Bastos", "href": "/projets/immeuble-bastos"}]
    db.expire_all()
    usage = db.execute(select(AIRequest).where(AIRequest.feature == "public_assistant")).scalars().all()
    assert len(usage) == 3 and usage[0].input_tokens == 4900 and usage[0].validation_status == "not_required"


def test_ai_mode_web_search_pause_fallbacks(client: Any, db: Any, monkeypatch: Any) -> None:
    import anthropic
    import httpx

    from app.modules.assistant import service

    # Recherche web longue : le tour mis en pause est renvoyé tel quel, puis Claude répond.
    paused = _Response(
        [_Block(type="server_tool_use", id="srvtoolu_1", name="web_search", input={"query": "norme parasismique"})],
        "pause_turn",
    )
    fake = _use(monkeypatch, [paused, _answer("Selon le ministère de l'Habitat, …", searches=2)])
    body = client.post(f"{API}/public/assistant/messages", json={"message": "Quelle norme parasismique ?"}).json()
    assert body["mode"] == "ai" and body["reply"].startswith("Selon le ministère")
    assert len(fake.calls) == 2 and fake.calls[1]["messages"][-1] == {
        "role": "assistant",
        "content": [{"type": "server_tool_use", "id": "srvtoolu_1", "name": "web_search",
                     "input": {"query": "norme parasismique"}}],
    }  # fmt: skip

    # Recherche web non activée pour l'organisation : nouvel essai sans elle, puis plus jamais proposée.
    refused = anthropic.BadRequestError(
        "tools.1: web_search is not enabled for this organization",
        response=httpx.Response(400, request=httpx.Request("POST", "https://api.anthropic.com/v1/messages")),
        body=None,
    )
    fake = _use(monkeypatch, [refused, _answer("Réponse sans le web."), _answer("Toujours sans le web.")])
    assert client.post(f"{API}/public/assistant/messages", json={"message": "Bonjour"}).json()["mode"] == "ai"
    client.post(f"{API}/public/assistant/messages", json={"message": "Encore"})
    tools = [{t["name"] for t in call["tools"]} for call in fake.calls]
    assert tools == [{"repondre", "web_search", "web_fetch"}, {"repondre"}, {"repondre"}]
    assert service._web_tools_enabled is False

    # Réponse en texte sans l'outil : texte gardé, sans lien.
    fake = _use(monkeypatch, [_Response([_Block(type="text", text="Bonjour, que puis-je pour vous ?")], "end_turn")])
    text_only = client.post(f"{API}/public/assistant/messages", json={"message": "Salut"}).json()
    assert text_only["mode"] == "ai" and text_only["reply"] == "Bonjour, que puis-je pour vous ?"
    assert text_only["actions"] == []

    # Refus du modèle ou API injoignable : le moteur de règles répond, le widget ne tombe jamais.
    down = anthropic.APIConnectionError(request=httpx.Request("POST", "https://api.anthropic.com/v1/messages"))
    for item in (_Response([], "refusal"), down):
        _use(monkeypatch, [item])
        fallback = client.post(f"{API}/public/assistant/messages", json={"message": "Bonjour"})
        assert fallback.status_code == 200 and fallback.json()["mode"] == "rules"


def test_rules_mode_gives_published_address(client: Any, db: Any) -> None:
    _company(db)
    body = client.post(f"{API}/public/assistant/messages", json={"message": "Où se trouve votre siège ?"}).json()
    assert body["mode"] == "rules"
    assert "23 Rue LT0005DO3" in body["reply"] and "tout le Cameroun" in body["reply"]
    assert "Lundi-Samedi" in body["reply"] and "+237 678 261 382" in body["reply"]
    assert {"type": "link", "label": "Itinéraire", "href": "https://maps.app.goo.gl/globus-test"} in body["actions"]


def test_lead_capture_requires_consent(client: Any, db: Any) -> None:
    from app.modules.crm.models import Lead

    conversation = client.post(
        f"{API}/public/assistant/messages", json={"message": "Je veux parler à un conseiller"}
    ).json()
    assert {"type": "lead_form", "label": "Être rappelé"} in conversation["actions"]
    payload = {
        "conversation_id": conversation["conversation_id"],
        "first_name": "Clarisse",
        "phone": "+237 699 00 11 22",
        "need": "Rénovation d'une maison à Bonamoussadi",
        "consent": False,
    }
    refused = client.post(f"{API}/public/assistant/lead", json=payload)
    assert refused.status_code == 422 and refused.json()["error"]["code"] == "CONSENT_REQUIRED"
    created = client.post(f"{API}/public/assistant/lead", json={**payload, "consent": True})
    assert created.status_code == 201, created.text
    lead = db.execute(select(Lead).where(Lead.number == created.json()["lead_number"])).scalar_one()
    assert lead.source == "chatbot" and "Bonamoussadi" in (lead.message or "")


def test_welcome_does_not_open_a_conversation(client: Any, db: Any) -> None:
    from app.modules.assistant.models import AssistantConversation

    body = client.get(f"{API}/public/assistant").json()
    assert body["greeting"] and len(body["suggestions"]) >= 3 and body["ai"] is False
    assert db.execute(select(AssistantConversation)).first() is None
