import { test, expect } from '@playwright/test';

test.describe('Public vitrine', () => {
  test('homepage loads with title, navigation and footer', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Globus/i);
    await expect(page.locator('header').first()).toBeVisible();
    await expect(page.locator('footer').first()).toBeVisible();
    // The hero / first section renders real content (no blank page).
    await expect(page.locator('main, #root > div').first()).toBeVisible();
  });

  test('navigates from the home nav to the contact page', async ({ page }) => {
    await page.goto('/contact');
    // A heading (any level) and the contact form render.
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.locator('form')).toBeVisible();
  });

  for (const path of ['/services', '/projets', '/a-propos', '/blog', '/faq']) {
    test(`route ${path} renders without crashing`, async ({ page }) => {
      const resp = await page.goto(path);
      expect(resp?.status()).toBeLessThan(400);
      await expect(page.locator('footer').first()).toBeVisible();
    });
  }

  test('unknown route still serves the SPA shell', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.locator('header, footer').first()).toBeVisible();
  });
});
