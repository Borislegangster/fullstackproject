/**
 * CMS public API — Site vitrine.
 *
 * Phase 9: tout passe désormais par le backend réel via `axiosClient`.
 * Plus aucun fallback mockData : si l'API échoue, l'erreur remonte au
 * `useCmsQuery` (toast + état d'erreur) au lieu d'être masquée par un mock.
 */
import { axiosClient } from './axiosClient';
import type {
  HeroSlide,
  HeroVideo,
  Engagement,
  AboutContent,
  MethodologyStep,
  Stat,
  ServiceItem,
  ServiceDetail,
  ServiceDetailFull,
  CtaBanner,
  Project,
  OngoingProject,
  Guarantee,
  VideoSectionContent,
  TeamMember,
  Partner,
  Testimonial,
  FaqItem,
  FaqCategory,
  BlogPost,
  BlogPostPageItem,
  ProjectPageItem,
  ContactInfo,
  ContactFormData,
  SiteSettings,
  SupportTicket,
  NewsletterSubscription,
  LegalPageContent,
  AboutPageContent,
  ProjectDetailFull } from
'../../types/cms.types';

// ── Helpers ──────────────────────────────────────────────────
async function get<T>(endpoint: string): Promise<T> {
  const { data } = await axiosClient.get<T>(endpoint);
  return data;
}

async function post<R>(endpoint: string, body: unknown): Promise<R> {
  const { data } = await axiosClient.post<R>(endpoint, body);
  return data;
}

// ══════════════════════════════════════════════════════════════
// HOME SECTION APIs
// ══════════════════════════════════════════════════════════════

export function getHeroSlides(): Promise<HeroSlide[]> {
  return get('/cms/hero-slides');
}

export function getHeroVideo(): Promise<HeroVideo> {
  return get('/cms/hero-video');
}

export function getEngagements(): Promise<Engagement[]> {
  return get('/cms/engagements');
}

export function getAboutContent(): Promise<AboutContent> {
  return get('/cms/about');
}

export function getMethodologySteps(): Promise<MethodologyStep[]> {
  return get('/cms/methodology');
}

export function getStats(): Promise<Stat[]> {
  return get('/cms/stats');
}

export function getServices(): Promise<ServiceItem[]> {
  return get('/cms/services');
}

export function getCtaBanner(): Promise<CtaBanner> {
  return get('/cms/cta-banner');
}

export function getProjects(): Promise<Project[]> {
  return get('/cms/projects');
}

export function getOngoingProject(): Promise<OngoingProject> {
  return get('/cms/ongoing-project');
}

export function getGuarantees(): Promise<Guarantee[]> {
  return get('/cms/guarantees');
}

export function getVideoSection(): Promise<VideoSectionContent> {
  return get('/cms/video-section');
}

export function getTeamMembers(): Promise<TeamMember[]> {
  return get('/cms/team');
}

export function getPartners(): Promise<Partner[]> {
  return get('/cms/partners');
}

export function getTestimonials(): Promise<Testimonial[]> {
  return get('/cms/testimonials');
}

export function getFaqItems(): Promise<FaqItem[]> {
  return get('/cms/faq-home');
}

export function getLatestBlogPosts(): Promise<BlogPost[]> {
  return get('/cms/blog/latest');
}

// ══════════════════════════════════════════════════════════════
// PAGE-LEVEL APIs
// ══════════════════════════════════════════════════════════════

export function getServicesPage(): Promise<ServiceDetail[]> {
  return get('/cms/services-page');
}

export function getServiceBySlug(slug: string): Promise<ServiceDetailFull> {
  return get(`/cms/services/${slug}`);
}

export function getProjectsPage(): Promise<ProjectPageItem[]> {
  return get('/cms/projects-page');
}

export function getProjectBySlug(slug: string): Promise<ProjectDetailFull> {
  return get(`/cms/projects/${slug}`);
}

export function getAllBlogPosts(): Promise<BlogPostPageItem[]> {
  return get('/cms/blog');
}

export function getBlogPostBySlug(slug: string): Promise<BlogPostPageItem> {
  return get(`/cms/blog/${slug}`);
}

export function getFaqPage(): Promise<FaqCategory[]> {
  return get('/cms/faq');
}

export function getContactInfo(): Promise<ContactInfo> {
  return get('/cms/contact');
}

export function getSiteSettings(): Promise<SiteSettings> {
  return get('/cms/settings');
}

export function getLegalPage(slug: string): Promise<LegalPageContent> {
  return get(`/cms/legal/${slug}`);
}

export function getAboutPage(): Promise<AboutPageContent> {
  return get('/cms/about-page');
}

// ══════════════════════════════════════════════════════════════
// FORM SUBMISSION APIs
// ══════════════════════════════════════════════════════════════

export function submitContactForm(
data: ContactFormData)
: Promise<{success: boolean;message: string;}> {
  return post('/cms/contact/submit', data);
}

export function subscribeNewsletter(
data: NewsletterSubscription)
: Promise<{success: boolean;message: string;}> {
  return post('/cms/newsletter/subscribe', data);
}

export function submitSupportTicket(
data: SupportTicket)
: Promise<{success: boolean;message: string;}> {
  return post('/cms/support/ticket', data);
}
