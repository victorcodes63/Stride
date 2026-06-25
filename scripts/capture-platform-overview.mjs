/**
 * Capture dashboard overview (modules grid) for platform marketing hero.
 * Usage: MARKETING_CAPTURE_BASE_URL=http://127.0.0.1:3000 node scripts/capture-platform-overview.mjs
 */

import { chromium } from 'playwright';
import { mkdir, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'images');
const OUT_FILE = 'platform_modules.png';

const BASE_URL = process.env.MARKETING_CAPTURE_BASE_URL ?? 'http://127.0.0.1:3000';
const PATH = '/dashboard';
const THEME_STORAGE_KEY = 'hris-dashboard:theme';

function loadEnvLocal() {
  const env = {};
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
  return env;
}

async function main() {
  const env = loadEnvLocal();
  const email = process.env.CAPTURE_EMAIL ?? env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL;
  const password = process.env.CAPTURE_PASSWORD ?? env.NEXT_PUBLIC_DEMO_PASSWORD;

  if (!email || !password) {
    throw new Error('Missing NEXT_PUBLIC_DEMO_ADMIN_EMAIL or NEXT_PUBLIC_DEMO_PASSWORD in .env.local');
  }

  mkdir(OUT_DIR, { recursive: true }, () => {});

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });

  await context.addInitScript((key) => {
    try {
      localStorage.setItem(key, 'dark');
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } catch {
      /* ignore */
    }
  }, THEME_STORAGE_KEY);

  const page = await context.newPage();

  console.log(`Signing in at ${BASE_URL}…`);
  await page.goto(`${BASE_URL}/dashboard/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByLabel('Email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/dashboard') && !url.pathname.includes('/login'), {
    timeout: 60_000,
  });

  await page.goto(`${BASE_URL}${PATH}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.getByText(/Good (morning|afternoon|evening)|Across your business|Operations overview|Business snapshot/i).first().waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    document.querySelectorAll('[data-marketing-screenshot-hide]').forEach((el) => {
      el.style.display = 'none';
    });
  });

  const outPath = join(OUT_DIR, OUT_FILE);
  await page.screenshot({
    path: outPath,
    type: 'png',
    clip: { x: 0, y: 0, width: 1440, height: 900 },
  });

  console.log(`Saved ${outPath}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
