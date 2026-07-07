import { test, expect } from '@playwright/test';
import { cpLogin, requireEnv } from './helpers';

/**
 * QA-03 Surface 3 — Control plane operator path (customers, entitlements, lifecycle).
 */
test.describe('Control plane happy path', () => {
  test.skip(!process.env.E2E_CP_EMAIL || !process.env.E2E_CP_PASSWORD, 'E2E_CP_EMAIL/PASSWORD not set');

  test('operator can open customers and lifecycle controls', async ({ page }) => {
    await cpLogin(page, requireEnv('E2E_CP_EMAIL'), requireEnv('E2E_CP_PASSWORD'));

    await page.goto('/customers');
    await expect(page.getByRole('heading', { name: /customers/i })).toBeVisible();

    const firstLink = page.locator('a[href^="/customers/"]').first();
    if (await firstLink.count()) {
      await firstLink.click();
      await expect(page.getByText(/account status/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /update status/i })).toBeVisible();
    }
  });
});
