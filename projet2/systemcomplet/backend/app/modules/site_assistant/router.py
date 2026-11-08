"""API de l'assistant du site (Claude) : conversations, consignes avec pièces jointes (images → médiathèque, PDF,
Word, Excel, textes), suivi du travail, validation ou rejet des propositions."""

from __future__ import annotations

import io
import uuid
from datetime import timedelta
from pathlib import PurePath
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.access import Access, get_access
from app.core.database import get_db
from app.core.errors import AppError, BusinessRuleError, Conflict, NotFound
from app.core.ratelimit import rate_limit
from app.core.utils import jsonable, utcnow
from app.modules.site_assistant import agent
from app.modules.site_assistant.models import SiteAssistantAction, SiteAssistantMessage, SiteAssistantSession, stamp
from app.modules.site_assistant.tools import apply_action

router = APIRouter(prefix="/site-assistant", tags=["Assistant du site (Claude)"])

MAX_FILES = 10
MAX_FILE_MB = 25
MAX_TEXT_CHARS = 150_000
STALE_AFTER = timedelta(minutes=20)
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
TEXT_EXT = {".txt", ".md", ".csv", ".json", ".html", ".htm", ".xml"}
# Tarif public de Claude Opus 5.5 ($ par million de jetons) : estimation haute (les lectures de cache coûtent moins).
PRICE_IN, PRICE_OUT = 4.0, 20.0


def _require(access: Access) -> None:
    access.require("cms:write")


def _own_session(db: Session, access: Access, session_id: uuid.UUID) -> SiteAssistantSession:
    session = db.get(SiteAssistantSession, session_id)
    if session is None or session.user_id != access.p.id or session.archived_at is not None:
        raise NotFound("Conversation introuvable")
    if session.state == "running" and session.updated_at and utcnow() - session.updated_at > STALE_AFTER:
        session.state = "error"
        session.error = "Le travail a été interrompu (redémarrage du serveur ?). Renvoyez votre consigne."
        db.commit()
    return session


def _action_out(a: SiteAssistantAction) -> dict[str, Any]:
    return {
        "id": a.id,
        "tool": a.tool,
        "summary": a.summary,
        "status": a.status,
        "target_type": a.target_type,
        "target_id": a.target_id,
        "target_label": a.target_label,
        "payload": a.payload,
        "result": a.result,
        "error": a.error,
        "created_at": a.created_at,
        "decided_at": a.decided_at,
    }


def _session_out(db: Session, session: SiteAssistantSession, *, full: bool = False) -> dict[str, Any]:
    pending = db.scalar(
        select(func.count())
        .select_from(SiteAssistantAction)
        .where(SiteAssistantAction.session_id == session.id, SiteAssistantAction.status == "proposed")
    )
    data: dict[str, Any] = {
        "id": session.id,
        "title": session.title,
        "state": session.state,
        "error": session.error,
        "updated_at": session.updated_at,
        "pending_actions": pending or 0,
        "usage": {
            "input_tokens": session.input_tokens,
            "output_tokens": session.output_tokens,
            "estimated_usd": round(session.input_tokens * PRICE_IN / 1e6 + session.output_tokens * PRICE_OUT / 1e6, 2),
            "model": session.model,
        },
    }
    if full:
        messages = db.execute(
            select(SiteAssistantMessage)
            .where(SiteAssistantMessage.session_id == session.id)
            .order_by(SiteAssistantMessage.created_at, SiteAssistantMessage.id)
        ).scalars()
        actions = db.execute(
            select(SiteAssistantAction)
            .where(SiteAssistantAction.session_id == session.id)
            .order_by(SiteAssistantAction.created_at, SiteAssistantAction.id)
        ).scalars()
        data["messages"] = [
            {"id": x.id, "role": x.role, "text": x.text, "attachments": x.attachments, "created_at": x.created_at}
            for x in messages
        ]
        data["actions"] = [_action_out(a) for a in actions]
    return jsonable(data)


# ---------------------------------------------------------------------------- disponibilité, conversations
@router.get("/status")
def status(access: Access = Depends(get_access)) -> dict[str, Any]:
    _require(access)
    return {**agent.availability(), "can_publish": access.has("cms:publish")}


@router.get("/sessions")
def list_sessions(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    _require(access)
    rows = db.execute(
        select(SiteAssistantSession)
        .where(SiteAssistantSession.user_id == access.p.id, SiteAssistantSession.archived_at.is_(None))
        .order_by(SiteAssistantSession.updated_at.desc())
        .limit(100)
    ).scalars()
    return [_session_out(db, s) for s in rows]


class SessionIn(BaseModel):
    title: str | None = Field(default=None, max_length=200)


@router.post("/sessions", status_code=201)
def create_session(
    data: SessionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    _require(access)
    session = SiteAssistantSession(user_id=access.p.id, title=(data.title or "").strip() or "Nouvelle demande")
    db.add(session)
    db.commit()
    return _session_out(db, session, full=True)


@router.get("/sessions/{session_id}")
def get_session(
    session_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    _require(access)
    return _session_out(db, _own_session(db, access, session_id), full=True)


@router.delete("/sessions/{session_id}")
def archive_session(
    session_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, str]:
    _require(access)
    session = _own_session(db, access, session_id)
    if session.state == "running":
        raise Conflict("Claude travaille encore sur cette conversation", code="ASSISTANT_RUNNING")
    session.archived_at = utcnow()
    db.commit()
    return {"status": "archived"}


# ---------------------------------------------------------------------------- consignes et pièces jointes
def _attachment(
    db: Session, access: Access, upload: UploadFile, data: bytes
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Pièce jointe → blocs pour Claude (images et PDF par référence) + résumé affiché dans le fil."""
    from app.core.files import store_private, validate_upload
    from app.modules.cms import media as media_svc
    from app.modules.cms.models import MediaAsset

    name = upload.filename or "fichier"
    ext = PurePath(name).suffix.lower()
    if len(data) > MAX_FILE_MB * 1024 * 1024:
        raise BusinessRuleError(f"« {name} » dépasse {MAX_FILE_MB} Mo", code="FILE_TOO_LARGE")
    if ext in IMAGE_EXT:
        try:
            asset = media_svc.upload_media(
                db,
                filename=name,
                data=data,
                title=PurePath(name).stem[:250],
                alt_text=None,
                folder="assistant",
                tags=["assistant"],
                author_id=access.p.id,
            )
        except Conflict:
            from app.core.files import validate_upload as _validate

            checksum = _validate(name, data, category="media", max_mb=MAX_FILE_MB).sha256
            asset = db.execute(
                select(MediaAsset).where(MediaAsset.checksum_sha256 == checksum, MediaAsset.deleted_at.is_(None))
            ).scalar_one()
        db.flush()
        blocks = [
            {"type": "image", "source": {"type": "media_ref", "media_id": str(asset.id)}},
            {"type": "text", "text": f"(Image jointe « {name} » — déjà dans la médiathèque, identifiant {asset.id}.)"},
        ]
        return blocks, {"kind": "image", "name": name, "media_id": str(asset.id), "size": len(data)}
    if ext == ".pdf":
        stored = store_private(
            db,
            validate_upload(name, data, category="document", max_mb=MAX_FILE_MB),
            purpose="site_assistant",
            uploaded_by_id=access.p.id,
        )
        blocks = [
            {
                "type": "document",
                "source": {"type": "file_ref", "file_id": str(stored.id), "media_type": "application/pdf"},
            },
            {"type": "text", "text": f"(Document joint « {name} ».)"},
        ]
        return blocks, {"kind": "document", "name": name, "file_id": str(stored.id), "size": len(data)}
    text = _extract_text(name, ext, data)
    if len(text) > MAX_TEXT_CHARS:
        raise BusinessRuleError(
            f"« {name} » est trop long ({len(text)} caractères, {MAX_TEXT_CHARS} au plus) : découpez-le",
            code="FILE_TOO_LONG",
        )
    blocks = [{"type": "text", "text": f"Contenu du fichier joint « {name} » :\n\n{text}"}]
    return blocks, {"kind": "text", "name": name, "size": len(data)}


def _extract_text(name: str, ext: str, data: bytes) -> str:
    if ext in TEXT_EXT:
        return data.decode("utf-8", errors="replace")
    if ext == ".docx":
        import docx

        document = docx.Document(io.BytesIO(data))
        parts = [p.text for p in document.paragraphs if p.text.strip()]
        for table in document.tables:
            for row in table.rows:
                parts.append(" | ".join(cell.text.strip() for cell in row.cells))
        return "\n".join(parts)
    if ext == ".xlsx":
        import openpyxl

        book = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        parts = []
        for sheet in book.worksheets:
            parts.append(f"## Feuille « {sheet.title} »")
            for row in sheet.iter_rows(values_only=True):
                if any(v not in (None, "") for v in row):
                    parts.append(" | ".join("" if v is None else str(v) for v in row))
        return "\n".join(parts)
    raise BusinessRuleError(
        f"« {name} » : format non pris en charge (images, PDF, Word .docx, Excel .xlsx, textes .txt/.md/.csv)",
        code="UNSUPPORTED_FILE_TYPE",
    )


@router.post("/sessions/{session_id}/messages", status_code=202)
async def send_message(
    session_id: uuid.UUID,
    background: BackgroundTasks,
    text: str = Form("", max_length=20_000),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
    _: None = Depends(rate_limit("site-assistant", "120/hour")),
) -> dict[str, Any]:
    """Nouvelle consigne : enregistrée, puis traitée en arrière-plan (l'écran suit l'avancement)."""
    _require(access)
    availability = agent.availability()
    if not availability["available"]:
        raise BusinessRuleError(availability["reason"], code="ASSISTANT_UNAVAILABLE")
    session = _own_session(db, access, session_id)
    if session.state == "running":
        raise Conflict("Claude travaille encore sur la consigne précédente", code="ASSISTANT_RUNNING")
    if not text.strip() and not files:
        raise BusinessRuleError("Écrivez une consigne ou joignez un fichier", code="EMPTY_MESSAGE")
    if len(files) > MAX_FILES:
        raise BusinessRuleError(f"{MAX_FILES} fichiers au plus par message", code="TOO_MANY_FILES")
    blocks: list[dict[str, Any]] = []
    shown: list[dict[str, Any]] = []
    for upload in files:
        try:
            parts, meta = _attachment(db, access, upload, await upload.read())
        except AppError:
            db.rollback()
            raise
        blocks.extend(parts)
        shown.append(meta)
    instruction = text.strip() or "Voici des fichiers : examine-les et dis-moi ce que tu proposes d'en faire."
    blocks.append({"type": "text", "text": instruction})
    session.transcript = [*(session.transcript or []), {"role": "user", "content": blocks}]
    db.add(
        SiteAssistantMessage(
            created_at=stamp(), session_id=session.id, role="user", text=text.strip() or None, attachments=shown
        )
    )
    if session.title == "Nouvelle demande":
        session.title = (instruction.splitlines()[0] if instruction else "Demande")[:120]
    session.state = "running"
    session.error = None
    session.updated_at = utcnow()
    db.commit()
    out = _session_out(db, session, full=True)
    db.commit()  # transaction de lecture close avant le travail en arrière-plan
    background.add_task(agent.run_turn, session.id)
    return out


# ---------------------------------------------------------------------------- validation des propositions
def _own_action(db: Session, access: Access, action_id: uuid.UUID) -> SiteAssistantAction:
    action = db.get(SiteAssistantAction, action_id)
    if action is None:
        raise NotFound("Proposition introuvable")
    _own_session(db, access, action.session_id)
    return action


def _apply(db: Session, access: Access, action: SiteAssistantAction) -> None:
    if action.status != "proposed":
        raise Conflict("Proposition déjà traitée", code="ALREADY_DECIDED")
    try:
        action.result = jsonable(apply_action(db, access.p, action))
    except ValidationError as exc:
        raise BusinessRuleError(
            f"Proposition devenue invalide : {exc.errors()[0].get('msg')}", code="INVALID_PROPOSAL"
        ) from exc
    action.status = "accepted"
    action.error = None
    action.decided_by_id = access.p.id
    action.decided_at = utcnow()


@router.post("/actions/{action_id}/apply")
def apply(action_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """Applique une proposition de Claude avec VOS droits (publication : droit cms:publish)."""
    _require(access)
    action = _own_action(db, access, action_id)
    _apply(db, access, action)
    db.commit()
    return jsonable(_action_out(action))


@router.post("/actions/{action_id}/reject")
def reject(action_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    _require(access)
    action = _own_action(db, access, action_id)
    if action.status != "proposed":
        raise Conflict("Proposition déjà traitée", code="ALREADY_DECIDED")
    action.status = "rejected"
    action.decided_by_id = access.p.id
    action.decided_at = utcnow()
    db.commit()
    return jsonable(_action_out(action))


@router.post("/sessions/{session_id}/apply-all")
def apply_all(
    session_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Applique toutes les propositions en attente, dans l'ordre ; une proposition refusée n'arrête pas les autres."""
    _require(access)
    session = _own_session(db, access, session_id)
    pending = (
        db.execute(
            select(SiteAssistantAction)
            .where(SiteAssistantAction.session_id == session.id, SiteAssistantAction.status == "proposed")
            .order_by(SiteAssistantAction.created_at, SiteAssistantAction.id)
        )
        .scalars()
        .all()
    )
    done, errors = [], []
    for action in pending:
        savepoint = db.begin_nested()
        try:
            _apply(db, access, action)
            savepoint.commit()
            done.append(str(action.id))
        except AppError as exc:
            savepoint.rollback()
            errors.append({"id": str(action.id), "summary": action.summary, "message": exc.message})
    db.commit()
    return {"done": done, "errors": errors}
