import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright e2e — drives the built SPA via `vite preview`.
 *
 * The public vitrine and the auth screens render fully without a backend (data
 * queries simply resolve to adapted empty states), so these smoke tests need no
 * API server. Authenticated ERP/client journeys are covered by the backend
 * pytest integration suite.
 */
const PORT = Number(process.env.E2E_PORT || 4173);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
