#!/usr/bin/env node
/**
 * RAV-46 — Marketing site smoke test (getstride.co.ke).
 *
 * Usage:
 *   SMOKE_MARKETING_BASE_URL=https://getstride.co.ke npm run smoke:marketing
 */

import { chromium, devices } from 'playwright';

const BASE_URL = (process.env.SMOKE_MARKETING_BASE_URL || 'https://getstride.co.ke').replace(/\/$/, '');
const APP_ORIGIN = (process.env.SMOKE_MARKETING_APP_ORIGIN || 'https://app.getstride.co.ke').replace(
  /\/$/,
  '',
);

const NAV_PATHS = ['/', '/platform', '/industries', '/pricing', '/about', '/contact'];
const FOOTER_PATHS = ['/privacy', '/terms'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function step(label, fn) {
  await fn();
  console.log(`✓ ${label}`);
}

async function fetchRoute(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { redirect: 'manual' });
  return { url, res };
}

async function main() {
  console.log(`\nMarketing smoke test → ${BASE_URL}\n`);

  for (const path of NAV_PATHS) {
    await step(`Nav ${path}`, async () => {
      const { res } = await fetchRoute(path);
      assert(res.status === 200, `${path} returned ${res.status}`);
    });
  }

  for (const path of FOOTER_PATHS) {
    await step(`Footer ${path}`, async () => {
      const { res } = await fetchRoute(path);
      assert(res.status === 200, `${path} returned ${res.status}`);
    });
  }

  await step('/careers redirects to app', async () => {
    const { res } = await fetchRoute('/careers');
    assert(
      res.status >= 300 && res.status < 400,
      `/careers returned ${res.status} (expected redirect to app)`,
    );
    const location = res.headers.get('location') ?? '';
    assert(
      location.includes('careers') && location.startsWith(APP_ORIGIN),
      `/careers redirect unexpected: ${location}`,
    );
  });

  await step('robots.txt disallows app surfaces', async () => {
    const { res } = await fetchRoute('/robots.txt');
    assert(res.status === 200, `/robots.txt returned ${res.status}`);
    const body = await res.text();
    assert(body.includes('Disallow: /dashboard/'), 'robots.txt missing /dashboard/ disallow');
    assert(body.includes('Disallow: /api/'), 'robots.txt missing /api/ disallow');
    assert(body.includes('Disallow: /ess/'), 'robots.txt missing /ess/ disallow');
    assert(body.includes('Sitemap:'), 'robots.txt missing sitemap reference');
  });

  await step('sitemap.xml lists core marketing routes', async () => {
    const { res } = await fetchRoute('/sitemap.xml');
    assert(res.status === 200, `/sitemap.xml returned ${res.status}`);
    const body = await res.text();
    for (const segment of [
      '/platform',
      '/industries',
      '/industries/logistics',
      '/pricing',
      '/about',
      '/contact',
      '/privacy',
      '/terms',
    ]) {
      assert(body.includes(segment), `sitemap.xml missing ${segment}`);
    }
    assert(!body.includes('/careers'), 'sitemap.xml must not list /careers (app-only)');
    assert(!body.includes('/services'), 'sitemap.xml still lists legacy /services');
    assert(!body.includes('/resources'), 'sitemap.xml still lists legacy /resources');
    assert(!body.includes('/insights'), 'sitemap.xml still lists legacy /insights');
  });

  await step('Home OG image asset', async () => {
    const { res } = await fetchRoute('/og/stride-default.png');
    assert(res.status === 200, `/og/stride-default.png returned ${res.status}`);
  });

  await step('Book demo API accepts lead', async () => {
    const res = await fetch(`${BASE_URL}/api/marketing/demo-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Smoke',
        lastName: 'Test',
        email: `smoke+${Date.now()}@example.com`,
        company: 'Stride QA',
        teamSize: '11–50',
        interest: 'Booking a demo',
        modules: ['HR & Payroll'],
        message: 'Automated marketing smoke test — safe to discard.',
      }),
    });
    const data = await res.json();
    assert(res.ok && data.ok === true, `Demo API failed: ${JSON.stringify(data)}`);
  });

  const browser = await chromium.launch({ headless: true });

  try {
    const consoleErrors = [];

    await step('Home — no console errors', async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(`home: ${msg.text()}`);
      });
      page.on('pageerror', (err) => consoleErrors.push(`home: ${err.message}`));

      const res = await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      assert(res?.ok(), `Home load failed: ${res?.status()}`);
      await page.getByRole('navigation', { name: 'Primary' }).waitFor({ state: 'visible', timeout: 15_000 });
      await page.waitForTimeout(800);
      await context.close();

      const filtered = consoleErrors.filter(
        (line) => !line.includes('favicon') && !line.includes('404'),
      );
      assert(filtered.length === 0, `Console errors on home:\n${filtered.join('\n')}`);
    });

    await step('Contact — no console errors', async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      const contactErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') contactErrors.push(msg.text());
      });
      page.on('pageerror', (err) => contactErrors.push(err.message));

      const res = await page.goto(`${BASE_URL}/contact`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      assert(res?.ok(), `Contact load failed: ${res?.status()}`);
      await page.getByLabel(/first name/i).waitFor({ state: 'visible', timeout: 20_000 });
      await context.close();

      const filtered = contactErrors.filter(
        (line) => !line.includes('favicon') && !line.includes('404'),
      );
      assert(filtered.length === 0, `Console errors on contact:\n${filtered.join('\n')}`);
    });

    await step('Mobile nav opens (iPhone width)', async () => {
      const iphone = devices['iPhone 13'];
      const context = await browser.newContext({ ...iphone });
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

      const menuButton = page.getByRole('button', { name: /open menu|close menu/i });
      await menuButton.click();
      await page.getByLabel('Mobile').getByRole('link', { name: 'Pricing' }).waitFor({ state: 'visible', timeout: 10_000 });
      await context.close();
    });

    await step('Mobile nav opens (Android width)', async () => {
      const context = await browser.newContext({
        viewport: { width: 412, height: 915 },
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

      const menuButton = page.getByRole('button', { name: /open menu|close menu/i });
      await menuButton.click();
      await page.getByLabel('Mobile').getByRole('link', { name: 'Platform' }).waitFor({ state: 'visible', timeout: 10_000 });
      await context.close();
    });

    await step('Industries — no duplicate Platform architecture section', async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      const res = await page.goto(`${BASE_URL}/industries`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      assert(res?.ok(), `/industries load failed: ${res?.status()}`);
      const bodyText = await page.locator('body').innerText();
      const archCount = (bodyText.match(/Platform architecture/gi) || []).length;
      assert(archCount === 0, `Expected 0 "Platform architecture" on /industries, found ${archCount}`);
      await page.getByText(/sectors we serve/i).waitFor({ state: 'visible', timeout: 15_000 });
      await context.close();
    });

    await step('Home LCP element present (hero)', async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 60_000 });

      const heroHeading = page.getByRole('heading', { level: 1 });
      await heroHeading.waitFor({ state: 'visible', timeout: 15_000 });
      const box = await heroHeading.boundingBox();
      assert(box && box.height > 0, 'Hero heading not visible for LCP check');
      await context.close();
    });
  } finally {
    await browser.close();
  }

  console.log('\nMarketing smoke test: PASS\n');
}

main().catch((err) => {
  console.error('\nMarketing smoke test: FAIL');
  console.error(err.message || err);
  process.exit(1);
});
