"""Passeport du bâtiment et maintenance (innovation I2).

• Équipements installés : marque, modèle, n° de série, notice, garantie, localisation ; chaque catégorie apporte son
  carnet d'entretien type (Setting « maintenance_plans », modifiable) → tâches datées, récurrentes.
• Rappels au client (J-14, J-1) avec choix : « c'est fait » ou « planifier une intervention » (ticket SAV créé).
• SAV prédictif : équipement avec ≥ 2 tickets en 6 mois, garantie qui expire, entretien en retard → alerte SAV pour
  une visite préventive (avant la panne, et avant la fin de garantie).
• Passeport du bâtiment (PDF) remis à la livraison : identité du projet, plans conformes certifiés, garanties,
  équipements et notices, calendrier d'entretien à 12 mois, contacts — lui-même certifié (preuve opposable).
"""

from __future__ import annotations

import logging
import uuid
from datetime import date, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError, NotFound
from app.core.events import emit
from app.core.utils import jsonable, utcnow
from app.modules.maintenance.models import BuildingEquipment, MaintenanceTask

log = logging.getLogger("globus.maintenance")

DEFAULT_PLANS: dict[str, list[dict[str, Any]]] = {
    "climatisation": [
        {"title": "Nettoyer les filtres du climatiseur", "every_days": 30, "performer": "client"},
        {
            "title": "Entretien complet du climatiseur (gaz, évacuation des condensats)",
            "every_days": 180,
            "performer": "technicien",
        },
    ],
    "plomberie": [
        {
            "title": "Contrôler les joints et l'absence de fuite (éviers, WC, chauffe-eau)",
            "every_days": 90,
            "performer": "client",
        },
        {"title": "Vidange et détartrage du chauffe-eau", "every_days": 365, "performer": "technicien"},
    ],
    "pompe": [{"title": "Contrôle de la surpression / pompe immergée", "every_days": 180, "performer": "technicien"}],
    "fosse": [{"title": "Vidange de la fosse septique", "every_days": 730, "performer": "technicien"}],
    "electricite": [
        {"title": "Tester les disjoncteurs différentiels (bouton test)", "every_days": 90, "performer": "client"},
        {
            "title": "Contrôle du tableau électrique et de la mise à la terre",
            "every_days": 730,
            "performer": "technicien",
        },
    ],
    "solaire": [
        {"title": "Nettoyer les panneaux solaires", "every_days": 60, "performer": "client"},
        {"title": "Contrôle de l'onduleur et des batteries", "every_days": 365, "performer": "technicien"},
    ],
    "groupe_electrogene": [
        {"title": "Vidange et révision du groupe électrogène", "every_days": 180, "performer": "technicien"}
    ],
    "toiture": [
        {
            "title": "Nettoyer gouttières et chéneaux (avant la saison des pluies)",
            "every_days": 180,
            "performer": "client",
        },
        {"title": "Inspection de la couverture et de l'étanchéité", "every_days": 365, "performer": "technicien"},
    ],
    "menuiserie": [
        {
            "title": "Graisser les ferrures, contrôler les joints des menuiseries",
            "every_days": 365,
            "performer": "client",
        }
    ],
    "peinture": [
        {"title": "Inspection des façades (fissures, humidité)", "every_days": 365, "performer": "technicien"}
    ],
}
CATEGORY_TO_TICKET = {
    "climatisation": "equipement",
    "plomberie": "plomberie",
    "pompe": "plomberie",
    "fosse": "plomberie",
    "electricite": "electricite",
    "solaire": "equipement",
    "groupe_electrogene": "equipement",
    "toiture": "etancheite",
    "menuiserie": "menuiserie",
    "peinture": "peinture",
}


def plans(db: Session) -> dict[str, list[dict[str, Any]]]:
    from app.modules.system.models import Setting

    row = db.get(Setting, "maintenance_plans")
    return {**DEFAULT_PLANS, **(row.value if row and isinstance(row.value, dict) else {})}


# ---------------------------------------------------------------------------- équipements et carnet
def schedule_for(db: Session, equipment: BuildingEquipment, *, start: date | None = None) -> int:
    """Crée les prochaines tâches d'entretien d'un équipement (une par action du plan type, si absente)."""
    created = 0
    base = start or equipment.last_service_on or equipment.installed_on or date.today()
    for action in plans(db).get(equipment.category, []):
        every = int(action.get("every_days") or equipment.maintenance_interval_days or 365)
        exists = db.execute(
            select(MaintenanceTask.id).where(
                MaintenanceTask.equipment_id == equipment.id,
                MaintenanceTask.title == action["title"],
                MaintenanceTask.status.in_(["planned", "booked"]),
            )
        ).first()
        if exists:
            continue
        due = base + timedelta(days=every)
        while due < date.today():  # équipement ancien : prochaine occurrence à venir
            due += timedelta(days=every)
        db.add(
            MaintenanceTask(
                project_id=equipment.project_id,
                equipment_id=equipment.id,
                title=action["title"],
                instructions=action.get("tips"),
                due_on=due,
                recurrence_days=every,
                performer=action.get("performer", "client"),
            )
        )
        created += 1
    db.flush()
    return created


def complete(db: Session, task: MaintenanceTask, *, note: str | None, done_on: date | None = None) -> MaintenanceTask:
    if task.status not in ("planned", "booked"):
        raise BusinessRuleError("Tâche déjà traitée")
    task.status = "done"
    task.done_on = done_on or date.today()
    task.done_note = note
    if task.equipment_id:
        equipment = db.get(BuildingEquipment, task.equipment_id)
        if equipment is not None:
            equipment.last_service_on = task.done_on
    if task.recurrence_days:
        db.add(
            MaintenanceTask(
                project_id=task.project_id,
                equipment_id=task.equipment_id,
                title=task.title,
                instructions=task.instructions,
                due_on=task.done_on + timedelta(days=task.recurrence_days),
                recurrence_days=task.recurrence_days,
                performer=task.performer,
                estimated_cost=task.estimated_cost,
            )
        )
    db.flush()
    return task


def book_intervention(db: Session, task: MaintenanceTask, *, requester: Any, note: str | None) -> Any:
    """« Planifier une intervention » : ticket SAV pré-rempli (catégorie, localisation, équipement)."""
    from app.modules.support.service import create_ticket

    if task.status != "planned":
        raise BusinessRuleError("Intervention déjà planifiée ou tâche close")
    equipment = db.get(BuildingEquipment, task.equipment_id) if task.equipment_id else None
    ticket = create_ticket(
        db,
        data={
            "project_id": task.project_id,
            "category": CATEGORY_TO_TICKET.get(equipment.category if equipment else "", "equipement"),
            "priority": "normal",
            "subject": f"Entretien programmé : {task.title}"[:250],
            "description": "\n".join(
                x
                for x in (
                    f"Équipement : {equipment.name} ({equipment.brand or ''} {equipment.model or ''})".strip()
                    if equipment
                    else None,
                    f"Échéance prévue : {task.due_on:%d/%m/%Y}",
                    note,
                )
                if x
            ),
            "location": equipment.location if equipment else None,
            "zone_id": equipment.zone_id if equipment else None,
        },
        requester=requester,
        channel="portal",
    )
    task.status = "booked"
    task.ticket_id = ticket.id
    db.flush()
    return ticket


# ---------------------------------------------------------------------------- rappels et SAV prédictif
REMINDER_DAYS = (14, 1)


def reminders(db: Session, today: date | None = None) -> int:
    from app.modules.projects.models import Project

    today = today or date.today()
    sent = 0
    for days in REMINDER_DAYS:
        for task in db.execute(
            select(MaintenanceTask).where(
                MaintenanceTask.status == "planned",
                MaintenanceTask.performer == "client",
                MaintenanceTask.due_on == today + timedelta(days=days),
            )
        ).scalars():
            project = db.get(Project, task.project_id)
            emit(
                db,
                "maintenance.due",
                {
                    "id": task.id,
                    "title": task.title,
                    "due_on": task.due_on,
                    "days": days,
                    "project_id": task.project_id,
                    "project_name": project.name if project else "",
                    "link": "/espace-client/batiment",
                },
                aggregate_type="maintenance_task",
                aggregate_id=task.id,
                project_id=task.project_id,
            )
            task.reminded_at = utcnow()
            sent += 1
    return sent


def predictive(db: Session, today: date | None = None) -> list[dict[str, Any]]:
    """Signaux de SAV prédictif par équipement (sans IA : règles explicables)."""
    from app.modules.support.models import Ticket

    today = today or date.today()
    signals: list[dict[str, Any]] = []
    for equipment in db.execute(select(BuildingEquipment)).scalars():
        reasons = []
        ticket_category = CATEGORY_TO_TICKET.get(equipment.category, "equipement")
        recent = db.execute(
            select(func.count())
            .select_from(Ticket)
            .where(
                Ticket.project_id == equipment.project_id,
                Ticket.category == ticket_category,
                Ticket.created_at >= utcnow() - timedelta(days=180),
                Ticket.status != "cancelled",
            )
        ).scalar_one()
        if recent >= 2:
            reasons.append(f"{recent} demandes SAV « {ticket_category} » en 6 mois")
        if equipment.warranty_until and today <= equipment.warranty_until <= today + timedelta(days=60):
            reasons.append(f"garantie jusqu'au {equipment.warranty_until:%d/%m/%Y} : contrôle à faire avant expiration")
        overdue = db.execute(
            select(func.count())
            .select_from(MaintenanceTask)
            .where(
                MaintenanceTask.equipment_id == equipment.id,
                MaintenanceTask.status == "planned",
                MaintenanceTask.due_on < today - timedelta(days=30),
            )
        ).scalar_one()
        if overdue:
            reasons.append(f"{overdue} entretien(s) en retard de plus de 30 jours")
        if reasons:
            signals.append({"equipment": equipment, "reasons": reasons})
    return signals


def daily_job(db: Session) -> dict[str, Any]:
    sent = reminders(db)
    alerts = 0
    for signal in predictive(db):
        equipment = signal["equipment"]
        emit(
            db,
            "maintenance.predictive_alert",
            {
                "equipment_id": equipment.id,
                "equipment": equipment.name,
                "project_id": equipment.project_id,
                "reasons": signal["reasons"],
                "summary": " ; ".join(signal["reasons"]),
                "link": f"/erp/chantiers/{equipment.project_id}?onglet=batiment",
            },
            aggregate_type="building_equipment",
            aggregate_id=equipment.id,
            project_id=equipment.project_id,
        )
        alerts += 1
    return {"items": sent, "alerts": alerts}


# ---------------------------------------------------------------------------- passeport PDF
def passport_pdf(db: Session, project: Any) -> bytes:
    from app.core.pdf import PdfDocument, fmt_date
    from app.modules.documents.models import Document
    from app.modules.projects.models import Warranty
    from app.modules.proofs.models import Proof

    equipment = (
        db.execute(
            select(BuildingEquipment)
            .where(BuildingEquipment.project_id == project.id, BuildingEquipment.client_visible.is_(True))
            .order_by(BuildingEquipment.category, BuildingEquipment.name)
        )
        .scalars()
        .all()
    )
    warranties = (
        db.execute(select(Warranty).where(Warranty.project_id == project.id).order_by(Warranty.end_date))
        .scalars()
        .all()
    )
    upcoming = (
        db.execute(
            select(MaintenanceTask)
            .where(
                MaintenanceTask.project_id == project.id,
                MaintenanceTask.status.in_(["planned", "booked"]),
                MaintenanceTask.due_on <= date.today() + timedelta(days=365),
            )
            .order_by(MaintenanceTask.due_on)
        )
        .scalars()
        .all()
    )
    plans_docs = (
        db.execute(
            select(Document).where(
                Document.project_id == project.id,
                Document.client_visible.is_(True),
                Document.deleted_at.is_(None),
                Document.published_version_id.is_not(None),
            )
        )
        .scalars()
        .all()
    )
    proofs = {
        p.subject_id: p
        for p in db.execute(
            select(Proof).where(Proof.project_id == project.id, Proof.subject_type == "document_version")
        ).scalars()
    }
    rows = [
        [e.name, f"{e.brand or ''} {e.model or ''}".strip() or "—", e.location or "—", fmt_date(e.warranty_until)]
        for e in equipment
    ]
    paragraphs = [
        (
            "Garanties",
            "\n".join(
                f"{w.kind.replace('_', ' ')} : du {fmt_date(w.start_date)} au {fmt_date(w.end_date)}"
                + (f" — {w.insurer}" if w.insurer else "")
                + (f" (police {w.policy_number})" if w.policy_number else "")
                for w in warranties
            )
            or "Aucune garantie enregistrée.",
        ),
        (
            "Plans et documents conformes",
            "\n".join(
                f"{d.title}"
                + (
                    f" — preuve {proofs[str(d.published_version_id)].number}"
                    if str(d.published_version_id) in proofs
                    else ""
                )
                for d in plans_docs
            )
            or "Les documents publiés sont disponibles dans l'espace client.",
        ),
        (
            "Carnet d'entretien (12 prochains mois)",
            "\n".join(
                f"{fmt_date(t.due_on)} — {t.title} ({'vous' if t.performer == 'client' else 'technicien'})"
                for t in upcoming[:40]
            )
            or "Aucun entretien planifié.",
        ),
        (
            "En cas de besoin",
            "Signalez toute anomalie depuis votre espace client (SAV) ou par WhatsApp : la demande est datée, "
            "suivie et couverte par vos garanties le cas échéant.",
        ),
    ]
    doc = PdfDocument(
        title="Passeport du bâtiment",
        number=project.code,
        issued_on=date.today(),
        meta=[
            ("Ouvrage", project.name),
            ("Adresse", ", ".join(x for x in (project.address, project.city) if x) or "—"),
            ("Réception", fmt_date(project.reception_date or project.end_actual)),
            ("Surface", f"{project.surface_m2} m²" if project.surface_m2 else "—"),
        ],
        columns=["Équipement", "Marque / modèle", "Localisation", "Garantie"] if rows else [],
        rows=rows,
        col_widths=[170, 130, 110, 70] if rows else None,
        paragraphs=paragraphs,
        footer_note="Passeport du bâtiment GLOBUS ENGINEERING — à conserver et à transmettre en cas de vente.",
    )
    from app.modules.documents.seals import sealed_pdf

    return sealed_pdf(
        db,
        doc,
        kind="building_passport",
        entity_type="project",
        entity_id=project.id,
        reference=project.code,
        title=f"Passeport du bâtiment — {project.name}",
        issued_on=doc.issued_on,
    )


def certified_passport(db: Session, project: Any, *, actor_id: uuid.UUID | None) -> tuple[bytes, Any]:
    """PDF du passeport + preuve opposable (empreinte certifiée, vérifiable par QR)."""
    import hashlib

    from app.modules.proofs.service import certify

    data = passport_pdf(db, project)
    digest = hashlib.sha256(data).hexdigest()
    proof = certify(
        db,
        subject_type="building_passport",
        subject_id=f"{project.id}:{digest[:16]}",
        title=f"Passeport du bâtiment — {project.name}",
        sha256=digest,
        project_id=project.id,
        summary={"project": project.code, "issued_on": date.today()},
        client_visible=True,
        actor_id=actor_id,
    )
    return data, proof


def equipment_out(db: Session, e: BuildingEquipment, *, user_id: Any) -> dict[str, Any]:
    from app.core.downloads import signed_url

    next_task = (
        db.execute(
            select(MaintenanceTask)
            .where(MaintenanceTask.equipment_id == e.id, MaintenanceTask.status.in_(["planned", "booked"]))
            .order_by(MaintenanceTask.due_on)
        )
        .scalars()
        .first()
    )
    return jsonable(
        {
            "id": e.id,
            "category": e.category,
            "name": e.name,
            "brand": e.brand,
            "model": e.model,
            "serial_number": e.serial_number,
            "location": e.location,
            "installed_on": e.installed_on,
            "warranty_until": e.warranty_until,
            "last_service_on": e.last_service_on,
            "maintenance_interval_days": e.maintenance_interval_days,
            "zone_id": e.zone_id,
            "notes": e.notes,
            "client_visible": e.client_visible,
            "manual_url": signed_url(e.manual_file_id, user_id=user_id, ttl=3600) if e.manual_file_id else None,
            "next_task": {"id": next_task.id, "title": next_task.title, "due_on": next_task.due_on}
            if next_task
            else None,
        }
    )


def task_out(t: MaintenanceTask) -> dict[str, Any]:
    return jsonable(
        {
            "id": t.id,
            "equipment_id": t.equipment_id,
            "title": t.title,
            "instructions": t.instructions,
            "due_on": t.due_on,
            "recurrence_days": t.recurrence_days,
            "performer": t.performer,
            "status": t.status,
            "done_on": t.done_on,
            "ticket_id": t.ticket_id,
            "overdue": t.status == "planned" and t.due_on < date.today(),
        }
    )


def get_task(db: Session, task_id: uuid.UUID) -> MaintenanceTask:
    task = db.get(MaintenanceTask, task_id)
    if task is None:
        raise NotFound("Entretien introuvable")
    return task


__all__ = [
    "book_intervention",
    "certified_passport",
    "complete",
    "daily_job",
    "equipment_out",
    "passport_pdf",
    "plans",
    "predictive",
    "reminders",
    "schedule_for",
    "task_out",
]
