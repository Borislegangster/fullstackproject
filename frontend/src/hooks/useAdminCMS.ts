/* ──────────────────────────────────────────────────────────────
   useAdminCMS — Centralized hook for ERP CMS state management
   Fetches all data from the backend, provides CRUD functions,
   and auto-refreshes after mutations.
   ────────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback } from 'react';
import {
  ensureAuth,
  blogApi,
  projectsApi,
  servicesApi,
  teamApi,
  testimonialsApi,
  partnersApi,
  faqCategoriesApi,
  faqItemsApi,
  heroSlidesApi,
  engagementsApi,
  methodologyApi,
  statsApi,
  guaranteesApi,
  settingsApi,
  aboutApi,
  legalApi,
  contactsApi,
  mediaApi,
} from '../services/api/admin.api';

import type {
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
} from '../services/api/admin.types';

// ── Types ────────────────────────────────────────────────────

interface LoadingState {
  global: boolean;
  blog: boolean;
  projects: boolean;
  services: boolean;
  team: boolean;
  testimonials: boolean;
  faq: boolean;
  homepage: boolean;
  settings: boolean;
  about: boolean;
  legal: boolean;
  contacts: boolean;
  media: boolean;
  saving: string | null; // entity being saved
}

// ── Hook ─────────────────────────────────────────────────────

export function useAdminCMS() {
  const [authenticated, setAuthenticated] = useState(false);

  // Collections
  const [blog, setBlog] = useState<AdminBlogPost[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [team, setTeam] = useState<AdminTeamMember[]>([]);
  const [testimonials, setTestimonials] = useState<AdminTestimonial[]>([]);
  const [partners, setPartners] = useState<AdminPartner[]>([]);
  const [faqCategories, setFaqCategories] = useState<AdminFaqCategory[]>([]);
  const [faqItems, setFaqItems] = useState<AdminFaqItem[]>([]);
  const [heroSlides, setHeroSlides] = useState<AdminHeroSlide[]>([]);
  const [engagements, setEngagements] = useState<AdminEngagement[]>([]);
  const [methodology, setMethodology] = useState<AdminMethodologyStep[]>([]);
  const [stats, setStats] = useState<AdminStat[]>([]);
  const [guarantees, setGuarantees] = useState<AdminGuarantee[]>([]);
  const [contacts, setContacts] = useState<AdminContact[]>([]);
  const [mediaItems, setMediaItems] = useState<AdminMedia[]>([]);

  // Singletons
  const [siteSettings, setSiteSettings] = useState<AdminSiteSettings | null>(null);
  const [aboutContent, setAboutContent] = useState<AdminAboutContent | null>(null);
  const [legalPages, setLegalPages] = useState<Record<string, AdminLegalPage>>({});

  // UI state
  const [loading, setLoading] = useState<LoadingState>({
    global: true,
    blog: false, projects: false, services: false, team: false,
    testimonials: false, faq: false, homepage: false, settings: false,
    about: false, legal: false, contacts: false, media: false,
    saving: null,
  });
  const [error, setError] = useState<string | null>(null);

  // ── Auth + initial fetch ───────────────────────────────────

  useEffect(() => {
    (async () => {
      setLoading(l => ({ ...l, global: true }));
      const ok = await ensureAuth();
      setAuthenticated(ok);
      if (ok) await fetchAll();
      setLoading(l => ({ ...l, global: false }));
    })();
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [
        blogData, projectsData, servicesData, teamData,
        testimonialsData, partnersData, faqCatsData, faqItemsData,
        heroData, engData, methData, statsData,
        guarData, contactsData, mediaData,
        settingsData, aboutData,
      ] = await Promise.allSettled([
        blogApi.list(),
        projectsApi.list(),
        servicesApi.list(),
        teamApi.list(),
        testimonialsApi.list(),
        partnersApi.list(),
        faqCategoriesApi.list(),
        faqItemsApi.list(),
        heroSlidesApi.list(),
        engagementsApi.list(),
        methodologyApi.list(),
        statsApi.list(),
        guaranteesApi.list(),
        contactsApi.list(),
        mediaApi.list(),
        settingsApi.get(),
        aboutApi.get(),
      ]);

      if (blogData.status === 'fulfilled') setBlog(blogData.value);
      if (projectsData.status === 'fulfilled') setProjects(projectsData.value);
      if (servicesData.status === 'fulfilled') setServices(servicesData.value);
      if (teamData.status === 'fulfilled') setTeam(teamData.value);
      if (testimonialsData.status === 'fulfilled') setTestimonials(testimonialsData.value);
      if (partnersData.status === 'fulfilled') setPartners(partnersData.value);
      if (faqCatsData.status === 'fulfilled') setFaqCategories(faqCatsData.value);
      if (faqItemsData.status === 'fulfilled') setFaqItems(faqItemsData.value);
      if (heroData.status === 'fulfilled') setHeroSlides(heroData.value);
      if (engData.status === 'fulfilled') setEngagements(engData.value);
      if (methData.status === 'fulfilled') setMethodology(methData.value);
      if (statsData.status === 'fulfilled') setStats(statsData.value);
      if (guarData.status === 'fulfilled') setGuarantees(guarData.value);
      if (contactsData.status === 'fulfilled') setContacts(contactsData.value);
      if (mediaData.status === 'fulfilled') setMediaItems(mediaData.value);
      if (settingsData.status === 'fulfilled') setSiteSettings(settingsData.value);
      if (aboutData.status === 'fulfilled') setAboutContent(aboutData.value);

      // Legal pages
      try {
        const [legal, privacy, terms, cookies] = await Promise.allSettled([
          legalApi.get('mentions-legales'),
          legalApi.get('politique-de-confidentialite'),
          legalApi.get('termes-et-conditions'),
          legalApi.get('cookies'),
        ]);
        const pages: Record<string, AdminLegalPage> = {};
        if (legal.status === 'fulfilled') pages['legalNotice'] = legal.value;
        if (privacy.status === 'fulfilled') pages['privacy'] = privacy.value;
        if (terms.status === 'fulfilled') pages['terms'] = terms.value;
        if (cookies.status === 'fulfilled') pages['cookies'] = cookies.value;
        setLegalPages(pages);
      } catch { /* legal pages are optional */ }
    } catch (e) {
      console.error('[AdminCMS] Fetch error:', e);
      setError('Erreur lors du chargement des données');
    }
  }, []);

  // ── Blog CRUD ──────────────────────────────────────────────

  const createBlog = useCallback(async (data: Partial<AdminBlogPost>) => {
    setLoading(l => ({ ...l, saving: 'blog' }));
    try {
      const res = await blogApi.create(data);
      const updated = await blogApi.list();
      setBlog(updated);
      return res;
    } finally {
      setLoading(l => ({ ...l, saving: null }));
    }
  }, []);

  const updateBlog = useCallback(async (id: string, data: Partial<AdminBlogPost>) => {
    setLoading(l => ({ ...l, saving: 'blog' }));
    try {
      const res = await blogApi.update(id, data);
      const updated = await blogApi.list();
      setBlog(updated);
      return res;
    } finally {
      setLoading(l => ({ ...l, saving: null }));
    }
  }, []);

  const deleteBlog = useCallback(async (id: string) => {
    setLoading(l => ({ ...l, saving: 'blog' }));
    try {
      const res = await blogApi.delete(id);
      setBlog(prev => prev.filter(p => p.id !== id));
      return res;
    } finally {
      setLoading(l => ({ ...l, saving: null }));
    }
  }, []);

  // ── Generic entity CRUD factory ────────────────────────────

  function makeCrud<T extends { id: string }>(
    api: { list: () => Promise<T[]>; create: (d: Partial<T>) => Promise<any>; update: (id: string, d: Partial<T>) => Promise<any>; delete: (id: string) => Promise<any> },
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    key: string,
  ) {
    return {
      create: async (data: Partial<T>) => {
        setLoading(l => ({ ...l, saving: key }));
        try {
          const res = await api.create(data);
          const updated = await api.list();
          setter(updated);
          return res;
        } finally {
          setLoading(l => ({ ...l, saving: null }));
        }
      },
      update: async (id: string, data: Partial<T>) => {
        setLoading(l => ({ ...l, saving: key }));
        try {
          const res = await api.update(id, data);
          const updated = await api.list();
          setter(updated);
          return res;
        } finally {
          setLoading(l => ({ ...l, saving: null }));
        }
      },
      delete: async (id: string) => {
        setLoading(l => ({ ...l, saving: key }));
        try {
          const res = await api.delete(id);
          setter(prev => prev.filter(item => item.id !== id));
          return res;
        } finally {
          setLoading(l => ({ ...l, saving: null }));
        }
      },
    };
  }

  const projectsCrud = makeCrud(projectsApi, setProjects, 'projects');
  const servicesCrud = makeCrud(servicesApi, setServices, 'services');
  const teamCrud = makeCrud(teamApi, setTeam, 'team');
  const testimonialsCrud = makeCrud(testimonialsApi, setTestimonials, 'testimonials');
  const partnersCrud = makeCrud(partnersApi, setPartners, 'partners');
  const faqCategoriesCrud = makeCrud(faqCategoriesApi, setFaqCategories, 'faqCategories');
  const faqItemsCrud = makeCrud(faqItemsApi, setFaqItems, 'faqItems');
  const heroSlidesCrud = makeCrud(heroSlidesApi, setHeroSlides, 'heroSlides');
  const engagementsCrud = makeCrud(engagementsApi, setEngagements, 'engagements');
  const methodologyCrud = makeCrud(methodologyApi, setMethodology, 'methodology');
  const statsCrud = makeCrud(statsApi, setStats, 'stats');
  const guaranteesCrud = makeCrud(guaranteesApi, setGuarantees, 'guarantees');

  // ── Singleton updates ──────────────────────────────────────

  const updateSettings = useCallback(async (data: Partial<AdminSiteSettings>) => {
    setLoading(l => ({ ...l, saving: 'settings' }));
    try {
      await settingsApi.update(data);
      const updated = await settingsApi.get();
      setSiteSettings(updated);
    } finally {
      setLoading(l => ({ ...l, saving: null }));
    }
  }, []);

  const updateAbout = useCallback(async (data: Partial<AdminAboutContent>) => {
    setLoading(l => ({ ...l, saving: 'about' }));
    try {
      await aboutApi.update(data);
      const updated = await aboutApi.get();
      setAboutContent(updated);
    } finally {
      setLoading(l => ({ ...l, saving: null }));
    }
  }, []);

  const updateLegal = useCallback(async (slug: string, tabKey: string, data: Partial<AdminLegalPage>) => {
    setLoading(l => ({ ...l, saving: 'legal' }));
    try {
      await legalApi.update(slug, data);
      const updated = await legalApi.get(slug);
      setLegalPages(prev => ({ ...prev, [tabKey]: updated }));
    } finally {
      setLoading(l => ({ ...l, saving: null }));
    }
  }, []);

  // ── Contacts ───────────────────────────────────────────────

  const markContactRead = useCallback(async (id: string) => {
    await contactsApi.markRead(id);
    setContacts(prev => prev.map(c => c.id === id ? { ...c, is_read: true } : c));
  }, []);

  const replyContact = useCallback(async (id: string, message: string) => {
    await contactsApi.reply(id, message);
    setContacts(prev => prev.map(c => c.id === id ? { ...c, is_read: true, replied: true } : c));
  }, []);

  // ── Media ──────────────────────────────────────────────────

  const uploadMedia = useCallback(async (file: File, name?: string, folder?: string) => {
    setLoading(l => ({ ...l, saving: 'media' }));
    try {
      const res = await mediaApi.upload(file, name, folder);
      const updated = await mediaApi.list();
      setMediaItems(updated);
      return res;
    } finally {
      setLoading(l => ({ ...l, saving: null }));
    }
  }, []);

  const importYouTube = useCallback(async (url: string, name?: string) => {
    setLoading(l => ({ ...l, saving: 'media' }));
    try {
      const res = await mediaApi.importYouTube(url, name);
      const updated = await mediaApi.list();
      setMediaItems(updated);
      return res;
    } finally {
      setLoading(l => ({ ...l, saving: null }));
    }
  }, []);

  const deleteMedia = useCallback(async (id: string) => {
    setLoading(l => ({ ...l, saving: 'media' }));
    try {
      await mediaApi.delete(id);
      setMediaItems(prev => prev.filter(m => m.id !== id));
    } finally {
      setLoading(l => ({ ...l, saving: null }));
    }
  }, []);

  // ── Computed stats ─────────────────────────────────────────

  const blogStats = {
    published: blog.filter(b => b.status === 'published' || b.status === 'Publié').length,
    draft: blog.filter(b => b.status === 'draft' || b.status === 'Brouillon').length,
    scheduled: blog.filter(b => b.status === 'scheduled' || b.status === 'Planifié').length,
    total: blog.length,
  };

  const mediaStats = {
    total: mediaItems.length,
    images: mediaItems.filter(m => m.type === 'image').length,
    videos: mediaItems.filter(m => m.type === 'video' || m.type === 'youtube').length,
    documents: mediaItems.filter(m => m.type === 'document').length,
  };

  const contactStats = {
    total: contacts.length,
    unread: contacts.filter(c => !c.is_read).length,
  };

  return {
    // Auth
    authenticated,

    // Collections
    blog, projects, services, team, testimonials, partners,
    faqCategories, faqItems, heroSlides, engagements,
    methodology, stats, guarantees, contacts, mediaItems,

    // Singletons
    siteSettings, aboutContent, legalPages,

    // Blog CRUD
    createBlog, updateBlog, deleteBlog,

    // Entity CRUDs
    projectsCrud, servicesCrud, teamCrud, testimonialsCrud,
    partnersCrud, faqCategoriesCrud, faqItemsCrud, heroSlidesCrud,
    engagementsCrud, methodologyCrud, statsCrud, guaranteesCrud,

    // Singleton updates
    updateSettings, updateAbout, updateLegal,

    // Contacts
    markContactRead, replyContact,

    // Media
    uploadMedia, importYouTube, deleteMedia,

    // Computed stats
    blogStats, mediaStats, contactStats,

    // UI state
    loading, error,
    isSaving: loading.saving !== null,
    savingEntity: loading.saving,

    // Refresh
    refreshAll: fetchAll,
  };
}
