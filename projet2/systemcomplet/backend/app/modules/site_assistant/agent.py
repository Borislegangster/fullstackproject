"""Boucle de travail de l'assistant du site : Claude (SDK officiel Anthropic) lit le site, rédige et règle ce qu'on
lui demande au moyen des outils de `tools.py`, jusqu'à avoir fini ou atteint la limite d'étapes.

Exécutée en arrière-plan (un tour peut durer plusieurs minutes) : l'écran suit l'avancement en relisant la
conversation. L'historique envoyé au modèle est conservé tel quel et seulement allongé (jamais réécrit) ; les
images et PDF y figurent par référence (médiathèque, fichier privé) et sont rechargés à l'identique à chaque appel.
"""

from __future__ import annotations

import base64
import logging
import time
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.core.context import get_context
from app.core.database import SessionLocal
from app.core.utils import utcnow
from app.modules.site_assistant import cms_ops
from app.modules.site_assistant.models import SiteAssistantMessage, SiteAssistantSession, stamp
from app.modules.site_assistant.tools import TOOLS_BY_NAME, ToolContext, add_step, image_block, run_tool, tools_for
from app.providers.ai import get_ai_provider

log = logging.getLogger("globus.site_assistant")

FALLBACK_BETA = "server-side-fallback-2026-07-01"
MAX_STEPS = 60
MAX_TOKENS = 32000
EFFORT = "medium"
# Recherche et lecture web (veille, mots-clés, page de référence donnée par l'utilisateur) : outils serveur Anthropic.
WEB_TOOLS = [
    {"type": "web_search_20260209", "name": "web_search", "max_uses": 5},
    {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 5},
]
_web_tools_enabled = True

SYSTEM = """Tu es l'assistant éditorial du site web de GLOBUS ENGINEERING, entreprise camerounaise de bâtiment et \
travaux publics (conception, calcul, construction, contrôle ; clients au Cameroun et surtout dans la diaspora). Tu \
gères le contenu de la vitrine de bout en bout dans le back-office, avec les outils fournis : pages composées de \
sections et de blocs, collections (univers, offres, expertises, services, réalisations, articles de blog, articles \
d'aide, FAQ, témoignages, équipe, partenaires, certifications, chiffres clés, vidéos, bannières), menus, réglages \
généraux, médiathèque, SEO et fréquentation. La personne qui te confie le travail relit les aperçus et valide : \
prépare tout pour qu'elle n'ait plus qu'à vérifier et publier.

Ta façon de travailler :
- Réponds et rédige en français, avec un ton professionnel, clair et chaleureux, adapté au BTP au Cameroun et à la \
diaspora (confiance, suivi à distance, transparence).
- Travail d'ensemble (« complète le site », « améliore les pages ») : lance d'abord audit_site_content, puis traite \
les pages par ordre d'importance (accueil, offres, services, expertises, réalisations, blog, FAQ, aide, pages \
annexes). Pour chaque page : lis-la (get_content), complète ce qui manque (sections, textes, images, appels à \
l'action, SEO) en gardant ce qui est bon, et donne une page cohérente : accroche, bénéfices, preuves disponibles, \
étapes, questions, appel à l'action.
- Avant de créer ou modifier un élément, consulte sa structure (describe_fields) et l'élément lui-même \
(get_content). Respecte les longueurs, les blocs et les choix proposés. Pour une page, envoie la page complète.
- Une page déjà proposée (proposition_en_attente) se reprend à partir de la version proposée : ta nouvelle version \
la remplace. Regroupe tes changements sur une page en une seule proposition complète plutôt qu'en plusieurs.
- N'invente aucun fait : prix, délais, chiffres, références de chantiers, réalisations, certifications, partenaires, \
noms de personnes ou témoignages viennent des données fournies par l'utilisateur, de l'ERP ou de ce qui est déjà \
sur le site. Tu peux rédiger des contenus de conseil et d'explication (articles, FAQ générales, étapes d'un projet, \
bonnes pratiques de construction au Cameroun) en t'appuyant sur des sources fiables (recherche web). Ne crée jamais \
de réalisation, de témoignage, de membre d'équipe ou de chiffre clé fictif : signale ce qu'il faut fournir.
- Images : cherche d'abord dans la médiathèque (search_media, puis view_media pour vérifier qu'elle convient). S'il \
n'y a rien d'adapté et que generate_image est disponible, génère une illustration réaliste et professionnelle \
(chantier, bâtiment, intérieur, matériaux, ville d'Afrique centrale, étude sur plans…), décrite précisément, au bon \
format (16:9 bannière, 3:2 ou 4:3 section ou carte, 1:1 vignette). Regarde le résultat et refais-la si elle n'est \
pas crédible. Une image générée est une illustration : jamais présentée comme une réalisation, un chantier, un \
membre de l'équipe, un client ou un témoignage de GLOBUS. Chaque image utilisée a un texte alternatif utile.
- Tu ne publies jamais toi-même. Les créations et les modifications de brouillons s'appliquent directement ; tout \
ce que voient les visiteurs (contenu publié, SEO d'un contenu publié, médias, menus, réglages, redirections, \
publication, retrait) devient une proposition que la personne regarde en aperçu puis valide. Pour mettre en ligne \
un brouillon prêt, utilise request_publication.
- SEO : titre de 50 à 60 caractères, méta-description de 120 à 155 caractères, un seul H1, mots-clés réalistes \
(villes du Cameroun, diaspora, types d'ouvrages, services), image de partage quand elle existe.
- Textes alternatifs : regarde l'image (view_media) et décris ce qu'elle montre utilement, en 125 caractères au plus, \
sans « image de ».
- Images jointes par l'utilisateur : elles sont déjà dans la médiathèque (identifiant indiqué) et sont à préférer \
aux images générées.
- Pour un travail en série, avance par lots et indique où tu en es ; si la limite d'étapes approche, termine \
proprement l'élément en cours et dis ce qu'il reste.
- Termine chaque tour par un compte rendu court : pages et éléments complétés (brouillons, propositions à valider \
avec aperçu), images ajoutées, et ce qu'il reste à faire ou à fournir (photos de chantiers réels, témoignages, \
chiffres)."""


def availability() -> dict[str, Any]:
    provider = get_ai_provider()
    if provider is None:
        return {
            "available": False,
            "reason": "La clé de l'API Claude n'est pas configurée "
            "(Paramètres › Intégrations, secret ANTHROPIC_API_KEY).",
        }
    return {"available": True, "model": provider.model}


# ---------------------------------------------------------------------------- historique → requête
def _file_document(db: Session, file_id: str, media_type: str) -> dict[str, Any] | None:
    from app.core.files import read_private
    from app.modules.system.models import StoredFile

    stored = db.get(StoredFile, uuid.UUID(file_id))
    if stored is None:
        return None
    data = base64.standard_b64encode(read_private(stored)).decode("ascii")
    return {"type": "document", "source": {"type": "base64", "media_type": media_type, "data": data}}


def _expand_block(db: Session, block: dict[str, Any]) -> dict[str, Any]:
    source = block.get("source") if isinstance(block, dict) else None
    if not isinstance(source, dict):
        if block.get("type") == "tool_result" and isinstance(block.get("content"), list):
            return {**block, "content": [_expand_block(db, b) for b in block["content"]]}
        return block
    if source.get("type") == "media_ref":
        from app.modules.cms import media as media_svc

        try:
            expanded = image_block(media_svc.get_media(db, uuid.UUID(source["media_id"])))
        except Exception:  # noqa: BLE001 — média supprimé depuis : le modèle est prévenu
            expanded = None
        return expanded or {"type": "text", "text": f"[image {source['media_id']} indisponible]"}
    if source.get("type") == "file_ref":
        expanded = _file_document(db, source["file_id"], source.get("media_type", "application/pdf"))
        return expanded or {"type": "text", "text": "[document indisponible]"}
    return block


def expand(db: Session, transcript: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for message in transcript:
        content = message["content"]
        if isinstance(content, list):
            content = [_expand_block(db, b) for b in content]
        out.append({"role": message["role"], "content": content})
    return out


def _dump(block: Any) -> dict[str, Any]:
    return block.model_dump(mode="json", exclude_none=True) if hasattr(block, "model_dump") else dict(block)


# ---------------------------------------------------------------------------- appel du modèle
def call_model(client: Any, model: str, tools: list[dict[str, Any]], messages: list[dict[str, Any]]) -> Any:
    """Un appel Messages API en flux (réponses longues sans délai d'attente HTTP), repli serveur sur refus."""
    with client.beta.messages.stream(
        model=model,
        max_tokens=MAX_TOKENS,
        system=SYSTEM,
        tools=tools,
        messages=messages,
        thinking={"type": "adaptive"},
        output_config={"effort": EFFORT},
        cache_control={"type": "ephemeral"},
        betas=[FALLBACK_BETA],
        fallbacks="default",
    ) as stream:
        return stream.get_final_message()


def _api_error(exc: Exception) -> str:
    import anthropic

    if isinstance(exc, anthropic.RateLimitError):
        return "Limite d'utilisation de l'API Claude atteinte : réessayez dans quelques minutes."
    if isinstance(exc, anthropic.AuthenticationError):
        return "Clé de l'API Claude refusée : vérifiez-la dans Paramètres › Intégrations."
    if isinstance(exc, anthropic.BadRequestError):
        return f"Requête refusée par l'API Claude : {exc.message}"
    if isinstance(exc, anthropic.APIStatusError):
        return f"Erreur de l'API Claude ({exc.status_code}) : réessayez."
    if isinstance(exc, anthropic.APIConnectionError):
        return "API Claude injoignable : vérifiez la connexion du serveur et réessayez."
    return "Erreur inattendue pendant le travail de l'assistant."


def _record_usage(db: Session, session: SiteAssistantSession, response: Any, started: float, step: int) -> None:
    from app.modules.ai.service import _record
    from app.providers.ai import AIResult

    usage = getattr(response, "usage", None)
    tokens_in = sum(
        int(getattr(usage, name, 0) or 0)
        for name in ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")
    )
    tokens_out = int(getattr(usage, "output_tokens", 0) or 0)
    session.input_tokens = (session.input_tokens or 0) + tokens_in
    session.output_tokens = (session.output_tokens or 0) + tokens_out
    session.model = getattr(response, "model", None) or session.model
    _record(
        db,
        feature="site_assistant",
        user_id=session.user_id,
        entity_type="site_assistant_session",
        entity_id=session.id,
        source=f"{session.id}:{len(session.transcript or [])}:{step}",
        result=AIResult(
            model=session.model,
            input_tokens=tokens_in,
            output_tokens=tokens_out,
            duration_ms=int((time.perf_counter() - started) * 1000),
            stop_reason=getattr(response, "stop_reason", None),
        ),
        validation="not_required",
    )


# ---------------------------------------------------------------------------- tour de travail
def _finish(db: Session, session: SiteAssistantSession, *, error: str | None = None) -> None:
    session.state = "error" if error else "idle"
    session.error = error
    if error:
        db.add(SiteAssistantMessage(created_at=stamp(), session_id=session.id, role="assistant", text=f"⚠️ {error}"))
    db.commit()


def run_turn(session_id: uuid.UUID) -> None:
    """Traite la dernière consigne de la conversation (appelé en arrière-plan)."""
    global _web_tools_enabled
    db = SessionLocal()
    session: SiteAssistantSession | None = None
    try:
        session = db.get(SiteAssistantSession, session_id)
        if session is None:
            return
        provider = get_ai_provider()
        if provider is None:
            _finish(db, session, error=availability()["reason"])
            return
        principal = cms_ops.principal_for(db, session.user_id)
        get_context().user_id = str(principal.id)
        ctx = ToolContext(db=db, principal=principal, session=session)
        client_tools = [t.definition() for t in tools_for(principal)]
        transcript = list(session.transcript or [])
        for step in range(MAX_STEPS):
            tool_defs = client_tools + (WEB_TOOLS if _web_tools_enabled else [])
            started = time.perf_counter()
            try:
                response = call_model(provider.client, provider.model, tool_defs, expand(db, transcript))
            except Exception as exc:  # noqa: BLE001 — erreurs SDK traduites pour l'utilisateur
                import anthropic

                if _web_tools_enabled and isinstance(exc, anthropic.BadRequestError) and "web_" in str(exc.message):
                    _web_tools_enabled = False  # recherche web non activée pour l'organisation : sans elle
                    continue
                log.warning("assistant du site : appel Claude en échec (%s)", type(exc).__name__)
                _finish(db, session, error=_api_error(exc))
                return
            _record_usage(db, session, response, started, step)
            stop = getattr(response, "stop_reason", None)
            if stop == "refusal":
                _finish(db, session, error="Claude a décliné cette demande. Reformulez-la ou précisez le contexte.")
                return
            if stop == "max_tokens":
                _finish(db, session, error="Réponse trop longue pour un seul passage : découpez la demande en étapes.")
                return
            content = [_dump(b) for b in response.content if getattr(b, "type", None) != "fallback"]
            transcript.append({"role": "assistant", "content": content})
            text = "\n\n".join(b.get("text", "") for b in content if b.get("type") == "text").strip()
            if text:
                db.add(SiteAssistantMessage(created_at=stamp(), session_id=session.id, role="assistant", text=text))
            tool_uses = [b for b in content if b.get("type") == "tool_use"]
            if stop == "pause_turn":
                session.transcript = list(transcript)
                db.commit()
                continue
            if stop != "tool_use" or not tool_uses:
                session.transcript = list(transcript)
                break
            results = []
            for use in tool_uses:
                tool = TOOLS_BY_NAME.get(use.get("name", ""))
                add_step(db, session, tool.step if tool else use.get("name", "outil"))
                output, is_error = run_tool(ctx, use.get("name", ""), use.get("input"))
                # Validation après chaque outil : les verrous pris (journal d'audit…) sont libérés avant l'outil
                # suivant, qui peut attendre longtemps un service externe (génération d'image).
                db.commit()
                result: dict[str, Any] = {"type": "tool_result", "tool_use_id": use["id"], "content": output}
                if is_error:
                    result["is_error"] = True
                results.append(result)
            transcript.append({"role": "user", "content": results})
            session.transcript = list(transcript)
            db.commit()
        else:
            db.add(
                SiteAssistantMessage(
                    created_at=stamp(),
                    session_id=session.id,
                    role="assistant",
                    text="J'ai atteint la limite d'étapes pour cette consigne. "
                    "Répondez « continue » pour que je poursuive.",
                )
            )
        session.last_run_at = utcnow()
        _finish(db, session)
    except Exception:
        log.exception("assistant du site : tour en échec")
        db.rollback()
        if session is not None:
            session = db.get(SiteAssistantSession, session_id)
            if session is not None:
                _finish(db, session, error="Erreur inattendue pendant le travail de l'assistant. Réessayez.")
    finally:
        db.close()
