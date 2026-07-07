import { test, expect } from '@playwright/test';
import { essLogin, requireEnv, staffLogin } from './helpers';

/**
 * QA-03 Surface 2 — App + ESS lifecycle smoke (onboard paths, payroll, leave, finance, reports).
 */
test.describe('App + ESS happy path', () => {
  test.skip(!process.env.E2E_STAFF_EMAIL || !process.env.E2E_STAFF_PASSWORD, 'E2E_STAFF_EMAIL/PASSWORD not set');

  test('staff reaches payroll, finance, and reports', async ({ page }) => {
    const email = requireEnv('E2E_STAFF_EMAIL');
    const password = requireEnv('E2E_STAFF_PASSWORD');

    await staffLogin(page, email, password);

    for (const path of ['/dashboard/employees', '/dashboard/payroll', '/dashboard/accounts', '/dashboard/reports']) {
      const res = await page.goto(path);
      expect(res?.status()).toBeLessThan(500);
    }
  });

  test('ESS employee can open payslips and leave', async ({ page }) => {
    test.skip(!process.env.E2E_ESS_EMAIL || !process.env.E2E_ESS_PASSWORD, 'E2E_ESS_EMAIL/PASSWORD not set');

    await essLogin(page, requireEnv('E2E_ESS_EMAIL'), requireEnv('E2E_ESS_PASSWORD'));

    for (const path of ['/ess/payslips', '/ess/leave', '/ess/profile']) {
      const res = await page.goto(path);
      expect(res?.status()).toBeLessThan(500);
    }
  });
});
