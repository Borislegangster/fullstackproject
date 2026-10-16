"""Assistant de la vitrine : réponses sourcées dans le CMS (mode règles), garde-fous du mode IA (liens internes
uniquement, historique transmis), prise de coordonnées avec consentement → lead « chatbot »."""

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


def test_ai_mode_guardrails(client: Any, db: Any, monkeypatch: Any) -> None:
    from app.providers import ai

    calls: list[dict[str, Any]] = []

    class Claude:
        def complete_json(self, **kwargs: Any) -> ai.AIResult:
            calls.append(kwargs)
            return ai.AIResult(
                data={
                    "reply": "Notre offre Diaspora vous permet de suivre votre chantier à distance.",
                    "suggestions": ["Suivi en ligne ?", "Paiement Mobile Money ?"],
                    "offer_callback": True,
                    "link_path": "https://site-externe.example/arnaque",
                    "link_label": "Cliquez ici",
                }
            )

    monkeypatch.setattr(ai, "get_ai_provider", lambda: Claude())
    first = client.post(
        f"{API}/public/assistant/messages", json={"message": "Je vis en France, comment faire ?"}
    ).json()
    assert first["mode"] == "ai" and first["actions"] == [{"type": "lead_form", "label": "Être rappelé"}]
    second = client.post(
        f"{API}/public/assistant/messages",
        json={"conversation_id": first["conversation_id"], "message": "Et le suivi ?"},
    ).json()
    assert second["mode"] == "ai"
    assert [m["role"] for m in calls[1]["history"]] == ["user", "assistant"], "historique transmis au modèle"
    assert "ne jamais annoncer de prix" in calls[0]["system"]


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
