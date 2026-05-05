import type {
  HeroSlide,
  HeroVideo,
  Engagement,
  AboutContent,
  MethodologyStep,
  Stat,
  ServiceItem,
  CtaBanner,
  Project,
  OngoingProject,
  Guarantee,
  VideoSectionContent,
  TeamMember,
  Partner,
  Testimonial,
  FaqItem,
  BlogPost } from
'../../../types/cms.types';

// ── Hero ─────────────────────────────────────────────────────
export const mockHeroSlides: HeroSlide[] = [
{
  tag: 'BTP & Construction Clé en main',
  title: 'Bâtissez votre avenir en toute sérénité.',
  subtitle:
  "Ensemble vers la perfection !!! De la conception architecturale à la remise des clés, nous gérons l'intégralité de votre projet avec rigueur et passion.",
  image:
  'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80',
  cta1: { text: 'Estimer mon budget', href: '#estimateur' },
  cta2: { text: 'Découvrir nos réalisations', href: '#projets' }
},
{
  tag: 'Expertise & Savoir-faire',
  title: 'Des constructions solides, durables et esthétiques.',
  subtitle:
  'Plus de 50 projets livrés avec succès. Nos ingénieurs qualifiés transforment vos visions en réalités concrètes.',
  image:
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80',
  cta1: { text: 'Voir nos projets', href: '#projets' },
  cta2: { text: 'Nos services', href: '#services' }
},
{
  tag: 'Architecture & Design',
  title: "De l'esquisse à la réalité, votre vision prend forme.",
  subtitle:
  'Conception architecturale sur-mesure, modélisation 3D et plans détaillés pour un résultat à la hauteur de vos ambitions.',
  image:
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80',
  cta1: { text: 'Demander un devis', href: '#contact' },
  cta2: { text: 'Notre méthodologie', href: '#methodologie' }
},
{
  tag: 'Qualité & Garanties',
  title: 'Garantie décennale et matériaux certifiés.',
  subtitle:
  "Votre tranquillité d'esprit est notre priorité. Chaque ouvrage est couvert et réalisé avec des matériaux normés et testés.",
  image:
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80',
  cta1: { text: 'Nos garanties', href: '#garanties' },
  cta2: { text: 'Contactez-nous', href: '#contact' }
}];


export const mockHeroVideo: HeroVideo = {
  src: 'https://videos.pexels.com/video-files/2835509/2835509-hd_1920_1080_30fps.mp4',
  poster:
  'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80'
};

// ── Engagements ──────────────────────────────────────────────
export const mockEngagements: Engagement[] = [
{
  iconKey: 'HardHatIcon',
  title: 'Expertise Technique',
  desc: 'Ingénieurs hautement qualifiés.',
  bgColor: 'bg-globus-blue',
  textColor: 'text-white'
},
{
  iconKey: 'KeyIcon',
  title: '100% Clé en main',
  desc: 'Un seul interlocuteur. Zéro stress.',
  bgColor: 'bg-globus-orange',
  textColor: 'text-white'
},
{
  iconKey: 'ShieldCheckIcon',
  title: 'Qualité et Délais',
  desc: 'Respect strict des budgets.',
  bgColor: 'bg-globus-blue-dark',
  textColor: 'text-white'
}];


// ── About ────────────────────────────────────────────────────
export const mockAboutContent: AboutContent = {
  sectionTag: "L'Expérience Globus",
  title: "L'alliance parfaite entre innovation, solidité et esthétique.",
  paragraphs: [
  'Globus Engineering SARL est une entreprise de BTP spécialisée dans la réalisation de travaux de construction de bâtiments "clé en main". Notre mission est de transformer vos visions architecturales en réalités tangibles, durables et sécurisées.',
  "Nous nous distinguons par notre approche intégrée : un seul interlocuteur de l'esquisse initiale jusqu'à la remise des clés. Cette méthode garantit une maîtrise totale des coûts, des délais et de la qualité d'exécution."],

  highlights: [
  'Conception architecturale sur-mesure',
  'Ingénierie structurelle de pointe',
  'Matériaux certifiés et durables',
  'Suivi de chantier transparent'],

  ctaText: 'En savoir plus sur nous',
  ctaHref: '#services',
  images: [
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'],

  videoSrc:
  'https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4',
  videoPoster:
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
  badgeValue: '15+',
  badgeLabel: "Années d'excellence"
};

// ── Methodology ──────────────────────────────────────────────
export const mockMethodologySteps: MethodologyStep[] = [
{
  iconKey: 'PencilRulerIcon',
  title: 'Étude & Conception',
  desc: 'Analyse du terrain, plans architecturaux, modélisation 3D, devis détaillé.',
  image:
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
},
{
  iconKey: 'FileTextIcon',
  title: 'Démarches Administratives',
  desc: "Nous gérons l'obtention du permis de construire et les autorisations pour vous.",
  image:
  'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
},
{
  iconKey: 'BrickWallIcon',
  title: 'Gros Œuvre',
  desc: 'Fondations, élévation des murs, charpente et toiture. Solidité garantie.',
  image:
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
},
{
  iconKey: 'PaintRollerIcon',
  title: 'Second Œuvre & Finitions',
  desc: 'Électricité, plomberie, menuiserie, peinture selon vos goûts et standards.',
  image:
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
},
{
  iconKey: 'KeyIcon',
  title: 'Remise des Clés',
  desc: 'Inspection finale rigoureuse et livraison de votre bâtiment prêt à vivre.',
  image:
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
}];


// ── Stats ────────────────────────────────────────────────────
export const mockStats: Stat[] = [
{ value: 50, suffix: '+', label: 'Projets Livrés' },
{ value: 100, suffix: '%', label: 'Clients Satisfaits' },
{ value: 30, suffix: '+', label: 'Experts' },
{ value: 15, suffix: '', label: "Années d'expérience" }];


// ── Services (Home) ──────────────────────────────────────────
export const mockServices: ServiceItem[] = [
{
  title: 'Construction de Bâtiments',
  subtitle: 'Résidentiel & Commercial',
  desc: 'Nous réalisons des constructions neuves de haute qualité, allant des villas de standing aux complexes commerciaux et industriels. Notre approche garantit des structures solides, durables et conformes aux normes les plus strictes.',
  iconKey: 'BuildingIcon',
  images: [
  'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']

},
{
  title: 'Conception Architecturale',
  subtitle: 'Plans 2D/3D & Design',
  desc: "Notre bureau d'études transforme vos idées en plans concrets. Nous proposons des modélisations 3D réalistes pour vous permettre de visualiser votre projet avant même le premier coup de pioche, en optimisant l'espace et la lumière.",
  iconKey: 'PencilRulerIcon',
  images: [
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1574958269340-fa927503f3dd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']

},
{
  title: 'Génie Civil & Rénovation',
  subtitle: 'Infrastructures & Réhabilitation',
  desc: 'Expertise pointue en génie civil pour les infrastructures complexes. Nous excellons également dans la rénovation lourde et la réhabilitation de bâtiments anciens, en alliant respect du patrimoine et modernité technique.',
  iconKey: 'HardHatIcon',
  images: [
  'https://images.unsplash.com/photo-1581094794329-c8112a89af12?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1582063289852-62e3ba2747f8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1590725121839-892b458a74fe?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']

}];


// ── CTA Banner ───────────────────────────────────────────────
export const mockCtaBanner: CtaBanner = {
  title: 'Vous avez un terrain mais vous ne savez pas par où commencer ?',
  subtitle:
  "Nos experts sont là pour vous guider à chaque étape. Parlons de votre projet dès aujourd'hui.",
  ctaText: 'Prendre un rendez-vous gratuit',
  ctaHref: '#contact'
};

// ── Portfolio Projects (Home) ────────────────────────────────
export const mockProjects: Project[] = [
{
  id: 1,
  title: 'Villa Contemporaine Les Alizés',
  category: 'Résidentiel',
  images: [
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],

  featured: true,
  videoSrc:
  'https://videos.pexels.com/video-files/2835509/2835509-hd_1920_1080_30fps.mp4'
},
{
  id: 2,
  title: 'Complexe Bureaux Horizon',
  category: 'Commercial',
  images: [
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1582063289852-62e3ba2747f8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],

  featured: false
},
{
  id: 3,
  title: 'Résidence Les Jardins',
  category: 'Résidentiel',
  images: [
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],

  featured: false
},
{
  id: 4,
  title: 'Fondations Tour Zenith',
  category: 'Gros Œuvre',
  images: [
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1581094794329-c8112a89af12?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],

  featured: false
},
{
  id: 5,
  title: 'Boutique Flagship Centre',
  category: 'Commercial',
  images: [
  'https://images.unsplash.com/photo-1582063289852-62e3ba2747f8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],

  featured: false
}];


export const mockOngoingProject: OngoingProject = {
  title: 'CENTRE COMMERCIALE DE LA PLACE EN',
  description:
  'Nous avons réalisé la construction complète de ce centre commercial moderne, comprenant 45 boutiques, un food court et un parking souterrain de 500 places. Le projet a été livré dans les délais et respecte les normes environnementales les plus strictes.',
  progress: 80,
  images: [
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1581094794329-c8112a89af12?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80'],

  slug: 'tour-zenith'
};

// ── Guarantees ───────────────────────────────────────────────
export const mockGuarantees: Guarantee[] = [
{
  iconKey: 'ShieldCheckIcon',
  title: 'Garantie Décennale',
  desc: "Votre ouvrage est couvert contre les vices cachés pendant 10 ans. Une tranquillité d'esprit totale."
},
{
  iconKey: 'AwardIcon',
  title: 'Matériaux Normés',
  desc: 'Utilisation exclusive de matériaux certifiés et testés en laboratoire pour une durabilité maximale.'
},
{
  iconKey: 'WrenchIcon',
  title: 'Service Après-Vente',
  desc: 'Une équipe réactive et disponible même après la remise des clés pour tout ajustement nécessaire.'
},
{
  iconKey: 'HardHatIcon',
  title: 'Sécurité sur Chantier',
  desc: "Respect strict des normes HSE pour protéger nos ouvriers, vos visiteurs et l'environnement."
}];


// ── Video Section ────────────────────────────────────────────
export const mockVideoSection: VideoSectionContent = {
  title: 'Notre Promesse',
  subtitle:
  'Transparence totale et qualité irréprochable. Entrez dans les coulisses de nos chantiers et découvrez notre savoir-faire en action.',
  youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0',
  backgroundVideoSrc:
  'https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4',
  backgroundVideoPoster:
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80'
};

// ── Team ─────────────────────────────────────────────────────
export const mockTeamMembers: TeamMember[] = [
{
  name: 'Jean Dupont',
  role: 'Directeur Général',
  quote: "L'excellence n'est pas un acte, mais une habitude.",
  imageClass: 'from-globus-blue to-globus-blue-dark'
},
{
  name: 'Sarah Koné',
  role: 'Architecte en Chef',
  quote: 'Chaque espace raconte une histoire unique.',
  imageClass: 'from-globus-orange to-red-600'
},
{
  name: 'Marc Lemaire',
  role: 'Ingénieur Structure',
  quote: 'La solidité est la fondation de la confiance.',
  imageClass: 'from-globus-gray to-gray-900'
},
{
  name: 'Amina Diallo',
  role: 'Chef de Chantier',
  quote: 'Rigueur et sécurité au quotidien.',
  imageClass: 'from-seconda-blue to-globus-blue'
}];


// ── Partners ─────────────────────────────────────────────────
export const mockPartners: Partner[] = [
{ name: 'CIMENCAM' },
{ name: 'AFRICA STEEL' },
{ name: 'LAFARGE' },
{ name: 'SOGEA' },
{ name: 'BTP MATÉRIAUX' },
{ name: 'ECO-BUILD' },
{ name: 'TECHNO-STRUCT' },
{ name: 'GLOBAL PAINT' },
{ name: 'CIMENCAM' },
{ name: 'AFRICA STEEL' }];


// ── Testimonials ─────────────────────────────────────────────
export const mockTestimonials: Testimonial[] = [
{
  id: 1,
  name: 'M. Dubois',
  project: 'Villa Résidentielle',
  text: "Globus BTP a réalisé la maison de nos rêves. Le respect des délais et le professionnalisme de l'équipe ont été remarquables du début à la fin.",
  rating: 5,
  photo:
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80'
},
{
  id: 2,
  name: 'Mme. Martin',
  project: 'Rénovation Bureaux',
  text: "Une gestion de projet impeccable. Le concept 'clé en main' prend tout son sens avec eux. Je recommande vivement pour tout projet professionnel.",
  rating: 5,
  photo:
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80'
},
{
  id: 3,
  name: 'Société Horizon',
  project: 'Entrepôt Logistique',
  text: 'Expertise technique indéniable. Les fondations et la structure métallique ont été posées avec une précision chirurgicale.',
  rating: 4,
  photo:
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80'
}];


// ── FAQ (Home) ───────────────────────────────────────────────
export const mockFaqItems: FaqItem[] = [
{
  q: "Combien coûte la construction d'une maison clé en main ?",
  a: 'Le coût varie en fonction de la surface, des matériaux choisis et des finitions. Nous vous invitons à utiliser notre estimateur de budget ou à nous contacter pour un devis précis et personnalisé.'
},
{
  q: 'Quels sont les délais moyens de construction ?',
  a: "Pour une villa standard, comptez entre 6 et 8 mois à partir de l'obtention du permis de construire. Un planning détaillé vous est fourni avant le début des travaux."
},
{
  q: "Gérez-vous l'obtention du permis de construire ?",
  a: "Oui, notre service 'clé en main' inclut la constitution du dossier et le suivi administratif jusqu'à l'obtention de votre permis de construire."
},
{
  q: 'Proposez-vous une garantie sur vos constructions ?',
  a: 'Absolument. Toutes nos constructions sont couvertes par la garantie décennale, vous protégeant contre les vices cachés pendant 10 ans.'
},
{
  q: 'Puis-je visiter le chantier pendant les travaux ?',
  a: "Oui, nous organisons des visites régulières avec le chef de chantier pour vous montrer l'avancement. Pour des raisons de sécurité, les visites libres ne sont pas autorisées."
}];


// ── Blog (Home — latest 3) ───────────────────────────────────
export const mockLatestBlogPosts: BlogPost[] = [
{
  title: "Les 5 erreurs à éviter avant d'acheter un terrain",
  category: 'Conseils',
  date: '12 Oct 2023',
  excerpt:
  "L'achat d'un terrain est la première étape cruciale. Découvrez les pièges à éviter pour garantir la faisabilité de votre projet.",
  image:
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  slug: 'erreurs-achat-terrain'
},
{
  title: 'Comment choisir les finitions intérieures de sa villa ?',
  category: 'Design',
  date: '28 Sep 2023',
  excerpt:
  'Carrelage, peinture, menuiserie... Guide complet pour harmoniser votre intérieur selon les dernières tendances.',
  image:
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  slug: 'choisir-finitions-interieures'
},
{
  title: 'Chantier en cours : Visite de la Résidence Horizon',
  category: 'Actualités',
  date: '15 Sep 2023',
  excerpt:
  "Plongée au cœur de notre dernier grand projet résidentiel. Découvrez l'avancement du gros œuvre en images.",
  image:
  'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  slug: 'visite-residence-horizon'
}];