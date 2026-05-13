// ============================================================
// Globus BTP — CMS TypeScript Types
// All data model interfaces for the Site Vitrine
// ============================================================

// ── Hero Section ──────────────────────────────────────────────
export interface HeroSlide {
  tag: string;
  title: string;
  subtitle: string;
  image: string;
  cta1: {text: string;href: string;};
  cta2: {text: string;href: string;};
}

export interface HeroVideo {
  src: string;
  poster: string;
}

// ── Engagements Bar ──────────────────────────────────────────
export interface Engagement {
  iconKey: string;
  title: string;
  desc: string;
  bgColor: string;
  textColor: string;
}

// ── About Section ────────────────────────────────────────────
export interface AboutContent {
  sectionTag: string;
  title: string;
  paragraphs: string[];
  highlights: string[];
  ctaText: string;
  ctaHref: string;
  images: string[];
  videoSrc: string;
  videoPoster: string;
  badgeValue: string;
  badgeLabel: string;
}

// ── Methodology Section ──────────────────────────────────────
export interface MethodologyStep {
  iconKey: string;
  title: string;
  desc: string;
  image: string;
}

// ── Stats Bar ────────────────────────────────────────────────
export interface Stat {
  value: number;
  suffix: string;
  label: string;
}

// ── Services Section (Home) ──────────────────────────────────
export interface ServiceItem {
  title: string;
  subtitle: string;
  desc: string;
  iconKey: string;
  images: string[];
  slug: string;
}

// ── Services Page & Detail ───────────────────────────────────
export interface ServiceDetail {
  id: string;
  title: string;
  subtitle: string;
  desc: string;
  iconKey: string;
  image: string;
}

export interface ServiceDetailFull {
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  desc: string;
  details: string;
  benefits: string[];
  relatedCategory: string;
  processSteps: {title: string;desc: string;iconKey: string;}[];
  faq: {q: string;a: string;}[];
}

// ── CTA Banner ───────────────────────────────────────────────
export interface CtaBanner {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
}

// ── Portfolio / Projects ─────────────────────────────────────
export interface Project {
  id: number;
  title: string;
  category: string;
  images: string[];
  featured: boolean;
  slug?: string;
  videoSrc?: string;
}

export interface ProjectDetail {
  slug: string;
  title: string;
  category: string;
  description: string;
  images: string[];
  client: string;
  location: string;
  duration: string;
  surface: string;
  year: string;
  features: string[];
}

export interface ProjectDetailFull {
  slug: string;
  title: string;
  category: string;
  status: string;
  location: string;
  client: string;
  area: string;
  duration: string;
  architect: string;
  images: string[];
  challenge: string;
  solution: string;
  videoUrl: string;
  progression: {step: string;status: string;date?: string;}[];
}

export interface OngoingProject {
  title: string;
  description: string;
  progress: number;
  images: string[];
  slug: string;
}

// ── Guarantees ───────────────────────────────────────────────
export interface Guarantee {
  iconKey: string;
  title: string;
  desc: string;
}

// ── Video Section ────────────────────────────────────────────
export interface VideoSectionContent {
  title: string;
  subtitle: string;
  youtubeUrl: string;
  backgroundVideoSrc: string;
  backgroundVideoPoster: string;
}

// ── Team ─────────────────────────────────────────────────────
export interface TeamMember {
  name: string;
  role: string;
  quote: string;
  imageClass: string;
  photo?: string;
}

// ── Partners ─────────────────────────────────────────────────
export interface Partner {
  name: string;
  logo?: string;
}

// ── Testimonials ─────────────────────────────────────────────
export interface Testimonial {
  id: number;
  name: string;
  project: string;
  text: string;
  rating: number;
  photo: string;
}

// ── FAQ ──────────────────────────────────────────────────────
export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqCategory {
  name: string;
  items: FaqItem[];
}

// ── Blog ─────────────────────────────────────────────────────
export interface BlogPost {
  title: string;
  category: string;
  date: string;
  excerpt: string;
  image: string;
  slug?: string;
  htmlContent?: string;
}

export interface BlogPostDetail {
  slug: string;
  title: string;
  category: string;
  date: string;
  author: string;
  image: string;
  content: string;
  tags: string[];
  relatedSlugs: string[];
}

// ── Contact ──────────────────────────────────────────────────
export interface ContactInfo {
  address: string;
  phone: string;
  email: string;
  whatsapp: string;
  mapEmbedUrl: string;
  hours: string;
}

export interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  projectType?: string;
}

// ── Site Settings (global) ───────────────────────────────────
export interface SiteSettings {
  companyName: string;
  logo: string;
  phone: string;
  email: string;
  address: string;
  whatsappUrl: string;
  socialLinks: {
    facebook: string;
    twitter: string;
    linkedin: string;
    instagram: string;
  };
  footerDescription: string;
  navLinks: NavLink[];
  footerQuickLinks?: NavLink[];
  footerServiceLinks?: NavLink[];
  topBarText?: string;
}

export interface NavLink {
  label: string;
  href: string;
  children?: NavLink[];
}

// ── Legal Pages ──────────────────────────────────────────────
export interface LegalPageContent {
  slug: string;
  title: string;
  lastUpdated: string;
  sections: {
    title: string;
    content: string;
  }[];
}

// ── Help Center ──────────────────────────────────────────────
export interface HelpCenterInfo {
  faqLink: string;
  whatsappUrl: string;
  supportEmail: string;
}

// ── Newsletter ───────────────────────────────────────────────
export interface NewsletterSubscription {
  email: string;
}

// ── Support Ticket ───────────────────────────────────────────
export interface SupportTicket {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// ── Chatbot Config ───────────────────────────────────────────
export interface ChatbotConfig {
  enabled: boolean;
  welcomeMessage: string;
  position: 'bottom-right' | 'bottom-left';
}

// ── Media Library ────────────────────────────────────────────
export interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'youtube';
  url: string;
  thumbnail?: string;
  title?: string;
  alt?: string;
}

// ── About Page ───────────────────────────────────────────────
export interface AboutPageContent {
  heroImage: string;
  heroTitle: string;
  mission: string;
  vision: string;
  values: {title: string;desc: string;iconKey: string;}[];
  timeline: {year: string;title: string;desc: string;}[];
  team: TeamMember[];
  stats: Stat[];
  certifications?: string[];
}

// ── API Response wrapper ─────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}