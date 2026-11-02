"""
Globus Engineering BTP - Complete Seed Data
Run: python seed.py
"""
import asyncio, sys, os
from datetime import datetime, timedelta
from uuid import uuid4

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./globus_dev.db")

from app.database import engine, Base, AsyncSessionLocal
from app.auth.models import User
from passlib.context import CryptContext

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
_uuid = lambda: str(uuid4())
_now = datetime.utcnow
_ago = lambda d: _now() - timedelta(days=d)
_future = lambda d: _now() + timedelta(days=d)


async def seed():
    # Import ALL models so Base.metadata knows every table
    import app.models  # noqa: F401

    # Remove old DB if exists
    db_path = "globus_dev.db"
    if os.path.exists(db_path):
        os.remove(db_path)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # ══════════════ USERS ══════════════
        users = {}
        user_defs = [
            ("admin@globus-engineering.cm", "Admin2024!", "ADMIN", "Boris", "Tsamejio"),
            ("chef@globus-engineering.cm", "Chef2024!", "CHEF_PROJET", "Jean", "Nkoulou"),
            ("compta@globus-engineering.cm", "Compta2024!", "COMPTABLE", "Marie", "Atangana"),
            ("rh@globus-engineering.cm", "RH2024!", "RH", "Paul", "Fotso"),
            ("client1@gmail.com", "Client2024!", "CLIENT", "Alain", "Mbarga"),
            ("client2@gmail.com", "Client2024!", "CLIENT", "Sophie", "Tchuente"),
        ]
        for email, pw, role, fn, ln in user_defs:
            uid = _uuid()
            db.add(User(
                id=uid, email=email, password_hash=pwd.hash(pw),
                first_name=fn, last_name=ln, role=role,
                is_active=True, must_change_password=False, created_at=_ago(90),
            ))
            users[role if role != "CLIENT" else f"CLIENT_{fn}"] = uid

        # ══════════════ ERP MODELS ══════════════
        from app.models.erp import (
            Project, ProjectPhase, Lead, Invoice, Payment,
            Employee, TempWorker, Payroll,
            StockItem, StockMovement, Equipment,
            SubContractor, SubContract,
            QHSEIncident, QHSEAudit, SAVTicket, SAVTicketReply,
            Notification, ActivityLog,
            Document, GEDFolder, Conversation, ConversationParticipant, Message,
            PlanningTask, Quote,
        )

        # ── PROJECTS ──
        projects = []
        for code, name, status, loc, budget in [
            ("PRJ-2026-0001", "Villa Prestige Bastos", "EN_COURS", "Bastos, Yaoundé", 450_000_000),
            ("PRJ-2026-0002", "Immeuble Commercial Akwa", "EN_COURS", "Akwa, Douala", 1_200_000_000),
            ("PRJ-2026-0003", "Résidence Diaspora Kribi", "EN_COURS", "Kribi", 280_000_000),
            ("PRJ-2026-0004", "Bureau Premium Bonapriso", "TERMINE", "Bonapriso, Douala", 650_000_000),
            ("PRJ-2026-0005", "Pont Wouri - Études", "EN_COURS", "Douala", 85_000_000),
        ]:
            pid = _uuid()
            db.add(Project(
                id=pid, code=code, name=name, status=status,
                description=f"Projet {name}", location=loc,
                client_id=users["CLIENT_Alain"], chef_projet_id=users["CHEF_PROJET"],
                budget_initial=budget, budget_spent=budget * 0.35,
                progress=35 if status == "EN_COURS" else 100,
                start_date=_ago(60), end_date=_future(180), created_at=_ago(90),
            ))
            projects.append(pid)

            for j, (pname, pct) in enumerate([
                ("Études & Conception", 100), ("Fondations", 80),
                ("Gros Oeuvre", 40), ("Second Oeuvre", 10), ("Finitions", 0),
            ]):
                db.add(ProjectPhase(
                    id=_uuid(), project_id=pid, name=pname, sort_order=j,
                    progress=pct, start_date=_ago(60 - j*10), end_date=_future(j*30),
                    status="TERMINE" if pct == 100 else ("EN_COURS" if pct > 0 else "EN_ATTENTE"),
                ))

        # ── SITES & LOTS ──
        from app.models.extensions import Site, Lot, Milestone, Risk, ChangeOrder

        for i, pid in enumerate(projects[:3]):
            sid = _uuid()
            db.add(Site(
                id=sid, project_id=pid, name=f"Site principal #{i+1}",
                address=f"Zone {['Bastos','Akwa','Kribi'][i]}",
                latitude=3.866 + i*0.1, longitude=11.516 + i*0.2,
                area_m2=500 + i*200, status="ACTIF",
            ))
            for j in range(1, 4):
                lot_id = _uuid()
                b = 50_000_000 + j * 20_000_000
                db.add(Lot(
                    id=lot_id, project_id=pid, site_id=sid,
                    code=f"LOT-{i+1}-{j:02d}",
                    name=["Gros Oeuvre", "Électricité", "Plomberie"][j-1],
                    budget=b, actual_cost=int(b * 0.6), progress=60.0 - j*10, status="EN_COURS",
                ))
                db.add(Milestone(
                    id=_uuid(), project_id=pid, lot_id=lot_id,
                    name=["Fondations coulées", "Câblage terminé", "Tuyauterie posée"][j-1],
                    due_date=_future(30*j), status="EN_COURS" if j == 1 else "A_VENIR",
                    is_payment_milestone=(j == 1), payment_percentage=30.0 if j == 1 else 0,
                ))

            db.add(Risk(
                id=_uuid(), project_id=pid, code=f"RSK-2026-{i+1:04d}",
                title="Retard livraison béton", category="APPROVISIONNEMENT",
                probability="ELEVE", impact="MOYEN",
                mitigation_plan="Commander 2 semaines à l'avance", status="OUVERT",
            ))

        # ── LEADS & QUOTES ──
        leads = []
        for fn, ln, email, phone, msg in [
            ("Pierre", "Ndi", "pierre@email.cm", "+237699111222", "Construction villa 4 chambres"),
            ("Entreprise", "ABC", "contact@abc.cm", "+237699333444", "Rénovation bureaux 200m²"),
            ("Famille", "Onana", "onana@gmail.com", "+237699555666", "Construction à distance"),
        ]:
            lid = _uuid()
            db.add(Lead(
                id=lid, first_name=fn, last_name=ln, email=email, phone=phone,
                source="SITE_WEB", status="QUALIFIE", message=msg,
                assigned_to=users["CHEF_PROJET"], created_at=_ago(30),
            ))
            leads.append(lid)

        for i, lid in enumerate(leads):
            db.add(Quote(
                id=_uuid(), lead_id=lid, code=f"DEV-2026-{i+1:04d}",
                client_name="Prospect", project_label="Projet résidentiel",
                amount=45_000_000 + i * 10_000_000, status="ENVOYE",
                valid_until=_future(30), created_at=_ago(15),
            ))

        # ── INVOICES & PAYMENTS ──
        for i, pid in enumerate(projects[:2]):
            inv_id = _uuid()
            sub = 15_000_000 * (i + 1)
            tax = int(sub * 0.1925)
            db.add(Invoice(
                id=inv_id, project_id=pid, client_id=users["CLIENT_Alain"],
                code=f"FAC-2026-{i+1:04d}",
                subtotal=sub, tax_rate=19.25, tax_amount=tax, total=sub + tax,
                status="PAYEE" if i == 0 else "EN_ATTENTE",
                due_date=_future(30), issue_date=_ago(15),
            ))
            if i == 0:
                db.add(Payment(
                    id=_uuid(), invoice_id=inv_id,
                    amount=sub + tax, method="FLUTTERWAVE",
                    reference=f"FLW-{_uuid()[:8]}", paid_at=_ago(5),
                ))

        # ── EMPLOYEES ──
        emps = []
        for fn, ln, pos, dept, sal in [
            ("Marcel", "Essomba", "Chef de chantier", "PRODUCTION", 450_000),
            ("Yves", "Kamga", "Conducteur de travaux", "PRODUCTION", 380_000),
            ("Aline", "Biyong", "Ingénieur Structure", "BUREAU_ETUDES", 550_000),
            ("Roger", "Mfou", "Technicien Électricité", "PRODUCTION", 280_000),
            ("Carine", "Ngono", "Assistante Admin", "ADMINISTRATION", 250_000),
        ]:
            eid = _uuid()
            db.add(Employee(
                id=eid, employee_code=f"EMP-{len(emps)+1:03d}",
                first_name=fn, last_name=ln, position=pos, department=dept,
                base_salary=sal, hire_date=_ago(365), is_active=True,
                phone=f"+237 6{len(emps)+5}0 000 000",
                email=f"{fn.lower()}.{ln.lower()}@globus-engineering.cm",
            ))
            emps.append(eid)

            db.add(Payroll(
                id=_uuid(), worker_type="EMPLOYEE", worker_id=eid,
                period=_now().strftime("%Y-%m"), days_worked=22,
                base_amount=sal, bonuses=int(sal * 0.05),
                deductions=int(sal * 0.1), net_amount=int(sal * 0.95),
                status="PAYE", paid_at=_ago(2),
            ))

        for i in range(3):
            db.add(TempWorker(
                id=_uuid(), first_name=f"Ouvrier{i+1}", last_name="Temporaire",
                phone=f"+237 650 {i+1:03d} 000", speciality="Maçonnerie",
                daily_rate=8000 + i*1000, is_active=True,
            ))

        # ── SUPPLIERS ──
        from app.models.suppliers import Supplier, Delivery, SupplierContact

        suppliers = []
        for name, cat, city, email in [
            ("CIMENCAM", "Matériaux", "Douala", "cimencam@email.cm"),
            ("SOCATOLE", "Matériaux", "Douala", "socatole@email.cm"),
            ("ElectroPro Cameroun", "Électricité", "Yaoundé", "electropro@email.cm"),
            ("Plomberie Express", "Plomberie", "Yaoundé", "plomberieexpress@email.cm"),
            ("Quincaillerie Centrale", "Outillage", "Douala", "quincaillerie@email.cm"),
        ]:
            sid = _uuid()
            db.add(Supplier(
                id=sid, code=f"FRN-2026-{len(suppliers)+1:04d}",
                company_name=name, category=cat, city=city, country="Cameroun",
                email=email, phone=f"+237 233 {len(suppliers)+1:02d} 00 00",
                status="ACTIF", quality_score=4.0 + len(suppliers) * 0.15,
            ))
            suppliers.append(sid)

            db.add(SupplierContact(
                id=_uuid(), supplier_id=sid,
                first_name="Contact", last_name=name.split()[0],
                role="Commercial", phone=f"+237 699 {len(suppliers):03d} 000",
                email=email, is_primary=True,
            ))

        for i, sup_id in enumerate(suppliers[:3]):
            db.add(Delivery(
                id=_uuid(), supplier_id=sup_id, project_id=projects[0],
                code=f"LIV-2026-{i+1:04d}",
                expected_date=_future(7 + i*5),
                status=["PLANIFIEE", "EN_TRANSIT", "LIVREE"][i],
                notes=f"Livraison matériaux lot {i+1}",
            ))

        # ── STOCK ──
        for name, cat, unit, qty in [
            ("Ciment CPA 45", "Matériaux", "Sac 50kg", 250),
            ("Fer à béton HA 12", "Matériaux", "Barre 12m", 500),
            ("Parpaing 15", "Matériaux", "Unité", 3000),
            ("Câble 2.5mm²", "Électricité", "Rouleau", 45),
            ("Tube PVC 100mm", "Plomberie", "Barre 4m", 120),
            ("Sable gros", "Matériaux", "m³", 80),
            ("Gravier 5/15", "Matériaux", "m³", 60),
        ]:
            db.add(StockItem(
                id=_uuid(), name=name, category=cat, unit=unit,
                quantity=qty, alert_threshold=int(qty * 0.1), location="Dépôt Central",
            ))

        # ── EQUIPMENT ──
        for name, cat, status in [
            ("Grue mobile 30T", "GRUE", "DISPONIBLE"),
            ("Bétonnière 350L", "BETONNIERE", "EN_SERVICE"),
            ("Compacteur vibrant", "COMPACTEUR", "EN_SERVICE"),
            ("Groupe électrogène 50KVA", "GROUPE_ELECTROGENE", "DISPONIBLE"),
            ("Chargeuse sur pneus", "CHARGEUSE", "EN_MAINTENANCE"),
        ]:
            db.add(Equipment(
                id=_uuid(), code=f"EQP-{_uuid()[:6].upper()}",
                name=name, category=cat, status=status,
                purchase_date=_ago(365), next_maintenance=_future(60),
            ))

        # ── SUB-CONTRACTORS ──
        subs = []
        for name, spec, cn in [
            ("Bâtiment Plus SARL", "GROS_OEUVRE", "Pierre Mvondo"),
            ("Élec Solutions", "ELECTRICITE", "André Ndzana"),
            ("HydroPlomb Cameroun", "PLOMBERIE", "Gaston Ewane"),
        ]:
            sub_id = _uuid()
            db.add(SubContractor(
                id=sub_id, company_name=name, speciality=spec,
                contact_name=cn, phone=f"+237 699 {len(subs)+7:02d}0 000",
                email=f"contact@{name.lower().replace(' ', '').replace('é','e')}.cm",
                rating=3.8 + len(subs) * 0.3, is_active=True,
            ))
            subs.append(sub_id)

            db.add(SubContract(
                id=_uuid(), subcontractor_id=sub_id, project_id=projects[0],
                description=f"Contrat {spec.lower()} - Villa Prestige",
                amount=25_000_000 + len(subs) * 5_000_000,
                start_date=_ago(30), end_date=_future(120), status="EN_COURS",
            ))

        # ── QHSE ──
        db.add(QHSEIncident(
            id=_uuid(), project_id=projects[0],
            title="Chute de matériaux depuis échafaudage",
            severity="MOYEN", category="SECURITE",
            description="Chute de briques depuis le 2e niveau, aucun blessé",
            incident_date=_ago(5), reported_by=users["CHEF_PROJET"], status="EN_COURS",
        ))
        db.add(QHSEAudit(
            id=_uuid(), project_id=projects[0],
            title="Audit sécurité Q4", audit_type="SECURITE",
            audit_date=_future(15), status="PLANIFIE",
            auditor=users["ADMIN"],
        ))

        # ── SAV ──
        tid = _uuid()
        db.add(SAVTicket(
            id=tid, project_id=projects[3], code="SAV-2026-0001",
            client_id=users["CLIENT_Alain"],
            subject="Fissure mur salon",
            description="Fissure apparue sur le mur du salon, longueur 50cm",
            priority="HAUTE", status="OUVERT", category="STRUCTURE",
        ))
        db.add(SAVTicketReply(
            id=_uuid(), ticket_id=tid, author_id=users["CHEF_PROJET"],
            content="Nous envoyons un technicien pour inspection. RDV proposé jeudi.",
        ))

        # ── TENDERS ──
        from app.models.extensions import Tender, Bid, Dispute

        ten_id = _uuid()
        db.add(Tender(
            id=ten_id, project_id=projects[0],
            code="AO-2026-0001", title="Fourniture béton prêt à l'emploi",
            description="200m³ de béton C25/30 sur 3 mois",
            status="PUBLIE", deadline=_future(15), estimated_budget=35_000_000,
            created_by=users["CHEF_PROJET"],
        ))
        for i, sub_id in enumerate(subs):
            db.add(Bid(
                id=_uuid(), tender_id=ten_id, subcontractor_id=sub_id,
                amount=32_000_000 + i * 2_000_000,
                score_technique=75 + i * 5, duration_days=14 + i * 3,
                status="SOUMIS", submitted_at=_ago(2),
            ))

        db.add(Dispute(
            id=_uuid(), project_id=projects[1], code="LIT-2026-0001",
            title="Retard livraison acier", subcontractor_id=subs[0],
            status="OUVERT", disputed_amount=5_000_000,
            description="Retard 3 semaines, pénalités applicables",
        ))

        # ── CMS ──
        from app.models.cms import (
            CMSSiteSettings, CMSHeroSlide, CMSEngagement, CMSService,
            CMSProject, CMSBlogPost, CMSTestimonial, CMSTeamMember,
            CMSFaqCategory, CMSFaqItem, NewsletterSubscriber,
        )

        db.add(CMSSiteSettings(
            id=_uuid(), company_name="Globus Engineering",
            phone="+237 699 000 000", email="contact@globus-engineering.cm",
            address="Yaoundé, Cameroun", logo="/LogoGlobus.png",
        ))

        for i, (tag, title, sub, img) in enumerate([
            ("BTP", "Construisons Votre Rêve", "De la conception à la livraison", "/images/hero1.jpg"),
            ("EXPERTISE", "Excellence BTP au Cameroun", "15 ans d'expertise", "/images/hero2.jpg"),
            ("INNOVATION", "Qualité & Innovation", "Technologies BIM et matériaux premium", "/images/hero3.jpg"),
        ]):
            db.add(CMSHeroSlide(
                id=_uuid(), tag=tag, title=title, subtitle=sub, image=img,
                cta1_text="Décrire mon projet", cta1_href="/decrire-mon-projet",
                is_active=True, sort_order=i+1,
            ))

        for i, (icon, title, desc) in enumerate([
            ("clock", "Respect des délais", "98% de projets livrés dans les temps"),
            ("shield", "Qualité certifiée", "Contrôle qualité continu"),
            ("eye", "Transparence totale", "Suivi en temps réel"),
            ("heart", "SAV 2 ans", "Accompagnement post-livraison"),
        ]):
            db.add(CMSEngagement(
                id=_uuid(), icon_key=icon, title=title, desc=desc, sort_order=i+1,
            ))

        for i, (slug, title, sub, desc, icon) in enumerate([
            ("construction-residentielle", "Construction Résidentielle", "Villas et résidences", "Service complet", "home"),
            ("construction-commerciale", "Construction Commerciale", "Immeubles et bureaux", "Solutions entreprises", "building"),
            ("renovation", "Rénovation & Extension", "Modernisation", "Agrandissement", "hammer"),
            ("etudes-techniques", "Études Techniques", "Structurelles et géotechniques", "Expertise technique", "ruler"),
            ("bim-modelisation", "BIM & Modélisation 3D", "Maquettes numériques", "Coordination BIM", "box"),
            ("gestion-projet", "Gestion de Projet", "Pilotage et suivi", "Planning et contrôle", "clipboard"),
        ]):
            db.add(CMSService(
                id=_uuid(), slug=slug, title=title, subtitle=sub,
                desc=desc, icon_key=icon, is_published=True, sort_order=i+1,
            ))

        for slug, title, cat, loc, desc in [
            ("villa-prestige-bastos", "Villa Prestige Bastos", "RESIDENTIEL", "Yaoundé", "Villa de luxe 6 chambres"),
            ("immeuble-akwa", "Immeuble Commercial Akwa", "COMMERCIAL", "Douala", "Immeuble R+8"),
            ("residence-kribi", "Résidence Balnéaire Kribi", "RESIDENTIEL", "Kribi", "Résidence balnéaire"),
        ]:
            db.add(CMSProject(
                id=_uuid(), slug=slug, title=title, category=cat,
                location=loc, description=desc, client_name="Client Globus",
                status="EN_COURS", featured=True, is_published=True, sort_order=1,
            ))

        for slug, title, excerpt, body in [
            ("guide-construction-cameroun-2026", "Guide : Construire au Cameroun en 2026",
             "Tout savoir pour réussir votre projet.", "<p>La construction au Cameroun...</p>"),
            ("avantages-bim", "Les avantages du BIM",
             "Comment le BIM révolutionne le BTP.", "<p>Le BIM transforme...</p>"),
        ]:
            db.add(CMSBlogPost(
                id=_uuid(), slug=slug, title=title, excerpt=excerpt,
                html_content=body, author="Équipe Globus", status="published",
                category="Construction", date="2026-09-30", read_time="5 min",
                image="/uploads/blog-placeholder.jpg", featured=True,
                published_at=_ago(10), created_at=_ago(15),
            ))

        for name, proj, text, rating in [
            ("Alain Mbarga", "Villa Bastos", "Qualité exceptionnelle et respect des délais.", 5),
            ("Sophie Tchuente", "Immeuble Akwa", "Expertise remarquable. Le suivi client est un vrai plus.", 5),
            ("Pierre Onana", "Résidence Kribi", "Suivi exceptionnel depuis la France.", 4),
        ]:
            db.add(CMSTestimonial(
                id=_uuid(), name=name, project=proj,
                text=text, rating=rating, is_published=True, sort_order=1,
            ))

        for name, role in [
            ("Boris Tsamejio", "PDG & Fondateur"),
            ("Jean Nkoulou", "Directeur Technique"),
            ("Marie Atangana", "Directrice Financière"),
        ]:
            db.add(CMSTeamMember(id=_uuid(), name=name, role=role, sort_order=1))

        faq_cat = _uuid()
        db.add(CMSFaqCategory(id=faq_cat, name="Questions générales", sort_order=1))
        for q, a in [
            ("Combien coûte la construction ?", "150 000 à 500 000 FCFA/m² selon le standing."),
            ("Quels sont les délais ?", "8 à 14 mois en moyenne pour une villa."),
            ("Comment suivre mon chantier ?", "Via votre espace client sécurisé."),
        ]:
            db.add(CMSFaqItem(id=_uuid(), category_id=faq_cat, question=q, answer=a, sort_order=1))

        for em in ["test1@email.cm", "test2@email.cm", "abonne@gmail.com"]:
            db.add(NewsletterSubscriber(id=_uuid(), email=em, is_active=True))

        # ── CMS OFFERS & EXPERTISES ──
        from app.models.extensions import CMSOffer, CMSExpertise, ProjectBrief

        for slug, name, universe, desc in [
            ("home", "GLOBUS HOME", "HOME", "Votre maison de rêve"),
            ("business", "GLOBUS BUSINESS", "BUSINESS", "Solutions entreprises"),
            ("premium", "GLOBUS PREMIUM", "PREMIUM", "Le luxe accessible"),
            ("diaspora", "GLOBUS DIASPORA", "DIASPORA", "Construisez depuis l'étranger"),
            ("engineering", "Engineering Services", "ENGINEERING", "Expertise BTP"),
        ]:
            db.add(CMSOffer(
                id=_uuid(), slug=slug, name=name, universe=universe,
                description=desc, hero_title=name, hero_subtitle=desc,
                features=["Suivi en ligne", "Garantie 2 ans", "Matériaux premium"],
                is_published=True, sort_order=1,
            ))

        for name, cat, icon, pc, ye in [
            ("Études Structurelles", "STRUCTURE", "ruler", 45, 15),
            ("BIM & Modélisation", "BIM", "box", 30, 8),
            ("Topographie", "TOPOGRAPHIE", "map-pin", 60, 12),
            ("Contrôle Technique", "CONTROLE", "shield", 25, 10),
            ("Gestion de Projet", "MANAGEMENT", "clipboard", 80, 18),
        ]:
            db.add(CMSExpertise(
                id=_uuid(), slug=name.lower().replace(" ", "-").replace("&", "et"),
                name=name, category=cat, icon=icon,
                description=f"Expertise {name.lower()}",
                projects_count=pc, years_experience=ye,
                is_published=True, sort_order=1,
            ))

        db.add(ProjectBrief(
            id=_uuid(), code="DMP-2026-0001",
            status="SOUMIS", universe="HOME", current_step=4,
            step1_data={"project_type": "VILLA", "surface_m2": 250, "floors": 2, "location_city": "Yaoundé"},
            step2_data={"budget_range": "100-250M FCFA", "timeline": "12 mois"},
            step3_data={"special_features": ["Piscine", "Garage", "Jardin"]},
            step4_data={"accept_terms": True},
            contact_name="Prospect Test", contact_email="prospect@test.cm",
            contact_phone="+237 699 888 000", submitted_at=_ago(3),
        ))

        # ── BIM ──
        from app.models.bim_hub import BimModel, DisciplineLayer, Clash

        bim_id = _uuid()
        db.add(BimModel(
            id=bim_id, project_id=projects[0],
            name="Villa Prestige - Coordination",
            file_format="rvt", discipline="COORDINATION",
            aps_urn=f"urn:adsk.objects:os.object:globus/{_uuid()[:8]}.rvt",
            status="TRADUIT", uploaded_by=users["CHEF_PROJET"],
        ))
        for disc, color in [("ARCHITECTURE", "#385AA6"), ("STRUCTURE", "#DC2626"), ("MEP", "#16A34A")]:
            db.add(DisciplineLayer(
                id=_uuid(), project_id=projects[0],
                name=disc, color=color, is_visible=True, sort_order=1,
            ))

        db.add(Clash(
            id=_uuid(), project_id=projects[0], code="CLH-001",
            object_a_id="wall-001", object_a_discipline="STRUCTURE",
            object_b_id="pipe-042", object_b_discipline="MEP",
            clash_type="HARD", status="OUVERT", severity="CRITIQUE",
        ))

        # ── SECURITY ──
        from app.models.security_audit import SecurityEvent

        db.add(SecurityEvent(
            id=_uuid(), event_type="LOGIN_SUCCESS", severity="INFO",
            user_id=users["ADMIN"], ip_address="192.168.1.1",
        ))

        # ── NOTIFICATIONS ──
        for uid, title, msg in [
            (users["ADMIN"], "Nouveau lead qualifié", "Pierre Ndi - Villa 4 chambres"),
            (users["CHEF_PROJET"], "Livraison planifiée", "CIMENCAM - 50 sacs ciment"),
            (users["CLIENT_Alain"], "Avancement chantier", "Fondations terminées à 80%"),
        ]:
            db.add(Notification(
                id=_uuid(), user_id=uid, title=title, message=msg,
                type="INFO", is_read=False,
            ))

        # ── ACTIVITY LOG ──
        for action, desc, etype in [
            ("Projet créé", "Villa Prestige Bastos", "PROJECT"),
            ("Devis envoyé", "DEV-2026-0001 - 45M FCFA", "QUOTE"),
            ("Facture émise", "FAC-2026-0001 - 15M FCFA", "INVOICE"),
            ("Employé ajouté", "Marcel Essomba", "HR"),
        ]:
            db.add(ActivityLog(
                id=_uuid(), actor_id=users["ADMIN"],
                action=action, description=desc,
                entity_type=etype, entity_id=projects[0],
            ))

        # ── GED ──
        fid = _uuid()
        db.add(GEDFolder(id=fid, name="Plans Architecturaux", project_id=projects[0]))
        for dname in ["Plan RDC v3.pdf", "Plan Étage 1 v2.pdf", "Coupe AA.pdf"]:
            db.add(Document(
                id=_uuid(), project_id=projects[0], folder_id=fid,
                name=dname, file_url=f"/uploads/docs/{dname}",
                file_size=2_500_000, mime_type="application/pdf",
                uploaded_by=users["CHEF_PROJET"], shared_with_client=True,
            ))

        # ── PLANNING ──
        for name, pct, s, e in [
            ("Coulage fondations", 100, _ago(30), _ago(10)),
            ("Élévation murs RDC", 65, _ago(10), _future(15)),
            ("Pose charpente", 0, _future(20), _future(45)),
            ("Électricité phase 1", 30, _ago(5), _future(25)),
        ]:
            db.add(PlanningTask(
                id=_uuid(), project_id=projects[0], name=name,
                progress=pct, start_date=s, end_date=e,
                assignee_id=users["CHEF_PROJET"],
                status="TERMINE" if pct == 100 else ("EN_COURS" if pct > 0 else "A_FAIRE"),
            ))

        # ── CONVERSATIONS ──
        cid = _uuid()
        db.add(Conversation(id=cid, project_id=projects[0], subject="Discussion Villa Prestige"))
        db.add(ConversationParticipant(id=_uuid(), conversation_id=cid, user_id=users["CHEF_PROJET"]))
        db.add(ConversationParticipant(id=_uuid(), conversation_id=cid, user_id=users["CLIENT_Alain"]))
        for uid, text in [
            (users["CHEF_PROJET"], "Les fondations avancent bien. On est à 80%."),
            (users["CLIENT_Alain"], "On peut visiter le chantier cette semaine ?"),
            (users["CHEF_PROJET"], "Bien sûr, je propose jeudi à 10h."),
        ]:
            db.add(Message(id=_uuid(), conversation_id=cid, sender_id=uid, content=text))

        await db.commit()
        print("Seed terminé !")
        print(f"  Users: {len(user_defs)}")
        print(f"  Projects: 5 | Phases: 25 | Sites: 3 | Lots: 9")
        print(f"  Leads: 3 | Quotes: 3 | Invoices: 2")
        print(f"  Employees: 5 | TempWorkers: 3")
        print(f"  Suppliers: 5 | Deliveries: 3")
        print(f"  Equipment: 5 | Stock: 7")
        print(f"  Sub-contractors: 3 | Contracts: 3")
        print(f"  CMS: slides, services, projects, blog, FAQ, testimonials, offers, expertises")
        print(f"  BIM: 1 model, 3 layers, 1 clash")
        print()
        print("Identifiants de connexion:")
        for email, pw, role, fn, ln in user_defs:
            print(f"  {role:15s} | {email:35s} | {pw}")


if __name__ == "__main__":
    asyncio.run(seed())
