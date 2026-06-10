/**
 * Vitest setup — runs before every test file.
 *
 * Loads jest-dom matchers (toBeInTheDocument, toHaveTextContent, etc.) and
 * stubs a few browser APIs that jsdom doesn't ship with by default.
 */
import '@testing-library/jest-dom/vitest';
import { vi, expect, beforeAll, afterEach, afterAll } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';
import { server } from './msw/server';

// axe-core accessibility matcher (toHaveNoViolations).
expect.extend(axeMatchers);

// ── MSW lifecycle ────────────────────────────────────────────
// `bypass` lets requests with no matching handler hit the real network layer
// (harmless in jsdom — they simply fail) instead of throwing, so component
// tests that fan out to many endpoints stay focused on what they mock.
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// jsdom doesn't implement `matchMedia` — some libs (framer-motion) call it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// IntersectionObserver — used by framer-motion / react-router for scroll restoration.
(window as any).IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
};

// URL.createObjectURL — used by download helpers.
if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn(() => 'blob:mock');
  window.URL.revokeObjectURL = vi.fn();
}
