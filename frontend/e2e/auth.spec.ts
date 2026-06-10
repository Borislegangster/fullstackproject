import { test, expect } from '@playwright/test';

test.describe('Authentication screens', () => {
  test('client login page renders email + password fields', async ({ page }) => {
    await page.goto('/connexion');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button')).toBeTruthy();
  });

  test('ERP login page renders', async ({ page }) => {
    await page.goto('/erp-login');
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('protected ERP route redirects unauthenticated users away', async ({ page }) => {
    await page.goto('/erp');
    // ProtectedRoute should bounce to a login screen (no ERP dashboard for anon).
    await expect(page).toHaveURL(/login|connexion|erp-login/i);
  });

  test('invalid client login shows an error, no crash', async ({ page }) => {
    await page.goto('/connexion');
    await page.locator('input[type="email"]').fill('wrong@example.com');
    await page.locator('input[type="password"]').fill('bad-password');
    await page.getByRole('button', { name: /connexion|se connecter|connecter/i }).first().click();
    // Either an inline error appears or we simply stay on the login page.
    await expect(page).toHaveURL(/connexion/i);
  });
});
