"""
Bureau d'Études Virtuel — Collaboration temps réel sur plans 2D/3D.
WebSocket + REST API pour gestion des sessions collaboratives.

Protocole WebSocket — Packet types:
- CURSOR_MOVE    : Position souris (haute fréquence, non persisté)
- CAMERA_SYNC   : Synchronisation caméra viewer (mode PRESENTER)
- MARKUP_ADD    : Nouvelle annotation sur une couche (persisté)
- MARKUP_DELETE : Suppression annotation
- SELECTION     : Sélection objet dans le viewer
- LAYER_TOGGLE  : Afficher/masquer une couche
- MODE_CHANGE   : Passer en mode FREE ou PRESENTER
- CHAT_MESSAGE  : Message texte en session
- USER_JOINED   : Nouveau participant (broadcast automatique)
- USER_LEFT     : Participant déconnecté (broadcast automatique)
- SESSION_ENDED : Session terminée par l'admin
- SNAPSHOT_TAKEN: Snapshot créé et partageable
"""
from typing import Optional, Dict, List
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
# pyrefly: ignore [missing-import]
from sqlalchemy import select
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
import json
import struct

from app.database import get_db
from app.auth.service import get_current_user, require_staff, require_admin
from app.auth.models import User
from app.models.erp import (
    CollaborationSession, SessionAnnotation, SessionSnapshot, Project,
    Employee, ProjectAssignment,
)

router = APIRouter(prefix="/collaboration", tags=["Bureau d'Études"])


async def _archive_pdf_to_ged(db, session, pdf_bytes: bytes, name: str,
                              shared_with_client: bool, uploaded_by: str):
    """Store a review PDF on S3/R2 (or local) and file it as a GED Document
    on the session's project. Returns the Document."""
    from app.models.erp import Document
    from app.services.storage_service import store_upload
    url, size_str, storage_key = await store_upload(
        pdf_bytes, f"{name}.pdf", "application/pdf", prefix="reviews", public=False,
    )
    doc = Document(
        project_id=session.project_id, name=name, file_url=url, storage_key=storage_key,
        file_size=size_str, mime_type="application/pdf", category="revue",
        shared_with_client=shared_with_client, uploaded_by=uploaded_by,
    )
    db.add(doc)
    await db.flush()
    doc.file_url = f"/api/v1/ged/documents/{doc.id}/download"
    return doc


async def _can_join_session(db: AsyncSession, user: User, session: CollaborationSession) -> bool:
    """Authorization for joining a collaboration session — guards against a
    staff member of *another* project joining (Section 7.8 security rec).

    Allowed: ADMIN · the session creator · the project's chef · staff assigned
    to the project · the project's own client (read-only).
    """
    if user.role == "ADMIN":
        return True
    if session.created_by == user.id:
        return True
    proj = (await db.execute(
        select(Project).where(Project.id == session.project_id)
    )).scalars().first()
    if not proj:
        return False
    if proj.chef_projet_id == user.id:
        return True
    if user.role == "CLIENT":
        return proj.client_id == user.id  # client of THIS project, view-only
    # Staff assigned to the project (User → Employee → ProjectAssignment)
    emp = (await db.execute(
        select(Employee).where(Employee.user_id == user.id, Employee.deleted_at.is_(None))
    )).scalars().first()
    if emp:
        assigned = (await db.execute(
            select(ProjectAssignment.id).where(
                ProjectAssignment.project_id == session.project_id,
                ProjectAssignment.worker_id == emp.id,
                ProjectAssignment.deleted_at.is_(None),
            )
        )).first()
        if assigned:
            return True
    return False


from app.utils.time import utcnow_naive as _now


# ── Role Colors ──────────────────────────────────────────────

_ROLE_COLORS: Dict[str, str] = {
    "ADMIN": "#ef4444",       # Rouge
    "CHEF_PROJET": "#f97316", # Orange
    "COMPTABLE": "#8b5cf6",   # Violet
    "RH": "#06b6d4",          # Cyan
    "CLIENT": "#6b7280",      # Gris
}


def _get_role_color(role: str) -> str:
    return _ROLE_COLORS.get(role, "#374151")


# ── WebSocket Connection Manager ─────────────────────────────

class CollaborationManager:
    """
    Manages WebSocket rooms per collaboration session.
    Each room is a dict of {user_id: websocket}.
    """

    def __init__(self):
        # session_id → {user_id: WebSocket}
        self.rooms: Dict[str, Dict[str, WebSocket]] = {}
        # session_id → {user_id: participant_info}
        self.participants: Dict[str, Dict[str, dict]] = {}

    async def connect(self, session_id: str, user: User, websocket: WebSocket):
        await websocket.accept()
        if session_id not in self.rooms:
            self.rooms[session_id] = {}
            self.participants[session_id] = {}

        # Assign a compact slot id (0-255) for the binary cursor protocol.
        used_slots = {p.get("slot") for p in self.participants[session_id].values()}
        slot = 0
        while slot in used_slots:
            slot += 1

        self.rooms[session_id][user.id] = websocket
        self.participants[session_id][user.id] = {
            "id": user.id,
            "name": f"{user.first_name} {user.last_name}".strip(),
            "role": user.role,
            "color": _get_role_color(user.role),
            "slot": slot,
        }

        # Notify existing participants of new arrival
        await self.broadcast(session_id, {
            "type": "USER_JOINED",
            "payload": self.participants[session_id][user.id],
        }, exclude=user.id)

    async def disconnect(self, session_id: str, user_id: str):
        if session_id not in self.rooms:
            return

        self.rooms[session_id].pop(user_id, None)
        self.participants[session_id].pop(user_id, None)

        if not self.rooms[session_id]:
            # Room is empty — clean up
            del self.rooms[session_id]
            del self.participants[session_id]
        else:
            await self.broadcast(session_id, {
                "type": "USER_LEFT",
                "payload": {"user_id": user_id},
            })

    async def broadcast(
        self,
        session_id: str,
        message: dict,
        exclude: Optional[str] = None,
    ):
        """Send a message to all participants in a room except the sender."""
        if session_id not in self.rooms:
            return
        dead = []
        for uid, ws in self.rooms[session_id].items():
            if uid == exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(uid)
        # Clean up dead connections
        for uid in dead:
            await self.disconnect(session_id, uid)

    def get_slot(self, session_id: str, user_id: str):
        info = self.participants.get(session_id, {}).get(user_id)
        return info.get("slot") if info else None

    async def broadcast_bytes(self, session_id: str, data: bytes, exclude: Optional[str] = None):
        """Broadcast a raw binary frame (compact cursor protocol)."""
        if session_id not in self.rooms:
            return
        dead = []
        for uid, ws in self.rooms[session_id].items():
            if uid == exclude:
                continue
            try:
                await ws.send_bytes(data)
            except Exception:
                dead.append(uid)
        for uid in dead:
            await self.disconnect(session_id, uid)

    async def send_to(self, session_id: str, user_id: str, message: dict):
        """Send a message to ONE participant (targeted WebRTC signaling)."""
        ws = self.rooms.get(session_id, {}).get(user_id)
        if ws is None:
            return
        try:
            await ws.send_json(message)
        except Exception:
            await self.disconnect(session_id, user_id)

    def get_participants(self, session_id: str) -> List[dict]:
        return list(self.participants.get(session_id, {}).values())

    def is_in_room(self, session_id: str, user_id: str) -> bool:
        return session_id in self.rooms and user_id in self.rooms[session_id]


# Global manager instance (stateful — use Redis pub/sub for multi-instance prod)
manager = CollaborationManager()


# ── Request Schemas ──────────────────────────────────────────

class SessionCreate(BaseModel):
    project_id: str
    plan_urn: str
    invited_user_ids: List[str] = []


class SnapshotCreate(BaseModel):
    image_url: str
    notes: str = ""
    shared_with_client: bool = False


# ── REST Endpoints ───────────────────────────────────────────

@router.post("/sessions")
async def create_session(
    data: SessionCreate,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new collaborative review session."""
    # Verify project exists
    proj_r = await db.execute(
        select(Project).where(Project.id == data.project_id, Project.deleted_at.is_(None))
    )
    project = proj_r.scalars().first()
    if not project:
        raise HTTPException(404, "Projet introuvable")

    session = CollaborationSession(
        project_id=data.project_id,
        plan_urn=data.plan_urn,
        created_by=user.id,
        status="ACTIVE",
        mode="FREE",
        started_at=_now(),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return {
        "session_id": session.id,
        "plan_urn": session.plan_urn,
        "status": session.status,
    }


@router.get("/sessions")
async def list_sessions(
    project_id: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """List collaboration sessions, optionally filtered by project."""
    query = select(CollaborationSession).order_by(CollaborationSession.started_at.desc())
    if project_id:
        query = query.where(CollaborationSession.project_id == project_id)

    r = await db.execute(query)
    sessions = r.scalars().all()

    return [
        {
            "id": s.id,
            "project_id": s.project_id,
            "plan_urn": s.plan_urn,
            "status": s.status,
            "mode": s.mode,
            "started_at": s.started_at,
            "ended_at": s.ended_at,
            "participants": manager.get_participants(s.id),
        }
        for s in sessions
    ]


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Get session details including live participants."""
    r = await db.execute(
        select(CollaborationSession).where(CollaborationSession.id == session_id)
    )
    session = r.scalars().first()
    if not session:
        raise HTTPException(404, "Session introuvable")

    return {
        "id": session.id,
        "project_id": session.project_id,
        "plan_urn": session.plan_urn,
        "status": session.status,
        "mode": session.mode,
        "presenter_id": session.presenter_id,
        "started_at": session.started_at,
        "ended_at": session.ended_at,
        "participants": manager.get_participants(session_id),
    }


@router.post("/sessions/{session_id}/end")
async def end_session(
    session_id: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """End a session and notify all participants."""
    r = await db.execute(
        select(CollaborationSession).where(CollaborationSession.id == session_id)
    )
    session = r.scalars().first()
    if not session:
        raise HTTPException(404, "Session introuvable")

    session.status = "ENDED"
    session.ended_at = _now()
    await db.commit()

    # Generate a session summary PDF (validated decisions + snapshots) → GED.
    summary_doc_id = None
    try:
        from app.services.collab_report import build_session_summary_pdf
        proj = (await db.execute(
            select(Project).where(Project.id == session.project_id)
        )).scalars().first()
        snaps = (await db.execute(
            select(SessionSnapshot).where(SessionSnapshot.session_id == session_id)
        )).scalars().all()
        decisions = (await db.execute(
            select(SessionAnnotation).where(
                SessionAnnotation.session_id == session_id,
                SessionAnnotation.is_validated.is_(True),
            )
        )).scalars().all()
        pdf = build_session_summary_pdf(
            project_code=(proj.code if proj else ""),
            project_name=(proj.name if proj else ""),
            started=session.started_at.strftime("%d/%m/%Y %H:%M") if session.started_at else "",
            ended=session.ended_at.strftime("%d/%m/%Y %H:%M") if session.ended_at else "",
            snapshots=[{
                "when": s.created_at.strftime("%d/%m/%Y %H:%M") if s.created_at else "",
                "notes": s.notes,
            } for s in snaps],
            decisions=[{
                "author_role": a.author_role, "layer": a.layer,
                "summary": str(a.markup_data)[:80],
            } for a in decisions],
        )
        stamp = session.started_at.strftime("%Y%m%d") if session.started_at else ""
        doc = await _archive_pdf_to_ged(
            db, session, pdf, name=f"Compte-rendu revue {stamp}".strip(),
            shared_with_client=False, uploaded_by=user.id,
        )
        await db.commit()
        summary_doc_id = doc.id
    except Exception as e:
        print(f"[collab] session summary PDF failed: {e}")

    # Notify all connected participants
    await manager.broadcast(session_id, {"type": "SESSION_ENDED"})

    return {"detail": "Session terminée", "summary_document_id": summary_doc_id}


@router.post("/sessions/{session_id}/snapshot")
async def take_snapshot(
    session_id: str,
    data: SnapshotCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Save a snapshot of the current viewer state + archive a timestamped PDF in the GED."""
    sess = (await db.execute(
        select(CollaborationSession).where(CollaborationSession.id == session_id)
    )).scalars().first()
    if not sess:
        raise HTTPException(404, "Session introuvable")

    snapshot = SessionSnapshot(
        session_id=session_id,
        captured_by=user.id,
        image_url=data.image_url,
        notes=data.notes,
        shared_with_client=data.shared_with_client,
    )
    db.add(snapshot)
    await db.commit()
    await db.refresh(snapshot)

    # Archive a timestamped PDF (image + note) in the project's GED.
    document_id = None
    try:
        from app.services.collab_report import build_snapshot_pdf
        proj = (await db.execute(
            select(Project).where(Project.id == sess.project_id)
        )).scalars().first()
        pdf = build_snapshot_pdf(
            image_url=data.image_url or "", notes=data.notes or "",
            project_code=(proj.code if proj else sess.project_id),
            author_name=f"{user.first_name} {user.last_name}".strip(),
            session_id=session_id,
        )
        doc = await _archive_pdf_to_ged(
            db, sess, pdf,
            name=f"Capture revue {_now().strftime('%Y%m%d-%H%M')}",
            shared_with_client=bool(data.shared_with_client), uploaded_by=user.id,
        )
        await db.commit()
        document_id = doc.id
    except Exception as e:
        print(f"[collab] snapshot PDF failed: {e}")

    # Broadcast to room
    await manager.broadcast(session_id, {
        "type": "SNAPSHOT_TAKEN",
        "payload": {
            "snapshot_id": snapshot.id,
            "image_url": data.image_url,
            "notes": data.notes,
            "by": f"{user.first_name} {user.last_name}".strip(),
            "shared_with_client": data.shared_with_client,
        },
    })

    return {"snapshot_id": snapshot.id, "document_id": document_id}


@router.get("/sessions/{session_id}/annotations")
async def list_annotations(
    session_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """List all annotations for a session."""
    r = await db.execute(
        select(SessionAnnotation)
        .where(SessionAnnotation.session_id == session_id)
        .order_by(SessionAnnotation.created_at)
    )
    return [
        {
            "id": a.id,
            "author_id": a.author_id,
            "author_role": a.author_role,
            "layer": a.layer,
            "markup_data": a.markup_data,
            "is_validated": a.is_validated,
            "validated_by": a.validated_by,
            "created_at": a.created_at,
        }
        for a in r.scalars().all()
    ]


@router.post("/sessions/{session_id}/annotations/{annotation_id}/validate")
async def validate_annotation(
    session_id: str,
    annotation_id: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Validate an annotation — moves it to the 'decisions' layer."""
    r = await db.execute(
        select(SessionAnnotation).where(SessionAnnotation.id == annotation_id)
    )
    annotation = r.scalars().first()
    if not annotation:
        raise HTTPException(404, "Annotation introuvable")

    annotation.is_validated = True
    annotation.validated_by = user.id
    annotation.validated_at = _now()
    annotation.layer = "decisions"  # Promote to decisions layer
    await db.commit()

    await manager.broadcast(session_id, {
        "type": "MARKUP_VALIDATE",
        "payload": {
            "markup_id": annotation_id,
            "validated_by": f"{user.first_name} {user.last_name}".strip(),
            "layer": "decisions",
        },
    })

    return {"detail": "Annotation validée"}


@router.get("/aps-token")
async def get_aps_token(user: User = Depends(require_staff)):
    """Exchange Autodesk Platform Services credentials for a viewer access token."""
    from app.services.aps_service import get_viewer_token
    token = await get_viewer_token()
    return {
        "access_token": token["access_token"],
        "expires_in": token.get("expires_in", 3599),
    }


@router.get("/ice-servers")
async def ice_servers(user: User = Depends(require_staff)):
    """ICE servers for the WebRTC visioconférence (public STUN + optional TURN)."""
    from app.config import get_settings
    s = get_settings()
    servers: list[dict] = [{"urls": s.STUN_URL or "stun:stun.l.google.com:19302"}]
    if s.TURN_URL:
        servers.append({
            "urls": s.TURN_URL,
            "username": s.TURN_USERNAME,
            "credential": s.TURN_CREDENTIAL,
        })
    return {"iceServers": servers}


# ── BIM upload + translation ─────────────────────────────────

from fastapi import UploadFile, File, Form  # noqa: E402


@router.post("/sessions/{session_id}/recording")
async def upload_recording(
    session_id: str,
    file: UploadFile = File(...),
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Upload the recorded session (audio + screen capture) → S3/R2 → recording_url."""
    sess = (await db.execute(
        select(CollaborationSession).where(CollaborationSession.id == session_id)
    )).scalars().first()
    if not sess:
        raise HTTPException(404, "Session introuvable")
    from app.services.storage_service import store_upload
    content = await file.read()
    url, _size, storage_key = await store_upload(
        content, f"recording-{session_id}.webm",
        file.content_type or "video/webm", prefix="recordings", public=False,
    )
    sess.recording_url = url or storage_key
    await db.commit()
    return {"recording_url": sess.recording_url, "storage_key": storage_key}


@router.post("/upload-bim")
async def upload_bim(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Upload a Revit/IFC/DWG/NWD file to APS OSS and trigger translation.

    Returns the URN to use when creating a collaboration session. The frontend
    should poll `/collaboration/translation-status/{urn}` until status == 'success'
    before opening the viewer.
    """
    from app.services.aps_service import upload_object, start_translation
    proj_r = await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
    )
    if not proj_r.scalars().first():
        raise HTTPException(404, "Projet introuvable")

    content = await file.read()
    if len(content) > 500 * 1024 * 1024:  # 500 MB
        raise HTTPException(413, "Fichier BIM trop volumineux (max 500 MB)")

    safe_name = (file.filename or "model.rvt").replace(" ", "_").replace("/", "_")
    urn = await upload_object(safe_name, content)
    job = await start_translation(urn)
    return {
        "urn": urn,
        "filename": safe_name,
        "translation_started": True,
        "result": job.get("result", ""),
    }


@router.get("/translation-status/{urn}")
async def translation_status(
    urn: str,
    user: User = Depends(require_staff),
):
    """Poll the manifest status of a translation job."""
    from app.services.aps_service import get_translation_status
    return await get_translation_status(urn)


# ── Snapshots listing ────────────────────────────────────────

@router.get("/sessions/{session_id}/snapshots")
async def list_snapshots(
    session_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """List all snapshots taken during the session."""
    r = await db.execute(
        select(SessionSnapshot)
        .where(SessionSnapshot.session_id == session_id)
        .order_by(SessionSnapshot.created_at.desc())
    )
    return [
        {
            "id": s.id,
            "image_url": s.image_url,
            "notes": s.notes,
            "shared_with_client": s.shared_with_client,
            "captured_by": s.captured_by,
            "created_at": s.created_at,
        }
        for s in r.scalars().all()
    ]


@router.patch("/snapshots/{snapshot_id}/share")
async def toggle_snapshot_share(
    snapshot_id: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Toggle the shared_with_client flag on a snapshot."""
    r = await db.execute(select(SessionSnapshot).where(SessionSnapshot.id == snapshot_id))
    snap = r.scalars().first()
    if not snap:
        raise HTTPException(404, "Snapshot introuvable")
    snap.shared_with_client = not snap.shared_with_client
    await db.commit()
    return {"shared_with_client": snap.shared_with_client}


# ── WebSocket Endpoint ───────────────────────────────────────

@router.websocket("/ws/{session_id}")
async def collaboration_websocket(
    websocket: WebSocket,
    session_id: str,
    token: str,  # JWT passed as query param: ?token=<access_token>
):
    """
    Real-time collaboration WebSocket endpoint.

    Connect: ws://api/v1/collaboration/ws/{session_id}?token={access_token}

    Packet format:
        { "type": "PACKET_TYPE", "payload": { ... } }
    """
    # Lazily import get_db to avoid circular imports
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        # ── Authentication ────────────────────────────────────
        try:
            from app.auth.service import decode_access_token
            payload = decode_access_token(token)
            user_id = payload.get("sub")
            if not user_id:
                await websocket.close(code=4001, reason="Token invalide")
                return

            user_r = await db.execute(
                select(User).where(User.id == user_id, User.deleted_at.is_(None))
            )
            user = user_r.scalars().first()
            if not user or not user.is_active:
                await websocket.close(code=4001, reason="Utilisateur introuvable ou inactif")
                return

        except Exception:
            await websocket.close(code=4001, reason="Token invalide")
            return

        # ── Session Validation ────────────────────────────────
        sess_r = await db.execute(
            select(CollaborationSession).where(
                CollaborationSession.id == session_id,
                CollaborationSession.status == "ACTIVE",
            )
        )
        session = sess_r.scalars().first()
        if not session:
            await websocket.close(code=4004, reason="Session introuvable ou terminée")
            return

        # ── Authorization: the user must belong to this project ──
        if not await _can_join_session(db, user, session):
            await websocket.close(code=4003, reason="Accès refusé à cette session")
            return

        # ── Connect to Room ───────────────────────────────────
        await manager.connect(session_id, user, websocket)

        # Send current state to new participant
        await websocket.send_json({
            "type": "SESSION_STATE",
            "payload": {
                "session_id": session_id,
                "mode": session.mode,
                "presenter_id": session.presenter_id,
                "participants": manager.get_participants(session_id),
            },
        })

        try:
            while True:
                msg = await websocket.receive()
                if msg.get("type") == "websocket.disconnect":
                    break

                # ── Binary cursor frame: [x:f32][y:f32][z:f32] (compact protocol) ──
                data_bytes = msg.get("bytes")
                if data_bytes is not None:
                    try:
                        x, y, z = struct.unpack("<fff", data_bytes[:12])
                    except Exception:
                        continue
                    slot = manager.get_slot(session_id, user.id)
                    if slot is not None:
                        # Relay [slot:u8][x][y][z] (13 bytes) — peers map slot→participant.
                        await manager.broadcast_bytes(
                            session_id, struct.pack("<Bfff", slot, x, y, z), exclude=user.id
                        )
                    continue

                raw = msg.get("text")
                if raw is None:
                    continue
                try:
                    packet = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                packet_type = packet.get("type", "")
                payload_data = packet.get("payload", {})

                # Enrich payload with sender metadata
                payload_data.update({
                    "sender_id": user.id,
                    "sender_name": f"{user.first_name} {user.last_name}".strip(),
                    "sender_role": user.role,
                    "color": _get_role_color(user.role),
                })

                # ── Packet Handlers ───────────────────────────

                if packet_type == "CURSOR_MOVE":
                    # High frequency — relay without DB persistence
                    await manager.broadcast(session_id, {
                        "type": "CURSOR_MOVE",
                        "payload": payload_data,
                    }, exclude=user.id)

                elif packet_type == "MARKUP_ADD":
                    # Clients are view-only — they may not annotate.
                    if user.role == "CLIENT":
                        continue
                    # Persist annotation to database
                    annotation = SessionAnnotation(
                        session_id=session_id,
                        author_id=user.id,
                        author_role=user.role,
                        layer=payload_data.get("layer", "general"),
                        markup_data=payload_data.get("svg_data", {}),
                    )
                    db.add(annotation)
                    await db.commit()
                    await db.refresh(annotation)

                    payload_data["annotation_id"] = annotation.id
                    await manager.broadcast(session_id, {
                        "type": "MARKUP_ADD",
                        "payload": payload_data,
                    }, exclude=user.id)

                elif packet_type == "MARKUP_DELETE":
                    markup_id = payload_data.get("markup_id")
                    ann_r = await db.execute(
                        select(SessionAnnotation).where(SessionAnnotation.id == markup_id)
                    )
                    ann = ann_r.scalars().first()
                    # Only author or admin can delete
                    if ann and (ann.author_id == user.id or user.role == "ADMIN"):
                        await db.delete(ann)
                        await db.commit()
                        await manager.broadcast(session_id, {
                            "type": "MARKUP_DELETE",
                            "payload": {"markup_id": markup_id},
                        })

                elif packet_type == "MODE_CHANGE":
                    # Only ADMIN can change session mode
                    if user.role == "ADMIN":
                        new_mode = payload_data.get("mode", "FREE")
                        session.mode = new_mode
                        session.presenter_id = user.id if new_mode == "PRESENTER" else None
                        await db.commit()

                        await manager.broadcast(session_id, {
                            "type": "MODE_CHANGE",
                            "payload": {
                                "mode": new_mode,
                                "presenter_id": session.presenter_id,
                                "presenter_name": f"{user.first_name} {user.last_name}".strip(),
                            },
                        })

                elif packet_type in ("RTC_OFFER", "RTC_ANSWER", "RTC_ICE"):
                    # WebRTC signaling — TARGETED relay to one peer (mesh).
                    target_id = payload_data.get("target_id")
                    if target_id:
                        await manager.send_to(session_id, target_id, {
                            "type": packet_type,
                            "payload": payload_data,  # carries sender_id
                        })

                elif packet_type in (
                    "CAMERA_SYNC", "SELECTION", "LAYER_TOGGLE", "CHAT_MESSAGE",
                    "MEASURE_SHARE", "MEDIA_STATE", "MARKUP_INTENT",
                ):
                    # Simple relay to all other participants
                    await manager.broadcast(session_id, {
                        "type": packet_type,
                        "payload": payload_data,
                    }, exclude=user.id)

        except WebSocketDisconnect:
            await manager.disconnect(session_id, user.id)
        except Exception as e:
            print(f"[WS Error] session={session_id} user={user.id}: {e}")
            await manager.disconnect(session_id, user.id)
