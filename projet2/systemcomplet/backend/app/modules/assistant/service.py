"""Assistant de la vitrine (widget flottant) : répond aux visiteurs à partir des contenus publiés du CMS
(univers, offres, services, FAQ, coordonnées) — Claude si l'IA est configurée, sinon moteur d'intentions + FAQ.

Garde-fous : aucune promesse de prix ou de délai engageante (renvoi vers l'estimateur et « Décrire mon projet »),
aucun sujet hors GLOBUS / construction, passage à un conseiller (WhatsApp, appel, rappel) proposé dès que le
visiteur le souhaite ; la prise de coordonnées exige un consentement explicite et crée un lead « chatbot ».
"""

from __future__ import annotations

import hashlib
import logging
import re
import unicodedata
import uuid
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError, NotFound
from app.core.utils import utcnow
from app.modules.assistant.models import AssistantConversation

log = logging.getLogger("globus.assistant")
MAX_TURNS = 30
MAX_HISTORY = 12

QUICK_REPLIES = [
    "Estimer mon budget",
    "Construire depuis la diaspora",
    "Voir vos réalisations",
    "Parler à un conseiller",
]

_INTENTS: list[tuple[str, tuple[str, ...]]] = [
    (
        "human",
        ("conseiller", "humain", "appeler", "rappel", "rappeler", "telephone", "parler a", "whatsapp", "contact"),
    ),
    ("budget", ("prix", "budget", "cout", "combien", "tarif", "devis", "estimation", "estimer", "cher")),
    ("diaspora", ("diaspora", "etranger", "france", "europe", "canada", "usa", "distance", "a l'etranger")),
    ("projects", ("realisation", "projet", "reference", "portfolio", "exemple", "photos", "chantiers")),
    ("delay", ("delai", "duree", "combien de temps", "quand", "planning")),
    ("payment", ("paiement", "payer", "momo", "orange money", "mobile money", "carte", "acompte", "echeancier")),
    ("services", ("service", "expertise", "etude", "plan", "architecte", "ingenierie", "bim", "renovation", "villa")),
    ("greeting", ("bonjour", "bonsoir", "salut", "hello", "coucou")),
]


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in text if not unicodedata.combining(c))


def intent_of(message: str) -> str:
    text = _norm(message)
    for intent, words in _INTENTS:
        if any(w in text for w in words):
            return intent
    return "other"


def _strip_html(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()


def knowledge(db: Session, message: str, *, limit: int = 4) -> dict[str, Any]:
    """Contexte publié pertinent : FAQ proches de la question, univers, offres, services, coordonnées."""
    from app.modules.cms import models as cms
    from app.modules.cms.service import live_filter

    words = [w for w in re.findall(r"[a-zA-ZÀ-ÿ]{4,}", message.lower())][:8]
    faq_stmt = select(cms.FaqItem).where(*live_filter(cms.FaqItem))
    if words:
        faq_stmt = faq_stmt.where(
            or_(
                *[cms.FaqItem.question.ilike(f"%{w}%") for w in words],
                *[cms.FaqItem.answer.ilike(f"%{w}%") for w in words],
            )
        )
    faqs = db.execute(faq_stmt.order_by(cms.FaqItem.featured.desc()).limit(limit)).scalars().all()
    universes = (
        db.execute(select(cms.Universe).where(*live_filter(cms.Universe)).order_by(cms.Universe.sort_order))
        .scalars()
        .all()
    )
    offers = db.execute(select(cms.Offer).where(*live_filter(cms.Offer)).limit(12)).scalars().all()
    services = db.execute(select(cms.Service).where(*live_filter(cms.Service)).limit(12)).scalars().all()
    site = db.execute(select(cms.SiteSettings)).scalars().first()
    return {
        "faqs": [{"question": f.question, "answer": _strip_html(f.answer)[:700]} for f in faqs],
        "universes": [
            {"name": u.name, "key": u.key, "tagline": u.tagline, "path": f"/offres/{u.slug}"} for u in universes
        ],
        "offers": [{"name": o.name, "summary": getattr(o, "summary", None)} for o in offers],
        "services": [{"name": s.name, "summary": getattr(s, "summary", None)} for s in services],
        "company": getattr(site, "company_name", None) or "GLOBUS ENGINEERING",
        "phone": getattr(site, "phone", None),
        "whatsapp": getattr(site, "whatsapp", None),
        "email": getattr(site, "email", None),
    }


def _rules_reply(intent: str, ctx: dict[str, Any]) -> dict[str, Any]:
    """Réponses déterministes (sans IA) : fiables, sourcées dans le CMS, orientées action."""
    faq = ctx["faqs"][0] if ctx["faqs"] else None
    universes = ", ".join(u["name"] for u in ctx["universes"][:5])
    actions: list[dict[str, str]] = []
    if intent == "greeting":
        reply = (
            f"Bonjour et bienvenue chez {ctx['company']} ! Je peux vous orienter vers la bonne offre, estimer un "
            "budget indicatif ou vous mettre en relation avec un conseiller. Quel est votre projet ?"
        )
    elif intent == "budget":
        reply = (
            "Chaque projet est chiffré sur mesure. Notre estimateur vous donne une fourchette indicative en "
            "2 minutes, puis un ingénieur affine le devis avec vous (devis détaillé, validé par code à usage unique)."
        )
        actions = [
            {"type": "link", "label": "Décrire mon projet", "href": "/decrire-mon-projet"},
            {"type": "link", "label": "Estimation par photo", "href": "/estimation-instantanee"},
            {"type": "link", "label": "Simuler mon financement", "href": "/financement"},
        ]
    elif intent == "diaspora":
        reply = (
            "Vous construisez depuis l'étranger ? Vous suivez votre chantier en ligne : photos et vidéos datées, "
            "visites en direct, décisions et paiements sécurisés (MTN MoMo, Orange Money, carte), documents "
            "certifiés — sans avoir à vous déplacer."
        )
        diaspora = next((u for u in ctx["universes"] if u["key"] == "DIASPORA"), None)
        actions = [
            {"type": "link", "label": "Notre offre Diaspora", "href": diaspora["path"] if diaspora else "/offres"}
        ]
    elif intent == "projects":
        reply = "Découvrez nos réalisations : photos, avant / après, visites 3D et témoignages de nos clients."
        actions = [{"type": "link", "label": "Voir les réalisations", "href": "/projets"}]
    elif intent == "payment":
        reply = (
            "Les paiements se font par appels de fonds liés à l'avancement réel du chantier, réglables en ligne "
            "(MTN Mobile Money, Orange Money, carte bancaire) avec reçu immédiat dans votre espace client."
        )
    elif intent == "human":
        reply = (
            "Avec plaisir ! Laissez-nous vos coordonnées et un conseiller vous rappelle, ou écrivez-nous sur WhatsApp."
        )
        actions = [{"type": "lead_form", "label": "Être rappelé"}]
        if ctx.get("whatsapp"):
            actions.append(
                {"type": "link", "label": "WhatsApp", "href": f"https://wa.me/{re.sub(r'[^0-9]', '', ctx['whatsapp'])}"}
            )
    elif faq is not None:
        reply = f"{faq['answer']}"
    elif intent == "services":
        reply = (
            f"Nous intervenons de la conception à la livraison : {universes or 'construction, rénovation, ingénierie'}."
        )
        actions = [{"type": "link", "label": "Nos services", "href": "/services"}]
    elif intent == "delay":
        reply = (
            "Les délais dépendent du programme et du terrain : votre planning est établi dès l'étude et suivi en "
            "temps réel dans votre espace client (jalons, avancement, alertes)."
        )
    else:
        reply = (
            "Je n'ai pas encore la réponse exacte à cette question. Un conseiller peut vous répondre rapidement : "
            "souhaitez-vous être rappelé ?"
        )
        actions = [{"type": "lead_form", "label": "Être rappelé"}]
    return {"reply": reply, "suggestions": QUICK_REPLIES, "actions": actions}


AI_SCHEMA = {
    "type": "object",
    "properties": {
        "reply": {"type": "string"},
        "suggestions": {"type": "array", "items": {"type": "string"}},
        "offer_callback": {"type": "boolean"},
        "link_path": {"type": "string"},
        "link_label": {"type": "string"},
    },
    "required": ["reply", "suggestions", "offer_callback", "link_path", "link_label"],
    "additionalProperties": False,
}


def _system_prompt(ctx: dict[str, Any]) -> str:
    import json

    return (
        f"Tu es l'assistant en ligne de {ctx['company']}, entreprise de BTP et d'ingénierie au Cameroun "
        "(signature : « Concevoir. Calculer. Construire. Contrôler. »). Tu réponds en français, avec chaleur et "
        "concision (3 phrases maximum), en t'appuyant uniquement sur les informations publiées ci-dessous.\n"
        "Règles : ne jamais annoncer de prix, de délai ou d'engagement contractuel ; pour un budget, orienter vers "
        "l'estimateur « Décrire mon projet » (/decrire-mon-projet) ; si une information manque, le dire et proposer "
        "un rappel par un conseiller (offer_callback=true) ; refuser poliment tout sujet sans rapport avec GLOBUS ou "
        "un projet de construction ; ne jamais demander de mot de passe ni de données bancaires. link_path doit être "
        "un chemin interne existant (/offres/<univers>, /projets, /services, /decrire-mon-projet, /faq) ou vide ; "
        "suggestions : 2 à 4 relances courtes.\n"
        f"Informations publiées : {json.dumps(ctx, ensure_ascii=False)[:9000]}"
    )


def _ai_reply(ctx: dict[str, Any], history: list[dict[str, str]], message: str) -> dict[str, Any] | None:
    from app.providers.ai import get_ai_provider
    from app.providers.base import ProviderError

    provider = get_ai_provider()
    if provider is None:
        return None
    try:
        result = provider.complete_json(
            system=_system_prompt(ctx),
            prompt=message,
            schema=AI_SCHEMA,
            effort="low",
            max_tokens=1500,
            history=history[-MAX_HISTORY:],
        )
    except ProviderError as exc:
        log.warning("assistant_ai_unavailable", extra={"error": str(exc)[:200]})
        return None
    data = result.data
    actions: list[dict[str, str]] = []
    path = str(data.get("link_path") or "")
    if path.startswith("/") and not path.startswith("//"):
        actions.append({"type": "link", "label": str(data.get("link_label") or "En savoir plus")[:40], "href": path})
    if data.get("offer_callback"):
        actions.append({"type": "lead_form", "label": "Être rappelé"})
    suggestions = [str(s)[:60] for s in (data.get("suggestions") or [])][:4] or QUICK_REPLIES
    return {"reply": str(data.get("reply") or "")[:1500], "suggestions": suggestions, "actions": actions}


def welcome(db: Session) -> dict[str, Any]:
    """Accueil du widget : message, relances et canaux humains (aucune conversation créée avant le 1er message)."""
    from app.modules.cms import models as cms
    from app.providers.ai import get_ai_provider

    site = db.execute(select(cms.SiteSettings)).scalars().first()
    company = getattr(site, "company_name", None) or "GLOBUS ENGINEERING"
    return {
        "greeting": (
            f"Bonjour 👋 Je suis l'assistant de {company}. Une question sur votre projet, nos offres ou le suivi "
            "de chantier à distance ? Je vous réponds tout de suite."
        ),
        "suggestions": QUICK_REPLIES,
        "ai": get_ai_provider() is not None,
        "company": company,
        "phone": getattr(site, "phone", None),
        "whatsapp": getattr(site, "whatsapp", None),
    }


def _ip_hash(ip: str | None) -> str | None:
    return hashlib.sha256(("assistant:" + ip).encode()).hexdigest() if ip else None


def converse(
    db: Session, *, conversation_id: uuid.UUID | None, message: str, page_path: str | None, ip: str | None
) -> dict[str, Any]:
    message = message.strip()[:1000]
    if not message:
        raise BusinessRuleError("Message vide")
    conversation = db.get(AssistantConversation, conversation_id) if conversation_id else None
    if conversation is None:
        conversation = AssistantConversation(
            messages=[], page_path=(page_path or "")[:250] or None, ip_hash=_ip_hash(ip)
        )
        db.add(conversation)
        db.flush()
    if len(conversation.messages) >= MAX_TURNS * 2:
        raise BusinessRuleError("Conversation trop longue : un conseiller peut prendre le relais", code="TOO_LONG")
    history = [{"role": m["role"], "content": m["content"]} for m in conversation.messages]
    ctx = knowledge(db, message)
    answer = _ai_reply(ctx, history, message)
    conversation.mode = "ai" if answer else "rules"
    if answer is None:
        answer = _rules_reply(intent_of(message), ctx)
    now = utcnow().isoformat()
    conversation.messages = [
        *conversation.messages,
        {"role": "user", "content": message, "at": now},
        {"role": "assistant", "content": answer["reply"], "at": now},
    ]
    db.flush()
    return {"conversation_id": str(conversation.id), "mode": conversation.mode, **answer}


def capture_lead(
    db: Session,
    *,
    conversation_id: uuid.UUID,
    first_name: str,
    phone: str | None,
    email: str | None,
    need: str | None,
    consent: bool,
    ip: str | None,
    user_agent: str | None,
) -> dict[str, Any]:
    """Coordonnées laissées dans l'assistant → lead CRM « chatbot » (transcription jointe, consentement tracé)."""
    from app.modules.crm.service import create_lead

    conversation = db.get(AssistantConversation, conversation_id)
    if conversation is None:
        raise NotFound("Conversation introuvable")
    transcript = "\n".join(
        f"{'Visiteur' if m['role'] == 'user' else 'Assistant'} : {m['content']}" for m in conversation.messages[-20:]
    )
    lead = create_lead(
        db,
        data={
            "first_name": first_name,
            "phone": phone,
            "email": email,
            "message": f"{need or 'Demande de rappel via l’assistant en ligne'}\n\n— Conversation —\n{transcript}"[
                :4000
            ],
        },
        source="chatbot",
        form_key="assistant",
        consents={"contact": consent},
        ip=ip,
        user_agent=user_agent,
        landing_page=conversation.page_path,
    )
    conversation.lead_id = lead.id
    conversation.status = "lead"
    return {"lead_number": lead.number, "status": "received"}
