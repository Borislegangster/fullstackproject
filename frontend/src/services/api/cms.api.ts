import { axiosClient, isApiConfigured } from './axiosClient';
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
  ContactInfo,
  ContactFormData,
  SiteSettings,
  SupportTicket,
  NewsletterSubscription,
  LegalPageContent,
  AboutPageContent,
  ProjectDetailFull } from
'../../types/cms.types';

// Mock data imports
import {
  mockHeroSlides,
  mockHeroVideo,
  mockEngagements,
  mockAboutContent,
  mockMethodologySteps,
  mockStats,
  mockServices,
  mockCtaBanner,
  mockProjects,
  mockOngoingProject,
  mockGuarantees,
  mockVideoSection,
  mockTeamMembers,
  mockPartners,
  mockTestimonials,
  mockFaqItems,
  mockLatestBlogPosts } from
'./mockData/home.mock';

import {
  mockServicesPageData,
  mockServiceDetailsFullData,
  mockProjectsPageData,
  mockProjectDetailsFullData,
  mockBlogPostsPageData,
  mockFaqPageData,
  mockContactInfo,
  mockSiteSettings,
  mockLegalPages,
  mockAboutPageData } from
'./mockData/pages.mock';

// ── Helper: returns mock data or fetches from API ────────────
async function fetchOrMock<T>(endpoint: string, mockData: T): Promise<T> {
  if (!isApiConfigured()) {
    // Simulate network delay for realistic UX
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockData;
  }
  const response = await axiosClient.get<T>(endpoint);
  return response.data;
}

async function postOrMock<T, R>(
endpoint: string,
data: T,
mockResponse: R)
: Promise<R> {
  if (!isApiConfigured()) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return mockResponse;
  }
  const response = await axiosClient.post<R>(endpoint, data);
  return response.data;
}

// ══════════════════════════════════════════════════════════════
// HOME SECTION APIs
// ══════════════════════════════════════════════════════════════

export function getHeroSlides(): Promise<HeroSlide[]> {
  return fetchOrMock('/cms/hero-slides', mockHeroSlides);
}

export function getHeroVideo(): Promise<HeroVideo> {
  return fetchOrMock('/cms/hero-video', mockHeroVideo);
}

export function getEngagements(): Promise<Engagement[]> {
  return fetchOrMock('/cms/engagements', mockEngagements);
}

export function getAboutContent(): Promise<AboutContent> {
  return fetchOrMock('/cms/about', mockAboutContent);
}

export function getMethodologySteps(): Promise<MethodologyStep[]> {
  return fetchOrMock('/cms/methodology', mockMethodologySteps);
}

export function getStats(): Promise<Stat[]> {
  return fetchOrMock('/cms/stats', mockStats);
}

export function getServices(): Promise<ServiceItem[]> {
  return fetchOrMock('/cms/services', mockServices);
}

export function getCtaBanner(): Promise<CtaBanner> {
  return fetchOrMock('/cms/cta-banner', mockCtaBanner);
}

export function getProjects(): Promise<Project[]> {
  return fetchOrMock('/cms/projects', mockProjects);
}

export function getOngoingProject(): Promise<OngoingProject> {
  return fetchOrMock('/cms/ongoing-project', mockOngoingProject);
}

export function getGuarantees(): Promise<Guarantee[]> {
  return fetchOrMock('/cms/guarantees', mockGuarantees);
}

export function getVideoSection(): Promise<VideoSectionContent> {
  return fetchOrMock('/cms/video-section', mockVideoSection);
}

export function getTeamMembers(): Promise<TeamMember[]> {
  return fetchOrMock('/cms/team', mockTeamMembers);
}

export function getPartners(): Promise<Partner[]> {
  return fetchOrMock('/cms/partners', mockPartners);
}

export function getTestimonials(): Promise<Testimonial[]> {
  return fetchOrMock('/cms/testimonials', mockTestimonials);
}

export function getFaqItems(): Promise<FaqItem[]> {
  return fetchOrMock('/cms/faq-home', mockFaqItems);
}

export function getLatestBlogPosts(): Promise<BlogPost[]> {
  return fetchOrMock('/cms/blog/latest', mockLatestBlogPosts);
}

// ══════════════════════════════════════════════════════════════
// PAGE-LEVEL APIs
// ══════════════════════════════════════════════════════════════

export function getServicesPage(): Promise<ServiceDetail[]> {
  return fetchOrMock('/cms/services-page', mockServicesPageData);
}

export function getServiceBySlug(
slug: string)
: Promise<ServiceDetailFull | undefined> {
  return fetchOrMock(
    `/cms/services/${slug}`,
    mockServiceDetailsFullData[slug] ||
    mockServiceDetailsFullData['construction-batiments']
  );
}

export function getProjectsPage() {
  return fetchOrMock('/cms/projects-page', mockProjectsPageData);
}

export function getProjectBySlug(
slug: string)
: Promise<ProjectDetailFull | undefined> {
  return fetchOrMock(
    `/cms/projects/${slug}`,
    mockProjectDetailsFullData[slug] || mockProjectDetailsFullData['default']
  );
}

export function getAllBlogPosts() {
  return fetchOrMock('/cms/blog', mockBlogPostsPageData);
}

export function getBlogPostBySlug(slug: string) {
  return fetchOrMock(
    `/cms/blog/${slug}`,
    mockBlogPostsPageData.find((p) => p.id === slug)
  );
}

export function getFaqPage(): Promise<FaqCategory[]> {
  return fetchOrMock('/cms/faq', mockFaqPageData);
}

export function getContactInfo(): Promise<ContactInfo> {
  return fetchOrMock('/cms/contact', mockContactInfo);
}

export function getSiteSettings(): Promise<SiteSettings> {
  return fetchOrMock('/cms/settings', mockSiteSettings);
}

export function getLegalPage(
slug: string)
: Promise<LegalPageContent | undefined> {
  return fetchOrMock(`/cms/legal/${slug}`, mockLegalPages[slug]);
}

export function getAboutPage(): Promise<AboutPageContent> {
  return fetchOrMock('/cms/about-page', mockAboutPageData);
}

// ══════════════════════════════════════════════════════════════
// FORM SUBMISSION APIs
// ══════════════════════════════════════════════════════════════

export function submitContactForm(
data: ContactFormData)
: Promise<{success: boolean;message: string;}> {
  return postOrMock('/cms/contact/submit', data, {
    success: true,
    message: 'Message envoyé avec succès !'
  });
}

export function subscribeNewsletter(
data: NewsletterSubscription)
: Promise<{success: boolean;message: string;}> {
  return postOrMock('/cms/newsletter/subscribe', data, {
    success: true,
    message: 'Inscription à la newsletter réussie !'
  });
}

export function submitSupportTicket(
data: SupportTicket)
: Promise<{success: boolean;message: string;}> {
  return postOrMock('/cms/support/ticket', data, {
    success: true,
    message: 'Ticket envoyé avec succès !'
  });
}