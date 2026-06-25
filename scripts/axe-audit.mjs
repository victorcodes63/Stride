/**
 * WCAG axe audit — public + authenticated dashboard/ESS pages.
 * Usage: AXE_BASE_URL=http://127.0.0.1:3000 node scripts/axe-audit.mjs
 */
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE_URL = process.env.AXE_BASE_URL ?? 'http://127.0.0.1:3000';

function loadEnvLocal() {
  const env = {};
  try {
    const path = join(ROOT, '.env.local');
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      let val = trimmed.slice(eq + 1);
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  } catch {
    /* optional */
  }
  return env;
}

const env = loadEnvLocal();
const STAFF_EMAIL = process.env.AXE_STAFF_EMAIL ?? env.DEMO_UNIFIED_ADMIN_EMAIL ?? 'admin@demo.getstride.co.ke';
const STAFF_PASSWORD = process.env.AXE_STAFF_PASSWORD ?? env.NEXT_PUBLIC_DEMO_PASSWORD ?? 'Demo@2026!';
const ESS_EMAIL = process.env.AXE_ESS_EMAIL ?? env.NEXT_PUBLIC_DEMO_ESS_EMAIL ?? 'employee@heritage.demo.getstride.co.ke';
const ESS_PASSWORD = process.env.AXE_ESS_PASSWORD ?? env.NEXT_PUBLIC_DEMO_PASSWORD ?? 'Demo@2026!';

async function runAxe(page, label) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();

  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    help: v.help,
    nodes: v.nodes.length,
    targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }));

  return { label, url: page.url(), violationCount: violations.length, violations };
}

async function staffLogin(page) {
  await page.goto(`${BASE_URL}/dashboard/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', STAFF_EMAIL);
  await page.fill('#password', STAFF_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
}

async function essLogin(page) {
  await page.goto(`${BASE_URL}/ess/login`, { waitUntil: 'networkidle' });
  await page.fill('#ess-email', ESS_EMAIL);
  await page.fill('#ess-password', ESS_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname === '/ess' || url.pathname.startsWith('/ess/'), {
    timeout: 30_000,
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const reports = [];

  const publicPages = [
    { path: '/', label: 'Marketing home' },
    { path: '/dashboard/login', label: 'Staff login' },
    { path: '/ess/login', label: 'ESS login' },
  ];

  for (const { path, label } of publicPages) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
    reports.push(await runAxe(page, label));
  }

  const assertAuthenticated = (page, expectedPrefix, label) => {
    const url = new URL(page.url());
    if (url.pathname.includes('/login') || url.searchParams.has('from')) {
      throw new Error(`${label}: still on login (${url.pathname}${url.search})`);
    }
    if (!url.pathname.startsWith(expectedPrefix)) {
      throw new Error(`${label}: unexpected path ${url.pathname}`);
    }
  };

  try {
    await staffLogin(page);
    assertAuthenticated(page, '/dashboard', 'Staff login');
    for (const { path, label } of [
      { path: '/dashboard', label: 'Dashboard home' },
      { path: '/dashboard/procurement/spend', label: 'Procurement spend' },
      { path: '/dashboard/employees', label: 'Employees' },
    ]) {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      reports.push(await runAxe(page, label));
    }
  } catch (err) {
    reports.push({
      label: 'Dashboard (authenticated)',
      url: page.url(),
      violationCount: -1,
      violations: [{ id: 'login-failed', impact: 'critical', description: String(err), nodes: 0, targets: [] }],
    });
  }

  const essContext = await browser.newContext();
  const essPage = await essContext.newPage();
  try {
    await essLogin(essPage);
    assertAuthenticated(essPage, '/ess', 'ESS login');
    for (const { path, label } of [
      { path: '/ess', label: 'ESS home' },
      { path: '/ess/work', label: 'ESS work hub' },
      { path: '/ess/procurement', label: 'ESS procurement' },
    ]) {
      await essPage.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
      await essPage.waitForTimeout(1000);
      reports.push(await runAxe(essPage, label));
    }
  } catch (err) {
    reports.push({
      label: 'ESS (authenticated)',
      url: essPage.url(),
      violationCount: -1,
      violations: [{ id: 'login-failed', impact: 'critical', description: String(err), nodes: 0, targets: [] }],
    });
  }

  await browser.close();

  const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  let totalViolations = 0;
  let criticalSerious = 0;

  console.log('\n=== Stride axe audit (WCAG 2.1 AA tags) ===\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  for (const report of reports) {
    if (report.violationCount < 0) {
      console.log(`✗ ${report.label} — ${report.violations[0]?.description}\n`);
      continue;
    }
    totalViolations += report.violationCount;
    const cs = report.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    criticalSerious += cs.length;

    const icon = report.violationCount === 0 ? '✓' : report.violationCount <= 2 ? '△' : '✗';
    console.log(`${icon} ${report.label} (${report.url})`);
    console.log(`   ${report.violationCount} violation rule(s)\n`);

    const sorted = [...report.violations].sort(
      (a, b) => (impactOrder[a.impact] ?? 9) - (impactOrder[b.impact] ?? 9),
    );
    for (const v of sorted) {
      console.log(`   [${v.impact}] ${v.id} (${v.nodes} nodes)`);
      console.log(`         ${v.help}`);
      for (const t of v.targets) console.log(`         → ${t}`);
    }
    console.log('');
  }

  console.log('--- Summary ---');
  console.log(`Pages scanned: ${reports.length}`);
  console.log(`Total violation rules: ${totalViolations}`);
  console.log(`Critical + serious rules: ${criticalSerious}`);

  process.exit(criticalSerious > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
