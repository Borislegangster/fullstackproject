"""Time-lapse hebdomadaire des chantiers (innovation R2).

Images retenues (jamais de photo interne non publiée) :
  1. les clichés des caméras 4G du chantier (point de vue fixe : rendu le plus parlant) ;
  2. à défaut, les photos publiées au client sur la période.
Chaque image est redressée (EXIF), cadrée en 16:9 (1280×720), datée en surimpression ; un carton d'ouverture et de
clôture encadrent la vidéo. Encodage H.264 (ffmpeg embarqué), compatible WhatsApp et navigateurs.
Le lundi, le client reçoit la vidéo dans son espace et, s'il l'a accepté, sur WhatsApp (modèle approuvé).
"""

from __future__ import annotations

import io
import logging
import subprocess
import tempfile
import uuid
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont, ImageOps
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError, NotFound
from app.core.events import emit
from app.core.security import random_token, sha256_hex
from app.core.utils import utcnow
from app.modules.timelapse.models import SiteCamera, Timelapse

log = logging.getLogger("globus.timelapse")

WIDTH, HEIGHT = 1280, 720
FPS = 24
MIN_FRAMES = 4
MAX_FRAMES = 240
CARD_SECONDS = 1.6
BRAND = (56, 90, 166)
ACCENT = (251, 140, 67)


# ---------------------------------------------------------------------------- caméras 4G
def create_camera(
    db: Session, project_id: uuid.UUID, name: str, *, user_id: uuid.UUID | None
) -> tuple[SiteCamera, str]:
    token = "cam_" + random_token(32)
    camera = SiteCamera(
        project_id=project_id,
        name=name.strip()[:120],
        token_hash=sha256_hex(token),
        token_hint=token[-6:],
        created_by_id=user_id,
    )
    db.add(camera)
    db.flush()
    return camera, token


def camera_for_token(db: Session, token: str | None) -> SiteCamera:
    if not token:
        raise AppError("Jeton caméra manquant", code="UNAUTHORIZED", status_code=401)
    camera = db.execute(select(SiteCamera).where(SiteCamera.token_hash == sha256_hex(token))).scalar_one_or_none()
    if camera is None or not camera.active:
        raise AppError("Caméra inconnue ou désactivée", code="UNAUTHORIZED", status_code=401)
    return camera


def ingest_snapshot(db: Session, camera: SiteCamera, *, filename: str, data: bytes, taken_at: datetime | None) -> Any:
    from app.core.files import store_private, validate_upload
    from app.modules.projects.models import SiteMedia

    upload = validate_upload(filename or "snapshot.jpg", data, category="image", max_mb=15)
    stored = store_private(db, upload, purpose="site_camera", classification="internal")
    media = SiteMedia(
        project_id=camera.project_id,
        file_id=stored.id,
        media_type="photo",
        caption=f"Caméra {camera.name}",
        stage="during",
        taken_at=taken_at or stored.taken_at or utcnow(),
        published_to_client=False,
        tags=["camera", str(camera.id)],
    )
    db.add(media)
    camera.last_seen_at = utcnow()
    camera.snapshots = (camera.snapshots or 0) + 1
    db.flush()
    return media


# ---------------------------------------------------------------------------- images
def _bounds(start: date, end: date) -> tuple[datetime, datetime]:
    tz = utcnow().tzinfo
    return datetime.combine(start, time.min).replace(tzinfo=tz), datetime.combine(
        end + timedelta(days=1), time.min
    ).replace(tzinfo=tz)


def select_frames(db: Session, project_id: uuid.UUID, start: date, end: date) -> tuple[str, list[tuple[Any, Any]]]:
    """(source, [(SiteMedia, StoredFile)]) — caméras d'abord, sinon photos publiées ; échantillonnage régulier."""
    from app.modules.projects.models import SiteMedia
    from app.modules.system.models import StoredFile

    since, until = _bounds(start, end)
    taken = func.coalesce(SiteMedia.taken_at, SiteMedia.created_at)
    base = (
        select(SiteMedia, StoredFile)
        .join(StoredFile, StoredFile.id == SiteMedia.file_id)
        .where(
            SiteMedia.project_id == project_id,
            SiteMedia.media_type == "photo",
            taken >= since,
            taken < until,
            StoredFile.deleted_at.is_(None),
        )
        .order_by(taken, SiteMedia.created_at)
    )
    rows = db.execute(base).all()
    camera = [(m, f) for m, f in rows if "camera" in (m.tags or [])]
    published = [(m, f) for m, f in rows if m.published_to_client and "camera" not in (m.tags or [])]
    source, chosen = ("camera", camera) if len(camera) >= MIN_FRAMES * 2 else ("photos", published)
    if len(chosen) > MAX_FRAMES:
        step = len(chosen) / MAX_FRAMES
        chosen = [chosen[int(i * step)] for i in range(MAX_FRAMES)]
    return source, chosen


def _font(size: int) -> Any:
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # Pillow < 10.1
        return ImageFont.load_default()


def _fit(data: bytes) -> Image.Image:
    with Image.open(io.BytesIO(data)) as src:
        img = ImageOps.exif_transpose(src).convert("RGB")
    return ImageOps.fit(img, (WIDTH, HEIGHT), method=Image.Resampling.LANCZOS)


def _overlay(frame: Image.Image, title: str, stamp: str) -> Image.Image:
    draw = ImageDraw.Draw(frame, "RGBA")
    draw.rectangle([(0, HEIGHT - 64), (WIDTH, HEIGHT)], fill=(10, 18, 40, 150))
    draw.rectangle([(0, HEIGHT - 66), (WIDTH, HEIGHT - 64)], fill=(*ACCENT, 255))
    draw.text((28, HEIGHT - 50), stamp, fill=(255, 255, 255, 255), font=_font(28))
    draw.text((WIDTH - 28, HEIGHT - 50), "GLOBUS ENGINEERING", fill=(255, 255, 255, 230), font=_font(24), anchor="ra")
    draw.text(
        (28, 22), title[:60], fill=(255, 255, 255, 235), font=_font(26), stroke_width=2, stroke_fill=(0, 0, 0, 160)
    )
    return frame


def _card(lines: list[tuple[str, int]]) -> Image.Image:
    card = Image.new("RGB", (WIDTH, HEIGHT), BRAND)
    draw = ImageDraw.Draw(card)
    for x in range(0, WIDTH, 48):  # trame « plan d'architecte » discrète
        draw.line([(x, 0), (x, HEIGHT)], fill=(66, 102, 180), width=1)
    for y in range(0, HEIGHT, 48):
        draw.line([(0, y), (WIDTH, y)], fill=(66, 102, 180), width=1)
    draw.rectangle([(0, HEIGHT - 12), (WIDTH, HEIGHT)], fill=ACCENT)
    total = sum(size + 18 for _, size in lines)
    y = (HEIGHT - total) // 2
    for text, size in lines:
        draw.text((WIDTH // 2, y), text, fill=(255, 255, 255), font=_font(size), anchor="ma")
        y += size + 18
    return card


def generate(
    db: Session, project: Any, start: date, end: date, *, by: str = "schedule", force: bool = False
) -> Timelapse | None:
    from app.core.files import read_private, store_generated

    existing = db.execute(
        select(Timelapse).where(
            Timelapse.project_id == project.id, Timelapse.period_start == start, Timelapse.period_end == end
        )
    ).scalar_one_or_none()
    if existing is not None and existing.status == "ready" and not force:
        return existing
    source, chosen = select_frames(db, project.id, start, end)
    if len(chosen) < MIN_FRAMES:
        return None
    per_frame = 0.25 if source == "camera" else 0.8
    timelapse = existing or Timelapse(project_id=project.id, period_start=start, period_end=end)
    if existing is None:
        db.add(timelapse)
    poster: bytes | None = None
    with tempfile.TemporaryDirectory(prefix="globus-timelapse-") as tmp:
        folder = Path(tmp)
        playlist: list[tuple[Path, float]] = []

        def keep(image: Image.Image, seconds: float) -> None:
            path = folder / f"{len(playlist):05d}.jpg"
            image.save(path, format="JPEG", quality=90)
            playlist.append((path, seconds))

        keep(
            _card(
                [
                    (project.name[:48], 54),
                    (f"Semaine du {start:%d/%m} au {end:%d/%m/%Y}", 34),
                    (f"{len(chosen)} images · avancement {Decimal(project.progress_pct or 0):.0f} %", 26),
                ]
            ),
            CARD_SECONDS,
        )
        for media, stored in chosen:
            try:
                frame = _fit(read_private(stored))
            except Exception:  # noqa: BLE001 — image illisible : ignorée
                log.warning("timelapse_frame_skipped", extra={"media": str(media.id)})
                continue
            stamp = (media.taken_at or media.created_at).strftime("%d/%m/%Y %H:%M")
            frame = _overlay(frame, project.name, stamp)
            if poster is None:
                buf = io.BytesIO()
                frame.save(buf, format="JPEG", quality=85)
                poster = buf.getvalue()
            keep(frame, per_frame)
        keep(_card([("GLOBUS ENGINEERING", 52), ("Concevoir. Calculer. Construire. Contrôler.", 28)]), CARD_SECONDS)
        try:
            video = render_video(playlist, folder)
        except AppError as exc:
            timelapse.status = "failed"
            timelapse.error = str(exc)[:2000]
            db.flush()
            return timelapse
    images = len(playlist) - 2
    stored_video = store_generated(
        db,
        video,
        filename=f"timelapse-{project.code.lower()}-{start:%Y%m%d}.mp4",
        mime="video/mp4",
        purpose="timelapses",
        classification="internal",
    )
    stored_poster = (
        store_generated(
            db,
            poster,
            filename=f"timelapse-{project.code.lower()}-{start:%Y%m%d}.jpg",
            mime="image/jpeg",
            purpose="timelapses",
            classification="internal",
        )
        if poster
        else None
    )
    timelapse.file_id = stored_video.id
    timelapse.poster_file_id = stored_poster.id if stored_poster else None
    timelapse.frames = images
    timelapse.duration_s = Decimal(str(round(2 * CARD_SECONDS + images * per_frame, 2)))
    timelapse.source = source
    timelapse.status = "ready"
    timelapse.error = None
    timelapse.generated_by = by
    db.flush()
    return timelapse


def render_video(playlist: list[tuple[Path, float]], folder: Path) -> bytes:
    """MP4 H.264 (yuv420p, faststart, 24 i/s) via le binaire ffmpeg embarqué et le démultiplexeur « concat » :
    chaque image JPEG est tenue la durée indiquée (cartons d'ouverture / clôture, photos du chantier)."""
    import imageio_ffmpeg

    lines = ["ffconcat version 1.0"]
    for path, seconds in playlist:
        lines += [f"file '{path.name}'", f"duration {seconds:.3f}"]
    lines.append(f"file '{playlist[-1][0].name}'")  # la dernière durée n'est prise en compte que si l'image est répétée
    (folder / "list.txt").write_text("\n".join(lines), encoding="utf-8")
    output = folder / "timelapse.mp4"
    cmd = [
        imageio_ffmpeg.get_ffmpeg_exe(),
        "-loglevel", "error", "-y",
        "-f", "concat", "-safe", "0", "-i", str(folder / "list.txt"),
        "-vf", f"fps={FPS},format=yuv420p", "-an",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
        "-movflags", "+faststart", str(output),
    ]  # fmt: skip
    proc = subprocess.run(cmd, capture_output=True, timeout=900, check=False, cwd=folder)  # noqa: S603
    if proc.returncode != 0 or not output.exists():
        detail = proc.stderr.decode(errors="ignore")[:300]
        raise AppError(f"Encodage vidéo impossible : {detail}", code="VIDEO_ENCODING")
    return output.read_bytes()


# ---------------------------------------------------------------------------- diffusion
def last_week(today: date | None = None) -> tuple[date, date]:
    today = today or date.today()
    monday = today - timedelta(days=today.weekday())
    return monday - timedelta(days=7), monday - timedelta(days=1)


def _absolute(path: str) -> str:
    return settings.PUBLIC_BASE_URL.rstrip("/") + "/" + path.lstrip("/")


def deliver(db: Session, project: Any, timelapse: Timelapse) -> int:
    """Espace client + e-mail (règle de notification) ; WhatsApp par modèle approuvé avec la vidéo en en-tête."""
    from app.core.downloads import signed_url
    from app.modules.notifications.service import _disabled_channels
    from app.modules.reviews.service import client_users
    from app.providers.base import ProviderError
    from app.providers.messaging import WhatsAppTemplate, get_whatsapp_provider

    if timelapse.sent_at is not None or timelapse.status != "ready" or not timelapse.published_to_client:
        return 0
    emit(
        db,
        "timelapse.ready",
        {
            "id": timelapse.id,
            "project_id": project.id,
            "project_name": project.name,
            "period": f"du {timelapse.period_start:%d/%m} au {timelapse.period_end:%d/%m/%Y}",
            "frames": timelapse.frames,
            "link": "/espace-client/chantier",
        },
        aggregate_type="timelapse",
        aggregate_id=timelapse.id,
        project_id=project.id,
    )
    sent = 0
    for user in client_users(db, project):
        if not user.whatsapp or "whatsapp" in _disabled_channels(db, user.id, "projects"):
            continue
        link = _absolute(signed_url(timelapse.file_id, user_id=user.id, ttl=3 * 86400))
        try:
            get_whatsapp_provider().send_template(
                user.whatsapp,
                WhatsAppTemplate(
                    name=settings.META_WA_TIMELAPSE_TEMPLATE,
                    language=settings.META_WA_TEMPLATE_LANG,
                    body_params=[user.first_name, project.name, f"{timelapse.period_start:%d/%m}"],
                    header_video={"link": link},
                ),
            )
            sent += 1
        except ProviderError as exc:
            log.warning("timelapse_whatsapp_failed", extra={"project": str(project.id), "error": str(exc)[:200]})
    timelapse.sent_at = utcnow()
    return sent


def weekly_job(db: Session) -> dict[str, Any]:
    """Job du lundi : time-lapse de la semaine écoulée pour chaque chantier actif, puis diffusion au client."""
    from app.modules.projects.models import Project
    from app.modules.projects.trust import ACTIVE_STATUSES

    start, end = last_week()
    made = 0
    for project in db.execute(
        select(Project).where(Project.deleted_at.is_(None), Project.status.in_(ACTIVE_STATUSES))
    ).scalars():
        timelapse = generate(db, project, start, end)
        if timelapse is not None and timelapse.status == "ready":
            deliver(db, project, timelapse)
            made += 1
        db.commit()
    return {"items": made}


def get(db: Session, timelapse_id: uuid.UUID) -> Timelapse:
    timelapse = db.get(Timelapse, timelapse_id)
    if timelapse is None:
        raise NotFound("Time-lapse introuvable")
    return timelapse


def timelapse_out(timelapse: Timelapse, *, user_id: Any) -> dict[str, Any]:
    from app.core.downloads import signed_url
    from app.core.utils import jsonable

    return jsonable(
        {
            "id": timelapse.id,
            "project_id": timelapse.project_id,
            "period_start": timelapse.period_start,
            "period_end": timelapse.period_end,
            "frames": timelapse.frames,
            "duration_s": timelapse.duration_s,
            "source": timelapse.source,
            "status": timelapse.status,
            "error": timelapse.error,
            "published_to_client": timelapse.published_to_client,
            "sent_at": timelapse.sent_at,
            "video_url": signed_url(timelapse.file_id, user_id=user_id, ttl=3600) if timelapse.file_id else None,
            "poster_url": signed_url(timelapse.poster_file_id, user_id=user_id, ttl=3600)
            if timelapse.poster_file_id
            else None,
        }
    )


def camera_out(camera: SiteCamera) -> dict[str, Any]:
    from app.core.utils import jsonable

    return jsonable(
        {
            "id": camera.id,
            "project_id": camera.project_id,
            "name": camera.name,
            "token_hint": f"…{camera.token_hint}",
            "active": camera.active,
            "last_seen_at": camera.last_seen_at,
            "snapshots": camera.snapshots,
            "created_at": camera.created_at,
        }
    )


__all__ = [
    "camera_for_token",
    "camera_out",
    "create_camera",
    "deliver",
    "generate",
    "ingest_snapshot",
    "last_week",
    "render_video",
    "select_frames",
    "timelapse_out",
    "weekly_job",
]
