"""Panneau de chantier connecté (innovation I4).

• L'équipe projet configure le panneau (mentions du permis, maître d'ouvrage affiché, horaires, recrutement) et choisit
  les photos publiées : elles sont recopiées dans la médiathèque publique APRÈS suppression des métadonnées (GPS,
  appareil) — la photo interne n'est jamais exposée.
• Le PDF A3 du panneau porte un QR vers la page publique `/chantiers/{slug}?src=qr` (les scans sont comptés).
• Les messages laissés (information, devis, riverain, candidature) arrivent au chef de projet ; une demande de devis
  devient un lead CRM (source « panneau_chantier »).
"""

from __future__ import annotations

import hashlib
import io
import uuid
from datetime import date
from typing import Any

import qrcode
from PIL import Image, ImageOps
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import BusinessRuleError, Conflict, NotFound
from app.core.events import emit
from app.core.utils import clean_phone, jsonable, slugify, utcnow
from app.modules.panels.models import MESSAGE_KINDS, SitePanel, SitePanelMessage

MAX_PHOTOS = 12
EDITABLE = (
    "enabled",
    "title",
    "location_label",
    "owner_label",
    "contractor_label",
    "permit_number",
    "permit_date",
    "permit_authority",
    "works_description",
    "working_hours",
    "contact_phone",
    "show_progress",
    "show_milestones",
    "show_photos",
    "hiring_open",
    "hiring_text",
)


def public_url(panel: SitePanel, *, qr: bool = False) -> str:
    return f"{settings.PUBLIC_BASE_URL.rstrip('/')}/chantiers/{panel.slug}" + ("?src=qr" if qr else "")


def _unique_slug(db: Session, base: str, panel_id: uuid.UUID | None = None) -> str:
    base = slugify(base, max_length=70) or "chantier"
    slug, n = base, 2
    while True:
        other = db.execute(select(SitePanel.id).where(SitePanel.slug == slug)).scalar_one_or_none()
        if other is None or other == panel_id:
            return slug
        slug, n = f"{base}-{n}", n + 1


def get_panel(db: Session, project_id: uuid.UUID) -> SitePanel | None:
    return db.execute(select(SitePanel).where(SitePanel.project_id == project_id)).scalar_one_or_none()


def suggestion(db: Session, project: Any) -> dict[str, Any]:
    """Pré-remplissage à partir de la fiche projet (rien n'est publié tant que le panneau n'est pas activé)."""
    return {
        "slug": _unique_slug(db, f"{project.name} {project.city or ''}"),
        "enabled": False,
        "title": project.name,
        "location_label": project.city,
        "owner_label": None,
        "contractor_label": "GLOBUS ENGINEERING",
        "works_description": project.description,
        "working_hours": "Du lundi au samedi, 7h30 – 17h30",
        "show_progress": True,
        "show_milestones": True,
        "show_photos": True,
        "hiring_open": False,
    }


def save_panel(db: Session, project: Any, data: dict[str, Any], *, user_id: uuid.UUID | None) -> SitePanel:
    panel = get_panel(db, project.id)
    if panel is None:
        base = suggestion(db, project)
        panel = SitePanel(project_id=project.id, slug=base["slug"], title=data.get("title") or base["title"])
        db.add(panel)
    if data.get("slug"):
        wanted = slugify(data["slug"], max_length=70)
        if wanted != panel.slug:
            if _unique_slug(db, wanted, panel.id) != wanted:
                raise Conflict("Adresse déjà utilisée par un autre chantier", code="SLUG_TAKEN")
            panel.slug = wanted
    for key in EDITABLE:
        if key in data:
            setattr(panel, key, data[key])
    if panel.contact_phone:
        panel.contact_phone = clean_phone(panel.contact_phone)
    if panel.enabled and not (panel.title or "").strip():
        raise BusinessRuleError("Titre requis pour publier le panneau", code="PANEL_TITLE_REQUIRED")
    panel.updated_by_id = user_id
    db.flush()
    return panel


def _strip_metadata(data: bytes) -> bytes:
    """Ré-encode l'image (orientation appliquée) sans EXIF/GPS/XMP : aucune métadonnée ne sort du système."""
    with Image.open(io.BytesIO(data)) as src:
        img = ImageOps.exif_transpose(src)
        img = img.convert("RGB")
        img.thumbnail((2400, 2400))
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=86, optimize=True)
        return out.getvalue()


def set_photos(db: Session, panel: SitePanel, site_media_ids: list[uuid.UUID], *, user_id: uuid.UUID | None) -> None:
    from app.core.files import read_private
    from app.modules.cms.media import upload_media
    from app.modules.projects.models import Project, SiteMedia
    from app.modules.system.models import StoredFile

    if len(site_media_ids) > MAX_PHOTOS:
        raise BusinessRuleError(f"{MAX_PHOTOS} photos au maximum", code="TOO_MANY_PHOTOS")
    project = db.get(Project, panel.project_id)
    current = {p["site_media_id"]: p for p in panel.photos or []}
    photos: list[dict[str, Any]] = []
    for index, media_id in enumerate(dict.fromkeys(site_media_ids)):
        if str(media_id) in current:
            photos.append(current[str(media_id)])
            continue
        media = db.get(SiteMedia, media_id)
        if media is None or media.project_id != panel.project_id or media.media_type != "photo":
            raise NotFound("Photo introuvable sur ce chantier")
        stored = db.get(StoredFile, media.file_id)
        if stored is None or stored.deleted_at is not None:
            raise NotFound("Fichier de la photo introuvable")
        clean = _strip_metadata(read_private(stored))
        try:
            asset = upload_media(
                db,
                filename=f"chantier-{project.code.lower()}-{index + 1}.jpg",
                data=clean,
                title=media.caption or f"{panel.title} — photo {index + 1}",
                alt_text=media.caption or f"Chantier {panel.title}",
                folder="chantiers",
                tags=["chantier", project.code],
                author_id=user_id,
            )
            public_id = asset.id
        except Conflict as exc:  # même photo déjà publiée : on réutilise la copie publique
            public_id = uuid.UUID(exc.details["media_id"])
        photos.append(
            {
                "site_media_id": str(media.id),
                "media_id": str(public_id),
                "caption": media.caption,
                "taken_at": jsonable(media.taken_at),
            }
        )
    panel.photos = photos
    panel.updated_by_id = user_id


def panel_out(db: Session, panel: SitePanel) -> dict[str, Any]:
    from app.modules.cms.media import media_url

    messages = db.execute(select(SitePanelMessage.status).where(SitePanelMessage.panel_id == panel.id)).scalars().all()
    out = {key: getattr(panel, key) for key in EDITABLE}
    out.update(
        {
            "id": panel.id,
            "project_id": panel.project_id,
            "slug": panel.slug,
            "url": public_url(panel),
            "qr_url": public_url(panel, qr=True),
            "photos": [{**p, "url": media_url(p["media_id"], "md")} for p in panel.photos or []],
            "views": panel.views,
            "scans": panel.scans,
            "last_scan_at": panel.last_scan_at,
            "messages": {"total": len(messages), "new": sum(1 for s in messages if s == "new")},
            "updated_at": panel.updated_at,
        }
    )
    return jsonable(out)


def resolve(db: Session, slug: str) -> SitePanel:
    stmt = select(SitePanel).where(SitePanel.slug == slug, SitePanel.enabled.is_(True))
    panel = db.execute(stmt).scalar_one_or_none()
    if panel is None:
        raise NotFound("Chantier introuvable")
    return panel


def public_payload(db: Session, panel: SitePanel) -> dict[str, Any]:
    from app.modules.cms.media import media_url
    from app.modules.projects.models import Milestone, Phase, Project

    project = db.get(Project, panel.project_id)
    if project is None or project.deleted_at is not None:
        raise NotFound("Chantier introuvable")
    data: dict[str, Any] = {
        "slug": panel.slug,
        "title": panel.title,
        "location": panel.location_label,
        "owner": panel.owner_label,
        "contractor": panel.contractor_label,
        "permit": {"number": panel.permit_number, "date": panel.permit_date, "authority": panel.permit_authority}
        if panel.permit_number
        else None,
        "description": panel.works_description,
        "working_hours": panel.working_hours,
        "contact_phone": panel.contact_phone,
        "project_type": project.project_type,
        "surface_m2": project.surface_m2,
        "levels": project.levels,
        "start": project.start_actual or project.start_planned,
        "end_planned": project.end_planned,
        "status": project.status,
        "hiring": {"open": True, "text": panel.hiring_text} if panel.hiring_open else None,
        "message_kinds": list(MESSAGE_KINDS if panel.hiring_open else MESSAGE_KINDS[:3]),
        "updated_at": max(panel.updated_at, project.updated_at),
    }
    if panel.show_progress:
        phases = (
            db.execute(
                select(Phase)
                .where(Phase.project_id == project.id, Phase.client_visible.is_(True))
                .order_by(Phase.sort_order, Phase.start_planned)
            )
            .scalars()
            .all()
        )
        data["progress"] = {
            "pct": project.progress_pct,
            "phases": [{"name": p.name, "pct": p.progress_pct, "status": p.status} for p in phases],
        }
    if panel.show_milestones:
        milestones = (
            db.execute(
                select(Milestone)
                .where(
                    Milestone.project_id == project.id,
                    Milestone.client_visible.is_(True),
                    Milestone.status != "cancelled",
                )
                .order_by(Milestone.due_date)
            )
            .scalars()
            .all()
        )
        # pas de dates internes de retard : seulement « atteint » ou « à venir » (mois prévu)
        data["milestones"] = [
            {
                "name": m.name,
                "done": m.status == "achieved",
                "month": (m.achieved_at.date() if m.achieved_at else m.due_date).strftime("%Y-%m"),
            }
            for m in milestones
        ]
    if panel.show_photos:
        data["photos"] = [
            {
                "url": media_url(p["media_id"], "lg"),
                "thumb": media_url(p["media_id"], "md"),
                "caption": p.get("caption"),
                "taken_at": p.get("taken_at"),
            }
            for p in panel.photos or []
        ]
    return jsonable(data)


def record_view(db: Session, panel: SitePanel, *, from_qr: bool) -> None:
    panel.views = (panel.views or 0) + 1
    if from_qr:
        panel.scans = (panel.scans or 0) + 1
        panel.last_scan_at = utcnow()


def list_public(db: Session) -> list[dict[str, Any]]:
    from app.modules.cms.media import media_url
    from app.modules.projects.models import Project

    rows = db.execute(
        select(SitePanel, Project)
        .join(Project, Project.id == SitePanel.project_id)
        .where(SitePanel.enabled.is_(True), Project.deleted_at.is_(None))
        .order_by(Project.updated_at.desc())
    ).all()
    return jsonable(
        [
            {
                "slug": panel.slug,
                "title": panel.title,
                "location": panel.location_label,
                "status": project.status,
                "progress_pct": project.progress_pct if panel.show_progress else None,
                "cover": media_url(panel.photos[0]["media_id"], "md") if panel.show_photos and panel.photos else None,
                "hiring": panel.hiring_open,
            }
            for panel, project in rows
        ]
    )


def submit_message(
    db: Session,
    panel: SitePanel,
    *,
    kind: str,
    name: str,
    phone: str | None,
    email: str | None,
    message: str,
    consent: bool,
    ip: str | None,
    user_agent: str | None,
) -> SitePanelMessage:
    from app.modules.projects.models import Project

    if kind not in MESSAGE_KINDS or (kind == "candidature" and not panel.hiring_open):
        raise BusinessRuleError("Type de message non disponible", code="KIND_UNAVAILABLE")
    if not consent:
        raise BusinessRuleError("Le consentement au traitement du message est obligatoire", code="CONSENT_REQUIRED")
    phone = clean_phone(phone)
    email = (email or "").strip().lower() or None
    if not phone and not email:
        raise BusinessRuleError("Un téléphone ou un e-mail est requis pour vous répondre", code="CONTACT_REQUIRED")
    project = db.get(Project, panel.project_id)
    entry = SitePanelMessage(
        panel_id=panel.id,
        project_id=panel.project_id,
        kind=kind,
        name=name.strip()[:150],
        phone=phone,
        email=email,
        message=message.strip()[:4000],
        ip_hash=hashlib.sha256(("panel:" + (ip or "")).encode()).hexdigest(),
    )
    db.add(entry)
    db.flush()
    if kind == "devis":
        from app.modules.crm.service import create_lead

        first, _, last = entry.name.partition(" ")
        lead = create_lead(
            db,
            data={
                "first_name": first,
                "last_name": last or None,
                "phone": phone,
                "email": email,
                "message": entry.message,
                "city": panel.location_label,
                "subject": f"Demande depuis le panneau du chantier {panel.title}",
            },
            source="panneau_chantier",
            form_key=f"panel:{panel.slug}",
            consents={"contact": True},
            ip=ip,
            user_agent=user_agent,
            landing_page=f"/chantiers/{panel.slug}",
        )
        entry.lead_id = lead.id
    emit(
        db,
        "site_panel.message",
        {
            "message_id": entry.id,
            "panel_id": panel.id,
            "project_id": panel.project_id,
            "project_name": panel.title,
            "manager_id": project.manager_id if project else None,
            "kind": kind,
            "name": entry.name,
            "excerpt": entry.message[:200],
            "link": f"/erp/chantiers/{panel.project_id}?onglet=panneau",
        },
        aggregate_type="site_panel",
        aggregate_id=panel.id,
        project_id=panel.project_id,
    )
    return entry


def message_out(entry: SitePanelMessage) -> dict[str, Any]:
    return jsonable(
        {
            "id": entry.id,
            "kind": entry.kind,
            "name": entry.name,
            "phone": entry.phone,
            "email": entry.email,
            "message": entry.message,
            "status": entry.status,
            "lead_id": entry.lead_id,
            "created_at": entry.created_at,
            "handled_at": entry.handled_at,
            "handling_note": entry.handling_note,
        }
    )


# ---------------------------------------------------------------------------- impression
def qr_png(url: str, *, box_size: int = 12) -> bytes:
    img = qrcode.make(url, box_size=box_size, border=2, error_correction=qrcode.constants.ERROR_CORRECT_Q)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def panel_pdf(db: Session, panel: SitePanel) -> bytes:
    """Panneau A3 portrait imprimable (bâche / dibond) : mentions + grand QR vers la page du chantier."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A3
    from reportlab.lib.units import mm
    from reportlab.lib.utils import ImageReader, simpleSplit
    from reportlab.pdfgen import canvas as rl_canvas

    from app.core.pdf import ACCENT, PRIMARY, brand_fonts
    from app.modules.projects.models import Project

    project = db.get(Project, panel.project_id)
    fonts = brand_fonts()
    t = fonts.safe
    width, height = A3
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=A3)
    c.setTitle(f"Panneau de chantier — {panel.title}")
    c.setAuthor("GLOBUS ENGINEERING")

    # bandeau de marque
    c.setFillColor(PRIMARY)
    c.rect(0, height - 62 * mm, width, 62 * mm, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.rect(0, height - 64 * mm, width, 2 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont(fonts.title, 34)
    c.drawString(20 * mm, height - 30 * mm, "GLOBUS ENGINEERING")
    c.setFont(fonts.body, 14)
    c.drawString(20 * mm, height - 42 * mm, t("Concevoir. Calculer. Construire. Contrôler."))
    c.setFont(fonts.subtitle, 16)
    c.drawRightString(width - 20 * mm, height - 30 * mm, t("CHANTIER EN COURS"))

    y = height - 86 * mm
    c.setFillColor(colors.HexColor("#111827"))
    for line in simpleSplit(t(panel.title, fonts.title), fonts.title, 30, width - 40 * mm)[:3]:
        c.setFont(fonts.title, 30)
        c.drawString(20 * mm, y, line)
        y -= 12 * mm
    if panel.location_label:
        c.setFont(fonts.body, 15)
        c.setFillColor(colors.HexColor("#4B5563"))
        c.drawString(20 * mm, y, t(panel.location_label))
        y -= 12 * mm

    def row(label: str, value: str | None) -> None:
        nonlocal y
        if not value:
            return
        c.setFillColor(PRIMARY)
        c.setFont(fonts.subtitle, 12)
        c.drawString(20 * mm, y, t(label.upper(), fonts.subtitle))
        c.setFillColor(colors.HexColor("#111827"))
        c.setFont(fonts.body, 13)
        lines = simpleSplit(t(value), fonts.body, 13, width - 110 * mm)
        for i, line in enumerate(lines[:4]):
            c.drawString(90 * mm, y - i * 6 * mm, line)
        y -= max(1, min(len(lines), 4)) * 6 * mm + 4 * mm

    y -= 2 * mm
    row("Maître d'ouvrage", panel.owner_label)
    row("Entreprise", panel.contractor_label)
    if panel.permit_number:
        permit = f"N° {panel.permit_number}"
        if panel.permit_date:
            permit += f" du {panel.permit_date:%d/%m/%Y}"
        if panel.permit_authority:
            permit += f" — {panel.permit_authority}"
        row("Permis de bâtir", permit)
    row("Nature des travaux", panel.works_description)
    if project is not None:
        size = " — ".join(
            x
            for x in (
                f"{project.surface_m2:,.0f} m²".replace(",", " ") if project.surface_m2 else "",
                f"{project.levels} niveau(x)" if project.levels else "",
            )
            if x
        )
        row("Surface", size)
        start = project.start_actual or project.start_planned
        if start or project.end_planned:
            row(
                "Durée",
                " → ".join(
                    x
                    for x in (
                        f"début {start:%m/%Y}" if start else "",
                        f"fin prévue {project.end_planned:%m/%Y}" if project.end_planned else "",
                    )
                    if x
                ),
            )
    row("Horaires", panel.working_hours)
    row("Contact chantier", panel.contact_phone)

    # QR code géant
    qr_size = 120 * mm
    qr_y = 52 * mm
    c.setFillColor(colors.HexColor("#F3F4F6"))
    c.roundRect(15 * mm, qr_y - 10 * mm, width - 30 * mm, qr_size + 20 * mm, 6 * mm, fill=1, stroke=0)
    url = public_url(panel, qr=True)
    c.drawImage(ImageReader(io.BytesIO(qr_png(url, box_size=10))), 22 * mm, qr_y, qr_size, qr_size)
    c.setFillColor(PRIMARY)
    c.setFont(fonts.title, 26)
    text_x = 22 * mm + qr_size + 10 * mm
    c.drawString(text_x, qr_y + qr_size - 18 * mm, t("Suivez ce chantier", fonts.title))
    c.drawString(text_x, qr_y + qr_size - 30 * mm, t("en direct", fonts.title))
    c.setFillColor(colors.HexColor("#374151"))
    c.setFont(fonts.body, 13)
    for i, line in enumerate(
        (
            "Avancement, photos, étapes clés.",
            "Riverains : une question, une gêne ?",
            "Écrivez-nous depuis la page.",
        )
    ):
        c.drawString(text_x, qr_y + qr_size - 46 * mm - i * 8 * mm, t(line))
    c.setFont(fonts.body, 10)
    c.setFillColor(colors.HexColor("#6B7280"))
    for i, line in enumerate(simpleSplit(public_url(panel), fonts.body, 10, width - text_x - 20 * mm)[:2]):
        c.drawString(text_x, qr_y + 8 * mm - i * 5 * mm, line)

    if panel.hiring_open:
        c.setFillColor(ACCENT)
        c.rect(0, 22 * mm, width, 18 * mm, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont(fonts.title, 18)
        hiring = "NOUS RECRUTONS" + (f" : {panel.hiring_text}" if panel.hiring_text else "")
        c.drawString(20 * mm, 29 * mm, simpleSplit(t(hiring, fonts.title), fonts.title, 18, width - 40 * mm)[0])
    c.setFillColor(colors.HexColor("#6B7280"))
    c.setFont(fonts.body, 9)
    footer = f"Panneau généré le {date.today():%d/%m/%Y} — informations tenues à jour en ligne."
    c.drawString(20 * mm, 12 * mm, t(footer))
    c.showPage()
    c.save()
    return buf.getvalue()


__all__ = [
    "get_panel",
    "list_public",
    "panel_out",
    "panel_pdf",
    "public_payload",
    "qr_png",
    "record_view",
    "resolve",
    "save_panel",
    "set_photos",
    "submit_message",
    "suggestion",
]
