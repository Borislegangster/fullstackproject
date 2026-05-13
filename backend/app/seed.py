"""Seed script — populates SQLite with all mock data from the frontend."""
import asyncio
from app.database import engine, AsyncSessionLocal, Base
from app.models.cms import (
    CMSSiteSettings, CMSHeroSlide, CMSEngagement, CMSAboutContent,
    CMSMethodologyStep, CMSStat, CMSGuarantee, CMSService, CMSProject,
    CMSBlogPost, CMSTeamMember, CMSPartner, CMSTestimonial,
    CMSFaqCategory, CMSFaqItem, CMSLegalPage,
)
from app.auth.models import User
from app.auth.service import hash_password
from app.models.media import CMSMedia

async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # ── Site Settings (singleton) ─────────────────────────
        db.add(CMSSiteSettings(
            id="settings-1",
            company_name="Globus Engineering SARL", logo="/LogoGlobus.png",
            phone="+33 1 23 45 67 89", email="contact@globus-btp.com",
            address="123 Avenue de la Construction, Quartier des Affaires, Douala, Cameroun",
            whatsapp_url="https://wa.me/33123456789?text=Bonjour%20Globus",
            social_links={"facebook":"https://facebook.com/globusengineering","twitter":"https://twitter.com/globuseng","linkedin":"https://linkedin.com/company/globus-engineering","instagram":"https://instagram.com/globusengineering"},
            footer_description="Globus Engineering SARL est votre partenaire de confiance pour tous vos projets de construction \"clé en main\". Solidité, esthétique et respect des délais.",
            nav_links=[{"label":"Accueil","href":"/"},{"label":"À Propos","href":"/a-propos"},{"label":"Services","href":"/services"},{"label":"Projets","href":"/projets"},{"label":"Blog","href":"/blog"},{"label":"Contact","href":"/contact"}],
            footer_quick_links=[{"label":"Accueil","href":"/"},{"label":"À Propos de nous","href":"/a-propos"},{"label":"Notre Portfolio","href":"/projets"},{"label":"Blog & Actualités","href":"/blog"},{"label":"Centre d'Aide & FAQ","href":"/aide"},{"label":"Contact","href":"/contact"}],
            footer_service_links=[{"label":"Construction Résidentielle","href":"/services/construction-batiments"},{"label":"Bâtiments Commerciaux","href":"/services/construction-batiments"},{"label":"Conception Architecturale","href":"/services/conception-architecturale"},{"label":"Génie Civil","href":"/services/genie-civil"},{"label":"Rénovation & Réhabilitation","href":"/services/renovation-amenagement"}],
            top_bar_text="Lun - Sam: 08:00 - 18:00",
            hero_video_src="https://videos.pexels.com/video-files/2835509/2835509-hd_1920_1080_30fps.mp4",
            hero_video_poster="https://images.unsplash.com/photo-1541888086425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
            cta_title="Vous avez un terrain mais vous ne savez pas par où commencer ?",
            cta_subtitle="Nos experts sont là pour vous guider à chaque étape. Parlons de votre projet dès aujourd'hui.",
            cta_text="Prendre un rendez-vous gratuit", cta_href="#contact",
            video_section_title="Notre Promesse",
            video_section_subtitle="Transparence totale et qualité irréprochable. Entrez dans les coulisses de nos chantiers et découvrez notre savoir-faire en action.",
            video_section_youtube_url="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0",
            video_section_bg_video_src="https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4",
            video_section_bg_video_poster="https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
            contact_address="123 Avenue de la Construction, Quartier des Affaires, Ville",
            contact_phone="+33 1 23 45 67 89", contact_email="contact@globus-btp.com",
            contact_whatsapp="+33 6 12 34 56 78",
            contact_map_embed_url="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1m3!1d2624.9916256937595!2d2.292292615509614!3d48.85837007928746!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47e66e2964e34e2d%3A0x8ddca9ee380ef7e0!2sTour%20Eiffel!5e0!3m2!1sfr!2sfr!4v1647874587301!5m2!1sfr!2sfr",
            contact_hours="Lundi - Vendredi : 08:00 - 18:00 | Samedi : 09:00 - 13:00",
            seo_pages=[
                {"page":"Accueil","path":"/","title":"Globus BTP — Construction Clé en Main","description":"Globus Engineering SARL, votre partenaire pour la construction clé en main au Cameroun.","og_image":"","keywords":"BTP, construction, clé en main, Cameroun"},
                {"page":"À Propos","path":"/a-propos","title":"Qui Sommes-Nous — Globus BTP","description":"Découvrez l'histoire et les valeurs de Globus Engineering.","og_image":"","keywords":"à propos, histoire, Globus Engineering"},
                {"page":"Services","path":"/services","title":"Nos Services — Globus BTP","description":"Construction résidentielle, commerciale, génie civil et rénovation.","og_image":"","keywords":"services, construction, rénovation, génie civil"},
                {"page":"Projets","path":"/projets","title":"Réalisations — Globus BTP","description":"Découvrez nos projets livrés et en cours.","og_image":"","keywords":"projets, réalisations, portfolio"},
                {"page":"Blog","path":"/blog","title":"Blog & Actualités — Globus BTP","description":"Actualités, conseils et tendances du BTP.","og_image":"","keywords":"blog, actualités, BTP"},
                {"page":"Contact","path":"/contact","title":"Contactez-Nous — Globus BTP","description":"Demandez un devis gratuit ou contactez notre équipe.","og_image":"","keywords":"contact, devis, Globus"},
                {"page":"FAQ","path":"/faq","title":"Questions Fréquentes — Globus BTP","description":"Trouvez des réponses à vos questions sur nos services.","og_image":"","keywords":"FAQ, questions, aide"},
            ],
            schema_org={"name":"Globus Engineering SARL","description":"Votre partenaire de confiance pour la construction BTP clé en main au Cameroun.","phone":"+33 1 23 45 67 89","email":"contact@globus-btp.com","street":"123 Avenue de la Construction","city":"Douala","country":"CM","lat":"4.0511","lng":"9.7679","openingHours":"Mo-Fr 08:00-18:00, Sa 09:00-13:00"},
            tracking={"ga_enabled":True,"ga_id":"G-DEMO123456","gtm_enabled":True,"gtm_id":"GTM-DEMO123","fb_enabled":True,"fb_id":"123456789","tiktok_enabled":False,"tiktok_id":""},
            sitemap_config={"base_url":"https://www.globus-btp.com"},
        ))

        # ── Hero Slides ───────────────────────────────────────
        slides = [
            ("BTP & Construction Clé en main","Bâtissez votre avenir en toute sérénité.","Ensemble vers la perfection !!! De la conception architecturale à la remise des clés, nous gérons l'intégralité de votre projet avec rigueur et passion.","https://images.unsplash.com/photo-1541888086425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80","Estimer mon budget","#estimateur","Découvrir nos réalisations","#projets"),
            ("Expertise & Savoir-faire","Des constructions solides, durables et esthétiques.","Plus de 50 projets livrés avec succès. Nos ingénieurs qualifiés transforment vos visions en réalités concrètes.","https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80","Voir nos projets","#projets","Nos services","#services"),
            ("Architecture & Design","De l'esquisse à la réalité, votre vision prend forme.","Conception architecturale sur-mesure, modélisation 3D et plans détaillés pour un résultat à la hauteur de vos ambitions.","https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80","Demander un devis","#contact","Notre méthodologie","#methodologie"),
            ("Qualité & Garanties","Garantie décennale et matériaux certifiés.","Votre tranquillité d'esprit est notre priorité. Chaque ouvrage est couvert et réalisé avec des matériaux normés et testés.","https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80","Nos garanties","#garanties","Contactez-nous","#contact"),
        ]
        for i,(tag,title,sub,img,c1t,c1h,c2t,c2h) in enumerate(slides):
            db.add(CMSHeroSlide(id=f"slide-{i}",tag=tag,title=title,subtitle=sub,image=img,cta1_text=c1t,cta1_href=c1h,cta2_text=c2t,cta2_href=c2h,sort_order=i))

        # ── Engagements ───────────────────────────────────────
        engagements = [
            ("HardHatIcon","Expertise Technique","Ingénieurs hautement qualifiés.","bg-globus-blue","text-white"),
            ("KeyIcon","100% Clé en main","Un seul interlocuteur. Zéro stress.","bg-globus-orange","text-white"),
            ("ShieldCheckIcon","Qualité et Délais","Respect strict des budgets.","bg-globus-blue-dark","text-white"),
        ]
        for i,(ic,t,d,bg,tc) in enumerate(engagements):
            db.add(CMSEngagement(id=f"eng-{i}",icon_key=ic,title=t,desc=d,bg_color=bg,text_color=tc,sort_order=i))

        # ── Methodology Steps ─────────────────────────────────
        msteps = [
            ("PencilRulerIcon","Étude & Conception","Analyse du terrain, plans architecturaux, modélisation 3D, devis détaillé.","https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"),
            ("FileTextIcon","Démarches Administratives","Nous gérons l'obtention du permis de construire et les autorisations pour vous.","https://images.unsplash.com/photo-1450101499163-c8848c66ca85?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"),
            ("BrickWallIcon","Gros Œuvre","Fondations, élévation des murs, charpente et toiture. Solidité garantie.","https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"),
            ("PaintRollerIcon","Second Œuvre & Finitions","Électricité, plomberie, menuiserie, peinture selon vos goûts et standards.","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"),
            ("KeyIcon","Remise des Clés","Inspection finale rigoureuse et livraison de votre bâtiment prêt à vivre.","https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"),
        ]
        for i,(ic,t,d,img) in enumerate(msteps):
            db.add(CMSMethodologyStep(id=f"mstep-{i}",icon_key=ic,title=t,desc=d,image=img,sort_order=i))

        # ── Stats ─────────────────────────────────────────────
        for i,(v,s,l) in enumerate([(50,"+","Projets Livrés"),(100,"%","Clients Satisfaits"),(30,"+","Experts"),(15,"","Années d'expérience")]):
            db.add(CMSStat(id=f"stat-{i}",value=v,suffix=s,label=l,sort_order=i))

        # ── Guarantees ────────────────────────────────────────
        guarantees = [
            ("ShieldCheckIcon","Garantie Décennale","Votre ouvrage est couvert contre les vices cachés pendant 10 ans. Une tranquillité d'esprit totale."),
            ("AwardIcon","Matériaux Normés","Utilisation exclusive de matériaux certifiés et testés en laboratoire pour une durabilité maximale."),
            ("WrenchIcon","Service Après-Vente","Une équipe réactive et disponible même après la remise des clés pour tout ajustement nécessaire."),
            ("HardHatIcon","Sécurité sur Chantier","Respect strict des normes HSE pour protéger nos ouvriers, vos visiteurs et l'environnement."),
        ]
        for i,(ic,t,d) in enumerate(guarantees):
            db.add(CMSGuarantee(id=f"guar-{i}",icon_key=ic,title=t,desc=d,sort_order=i))

        # ── Team Members ──────────────────────────────────────
        team = [
            ("Jean Dupont","Directeur Général","L'excellence n'est pas un acte, mais une habitude.","from-globus-blue to-globus-blue-dark","https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"),
            ("Sarah Koné","Architecte en Chef","Chaque espace raconte une histoire unique.","from-globus-orange to-red-600","https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"),
            ("Marc Lemaire","Ingénieur Structure","La solidité est la fondation de la confiance.","from-globus-gray to-gray-900","https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"),
            ("Amina Diallo","Chef de Chantier","Rigueur et sécurité au quotidien.","from-seconda-blue to-globus-blue","https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"),
        ]
        for i,(n,r,q,ic,ph) in enumerate(team):
            db.add(CMSTeamMember(id=f"team-{i}",name=n,role=r,quote=q,image_class=ic,photo=ph,sort_order=i))

        # ── Partners ──────────────────────────────────────────
        for i,name in enumerate(["CIMENCAM","AFRICA STEEL","LAFARGE","SOGEA","BTP MATÉRIAUX","ECO-BUILD","TECHNO-STRUCT","GLOBAL PAINT","CIMENCAM","AFRICA STEEL"]):
            db.add(CMSPartner(id=f"part-{i}",name=name,sort_order=i))

        # ── Testimonials ──────────────────────────────────────
        testimonials = [
            ("M. Dubois","Villa Résidentielle","Globus BTP a réalisé la maison de nos rêves. Le respect des délais et le professionnalisme de l'équipe ont été remarquables du début à la fin.",5,"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80"),
            ("Mme. Martin","Rénovation Bureaux","Une gestion de projet impeccable. Le concept 'clé en main' prend tout son sens avec eux. Je recommande vivement pour tout projet professionnel.",5,"https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80"),
            ("Société Horizon","Entrepôt Logistique","Expertise technique indéniable. Les fondations et la structure métallique ont été posées avec une précision chirurgicale.",4,"https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80"),
        ]
        for i,(n,p,t,r,ph) in enumerate(testimonials):
            db.add(CMSTestimonial(id=f"test-{i}",name=n,project=p,text=t,rating=r,photo=ph,sort_order=i))

        # ── About Content ─────────────────────────────────────
        db.add(CMSAboutContent(
            id="about-1",
            section_tag="L'Expérience Globus",
            title="L'alliance parfaite entre innovation, solidité et esthétique.",
            paragraphs=["Globus Engineering SARL est une entreprise de BTP spécialisée dans la réalisation de travaux de construction de bâtiments \"clé en main\". Notre mission est de transformer vos visions architecturales en réalités tangibles, durables et sécurisées.","Nous nous distinguons par notre approche intégrée : un seul interlocuteur de l'esquisse initiale jusqu'à la remise des clés. Cette méthode garantit une maîtrise totale des coûts, des délais et de la qualité d'exécution."],
            highlights=["Conception architecturale sur-mesure","Ingénierie structurelle de pointe","Matériaux certifiés et durables","Suivi de chantier transparent"],
            cta_text="En savoir plus sur nous", cta_href="#services",
            images=["https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1541888086425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"],
            video_src="https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4",
            video_poster="https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
            badge_value="15+", badge_label="Années d'excellence",
            hero_image="https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
            hero_title="Qui sommes-nous ?",
            mission="Fondée avec la conviction que chaque bâtiment doit être une œuvre durable, Globus Engineering SARL est née de la passion d'ingénieurs et d'architectes visionnaires. Depuis plus de 15 ans, nous transformons les paysages urbains en réalisant des projets ambitieux, du résidentiel de standing aux infrastructures industrielles complexes.",
            vision="Notre mission est simple : offrir un service \"clé en main\" irréprochable. Nous déchargeons nos clients de toute la complexité technique et administrative pour qu'ils puissent se concentrer sur l'essentiel : voir leur vision prendre vie.",
            values=[{"title":"Sécurité & Qualité","desc":"La sécurité de nos équipes et la qualité de nos ouvrages sont non-négociables.","iconKey":"ShieldCheckIcon"},{"title":"Innovation","desc":"Nous intégrons les dernières technologies pour des constructions plus intelligentes.","iconKey":"UsersIcon"},{"title":"Transparence","desc":"Une communication claire et honnête à chaque étape de votre projet.","iconKey":"TargetIcon"}],
            timeline=[], certifications=["Certification ISO 9001 (Qualité)","Certification ISO 45001 (Santé & Sécurité)","Agrément d'État Catégorie A","Garantie Décennale Assurée","Normes Environnementales HQE","Membres de la Fédération du BTP"],
        ))

        # -- Admin User --
        db.add(User(
            id="admin-1", email="admin@globus-btp.com",
            password_hash=hash_password("Globus2024!"),
            full_name="Jean-Paul Kamga", role="ADMIN",
        ))
        db.add(User(
            id="client-1", email="jean.talla@email.com",
            password_hash=hash_password("Globus2024!"),
            full_name="Jean Talla", role="CLIENT",
        ))

        # -- Media Library seed --
        IMG = "https://images.unsplash.com/photo-"
        media_items = [
            ("media-1","Hero Slide 1 - Construction","image",f"{IMG}1541888086425-d81bb19240f5?w=400&q=80","2.4 MB"),
            ("media-2","Hero Slide 2 - Expertise","image",f"{IMG}1504307651254-35680f356dfd?w=400&q=80","1.8 MB"),
            ("media-3","Hero Slide 3 - Architecture","image",f"{IMG}1503387762-592deb58ef4e?w=400&q=80","3.1 MB"),
            ("media-4","Hero Slide 4 - Qualite","image",f"{IMG}1486406146926-c627a92ad1ab?w=400&q=80","2.2 MB"),
            ("media-5","Video Intro Accueil","video","https://videos.pexels.com/video-files/2835509/2835509-hd_1920_1080_30fps.mp4","15.6 MB"),
            ("media-6","Projet Villa Les Alizes","image",f"{IMG}1600596542815-ffad4c1539a9?w=400&q=80","1.5 MB"),
            ("media-7","Logo Globus Engineering","image","/globusLogo.jpg","0.5 MB"),
            ("media-8","Methodologie - Demarches","image",f"{IMG}1450101499163-c8848c66ca85?w=400&q=80","1.2 MB"),
            ("media-9","Methodologie - Second Oeuvre","image",f"{IMG}1600585154340-be6161a56a0c?w=400&q=80","2.1 MB"),
            ("media-yt-1","Notre Promesse - YouTube","youtube","https://www.youtube.com/embed/dQw4w9WgXcQ","YouTube"),
        ]
        for mid,name,mtype,url,size in media_items:
            thumb = url if mtype == "image" else (f"https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg" if mtype == "youtube" else f"{IMG}1541888086425-d81bb19240f5?w=400&q=80")
            yt_id = "dQw4w9WgXcQ" if mtype == "youtube" else ""
            db.add(CMSMedia(id=mid,name=name,type=mtype,url=url,thumbnail=thumb,size=size,youtube_id=yt_id,uploaded_by="admin-1"))

        await db.commit()
        print("[OK] Phase 1 seeded: Settings, Hero, Engagements, Methodology, Stats, Guarantees, Team, Partners, Testimonials, About, Users, Media")

    # Phase 2 — Services, Projects, Blog, FAQ, Legal
    from app.seed_part2 import seed_part2
    await seed_part2()

if __name__ == "__main__":
    asyncio.run(seed())
