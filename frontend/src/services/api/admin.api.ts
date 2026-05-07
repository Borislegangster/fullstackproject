/* ──────────────────────────────────────────────────────────────
   Admin CMS API service
   All admin CRUD endpoints + auth + media
   Uses axiosClient (JWT auto-injected via interceptor)
   ────────────────────────────────────────────────────────────── */

import { axiosClient } from './axiosClient';
import type {
  LoginResponse,
  AdminBlogPost,
  AdminProject,
  AdminService,
  AdminTeamMember,
  AdminTestimonial,
  AdminPartner,
  AdminFaqCategory,
  AdminFaqItem,
  AdminHeroSlide,
  AdminEngagement,
  AdminMethodologyStep,
  AdminStat,
  AdminGuarantee,
  AdminSiteSettings,
  AdminAboutContent,
  AdminLegalPage,
  AdminContact,
  AdminMedia,
  FormResponse,
} from './admin.types';

// ── Auth ─────────────────────────────────────────────────────

export async function loginAdmin(email: string, password: string): Promise<LoginResponse> {
  const { data } = await axiosClient.post('/auth/login', { email, password });
  localStorage.setItem('globus_token', data.access_token);
  return data;
}

export async function getMe() {
  const { data } = await axiosClient.get('/auth/me');
  return data;
}

export function logoutAdmin() {
  localStorage.removeItem('globus_token');
}

export function isLoggedIn(): boolean {
  return Boolean(localStorage.getItem('globus_token'));
}

/**
 * Auto-login for dev mode. Called once on ERP mount.
 * In production, this should be replaced by a login page.
 */
export async function ensureAuth(): Promise<boolean> {
  if (isLoggedIn()) {
    try {
      await getMe();
      return true;
    } catch {
      localStorage.removeItem('globus_token');
    }
  }
  // Dev auto-login
  try {
    await loginAdmin('admin@globus-btp.com', 'Globus2024!');
    return true;
  } catch (e) {
    console.error('[Admin] Auto-login failed:', e);
    return false;
  }
}

// ── Generic CRUD helpers ─────────────────────────────────────

async function adminGet<T>(endpoint: string): Promise<T> {
  const { data } = await axiosClient.get(endpoint);
  return data;
}

async function adminPost<T = FormResponse>(endpoint: string, body: any): Promise<T> {
  const { data } = await axiosClient.post(endpoint, body);
  return data;
}

async function adminPut<T = FormResponse>(endpoint: string, body: any): Promise<T> {
  const { data } = await axiosClient.put(endpoint, body);
  return data;
}

async function adminDelete<T = FormResponse>(endpoint: string): Promise<T> {
  const { data } = await axiosClient.delete(endpoint);
  return data;
}

// ── Blog ─────────────────────────────────────────────────────

export const blogApi = {
  list: () => adminGet<AdminBlogPost[]>('/admin/cms/blog'),
  create: (d: Partial<AdminBlogPost>) => adminPost('/admin/cms/blog', d),
  update: (id: string, d: Partial<AdminBlogPost>) => adminPut(`/admin/cms/blog/${id}`, d),
  delete: (id: string) => adminDelete(`/admin/cms/blog/${id}`),
};

// ── Projects ─────────────────────────────────────────────────

export const projectsApi = {
  list: () => adminGet<AdminProject[]>('/admin/cms/projects'),
  create: (d: Partial<AdminProject>) => adminPost('/admin/cms/projects', d),
  update: (id: string, d: Partial<AdminProject>) => adminPut(`/admin/cms/projects/${id}`, d),
  delete: (id: string) => adminDelete(`/admin/cms/projects/${id}`),
};

// ── Services ─────────────────────────────────────────────────

export const servicesApi = {
  list: () => adminGet<AdminService[]>('/admin/cms/services'),
  create: (d: Partial<AdminService>) => adminPost('/admin/cms/services', d),
  update: (id: string, d: Partial<AdminService>) => adminPut(`/admin/cms/services/${id}`, d),
  delete: (id: string) => adminDelete(`/admin/cms/services/${id}`),
};

// ── Team ─────────────────────────────────────────────────────

export const teamApi = {
  list: () => adminGet<AdminTeamMember[]>('/admin/cms/team'),
  create: (d: Partial<AdminTeamMember>) => adminPost('/admin/cms/team', d),
  update: (id: string, d: Partial<AdminTeamMember>) => adminPut(`/admin/cms/team/${id}`, d),
  delete: (id: string) => adminDelete(`/admin/cms/team/${id}`),
};

// ── Testimonials ─────────────────────────────────────────────

export const testimonialsApi = {
  list: () => adminGet<AdminTestimonial[]>('/admin/cms/testimonials'),
  create: (d: Partial<AdminTestimonial>) => adminPost('/admin/cms/testimonials', d),
  update: (id: string, d: Partial<AdminTestimonial>) => adminPut(`/admin/cms/testimonials/${id}`, d),
  delete: (id: string) => adminDelete(`/admin/cms/testimonials/${id}`),
};

// ── Partners ─────────────────────────────────────────────────

export const partnersApi = {
  list: () => adminGet<AdminPartner[]>('/admin/cms/partners'),
  create: (d: Partial<AdminPartner>) => adminPost('/admin/cms/partners', d),
  update: (id: string, d: Partial<AdminPartner>) => adminPut(`/admin/cms/partners/${id}`, d),
  delete: (id: string) => adminDelete(`/admin/cms/partners/${id}`),
};

// ── FAQ ──────────────────────────────────────────────────────

export const faqCategoriesApi = {
  list: () => adminGet<AdminFaqCategory[]>('/admin/cms/faq/categories'),
  create: (d: Partial<AdminFaqCategory>) => adminPost('/admin/cms/faq/categories', d),
  update: (id: string, d: Partial<AdminFaqCategory>) => adminPut(`/admin/cms/faq/categories/${id}`, d),
  delete: (id: string) => adminDelete(`/admin/cms/faq/categories/${id}`),
};

export const faqItemsApi = {
  list: () => adminGet<AdminFaqItem[]>('/admin/cms/faq/items'),
  create: (d: Partial<AdminFaqItem>) => adminPost('/admin/cms/faq/items', d),
  update: (id: string, d: Partial<AdminFaqItem>) => adminPut(`/admin/cms/faq/items/${id}`, d),
  delete: (id: string) => adminDelete(`/admin/cms/faq/items/${id}`),
};

// ── Hero Slides ──────────────────────────────────────────────

export const heroSlidesApi = {
  list: () => adminGet<AdminHeroSlide[]>('/admin/cms/hero-slides'),
  create: (d: Partial<AdminHeroSlide>) => adminPost('/admin/cms/hero-slides', d),
  update: (id: string, d: Partial<AdminHeroSlide>) => adminPut(`/admin/cms/hero-slides/${id}`, d),
  delete: (id: string) => adminDelete(`/admin/cms/hero-slides/${id}`),
};

// ── Engagements ──────────────────────────────────────────────

export const engagementsApi = {
  list: () => adminGet<AdminEngagement[]>('/admin/cms/engagements'),
  create: (d: Partial<AdminEngagement>) => adminPost('/admin/cms/engagements', d),
  update: (id: string, d: Partial<AdminEngagement>) => adminPut(`/admin/cms/engagements/${id}`, d),
  delete: (id: string) => adminDelete(`/admin/cms/engagements/${id}`),
};

// ── Methodology ──────────────────────────────────────────────

export const methodologyApi = {
  list: () => adminGet<AdminMethodologyStep[]>('/admin/cms/methodology'),
  create: (d: Partial<AdminMethodologyStep>) => adminPost('/admin/cms/methodology', d),
  update: (id: string, d: Partial<AdminMethodologyStep>) => adminPut(`/admin/cms/methodology/${id}`, d),
  delete: (id: string) => adminDelete(`/admin/cms/methodology/${id}`),
};

// ── Stats ────────────────────────────────────────────────────

export const statsApi = {
  list: () => adminGet<AdminStat[]>('/admin/cms/stats'),
  create: (d: Partial<AdminStat>) => adminPost('/admin/cms/stats', d),
  update: (id: string, d: Partial<AdminStat>) => adminPut(`/admin/cms/stats/${id}`, d),
  delete: (id: string) => adminDelete(`/admin/cms/stats/${id}`),
};

// ── Guarantees ───────────────────────────────────────────────

export const guaranteesApi = {
  list: () => adminGet<AdminGuarantee[]>('/admin/cms/guarantees'),
  create: (d: Partial<AdminGuarantee>) => adminPost('/admin/cms/guarantees', d),
  update: (id: string, d: Partial<AdminGuarantee>) => adminPut(`/admin/cms/guarantees/${id}`, d),
  delete: (id: string) => adminDelete(`/admin/cms/guarantees/${id}`),
};

// ── Singletons ───────────────────────────────────────────────

export const settingsApi = {
  get: () => adminGet<AdminSiteSettings>('/admin/cms/settings'),
  update: (d: Partial<AdminSiteSettings>) => adminPut('/admin/cms/settings', d),
};

export const aboutApi = {
  get: () => adminGet<AdminAboutContent>('/admin/cms/about'),
  update: (d: Partial<AdminAboutContent>) => adminPut('/admin/cms/about', d),
};

export const legalApi = {
  get: (slug: string) => adminGet<AdminLegalPage>(`/admin/cms/legal/${slug}`),
  update: (slug: string, d: Partial<AdminLegalPage>) => adminPut(`/admin/cms/legal/${slug}`, d),
};

// ── Contact Submissions ──────────────────────────────────────

export const contactsApi = {
  list: () => adminGet<AdminContact[]>('/admin/cms/contacts'),
  markRead: (id: string) => adminPut(`/admin/cms/contacts/${id}/read`, {}),
  reply: (id: string, message: string) => adminPost(`/admin/cms/contacts/${id}/reply`, { message }),
};

// ── Media Library ────────────────────────────────────────────

export const mediaApi = {
  list: (type?: string, folder?: string) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (folder) params.set('folder', folder);
    const qs = params.toString();
    return adminGet<AdminMedia[]>(`/admin/media${qs ? `?${qs}` : ''}`);
  },
  upload: async (file: File, name?: string, folder?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (name) fd.append('name', name);
    if (folder) fd.append('folder', folder);
    const { data } = await axiosClient.post('/admin/media/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data as AdminMedia;
  },
  importYouTube: (url: string, name?: string) =>
    adminPost<AdminMedia>('/admin/media/youtube', { url, name }),
  update: (id: string, d: Partial<AdminMedia>) =>
    adminPut(`/admin/media/${id}`, d),
  delete: (id: string) => adminDelete(`/admin/media/${id}`),
};
