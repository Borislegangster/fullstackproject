/* ──────────────────────────────────────────────────────────────
   Admin CMS TypeScript interfaces
   Maps 1:1 with backend schemas (admin_cms.py / media.py)
   ────────────────────────────────────────────────────────────── */

// ── Generic ──────────────────────────────────────────────────
export interface FormResponse {
  success: boolean;
  message: string;
  id?: string;
}

// ── Blog ─────────────────────────────────────────────────────
export interface AdminBlogPost {
  id: string;
  title: string;
  slug: string;
  category: string;
  date: string;
  read_time: string;
  author: string;
  excerpt: string;
  image: string;
  featured: boolean;
  html_content: string;
  status: string;
}

// ── Projects ─────────────────────────────────────────────────
export interface AdminProject {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: string;
  location: string;
  client_name: string;
  area: string;
  duration: string;
  architect: string;
  description: string;
  images: string[];
  challenge: string;
  solution: string;
  video_url: string;
  progress: number;
  featured: boolean;
  is_published: boolean;
  is_ongoing: boolean;
  sort_order: number;
}

// ── Services ─────────────────────────────────────────────────
export interface AdminService {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  desc: string;
  icon_key: string;
  image: string;
  images: string[];
  details: string;
  benefits: string[];
  is_published: boolean;
  sort_order: number;
}

// ── Team ─────────────────────────────────────────────────────
export interface AdminTeamMember {
  id: string;
  name: string;
  role: string;
  quote: string;
  image_class: string;
  photo: string;
  sort_order: number;
}

// ── Testimonials ─────────────────────────────────────────────
export interface AdminTestimonial {
  id: string;
  name: string;
  project: string;
  text: string;
  rating: number;
  photo: string;
  is_published: boolean;
  sort_order: number;
}

// ── Partners ─────────────────────────────────────────────────
export interface AdminPartner {
  id: string;
  name: string;
  logo: string;
  sort_order: number;
}

// ── FAQ ──────────────────────────────────────────────────────
export interface AdminFaqCategory {
  id: string;
  name: string;
  sort_order: number;
}

export interface AdminFaqItem {
  id: string;
  category_id: string;
  question: string;
  answer: string;
  sort_order: number;
}

// ── Hero Slides ──────────────────────────────────────────────
export interface AdminHeroSlide {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  image: string;
  cta1_text: string;
  cta1_href: string;
  cta2_text: string;
  cta2_href: string;
  is_active: boolean;
  sort_order: number;
}

// ── Engagements ──────────────────────────────────────────────
export interface AdminEngagement {
  id: string;
  icon_key: string;
  title: string;
  desc: string;
  bg_color: string;
  text_color: string;
  sort_order: number;
}

// ── Methodology ──────────────────────────────────────────────
export interface AdminMethodologyStep {
  id: string;
  icon_key: string;
  title: string;
  desc: string;
  image: string;
  sort_order: number;
}

// ── Stats ────────────────────────────────────────────────────
export interface AdminStat {
  id: string;
  value: number;
  suffix: string;
  label: string;
  sort_order: number;
}

// ── Guarantees ───────────────────────────────────────────────
export interface AdminGuarantee {
  id: string;
  icon_key: string;
  title: string;
  desc: string;
  sort_order: number;
}

// ── Site Settings (singleton) ────────────────────────────────
export interface AdminSiteSettings {
  id: string;
  company_name: string;
  logo: string;
  phone: string;
  email: string;
  address: string;
  whatsapp_url: string;
  social_links: Record<string, string>;
  footer_description: string;
  nav_links: Array<{ label: string; href: string }>;
  footer_quick_links: Array<{ label: string; href: string }>;
  footer_service_links: Array<{ label: string; href: string }>;
  top_bar_text: string;
  hero_video_src: string;
  hero_video_poster: string;
  cta_title: string;
  cta_subtitle: string;
  cta_text: string;
  cta_href: string;
  video_section_title: string;
  video_section_subtitle: string;
  video_section_youtube_url: string;
  video_section_bg_video_src: string;
  video_section_bg_video_poster: string;
  contact_address: string;
  contact_phone: string;
  contact_email: string;
  contact_whatsapp: string;
  contact_map_embed_url: string;
  contact_hours: string;
  // SEO & Tracking
  seo_pages: Array<{ page: string; path: string; title: string; description: string; og_image: string; keywords: string }>;
  schema_org: Record<string, string>;
  tracking: Record<string, any>;
  sitemap_config: Record<string, any>;
}

// ── About Content (singleton) ────────────────────────────────
export interface AdminAboutContent {
  id: string;
  section_tag: string;
  title: string;
  paragraphs: string[];
  highlights: string[];
  cta_text: string;
  cta_href: string;
  images: string[];
  video_src: string;
  video_poster: string;
  badge_value: string;
  badge_label: string;
  hero_image: string;
  hero_title: string;
  mission: string;
  vision: string;
  values: Array<{ title: string; desc: string; iconKey: string }>;
  timeline: any[];
  certifications: string[];
}

// ── Legal Pages ──────────────────────────────────────────────
export interface AdminLegalPage {
  id: string;
  slug: string;
  title: string;
  last_updated: string;
  sections: Array<{ title: string; content: string }>;
}

// ── Contact Submissions ──────────────────────────────────────
export interface AdminContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

// ── Media ────────────────────────────────────────────────────
export interface AdminMedia {
  id: string;
  name: string;
  type: string;
  url: string;
  thumbnail: string;
  alt: string;
  folder: string;
  size: string;
  youtube_id: string;
  usage_count: number;
  uploaded_at: string;
}

// ── Auth ─────────────────────────────────────────────────────
export interface LoginResponse {
  access_token: string;
  user: { id: string; email: string; full_name: string; role: string };
}

// ── Analytics ────────────────────────────────────────────────
export interface AdminAnalyticsLog {
  id: string;
  timestamp: string;
  ip_address: string;
  user_agent: string;
  browser: string;
  os: string;
  device_type: string;
  path: string;
  country: string;
}

export interface AdminAnalyticsStats {
  total_views_month: number;
  devices: Record<string, number>;
  browsers: Record<string, number>;
  paths: Record<string, number>;
  countries: Record<string, number>;
  logs: AdminAnalyticsLog[];
}
