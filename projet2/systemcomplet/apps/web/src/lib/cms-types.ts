/** Types des contenus publics renvoyés par l'API vitrine (/public/*). */

export interface MediaVariant {
  url: string;
  width?: number | null;
  height?: number | null;
  mime?: string | null;
}

export interface Media {
  id: string;
  kind: "image" | "svg" | "video" | "document" | "audio" | "model" | "external_video" | string;
  title?: string | null;
  alt?: string | null;
  caption?: string | null;
  credits?: string | null;
  width?: number | null;
  height?: number | null;
  mime?: string | null;
  url?: string;
  variants?: Record<string, MediaVariant>;
  focal?: { x: number; y: number } | null;
  provider?: string | null;
  external_id?: string | null;
  embed_url?: string;
  poster_url?: string;
}

export interface NavItem {
  label: string;
  href: string;
  description?: string | null;
  icon?: string | null;
  open_new_tab?: boolean;
  highlight?: boolean;
  children: NavItem[];
}

export interface Banner {
  key: string;
  kind: string;
  title?: string | null;
  content?: string | null;
  cta_label?: string | null;
  cta_href?: string | null;
  media?: Media | null;
  route_keys?: string[] | null;
  position?: string | null;
  frequency?: string | null;
  delay_seconds?: number | null;
  dismissible?: boolean;
}

export interface SiteContacts {
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  opening_hours?: Record<string, string> | { day?: string; hours?: string }[] | null;
  google_business_url?: string | null;
}

export interface SitePayload {
  company_name?: string | null;
  slogan?: string | null;
  promise?: string | null;
  contacts: SiteContacts;
  legal_info?: Record<string, string> | null;
  logo?: Media | null;
  logo_dark?: Media | null;
  favicon?: Media | null;
  /** Icône unique de la plateforme, déclinée et versionnée (favicon, PWA, assistant…). */
  brand?: { version: string; icon: string; sizes: Record<string, string> } | null;
  default_og_image?: Media | null;
  seo_title_template?: string | null;
  default_meta_description?: string | null;
  search_console_verification?: string | null;
  tracking: {
    ga4_id?: string;
    gads_id?: string;
    gads_labels?: Record<string, string>;
    meta_pixel?: string;
    tiktok_pixel?: string;
    linkedin_partner?: string;
  };
  consent: { texts?: Record<string, string>; policy_version?: string };
  menus: Record<string, { title: string; items: NavItem[] }>;
  socials: { network: string; url: string; label?: string | null }[];
  banners: Banner[];
  pages: Record<string, string>;
  reviews?: { count: number; average: number | null; distribution: Record<string, number> };
}

export interface Seo {
  title?: string | null;
  description?: string | null;
  canonical_url?: string | null;
  robots_index?: boolean;
  robots_follow?: boolean;
  og_title?: string | null;
  og_description?: string | null;
  og_image?: Media | null;
  twitter_card?: string | null;
  twitter_image?: Media | null;
  h1?: string | null;
  keywords?: string[];
}

export type Block = { kind: string; [key: string]: any };

export interface Section {
  key: string;
  title?: string | null;
  settings?: { background?: string; anchor?: string; width?: string; theme?: string; padding?: string; media?: Media | null; media_id?: string };
  blocks: Block[];
}

export interface PagePayload {
  route_key: string;
  path: string;
  title: string;
  template: "default" | "landing" | "legal" | "listing";
  summary?: string | null;
  body?: string | null;
  sections: Section[];
  seo?: Seo | null;
  schema_markup: { type: string; data: Record<string, unknown> }[];
  published_at?: string | null;
  updated_at?: string | null;
}

export interface FormField {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "select" | "number" | "date" | "checkbox" | string;
  required?: boolean;
  options?: (string | { value: string; label: string })[];
  placeholder?: string;
  help?: string;
}

export interface FormDefinitionPayload {
  key: string;
  title: string;
  description?: string | null;
  fields: FormField[];
  consents: { key: string; label: string; required?: boolean }[];
  success_message?: string | null;
  min_fill_seconds?: number;
  rendered_at?: number;
}

export interface UniverseCard {
  id: string;
  key: string;
  slug: string;
  name: string;
  tagline?: string | null;
  promise?: string | null;
  target?: string | null;
  mechanism?: string | null;
  icon?: string | null;
  accent?: string | null;
  hero?: Media | null;
  path: string;
}

export interface OfferPayload {
  id: string;
  slug: string;
  name: string;
  summary?: string | null;
  description?: string | null;
  deliverables?: string[] | null;
  steps?: (string | { title: string; text?: string })[] | null;
  ideal_for?: string | null;
  price_hint?: string | null;
  duration_hint?: string | null;
  icon?: string | null;
  cta_label?: string | null;
  media?: Media | null;
  universe?: { key: string; slug: string; name: string } | null;
  path?: string | null;
  body_blocks?: Block[];
  seo?: Seo | null;
}

export interface ProjectCard {
  id: string;
  slug: string;
  title: string;
  universe?: string | null;
  category?: string | null;
  city?: string | null;
  country?: string | null;
  year?: number | null;
  surface_m2?: string | number | null;
  delivery_status?: string | null;
  summary?: string | null;
  cover?: Media | null;
  path: string;
}

export interface BlogCard {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  cover?: Media | null;
  category?: { slug: string; name: string } | null;
  author?: { slug: string; name: string; title?: string | null; bio?: string | null; linkedin_url?: string | null; photo?: Media | null } | null;
  published_at?: string | null;
  reading_minutes?: number | null;
  tags?: string[] | null;
  content_family?: string | null;
  like_count?: number;
  comment_count?: number;
  view_count?: number;
  path: string;
}

export interface Testimonial {
  id: string;
  author_name: string;
  author_role?: string | null;
  location?: string | null;
  universe?: string | null;
  quote: string;
  rating?: number | null;
  photo?: Media | null;
  video?: Media | null;
  /** Avis vérifié (R6) : déposé par le client d'un chantier réel via une invitation nominative. */
  verified?: boolean;
  submitted_at?: string | null;
}
