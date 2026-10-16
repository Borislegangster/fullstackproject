"""Jeu de données de DÉMONSTRATION pour les tests locaux (refusé en production).

Crée des comptes pour chaque rôle, des organisations partenaires et clientes, trois projets complets (chantiers,
lots, planning, budget, appels de fonds, paiements, documents versionnés, maquette BIM, configurateur), un cycle
achats complet (DA → BC → WhatsApp → réception → rapprochement 3 pièces), un marché de sous-traitance avec
situation, RH (pointages), QHSE, matériel, SAV, messagerie, CRM et un contenu vitrine illustré.
Toutes les données sont marquées « démo » ; les comptes sont listés dans scripts/DEMO_ACCOUNTS.md.
"""

from __future__ import annotations

import io
import json
import logging
import struct
import uuid
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from typing import Any

from PIL import Image, ImageDraw
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.access import Access
from app.core.config import settings
from app.core.deps import Principal
from app.core.files import store_generated, validate_upload
from app.core.numbering import next_number
from app.core.security import hash_password
from app.core.utils import money, utcnow
from app.seeds import illustrations

log = logging.getLogger("globus.seed.demo")
DEMO_PASSWORD = "Globus!Demo2026"
DEMO_DOMAIN = "globus.demo"
BLUE, ORANGE, LIGHT = (56, 90, 166), (251, 140, 67), (244, 244, 244)

ACCOUNTS: list[tuple[str, str, str, str, str]] = [
    ("admin", "Admin", "Système", "ADMIN", "Administrateur / DG"),
    ("direction", "Diane", "Ngono", "DIRECTION", "Directrice générale adjointe"),
    ("chef.projet", "Patrick", "Essomba", "CHEF_PROJET", "Chef de projet"),
    ("architecte", "Aïcha", "Bello", "ARCHITECTE", "Architecte DPLG"),
    ("ingenieur", "Samuel", "Tchoua", "INGENIEUR", "Ingénieur structure"),
    ("chef.chantier", "Joseph", "Mballa", "CHEF_CHANTIER", "Chef de chantier"),
    ("technicien", "Eric", "Fouda", "TECHNICIEN", "Électricien"),
    ("commercial", "Laure", "Kamga", "COMMERCIAL", "Chargée d'affaires"),
    ("marketing", "Inès", "Eyenga", "MARKETING", "Responsable marketing"),
    ("acheteur", "Martin", "Owona", "ACHETEUR", "Acheteur"),
    ("magasinier", "Paul", "Abena", "MAGASINIER", "Magasinier"),
    ("qhse", "Grace", "Manga", "QHSE", "Responsable QHSE"),
    ("finance", "Hervé", "Nkoulou", "FINANCE", "Responsable financier"),
    ("comptable", "Sandrine", "Atangana", "FINANCE", "Comptable"),
    ("rh", "Brigitte", "Ondoa", "RH", "Responsable RH"),
]


# ============================================================================ utilitaires
def demo_image(label: str, size: tuple[int, int] = (1280, 720), accent: tuple[int, int, int] = BLUE) -> bytes:
    img = Image.new("RGB", size, LIGHT)
    draw = ImageDraw.Draw(img)
    for y in range(size[1]):
        ratio = y / size[1]
        color = tuple(int(accent[i] * (1 - ratio) + LIGHT[i] * ratio * 0.35) for i in range(3))
        draw.line([(0, y), (size[0], y)], fill=color)
    draw.rectangle([0, size[1] - 90, size[0], size[1]], fill=(20, 30, 60))
    draw.text((40, size[1] - 65), f"[DÉMO] {label}", fill=(255, 255, 255))
    draw.rectangle([size[0] - 180, 30, size[0] - 30, 60], fill=ORANGE)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def box_glb(width: float = 12.0, depth: float = 9.0, height: float = 6.0) -> bytes:
    """Maquette GLB simplifiée (volume bâti) pour tester les visionneuses 3D localement."""
    w, d, h = width / 2, depth / 2, height
    faces = [
        ((0, 0, 1), [(-w, 0, d), (w, 0, d), (w, h, d), (-w, h, d)]),
        ((0, 0, -1), [(w, 0, -d), (-w, 0, -d), (-w, h, -d), (w, h, -d)]),
        ((1, 0, 0), [(w, 0, d), (w, 0, -d), (w, h, -d), (w, h, d)]),
        ((-1, 0, 0), [(-w, 0, -d), (-w, 0, d), (-w, h, d), (-w, h, -d)]),
        ((0, 1, 0), [(-w, h, d), (w, h, d), (w, h, -d), (-w, h, -d)]),
        ((0, -1, 0), [(-w, 0, -d), (w, 0, -d), (w, 0, d), (-w, 0, d)]),
    ]
    positions, normals, indices = [], [], []
    for face_index, (normal, corners) in enumerate(faces):
        for corner in corners:
            positions.extend(corner)
            normals.extend(normal)
        base = face_index * 4
        indices.extend([base, base + 1, base + 2, base, base + 2, base + 3])
    pos_bytes = struct.pack(f"<{len(positions)}f", *positions)
    nor_bytes = struct.pack(f"<{len(normals)}f", *normals)
    idx_bytes = struct.pack(f"<{len(indices)}H", *indices)
    idx_bytes += b"\x00" * ((4 - len(idx_bytes) % 4) % 4)
    binary = pos_bytes + nor_bytes + idx_bytes
    gltf = {
        "asset": {"version": "2.0", "generator": "GLOBUS demo seeder"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "Bâtiment"}],
        "materials": [
            {
                "name": "Enduit",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.86, 0.87, 0.9, 1],
                    "metallicFactor": 0,
                    "roughnessFactor": 0.8,
                },
            }
        ],
        "meshes": [
            {
                "name": "Volume",
                "primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "material": 0}],
            }
        ],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(pos_bytes), "target": 34962},
            {"buffer": 0, "byteOffset": len(pos_bytes), "byteLength": len(nor_bytes), "target": 34962},
            {
                "buffer": 0,
                "byteOffset": len(pos_bytes) + len(nor_bytes),
                "byteLength": len(indices) * 2,
                "target": 34963,
            },
        ],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,
                "count": len(positions) // 3,
                "type": "VEC3",
                "min": [-w, 0, -d],
                "max": [w, h, d],
            },
            {"bufferView": 1, "componentType": 5126, "count": len(normals) // 3, "type": "VEC3"},
            {"bufferView": 2, "componentType": 5123, "count": len(indices), "type": "SCALAR"},
        ],
    }
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode()
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    chunks = (
        struct.pack("<I4s", len(json_bytes), b"JSON")
        + json_bytes
        + struct.pack("<I4s", len(binary), b"BIN\x00")
        + binary
    )
    return struct.pack("<4sII", b"glTF", 2, 12 + len(chunks)) + chunks


def demo_pdf(title: str, number: str, lines: list[str]) -> bytes:
    from app.core.pdf import PdfDocument, render

    return render(
        PdfDocument(
            title=title,
            number=number,
            issued_on=date.today(),
            columns=["Contenu"],
            rows=[[line] for line in lines],
            footer_note="Document de démonstration.",
        )
    )


def principal_for(db: Session, user: Any) -> Principal:
    permissions = {code for role in user.roles for code in role.permission_codes}
    return Principal(
        user=user,
        session_id=None,
        roles=set(user.role_codes),
        permissions=permissions,
        organization_id=user.organization_id,
        org_kind=user.organization.kind if user.organization else "internal",
        global_scope=any(r.global_scope for r in user.roles),
        mfa_verified=True,
    )


def access_for(db: Session, user: Any) -> Access:
    return Access(principal_for(db, user), db)


# ============================================================================ identités
def _org(db: Session, name: str, kind: str, **extra: Any) -> Any:
    from app.modules.identity.models import Organization

    org = db.execute(select(Organization).where(Organization.name == name)).scalar_one_or_none()
    if org is None:
        org = Organization(name=name, kind=kind, **extra)
        db.add(org)
        db.flush()
    return org


def _user(
    db: Session,
    email: str,
    first: str,
    last: str,
    role: str,
    job: str | None,
    org_id: uuid.UUID,
    phone: str | None = None,
) -> Any:
    from app.modules.identity.models import User
    from app.modules.identity.service import assign_roles

    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None:
        user = User(
            email=email,
            first_name=first,
            last_name=last,
            password_hash=hash_password(DEMO_PASSWORD),
            organization_id=org_id,
            phone=phone,
            whatsapp=phone,
            job_title=job,
            email_verified_at=utcnow(),
        )
        db.add(user)
        db.flush()
        assign_roles(db, user, [role], granted_by=None)
        db.flush()
        db.refresh(user)
    return user


def seed_identities(db: Session) -> dict[str, Any]:
    from app.modules.identity.models import Organization

    internal = db.execute(select(Organization).where(Organization.kind == "internal")).scalars().first()
    users = {}
    for index, (login, first, last, role, job) in enumerate(ACCOUNTS):
        users[login] = _user(
            db, f"{login}@{DEMO_DOMAIN}", first, last, role, job, internal.id, phone=f"+2376990000{index:02d}"
        )
    client_org = _org(
        db, "Famille Nguema (Paris) — démo", "client", email=f"client@{DEMO_DOMAIN}", city="Paris", country="France"
    )
    investor_org = _org(db, "SCI Akwa Invest — démo", "client", city="Douala", country="Cameroun")
    supplier_org = _org(db, "Quincaillerie du Littoral — démo", "supplier", city="Douala")
    sub_org = _org(db, "BTP Gros Œuvre Sarl — démo", "subcontractor", city="Douala")
    users["client"] = _user(
        db, f"client@{DEMO_DOMAIN}", "Arnaud", "Nguema", "CLIENT", None, client_org.id, "+33612345678"
    )
    users["investisseur"] = _user(
        db, f"investisseur@{DEMO_DOMAIN}", "Rose", "Biyong", "CLIENT", None, investor_org.id, "+237677112233"
    )
    users["fournisseur"] = _user(
        db,
        f"fournisseur@{DEMO_DOMAIN}",
        "Alain",
        "Kotto",
        "FOURNISSEUR",
        "Commercial",
        supplier_org.id,
        "+237690112233",
    )
    users["soustraitant"] = _user(
        db, f"soustraitant@{DEMO_DOMAIN}", "Jean", "Mbarga", "SOUS_TRAITANT", "Gérant", sub_org.id, "+237655443322"
    )
    return {
        "users": users,
        "orgs": {"client": client_org, "investor": investor_org, "supplier": supplier_org, "subcontractor": sub_org},
    }


# ============================================================================ projets
def _project(
    db: Session,
    ids: dict[str, Any],
    *,
    name: str,
    universe: str,
    org: Any,
    status: str,
    city: str,
    lat: float,
    lng: float,
    amount: int,
    start_offset: int,
    months: int,
    progress: int,
) -> Any:
    from app.modules.projects.models import Project, ProjectMember, Site

    project = db.execute(select(Project).where(Project.name == name)).scalar_one_or_none()
    if project is not None:
        return project
    users = ids["users"]
    start = date.today() + timedelta(days=start_offset)
    project = Project(
        code=next_number(db, "project"),
        name=name,
        universe=universe,
        status=status,
        city=city,
        country="Cameroun",
        latitude=lat,
        longitude=lng,
        client_organization_id=org.id,
        contract_amount=money(amount),
        start_planned=start,
        end_planned=start + timedelta(days=30 * months),
        start_actual=start if start_offset < 0 else None,
        progress_pct=Decimal(progress),
        manager_id=users["chef.projet"].id,
        director_id=users["direction"].id,
        commercial_id=users["commercial"].id,
        is_diaspora=universe == "DIASPORA",
        settings={"show_subcontractors": True},
        description="Projet de démonstration.",
    )
    db.add(project)
    db.flush()
    for login, role, finance in (
        ("chef.projet", "chef_projet", True),
        ("architecte", "architecte", False),
        ("ingenieur", "ingenieur", False),
        ("chef.chantier", "chef_chantier", False),
        ("technicien", "technicien", False),
    ):
        db.add(
            ProjectMember(project_id=project.id, user_id=users[login].id, project_role=role, can_view_finance=finance)
        )
    db.add(
        Site(
            project_id=project.id,
            code=f"CH-{project.code[-5:]}",
            name=f"Chantier {city}",
            city=city,
            address=f"{city}, Cameroun",
            latitude=lat,
            longitude=lng,
            geofence_radius_m=300,
            site_manager_id=users["chef.chantier"].id,
            status="active" if status == "execution" else "preparation",
        )
    )
    db.flush()
    return project


def seed_projects(db: Session, ids: dict[str, Any]) -> dict[str, Any]:
    villa = _project(
        db,
        ids,
        name="Villa Nguema — Kotto (démo)",
        universe="DIASPORA",
        org=ids["orgs"]["client"],
        status="execution",
        city="Douala",
        lat=4.0866,
        lng=9.7565,
        amount=85_000_000,
        start_offset=-120,
        months=10,
        progress=42,
    )
    immeuble = _project(
        db,
        ids,
        name="Immeuble R+4 Akwa (démo)",
        universe="BUSINESS",
        org=ids["orgs"]["investor"],
        status="execution",
        city="Douala",
        lat=4.0483,
        lng=9.7043,
        amount=420_000_000,
        start_offset=-60,
        months=18,
        progress=18,
    )
    residence = _project(
        db,
        ids,
        name="Résidence Bonapriso (démo)",
        universe="PREMIUM",
        org=ids["orgs"]["client"],
        status="conception",
        city="Douala",
        lat=4.0333,
        lng=9.6951,
        amount=260_000_000,
        start_offset=45,
        months=14,
        progress=5,
    )
    for project in (villa, immeuble, residence):
        _planning(db, ids, project)
        _finance(db, ids, project)
    return {"villa": villa, "immeuble": immeuble, "residence": residence}


def _planning(db: Session, ids: dict[str, Any], project: Any) -> None:
    from app.modules.projects.models import Lot, Milestone, Phase, Task, TaskAssignment

    if db.execute(select(Lot.id).where(Lot.project_id == project.id)).first():
        return
    lots = [
        ("GO", "Gros œuvre", "structure", Decimal("0.45")),
        ("CET", "Corps d'état techniques", "electricite", Decimal("0.2")),
        ("SO", "Second œuvre et finitions", "architecture", Decimal("0.35")),
    ]
    lot_rows = {}
    for index, (code, name, discipline, share) in enumerate(lots):
        lot = Lot(
            project_id=project.id,
            code=code,
            name=name,
            discipline=discipline,
            sort_order=index,
            budget_amount=money(Decimal(project.contract_amount) * share * Decimal("0.82")),
        )
        db.add(lot)
        lot_rows[code] = lot
    db.flush()
    start = project.start_planned
    phases = [
        ("Installation et fondations", 0, 45),
        ("Élévation et structure", 45, 120),
        ("Réseaux et clos-couvert", 120, 200),
        ("Finitions et réception", 200, 300),
    ]
    for index, (name, begin, end) in enumerate(phases):
        db.add(
            Phase(
                project_id=project.id,
                name=name,
                sort_order=index,
                start_planned=start + timedelta(days=begin),
                end_planned=start + timedelta(days=end),
            )
        )
    tasks = [
        ("Implantation et terrassement", "GO", 0, 12, 100),
        ("Fondations et semelles", "GO", 12, 35, 100),
        ("Élévation murs RDC", "GO", 35, 70, 80),
        ("Dalle haute RDC", "GO", 70, 95, 40),
        ("Élévation étage", "GO", 95, 130, 0),
        ("Gaines et réseaux électriques", "CET", 110, 170, 0),
        ("Plomberie sanitaire", "CET", 120, 180, 0),
        ("Enduits et chapes", "SO", 170, 220, 0),
        ("Carrelage et revêtements", "SO", 210, 260, 0),
        ("Peinture et finitions", "SO", 250, 290, 0),
    ]
    users = ids["users"]
    for index, (title, lot_code, begin, end, pct) in enumerate(tasks):
        task = Task(
            project_id=project.id,
            lot_id=lot_rows[lot_code].id,
            title=title,
            status="done" if pct >= 100 else ("in_progress" if pct > 0 else "todo"),
            start_planned=start + timedelta(days=begin),
            end_planned=start + timedelta(days=end),
            duration_days=max(1, end - begin),
            progress_pct=Decimal(pct),
            sort_order=index,
            client_visible=index % 2 == 0,
            created_by_id=users["chef.projet"].id,
        )
        task.assignments.append(TaskAssignment(user_id=users["chef.chantier"].id))
        db.add(task)
    for index, (name, day, paid) in enumerate(
        [
            ("Fondations terminées", 35, Decimal("15")),
            ("Dalle haute RDC coulée", 95, Decimal("20")),
            ("Hors d'eau / hors d'air", 200, Decimal("25")),
            ("Réception des travaux", 300, Decimal("10")),
        ]
    ):
        due = start + timedelta(days=day)
        db.add(
            Milestone(
                project_id=project.id,
                name=name,
                due_date=due,
                sort_order=index,
                client_visible=True,
                payment_pct=paid,
                status="achieved" if due < date.today() - timedelta(days=20) else "planned",
                achieved_at=datetime.combine(due, time(17), tzinfo=UTC)
                if due < date.today() - timedelta(days=20)
                else None,
            )
        )
    db.flush()


def _finance(db: Session, ids: dict[str, Any], project: Any) -> None:
    from app.modules.finance import service as finance
    from app.modules.finance.models import Budget, FundsCall
    from app.modules.projects.models import Lot

    if db.execute(select(Budget.id).where(Budget.project_id == project.id)).first():
        return
    users = ids["users"]
    lines = [
        {
            "lot_id": lot.id,
            "category": category,
            "label": f"{lot.name} — {label}",
            "amount": money(Decimal(lot.budget_amount) * share),
        }
        for lot in db.execute(select(Lot).where(Lot.project_id == project.id)).scalars()
        for category, label, share in (
            ("materiaux", "matériaux", Decimal("0.55")),
            ("main_oeuvre", "main-d'œuvre", Decimal("0.3")),
            ("sous_traitance", "sous-traitance", Decimal("0.15")),
        )
    ]
    budget = finance.new_budget_version(
        db,
        project_id=project.id,
        label="Budget initial",
        lines=lines,
        notes="Démo",
        user_id=users["finance"].id,
        revenue_target=project.contract_amount,
    )
    finance.approve_budget(db, budget, user_id=users["direction"].id)
    if project.status != "execution":
        return
    call = FundsCall(
        number=next_number(db, "funds_call"),
        project_id=project.id,
        label="Acompte à la signature (30 %)",
        amount=money(Decimal(project.contract_amount) * Decimal("0.3")),
        status="draft",
        due_date=project.start_planned,
        created_by_id=users["finance"].id,
    )
    db.add(call)
    db.flush()
    finance.issue_funds_call(db, call, user_id=users["finance"].id, tax_rate=settings.VAT_RATE)
    _manual_client_payment(db, ids, call)
    second = FundsCall(
        number=next_number(db, "funds_call"),
        project_id=project.id,
        label="Situation fondations (15 %)",
        amount=money(Decimal(project.contract_amount) * Decimal("0.15")),
        status="draft",
        due_date=date.today() + timedelta(days=12),
        created_by_id=users["finance"].id,
    )
    db.add(second)
    db.flush()
    finance.issue_funds_call(db, second, user_id=users["finance"].id, tax_rate=settings.VAT_RATE)


def _manual_client_payment(db: Session, ids: dict[str, Any], call: Any) -> None:
    from app.modules.finance.models import Payment, PaymentAllocation, PaymentTransaction
    from app.modules.finance.payments import apply_transaction_status

    payment = Payment(
        number=next_number(db, "payment"),
        direction="in",
        counterparty_type="client",
        counterparty_label="Client (démo)",
        project_id=call.project_id,
        amount=call.amount,
        currency="XAF",
        method="bank_transfer",
        provider="manual",
        status="processing",
        initiated_by_id=ids["users"]["finance"].id,
        idempotency_key=f"demo:{call.id}",
    )
    payment.allocations.append(PaymentAllocation(target_type="funds_call", target_id=call.id, amount=call.amount))
    db.add(payment)
    db.flush()
    tx = PaymentTransaction(
        payment_id=payment.id, provider="manual", amount=call.amount, currency="XAF", status="pending"
    )
    db.add(tx)
    db.flush()
    apply_transaction_status(
        db, tx, "succeeded", provider_transaction_id=f"VIR-DEMO-{call.number}", reason=None, confirmed_by="manual"
    )


# ============================================================================ achats & stocks
def seed_procurement(db: Session, ids: dict[str, Any], projects: dict[str, Any]) -> None:
    from app.modules.billing import service as billing
    from app.modules.inventory.models import StockItem, Warehouse
    from app.modules.procurement import service as procurement
    from app.modules.procurement.models import PurchaseRequest, PurchaseRequestLine
    from app.modules.projects.models import Site
    from app.modules.suppliers.models import Supplier, SupplierProduct

    if db.execute(select(Supplier.id).where(Supplier.code == "FRN-DEMO-1")).first():
        return
    users = ids["users"]
    warehouse = Warehouse(
        code="MAG-DLA", name="Magasin central Douala", kind="central", manager_id=users["magasinier"].id
    )
    db.add(warehouse)
    catalog = [
        ("CIM-CPJ45", "Ciment CPJ 45 (sac 50 kg)", "sac", 6000, 40),
        ("FER-HA12", "Fer HA 12 (barre 12 m)", "barre", 7800, 60),
        ("FER-HA10", "Fer HA 10 (barre 12 m)", "barre", 5600, 60),
        ("SAB-RIV", "Sable de rivière", "m3", 15000, 10),
        ("GRA-0515", "Gravier 5/15", "m3", 22000, 10),
        ("PAR-AGG", "Parpaing 15 x 20 x 40", "u", 450, 500),
        ("CAB-25", "Câble électrique 2,5 mm² (100 m)", "rouleau", 32000, 5),
        ("TUB-PVC100", "Tube PVC Ø100 (4 m)", "u", 6500, 20),
    ]
    items = {}
    for sku, name, unit, _price, threshold in catalog:
        item = StockItem(
            sku=sku,
            name=name,
            unit=unit,
            category="gros_oeuvre",
            min_threshold=Decimal(threshold),
            reorder_quantity=Decimal(threshold * 3),
        )
        db.add(item)
        items[sku] = item
    db.flush()
    suppliers = []
    for index, (legal, city, wa, email, quality) in enumerate(
        [
            (
                "Quincaillerie du Littoral (démo)",
                "Douala",
                "+237690112233",
                f"commandes@qdl.{DEMO_DOMAIN}",
                Decimal("86"),
            ),
            ("Cimenteries Centrales (démo)", "Douala", "+237699887766", f"ventes@cc.{DEMO_DOMAIN}", Decimal("78")),
            ("Fers & Aciers du Wouri (démo)", "Douala", None, f"contact@faw.{DEMO_DOMAIN}", Decimal("70")),
        ]
    ):
        supplier = Supplier(
            code=f"FRN-DEMO-{index + 1}",
            legal_name=legal,
            city=city,
            email=email,
            whatsapp_number=wa,
            whatsapp_opt_in=bool(wa),
            preferred_channel="whatsapp" if wa else "email",
            status="active",
            delivery_zones=["Douala"],
            lead_time_days=3 + index,
            payment_terms="30 jours",
            quality_score=quality,
            organization_id=ids["orgs"]["supplier"].id if index == 0 else None,
        )
        db.add(supplier)
        db.flush()
        for sku, name, unit, price, _threshold in catalog:
            db.add(
                SupplierProduct(
                    supplier_id=supplier.id,
                    stock_item_id=items[sku].id,
                    reference=f"{sku}-{index + 1}",
                    name=name,
                    unit=unit,
                    unit_price=money(price * (1 + index * Decimal("0.04"))),
                    lead_time_days=2 + index,
                    stock_available=Decimal(1000),
                )
            )
        suppliers.append(supplier)
    db.flush()
    villa = projects["villa"]
    site = db.execute(select(Site).where(Site.project_id == villa.id)).scalars().first()
    pr = PurchaseRequest(
        number=next_number(db, "purchase_request"),
        project_id=villa.id,
        site_id=site.id,
        zone="Dalle haute RDC",
        requested_by_id=users["chef.chantier"].id,
        urgency="urgent",
        justification="Coulage de la dalle haute du rez-de-chaussée",
        needed_by=date.today() + timedelta(days=4),
    )
    pr.lines.extend(
        [
            PurchaseRequestLine(
                stock_item_id=items["CIM-CPJ45"].id,
                description="Ciment CPJ 45 (sac 50 kg)",
                quantity=Decimal(150),
                unit="sac",
                estimated_unit_price=Decimal(6000),
            ),
            PurchaseRequestLine(
                stock_item_id=items["FER-HA12"].id,
                description="Fer HA 12 (barre 12 m)",
                quantity=Decimal(80),
                unit="barre",
                estimated_unit_price=Decimal(7800),
            ),
        ]
    )
    db.add(pr)
    db.flush()
    procurement.submit_request(db, pr, user_id=users["chef.chantier"].id)
    for login in ("chef.projet", "acheteur"):
        if pr.status == "submitted":
            procurement.decide_request(
                db, pr, principal=principal_for(db, users[login]), approve=True, comment="OK démo"
            )
    po = procurement.po_from_request(
        db,
        pr,
        supplier_id=suppliers[0].id,
        user_id=users["acheteur"].id,
        prices=None,
        expected_date=date.today() + timedelta(days=3),
        reason={"demo": True},
    )
    procurement.send_po(db, po, user_id=users["acheteur"].id)
    procurement.supplier_respond(
        db, po, action="confirm", note="Livraison prévue jeudi", counter=None, actor_label=suppliers[0].legal_name
    )
    procurement.announce_shipment(
        db,
        po,
        eta=utcnow() + timedelta(days=1),
        carrier="Transports Express (démo)",
        tracking="TE-2026-1189",
        vehicle="LT 123 AB",
        driver="Paul",
        driver_phone="+237670000000",
        note_ref="BL-778",
    )
    receipt = procurement.create_receipt(
        db,
        po=po,
        project_id=villa.id,
        user_id=users["chef.chantier"].id,
        lines=[
            {"po_line_id": line.id, "quantity_received": line.quantity, "batch_number": f"LOT-{line.reference}"}
            for line in po.lines
        ],
        data={
            "destination": "stock",
            "warehouse_id": warehouse.id,
            "latitude": 4.0866,
            "longitude": 9.7565,
            "driver_name": "Paul",
            "vehicle_plate": "LT 123 AB",
            "delivery_note_ref": "BL-778",
            "source": "mobile",
        },
    )
    photo = store_generated(
        db,
        illustrations.render("site", seed=7),
        filename="livraison.jpg",
        mime="image/jpeg",
        purpose="goods_receipts",
        uploaded_by_id=users["chef.chantier"].id,
    )
    receipt.photo_file_ids = [str(photo.id)]
    procurement.validate_receipt(db, receipt, user_id=users["chef.chantier"].id)
    invoice = billing.register_supplier_invoice(
        db,
        supplier_id=suppliers[0].id,
        reference="FQ-DEMO-1501",
        po_id=po.id,
        invoice_date=date.today(),
        due_date=None,
        lines=[
            {
                "po_line_id": line.id,
                "description": line.description,
                "quantity": line.quantity,
                "unit_price": line.unit_price,
            }
            for line in po.lines
        ],
        tax_amount=Decimal(po.tax_amount),
        file_id=None,
        user_id=users["finance"].id,
    )
    billing.three_way_match(db, invoice, user_id=users["finance"].id)
    billing.finance_validate(db, invoice, user_id=users["finance"].id)
    second_pr = PurchaseRequest(
        number=next_number(db, "purchase_request"),
        project_id=projects["immeuble"].id,
        requested_by_id=users["chef.chantier"].id,
        justification="Approvisionnement parpaings R+1",
        urgency="normal",
    )
    second_pr.lines.append(
        PurchaseRequestLine(
            stock_item_id=items["PAR-AGG"].id,
            description="Parpaing 15 x 20 x 40",
            quantity=Decimal(4000),
            unit="u",
            estimated_unit_price=Decimal(450),
        )
    )
    db.add(second_pr)
    db.flush()
    procurement.submit_request(db, second_pr, user_id=users["chef.chantier"].id)


# ============================================================================ sous-traitance
def seed_subcontracting(db: Session, ids: dict[str, Any], projects: dict[str, Any]) -> None:
    from app.modules.subcontracting import service as sub_service
    from app.modules.subcontracting.models import Subcontractor, Tender, TenderInvitation, TenderItem, TenderLot

    if db.execute(select(Subcontractor.id).where(Subcontractor.code == "ST-DEMO-1")).first():
        return
    users = ids["users"]
    sub = Subcontractor(
        code="ST-DEMO-1",
        legal_name="BTP Gros Œuvre Sarl (démo)",
        trades=["gros_oeuvre"],
        zones=["Douala"],
        city="Douala",
        email=f"contact@btpgo.{DEMO_DOMAIN}",
        workforce_size=25,
        organization_id=ids["orgs"]["subcontractor"].id,
        status="prospect",
        insurance_rc_until=date.today() + timedelta(days=300),
        insurance_decennale_until=date.today() + timedelta(days=300),
    )
    db.add(sub)
    db.flush()
    sub_service.qualify(
        db,
        sub,
        trade="gros_oeuvre",
        criteria={"references": 4, "capacite": 4, "securite": 4, "finances": 3, "qualite": 4},
        references=[{"project": "Immeuble R+3 Bali", "year": 2024}],
        document_file_ids=[],
        decision="approved",
        comment="Démo",
        user_id=users["direction"].id,
    )
    immeuble = projects["immeuble"]
    tender = Tender(
        number=next_number(db, "tender"),
        project_id=immeuble.id,
        title="Gros œuvre niveaux R+1 à R+4",
        deadline=utcnow() - timedelta(hours=1),
        quality_criteria=sub_service.DEFAULT_CRITERIA,
        status="published",
        published_at=utcnow() - timedelta(days=7),
        created_by_id=users["chef.projet"].id,
    )
    lot = TenderLot(code="GO", name="Gros œuvre", estimated_amount=Decimal(98_000_000))
    lot.items.extend(
        [
            TenderItem(
                sort_order=0,
                designation="Béton armé C25/30 (poteaux, poutres, dalles)",
                unit="m3",
                quantity=Decimal(420),
            ),
            TenderItem(sort_order=1, designation="Maçonnerie de parpaings", unit="m2", quantity=Decimal(3200)),
        ]
    )
    tender.lots.append(lot)
    db.add(tender)
    db.flush()
    db.add(TenderInvitation(tender_id=tender.id, subcontractor_id=sub.id, status="submitted"))
    db.flush()
    from app.modules.subcontracting.models import Bid, BidLine

    bid = Bid(
        tender_id=tender.id,
        tender_lot_id=lot.id,
        subcontractor_id=sub.id,
        duration_days=180,
        status="submitted",
        submitted_at=utcnow() - timedelta(days=2),
    )
    total = Decimal(0)
    for item, price in zip(lot.items, (Decimal(185000), Decimal(6500)), strict=True):
        line_total = money(Decimal(item.quantity) * price)
        bid.lines.append(
            BidLine(
                tender_item_id=item.id,
                designation=item.designation,
                unit=item.unit,
                quantity=item.quantity,
                unit_price=price,
                total=line_total,
            )
        )
        total += line_total
    bid.amount = money(total)
    db.add(bid)
    tender.status = "closed"
    db.flush()
    contract = sub_service.award(
        db,
        tender,
        bid,
        user_id=users["direction"].id,
        title="Gros œuvre R+1 à R+4",
        retention_pct=Decimal(5),
        advance_amount=Decimal(9_000_000),
        advance_recovery_pct=Decimal(20),
        penalty_per_day=Decimal(50000),
        start_date=date.today() - timedelta(days=20),
        end_date=date.today() + timedelta(days=160),
        terms=None,
    )
    sub_service.send_contract(db, contract, user_id=users["direction"].id)
    sub_service.sign_contract(
        db, contract, signer_name="Jean Mbarga", user_id=users["soustraitant"].id, otp={"demo": True}
    )
    sub_service.mobilize(
        db,
        contract,
        data={
            "mobilization_date": date.today() - timedelta(days=18),
            "team_size": 18,
            "supervisor_name": "Jean Mbarga",
            "site_access_granted": True,
            "safety_induction_done": True,
        },
        user_id=users["chef.projet"].id,
    )
    situation = sub_service.create_situation(
        db,
        contract,
        period_start=date.today() - timedelta(days=18),
        period_end=date.today() - timedelta(days=1),
        lines=[
            {"item_id": contract.items[0].id, "period_quantity": 60},
            {"item_id": contract.items[1].id, "period_quantity": 450},
        ],
        user_id=users["soustraitant"].id,
    )
    photo = store_generated(
        db,
        illustrations.render("site", seed=8),
        filename="situation.jpg",
        mime="image/jpeg",
        purpose="situations",
        uploaded_by_id=users["soustraitant"].id,
    )
    situation.photo_file_ids = [str(photo.id)]
    sub_service.submit_situation(db, situation, contract, user_id=users["soustraitant"].id)


# ============================================================================ RH, QHSE, matériel
def seed_operations(db: Session, ids: dict[str, Any], projects: dict[str, Any]) -> None:
    from app.modules.equipment.models import Equipment
    from app.modules.equipment.service import assign, create_equipment, log_usage
    from app.modules.hr.models import Attendance, Employee
    from app.modules.hr.service import create_employee
    from app.modules.projects.models import Site
    from app.modules.qhse.models import InspectionTemplate, SafetyTalk
    from app.modules.qhse.service import complete_inspection, create_action, declare_incident, start_inspection

    users = ids["users"]
    villa = projects["villa"]
    site = db.execute(select(Site).where(Site.project_id == villa.id)).scalars().first()
    if not db.execute(select(Employee.id).where(Employee.first_name == "Ali")).first():
        roster = [
            ("Ali", "Moussa", "Maçon", "maconnerie", "journalier", 6000),
            ("Bruno", "Etame", "Ferrailleur", "ferraillage", "journalier", 6500),
            ("Cédric", "Nana", "Coffreur", "coffrage", "journalier", 6500),
            ("Daniel", "Ewane", "Manœuvre", None, "journalier", 4000),
            ("Eric", "Fouda", "Électricien", "electricite", "CDI", 0),
        ]
        for first, last, job, trade, contract, daily in roster:
            employee = create_employee(
                db,
                data={
                    "first_name": first,
                    "last_name": last,
                    "job_title": job,
                    "trade": trade,
                    "contract_type": contract,
                    "hire_date": date.today() - timedelta(days=200),
                    "daily_rate": Decimal(daily),
                    "base_salary": Decimal(0 if daily else 280000),
                    "pay_frequency": "daily" if daily else "monthly",
                    "current_project_id": villa.id,
                    "user_id": users["technicien"].id if first == "Eric" else None,
                },
                user_id=users["rh"].id,
            )
            for offset in range(1, 11):
                day = date.today() - timedelta(days=offset)
                if day.weekday() == 6:
                    continue
                start = datetime.combine(day, time(6, 25), tzinfo=UTC)
                db.add(
                    Attendance(
                        employee_id=employee.id,
                        project_id=villa.id,
                        site_id=site.id,
                        work_date=day,
                        check_in=start,
                        check_out=start + timedelta(hours=10),
                        method="qr",
                        latitude=4.0866,
                        longitude=9.7565,
                        inside_geofence=True,
                        hours_worked=Decimal("9.00"),
                        overtime_hours=Decimal("1.00"),
                        status="present",
                        recorded_by_id=users["chef.chantier"].id,
                    )
                )
        db.flush()
    template = db.execute(
        select(InspectionTemplate).where(InspectionTemplate.name == "Inspection sécurité chantier")
    ).scalar_one_or_none()
    if template is not None and not db.execute(select(SafetyTalk.id).where(SafetyTalk.project_id == villa.id)).first():
        inspection = start_inspection(
            db,
            template=template,
            project_id=villa.id,
            site_id=site.id,
            zone_id=None,
            category="securite",
            inspection_date=date.today() - timedelta(days=3),
            user_id=users["qhse"].id,
        )
        complete_inspection(
            db,
            inspection,
            results=[
                {"key": c["key"], "status": "nok" if c["key"] == "balisage" else "ok"} for c in template.checklist
            ],
            findings="Balisage de la zone de levage à compléter.",
            user_id=users["qhse"].id,
        )
        incident = declare_incident(
            db,
            data={
                "project_id": villa.id,
                "site_id": site.id,
                "kind": "presque_accident",
                "severity": "medium",
                "occurred_at": utcnow() - timedelta(days=2),
                "title": "Chute d'outil depuis l'échafaudage (sans blessé)",
                "description": "Plinthe de protection manquante.",
                "source": "mobile",
            },
            user_id=users["chef.chantier"].id,
        )
        create_action(
            db,
            project_id=villa.id,
            source_type="incident",
            source_id=incident.id,
            title="Poser des plinthes sur tous les échafaudages",
            description=None,
            responsible_id=users["chef.chantier"].id,
            due_date=date.today() + timedelta(days=3),
            user_id=users["qhse"].id,
        )
        db.add(
            SafetyTalk(
                project_id=villa.id,
                site_id=site.id,
                talk_date=date.today() - timedelta(days=1),
                topic="Travail en hauteur et port du harnais",
                animator_id=users["chef.chantier"].id,
                attendees=[{"name": n, "signed": True} for n in ("Ali Moussa", "Bruno Etame", "Cédric Nana")],
                attendee_count=3,
            )
        )
    if not db.execute(select(Equipment.id).where(Equipment.name == "Bétonnière 350 L (démo)")).first():
        for name, category, hourly, daily in (
            ("Bétonnière 350 L (démo)", "outillage", 2500, 15000),
            ("Mini-pelle 3,5 t (démo)", "engin", 15000, 120000),
            ("Échafaudage 50 m² (démo)", "echafaudage", 0, 8000),
        ):
            equipment = create_equipment(
                db,
                data={
                    "name": name,
                    "category": category,
                    "hourly_cost": Decimal(hourly),
                    "daily_cost": Decimal(daily),
                    "insurance_until": date.today() + timedelta(days=200),
                },
                user_id=users["magasinier"].id,
            )
            assign(
                db,
                equipment,
                project_id=villa.id,
                site_id=site.id,
                operator_id=users["chef.chantier"].id,
                start=date.today() - timedelta(days=10),
                end=None,
                notes=None,
                user_id=users["magasinier"].id,
            )
            if hourly:
                log_usage(
                    db,
                    equipment,
                    usage_date=date.today() - timedelta(days=1),
                    hours=Decimal(6),
                    km=Decimal(0),
                    fuel_liters=Decimal(12),
                    fuel_cost=Decimal(9000),
                    project_id=villa.id,
                    site_id=site.id,
                    operator_id=users["chef.chantier"].id,
                    notes=None,
                    user_id=users["chef.chantier"].id,
                )


# ============================================================================ documents, BIM, configurateur
def seed_documents_and_bim(db: Session, ids: dict[str, Any], projects: dict[str, Any]) -> None:
    from app.modules.bim.models import BimModel
    from app.modules.bim.service import create_issue, publish_version, upload_version, validate_version
    from app.modules.configurator.models import ConfiguratorModel, ConfiguratorZone, Material, MaterialCategory
    from app.modules.documents import service as ged

    users = ids["users"]
    villa = projects["villa"]
    if db.execute(select(BimModel.id).where(BimModel.project_id == villa.id)).first():
        return
    archi = access_for(db, users["architecte"])
    manager = access_for(db, users["chef.projet"])
    pdf = demo_pdf("PLAN DE MASSE", "PLN-001", ["Implantation du bâtiment", "Cotes de niveau", "Accès et réseaux"])
    document, v1 = ged.create_document(
        db,
        access=archi,
        upload=validate_upload("plan-masse-v1.pdf", pdf, category="document"),
        title="Plan de masse",
        doc_type="plan",
        project_id=villa.id,
        site_id=None,
        lot_id=None,
        folder_id=None,
        discipline="architecture",
        confidentiality="internal",
        description="Plan de masse de la villa",
        tags=["plan"],
    )
    document.client_visible = True
    ged.transition_version(db, access=manager, version=v1, target="published")
    pdf2 = demo_pdf(
        "PLAN DE MASSE", "PLN-001 v2", ["Implantation du bâtiment (recul +1 m)", "Cotes de niveau", "Accès et réseaux"]
    )
    v2 = ged.new_version(
        db,
        access=archi,
        document=document,
        upload=validate_upload("plan-masse-v2.pdf", pdf2, category="document"),
        reason="Recul de façade demandé par la mairie",
        major=True,
    )
    ged.transition_version(db, access=manager, version=v2, target="published")
    model = BimModel(
        project_id=villa.id,
        name="Maquette architecture",
        discipline="architecture",
        created_by_id=users["architecte"].id,
    )
    db.add(model)
    db.flush()
    version = upload_version(
        db,
        access=archi,
        model=model,
        upload=validate_upload("villa.glb", box_glb(), category="any", allow_bim=True),
        revision_reason=None,
    )
    validate_version(db, version, user_id=users["architecte"].id)
    publish_version(db, model, version, user_id=users["architecte"].id, to_client=True)
    create_issue(
        db,
        project_id=villa.id,
        user_id=users["architecte"].id,
        data={
            "version_id": version.id,
            "title": "Vérifier la retombée de poutre au-dessus de la baie du séjour",
            "kind": "design",
            "priority": "high",
            "discipline": "structure",
            "assignee_id": users["ingenieur"].id,
            "due_date": date.today() + timedelta(days=4),
        },
    )
    sol = db.execute(select(MaterialCategory).where(MaterialCategory.key == "sol")).scalar_one_or_none()
    if sol is None:
        return
    base = Material(
        category_id=sol.id,
        name="Grès cérame 60x60 (démo)",
        unit="m2",
        unit_price=Decimal(12000),
        lead_time_days=3,
        tier="standard",
        color_hex="#D9D4CC",
    )
    confort = Material(
        category_id=sol.id,
        name="Parquet stratifié chêne (démo)",
        unit="m2",
        unit_price=Decimal(18500),
        lead_time_days=7,
        tier="confort",
        color_hex="#B98A5A",
    )
    premium = Material(
        category_id=sol.id,
        name="Marbre poli (démo)",
        unit="m2",
        unit_price=Decimal(45000),
        lead_time_days=25,
        availability="on_order",
        tier="premium",
        color_hex="#EDEDED",
    )
    db.add_all([base, confort, premium])
    db.flush()
    configurator = ConfiguratorModel(
        project_id=villa.id,
        name="Séjour et chambres",
        source="bim_version",
        bim_version_id=version.id,
        published_to_client=True,
        lock_date=date.today() + timedelta(days=30),
    )
    configurator.zones.extend(
        [
            ConfiguratorZone(
                key="sol_sejour",
                label="Sol du séjour",
                room="Séjour",
                category_key="sol",
                quantity=Decimal(48),
                unit="m2",
                default_material_id=base.id,
                mesh_names=["Volume"],
                sort_order=0,
            ),
            ConfiguratorZone(
                key="sol_chambres",
                label="Sol des chambres",
                room="Chambres",
                category_key="sol",
                quantity=Decimal(42),
                unit="m2",
                default_material_id=base.id,
                mesh_names=["Volume"],
                sort_order=1,
            ),
        ]
    )
    db.add(configurator)
    db.flush()


# ============================================================================ CRM, SAV, messagerie, vitrine
def _xlsx_metre() -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill

    wb = Workbook()
    ws = wb.active
    ws.title = "Métré gros œuvre"
    ws.append(["Code", "Désignation", "Unité", "Quantité", "PU (FCFA)", "Montant (FCFA)"])
    lines = [
        ("GO-01", "Fouilles en rigole", "m3", 38.5, 6500),
        ("GO-02", "Béton de propreté dosé à 150 kg", "m3", 6.2, 72000),
        ("GO-03", "Béton armé semelles dosé à 350 kg", "m3", 14.8, 135000),
        ("GO-04", "Acier HA 10 / HA 12", "kg", 1850, 900),
        ("GO-05", "Maçonnerie agglos 15 creux", "m2", 212, 9500),
        ("GO-06", "Dalle pleine ép. 16 cm", "m2", 128, 38000),
    ]
    for code, label, unit, qty, pu in lines:
        ws.append([code, label, unit, qty, pu, round(qty * pu)])
    ws.append(["", "Total gros œuvre", "", "", "", sum(round(q * p) for *_, q, p in lines)])
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="385AA6")
    recap = wb.create_sheet("Récapitulatif")
    recap.append(["Lot", "Montant HT (FCFA)", "Avancement"])
    recap.append(["Gros œuvre", 21_356_950, "65 %"])
    recap.append(["Second œuvre", 14_200_000, "10 %"])
    recap.append(["VRD", 3_400_000, "0 %"])
    import io as _io

    buf = _io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _docx_compte_rendu() -> bytes:
    import io as _io

    import docx

    document = docx.Document()
    document.add_heading("Compte rendu de chantier n°1 — Villa Nguema", level=1)
    document.add_paragraph(
        "Visite du 12/10/2026 — présents : maître d'ouvrage (visio), chef de projet, chef de chantier."
    )
    document.add_heading("Avancement", level=2)
    for item in (
        "Fondations coulées et contrôlées",
        "Élévation des murs du RDC à 60 %",
        "Livraison des aciers R+1 confirmée",
    ):
        document.add_paragraph(item, style="List Bullet")
    document.add_heading("Décisions", level=2)
    paragraph = document.add_paragraph("Le client valide le carrelage ")
    paragraph.add_run("grès cérame 60x60 « Sable »").bold = True
    paragraph.add_run(" (impact : +350 000 FCFA, 0 jour).")
    table = document.add_table(rows=3, cols=3)
    for r, values in enumerate(
        (
            ("Action", "Responsable", "Échéance"),
            ("Commande menuiseries", "Acheteur", "20/10"),
            ("PV d'implantation", "Chef de chantier", "15/10"),
        )
    ):
        for c, value in enumerate(values):
            table.cell(r, c).text = value
    buf = _io.BytesIO()
    document.save(buf)
    return buf.getvalue()


def seed_office_documents(db: Session, ids: dict[str, Any], projects: dict[str, Any] | None = None) -> None:
    """Documents bureautiques (Excel, Word, CSV) publiés dans la GED pour tester les aperçus intégrés."""
    from app.modules.documents import service as ged
    from app.modules.documents.models import Document
    from app.modules.projects.models import Project

    villa = (projects or {}).get("villa") or db.execute(
        select(Project).where(Project.name.ilike("%Nguema%"))
    ).scalars().first()
    if (
        villa is None
        or db.execute(
            select(Document.id).where(
                Document.project_id == villa.id, Document.title == "Métré quantitatif — gros œuvre"
            )
        ).first()
    ):
        return
    users = ids["users"]
    engineer = access_for(db, users["ingenieur"])
    manager = access_for(db, users["chef.projet"])
    files = [
        ("metre-gros-oeuvre.xlsx", _xlsx_metre(), "Métré quantitatif — gros œuvre", "rapport", "structure"),
        ("compte-rendu-chantier-01.docx", _docx_compte_rendu(), "Compte rendu de chantier n°1", "pv", "architecture"),
        (
            "planning-approvisionnements.csv",
            "Lot;Article;Quantité;Livraison prévue\nGros œuvre;Ciment CPJ 42.5;200 sacs;14/10/2026\nGros œuvre;Acier HA 12;1,2 t;16/10/2026\nSecond œuvre;Carrelage 60x60;140 m2;05/11/2026\n".encode(),
            "Planning des approvisionnements",
            "rapport",
            "architecture",
        ),
    ]
    for filename, data, title, doc_type, discipline in files:
        document, version = ged.create_document(
            db,
            access=engineer,
            upload=validate_upload(filename, data, category="document"),
            title=title,
            doc_type=doc_type,
            project_id=villa.id,
            site_id=None,
            lot_id=None,
            folder_id=None,
            discipline=discipline,
            confidentiality="internal",
            description=f"{title} (démonstration)",
            tags=["demo"],
        )
        document.client_visible = True
        ged.transition_version(db, access=manager, version=version, target="published")
    db.flush()


def seed_crm_support_chat(db: Session, ids: dict[str, Any], projects: dict[str, Any]) -> None:
    from app.modules.communications.service import project_channel, send_message
    from app.modules.crm.models import Lead
    from app.modules.crm.service import create_lead
    from app.modules.support.service import create_ticket

    users = ids["users"]
    if not db.execute(select(Lead.id).where(Lead.email.like(f"%@{DEMO_DOMAIN}"))).first():
        leads = [
            (
                "Christelle",
                "Mvondo",
                "HOME",
                "Construire une maison R+1 à Logbessou, terrain titré de 400 m².",
                25_000_000,
                40_000_000,
                "Douala",
                "Cameroun",
            ),
            (
                "Thierry",
                "Kamdem",
                "DIASPORA",
                "Je vis à Lyon et souhaite construire une villa à Yaoundé.",
                60_000_000,
                90_000_000,
                "Lyon",
                "France",
            ),
            (
                "Société Agro Plus",
                None,
                "BUSINESS",
                "Entrepôt de 1 200 m² avec bureaux à Bonabéri.",
                300_000_000,
                450_000_000,
                "Douala",
                "Cameroun",
            ),
            (
                "Nadège",
                "Ebodé",
                "PREMIUM",
                "Villa d'architecte avec piscine à Kribi.",
                180_000_000,
                250_000_000,
                "Kribi",
                "Cameroun",
            ),
        ]
        for index, (first, last, universe, message, bmin, bmax, city, country) in enumerate(leads):
            create_lead(
                db,
                data={
                    "first_name": first,
                    "last_name": last,
                    "email": f"prospect{index + 1}@{DEMO_DOMAIN}",
                    "phone": f"+23767700{index:04d}",
                    "universe": universe,
                    "message": message,
                    "budget_min": Decimal(bmin),
                    "budget_max": Decimal(bmax),
                    "city": city,
                    "country": country,
                    "is_diaspora": universe == "DIASPORA",
                    "timeline": "6_12_mois",
                    "has_land": True,
                },
                source="website_form",
                form_key="describe_project",
                consents={"contact": True, "marketing": index % 2 == 0},
                ip=None,
                user_agent="demo-seeder",
            )
    villa = projects["villa"]
    from app.modules.support.models import Ticket

    if not db.execute(select(Ticket.id).where(Ticket.project_id == villa.id)).first():
        create_ticket(
            db,
            data={
                "project_id": villa.id,
                "category": "electricite",
                "priority": "normal",
                "subject": "Prise du séjour sans courant (démo)",
                "description": "Constat lors de la visite de chantier.",
            },
            requester=users["client"],
            channel="portal",
        )
    conversation = project_channel(db, users["chef.projet"], villa.id, client_channel=True)
    if not conversation.last_message_at:
        send_message(
            db,
            conversation,
            users["chef.projet"],
            body="Bonjour, la dalle haute du RDC est programmée "
            "jeudi. Les photos seront disponibles dans votre espace.",
            reply_to_id=None,
            attachments=[],
            client_message_id=None,
        )
        send_message(
            db,
            conversation,
            users["client"],
            body="Merci, je suivrai depuis Paris. Pouvons-nous faire un point vidéo vendredi ?",
            reply_to_id=None,
            attachments=[],
            client_message_id=None,
        )


def seed_vitrine_demo(db: Session, ids: dict[str, Any]) -> None:
    """Contenu éditorial + illustrations et preuves de démonstration (médiathèque) pour tester la vitrine."""
    from app.modules.cms import models as cms
    from app.modules.cms.media import upload_media
    from app.modules.cms.service import transition
    from app.seeds.content import seed_content

    seed_content(db, publish=True)
    principal = principal_for(db, ids["users"]["marketing"])
    if db.execute(select(cms.PortfolioProject.id).where(cms.PortfolioProject.slug == "villa-kotto-demo")).first():
        return
    author = ids["users"]["marketing"].id
    for index, universe in enumerate(db.execute(select(cms.Universe).order_by(cms.Universe.sort_order)).scalars()):
        media = upload_media(
            db,
            filename=f"univers-{universe.slug}.jpg",
            data=illustrations.render(illustrations.UNIVERSE_SCENES.get(universe.key, "site"), seed=10 + index),
            title=universe.name,
            alt_text=f"Illustration de l'univers {universe.name}",
            folder="univers",
            tags=["demo"],
            author_id=author,
        )
        universe.hero_media_id = media.id
    projects = [
        ("villa-kotto-demo", "Villa familiale à Kotto", "HOME", "Douala", 2025, Decimal(240), 11),
        ("immeuble-akwa-demo", "Immeuble de rapport R+4 à Akwa", "BUSINESS", "Douala", 2026, Decimal(1850), 18),
        ("villa-kribi-demo", "Villa d'architecte face à l'océan", "PREMIUM", "Kribi", 2024, Decimal(420), 14),
    ]
    for index, (slug, title, universe, city, year, surface, months) in enumerate(projects):
        cover = upload_media(
            db,
            filename=f"{slug}.jpg",
            data=illustrations.render(illustrations.UNIVERSE_SCENES.get(universe, "site"), seed=20 + index),
            title=title,
            alt_text=title,
            folder="realisations",
            tags=["demo"],
            author_id=author,
        )
        item = cms.PortfolioProject(
            slug=slug,
            title=f"{title} (démo)",
            universe=universe,
            city=city,
            country="Cameroun",
            year=year,
            surface_m2=surface,
            duration_months=months,
            featured=True,
            sort_order=index,
            summary="Réalisation de démonstration : remplacez-la par vos projets réels.",
            challenge="Respecter le budget et le délai annoncés.",
            solution="Conception 3D, budget détaillé, suivi en ligne et contrôles à chaque étape.",
            results=[{"label": "Délai", "value": f"{months} mois"}, {"label": "Surface", "value": f"{surface} m²"}],
            cover_media_id=cover.id,
            created_by_id=author,
        )
        db.add(item)
        db.flush()
        transition(db, principal, "projects", item, "published", note="Démo")
    testimonial = cms.Testimonial(
        author_name="Arnaud N. (démo)",
        author_role="Client diaspora",
        location="Paris",
        universe="DIASPORA",
        rating=5,
        featured=True,
        consent_reference="Démo",
        quote="Depuis Paris, je voyais chaque étape de ma maison avec photos et budget. Aucune mauvaise surprise.",
        created_by_id=author,
    )
    db.add(testimonial)
    db.flush()
    transition(db, principal, "testimonials", testimonial, "published", note="Démo")
    for index, (label, value, suffix) in enumerate(
        (
            ("Projets accompagnés (démo)", 48, None),
            ("Mètres carrés construits (démo)", 26500, " m²"),
            ("Clients satisfaits (démo)", 97, " %"),
        )
    ):
        figure = cms.KeyFigure(
            label=label,
            value=Decimal(value),
            suffix=suffix,
            sort_order=index,
            source_note="Valeur de démonstration — à remplacer",
            created_by_id=author,
        )
        db.add(figure)
        db.flush()
        transition(db, principal, "key_figures", figure, "published", note="Démo")


DEMO_TESTIMONIALS = [
    (
        "Mireille T. (démo)",
        "Propriétaire",
        "Yaoundé",
        "HOME",
        "La maquette 3D nous a permis de tout valider avant de construire : zéro surprise sur le budget.",
    ),
    (
        "Cabinet Essono (démo)",
        "Investisseur",
        "Douala",
        "BUSINESS",
        "Un pilotage d'ingénieur : planning tenu, rentabilité suivie mois après mois.",
    ),
    (
        "Famille K. (démo)",
        "Clients diaspora",
        "Montréal",
        "DIASPORA",
        "Photos datées, visites vidéo et paiements Mobile Money : nous avons tout suivi à distance.",
    ),
    (
        "Dr. Abanda (démo)",
        "Maître d'ouvrage",
        "Kribi",
        "PREMIUM",
        "Des finitions d'exception et une équipe qui explique chaque choix. Un vrai partenaire.",
    ),
]

HOME_SLIDES = [
    (
        "HOME",
        "villa",
        "Votre maison, visualisée avant d'exister.",
        "Maquette 3D, budget détaillé et planning : vous décidez en connaissance de cause.",
    ),
    (
        "BUSINESS",
        "tower",
        "Investissez avec la rigueur d'un ingénieur.",
        "Faisabilité, rentabilité et pilotage : chaque franc investi est suivi.",
    ),
    (
        "PREMIUM",
        "ocean",
        "L'exception, jusque dans le moindre détail.",
        "Architecture sur mesure et matériaux choisis en 3D avec leur impact immédiat.",
    ),
    (
        "DIASPORA",
        "globe",
        "Construisez au pays, suivez tout depuis l'étranger.",
        "Photos géolocalisées, visites en direct, paiements sécurisés : vous ne ratez rien.",
    ),
    (
        "ENGINEERING",
        "blueprint",
        "L'ingénierie qui sécurise chaque décision.",
        "Structure, fluides, BIM et contrôle d'exécution par nos ingénieurs.",
    ),
]
PAGE_SCENES = {
    "about": "site",
    "offers": "villa",
    "expertises": "blueprint",
    "services": "blueprint",
    "projects": "tower",
    "blog": "globe",
    "describe-project": "villa",
    "contact": "tower",
    "faq": "globe",
    "help": "site",
}


def seed_vitrine_visuals(db: Session, ids: dict[str, Any]) -> None:
    """Visuels de démonstration partout (illustrations générées, sans téléchargement) : diaporama du héros,
    univers, offres, services, expertises, réalisations (couverture, galerie, avant / après), articles, héros des
    pages intérieures et blocs de la page d'accueil (sur-titres, images de chiffres, preuves, FAQ, appel final)."""
    import itertools

    from app.core.errors import Conflict
    from app.core.utils import slugify
    from app.modules.cms import models as cms
    from app.modules.cms.media import upload_media
    from app.modules.cms.schemas import BlockIn
    from app.modules.cms.service import transition
    from app.seeds import illustrations as il

    if db.execute(select(cms.MediaAsset.id).where(cms.MediaAsset.folder == "demo-illustrations")).first():
        return
    author = ids["users"]["marketing"].id
    principal = principal_for(db, ids["users"]["marketing"])
    seeds = itertools.count(100)

    def picture(scene: str, title: str, seed: int | None = None, folder: str = "demo-illustrations") -> uuid.UUID:
        data = il.render(scene, seed=next(seeds) if seed is None else seed)
        try:
            return upload_media(
                db,
                filename=f"{slugify(title)[:60] or scene}.jpg",
                data=data,
                title=f"{title} (illustration démo)",
                alt_text=title,
                folder=folder,
                tags=["demo", scene],
                author_id=author,
            ).id
        except Conflict as exc:
            return uuid.UUID(str(exc.details["media_id"]))

    def scene_for(text: str | None, fallback: str) -> str:
        t = (text or "").lower()
        for words, scene in (
            (("structure", "calcul", "ingénierie", "bim", "étude", "fluide", "géotech", "topograph"), "blueprint"),
            (("rénovation", "construction", "gros", "chantier", "travaux", "second œuvre", "réalisation"), "site"),
            (("architect", "design", "intérieur", "villa", "maison", "plan"), "villa"),
            (("immobili", "investis", "promotion", "bureau", "immeuble", "rentab"), "tower"),
            (("diaspora", "distance", "suivi"), "globe"),
            (("premium", "luxe", "exception"), "ocean"),
        ):
            if any(w in t for w in words):
                return scene
        return fallback

    universes = db.execute(select(cms.Universe).order_by(cms.Universe.sort_order)).scalars().all()
    by_key = {u.key: u for u in universes}
    for index, universe in enumerate(universes):
        universe.hero_media_id = picture(il.UNIVERSE_SCENES.get(universe.key, "site"), universe.name, seed=10 + index)
    for offer in db.execute(select(cms.Offer)).scalars():
        universe = next((u for u in universes if u.id == offer.universe_id), None)
        base = il.UNIVERSE_SCENES.get(universe.key, "site") if universe else "site"
        offer.media_id = picture(scene_for(f"{offer.name} {offer.summary or ''}", base), offer.name)
    for service in db.execute(select(cms.Service)).scalars():
        service.media_id = picture(scene_for(f"{service.name} {service.category or ''}", "site"), service.name)
    for expertise in db.execute(select(cms.Expertise)).scalars():
        expertise.media_id = picture(
            scene_for(f"{expertise.name} {expertise.discipline or ''}", "blueprint"), expertise.name
        )
    for index, project in enumerate(
        db.execute(select(cms.PortfolioProject).order_by(cms.PortfolioProject.sort_order)).scalars()
    ):
        scene = il.UNIVERSE_SCENES.get(project.universe or "", "site")
        project.cover_media_id = picture(scene, project.title, seed=20 + index)
        project.gallery_media_ids = [
            str(picture("site", f"{project.title} — chantier")),
            str(picture("blueprint", f"{project.title} — études")),
            str(picture(scene, f"{project.title} — livraison")),
        ]
        project.before_after = [
            {
                "before_media_id": str(picture("site", f"{project.title} — avant")),
                "after_media_id": str(project.cover_media_id),
                "caption": "Du gros œuvre à la livraison (démo)",
            }
        ]
    blog_scenes = {
        "projection": "villa",
        "expertise": "blueprint",
        "preuve": "site",
        "reassurance": "globe",
        "transparence": "tower",
    }
    categories = {c.id: c.slug for c in db.execute(select(cms.BlogCategory)).scalars()}
    for post in db.execute(select(cms.BlogPost)).scalars():
        post.cover_media_id = picture(blog_scenes.get(categories.get(post.category_id, ""), "site"), post.title)

    if (
        db.execute(select(cms.Testimonial.id).where(cms.Testimonial.author_name == DEMO_TESTIMONIALS[0][0])).first()
        is None
    ):
        for name, role, location, universe_key, quote in DEMO_TESTIMONIALS:
            testimonial = cms.Testimonial(
                author_name=name,
                author_role=role,
                location=location,
                universe=universe_key,
                rating=5,
                featured=True,
                consent_reference="Démo",
                quote=quote,
                created_by_id=author,
            )
            db.add(testimonial)
            db.flush()
            transition(db, principal, "testimonials", testimonial, "published", note="Démo")

    def set_block(block: Any, data: dict[str, Any]) -> None:
        merged = {**block.data, **data}
        BlockIn.model_validate({"data": merged})  # garde-fou : le schéma CMS reste respecté
        block.data = merged

    for page in db.execute(select(cms.CmsPage)).scalars():
        sections = {s.key: s for s in page.sections}
        first = page.sections[0] if page.sections else None
        if page.route_key == "home":
            hero = sections.get("hero")
            if hero and hero.blocks:
                slides = []
                for key, scene, title, subtitle in HOME_SLIDES:
                    universe = by_key.get(key)
                    slide: dict[str, Any] = {
                        "title": title,
                        "subtitle": subtitle,
                        "media_id": str(picture(scene, title)),
                    }
                    if universe is not None:
                        slide["cta"] = {
                            "label": f"Univers {universe.name}",
                            "href": f"/offres/{universe.slug}",
                            "style": "secondary",
                        }
                    slides.append(slide)
                set_block(
                    hero.blocks[0],
                    {"layout": "image", "eyebrow": "Concevoir. Calculer. Construire. Contrôler.", "slides": slides},
                )
            extras: dict[str, dict[str, Any]] = {
                "univers": {"eyebrow": "Nos univers"},
                "methode": {"eyebrow": "La méthode GLOBUS"},
                "confiance": {
                    "eyebrow": "Pourquoi nous faire confiance",
                    "media_id": str(picture("site", "Chantier GLOBUS maîtrisé")),
                },
                "chiffres": {"eyebrow": "Preuves chiffrées", "media_id": str(picture("tower", "GLOBUS en chiffres"))},
                "realisations": {"eyebrow": "Réalisations", "subtitle": "Des projets livrés, documentés et prouvés."},
                "temoignages": {"eyebrow": "Témoignages", "layout": "carousel"},
                "parcours": {"eyebrow": "Votre parcours"},
                "faq": {"eyebrow": "FAQ", "media_id": str(picture("globe", "Questions fréquentes"))},
                "cta-final": {
                    "eyebrow": "Passez à l'action",
                    "media_id": str(picture("villa", "Votre projet maîtrisé")),
                },
            }
            for key, data in extras.items():
                section = sections.get(key)
                if section and section.blocks:
                    set_block(section.blocks[0], data)
            methode = sections.get("methode")
            if methode and methode.blocks:
                block = methode.blocks[0]
                scenes = ["villa", "blueprint", "site", "tower"]
                items = [
                    {**item, "media_id": str(picture(scenes[i % 4], item.get("title") or "Étape"))}
                    for i, item in enumerate(block.data.get("items", []))
                ]
                set_block(block, {"items": items})
            if "parcours" in sections:
                sections["parcours"].settings = {**(sections["parcours"].settings or {}), "background": "night"}
        elif first is not None and first.blocks and first.blocks[0].kind == "hero":
            hero_block = first.blocks[0]
            if not hero_block.data.get("media_id") and not hero_block.data.get("slides"):
                scene = PAGE_SCENES.get(page.route_key, "site")
                set_block(hero_block, {"layout": "image", "media_id": str(picture(scene, page.title))})
    db.flush()


def upgrade_vitrine_visuals(db: Session) -> bool:
    """Base de démo déjà chargée : ajoute les visuels de démonstration (idempotent). Retourne True si appliqué."""
    import app.models_registry  # noqa: F401  (toutes les tables : clés étrangères résolues)
    from app.modules.identity.models import User

    if settings.is_production or not settings.DEMO_SEED_ALLOWED:
        raise RuntimeError("Le jeu de démonstration est interdit en production (DEMO_SEED_ALLOWED=false).")
    marketing = db.execute(select(User).where(User.email == f"marketing@{DEMO_DOMAIN}")).scalar_one_or_none()
    if marketing is None:
        return False
    from app.modules.cms.models import SiteSettings
    from app.seeds.content import _brand_logo, _principal

    site = db.execute(select(SiteSettings)).scalars().first()
    if site is not None and site.logo_media_id is None:
        site.logo_media_id = _brand_logo(db, _principal(db))
    seed_vitrine_visuals(db, {"users": {"marketing": marketing}})
    db.commit()
    staff = {
        key: db.execute(select(User).where(User.email == f"{key}@{DEMO_DOMAIN}")).scalar_one_or_none()
        for key in ("ingenieur", "chef.projet")
    }
    if all(staff.values()):
        seed_office_documents(db, {"users": staff})
        db.commit()
    return True


def seed_innovations(db: Session, projects: dict[str, Any]) -> None:
    """Innovations (lot 3) : établissements de crédit, équipements et carnet d'entretien, séquestre à contractualiser.
    Idempotent ; tout est marqué « démo »."""
    from app.modules.escrow.models import EscrowAccount
    from app.modules.financing.models import FinancingPartner
    from app.modules.maintenance.models import BuildingEquipment
    from app.modules.maintenance.service import schedule_for

    partners = [
        ("Banque partenaire (démo)", "bank", "9", "12", 15, "20", "33", "1", "credit"),
        ("Microfinance habitat (démo)", "microfinance", "13", "17", 7, "10", "40", "2", "habitat"),
        ("Offre diaspora (démo)", "diaspora", "8", "11", 20, "30", "35", "1.5", "diaspora"),
    ]
    for order, (name, kind, rmin, rmax, years, down, ratio, fees, box) in enumerate(partners):
        if db.execute(select(FinancingPartner.id).where(FinancingPartner.name == name)).first():
            continue
        db.add(
            FinancingPartner(
                name=name,
                kind=kind,
                description="Établissement fictif du jeu de démonstration.",
                rate_min=Decimal(rmin),
                rate_max=Decimal(rmax),
                max_years=years,
                min_down_payment_pct=Decimal(down),
                max_debt_ratio_pct=Decimal(ratio),
                fees_pct=Decimal(fees),
                requirements=["Pièce d'identité", "3 derniers bulletins de salaire", "Relevés bancaires (3 mois)"],
                contact_name="Service crédit (démo)",
                contact_email=f"{box}@partenaires.{DEMO_DOMAIN}",
                sort_order=order,
            )
        )
    villa = projects["villa"]
    today = date.today()
    equipment = [
        ("climatisation", "Climatiseur split inverter 12 000 BTU — séjour (démo)", "Daikin", "FTXF35", "Séjour", 40),
        ("pompe", "Surpresseur 1 HP (démo)", "Pedrollo", "PKm 60", "Local technique", 60),
        ("solaire", "Kit solaire 3 kWc + onduleur hybride (démo)", "Victron", "MultiPlus-II", "Toiture", 25),
        ("fosse", "Fosse septique toutes eaux 3 000 L (démo)", None, None, "Jardin", 90),
    ]
    for category, name, brand, model, location, days in equipment:
        exists = db.execute(
            select(BuildingEquipment.id).where(BuildingEquipment.project_id == villa.id, BuildingEquipment.name == name)
        ).first()
        if exists:
            continue
        row = BuildingEquipment(
            project_id=villa.id,
            category=category,
            name=name,
            brand=brand,
            model=model,
            location=location,
            installed_on=today - timedelta(days=days),
            warranty_until=today - timedelta(days=days) + timedelta(days=730),
        )
        db.add(row)
        db.flush()
        schedule_for(db, row)
    if db.execute(select(EscrowAccount.id).where(EscrowAccount.project_id == villa.id)).first() is None:
        db.add(
            EscrowAccount(
                project_id=villa.id,
                partner_name="Banque partenaire (démo)",
                review_days=10,
                terms="Convention de séquestre à signer : libération jalon par jalon sur PV, photos certifiées et "
                "accord du client.",
            )
        )
    db.flush()


def upgrade_innovations_demo(db: Session) -> bool:
    """Base de démo déjà chargée : ajoute le jeu « innovations » (idempotent)."""
    import app.models_registry  # noqa: F401
    from app.modules.projects.models import Project

    if settings.is_production or not settings.DEMO_SEED_ALLOWED:
        raise RuntimeError("Le jeu de démonstration est interdit en production (DEMO_SEED_ALLOWED=false).")
    villa = db.execute(select(Project).where(Project.name == "Villa Nguema — Kotto (démo)")).scalar_one_or_none()
    if villa is None:
        return False
    seed_innovations(db, {"villa": villa})
    db.commit()
    return True


def seed_all(db: Session) -> dict[str, Any]:
    if settings.is_production or not settings.DEMO_SEED_ALLOWED:
        raise RuntimeError("Le jeu de démonstration est interdit en production (DEMO_SEED_ALLOWED=false).")
    ids = seed_identities(db)
    db.commit()
    projects = seed_projects(db, ids)
    db.commit()
    seed_procurement(db, ids, projects)
    db.commit()
    seed_subcontracting(db, ids, projects)
    db.commit()
    seed_operations(db, ids, projects)
    db.commit()
    seed_documents_and_bim(db, ids, projects)
    db.commit()
    seed_office_documents(db, ids, projects)
    db.commit()
    seed_crm_support_chat(db, ids, projects)
    db.commit()
    seed_vitrine_demo(db, ids)
    db.commit()
    seed_vitrine_visuals(db, ids)
    db.commit()
    seed_innovations(db, projects)
    db.commit()
    from app.modules.projects.service import compute_health, recompute_progress

    for project in projects.values():
        recompute_progress(db, project)
        compute_health(db, project)
    db.commit()
    return {"users": sorted(ids["users"]), "projects": [p.name for p in projects.values()]}


__all__ = [
    "DEMO_PASSWORD",
    "box_glb",
    "demo_image",
    "seed_all",
    "upgrade_innovations_demo",
    "upgrade_vitrine_visuals",
]
