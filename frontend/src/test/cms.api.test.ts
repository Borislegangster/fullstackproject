/**
 * cms.api — Phase 9 unit tests.
 *
 * Verifies that every public CMS getter hits the right `/cms/*` endpoint and
 * that errors propagate (no silent mock fallback). axiosClient is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/api/axiosClient', () => ({
  axiosClient: { get: vi.fn(), post: vi.fn() },
}));

import { axiosClient } from '../services/api/axiosClient';
import {
  getHeroSlides, getHeroVideo, getCtaBanner, getVideoSection, getOngoingProject,
  getServices, getProjects, getStats, getTeamMembers, getTestimonials,
  getServicesPage, getProjectsPage, getAllBlogPosts, getFaqPage,
  getServiceBySlug, getProjectBySlug, getBlogPostBySlug, getLegalPage,
  submitContactForm, subscribeNewsletter,
} from '../services/api/cms.api';

beforeEach(() => vi.clearAllMocks());

const okGet = (data: unknown) => (axiosClient.get as any).mockResolvedValueOnce({ data });
const okPost = (data: unknown) => (axiosClient.post as any).mockResolvedValueOnce({ data });

describe('cms.api — GET endpoints map to the right URL', () => {
  it.each([
    ['getHeroSlides', getHeroSlides, '/cms/hero-slides'],
    ['getHeroVideo', getHeroVideo, '/cms/hero-video'],
    ['getCtaBanner', getCtaBanner, '/cms/cta-banner'],
    ['getVideoSection', getVideoSection, '/cms/video-section'],
    ['getOngoingProject', getOngoingProject, '/cms/ongoing-project'],
    ['getServices', getServices, '/cms/services'],
    ['getProjects', getProjects, '/cms/projects'],
    ['getStats', getStats, '/cms/stats'],
    ['getTeamMembers', getTeamMembers, '/cms/team'],
    ['getTestimonials', getTestimonials, '/cms/testimonials'],
    ['getServicesPage', getServicesPage, '/cms/services-page'],
    ['getProjectsPage', getProjectsPage, '/cms/projects-page'],
    ['getAllBlogPosts', getAllBlogPosts, '/cms/blog'],
    ['getFaqPage', getFaqPage, '/cms/faq'],
  ])('%s → %s', async (_name, fn, url) => {
    okGet([]);
    await (fn as () => Promise<unknown>)();
    expect(axiosClient.get).toHaveBeenCalledWith(url);
  });

  it('slug getters interpolate the slug', async () => {
    okGet({}); await getServiceBySlug('construction');
    expect(axiosClient.get).toHaveBeenCalledWith('/cms/services/construction');

    okGet({}); await getProjectBySlug('villa-test');
    expect(axiosClient.get).toHaveBeenCalledWith('/cms/projects/villa-test');

    okGet({}); await getBlogPostBySlug('article-test');
    expect(axiosClient.get).toHaveBeenCalledWith('/cms/blog/article-test');

    okGet({}); await getLegalPage('mentions-legales');
    expect(axiosClient.get).toHaveBeenCalledWith('/cms/legal/mentions-legales');
  });

  it('returns the response body unchanged', async () => {
    const payload = [{ tag: 'A', title: 'T' }];
    okGet(payload);
    await expect(getHeroSlides()).resolves.toEqual(payload);
  });
});

describe('cms.api — errors propagate (no mock fallback)', () => {
  it('rejects when the API errors', async () => {
    (axiosClient.get as any).mockRejectedValueOnce(new Error('Network 500'));
    await expect(getServices()).rejects.toThrow('Network 500');
  });

  it('a 404 on a slug getter rejects rather than returning a default', async () => {
    (axiosClient.get as any).mockRejectedValueOnce({ response: { status: 404 } });
    await expect(getServiceBySlug('nope')).rejects.toBeTruthy();
  });
});

describe('cms.api — POST endpoints', () => {
  it('submitContactForm posts to the contact endpoint', async () => {
    okPost({ success: true, message: 'ok' });
    const out = await submitContactForm({
      name: 'X', email: 'x@y.z', phone: '', subject: 'S', message: 'M',
    } as any);
    expect(axiosClient.post).toHaveBeenCalledWith('/cms/contact/submit', expect.objectContaining({ email: 'x@y.z' }));
    expect(out.success).toBe(true);
  });

  it('subscribeNewsletter posts to the newsletter endpoint', async () => {
    okPost({ success: true, message: 'ok' });
    await subscribeNewsletter({ email: 'n@y.z' } as any);
    expect(axiosClient.post).toHaveBeenCalledWith('/cms/newsletter/subscribe', { email: 'n@y.z' });
  });
});
