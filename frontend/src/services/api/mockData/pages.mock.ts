import type {
  ServiceDetail,
  FaqCategory,
  ContactInfo,
  SiteSettings,
  LegalPageContent,
  AboutPageContent,
  ServiceDetailFull,
  ProjectDetailFull } from
'../../../types/cms.types';

// ── Services Page Data ───────────────────────────────────────
export const mockServicesPageData: ServiceDetail[] = [
{
  id: 'construction-batiments',
  title: 'Construction de Bâtiments',
  subtitle: 'Résidentiel / Commercial / Industriel',
  desc: 'Réalisation de constructions neuves de haute qualité, garantissant des structures solides et durables.',
  iconKey: 'Building2Icon',
  image:
  'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
},
{
  id: 'conception-architecturale',
  title: 'Conception Architecturale',
  subtitle: 'Plans 2D/3D & Design',
  desc: "Notre bureau d'études transforme vos idées en plans concrets avec des modélisations 3D réalistes.",
  iconKey: 'RulerIcon',
  image:
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
},
{
  id: 'genie-civil',
  title: 'Génie Civil & Travaux Publics',
  subtitle: 'Infrastructures complexes',
  desc: 'Expertise pointue pour les infrastructures lourdes, routes, ponts et aménagements urbains.',
  iconKey: 'HardHatIcon',
  image:
  'https://images.unsplash.com/photo-1581094794329-c8112a89af12?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
},
{
  id: 'renovation-amenagement',
  title: 'Rénovation et Aménagement',
  subtitle: 'Réhabilitation & Second Œuvre',
  desc: 'Rénovation lourde et réhabilitation de bâtiments anciens, alliant respect du patrimoine et modernité.',
  iconKey: 'PaintRollerIcon',
  image:
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
}];


// ── Projects Page Data ───────────────────────────────────────
export const mockProjectsPageData = [
{
  id: 'villa-alizes',
  title: 'Villa Contemporaine Les Alizés',
  category: 'Résidentiel',
  location: 'Douala, Bonapriso',
  description:
  'Villa moderne R+2 avec piscine, jardin paysager et finitions haut de gamme sur un terrain en pente.',
  image:
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  progress: 100
},
{
  id: 'complexe-horizon',
  title: 'Complexe Bureaux Horizon',
  category: 'Commercial',
  location: 'Yaoundé, Centre',
  description:
  'Immeuble de bureaux R+6 certifié HQE avec façade bioclimatique et espaces de coworking.',
  image:
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  progress: 100
},
{
  id: 'hopital-regional',
  title: 'Hôpital Régional de Bafoussam',
  category: 'Institutionnel',
  location: 'Bafoussam',
  description:
  "Centre hospitalier de 120 lits avec bloc opératoire, urgences et laboratoire d'analyses.",
  image:
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  progress: 65
},
{
  id: 'tour-zenith',
  title: 'Fondations Tour Zenith',
  category: 'Commercial',
  location: 'Douala, Akwa',
  description:
  'Tour de bureaux de 15 étages avec fondations profondes sur pieux et parking souterrain.',
  image:
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  progress: 45
},
{
  id: 'boutique-flagship',
  title: 'Centre Commercial de la Place',
  category: 'Commercial',
  location: 'Douala, Bonanjo',
  description:
  'Un centre commercial moderne avec 45 boutiques, un food court et un parking souterrain de 500 places.',
  image:
  'https://images.unsplash.com/photo-1582063289852-62e3ba2747f8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  progress: 50
},
{
  id: 'residence-jardins',
  title: 'Complexe Résidentiel Les Jardins',
  category: 'Résidentiel',
  location: 'Kribi',
  description:
  'Ensemble résidentiel de 200 appartements avec espaces verts, aire de jeux et piscine commune.',
  image:
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  progress: 70
},
{
  id: 'pont-wouri',
  title: 'Réhabilitation Pont du Wouri',
  category: 'Institutionnel',
  location: 'Douala',
  description:
  'Renforcement structurel et élargissement du tablier pour supporter le trafic urbain croissant.',
  image:
  'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  progress: 80
},
{
  id: 'villa-moderne',
  title: 'Villa Moderne R+1 Bastos',
  category: 'Résidentiel',
  location: 'Yaoundé, Bastos',
  description:
  'Villa contemporaine avec toiture végétalisée, domotique intégrée et panneaux solaires.',
  image:
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  progress: 30
},
{
  id: 'usine-logistique',
  title: 'Entrepôt Logistique Zone Franche',
  category: 'Industriel',
  location: 'Douala, Bonabéri',
  description:
  'Entrepôt de 5 000 m² avec quais de chargement, bureaux administratifs et système anti-incendie.',
  image:
  'https://images.unsplash.com/photo-1581094794329-c8112a89af12?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  progress: 100
}];


// ── Blog Page Data ───────────────────────────────────────────
export const mockBlogPostsPageData = [
{
  id: 'erreurs-achat-terrain',
  title: "Les 5 erreurs à éviter avant d'acheter un terrain",
  category: 'Conseils',
  date: '12 Oct 2023',
  readTime: '5 min',
  author: 'Jean Dupont',
  excerpt:
  "L'achat d'un terrain est la première étape cruciale de votre projet immobilier. Découvrez les pièges à éviter pour garantir la faisabilité de votre construction et sécuriser votre investissement.",
  image:
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
  featured: true,
  htmlContent: `<h2>1. Négliger l'étude de sol (Géotechnique)</h2>
<p>C'est sans doute l'erreur la plus coûteuse. Un terrain qui semble parfait en surface peut cacher un sous-sol argileux, rocheux ou inondable. Une étude de sol (G2) est indispensable avant tout achat pour déterminer le type de fondations nécessaires. Des fondations spéciales (pieux, micropieux) peuvent faire exploser votre budget initial.</p>
<h2>2. Ignorer le Plan Local d'Urbanisme (PLU)</h2>
<p>Chaque commune possède ses propres règles d'urbanisme. Avant de signer, consultez le PLU à la mairie. Il définit :</p>
<ul>
<li>L'emprise au sol maximale autorisée</li>
<li>La hauteur maximale de la construction</li>
<li>Les distances à respecter par rapport aux limites séparatives</li>
<li>L'aspect extérieur (couleurs, type de toiture)</li>
</ul>
<blockquote class="border-l-4 border-globus-orange bg-globus-light p-8 rounded-r-2xl italic my-10 shadow-sm">
<p class="text-xl text-globus-blue-dark font-montserrat font-semibold m-0">"Un terrain constructible ne signifie pas que vous pouvez y construire n'importe quoi. Le projet doit s'intégrer dans les contraintes réglementaires locales."</p>
</blockquote>
<h2>3. Sous-estimer les coûts de viabilisation</h2>
<p>Si vous achetez un terrain isolé (hors lotissement), il n'est probablement pas viabilisé. Le raccordement aux réseaux (eau, électricité, tout-à-l'égout, télécom) peut coûter entre 5 000 et 15 000 euros selon la distance des réseaux publics. Vérifiez toujours la présence d'un certificat d'urbanisme opérationnel.</p>
<h2>4. Ne pas vérifier l'orientation et la topographie</h2>
<p>Un terrain en forte pente nécessitera des travaux de terrassement importants et des murs de soutènement. De plus, l'orientation est primordiale pour la conception bioclimatique de votre maison. Un terrain orienté plein nord augmentera vos factures de chauffage et limitera la luminosité naturelle.</p>`
},
{
  id: 'choisir-finitions-interieures',
  title: 'Comment choisir les finitions intérieures de sa villa ?',
  category: 'Design',
  date: '28 Sep 2023',
  readTime: '4 min',
  author: 'Sarah Koné',
  excerpt:
  'Carrelage, peinture, menuiserie... Guide complet pour harmoniser votre intérieur selon les dernières tendances.',
  image:
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  featured: false
},
{
  id: 'visite-residence-horizon',
  title: 'Chantier en cours : Visite de la Résidence Horizon',
  category: 'Actualités',
  date: '15 Sep 2023',
  readTime: '3 min',
  author: 'Amina Diallo',
  excerpt:
  "Plongée au cœur de notre dernier grand projet résidentiel. Découvrez l'avancement du gros œuvre en images.",
  image:
  'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  featured: false
},
{
  id: 'normes-environnementales-2024',
  title: 'Les nouvelles normes environnementales de construction en 2024',
  category: 'Réglementation',
  date: '02 Sep 2023',
  readTime: '6 min',
  author: 'Marc Lemaire',
  excerpt:
  "Tout ce qu'il faut savoir sur la réglementation thermique et les matériaux éco-responsables pour votre futur projet.",
  image:
  'https://images.unsplash.com/photo-1518780664697-55e3ad937233?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  featured: false
},
{
  id: 'importance-etude-sol',
  title: "Pourquoi l'étude de sol est-elle indispensable ?",
  category: 'Chantier',
  date: '20 Aou 2023',
  readTime: '4 min',
  author: 'Marc Lemaire',
  excerpt:
  'Comprendre les enjeux géotechniques avant de couler les fondations de votre maison. Une étape souvent négligée mais vitale.',
  image:
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  featured: false
},
{
  id: 'tendances-architecture-2024',
  title: 'Les 3 grandes tendances architecturales pour 2024',
  category: 'Design',
  date: '10 Aou 2023',
  readTime: '5 min',
  author: 'Sarah Koné',
  excerpt:
  "Espaces modulables, retour à la nature et domotique intégrée : découvrez ce qui fera l'architecture de demain.",
  image:
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  featured: false
}];


// ── FAQ Page Data ────────────────────────────────────────────
export const mockFaqPageData: FaqCategory[] = [
{
  name: 'Devis & Tarifs',
  items: [
  {
    q: "Combien coûte la construction d'une maison clé en main ?",
    a: 'Le coût varie en fonction de la surface, des matériaux choisis et des finitions. Nous vous invitons à utiliser notre estimateur de budget ou à nous contacter pour un devis précis et personnalisé.'
  },
  {
    q: 'Les devis sont-ils gratuits ?',
    a: "Oui, la première étude de votre projet et l'établissement du devis initial sont entièrement gratuits et sans engagement."
  },
  {
    q: 'Quelles sont les modalités de paiement ?',
    a: "Le paiement s'effectue généralement par appels de fonds échelonnés selon l'avancement des travaux (ex: 10% à la signature, 15% à l'ouverture du chantier, etc.). Un échéancier précis est défini dans le contrat."
  },
  {
    q: 'Le prix annoncé sur le devis peut-il évoluer ?',
    a: 'Nos devis sont fermes et définitifs pour les prestations décrites. Le prix ne peut évoluer que si vous demandez des modifications ou des prestations supplémentaires en cours de chantier (avenants).'
  }]

},
{
  name: 'Délais de Construction',
  items: [
  {
    q: 'Quels sont les délais moyens de construction ?',
    a: "Pour une villa standard, comptez entre 6 et 8 mois à partir de l'obtention du permis de construire. Un planning détaillé vous est fourni avant le début des travaux."
  },
  {
    q: 'Que se passe-t-il en cas de retard ?',
    a: "Nos contrats incluent des pénalités de retard en cas de dépassement du délai de livraison convenu, sauf en cas de force majeure ou d'intempéries exceptionnelles."
  },
  {
    q: 'Puis-je visiter le chantier pendant les travaux ?',
    a: "Oui, nous organisons des visites régulières avec le chef de chantier pour vous montrer l'avancement. Pour des raisons de sécurité, les visites libres ne sont pas autorisées."
  }]

},
{
  name: 'Garanties',
  items: [
  {
    q: 'Proposez-vous une garantie sur vos constructions ?',
    a: 'Absolument. Toutes nos constructions sont couvertes par la garantie décennale, vous protégeant contre les vices cachés pendant 10 ans.'
  },
  {
    q: "Qu'est-ce que la garantie de parfait achèvement ?",
    a: "Elle couvre pendant un an à compter de la réception des travaux tous les désordres signalés par le maître de l'ouvrage, quelles que soient leur nature et leur importance."
  },
  {
    q: "Qu'est-ce que la garantie biennale ?",
    a: 'Aussi appelée garantie de bon fonctionnement, elle couvre pendant deux ans les équipements dissociables de la construction (portes, fenêtres, volets, plomberie apparente, etc.).'
  }]

},
{
  name: 'Administratif',
  items: [
  {
    q: "Gérez-vous l'obtention du permis de construire ?",
    a: "Oui, notre service 'clé en main' inclut la constitution du dossier et le suivi administratif jusqu'à l'obtention de votre permis de construire."
  },
  {
    q: 'Faut-il souscrire une assurance dommages-ouvrage ?',
    a: "Oui, la souscription d'une assurance dommages-ouvrage est obligatoire pour le maître d'ouvrage. Nous pouvons vous accompagner dans cette démarche."
  },
  {
    q: 'Quels documents dois-je fournir pour lancer le projet ?',
    a: "Généralement, nous aurons besoin du titre de propriété du terrain, d'un plan de situation, et d'un relevé topographique. Notre équipe vous guidera étape par étape."
  }]

}];


// ── Contact Info ─────────────────────────────────────────────
export const mockContactInfo: ContactInfo = {
  address: '123 Avenue de la Construction, Quartier des Affaires, Ville',
  phone: '+33 1 23 45 67 89',
  email: 'contact@globus-btp.com',
  whatsapp: '+33 6 12 34 56 78',
  mapEmbedUrl:
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1m3!1d2624.9916256937595!2d2.292292615509614!3d48.85837007928746!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47e66e2964e34e2d%3A0x8ddca9ee380ef7e0!2sTour%20Eiffel!5e0!3m2!1sfr!2sfr!4v1647874587301!5m2!1sfr!2sfr',
  hours: 'Lundi - Vendredi : 08:00 - 18:00 | Samedi : 09:00 - 13:00'
};

// ── Site Settings ────────────────────────────────────────────
export const mockSiteSettings: SiteSettings = {
  companyName: 'Globus Engineering SARL',
  logo: "/LogoGlobus.png",
  phone: '+33 1 23 45 67 89',
  email: 'contact@globus-btp.com',
  address:
  '123 Avenue de la Construction, Quartier des Affaires, Douala, Cameroun',
  whatsappUrl:
  'https://wa.me/33123456789?text=Bonjour%20Globus,%20j%27aimerais%20échanger%20sur%20un%20projet...',
  socialLinks: {
    facebook: 'https://facebook.com/globusengineering',
    twitter: 'https://twitter.com/globuseng',
    linkedin: 'https://linkedin.com/company/globus-engineering',
    instagram: 'https://instagram.com/globusengineering'
  },
  footerDescription:
  'Globus Engineering SARL est votre partenaire de confiance pour tous vos projets de construction "clé en main". Solidité, esthétique et respect des délais.',
  navLinks: [
  { label: 'Accueil', href: '/' },
  { label: 'À Propos', href: '/a-propos' },
  { label: 'Services', href: '/services' },
  { label: 'Projets', href: '/projets' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact' }],

  footerQuickLinks: [
  { label: 'Accueil', href: '/' },
  { label: 'À Propos de nous', href: '/a-propos' },
  { label: 'Notre Portfolio', href: '/projets' },
  { label: 'Blog & Actualités', href: '/blog' },
  { label: "Centre d'Aide & FAQ", href: '/aide' },
  { label: 'Contact', href: '/contact' }],

  footerServiceLinks: [
  {
    label: 'Construction Résidentielle',
    href: '/services/construction-batiments'
  },
  {
    label: 'Bâtiments Commerciaux',
    href: '/services/construction-batiments'
  },
  {
    label: 'Conception Architecturale',
    href: '/services/conception-architecturale'
  },
  { label: 'Génie Civil', href: '/services/genie-civil' },
  {
    label: 'Rénovation & Réhabilitation',
    href: '/services/renovation-amenagement'
  }],

  topBarText: 'Lun - Sam: 08:00 - 18:00'
};

// ── Legal Pages ──────────────────────────────────────────────
export const mockLegalPages: Record<string, LegalPageContent> = {
  'mentions-legales': {
    slug: 'mentions-legales',
    title: 'Mentions Légales',
    lastUpdated: '15 mars 2026',
    sections: [
    {
      title: '1. Éditeur du site',
      content: `Le présent site est édité par :
• Dénomination sociale : Globus Engineering SARL
• Forme juridique : SARL au capital de 500 000 FCFA
• RCCM : RC/DLA/2020/B/1234
• Siège social : 123 Avenue de la Construction, Quartier des Affaires, Douala, Cameroun
• Directeur de la publication : M. Jean-Pierre Nkoulou
• Contact : contact@globus-btp.com | +33 1 23 45 67 89`
    },
    {
      title: '2. Hébergement',
      content: `Le site est hébergé par :
OVH SAS
2 rue Kellermann
59100 Roubaix - France
Site web : www.ovh.com`
    },
    {
      title: '3. Propriété intellectuelle',
      content: `L'ensemble de ce site relève de la législation internationale sur le droit d'auteur et la propriété intellectuelle. Tous les droits de reproduction sont réservés, y compris pour les documents téléchargeables et les représentations iconographiques et photographiques.

La reproduction de tout ou partie de ce site sur un support électronique ou papier quel qu'il soit est formellement interdite sauf autorisation expresse du directeur de la publication.`
    },
    {
      title: '4. Limitation de responsabilité',
      content: `Globus Engineering SARL s'efforce d'assurer au mieux de ses possibilités, l'exactitude et la mise à jour des informations diffusées sur ce site, dont elle se réserve le droit de corriger, à tout moment et sans préavis, le contenu.

Toutefois, Globus Engineering SARL ne peut garantir l'exactitude, la précision ou l'exhaustivité des informations mises à la disposition sur ce site. En conséquence, Globus Engineering SARL décline toute responsabilité pour toute imprécision, inexactitude ou omission portant sur des informations disponibles sur le site.`
    }]

  },
  'politique-de-confidentialite': {
    slug: 'politique-de-confidentialite',
    title: 'Politique de Confidentialité',
    lastUpdated: '15 mars 2026',
    sections: [
    {
      title: '1. Données collectées',
      content: `Nous collectons les données personnelles suivantes lorsque vous utilisez notre site :
• Via le formulaire de contact : Nom complet, adresse e-mail, numéro de téléphone, objet de la demande et contenu du message.
• Via le chatbot : Historique des conversations et informations fournies volontairement.
• Lors de la création d'un compte : Identifiants de connexion et informations de profil client.`
    },
    {
      title: '2. Finalité du traitement',
      content: `Vos données sont collectées et traitées pour les finalités suivantes :
• Répondre à vos demandes de devis et d'information.
• Gérer la relation client et le suivi de vos chantiers via l'espace utilisateur.
• Améliorer nos services et l'expérience utilisateur sur notre site.
• Vous envoyer des communications commerciales (uniquement avec votre consentement explicite).`
    },
    {
      title: '3. Base légale et durée de conservation',
      content: `Le traitement de vos données est basé sur votre consentement, l'exécution d'un contrat ou notre intérêt légitime.

Vos données personnelles sont conservées pour la durée strictement nécessaire à la réalisation des finalités mentionnées ci-dessus :
• Données de contact : 3 ans après le dernier contact.
• Données clients : durée de la relation contractuelle + 10 ans (garantie décennale et obligations légales).`
    },
    {
      title: '4. Droits des utilisateurs',
      content: `Conformément à la réglementation en vigueur (notamment le RGPD), vous disposez des droits suivants concernant vos données :
• Droit d'accès : obtenir la confirmation que vos données sont traitées et en obtenir une copie.
• Droit de rectification : corriger des données inexactes ou incomplètes.
• Droit à l'effacement : demander la suppression de vos données.
• Droit à la portabilité : recevoir vos données dans un format structuré.`
    },
    {
      title: '5. Sécurité et Contact DPO',
      content: `Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre la perte, l'accès non autorisé ou la divulgation.

Pour exercer vos droits ou pour toute question relative à la protection de vos données, vous pouvez contacter notre Délégué à la Protection des Données (DPO) :
Email : dpo@globus-btp.com
Courrier : Globus Engineering SARL, À l'attention du DPO, 123 Avenue de la Construction, Douala, Cameroun.`
    }]

  },
  'termes-et-conditions': {
    slug: 'termes-et-conditions',
    title: 'Termes et Conditions',
    lastUpdated: '15 mars 2026',
    sections: [
    {
      title: '1. Objet',
      content: `Les présentes Conditions Générales ont pour objet de définir les modalités de mise à disposition des services du site Globus BTP, ainsi que les conditions d'utilisation du site par l'Utilisateur et les conditions générales applicables aux prestations de services de construction et de génie civil proposées par Globus Engineering SARL.`
    },
    {
      title: '2. Acceptation des CGU',
      content: `L'accès et l'utilisation du site sont soumis à l'acceptation et au respect des présentes Conditions Générales. En naviguant sur le site, l'Utilisateur est présumé connaître et accepter sans réserve les présentes conditions.`
    },
    {
      title: '3. Services proposés et Conditions de devis',
      content: `Globus Engineering SARL propose des services de construction résidentielle, commerciale, de génie civil et de rénovation.

Devis : Les demandes de devis effectuées via le site sont gratuites et sans engagement. Un devis n'acquiert valeur contractuelle qu'après signature par le Client et versement de l'acompte stipulé. La validité d'un devis est généralement de 30 jours, sauf mention contraire.`
    },
    {
      title: '4. Responsabilités',
      content: `Responsabilité de l'éditeur : Globus Engineering SARL s'engage à mettre en œuvre tous les moyens nécessaires pour garantir un accès continu au site. Toutefois, sa responsabilité ne saurait être engagée en cas de force majeure ou de faits indépendants de sa volonté (pannes, maintenance).

Responsabilité dans l'exécution des travaux : Les responsabilités liées à l'exécution des chantiers sont régies par les contrats spécifiques signés avec les clients et sont couvertes par nos assurances professionnelles (notamment la garantie décennale).`
    },
    {
      title: '5. Droit applicable et litiges',
      content: `Les présentes Conditions Générales sont soumises au droit applicable au siège social de l'entreprise. En cas de litige, et à défaut d'accord amiable, les tribunaux compétents du ressort du siège social de Globus Engineering SARL seront seuls compétents.`
    }]

  },
  cookies: {
    slug: 'cookies',
    title: 'Politique des Cookies',
    lastUpdated: '15 mars 2026',
    sections: [
    {
      title: "1. Qu'est-ce qu'un cookie ?",
      content: `Un cookie est un petit fichier texte déposé sur votre terminal (ordinateur, tablette, smartphone) lors de la visite d'un site web. Il permet au site de mémoriser vos actions et préférences (telles que la connexion, la langue, la taille de la police et d'autres préférences d'affichage) pendant une durée donnée.`
    },
    {
      title: '2. Les cookies que nous utilisons',
      content: `Notre site utilise différents types de cookies :

Cookies Strictement Nécessaires (Fonctionnels) : Ces cookies sont indispensables au bon fonctionnement du site. Ils vous permettent de naviguer et d'utiliser des fonctionnalités essentielles, comme l'accès à votre espace utilisateur sécurisé ou la mémorisation de votre consentement aux cookies (ex: globus-cookie-consent).

Cookies Analytiques : Nous utilisons des outils comme Google Analytics pour collecter des informations anonymes sur la façon dont les visiteurs utilisent notre site (pages les plus visitées, temps passé, etc.). Cela nous aide à améliorer l'ergonomie et le contenu du site.

Cookies Publicitaires : Actuellement, Globus BTP n'utilise aucun cookie publicitaire ou de ciblage tiers sur ce site.`
    },
    {
      title: '3. Gestion et désactivation des cookies',
      content: `Lors de votre première visite, un bandeau vous informe de la présence de cookies et vous invite à indiquer votre choix.

Vous pouvez à tout moment configurer votre navigateur pour refuser l'installation des cookies :
• Chrome : Paramètres > Confidentialité et sécurité > Cookies et autres données de site.
• Firefox : Options > Vie privée et sécurité > Cookies et données de sites.
• Safari : Préférences > Confidentialité > Bloquer tous les cookies.
• Edge : Paramètres > Cookies et autorisations de site.

Attention : la désactivation des cookies fonctionnels peut altérer votre expérience de navigation sur notre site.`
    },
    {
      title: '4. Durée de conservation',
      content: `Les cookies déposés sur votre terminal sont conservés pour une durée maximale de 13 mois à compter de leur premier dépôt. À l'expiration de ce délai, votre consentement sera à nouveau recueilli.`
    }]

  }
};

// ── About Page ───────────────────────────────────────────────
export const mockAboutPageData: AboutPageContent = {
  heroImage:
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80',
  heroTitle: 'Qui sommes-nous ?',
  mission:
  "Fondée avec la conviction que chaque bâtiment doit être une œuvre durable, Globus Engineering SARL est née de la passion d'ingénieurs et d'architectes visionnaires. Depuis plus de 15 ans, nous transformons les paysages urbains en réalisant des projets ambitieux, du résidentiel de standing aux infrastructures industrielles complexes.",
  vision:
  'Notre mission est simple : offrir un service "clé en main" irréprochable. Nous déchargeons nos clients de toute la complexité technique et administrative pour qu\'ils puissent se concentrer sur l\'essentiel : voir leur vision prendre vie.',
  values: [
  {
    title: 'Sécurité & Qualité',
    desc: 'La sécurité de nos équipes et la qualité de nos ouvrages sont non-négociables.',
    iconKey: 'ShieldCheckIcon'
  },
  {
    title: 'Innovation',
    desc: 'Nous intégrons les dernières technologies pour des constructions plus intelligentes.',
    iconKey: 'UsersIcon'
  },
  {
    title: 'Transparence',
    desc: 'Une communication claire et honnête à chaque étape de votre projet.',
    iconKey: 'TargetIcon'
  }],

  timeline: [],
  team: [
  {
    name: 'Jean Dupont',
    role: 'Directeur Général',
    quote: '',
    imageClass: '',
    photo:
    'https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  },
  {
    name: 'Sarah Koné',
    role: 'Architecte en Chef',
    quote: '',
    imageClass: '',
    photo:
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  },
  {
    name: 'Marc Lemaire',
    role: 'Ingénieur Structure',
    quote: '',
    imageClass: '',
    photo:
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  },
  {
    name: 'Amina Diallo',
    role: 'Chef de Chantier',
    quote: '',
    imageClass: '',
    photo:
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  }],

  stats: [],
  certifications: [
  'Certification ISO 9001 (Qualité)',
  'Certification ISO 45001 (Santé & Sécurité)',
  "Agrément d'État Catégorie A",
  'Garantie Décennale Assurée',
  'Normes Environnementales HQE',
  'Membres de la Fédération du BTP']

};

import type {
  ServiceDetailFull,
  ProjectDetailFull } from
'../../../types/cms.types';

export const mockServiceDetailsFullData: Record<string, ServiceDetailFull> = {
  'construction-batiments': {
    slug: 'construction-batiments',
    title: 'Construction de Bâtiments',
    subtitle: 'Gros Œuvre',
    image:
    'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80',
    desc: "Nous prenons en charge la construction intégrale de vos bâtiments, qu'ils soient à usage résidentiel, commercial ou industriel. Notre approche 'clé en main' vous garantit une tranquillité d'esprit totale, de la pose de la première pierre jusqu'à la remise des clés.",
    details:
    "Grâce à notre expertise technique et notre réseau de partenaires fiables, nous utilisons des matériaux de première qualité respectant les normes environnementales et de sécurité les plus strictes. Chaque étape du chantier est rigoureusement contrôlée par nos ingénieurs pour assurer la pérennité de l'ouvrage.",
    benefits: [
    'Respect strict des délais annoncés',
    'Assurance décennale incluse',
    'Matériaux certifiés et durables',
    'Un seul interlocuteur dédié',
    'Suivi de chantier transparent',
    'Respect des normes parasismiques'],

    relatedCategory: 'Résidentiel',
    processSteps: [
    {
      title: 'Étude & Planification',
      desc: 'Analyse du terrain, étude de sol, élaboration des plans et obtention des permis de construire. Nous définissons ensemble le cahier des charges et le budget prévisionnel.',
      iconKey: 'ClipboardListIcon'
    },
    {
      title: 'Gros Œuvre',
      desc: 'Terrassement, fondations, élévation des murs porteurs, dalles et charpente. Chaque étape est validée par un contrôle qualité rigoureux avant de passer à la suivante.',
      iconKey: 'HardHatIcon'
    },
    {
      title: 'Second Œuvre & Finitions',
      desc: 'Plomberie, électricité, isolation, revêtements de sol, peinture et menuiseries. Nous coordonnons tous les corps de métier pour un résultat impeccable.',
      iconKey: 'ShieldCheckIcon'
    },
    {
      title: 'Livraison Clé en Main',
      desc: 'Inspection finale, levée des réserves, remise des clés et du dossier technique complet. Votre garantie décennale est activée dès la réception.',
      iconKey: 'KeyIcon'
    }],

    faq: [
    {
      q: "Combien de temps dure la construction d'une maison ?",
      a: "La durée varie selon la taille et la complexité du projet. En moyenne, comptez 10 à 18 mois pour une villa R+1 à R+2, et 18 à 36 mois pour un immeuble commercial. Nous établissons un planning détaillé dès la phase d'étude."
    },
    {
      q: 'Quelles garanties offrez-vous après la livraison ?',
      a: 'Nous offrons la garantie de parfait achèvement (1 an), la garantie biennale (2 ans) sur les équipements, et la garantie décennale (10 ans) sur la structure. Toutes nos constructions sont couvertes par une assurance professionnelle.'
    },
    {
      q: "Puis-je suivre l'avancement de mon chantier en temps réel ?",
      a: "Absolument. Chaque client dispose d'un accès à notre plateforme de suivi de chantier avec photos hebdomadaires, rapports d'avancement et un interlocuteur dédié joignable à tout moment."
    },
    {
      q: 'Fournissez-vous les matériaux ou dois-je les acheter moi-même ?',
      a: "Nous gérons l'intégralité de l'approvisionnement en matériaux. Grâce à nos partenariats avec les meilleurs fournisseurs, nous obtenons des tarifs préférentiels que nous répercutons sur votre devis."
    }]

  },
  'conception-architecturale': {
    slug: 'conception-architecturale',
    title: 'Conception Architecturale',
    subtitle: 'Études & Plans',
    image:
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80',
    desc: "Notre bureau d'études donne vie à vos idées. Nous concevons des espaces fonctionnels, esthétiques et durables, parfaitement adaptés à vos besoins et aux contraintes du terrain.",
    details:
    'Nous utilisons les derniers logiciels de CAO/DAO (AutoCAD, Revit) pour vous fournir des plans détaillés et des modélisations 3D immersives. Cela vous permet de visualiser votre projet dans ses moindres détails avant le début des travaux, évitant ainsi les mauvaises surprises.',
    benefits: [
    'Modélisation 3D réaliste et visites virtuelles',
    'Optimisation des espaces et de la lumière',
    'Dossier de permis de construire complet',
    "Respect strict des normes d'urbanisme locales",
    'Design sur-mesure et contemporain',
    "Étude d'impact environnemental"],

    relatedCategory: 'Commercial',
    processSteps: [
    {
      title: 'Consultation & Brief',
      desc: 'Rencontre avec le client pour comprendre ses besoins, son budget et ses aspirations. Visite du terrain et analyse des contraintes urbanistiques et environnementales.',
      iconKey: 'SearchIcon'
    },
    {
      title: 'Esquisse & Avant-Projet',
      desc: 'Création des premières esquisses et plans de masse. Présentation de 2 à 3 propositions architecturales avec estimations budgétaires pour validation.',
      iconKey: 'PencilRulerIcon'
    },
    {
      title: 'Modélisation 3D & Plans Détaillés',
      desc: "Développement complet des plans d'exécution, coupes, façades et modélisation 3D photoréaliste. Visite virtuelle interactive de votre futur espace.",
      iconKey: 'LayersIcon'
    },
    {
      title: 'Dossier Administratif',
      desc: 'Constitution et dépôt du dossier de permis de construire, suivi des démarches administratives et coordination avec les bureaux de contrôle.',
      iconKey: 'FileTextIcon'
    }],

    faq: [
    {
      q: 'Puis-je voir mon projet en 3D avant la construction ?',
      a: "Oui, c'est même l'un de nos points forts. Nous réalisons des modélisations 3D photoréalistes et des visites virtuelles interactives qui vous permettent de vous projeter dans votre futur espace."
    },
    {
      q: 'Combien coûte une étude architecturale ?',
      a: "Les honoraires d'architecture représentent généralement entre 8% et 12% du coût total de la construction. Ce pourcentage varie selon la complexité du projet. Nous établissons un devis détaillé après la première consultation."
    },
    {
      q: 'Gérez-vous les démarches de permis de construire ?',
      a: "Oui, nous constituons l'intégralité du dossier de permis de construire et assurons le suivi auprès des services d'urbanisme jusqu'à l'obtention de l'autorisation."
    }]

  },
  'genie-civil': {
    slug: 'genie-civil',
    title: 'Génie Civil & Travaux Publics',
    subtitle: 'Infrastructures',
    image:
    'https://images.unsplash.com/photo-1581094794329-c8112a89af12?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80',
    desc: "Une expertise pointue pour la réalisation d'infrastructures lourdes : routes, ponts, réseaux d'assainissement et aménagements urbains complexes.",
    details:
    "Nos équipes d'ingénieurs en génie civil déploient tout leur savoir-faire pour garantir des ouvrages d'art capables de résister à l'épreuve du temps et aux contraintes environnementales les plus sévères.",
    benefits: [
    'Expertise technique reconnue',
    'Parc matériel de pointe',
    'Solutions innovantes de soutènement',
    'Gestion stricte des normes HSE',
    'Études géotechniques approfondies',
    'Respect des normes environnementales'],

    relatedCategory: 'Public',
    processSteps: [
    {
      title: 'Études Géotechniques',
      desc: 'Analyse approfondie du sol, relevés topographiques, études hydrologiques et évaluation des risques naturels. Ces données sont essentielles pour dimensionner correctement les ouvrages.',
      iconKey: 'ScanIcon'
    },
    {
      title: 'Mobilisation & Terrassement',
      desc: 'Déploiement du parc matériel lourd sur site, terrassement général, déblais/remblais et préparation des plateformes de travail selon les cotes du projet.',
      iconKey: 'TruckIcon'
    },
    {
      title: 'Exécution des Ouvrages',
      desc: 'Réalisation des fondations profondes, coulage des structures en béton armé, mise en place des armatures et coffrage. Contrôle qualité à chaque phase critique.',
      iconKey: 'HardHatIcon'
    },
    {
      title: 'Réception & Contrôle',
      desc: "Tests de charge, essais de conformité, vérification des tolérances dimensionnelles et remise du dossier des ouvrages exécutés (DOE) au maître d'ouvrage.",
      iconKey: 'ShieldCheckIcon'
    }],

    faq: [
    {
      q: "Quels types d'infrastructures réalisez-vous ?",
      a: "Nous intervenons sur les routes et voiries, ponts et ouvrages d'art, réseaux d'assainissement, fondations spéciales (pieux, micropieux), murs de soutènement et aménagements urbains (parkings, places publiques)."
    },
    {
      q: 'Disposez-vous de votre propre parc matériel ?',
      a: "Oui, Globus dispose d'un parc matériel complet : pelles hydrauliques, bulldozers, grues, bétonnières, compacteurs et camions-bennes. Cela nous permet de maîtriser les coûts et les délais."
    },
    {
      q: 'Comment gérez-vous la sécurité sur les chantiers de génie civil ?',
      a: "La sécurité est notre priorité absolue. Chaque chantier dispose d'un responsable HSE dédié, d'un plan de prévention des risques et d'équipements de protection individuelle pour tous les intervenants."
    }]

  },
  'renovation-amenagement': {
    slug: 'renovation-amenagement',
    title: 'Rénovation et Aménagement',
    subtitle: 'Second Œuvre',
    image:
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80',
    desc: 'Redonnez vie à vos anciens bâtiments. Nous excellons dans la rénovation lourde et la réhabilitation, en alliant respect du patrimoine et modernité technique.',
    details:
    'De la démolition sélective à la finition intérieure, nous repensons vos espaces pour les rendre plus fonctionnels, plus économes en énergie et esthétiquement irréprochables.',
    benefits: [
    'Mise aux normes électriques et plomberie',
    'Isolation thermique et phonique (RT2020)',
    'Aménagement intérieur sur-mesure',
    "Respect de l'architecture d'origine",
    'Valorisation de votre patrimoine immobilier',
    "Solutions d'extension et surélévation"],

    relatedCategory: 'Résidentiel',
    processSteps: [
    {
      title: 'Diagnostic & État des Lieux',
      desc: 'Inspection complète du bâtiment existant : structure, réseaux, isolation, conformité. Identification des pathologies et des travaux prioritaires avec un rapport détaillé.',
      iconKey: 'SearchIcon'
    },
    {
      title: 'Démolition & Préparation',
      desc: 'Démolition sélective des éléments à remplacer, dépose des anciens revêtements, mise à nu des structures pour vérification et traitement des éventuelles fissures ou infiltrations.',
      iconKey: 'HammerIcon'
    },
    {
      title: 'Travaux de Rénovation',
      desc: "Réfection des réseaux (électricité, plomberie, chauffage), pose de l'isolation, création de nouvelles cloisons, installation des menuiseries et mise en conformité générale.",
      iconKey: 'PaintRollerIcon'
    },
    {
      title: 'Finitions & Aménagement',
      desc: "Revêtements de sol et muraux, peinture, installation des équipements sanitaires et de cuisine, éclairage et décoration. Livraison d'un espace entièrement rénové et prêt à vivre.",
      iconKey: 'RulerIcon'
    }],

    faq: [
    {
      q: 'Faut-il un permis de construire pour une rénovation ?',
      a: "Cela dépend de l'ampleur des travaux. Une simple rénovation intérieure ne nécessite généralement pas de permis. En revanche, une modification de façade, une extension ou un changement de destination du bâtiment requiert une déclaration préalable ou un permis de construire."
    },
    {
      q: 'Combien coûte une rénovation complète au m² ?',
      a: "Le coût varie entre 800 et 1 500 €/m² selon l'état initial du bâtiment et le niveau de finition souhaité. Nous établissons un devis précis après le diagnostic initial pour éviter toute mauvaise surprise."
    },
    {
      q: 'Peut-on habiter le logement pendant les travaux ?',
      a: 'Pour une rénovation partielle (une seule pièce ou un étage), il est souvent possible de rester sur place. Pour une rénovation complète, nous recommandons de prévoir un logement temporaire pour votre confort et la sécurité du chantier.'
    }]

  }
};

export const mockProjectDetailsFullData: Record<string, ProjectDetailFull> = {
  'villa-alizes': {
    slug: 'villa-alizes',
    title: 'Villa Contemporaine Les Alizés',
    category: 'Résidentiel',
    status: 'Livré en 2023',
    location: 'Douala, Quartier Bonapriso',
    client: 'Privé',
    area: '450 m² (R+2)',
    duration: '14 mois',
    architect: 'Cabinet Design & Co',
    images: [
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80'],

    challenge:
    "La construction de la Villa Les Alizés représentait un défi architectural majeur en raison de la topographie complexe du terrain, présentant une forte déclivité. Le client souhaitait une maison ultra-moderne, lumineuse, tout en préservant l'intimité vis-à-vis du voisinage.",
    solution:
    'Les ingénieurs de Globus ont conçu des fondations spéciales sur pieux pour stabiliser la structure. Nous avons privilégié de grandes baies vitrées orientées stratégiquement pour maximiser la lumière naturelle tout en évitant le vis-à-vis. Le résultat est une villa aux lignes épurées, intégrant des matériaux nobles (bois exotique, béton ciré, verre) et des solutions domotiques de pointe.',
    videoUrl: 'https://www.youtube.com/embed/ScMzIvxBSi4',
    progression: [
    { step: 'Études et conception', status: 'validé', date: 'Janvier 2022' },
    {
      step: 'Terrassement et fondations',
      status: 'validé',
      date: 'Mars 2022'
    },
    { step: 'Gros œuvre', status: 'validé', date: 'Juillet 2022' },
    {
      step: "Mise hors d'eau / hors d'air",
      status: 'validé',
      date: 'Octobre 2022'
    },
    {
      step: 'Second œuvre et finitions',
      status: 'validé',
      date: 'Février 2023'
    },
    { step: 'Aménagements extérieurs', status: 'validé', date: 'Avril 2023' },
    { step: 'Livraison', status: 'validé', date: 'Mai 2023' }]

  },
  'complexe-horizon': {
    slug: 'complexe-horizon',
    title: 'Complexe Bureaux Horizon',
    category: 'Commercial',
    status: 'Livré en 2022',
    location: 'Yaoundé, Centre',
    client: 'Horizon Invest',
    area: '2500 m² (R+6)',
    duration: '24 mois',
    architect: 'Studio ArchiPlus',
    images: [
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80'],

    challenge:
    'Construire un immeuble de bureaux de grande hauteur en plein centre-ville avec un espace de stockage de matériaux extrêmement restreint et des contraintes de nuisances sonores strictes.',
    solution:
    "Mise en place d'une logistique en flux tendu (just-in-time) pour l'approvisionnement. Utilisation de structures métalliques préfabriquées pour accélérer le montage et réduire les nuisances sur site. Le bâtiment a obtenu la certification HQE grâce à son isolation thermique par l'extérieur et sa façade bioclimatique.",
    videoUrl: 'https://www.youtube.com/embed/ScMzIvxBSi4',
    progression: [
    {
      step: 'Obtention du permis de construire',
      status: 'validé',
      date: 'Février 2020'
    },
    { step: 'Fondations profondes', status: 'validé', date: 'Juin 2020' },
    {
      step: 'Élévation de la structure',
      status: 'validé',
      date: 'Décembre 2020'
    },
    { step: 'Façades et vitrages', status: 'validé', date: 'Août 2021' },
    {
      step: 'Aménagements intérieurs',
      status: 'validé',
      date: 'Janvier 2022'
    },
    { step: 'Tests et mise en service', status: 'validé', date: 'Mars 2022' },
    { step: 'Inauguration', status: 'validé', date: 'Avril 2022' }]

  },
  'hopital-regional': {
    slug: 'hopital-regional',
    title: 'Hôpital Régional de Bafoussam',
    category: 'Institutionnel',
    status: 'En Cours',
    location: 'Bafoussam',
    client: 'Ministère de la Santé Publique',
    area: '8500 m²',
    duration: '36 mois',
    architect: 'Santé Design Architecture',
    images: [
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1538108149393-fbbd81895907?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80'],

    challenge:
    "La conception et la construction d'un établissement de santé moderne nécessitent une intégration complexe des fluides médicaux, des systèmes de ventilation spécifiques (salles blanches) et une alimentation électrique redondante pour garantir la continuité des soins.",
    solution:
    "Nous avons déployé une équipe spécialisée en ingénierie hospitalière. L'utilisation de la modélisation BIM a permis de coordonner l'ensemble des réseaux techniques avant la phase de construction, évitant ainsi les conflits sur le chantier et optimisant les délais de réalisation.",
    videoUrl: 'https://www.youtube.com/embed/ScMzIvxBSi4',
    progression: [
    {
      step: 'Terrassement et gros œuvre',
      status: 'validé',
      date: 'Mai 2023'
    },
    { step: 'Structure principale', status: 'validé', date: 'Novembre 2023' },
    { step: 'Réseaux et fluides médicaux', status: 'en-cours' },
    { step: 'Aménagements intérieurs', status: 'à-venir' },
    { step: 'Équipements biomédicaux', status: 'à-venir' },
    { step: 'Tests de conformité', status: 'à-venir' }]

  },
  'tour-zenith': {
    slug: 'tour-zenith',
    title: 'Fondations Tour Zenith',
    category: 'Commercial',
    status: 'En Cours',
    location: 'Douala, Akwa',
    client: 'Zenith Corporation',
    area: '12000 m² (R+15)',
    duration: '28 mois',
    architect: 'Cabinet Skyline',
    images: [
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80'],

    challenge:
    "La réalisation des fondations d'une tour de 15 étages dans une zone à forte densité urbaine, avec un sol marécageux nécessitant des ancrages profonds pour assurer la stabilité du gratte-ciel.",
    solution:
    "Mise en œuvre de fondations sur pieux forés à plus de 30 mètres de profondeur. Nous avons utilisé des techniques de soutènement avancées (parois moulées) pour protéger les bâtiments mitoyens pendant la phase d'excavation des parkings souterrains.",
    videoUrl: 'https://www.youtube.com/embed/ScMzIvxBSi4',
    progression: [
    {
      step: 'Études géotechniques',
      status: 'validé',
      date: 'Septembre 2023'
    },
    {
      step: 'Parois moulées et soutènement',
      status: 'validé',
      date: 'Décembre 2023'
    },
    { step: 'Fondations profondes (pieux)', status: 'en-cours' },
    { step: 'Radiers et sous-sols', status: 'à-venir' },
    { step: 'Élévation de la superstructure', status: 'à-venir' }]

  },
  'boutique-flagship': {
    slug: 'boutique-flagship',
    title: 'Centre Commercial de la Place',
    category: 'Commercial',
    status: 'En Cours',
    location: 'Douala, Bonanjo',
    client: 'Retail Group Africa',
    area: '18000 m²',
    duration: '22 mois',
    architect: 'Espaces & Commerce',
    images: [
    'https://images.unsplash.com/photo-1582063289852-62e3ba2747f8?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80'],

    challenge:
    "Créer un espace commercial attractif et moderne capable d'accueillir un flux important de visiteurs, tout en intégrant des solutions éco-responsables pour la gestion de l'énergie et de la climatisation.",
    solution:
    "Intégration d'une verrière centrale monumentale pour maximiser l'éclairage naturel. Le système de climatisation centralisée utilise des technologies de récupération de chaleur, réduisant ainsi l'empreinte carbone du bâtiment de 30% par rapport aux standards habituels.",
    videoUrl: 'https://www.youtube.com/embed/ScMzIvxBSi4',
    progression: [
    {
      step: 'Gros œuvre et charpente métallique',
      status: 'validé',
      date: 'Octobre 2023'
    },
    {
      step: 'Couverture et verrière',
      status: 'validé',
      date: 'Janvier 2024'
    },
    { step: 'Aménagement des cellules commerciales', status: 'en-cours' },
    { step: 'Finitions des espaces communs', status: 'à-venir' },
    { step: 'Installation des équipements', status: 'à-venir' }]

  },
  'residence-jardins': {
    slug: 'residence-jardins',
    title: 'Complexe Résidentiel Les Jardins',
    category: 'Résidentiel',
    status: 'En Cours',
    location: 'Kribi',
    client: 'Promoteur Immobilier Sud',
    area: '3 hectares',
    duration: '30 mois',
    architect: 'Eco-Habitat Architectes',
    images: [
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80'],

    challenge:
    'Développer un vaste complexe résidentiel de 200 appartements en bord de mer, nécessitant des matériaux résistants à la corrosion saline et une gestion optimisée des eaux pluviales.',
    solution:
    "Utilisation de bétons spéciaux et d'armatures traitées contre la corrosion. Nous avons conçu un système de drainage écologique intégrant des noues paysagères pour gérer les fortes précipitations tropicales tout en préservant l'esthétique du site.",
    videoUrl: 'https://www.youtube.com/embed/ScMzIvxBSi4',
    progression: [
    { step: 'Viabilisation du terrain', status: 'validé', date: 'Août 2023' },
    {
      step: 'Fondations des blocs A et B',
      status: 'validé',
      date: 'Novembre 2023'
    },
    {
      step: 'Élévation des structures',
      status: 'validé',
      date: 'Février 2024'
    },
    { step: 'Second œuvre et aménagements', status: 'en-cours' },
    { step: 'Espaces verts et voiries', status: 'à-venir' },
    { step: 'Livraison par phases', status: 'à-venir' }]

  },
  'pont-wouri': {
    slug: 'pont-wouri',
    title: 'Réhabilitation Pont du Wouri',
    category: 'Institutionnel',
    status: 'En Cours',
    location: 'Douala',
    client: 'Ministère des Travaux Publics',
    area: '1.8 km de long',
    duration: '18 mois',
    architect: 'Globus Ingénierie Civile',
    images: [
    'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80'],

    challenge:
    "Renforcer la structure d'un pont historique sans interrompre totalement le trafic routier, essentiel pour l'économie de la ville, tout en travaillant au-dessus d'un fleuve à fort courant.",
    solution:
    "Planification des travaux lourds de nuit et mise en place d'une circulation alternée. Nous avons utilisé des fibres de carbone pour le renforcement structurel du tablier, une technique innovante permettant d'augmenter la capacité portante sans alourdir l'ouvrage.",
    videoUrl: 'https://www.youtube.com/embed/ScMzIvxBSi4',
    progression: [
    { step: 'Inspection et diagnostic', status: 'validé', date: 'Juin 2023' },
    {
      step: 'Renforcement des piles',
      status: 'validé',
      date: 'Octobre 2023'
    },
    { step: 'Réparation du tablier', status: 'validé', date: 'Janvier 2024' },
    { step: 'Pose du nouveau revêtement', status: 'en-cours' },
    { step: 'Éclairage et signalisation', status: 'à-venir' }]

  },
  'villa-moderne': {
    slug: 'villa-moderne',
    title: 'Villa Moderne R+1 Bastos',
    category: 'Résidentiel',
    status: 'En Cours',
    location: 'Yaoundé, Bastos',
    client: 'Privé',
    area: '600 m²',
    duration: '12 mois',
    architect: 'Studio ArchiPlus',
    images: [
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80'],

    challenge:
    "Intégrer une architecture ultra-contemporaine dans un quartier résidentiel huppé, avec des exigences élevées en matière de domotique, de sécurité et d'autonomie énergétique.",
    solution:
    "Conception d'une toiture végétalisée couplée à des panneaux solaires invisibles depuis la rue. La maison est entièrement connectée (gestion de l'éclairage, climatisation, sécurité) via un système centralisé intuitif, offrant un confort optimal au client.",
    videoUrl: 'https://www.youtube.com/embed/ScMzIvxBSi4',
    progression: [
    {
      step: 'Fondations et dalle RDC',
      status: 'validé',
      date: 'Novembre 2023'
    },
    { step: 'Élévation R+1', status: 'validé', date: 'Janvier 2024' },
    { step: 'Toiture et étanchéité', status: 'en-cours' },
    { step: 'Menuiseries et domotique', status: 'à-venir' },
    { step: 'Finitions haut de gamme', status: 'à-venir' }]

  },
  'usine-logistique': {
    slug: 'usine-logistique',
    title: 'Entrepôt Logistique Zone Franche',
    category: 'Industriel',
    status: 'Livré en 2023',
    location: 'Douala, Bonabéri',
    client: 'LogisCam SA',
    area: '5000 m²',
    duration: '10 mois',
    architect: 'Globus Engineering',
    images: [
    'https://images.unsplash.com/photo-1581094794329-c8112a89af12?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80'],

    challenge:
    "Construire un entrepôt de grande capacité dans des délais très courts pour répondre aux besoins urgents d'expansion du client, tout en garantissant des normes de sécurité incendie strictes.",
    solution:
    "Utilisation d'une charpente métallique préfabriquée en usine pour un assemblage rapide sur site. Nous avons installé un système de sprinklers de dernière génération et un dallage industriel haute résistance pour supporter le trafic intensif des chariots élévateurs.",
    videoUrl: 'https://www.youtube.com/embed/ScMzIvxBSi4',
    progression: [
    {
      step: 'Terrassement et fondations',
      status: 'validé',
      date: 'Février 2023'
    },
    { step: 'Montage de la charpente', status: 'validé', date: 'Avril 2023' },
    { step: 'Couverture et bardage', status: 'validé', date: 'Juin 2023' },
    { step: 'Dallage industriel', status: 'validé', date: 'Août 2023' },
    {
      step: 'Réseaux et sécurité incendie',
      status: 'validé',
      date: 'Octobre 2023'
    },
    { step: 'Livraison', status: 'validé', date: 'Décembre 2023' }]

  },
  default: {
    slug: 'default',
    title: 'Projet de Construction',
    category: 'Gros Œuvre',
    status: 'En Cours',
    location: 'Cameroun',
    client: 'Confidentiel',
    area: 'Sur mesure',
    duration: 'En cours',
    architect: 'Globus Engineering',
    images: [
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80',
    'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80'],

    challenge:
    'Répondre aux exigences techniques et architecturales spécifiques du client tout en respectant un budget et des délais serrés.',
    solution:
    "Déploiement de notre méthodologie 'clé en main' avec un suivi rigoureux à chaque étape du chantier, garantissant une exécution parfaite et conforme aux normes de sécurité.",
    videoUrl: 'https://www.youtube.com/embed/ScMzIvxBSi4',
    progression: [
    {
      step: 'Installation de chantier',
      status: 'validé',
      date: 'Septembre 2023'
    },
    { step: 'Fondations', status: 'validé', date: 'Novembre 2023' },
    {
      step: 'Élévation des murs (RDC)',
      status: 'validé',
      date: 'Janvier 2024'
    },
    { step: 'Plancher haut et charpente', status: 'en-cours' },
    { step: 'Menuiseries extérieures', status: 'à-venir' },
    { step: 'Équipements techniques', status: 'à-venir' },
    { step: 'Finitions et livraison', status: 'à-venir' }]

  }
};