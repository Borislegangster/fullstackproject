import React, { useState, Children } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileTextIcon,
  ImageIcon,
  BriefcaseIcon,
  UsersIcon,
  HelpCircleIcon,
  SearchIcon,
  PlusIcon,
  EditIcon,
  Trash2Icon,
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
  CheckCircle2Icon,
  MessageSquareIcon,
  MailIcon,
  ClockIcon,
  Loader2Icon,
  XIcon,
  UploadCloudIcon,
  SaveIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  GlobeIcon,
  ScaleIcon,
  ChevronDownIcon,
  PlayCircleIcon,
  LinkIcon,
  TypeIcon,
  HashIcon,
  ShieldCheckIcon,
  VideoIcon,
  HandshakeIcon,
  StarIcon,
  PhoneIcon,
  MapPinIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TwitterIcon,
  FolderOpenIcon,
  FileIcon,
  MusicIcon,
  CopyIcon,
  FilmIcon,
  BarChart3Icon,
  TagIcon,
  CodeIcon,
  MapIcon,
  RefreshCwIcon } from
'lucide-react';
const tabs = [
{
  id: 'blog',
  label: 'Articles Blog',
  icon: FileTextIcon
},
{
  id: 'portfolio',
  label: 'Projets & Portfolio',
  icon: ImageIcon
},
{
  id: 'services',
  label: 'Services',
  icon: BriefcaseIcon
},
{
  id: 'team',
  label: 'Équipe & Témoignages',
  icon: UsersIcon
},
{
  id: 'faq',
  label: 'FAQ & Contact',
  icon: HelpCircleIcon
},
{
  id: 'homepage',
  label: 'Accueil & Sections',
  icon: LayoutDashboardIcon
},
{
  id: 'settings',
  label: 'Paramètres Site',
  icon: SettingsIcon
},
{
  id: 'pages',
  label: 'Pages Publiques',
  icon: GlobeIcon
},
{
  id: 'legal',
  label: 'Pages Légales',
  icon: ScaleIcon
},
{
  id: 'media',
  label: 'Médiathèque',
  icon: FolderOpenIcon
},
{
  id: 'seo',
  label: 'SEO & Tracking',
  icon: SearchIcon
}];

const blogData = [
{
  id: 1,
  title: "Les 5 erreurs à éviter avant d'acheter un terrain",
  category: 'Conseils',
  author: 'Jean Dupont',
  date: '12/10/2023',
  status: 'Publié'
},
{
  id: 2,
  title: 'Comment choisir les finitions intérieures',
  category: 'Design',
  author: 'Sarah Koné',
  date: '28/09/2023',
  status: 'Publié'
},
{
  id: 3,
  title: 'Visite de la Résidence Horizon',
  category: 'Actualités',
  author: 'Amina Diallo',
  date: '15/09/2023',
  status: 'Publié'
},
{
  id: 4,
  title: 'Normes environnementales 2024',
  category: 'Réglementation',
  author: 'Marc Lemaire',
  date: '02/09/2023',
  status: 'Publié'
},
{
  id: 5,
  title: 'Guide du premier achat immobilier',
  category: 'Conseils',
  author: 'Jean Dupont',
  date: '-',
  status: 'Brouillon'
},
{
  id: 6,
  title: 'Tendances architecture 2026',
  category: 'Design',
  author: 'Sarah Koné',
  date: '25/04/2026',
  status: 'Planifié'
}];

const projectsData = [
{
  id: 1,
  title: 'Villa Les Alizés',
  category: 'Résidentiel',
  location: 'Douala',
  progress: 100,
  status: 'Publié',
  image:
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=150&q=80'
},
{
  id: 2,
  title: 'Complexe Horizon',
  category: 'Commercial',
  location: 'Yaoundé',
  progress: 100,
  status: 'Publié',
  image:
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&q=80'
},
{
  id: 3,
  title: 'Hôpital Régional',
  category: 'Institutionnel',
  location: 'Bafoussam',
  progress: 65,
  status: 'Publié',
  image:
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=150&q=80'
},
{
  id: 4,
  title: 'Tour Zenith',
  category: 'Commercial',
  location: 'Douala',
  progress: 45,
  status: 'Publié',
  image:
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=150&q=80'
},
{
  id: 5,
  title: 'Résidence Palmiers',
  category: 'Résidentiel',
  location: 'Douala',
  progress: 30,
  status: 'Brouillon',
  image:
  'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=150&q=80'
}];

const servicesData = [
{
  id: 1,
  title: 'Construction de Bâtiments',
  subtitle: 'Résidentiel / Commercial / Industriel',
  status: 'Publié'
},
{
  id: 2,
  title: 'Conception Architecturale',
  subtitle: 'Plans 2D/3D & Design',
  status: 'Publié'
},
{
  id: 3,
  title: 'Génie Civil & Travaux Publics',
  subtitle: 'Infrastructures complexes',
  status: 'Publié'
},
{
  id: 4,
  title: 'Rénovation et Aménagement',
  subtitle: 'Réhabilitation & Second Œuvre',
  status: 'Publié'
}];

const teamData = [
{
  id: 1,
  name: 'Jean-Paul Kamga',
  role: 'Directeur Général'
},
{
  id: 2,
  name: 'Marie-Claire Fotso',
  role: 'Architecte en Chef'
},
{
  id: 3,
  name: 'Alain Mbarga',
  role: 'Directeur Technique'
},
{
  id: 4,
  name: 'Sophie Ndjock',
  role: 'Responsable QHSE'
}];

const testimonialsData = [
{
  id: 1,
  name: 'M. Essomba',
  role: 'Propriétaire Villa',
  quote: "Une équipe professionnelle et à l'écoute...",
  status: 'Publié'
},
{
  id: 2,
  name: 'SCI Akwa Center',
  role: 'Promoteur Immobilier',
  quote: 'Respect strict des délais et du budget...',
  status: 'Publié'
},
{
  id: 3,
  name: 'Mme Ndiaye',
  role: 'Investisseur',
  quote: 'La qualité des finitions est exceptionnelle...',
  status: 'Brouillon'
}];

const faqData = [
{
  id: 1,
  question: 'Quels sont vos délais moyens de construction ?',
  status: 'Publié'
},
{
  id: 2,
  question: 'Proposez-vous des garanties décennales ?',
  status: 'Publié'
},
{
  id: 3,
  question: 'Comment se déroule le paiement ?',
  status: 'Publié'
},
{
  id: 4,
  question: 'Prenez-vous en charge les démarches administratives ?',
  status: 'Publié'
},
{
  id: 5,
  question: 'Quels matériaux utilisez-vous ?',
  status: 'Brouillon'
}];

const contactData = [
{
  id: 1,
  name: 'Pierre Talla',
  email: 'p.talla@email.com',
  subject: 'Devis construction villa',
  date: '23/03/2026',
  status: 'Nouveau'
},
{
  id: 2,
  name: 'Entreprise ABC',
  email: 'contact@abc.com',
  subject: 'Partenariat sous-traitance',
  date: '22/03/2026',
  status: 'Lu'
},
{
  id: 3,
  name: 'Jeanne Eto',
  email: 'j.eto@email.com',
  subject: 'Rénovation appartement',
  date: '20/03/2026',
  status: 'Répondu'
},
{
  id: 4,
  name: 'Mairie Douala',
  email: 'urbanisme@douala.cm',
  subject: "Dossier appel d'offres",
  date: '18/03/2026',
  status: 'Répondu'
}];

// ===== NEW: Homepage Sections Data =====
const heroSlidesData = [
{
  id: 1,
  tag: 'BTP & Construction Clé en main',
  title: 'Bâtissez votre avenir en toute sérénité.',
  subtitle:
  "Ensemble vers la perfection !!! De la conception architecturale à la remise des clés, nous gérons l'intégralité de votre projet avec rigueur et passion.",
  image:
  'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=400&q=80',
  cta1Text: 'Estimer mon budget',
  cta1Href: '#estimateur',
  cta2Text: 'Découvrir nos réalisations',
  cta2Href: '#projets',
  status: 'Actif'
},
{
  id: 2,
  tag: 'Expertise & Savoir-faire',
  title: 'Des constructions solides, durables et esthétiques.',
  subtitle:
  'Plus de 50 projets livrés avec succès. Nos ingénieurs qualifiés transforment vos visions en réalités concrètes.',
  image:
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=80',
  cta1Text: 'Voir nos projets',
  cta1Href: '#projets',
  cta2Text: 'Nos services',
  cta2Href: '#services'
},
{
  id: 3,
  tag: 'Architecture & Design',
  title: "De l'esquisse à la réalité, votre vision prend forme.",
  subtitle:
  'Conception architecturale sur-mesure, modélisation 3D et plans détaillés pour un résultat à la hauteur de vos ambitions.',
  image:
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&q=80',
  cta1Text: 'Demander un devis',
  cta1Href: '#contact',
  cta2Text: 'Notre méthodologie',
  cta2Href: '#methodologie'
},
{
  id: 4,
  tag: 'Qualité & Garanties',
  title: 'Garantie décennale et matériaux certifiés.',
  subtitle:
  "Votre tranquillité d'esprit est notre priorité. Chaque ouvrage est couvert et réalisé avec des matériaux normés et testés.",
  image:
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&q=80',
  cta1Text: 'Nos garanties',
  cta1Href: '#garanties',
  cta2Text: 'Contactez-nous',
  cta2Href: '#contact'
}];

const heroVideoData = {
  url: 'https://videos.pexels.com/video-files/2835509/2835509-hd_1920_1080_30fps.mp4',
  poster:
  'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=400&q=80',
  duration: 6
};
const engagementsData = [
{
  id: 1,
  title: 'Expertise Technique',
  description:
  "Plus de 15 ans d'expérience dans le BTP avec des ingénieurs certifiés.",
  icon: 'ShieldCheck',
  bgColor: 'blue'
},
{
  id: 2,
  title: '100% Clé en main',
  description:
  'De la conception à la livraison, un seul interlocuteur pour tout votre projet.',
  icon: 'Key',
  bgColor: 'orange'
},
{
  id: 3,
  title: 'Qualité et Délais',
  description:
  'Matériaux normés, garantie décennale et respect strict du planning.',
  icon: 'Clock',
  bgColor: 'green'
}];

const aboutSectionData = {
  paragraph1:
  "Fondée avec la conviction que chaque bâtiment doit être une œuvre durable, Globus Engineering SARL est née de la passion d'ingénieurs et d'architectes visionnaires.",
  paragraph2:
  'Notre mission est simple : offrir un service "clé en main" irréprochable, de la conception architecturale à la remise des clés.',
  bulletPoints: [
  'Construction résidentielle & commerciale',
  'Conception architecturale sur-mesure',
  'Génie civil & travaux publics',
  'Rénovation et réhabilitation'],

  badgeText: '15+ années',
  images: [
  'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=300&q=80',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=300&q=80',
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=300&q=80',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=300&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=300&q=80']

};
const methodologyData = [
{
  id: 1,
  title: 'Étude & Conception',
  description:
  'Analyse de vos besoins, étude de faisabilité et conception architecturale détaillée.',
  image:
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=300&q=80'
},
{
  id: 2,
  title: 'Démarches Administratives',
  description:
  'Obtention des permis, autorisations et conformité réglementaire.',
  image:
  'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=300&q=80'
},
{
  id: 3,
  title: 'Gros Œuvre',
  description:
  'Fondations, élévation des murs, dalles et charpente avec contrôle qualité.',
  image:
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=300&q=80'
},
{
  id: 4,
  title: 'Second Œuvre & Finitions',
  description:
  'Plomberie, électricité, revêtements et finitions intérieures.',
  image:
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300&q=80'
},
{
  id: 5,
  title: 'Remise des Clés',
  description:
  'Inspection finale, levée des réserves et remise du dossier technique.',
  image:
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=300&q=80'
}];

const statsBarData = [
{
  id: 1,
  value: '50+',
  label: 'Projets Livrés'
},
{
  id: 2,
  value: '100%',
  label: 'Clients Satisfaits'
},
{
  id: 3,
  value: '30+',
  label: 'Experts'
},
{
  id: 4,
  value: '15',
  label: "Années d'expérience"
}];

const guaranteesData = [
{
  id: 1,
  title: 'Garantie Décennale',
  description:
  'Couverture complète de la structure pendant 10 ans après livraison.'
},
{
  id: 2,
  title: 'Matériaux Normés',
  description:
  'Utilisation exclusive de matériaux certifiés et testés en laboratoire.'
},
{
  id: 3,
  title: 'Service Après-Vente',
  description:
  'Équipe SAV dédiée pour intervenir rapidement en cas de besoin.'
},
{
  id: 4,
  title: 'Sécurité sur Chantier',
  description:
  'Protocoles HSE stricts et équipements de protection pour tous.'
}];

const videoSectionData = {
  youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  title: 'Notre Promesse',
  subtitle:
  'Découvrez comment Globus Engineering transforme vos projets en réalités durables.'
};
const partnersData = [
{
  id: 1,
  name: 'CIMENCAM'
},
{
  id: 2,
  name: 'AFRICA STEEL'
},
{
  id: 3,
  name: 'LAFARGE'
},
{
  id: 4,
  name: 'SOGEA'
},
{
  id: 5,
  name: 'BTP MATÉRIAUX'
},
{
  id: 6,
  name: 'ECO-BUILD'
},
{
  id: 7,
  name: 'TECHNO-STRUCT'
},
{
  id: 8,
  name: 'GLOBAL PAINT'
}];

const ctaBannerData = {
  title: 'Prêt à concrétiser votre projet ?',
  subtitle:
  "Contactez-nous dès aujourd'hui pour une étude gratuite et personnalisée.",
  buttonText: 'Demander un devis gratuit',
  buttonLink: '#contact'
};
// ===== NEW: Site Settings Data =====
const headerSettingsData = {
  logoUrl: "/globusLogo.jpg",

  phone: '+33 1 23 45 67 89',
  email: 'contact@globus-btp.com',
  hours: 'Lun-Sam 08:00-18:00'
};
const footerSettingsData = {
  description:
  'Globus Engineering SARL est votre partenaire de confiance pour tous vos projets de construction "clé en main". Solidité, esthétique et respect des délais.',
  address: '123 Avenue de la Construction, Quartier des Affaires, Ville',
  phone: '+33 1 23 45 67 89',
  email: 'contact@globus-btp.com',
  facebook: '#',
  twitter: '#',
  linkedin: '#',
  instagram: '#',
  newsletterEnabled: true
};
const seoSettingsData = {
  metaTitle: 'Globus Engineering SARL - Construction BTP Clé en Main',
  metaDescription:
  'Votre partenaire de confiance pour la construction, la rénovation et le génie civil au Cameroun.',
  ogImage: ''
};
// ===== NEW: Public Pages Data =====
const aboutPageData = {
  heroImage:
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=80',
  historyTitle: 'Notre Histoire & Notre Vision',
  historyP1:
  "Fondée avec la conviction que chaque bâtiment doit être une œuvre durable, Globus Engineering SARL est née de la passion d'ingénieurs et d'architectes visionnaires. Depuis plus de 15 ans, nous transformons les paysages urbains.",
  historyP2:
  'Notre mission est simple : offrir un service "clé en main" irréprochable. Nous déchargeons nos clients de toute la complexité technique et administrative.',
  values: [
  {
    title: 'Sécurité & Qualité',
    desc: 'La sécurité de nos équipes et la qualité de nos ouvrages sont non-négociables.'
  },
  {
    title: 'Innovation',
    desc: 'Nous intégrons les dernières technologies pour des constructions plus intelligentes.'
  },
  {
    title: 'Transparence',
    desc: 'Une communication claire et honnête à chaque étape de votre projet.'
  }],

  certifications: [
  'Certification ISO 9001 (Qualité)',
  'Certification ISO 45001 (Santé & Sécurité)',
  "Agrément d'État Catégorie A",
  'Garatnie Décennale Assurée',
  'Normes Environnementales HQE',
  'Membres de la Fédération du BTP']

};
const contactPageData = {
  address: '123 Avenue de la Construction\nQuartier des Affaires, Ville',
  phoneStandard: '+33 1 23 45 67 89',
  phoneWhatsApp: '+33 6 12 34 56 78',
  emailContact: 'contact@globus-btp.com',
  emailDevis: 'devis@globus-btp.com',
  hoursWeekday: 'Lundi - Vendredi : 08:00 - 18:00',
  hoursSaturday: 'Samedi : 09:00 - 13:00',
  mapUrl:
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2624.9916256937595!2d2.292292615509614!3d48.85837007928746',
  formSubjects: [
  'Demande de devis',
  'Renseignement général',
  'Candidature / Emploi',
  'Autre demande']

};
const faqPageData = [
{
  id: 1,
  category: 'Devis & Tarifs',
  items: [
  {
    q: "Combien coûte la construction d'une maison clé en main ?",
    a: 'Le coût varie en fonction de la surface, des matériaux choisis et des finitions.'
  },
  {
    q: 'Les devis sont-ils gratuits ?',
    a: "Oui, la première étude et l'établissement du devis initial sont entièrement gratuits."
  },
  {
    q: 'Quelles sont les modalités de paiement ?',
    a: "Le paiement s'effectue par appels de fonds échelonnés selon l'avancement des travaux."
  },
  {
    q: 'Le prix annoncé peut-il évoluer ?',
    a: 'Nos devis sont fermes et définitifs pour les prestations décrites.'
  }]

},
{
  id: 2,
  category: 'Délais de Construction',
  items: [
  {
    q: 'Quels sont les délais moyens de construction ?',
    a: 'Pour une villa standard, comptez entre 6 et 8 mois.'
  },
  {
    q: 'Que se passe-t-il en cas de retard ?',
    a: 'Nos contrats incluent des pénalités de retard.'
  },
  {
    q: 'Puis-je visiter le chantier pendant les travaux ?',
    a: 'Oui, nous organisons des visites régulières avec le chef de chantier.'
  }]

},
{
  id: 3,
  category: 'Garanties',
  items: [
  {
    q: 'Proposez-vous une garantie sur vos constructions ?',
    a: 'Toutes nos constructions sont couvertes par la garantie décennale.'
  },
  {
    q: "Qu'est-ce que la garantie de parfait achèvement ?",
    a: 'Elle couvre pendant un an tous les désordres signalés.'
  },
  {
    q: "Qu'est-ce que la garantie biennale ?",
    a: 'Elle couvre pendant deux ans les équipements dissociables.'
  }]

},
{
  id: 4,
  category: 'Administratif',
  items: [
  {
    q: "Gérez-vous l'obtention du permis de construire ?",
    a: 'Oui, notre service inclut la constitution du dossier et le suivi administratif.'
  },
  {
    q: 'Faut-il souscrire une assurance dommages-ouvrage ?',
    a: "Oui, c'est obligatoire pour le maître d'ouvrage."
  },
  {
    q: 'Quels documents dois-je fournir ?',
    a: 'Titre de propriété, plan de situation, et relevé topographique.'
  }]

}];

const helpCenterData = {
  supportEmail: 'support@globus-btp.com',
  whatsappNumber: '+33 6 12 34 56 78',
  faqDesc:
  'Trouvez des réponses immédiates aux questions les plus fréquemment posées.',
  whatsappDesc:
  'Discutez en direct avec un conseiller pour une assistance rapide.',
  emailDesc: 'Envoyez-nous un email détaillé. Réponse sous 24h ouvrées.'
};
// ===== NEW: Legal Pages Data =====
const legalPagesData = {
  legalNotice: {
    lastUpdated: '15 mars 2026',
    companyName: 'Globus Engineering SARL',
    legalForm: 'SARL au capital de 500 000 FCFA',
    rccm: 'RC/DLA/2020/B/1234',
    address:
    '123 Avenue de la Construction, Quartier des Affaires, Douala, Cameroun',
    director: 'M. Jean-Pierre Nkoulou',
    contact: 'contact@globus-btp.com | +33 1 23 45 67 89',
    hostName: 'OVH SAS',
    hostAddress: '2 rue Kellermann, 59100 Roubaix - France'
  },
  privacyPolicy: {
    lastUpdated: '15 mars 2026',
    sections: 5
  },
  terms: {
    lastUpdated: '15 mars 2026',
    sections: 5
  },
  cookiePolicy: {
    lastUpdated: '15 mars 2026',
    sections: 4
  }
};
// ===== NEW: Media Library Data =====
const mediaData = [
{
  id: 1,
  name: 'Hero Slide 1 - Construction',
  url: 'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=400&q=80',
  type: 'image',
  size: '2.4 MB',
  uploadDate: '10/03/2026',
  usageCount: 3,
  thumbnail:
  'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=400&q=80'
},
{
  id: 2,
  name: 'Hero Slide 2 - Expertise',
  url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=80',
  type: 'image',
  size: '1.8 MB',
  uploadDate: '10/03/2026',
  usageCount: 2,
  thumbnail:
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=80'
},
{
  id: 3,
  name: 'Hero Slide 3 - Architecture',
  url: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&q=80',
  type: 'image',
  size: '3.1 MB',
  uploadDate: '10/03/2026',
  usageCount: 2,
  thumbnail:
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&q=80'
},
{
  id: 4,
  name: 'Hero Slide 4 - Qualité',
  url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&q=80',
  type: 'image',
  size: '2.2 MB',
  uploadDate: '10/03/2026',
  usageCount: 2,
  thumbnail:
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&q=80'
},
{
  id: 5,
  name: 'Vidéo Intro Accueil',
  url: 'https://videos.pexels.com/video-files/2835509/2835509-hd_1920_1080_30fps.mp4',
  type: 'video',
  size: '15.6 MB',
  uploadDate: '12/03/2026',
  usageCount: 1,
  thumbnail:
  'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=400&q=80'
},
{
  id: 6,
  name: 'Projet Villa Les Alizés',
  url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&q=80',
  type: 'image',
  size: '1.5 MB',
  uploadDate: '14/03/2026',
  usageCount: 2,
  thumbnail:
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&q=80'
},
{
  id: 7,
  name: 'Logo Globus Engineering',
  url: "/globusLogo.jpg",
  type: 'image',
  size: '0.5 MB',
  uploadDate: '01/01/2026',
  usageCount: 5,
  thumbnail: "/globusLogo.jpg"

},
{
  id: 8,
  name: 'Méthodologie - Démarches',
  url: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&q=80',
  type: 'image',
  size: '1.2 MB',
  uploadDate: '15/03/2026',
  usageCount: 1,
  thumbnail:
  'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&q=80'
},
{
  id: 9,
  name: 'Méthodologie - Second Oeuvre',
  url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&q=80',
  type: 'image',
  size: '2.1 MB',
  uploadDate: '15/03/2026',
  usageCount: 1,
  thumbnail:
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&q=80'
},
{
  id: 10,
  name: 'Plaquette Commerciale 2026',
  url: '#',
  type: 'document',
  size: '4.8 MB',
  uploadDate: '20/03/2026',
  usageCount: 0,
  thumbnail: ''
}];

// ===== NEW: SEO & Tracking Data =====
const seoPageData = [
{
  id: 'home',
  page: 'Accueil',
  path: '/',
  title: 'Construction BTP Clé en Main à Douala',
  description:
  'Globus Engineering SARL, votre partenaire de confiance pour la construction, rénovation et génie civil au Cameroun. Devis gratuit.',
  ogImage: '',
  keywords: 'construction, BTP, Douala, Cameroun, clé en main, génie civil',
  status: 'Configuré'
},
{
  id: 'about',
  page: 'À Propos',
  path: '/a-propos',
  title: 'À Propos',
  description:
  "Découvrez Globus Engineering SARL, plus de 15 ans d'expérience dans le BTP. Notre histoire, nos valeurs et nos certifications.",
  ogImage: '',
  keywords: '',
  status: 'Configuré'
},
{
  id: 'services',
  page: 'Nos Services',
  path: '/services',
  title: 'Nos Services',
  description:
  'Construction de bâtiments, conception architecturale, génie civil et rénovation. Découvrez tous nos services BTP.',
  ogImage: '',
  keywords: '',
  status: 'Configuré'
},
{
  id: 'projects',
  page: 'Nos Réalisations',
  path: '/projets',
  title: 'Nos Réalisations',
  description: 'Découvrez nos projets de construction au Cameroun.',
  ogImage: '',
  keywords: '',
  status: 'Configuré'
},
{
  id: 'blog',
  page: 'Blog & Actualités',
  path: '/blog',
  title: 'Blog & Actualités',
  description:
  'Conseils construction, tendances architecture et actualités BTP.',
  ogImage: '',
  keywords: '',
  status: 'Configuré'
},
{
  id: 'contact',
  page: 'Contactez-nous',
  path: '/contact',
  title: 'Contactez-nous',
  description:
  'Contactez Globus Engineering pour vos projets. Devis gratuit, réponse sous 24h.',
  ogImage: '',
  keywords: '',
  status: 'Configuré'
},
{
  id: 'faq',
  page: 'Questions Fréquentes',
  path: '/faq',
  title: 'Questions Fréquentes',
  description:
  'Réponses à vos questions sur nos services, délais, garanties et tarifs.',
  ogImage: '',
  keywords: '',
  status: 'Configuré'
},
{
  id: 'aide',
  page: "Centre d'Aide",
  path: '/aide',
  title: "Centre d'Aide",
  description: "Besoin d'assistance ? Support WhatsApp, email ou FAQ.",
  ogImage: '',
  keywords: '',
  status: 'Configuré'
},
{
  id: 'legal',
  page: 'Mentions Légales',
  path: '/mentions-legales',
  title: 'Mentions Légales',
  description: 'Mentions légales de Globus Engineering SARL.',
  ogImage: '',
  keywords: '',
  status: 'Configuré'
},
{
  id: 'privacy',
  page: 'Politique de Confidentialité',
  path: '/politique-de-confidentialite',
  title: 'Politique de Confidentialité',
  description: 'Protection des données personnelles.',
  ogImage: '',
  keywords: '',
  status: 'Configuré'
},
{
  id: 'terms',
  page: 'Conditions Générales',
  path: '/termes-et-conditions',
  title: 'Conditions Générales',
  description: 'CGU du site Globus Engineering SARL.',
  ogImage: '',
  keywords: '',
  status: 'Configuré'
},
{
  id: 'cookies',
  page: 'Politique de Cookies',
  path: '/cookies',
  title: 'Politique de Cookies',
  description: 'Cookies utilisés et gestion.',
  ogImage: '',
  keywords: '',
  status: 'Configuré'
}];

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05
    }
  }
};
const fadeUp = {
  hidden: {
    opacity: 0,
    y: 15
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3
    }
  }
};
export function ErpCMS() {
  const [activeTab, setActiveTab] = useState('blog');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('hero');
  const [activeSettingsTab, setActiveSettingsTab] = useState('header');
  const [activePagesTab, setActivePagesTab] = useState('about');
  const [activeLegalTab, setActiveLegalTab] = useState('legalNotice');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  // Media Tab State
  const [mediaFilter, setMediaFilter] = useState('all');
  const [mediaSearch, setMediaSearch] = useState('');
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaPickerCallback, setMediaPickerCallback] = useState<
    ((url: string) => void) | null>(
    null);
  // SEO Tab State
  const [activeSeoTab, setActiveSeoTab] = useState('pages');
  const toggleSection = (id: string) =>
  setExpandedSection(expandedSection === id ? null : id);
  const handleSaveGeneric = () => {
    setIsProcessing('save-generic');
    setTimeout(() => {
      setIsProcessing(null);
      setShowEditModal(false);
      setEditItem(null);
      showToast('Modifications enregistrées avec succès');
    }, 1500);
  };
  const showToast = (
  message: string,
  type: 'success' | 'error' | 'info' = 'success') =>
  {
    setToast({
      message,
      type
    });
    setTimeout(() => setToast(null), 3000);
  };
  const handlePublishToggle = (id: number, currentStatus: string) => {
    setIsProcessing(`publish-${id}`);
    setTimeout(() => {
      setIsProcessing(null);
      showToast(
        currentStatus === 'Publié' ?
        'Article dépublié avec succès' :
        'Article publié avec succès'
      );
    }, 1500);
  };
  const handleDelete = () => {
    setIsProcessing('delete');
    setTimeout(() => {
      setIsProcessing(null);
      setShowDeleteModal(false);
      setItemToDelete(null);
      showToast('Élément supprimé avec succès');
    }, 1500);
  };
  const handleSaveArticle = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing('save-article');
    setTimeout(() => {
      setIsProcessing(null);
      setShowArticleModal(false);
      showToast('Article enregistré avec succès');
    }, 1500);
  };
  return (
    <div className="max-w-[1400px] mx-auto space-y-6 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast &&
        <motion.div
          initial={{
            opacity: 0,
            y: 50
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            y: 50
          }}
          className={`fixed bottom-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 text-white font-opensans text-sm ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
          
            {toast.type === 'success' &&
          <CheckCircle2Icon className="w-5 h-5" />
          }
            {toast.message}
          </motion.div>
        }
      </AnimatePresence>

      {/* Header & Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-montserrat font-extrabold text-2xl text-globus-blue-dark flex items-center gap-2">
              <FileTextIcon className="w-7 h-7 text-globus-orange" />
              Gestion de Contenu (CMS)
            </h2>
            <p className="font-opensans text-sm text-globus-gray mt-1">
              Gérez le contenu du site public (Blog, Projets, Services, etc.)
            </p>
          </div>
        </div>
        <div className="flex overflow-x-auto hide-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-montserrat font-semibold text-sm transition-colors relative whitespace-nowrap ${isActive ? 'text-globus-orange' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}>
                
                <Icon className="w-4 h-4" />
                {tab.label}
                {isActive &&
                <motion.div
                  layoutId="cms-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-globus-orange" />

                }
              </button>);

          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* TAB 1: BLOG */}
        {activeTab === 'blog' &&
        <motion.div
          key="blog"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="space-y-6">
          
            <motion.div
            variants={fadeUp}
            className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    Publiés
                  </p>
                  <p className="text-2xl font-montserrat font-bold text-green-600">
                    4
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle2Icon className="w-5 h-5 text-green-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    Brouillons
                  </p>
                  <p className="text-2xl font-montserrat font-bold text-gray-600">
                    1
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                  <EditIcon className="w-5 h-5 text-gray-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    Planifiés
                  </p>
                  <p className="text-2xl font-montserrat font-bold text-blue-600">
                    1
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <ClockIcon className="w-5 h-5 text-blue-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    Vues ce mois
                  </p>
                  <p className="text-2xl font-montserrat font-bold text-globus-blue-dark">
                    2,450
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <EyeIcon className="w-5 h-5 text-globus-blue" />
                </div>
              </div>
            </motion.div>

            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            
              <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                    type="text"
                    placeholder="Rechercher un article..."
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-globus-blue" />
                  
                  </div>
                  <select className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue">
                    <option>Toutes catégories</option>
                    <option>Conseils</option>
                    <option>Design</option>
                    <option>Actualités</option>
                  </select>
                </div>
                <button
                onClick={() => setShowArticleModal(true)}
                className="w-full sm:w-auto bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 text-sm">
                
                  <PlusIcon className="w-4 h-4" /> Nouvel Article
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-montserrat font-bold text-gray-500 uppercase">
                      <th className="py-3 px-5">Titre</th>
                      <th className="py-3 px-5">Catégorie</th>
                      <th className="py-3 px-5">Auteur</th>
                      <th className="py-3 px-5">Date</th>
                      <th className="py-3 px-5">Statut</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm font-opensans">
                    {blogData.map((post) =>
                  <tr
                    key={post.id}
                    className="hover:bg-gray-50 transition-colors">
                    
                        <td className="py-3 px-5 font-semibold text-gray-800">
                          {post.title}
                        </td>
                        <td className="py-3 px-5 text-gray-600">
                          {post.category}
                        </td>
                        <td className="py-3 px-5 text-gray-600">
                          {post.author}
                        </td>
                        <td className="py-3 px-5 text-gray-500">{post.date}</td>
                        <td className="py-3 px-5">
                          <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase ${post.status === 'Publié' ? 'bg-green-100 text-green-700' : post.status === 'Planifié' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                        
                            {post.status}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                          onClick={() => {
                            setPreviewItem(post);
                            setShowPreviewModal(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded transition-colors"
                          title="Aperçu">
                          
                              <SearchIcon className="w-4 h-4" />
                            </button>
                            <button
                          onClick={() => setShowArticleModal(true)}
                          className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded transition-colors"
                          title="Modifier">
                          
                              <EditIcon className="w-4 h-4" />
                            </button>
                            <button
                          onClick={() =>
                          handlePublishToggle(post.id, post.status)
                          }
                          disabled={isProcessing === `publish-${post.id}`}
                          className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors disabled:opacity-50"
                          title={
                          post.status === 'Publié' ?
                          'Dépublier' :
                          'Publier'
                          }>
                          
                              {isProcessing === `publish-${post.id}` ?
                          <Loader2Icon className="w-4 h-4 animate-spin" /> :
                          post.status === 'Publié' ?
                          <EyeOffIcon className="w-4 h-4" /> :

                          <EyeIcon className="w-4 h-4" />
                          }
                            </button>
                            <button
                          onClick={() => {
                            setItemToDelete(post);
                            setShowDeleteModal(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Supprimer">
                          
                              <Trash2Icon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                  )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        }

        {/* TAB 2: PORTFOLIO */}
        {activeTab === 'portfolio' &&
        <motion.div
          key="portfolio"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="space-y-6">
          
            <motion.div
            variants={fadeUp}
            className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            
              <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                Projets du Portfolio
              </h3>
              <button
              onClick={() =>
              showToast('Fonctionnalité en cours de développement', 'info')
              }
              className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm">
              
                <PlusIcon className="w-4 h-4" /> Ajouter un Projet
              </button>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projectsData.map((project) =>
            <motion.div
              key={project.id}
              variants={fadeUp}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group">
              
                  <div className="h-40 relative overflow-hidden">
                    <img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                
                    <div className="absolute top-3 right-3">
                      <span
                    className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase shadow-sm ${project.status === 'Publié' ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}`}>
                    
                        {project.status}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-montserrat font-bold text-globus-blue-dark">
                        {project.title}
                      </h4>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                      {project.category} • {project.location}
                    </p>

                    <div className="mb-4">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">
                          Avancement affiché
                        </span>
                        <span className="font-bold text-globus-blue">
                          {project.progress}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                      className="bg-globus-blue h-1.5 rounded-full"
                      style={{
                        width: `${project.progress}%`
                      }}>
                    </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <button className="text-sm font-semibold text-gray-500 hover:text-globus-blue flex items-center gap-1">
                        <EditIcon className="w-4 h-4" /> Modifier
                      </button>
                      <button
                    onClick={() => {
                      setItemToDelete(project);
                      setShowDeleteModal(true);
                    }}
                    className="text-sm font-semibold text-gray-400 hover:text-red-500 flex items-center gap-1">
                    
                        <Trash2Icon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
            )}
            </div>
          </motion.div>
        }

        {/* TAB 3: SERVICES */}
        {activeTab === 'services' &&
        <motion.div
          key="services"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="space-y-6">
          
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Services Proposés
                </h3>
                <button
                onClick={() =>
                showToast(
                  'Fonctionnalité en cours de développement',
                  'info'
                )
                }
                className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center gap-2 text-sm">
                
                  <PlusIcon className="w-4 h-4" /> Ajouter un Service
                </button>
              </div>

              <div className="space-y-3">
                {servicesData.map((service) =>
              <div
                key={service.id}
                className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg bg-white hover:border-globus-blue/50 transition-colors group">
                
                    <div className="cursor-grab text-gray-300 hover:text-gray-500">
                      <GripVerticalIcon className="w-5 h-5" />
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-globus-blue-dark flex items-center justify-center shrink-0">
                      <BriefcaseIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-montserrat font-bold text-gray-800">
                        {service.title}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {service.subtitle}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700">
                        {service.status}
                      </span>
                      <button className="p-2 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded transition-colors">
                        <EditIcon className="w-4 h-4" />
                      </button>
                      <button
                    onClick={() => {
                      setItemToDelete(service);
                      setShowDeleteModal(true);
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                    
                        <Trash2Icon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
              )}
              </div>
            </motion.div>
          </motion.div>
        }

        {/* TAB 4: TEAM & TESTIMONIALS */}
        {activeTab === 'team' &&
        <motion.div
          key="team"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Équipe Dirigeante
                </h3>
                <button className="text-sm font-semibold text-globus-blue hover:underline flex items-center gap-1">
                  <PlusIcon className="w-4 h-4" /> Ajouter
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {teamData.map((member) =>
              <div
                key={member.id}
                className="border border-gray-100 rounded-lg p-4 text-center relative group hover:border-globus-blue/30 transition-colors">
                
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button className="p-1 text-gray-400 hover:text-globus-blue">
                        <EditIcon className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2Icon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="w-16 h-16 mx-auto bg-gray-200 rounded-full mb-3 flex items-center justify-center">
                      <UsersIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <h4 className="font-montserrat font-bold text-sm text-gray-800">
                      {member.name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">{member.role}</p>
                  </div>
              )}
              </div>
            </motion.div>

            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Témoignages Clients
                </h3>
                <button className="text-sm font-semibold text-globus-blue hover:underline flex items-center gap-1">
                  <PlusIcon className="w-4 h-4" /> Ajouter
                </button>
              </div>
              <div className="space-y-4">
                {testimonialsData.map((testi) =>
              <div
                key={testi.id}
                className="border border-gray-100 rounded-lg p-4 bg-gray-50/50">
                
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-montserrat font-bold text-sm text-gray-800">
                          {testi.name}
                        </h4>
                        <p className="text-xs text-gray-500">{testi.role}</p>
                      </div>
                      <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${testi.status === 'Publié' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                    
                        {testi.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 italic">
                      "{testi.quote}"
                    </p>
                    <div className="flex justify-end gap-2 mt-3">
                      <button className="text-xs font-semibold text-gray-500 hover:text-globus-blue">
                        Modifier
                      </button>
                      <button className="text-xs font-semibold text-gray-400 hover:text-red-500">
                        Supprimer
                      </button>
                    </div>
                  </div>
              )}
              </div>
            </motion.div>
          </motion.div>
        }

        {/* TAB 5: FAQ & CONTACT */}
        {activeTab === 'faq' &&
        <motion.div
          key="faq"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Foire Aux Questions
                </h3>
                <button className="text-sm font-semibold text-globus-blue hover:underline flex items-center gap-1">
                  <PlusIcon className="w-4 h-4" /> Ajouter
                </button>
              </div>
              <div className="space-y-3">
                {faqData.map((faq) =>
              <div
                key={faq.id}
                className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors group">
                
                    <GripVerticalIcon className="w-4 h-4 text-gray-300 mt-1 cursor-grab" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-gray-800">
                        {faq.question}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${faq.status === 'Publié' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                      
                          {faq.status}
                        </span>
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button className="p-1 text-gray-400 hover:text-globus-blue">
                        <EditIcon className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2Icon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
              )}
              </div>
            </motion.div>

            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            
              <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark mb-6 flex items-center gap-2">
                <MailIcon className="w-5 h-5 text-gray-400" />
                Soumissions Formulaire Contact
              </h3>
              <div className="space-y-3">
                {contactData.map((msg) =>
              <div
                key={msg.id}
                className={`p-4 rounded-lg border ${msg.status === 'Nouveau' ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100 bg-white'}`}>
                
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        {msg.status === 'Nouveau' &&
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    }
                        <h4 className="font-montserrat font-bold text-sm text-gray-800">
                          {msg.name}
                        </h4>
                      </div>
                      <span className="text-xs text-gray-500">{msg.date}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{msg.email}</p>
                    <p className="text-sm font-semibold text-gray-700 mb-3">
                      {msg.subject}
                    </p>
                    <div className="flex justify-between items-center">
                      <span
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${msg.status === 'Nouveau' ? 'bg-blue-100 text-blue-700' : msg.status === 'Répondu' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    
                        {msg.status}
                      </span>
                      <button
                    onClick={() => {
                      setPreviewItem(msg);
                      setShowPreviewModal(true);
                    }}
                    className="text-xs font-semibold text-globus-blue hover:underline">
                    
                        Voir le message
                      </button>
                    </div>
                  </div>
              )}
              </div>
            </motion.div>
          </motion.div>
        }

        {/* TAB 6: ACCUEIL & SECTIONS */}
        {activeTab === 'homepage' &&
        <motion.div
          key="homepage"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="space-y-4">
          
            {/* Hero Carousel */}
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            
              <button
              onClick={() => toggleSection('hero')}
              className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
              
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-globus-blue-dark flex items-center justify-center">
                    <PlayCircleIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      Hero Carousel
                    </h3>
                    <p className="text-xs text-gray-500">
                      {heroSlidesData.length} slides • Vidéo d'intro:{' '}
                      {heroVideoData.duration}s
                    </p>
                  </div>
                </div>
                <ChevronDownIcon
                className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'hero' ? 'rotate-180' : ''}`} />
              
              </button>
              {expandedSection === 'hero' &&
            <div className="p-5 border-t border-gray-100 space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-montserrat font-bold text-sm text-gray-700 mb-3">
                      Vidéo d'introduction
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          URL Vidéo
                        </label>
                        <div className="flex gap-2">
                          <input
                        type="text"
                        defaultValue={heroVideoData.url}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                      
                          <button
                        onClick={() => {
                          setMediaFilter('video');
                          setShowMediaPicker(true);
                          setMediaPickerCallback(
                            () => (url: string) =>
                            console.log('Selected:', url)
                          );
                        }}
                        className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors"
                        title="Choisir depuis la médiathèque">
                        
                            <FolderOpenIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          Image Poster
                        </label>
                        <div className="flex gap-2">
                          <input
                        type="text"
                        defaultValue={heroVideoData.poster}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                      
                          <button
                        onClick={() => {
                          setMediaFilter('image');
                          setShowMediaPicker(true);
                          setMediaPickerCallback(
                            () => (url: string) =>
                            console.log('Selected:', url)
                          );
                        }}
                        className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors"
                        title="Choisir depuis la médiathèque">
                        
                            <FolderOpenIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          Durée (sec)
                        </label>
                        <input
                      type="number"
                      defaultValue={heroVideoData.duration}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                    
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <h4 className="font-montserrat font-bold text-sm text-gray-700">
                      Slides du Carousel
                    </h4>
                    <button
                  onClick={() => showToast('Nouveau slide ajouté', 'info')}
                  className="text-sm font-semibold text-globus-orange hover:underline flex items-center gap-1">
                  
                      <PlusIcon className="w-4 h-4" /> Ajouter
                    </button>
                  </div>
                  <div className="space-y-3">
                    {heroSlidesData.map((slide) =>
                <div
                  key={slide.id}
                  className="border border-gray-200 rounded-lg p-4 bg-white hover:border-globus-blue/30 transition-colors">
                  
                        <div className="flex items-start gap-4">
                          <GripVerticalIcon className="w-5 h-5 text-gray-300 mt-1 cursor-grab shrink-0" />
                          <img
                      src={slide.image}
                      alt=""
                      className="w-20 h-14 object-cover rounded-lg shrink-0" />
                    
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 bg-globus-orange/10 text-globus-orange rounded text-[10px] font-bold">
                                {slide.tag}
                              </span>
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold uppercase">
                                {slide.status}
                              </span>
                            </div>
                            <h5 className="font-montserrat font-bold text-sm text-gray-800 truncate">
                              {slide.title}
                            </h5>
                            <p className="text-xs text-gray-500 truncate">
                              {slide.subtitle}
                            </p>
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] text-gray-400">
                                CTA1: {slide.cta1Text}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                CTA2: {slide.cta2Text}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                        onClick={() => {
                          setEditItem(slide);
                          setShowEditModal(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded">
                        
                              <EditIcon className="w-4 h-4" />
                            </button>
                            <button
                        onClick={() => {
                          setItemToDelete(slide);
                          setShowDeleteModal(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                        
                              <Trash2Icon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                )}
                  </div>
                  <div className="flex justify-end">
                    <button
                  onClick={handleSaveGeneric}
                  disabled={isProcessing === 'save-generic'}
                  className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2 disabled:opacity-70">
                  
                      {isProcessing === 'save-generic' ?
                  <>
                          <Loader2Icon className="w-4 h-4 animate-spin" />{' '}
                          Enregistrement...
                        </> :

                  <>
                          <SaveIcon className="w-4 h-4" /> Enregistrer
                        </>
                  }
                    </button>
                  </div>
                </div>
            }
            </motion.div>

            {/* Engagements Bar */}
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            
              <button
              onClick={() => toggleSection('engagements')}
              className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
              
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-globus-orange flex items-center justify-center">
                    <ShieldCheckIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      Barre d'Engagements
                    </h3>
                    <p className="text-xs text-gray-500">
                      {engagementsData.length} engagements
                    </p>
                  </div>
                </div>
                <ChevronDownIcon
                className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'engagements' ? 'rotate-180' : ''}`} />
              
              </button>
              {expandedSection === 'engagements' &&
            <div className="p-5 border-t border-gray-100 space-y-3">
                  {engagementsData.map((eng) =>
              <div
                key={eng.id}
                className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-globus-blue/30 transition-colors">
                
                      <GripVerticalIcon className="w-5 h-5 text-gray-300 cursor-grab" />
                      <div className="flex-1">
                        <h4 className="font-montserrat font-bold text-sm text-gray-800">
                          {eng.title}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {eng.description}
                        </p>
                      </div>
                      <span
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${eng.bgColor === 'blue' ? 'bg-blue-100 text-blue-700' : eng.bgColor === 'orange' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                  
                        {eng.bgColor}
                      </span>
                      <button
                  onClick={() => {
                    setEditItem(eng);
                    setShowEditModal(true);
                  }}
                  className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded">
                  
                        <EditIcon className="w-4 h-4" />
                      </button>
                    </div>
              )}
                  <div className="flex justify-end">
                    <button
                  onClick={handleSaveGeneric}
                  className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                  
                      <SaveIcon className="w-4 h-4" /> Enregistrer
                    </button>
                  </div>
                </div>
            }
            </motion.div>

            {/* About Section */}
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            
              <button
              onClick={() => toggleSection('about')}
              className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
              
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-globus-blue flex items-center justify-center">
                    <FileTextIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      Section À Propos
                    </h3>
                    <p className="text-xs text-gray-500">
                      Texte, points clés, badge, images
                    </p>
                  </div>
                </div>
                <ChevronDownIcon
                className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'about' ? 'rotate-180' : ''}`} />
              
              </button>
              {expandedSection === 'about' &&
            <div className="p-5 border-t border-gray-100 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Paragraphe 1
                    </label>
                    <textarea
                  defaultValue={aboutSectionData.paragraph1}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />
                
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Paragraphe 2
                    </label>
                    <textarea
                  defaultValue={aboutSectionData.paragraph2}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />
                
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Badge
                    </label>
                    <input
                  type="text"
                  defaultValue={aboutSectionData.badgeText}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Points Clés
                    </label>
                    {aboutSectionData.bulletPoints.map((bp, i) =>
                <div key={i} className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-400 w-4">
                          {i + 1}.
                        </span>
                        <input
                    type="text"
                    defaultValue={bp}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-globus-blue" />
                  
                        <button className="p-1 text-gray-400 hover:text-red-500">
                          <Trash2Icon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                )}
                    <button className="text-xs text-globus-orange font-semibold hover:underline flex items-center gap-1 mt-1">
                      <PlusIcon className="w-3.5 h-3.5" /> Ajouter
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Images Carousel
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {aboutSectionData.images.map((img, i) =>
                  <div key={i} className="relative group">
                          <img
                      src={img}
                      alt=""
                      className="w-20 h-14 object-cover rounded-lg border border-gray-200" />
                    
                          <button className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <XIcon className="w-3 h-3" />
                          </button>
                        </div>
                  )}
                      <button
                    onClick={() => {
                      setMediaFilter('image');
                      setShowMediaPicker(true);
                      setMediaPickerCallback(
                        () => (url: string) =>
                        console.log('Selected:', url)
                      );
                    }}
                    className="w-20 h-14 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-globus-orange hover:text-globus-orange transition-colors"
                    title="Choisir depuis la médiathèque">
                    
                        <FolderOpenIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                  onClick={handleSaveGeneric}
                  className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                  
                      <SaveIcon className="w-4 h-4" /> Enregistrer
                    </button>
                  </div>
                </div>
            }
            </motion.div>

            {/* Methodology */}
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            
              <button
              onClick={() => toggleSection('methodology')}
              className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
              
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
                    <HashIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      Méthodologie
                    </h3>
                    <p className="text-xs text-gray-500">
                      {methodologyData.length} étapes
                    </p>
                  </div>
                </div>
                <ChevronDownIcon
                className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'methodology' ? 'rotate-180' : ''}`} />
              
              </button>
              {expandedSection === 'methodology' &&
            <div className="p-5 border-t border-gray-100 space-y-3">
                  {methodologyData.map((step) =>
              <div
                key={step.id}
                className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-globus-blue/30 transition-colors">
                
                      <GripVerticalIcon className="w-5 h-5 text-gray-300 cursor-grab" />
                      <div className="w-8 h-8 rounded-full bg-globus-blue-dark flex items-center justify-center shrink-0">
                        <span className="text-white font-bold text-sm">
                          {step.id}
                        </span>
                      </div>
                      <img
                  src={step.image}
                  alt=""
                  className="w-16 h-12 object-cover rounded-lg shrink-0" />
                
                      <div className="flex-1 min-w-0">
                        <h4 className="font-montserrat font-bold text-sm text-gray-800">
                          {step.title}
                        </h4>
                        <p className="text-xs text-gray-500 truncate">
                          {step.description}
                        </p>
                      </div>
                      <button
                  onClick={() => {
                    setEditItem(step);
                    setShowEditModal(true);
                  }}
                  className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded">
                  
                        <EditIcon className="w-4 h-4" />
                      </button>
                    </div>
              )}
                  <div className="flex justify-end">
                    <button
                  onClick={handleSaveGeneric}
                  className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                  
                      <SaveIcon className="w-4 h-4" /> Enregistrer
                    </button>
                  </div>
                </div>
            }
            </motion.div>

            {/* Stats Bar */}
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            
              <button
              onClick={() => toggleSection('stats')}
              className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
              
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
                    <StarIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      Barre de Statistiques
                    </h3>
                    <p className="text-xs text-gray-500">
                      {statsBarData.length} chiffres clés
                    </p>
                  </div>
                </div>
                <ChevronDownIcon
                className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'stats' ? 'rotate-180' : ''}`} />
              
              </button>
              {expandedSection === 'stats' &&
            <div className="p-5 border-t border-gray-100">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {statsBarData.map((stat) =>
                <div
                  key={stat.id}
                  className="border border-gray-200 rounded-lg p-4 text-center">
                  
                        <input
                    type="text"
                    defaultValue={stat.value}
                    className="w-full text-center text-2xl font-montserrat font-bold text-globus-blue-dark border-b border-gray-200 pb-2 mb-2 focus:outline-none focus:border-globus-orange" />
                  
                        <input
                    type="text"
                    defaultValue={stat.label}
                    className="w-full text-center text-sm text-gray-500 focus:outline-none focus:border-globus-orange" />
                  
                      </div>
                )}
                  </div>
                  <div className="flex justify-end mt-4">
                    <button
                  onClick={handleSaveGeneric}
                  className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                  
                      <SaveIcon className="w-4 h-4" /> Enregistrer
                    </button>
                  </div>
                </div>
            }
            </motion.div>

            {/* Guarantees */}
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            
              <button
              onClick={() => toggleSection('guarantees')}
              className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
              
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
                    <ShieldCheckIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      Garanties
                    </h3>
                    <p className="text-xs text-gray-500">
                      {guaranteesData.length} garanties
                    </p>
                  </div>
                </div>
                <ChevronDownIcon
                className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'guarantees' ? 'rotate-180' : ''}`} />
              
              </button>
              {expandedSection === 'guarantees' &&
            <div className="p-5 border-t border-gray-100 space-y-3">
                  {guaranteesData.map((g) =>
              <div
                key={g.id}
                className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-globus-blue/30 transition-colors">
                
                      <GripVerticalIcon className="w-5 h-5 text-gray-300 cursor-grab" />
                      <div className="flex-1">
                        <h4 className="font-montserrat font-bold text-sm text-gray-800">
                          {g.title}
                        </h4>
                        <p className="text-xs text-gray-500">{g.description}</p>
                      </div>
                      <button
                  onClick={() => {
                    setEditItem(g);
                    setShowEditModal(true);
                  }}
                  className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded">
                  
                        <EditIcon className="w-4 h-4" />
                      </button>
                    </div>
              )}
                  <div className="flex justify-end">
                    <button
                  onClick={handleSaveGeneric}
                  className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                  
                      <SaveIcon className="w-4 h-4" /> Enregistrer
                    </button>
                  </div>
                </div>
            }
            </motion.div>

            {/* Video Section */}
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            
              <button
              onClick={() => toggleSection('video')}
              className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
              
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center">
                    <VideoIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      Section Vidéo
                    </h3>
                    <p className="text-xs text-gray-500">
                      YouTube + texte d'accroche
                    </p>
                  </div>
                </div>
                <ChevronDownIcon
                className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'video' ? 'rotate-180' : ''}`} />
              
              </button>
              {expandedSection === 'video' &&
            <div className="p-5 border-t border-gray-100 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      URL YouTube (embed)
                    </label>
                    <div className="flex gap-2">
                      <input
                    type="text"
                    defaultValue={videoSectionData.youtubeUrl}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                  
                      <button
                    onClick={() => {
                      setMediaFilter('video');
                      setShowMediaPicker(true);
                      setMediaPickerCallback(
                        () => (url: string) =>
                        console.log('Selected:', url)
                      );
                    }}
                    className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors shrink-0"
                    title="Choisir depuis la médiathèque">
                    
                        <FolderOpenIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Titre
                      </label>
                      <input
                    type="text"
                    defaultValue={videoSectionData.title}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                  
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Sous-titre
                      </label>
                      <input
                    type="text"
                    defaultValue={videoSectionData.subtitle}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                  
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                  onClick={handleSaveGeneric}
                  className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                  
                      <SaveIcon className="w-4 h-4" /> Enregistrer
                    </button>
                  </div>
                </div>
            }
            </motion.div>

            {/* Partners */}
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            
              <button
              onClick={() => toggleSection('partners')}
              className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
              
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
                    <HandshakeIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      Partenaires
                    </h3>
                    <p className="text-xs text-gray-500">
                      {partnersData.length} partenaires
                    </p>
                  </div>
                </div>
                <ChevronDownIcon
                className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'partners' ? 'rotate-180' : ''}`} />
              
              </button>
              {expandedSection === 'partners' &&
            <div className="p-5 border-t border-gray-100">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {partnersData.map((p) =>
                <div
                  key={p.id}
                  className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full group">
                  
                        <span className="text-sm font-semibold text-gray-700">
                          {p.name}
                        </span>
                        <button className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                )}
                    <button
                  onClick={() => showToast('Partenaire ajouté', 'info')}
                  className="flex items-center gap-1 bg-globus-orange/10 text-globus-orange px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-globus-orange/20">
                  
                      <PlusIcon className="w-3.5 h-3.5" /> Ajouter
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button
                  onClick={handleSaveGeneric}
                  className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                  
                      <SaveIcon className="w-4 h-4" /> Enregistrer
                    </button>
                  </div>
                </div>
            }
            </motion.div>

            {/* CTA Banner */}
            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            
              <button
              onClick={() => toggleSection('cta')}
              className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
              
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-globus-orange flex items-center justify-center">
                    <TypeIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-montserrat font-bold text-globus-blue-dark">
                      Bannière CTA
                    </h3>
                    <p className="text-xs text-gray-500">Appel à l'action</p>
                  </div>
                </div>
                <ChevronDownIcon
                className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'cta' ? 'rotate-180' : ''}`} />
              
              </button>
              {expandedSection === 'cta' &&
            <div className="p-5 border-t border-gray-100 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Titre
                    </label>
                    <input
                  type="text"
                  defaultValue={ctaBannerData.title}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Sous-titre
                    </label>
                    <input
                  type="text"
                  defaultValue={ctaBannerData.subtitle}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Texte du bouton
                      </label>
                      <input
                    type="text"
                    defaultValue={ctaBannerData.buttonText}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                  
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Lien du bouton
                      </label>
                      <input
                    type="text"
                    defaultValue={ctaBannerData.buttonLink}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                  
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                  onClick={handleSaveGeneric}
                  className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                  
                      <SaveIcon className="w-4 h-4" /> Enregistrer
                    </button>
                  </div>
                </div>
            }
            </motion.div>
          </motion.div>
        }

        {/* TAB 7: PARAMÈTRES SITE */}
        {activeTab === 'settings' &&
        <motion.div
          key="settings"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="space-y-6">
          
            <motion.div
            variants={fadeUp}
            className="flex gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            
              {[
            {
              id: 'header',
              label: 'En-tête',
              icon: LayoutDashboardIcon
            },
            {
              id: 'footer',
              label: 'Pied de page',
              icon: FileTextIcon
            },
            {
              id: 'seo',
              label: 'SEO & Méta',
              icon: SearchIcon
            },
            {
              id: 'social',
              label: 'Réseaux Sociaux',
              icon: LinkIcon
            }].
            map((t) =>
            <button
              key={t.id}
              onClick={() => setActiveSettingsTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-montserrat font-semibold transition-colors whitespace-nowrap ${activeSettingsTab === t.id ? 'bg-globus-blue-dark text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </button>
            )}
            </motion.div>

            {activeSettingsTab === 'header' &&
          <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Paramètres de l'En-tête
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    URL du Logo
                  </label>
                  <div className="flex gap-3 items-center">
                    <div className="flex-1 flex gap-2">
                      <input
                    type="text"
                    defaultValue={headerSettingsData.logoUrl}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                  
                      <button
                    onClick={() => {
                      setMediaFilter('image');
                      setShowMediaPicker(true);
                      setMediaPickerCallback(
                        () => (url: string) =>
                        console.log('Selected:', url)
                      );
                    }}
                    className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors"
                    title="Choisir depuis la médiathèque">
                    
                        <FolderOpenIcon className="w-5 h-5" />
                      </button>
                    </div>
                    <img
                  src={headerSettingsData.logoUrl}
                  alt="Logo"
                  className="h-10 bg-white border rounded p-1" />
                
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Téléphone
                    </label>
                    <input
                  type="text"
                  defaultValue={headerSettingsData.phone}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Email
                    </label>
                    <input
                  type="text"
                  defaultValue={headerSettingsData.email}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Horaires
                    </label>
                    <input
                  type="text"
                  defaultValue={headerSettingsData.hours}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                onClick={handleSaveGeneric}
                className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                
                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
          }

            {activeSettingsTab === 'footer' &&
          <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Paramètres du Pied de Page
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Description entreprise
                  </label>
                  <textarea
                defaultValue={footerSettingsData.description}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />
              
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Adresse
                    </label>
                    <input
                  type="text"
                  defaultValue={footerSettingsData.address}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Téléphone
                    </label>
                    <input
                  type="text"
                  defaultValue={footerSettingsData.phone}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Email
                    </label>
                    <input
                  type="text"
                  defaultValue={footerSettingsData.email}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <input
                type="checkbox"
                defaultChecked={footerSettingsData.newsletterEnabled}
                className="w-4 h-4 accent-globus-orange" />
              
                  <span className="text-sm font-semibold text-gray-700">
                    Activer le formulaire Newsletter
                  </span>
                </div>
                <div className="flex justify-end">
                  <button
                onClick={handleSaveGeneric}
                className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                
                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
          }

            {activeSettingsTab === 'seo' &&
          <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  SEO & Métadonnées
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Meta Title
                  </label>
                  <input
                type="text"
                defaultValue={seoSettingsData.metaTitle}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
              
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Meta Description
                  </label>
                  <textarea
                defaultValue={seoSettingsData.metaDescription}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />
              
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Image OG
                  </label>
                  <div className="flex gap-2">
                    <input
                  type="text"
                  defaultValue={seoSettingsData.ogImage}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                    <button
                  onClick={() => {
                    setMediaFilter('image');
                    setShowMediaPicker(true);
                    setMediaPickerCallback(
                      () => (url: string) => console.log('Selected:', url)
                    );
                  }}
                  className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors shrink-0"
                  title="Choisir depuis la médiathèque">
                  
                      <FolderOpenIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                onClick={handleSaveGeneric}
                className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                
                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
          }

            {activeSettingsTab === 'social' &&
          <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Réseaux Sociaux
                </h3>
                {[
            {
              icon: FacebookIcon,
              label: 'Facebook',
              value: footerSettingsData.facebook,
              color: 'text-[#4267B2]'
            },
            {
              icon: TwitterIcon,
              label: 'Twitter / X',
              value: footerSettingsData.twitter,
              color: 'text-[#1DA1F2]'
            },
            {
              icon: LinkedinIcon,
              label: 'LinkedIn',
              value: footerSettingsData.linkedin,
              color: 'text-[#0077b5]'
            },
            {
              icon: InstagramIcon,
              label: 'Instagram',
              value: footerSettingsData.instagram,
              color: 'text-[#E4405F]'
            }].
            map((s, i) =>
            <div key={i} className="flex items-center gap-3">
                    <s.icon className={`w-6 h-6 ${s.color} shrink-0`} />
                    <label className="w-24 text-sm font-semibold text-gray-700 shrink-0">
                      {s.label}
                    </label>
                    <input
                type="text"
                defaultValue={s.value}
                placeholder="https://..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
              
                  </div>
            )}
                <div className="flex justify-end">
                  <button
                onClick={handleSaveGeneric}
                className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                
                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
          }
          </motion.div>
        }

        {/* TAB 8: PAGES PUBLIQUES */}
        {activeTab === 'pages' &&
        <motion.div
          key="pages"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="space-y-6">
          
            <motion.div
            variants={fadeUp}
            className="flex gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            
              {[
            {
              id: 'about',
              label: 'Page À Propos'
            },
            {
              id: 'contact',
              label: 'Page Contact'
            },
            {
              id: 'faqpage',
              label: 'FAQ Complète'
            },
            {
              id: 'helpcenter',
              label: "Centre d'Aide"
            }].
            map((t) =>
            <button
              key={t.id}
              onClick={() => setActivePagesTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-montserrat font-semibold transition-colors whitespace-nowrap ${activePagesTab === t.id ? 'bg-globus-blue-dark text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              
                  {t.label}
                </button>
            )}
            </motion.div>

            {activePagesTab === 'about' &&
          <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Page À Propos
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Image Hero Banner
                  </label>
                  <div className="flex gap-3 items-center">
                    <div className="flex-1 flex gap-2">
                      <input
                    type="text"
                    defaultValue={aboutPageData.heroImage}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                  
                      <button
                    onClick={() => {
                      setMediaFilter('image');
                      setShowMediaPicker(true);
                      setMediaPickerCallback(
                        () => (url: string) =>
                        console.log('Selected:', url)
                      );
                    }}
                    className="p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 hover:bg-globus-orange hover:text-white hover:border-globus-orange transition-colors"
                    title="Choisir depuis la médiathèque">
                    
                        <FolderOpenIcon className="w-5 h-5" />
                      </button>
                    </div>
                    <img
                  src={aboutPageData.heroImage}
                  alt=""
                  className="h-12 rounded" />
                
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Titre
                  </label>
                  <input
                type="text"
                defaultValue={aboutPageData.historyTitle}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
              
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Paragraphe 1
                  </label>
                  <textarea
                defaultValue={aboutPageData.historyP1}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />
              
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Paragraphe 2
                  </label>
                  <textarea
                defaultValue={aboutPageData.historyP2}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />
              
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">
                    Valeurs ({aboutPageData.values.length})
                  </label>
                  {aboutPageData.values.map((v, i) =>
              <div
                key={i}
                className="flex gap-3 mb-3 p-3 border border-gray-200 rounded-lg">
                
                      <div className="flex-1">
                        <input
                    type="text"
                    defaultValue={v.title}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mb-1 focus:outline-none focus:border-globus-blue font-semibold" />
                  
                        <input
                    type="text"
                    defaultValue={v.desc}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-globus-blue" />
                  
                      </div>
                      <button className="p-1.5 text-gray-400 hover:text-red-500 self-center">
                        <Trash2Icon className="w-4 h-4" />
                      </button>
                    </div>
              )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">
                    Certifications ({aboutPageData.certifications.length})
                  </label>
                  {aboutPageData.certifications.map((c, i) =>
              <div key={i} className="flex items-center gap-2 mb-2">
                      <CheckCircle2Icon className="w-4 h-4 text-globus-orange shrink-0" />
                      <input
                  type="text"
                  defaultValue={c}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-globus-blue" />
                
                      <button className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2Icon className="w-3.5 h-3.5" />
                      </button>
                    </div>
              )}
                  <button className="text-xs text-globus-orange font-semibold hover:underline flex items-center gap-1 mt-1">
                    <PlusIcon className="w-3.5 h-3.5" /> Ajouter
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                onClick={handleSaveGeneric}
                className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                
                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
          }

            {activePagesTab === 'contact' &&
          <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Page Contact
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Adresse
                    </label>
                    <textarea
                  defaultValue={contactPageData.address}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />
                
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Tél. Standard
                      </label>
                      <input
                    type="text"
                    defaultValue={contactPageData.phoneStandard}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                  
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        WhatsApp
                      </label>
                      <input
                    type="text"
                    defaultValue={contactPageData.phoneWhatsApp}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                  
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Email Contact
                    </label>
                    <input
                  type="text"
                  defaultValue={contactPageData.emailContact}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Email Devis
                    </label>
                    <input
                  type="text"
                  defaultValue={contactPageData.emailDevis}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Horaires semaine
                    </label>
                    <input
                  type="text"
                  defaultValue={contactPageData.hoursWeekday}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Horaires samedi
                    </label>
                    <input
                  type="text"
                  defaultValue={contactPageData.hoursSaturday}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    URL Google Maps (embed)
                  </label>
                  <input
                type="text"
                defaultValue={contactPageData.mapUrl}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
              
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">
                    Options formulaire
                  </label>
                  {contactPageData.formSubjects.map((s, i) =>
              <div key={i} className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-400 w-4">
                        {i + 1}.
                      </span>
                      <input
                  type="text"
                  defaultValue={s}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-globus-blue" />
                
                      <button className="p-1 text-gray-400 hover:text-red-500">
                        <Trash2Icon className="w-3.5 h-3.5" />
                      </button>
                    </div>
              )}
                  <button className="text-xs text-globus-orange font-semibold hover:underline flex items-center gap-1 mt-1">
                    <PlusIcon className="w-3.5 h-3.5" /> Ajouter
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                onClick={handleSaveGeneric}
                className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                
                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
          }

            {activePagesTab === 'faqpage' &&
          <motion.div variants={fadeUp} className="space-y-6">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    FAQ Complète —{' '}
                    {faqPageData.reduce((acc, c) => acc + c.items.length, 0)}{' '}
                    questions
                  </h3>
                  <button
                onClick={() => showToast('Catégorie ajoutée', 'info')}
                className="bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2">
                
                    <PlusIcon className="w-4 h-4" /> Catégorie
                  </button>
                </div>
                {faqPageData.map((cat) =>
            <div
              key={cat.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-montserrat font-bold text-globus-blue-dark flex items-center gap-2">
                        <div className="w-2 h-5 bg-globus-orange rounded-full"></div>
                        {cat.category}
                      </h4>
                      <button className="text-xs text-globus-orange font-semibold hover:underline flex items-center gap-1">
                        <PlusIcon className="w-3.5 h-3.5" /> Question
                      </button>
                    </div>
                    <div className="space-y-2">
                      {cat.items.map((item, idx) =>
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors group">
                  
                          <GripVerticalIcon className="w-4 h-4 text-gray-300 mt-1 cursor-grab" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-800">
                              {item.q}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 truncate">
                              {item.a}
                            </p>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 shrink-0">
                            <button className="p-1 text-gray-400 hover:text-globus-blue">
                              <EditIcon className="w-4 h-4" />
                            </button>
                            <button className="p-1 text-gray-400 hover:text-red-500">
                              <Trash2Icon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                )}
                    </div>
                  </div>
            )}
              </motion.div>
          }

            {activePagesTab === 'helpcenter' &&
          <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            
                <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                  Centre d'Aide
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Email Support
                    </label>
                    <input
                  type="text"
                  defaultValue={helpCenterData.supportEmail}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Numéro WhatsApp
                    </label>
                    <input
                  type="text"
                  defaultValue={helpCenterData.whatsappNumber}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Description carte FAQ
                  </label>
                  <textarea
                defaultValue={helpCenterData.faqDesc}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />
              
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Description carte WhatsApp
                  </label>
                  <textarea
                defaultValue={helpCenterData.whatsappDesc}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />
              
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Description carte Email
                  </label>
                  <textarea
                defaultValue={helpCenterData.emailDesc}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />
              
                </div>
                <div className="flex justify-end">
                  <button
                onClick={handleSaveGeneric}
                className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                
                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
          }
          </motion.div>
        }

        {/* TAB 9: PAGES LÉGALES */}
        {activeTab === 'legal' &&
        <motion.div
          key="legal"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="space-y-6">
          
            <motion.div
            variants={fadeUp}
            className="flex gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            
              {[
            {
              id: 'legalNotice',
              label: 'Mentions Légales'
            },
            {
              id: 'privacy',
              label: 'Confidentialité'
            },
            {
              id: 'terms',
              label: 'Termes & Conditions'
            },
            {
              id: 'cookies',
              label: 'Cookies'
            }].
            map((t) =>
            <button
              key={t.id}
              onClick={() => setActiveLegalTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-montserrat font-semibold transition-colors whitespace-nowrap ${activeLegalTab === t.id ? 'bg-globus-blue-dark text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              
                  {t.label}
                </button>
            )}
            </motion.div>

            {activeLegalTab === 'legalNotice' &&
          <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            
                <div className="flex justify-between items-center">
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    Mentions Légales
                  </h3>
                  <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    MAJ: {legalPagesData.legalNotice.lastUpdated}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Dénomination
                    </label>
                    <input
                  type="text"
                  defaultValue={legalPagesData.legalNotice.companyName}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Forme juridique
                    </label>
                    <input
                  type="text"
                  defaultValue={legalPagesData.legalNotice.legalForm}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      RCCM
                    </label>
                    <input
                  type="text"
                  defaultValue={legalPagesData.legalNotice.rccm}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Directeur
                    </label>
                    <input
                  type="text"
                  defaultValue={legalPagesData.legalNotice.director}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Siège social
                  </label>
                  <input
                type="text"
                defaultValue={legalPagesData.legalNotice.address}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
              
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Contact
                  </label>
                  <input
                type="text"
                defaultValue={legalPagesData.legalNotice.contact}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
              
                </div>
                <div className="border-t border-gray-100 pt-4">
                  <h4 className="font-montserrat font-bold text-sm text-gray-700 mb-3">
                    Hébergeur
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Nom
                      </label>
                      <input
                    type="text"
                    defaultValue={legalPagesData.legalNotice.hostName}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                  
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Adresse
                      </label>
                      <input
                    type="text"
                    defaultValue={legalPagesData.legalNotice.hostAddress}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                  
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Contenu complémentaire
                  </label>
                  <textarea
                rows={5}
                defaultValue="L'ensemble de ce site relève de la législation internationale sur le droit d'auteur et la propriété intellectuelle. Tous les droits de reproduction sont réservés."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />
              
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Date MAJ
                  </label>
                  <input
                type="text"
                defaultValue={legalPagesData.legalNotice.lastUpdated}
                className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
              
                </div>
                <div className="flex justify-end">
                  <button
                onClick={handleSaveGeneric}
                className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                
                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
          }

            {activeLegalTab === 'privacy' &&
          <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            
                <div className="flex justify-between items-center">
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    Politique de Confidentialité
                  </h3>
                  <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    MAJ: {legalPagesData.privacyPolicy.lastUpdated}
                  </span>
                </div>
                {[
            '1. Données collectées',
            '2. Finalité du traitement',
            '3. Base légale et durée',
            '4. Droits des utilisateurs',
            '5. Sécurité et Contact DPO'].
            map((title, i) =>
            <div key={i}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      {title}
                    </label>
                    <textarea
                rows={4}
                defaultValue={`Contenu de la section "${title}" — modifiable depuis le CMS.`}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />
              
                  </div>
            )}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Date MAJ
                  </label>
                  <input
                type="text"
                defaultValue={legalPagesData.privacyPolicy.lastUpdated}
                className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
              
                </div>
                <div className="flex justify-end">
                  <button
                onClick={handleSaveGeneric}
                className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                
                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
          }

            {activeLegalTab === 'terms' &&
          <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            
                <div className="flex justify-between items-center">
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    Termes & Conditions
                  </h3>
                  <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    MAJ: {legalPagesData.terms.lastUpdated}
                  </span>
                </div>
                {[
            '1. Objet',
            '2. Acceptation des CGU',
            '3. Services et Devis',
            '4. Responsabilités',
            '5. Droit applicable'].
            map((title, i) =>
            <div key={i}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      {title}
                    </label>
                    <textarea
                rows={4}
                defaultValue={`Contenu de la section "${title}" — modifiable depuis le CMS.`}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />
              
                  </div>
            )}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Date MAJ
                  </label>
                  <input
                type="text"
                defaultValue={legalPagesData.terms.lastUpdated}
                className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
              
                </div>
                <div className="flex justify-end">
                  <button
                onClick={handleSaveGeneric}
                className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                
                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
          }

            {activeLegalTab === 'cookies' &&
          <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            
                <div className="flex justify-between items-center">
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    Politique des Cookies
                  </h3>
                  <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    MAJ: {legalPagesData.cookiePolicy.lastUpdated}
                  </span>
                </div>
                {[
            "1. Qu'est-ce qu'un cookie ?",
            '2. Cookies utilisés',
            '3. Gestion des cookies',
            '4. Durée de conservation'].
            map((title, i) =>
            <div key={i}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      {title}
                    </label>
                    <textarea
                rows={4}
                defaultValue={`Contenu de la section "${title}" — modifiable depuis le CMS.`}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />
              
                  </div>
            )}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Date MAJ
                  </label>
                  <input
                type="text"
                defaultValue={legalPagesData.cookiePolicy.lastUpdated}
                className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
              
                </div>
                <div className="flex justify-end">
                  <button
                onClick={handleSaveGeneric}
                className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                
                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
              </motion.div>
          }
          </motion.div>
        }

        {/* TAB 10: MÉDIATHÈQUE */}
        {activeTab === 'media' &&
        <motion.div
          key="media"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="space-y-6">
          
            <motion.div
            variants={fadeUp}
            className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    Total Fichiers
                  </p>
                  <p className="text-2xl font-montserrat font-bold text-globus-blue-dark">
                    {mediaData.length}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <FolderOpenIcon className="w-5 h-5 text-globus-blue" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    Images
                  </p>
                  <p className="text-2xl font-montserrat font-bold text-blue-600">
                    {mediaData.filter((m) => m.type === 'image').length}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-blue-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    Vidéos
                  </p>
                  <p className="text-2xl font-montserrat font-bold text-purple-600">
                    {mediaData.filter((m) => m.type === 'video').length}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                  <VideoIcon className="w-5 h-5 text-purple-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase">
                    Documents
                  </p>
                  <p className="text-2xl font-montserrat font-bold text-orange-600">
                    {mediaData.filter((m) => m.type === 'document').length}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                  <FileIcon className="w-5 h-5 text-orange-500" />
                </div>
              </div>
            </motion.div>

            <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            
              <div className="p-5 border-b border-gray-100 flex flex-col lg:flex-row gap-4 justify-between items-center">
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                  <div className="relative w-full sm:w-64">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                    type="text"
                    placeholder="Rechercher un fichier..."
                    value={mediaSearch}
                    onChange={(e) => setMediaSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-globus-blue" />
                  
                  </div>
                  <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto hide-scrollbar">
                    {[
                  {
                    id: 'all',
                    label: 'Tous'
                  },
                  {
                    id: 'image',
                    label: 'Images'
                  },
                  {
                    id: 'video',
                    label: 'Vidéos'
                  }].
                  map((f) =>
                  <button
                    key={f.id}
                    onClick={() => setMediaFilter(f.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${mediaFilter === f.id ? 'bg-gray-100 text-globus-blue-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    
                        {f.label}
                      </button>
                  )}
                  </div>
                </div>
                <button
                onClick={() =>
                showToast(
                  'Fonctionnalité en cours de développement',
                  'info'
                )
                }
                className="w-full sm:w-auto bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-2 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 text-sm whitespace-nowrap">
                
                  <PlusIcon className="w-4 h-4" /> Ajouter un fichier
                </button>
              </div>

              <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center bg-white hover:bg-gray-50 hover:border-globus-blue/50 transition-colors cursor-pointer">
                  <UploadCloudIcon className="w-10 h-10 text-gray-400 mb-3" />
                  <p className="text-sm text-gray-700 font-semibold mb-1 text-center">
                    Glissez vos fichiers ici ou cliquez pour parcourir
                  </p>
                  <p className="text-xs text-gray-400 text-center">
                    Images, Vidéos, Audio, Documents (Max 50MB)
                  </p>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {mediaData.
                filter(
                  (m) => mediaFilter === 'all' || m.type === mediaFilter
                ).
                filter((m) =>
                m.name.toLowerCase().includes(mediaSearch.toLowerCase())
                ).
                map((media) =>
                <div
                  key={media.id}
                  className="group border border-gray-200 rounded-xl overflow-hidden bg-white hover:border-globus-blue/30 hover:shadow-md transition-all">
                  
                        <div className="h-32 bg-gray-100 relative flex items-center justify-center overflow-hidden">
                          {media.type === 'image' ?
                    <img
                      src={media.url}
                      alt={media.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> :

                    media.type === 'video' ?
                    <div className="w-full h-full flex items-center justify-center">
                              <VideoIcon className="w-12 h-12 text-gray-400" />
                            </div> :

                    <div className="w-full h-full flex items-center justify-center">
                              <FileIcon className="w-12 h-12 text-gray-400" />
                            </div>
                    }
                          <div className="absolute top-2 right-2">
                            <button
                        onClick={() => {
                          setEditItem(media);
                          setShowEditModal(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded transition-colors">
                        
                              <EditIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="p-3">
                          <h4 className="font-montserrat font-bold text-sm text-gray-800 truncate">
                            {media.name}
                          </h4>
                          <p className="text-xs text-gray-500 mt-1">
                            {media.size}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {media.uploadDate}
                          </p>
                          <div className="flex gap-1 mt-2">
                            <span className="text-xs text-gray-400">
                              {media.usageCount} utilisations
                            </span>
                            <span className="text-xs text-gray-400">
                              {media.type === 'image' ?
                        'Image' :
                        media.type === 'video' ?
                        'Vidéo' :
                        'Document'}
                            </span>
                          </div>
                        </div>
                      </div>
                )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        }

        {/* TAB 11: SEO & TRACKING */}
        {activeTab === 'seo' &&
        <motion.div
          key="seo"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={stagger}
          className="space-y-6">
          
            <motion.div
            variants={fadeUp}
            className="flex gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            
              {[
            {
              id: 'pages',
              label: 'SEO par Page',
              icon: GlobeIcon
            },
            {
              id: 'schema',
              label: 'Schema.org',
              icon: CodeIcon
            },
            {
              id: 'tracking',
              label: 'Tracking & Analytics',
              icon: BarChart3Icon
            },
            {
              id: 'sitemap',
              label: 'Sitemap XML',
              icon: MapIcon
            }].
            map((t) =>
            <button
              key={t.id}
              onClick={() => setActiveSeoTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-montserrat font-semibold transition-colors whitespace-nowrap ${activeSeoTab === t.id ? 'bg-globus-blue-dark text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </button>
            )}
            </motion.div>

            {activeSeoTab === 'pages' &&
          <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            
                <div className="flex justify-between items-center">
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    SEO par Page
                  </h3>
                  <button
                onClick={handleSaveGeneric}
                className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                
                    <SaveIcon className="w-4 h-4" /> Tout Enregistrer
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-montserrat font-bold text-gray-500 uppercase">
                        <th className="py-3 px-4">Page</th>
                        <th className="py-3 px-4">Chemin</th>
                        <th className="py-3 px-4">Titre SEO</th>
                        <th className="py-3 px-4">Statut</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm font-opensans">
                      {seoPageData.map((page) =>
                  <tr
                    key={page.id}
                    className="hover:bg-gray-50 transition-colors">
                    
                          <td className="py-3 px-4 font-semibold text-gray-800">
                            {page.page}
                          </td>
                          <td className="py-3 px-4 text-gray-500 font-mono text-xs">
                            {page.path}
                          </td>
                          <td className="py-3 px-4 text-gray-600 truncate max-w-[200px]">
                            {page.title}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700">
                              {page.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                        onClick={() => {
                          setEditItem(page);
                          setShowEditModal(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-globus-blue hover:bg-blue-50 rounded transition-colors"
                        title="Modifier">
                        
                              <EditIcon className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                  )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
          }

            {activeSeoTab === 'schema' &&
          <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            
                <div className="flex justify-between items-center">
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    Données Structurées (Schema.org LocalBusiness)
                  </h3>
                  <button
                onClick={handleSaveGeneric}
                className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                
                    <SaveIcon className="w-4 h-4" /> Enregistrer
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Nom de l'entreprise
                      </label>
                      <input
                    type="text"
                    defaultValue="Globus Engineering SARL"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                  
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Description
                      </label>
                      <textarea
                    rows={3}
                    defaultValue="Votre partenaire de confiance pour la construction BTP clé en main au Cameroun."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue resize-none" />
                  
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          Téléphone
                        </label>
                        <input
                      type="text"
                      defaultValue="+33 1 23 45 67 89"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                    
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          Email
                        </label>
                        <input
                      type="text"
                      defaultValue="contact@globus-btp.com"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                    
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Adresse complète
                      </label>
                      <input
                    type="text"
                    defaultValue="123 Avenue de la Construction"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue mb-2"
                    placeholder="Rue" />
                  
                      <div className="grid grid-cols-2 gap-2">
                        <input
                      type="text"
                      defaultValue="Douala"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue"
                      placeholder="Ville" />
                    
                        <input
                      type="text"
                      defaultValue="CM"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue"
                      placeholder="Pays (Code)" />
                    
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          Latitude
                        </label>
                        <input
                      type="text"
                      defaultValue="4.0511"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                    
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          Longitude
                        </label>
                        <input
                      type="text"
                      defaultValue="9.7679"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                    
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Horaires d'ouverture
                      </label>
                      <input
                    type="text"
                    defaultValue="Mo-Fr 08:00-18:00, Sa 09:00-13:00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                  
                    </div>
                  </div>
                </div>
              </motion.div>
          }

            {activeSeoTab === 'tracking' &&
          <motion.div variants={fadeUp} className="space-y-4">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    Tracking & Analytics
                  </h3>
                  <button
                onClick={handleSaveGeneric}
                className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                
                    <SaveIcon className="w-4 h-4" /> Tout Enregistrer
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* GA */}
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <BarChart3Icon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">
                            Google Analytics
                          </h4>
                          <p className="text-xs text-gray-500">gtag.js</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                      type="checkbox"
                      className="sr-only peer"
                      defaultChecked />
                    
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Measurement ID
                      </label>
                      <input
                    type="text"
                    defaultValue="G-DEMO123456"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                  
                    </div>
                  </div>
                  {/* GTM */}
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <TagIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">
                            Google Tag Manager
                          </h4>
                          <p className="text-xs text-gray-500">Container ID</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                      type="checkbox"
                      className="sr-only peer"
                      defaultChecked />
                    
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Container ID
                      </label>
                      <input
                    type="text"
                    defaultValue="GTM-DEMO123"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                  
                    </div>
                  </div>
                  {/* FB Pixel */}
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <FacebookIcon className="w-5 h-5 text-[#1877F2]" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">
                            Facebook Pixel
                          </h4>
                          <p className="text-xs text-gray-500">Meta Ads</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                      type="checkbox"
                      className="sr-only peer"
                      defaultChecked />
                    
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Pixel ID
                      </label>
                      <input
                    type="text"
                    defaultValue="123456789"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                  
                    </div>
                  </div>
                  {/* TikTok Pixel */}
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <span className="font-bold text-lg">🎵</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">
                            TikTok Pixel
                          </h4>
                          <p className="text-xs text-gray-500">TikTok Ads</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                      type="checkbox"
                      className="sr-only peer"
                      defaultChecked />
                    
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Pixel ID
                      </label>
                      <input
                    type="text"
                    defaultValue="DEMO123"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-globus-blue" />
                  
                    </div>
                  </div>
                </div>
              </motion.div>
          }

            {activeSeoTab === 'sitemap' &&
          <motion.div
            variants={fadeUp}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            
                <div className="flex justify-between items-center">
                  <h3 className="font-montserrat font-bold text-lg text-globus-blue-dark">
                    Sitemap XML
                  </h3>
                  <button
                onClick={() =>
                showToast('Sitemap régénéré avec succès', 'success')
                }
                className="px-4 py-2 bg-globus-orange hover:bg-globus-orange-hover text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                
                    <RefreshCwIcon className="w-4 h-4" /> Régénérer le Sitemap
                  </button>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-green-400 font-mono text-xs">
                    {`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.globus-btp.com/</loc>
    <lastmod>2026-03-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.globus-btp.com/a-propos</loc>
    <lastmod>2026-03-10</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <!-- ... autres pages ... -->
</urlset>`}
                  </pre>
                </div>
              </motion.div>
          }
          </motion.div>
        }
      </AnimatePresence>

      {/* Media Picker Modal */}
      <AnimatePresence>
        {showMediaPicker &&
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
            initial={{
              opacity: 0,
              scale: 0.95
            }}
            animate={{
              opacity: 1,
              scale: 1
            }}
            exit={{
              opacity: 0,
              scale: 0.95
            }}
            className="bg-white rounded-xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}>
            
              <div className="bg-globus-blue-dark p-4 flex justify-between items-center shrink-0">
                <h3 className="text-white font-montserrat font-bold text-lg flex items-center gap-2">
                  <FolderOpenIcon className="w-5 h-5" /> Sélectionner depuis la
                  Médiathèque
                </h3>
                <button
                onClick={() => {
                  setShowMediaPicker(false);
                  setMediaPickerCallback(null);
                }}
                className="text-white/70 hover:text-white transition-colors">
                
                  <XIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50 shrink-0">
                <div className="relative w-full sm:w-64">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                  type="text"
                  placeholder="Rechercher..."
                  value={mediaSearch}
                  onChange={(e) => setMediaSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-globus-blue" />
                
                </div>
                <div className="flex bg-white border border-gray-200 p-1 rounded-lg w-full sm:w-auto overflow-x-auto hide-scrollbar">
                  {[
                {
                  id: 'all',
                  label: 'Tous'
                },
                {
                  id: 'image',
                  label: 'Images'
                },
                {
                  id: 'video',
                  label: 'Vidéos'
                }].
                map((f) =>
                <button
                  key={f.id}
                  onClick={() => setMediaFilter(f.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${mediaFilter === f.id ? 'bg-gray-100 text-globus-blue-dark' : 'text-gray-500 hover:text-gray-700'}`}>
                  
                      {f.label}
                    </button>
                )}
                </div>
              </div>

              <div className="p-4 overflow-y-auto flex-1 bg-gray-50/30">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {mediaData.
                filter(
                  (m) => mediaFilter === 'all' || m.type === mediaFilter
                ).
                filter((m) =>
                m.name.toLowerCase().includes(mediaSearch.toLowerCase())
                ).
                map((media) =>
                <div
                  key={media.id}
                  onClick={() => {
                    if (mediaPickerCallback) {
                      mediaPickerCallback(media.url);
                    }
                    setShowMediaPicker(false);
                    setMediaPickerCallback(null);
                    showToast('Fichier sélectionné avec succès');
                  }}
                  className="group border border-gray-200 rounded-xl overflow-hidden bg-white hover:border-globus-orange hover:ring-2 hover:ring-globus-orange/50 hover:shadow-md transition-all cursor-pointer">
                  
                        <div className="h-28 bg-gray-100 relative flex items-center justify-center overflow-hidden">
                          {media.type === 'image' ?
                    <img
                      src={media.thumbnail}
                      alt={media.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> :

                    media.type === 'video' ?
                    <>
                              <img
                        src={media.thumbnail}
                        alt={media.name}
                        className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-300" />
                      
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                                  <PlayCircleIcon className="w-5 h-5 text-white" />
                                </div>
                              </div>
                            </> :
                    media.type === 'document' ?
                    <FileIcon className="w-10 h-10 text-gray-400 group-hover:text-globus-orange transition-colors" /> :

                    <MusicIcon className="w-10 h-10 text-gray-400 group-hover:text-globus-orange transition-colors" />
                    }
                        </div>
                        <div className="p-2">
                          <h4
                      className="text-[11px] font-bold text-gray-800 truncate mb-1"
                      title={media.name}>
                      
                            {media.name}
                          </h4>
                          <div className="flex items-center justify-between">
                            <span
                        className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${media.type === 'image' ? 'bg-blue-100 text-blue-700' : media.type === 'video' ? 'bg-purple-100 text-purple-700' : media.type === 'document' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        
                              {media.type}
                            </span>
                            <span className="text-[9px] text-gray-500 font-medium">
                              {media.size}
                            </span>
                          </div>
                        </div>
                      </div>
                )}
                </div>
              </div>
            </motion.div>
          </div>
        }
      </AnimatePresence>
    </div>);

}