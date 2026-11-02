"""Seed part 3 — Blog, FAQ, Legal pages."""
from app.database import AsyncSessionLocal
from app.models.cms import CMSBlogPost, CMSFaqCategory, CMSFaqItem, CMSLegalPage

IMG = "https://images.unsplash.com/photo-"

async def seed_part3():
    async with AsyncSessionLocal() as db:
        # ── Blog Posts ────────────────────────────────────────
        posts = [
          dict(id="blog-1",slug="erreurs-achat-terrain",title="Les 5 erreurs à éviter avant d'acheter un terrain",category="Conseils",date="12 Oct 2023",read_time="5 min",author="Jean Dupont",excerpt="L'achat d'un terrain est la première étape cruciale. Découvrez les pièges à éviter.",image=f"{IMG}1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80",featured=True,html_content="<h2>1. Négliger l'étude de sol</h2><p>C'est l'erreur la plus coûteuse. Un terrain qui semble parfait en surface peut cacher un sous-sol problématique.</p><h2>2. Ignorer le PLU</h2><p>Chaque commune possède ses propres règles d'urbanisme.</p>",status="published"),
          dict(id="blog-2",slug="choisir-finitions-interieures",title="Comment choisir les finitions intérieures de sa villa ?",category="Design",date="28 Sep 2023",read_time="4 min",author="Sarah Koné",excerpt="Carrelage, peinture, menuiserie... Guide complet pour harmoniser votre intérieur.",image=f"{IMG}1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",status="published"),
          dict(id="blog-3",slug="visite-residence-horizon",title="Chantier en cours : Visite de la Résidence Horizon",category="Actualités",date="15 Sep 2023",read_time="3 min",author="Amina Diallo",excerpt="Plongée au cœur de notre dernier grand projet résidentiel.",image=f"{IMG}1541888086425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",status="published"),
          dict(id="blog-4",slug="normes-environnementales-2024",title="Les nouvelles normes environnementales de construction en 2024",category="Réglementation",date="02 Sep 2023",read_time="6 min",author="Marc Lemaire",excerpt="Tout ce qu'il faut savoir sur la réglementation thermique.",image=f"{IMG}1518780664697-55e3ad937233?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",status="published"),
          dict(id="blog-5",slug="importance-etude-sol",title="Pourquoi l'étude de sol est-elle indispensable ?",category="Chantier",date="20 Aou 2023",read_time="4 min",author="Marc Lemaire",excerpt="Comprendre les enjeux géotechniques avant de couler les fondations.",image=f"{IMG}1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",status="published"),
          dict(id="blog-6",slug="tendances-architecture-2024",title="Les 3 grandes tendances architecturales pour 2024",category="Design",date="10 Aou 2023",read_time="5 min",author="Sarah Koné",excerpt="Espaces modulables, retour à la nature et domotique intégrée.",image=f"{IMG}1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",status="published"),
        ]
        for p in posts:
            db.add(CMSBlogPost(**p))

        # ── FAQ Categories & Items ────────────────────────────
        faq_data = [
          ("Devis & Tarifs",[
            ("Combien coûte la construction d'une maison clé en main ?","Le coût varie en fonction de la surface, des matériaux choisis et des finitions."),
            ("Les devis sont-ils gratuits ?","Oui, la première étude et l'établissement du devis initial sont entièrement gratuits."),
            ("Quelles sont les modalités de paiement ?","Le paiement s'effectue par appels de fonds échelonnés selon l'avancement des travaux."),
            ("Le prix annoncé peut-il évoluer ?","Nos devis sont fermes et définitifs pour les prestations décrites."),
          ]),
          ("Délais de Construction",[
            ("Quels sont les délais moyens de construction ?","Pour une villa standard, comptez entre 6 et 8 mois à partir du permis de construire."),
            ("Que se passe-t-il en cas de retard ?","Nos contrats incluent des pénalités de retard."),
            ("Puis-je visiter le chantier pendant les travaux ?","Oui, nous organisons des visites régulières avec le chef de chantier."),
          ]),
          ("Garanties",[
            ("Proposez-vous une garantie sur vos constructions ?","Toutes nos constructions sont couvertes par la garantie décennale."),
            ("Qu'est-ce que la garantie de parfait achèvement ?","Elle couvre pendant un an tous les désordres signalés."),
            ("Qu'est-ce que la garantie biennale ?","Elle couvre pendant deux ans les équipements dissociables."),
          ]),
          ("Administratif",[
            ("Gérez-vous l'obtention du permis de construire ?","Oui, notre service clé en main inclut la constitution du dossier."),
            ("Faut-il souscrire une assurance dommages-ouvrage ?","Oui, c'est obligatoire pour le maître d'ouvrage."),
            ("Quels documents dois-je fournir ?","Titre de propriété, plan de situation, relevé topographique."),
          ]),
        ]
        for ci,(cat_name,items) in enumerate(faq_data):
            cat = CMSFaqCategory(id=f"faqcat-{ci}",name=cat_name,sort_order=ci)
            db.add(cat)
            await db.flush()
            for ii,(q,a) in enumerate(items):
                db.add(CMSFaqItem(id=f"faqitem-{ci}-{ii}",category_id=cat.id,question=q,answer=a,sort_order=ii))

        # ── Legal Pages ───────────────────────────────────────
        legal_pages = [
          dict(id="legal-1",slug="mentions-legales",title="Mentions Légales",last_updated="15 mars 2026",sections=[
            {"title":"1. Éditeur du site","content":"Le présent site est édité par Globus Engineering SARL, SARL au capital de 500 000 FCFA."},
            {"title":"2. Hébergement","content":"Le site est hébergé par OVH SAS, 2 rue Kellermann, 59100 Roubaix."},
            {"title":"3. Propriété intellectuelle","content":"L'ensemble de ce site relève de la législation sur le droit d'auteur. Tous les droits de reproduction sont réservés."},
            {"title":"4. Limitation de responsabilité","content":"Globus Engineering SARL s'efforce d'assurer l'exactitude des informations diffusées."},
          ]),
          dict(id="legal-2",slug="politique-de-confidentialite",title="Politique de Confidentialité",last_updated="15 mars 2026",sections=[
            {"title":"1. Données collectées","content":"Nous collectons : nom, email, téléphone via le formulaire de contact."},
            {"title":"2. Finalité du traitement","content":"Répondre à vos demandes de devis et gérer la relation client."},
            {"title":"3. Base légale et durée","content":"Données de contact : 3 ans. Données clients : durée contractuelle + 10 ans."},
            {"title":"4. Droits des utilisateurs","content":"Droit d'accès, de rectification, d'effacement et de portabilité."},
            {"title":"5. Sécurité","content":"Mesures techniques et organisationnelles pour protéger vos données."},
          ]),
          dict(id="legal-3",slug="termes-et-conditions",title="Termes et Conditions",last_updated="15 mars 2026",sections=[
            {"title":"1. Objet","content":"Définir les modalités de mise à disposition des services du site Globus BTP."},
            {"title":"2. Acceptation des CGU","content":"L'accès et l'utilisation du site sont soumis aux présentes Conditions Générales."},
            {"title":"3. Services proposés","content":"Construction résidentielle, commerciale, génie civil et rénovation. Devis gratuits."},
            {"title":"4. Responsabilités","content":"Globus Engineering s'engage à garantir un accès continu au site."},
            {"title":"5. Droit applicable","content":"Soumises au droit applicable au siège social de l'entreprise."},
          ]),
          dict(id="legal-4",slug="cookies",title="Politique des Cookies",last_updated="15 mars 2026",sections=[
            {"title":"1. Qu'est-ce qu'un cookie ?","content":"Un petit fichier texte déposé sur votre terminal lors de la visite d'un site web."},
            {"title":"2. Les cookies que nous utilisons","content":"Cookies fonctionnels (nécessaires) et cookies analytiques (Google Analytics)."},
            {"title":"3. Gestion et désactivation","content":"Vous pouvez configurer votre navigateur pour refuser les cookies."},
            {"title":"4. Durée de conservation","content":"Les cookies sont conservés pour une durée maximale de 13 mois."},
          ]),
        ]
        for lp in legal_pages:
            db.add(CMSLegalPage(**lp))

        await db.commit()
        print("[OK] Phase 3 seeded: Blog, FAQ, Legal")
        print("[DONE] Seed complete! All CMS data loaded.")
