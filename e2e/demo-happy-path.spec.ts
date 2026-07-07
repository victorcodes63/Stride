import { test, expect } from '@playwright/test';
import { requireEnv, staffLogin } from './helpers';

/**
 * QA-03 Surface 1 — Demo happy path (login → payslip → leave → invoice → ESS).
 * Requires a demo/staging tenant with entitled modules.
 */
test.describe('Demo surface happy path', () => {
  test.skip(!process.env.E2E_DEMO_EMAIL || !process.env.E2E_DEMO_PASSWORD, 'E2E_DEMO_EMAIL/PASSWORD not set');

  test('staff can reach core demo destinations without dead ends', async ({ page }) => {
    const email = requireEnv('E2E_DEMO_EMAIL');
    const password = requireEnv('E2E_DEMO_PASSWORD');

    await staffLogin(page, email, password);

    const paths = [
      '/dashboard',
      '/dashboard/employees',
      '/dashboard/payroll',
      '/dashboard/leave',
      '/dashboard/accounts',
      '/dashboard/fleet',
    ];

    for (const path of paths) {
      await page.goto(path);
      await expect(page.locator('body')).not.toContainText(/coming soon/i);
      await expect(page.locator('body')).not.toContainText(/module unavailable/i);
    }

    await page.goto('/ess/login');
    await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
  });
});
