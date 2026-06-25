/**
 * Capture homepage hero + statutory marketing screenshots.
 *
 * Usage:
 *   node scripts/capture-marketing-hero.mjs
 *   node scripts/capture-marketing-hero.mjs --only=hero,statutory
 *
 * Outputs:
 *   public/images/dashboard_home.png      — SwiftFreight operations overview
 *   public/images/payroll_screenshot.png  — SwiftFreight statutory compliance
 */

import { chromium } from 'playwright';
import { mkdir, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const IMAGES_DIR = join(ROOT, 'public', 'images');
const BASE_URL = process.env.MARKETING_CAPTURE_BASE_URL ?? 'https://app.getstride.co.ke';
const THEME_STORAGE_KEY = 'hris-dashboard:theme';

function loadEnvLocal() {
  const env = {};
  const path = join(ROOT, '.env.local');
  try {
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
    /* optional when CAPTURE_EMAIL / CAPTURE_PASSWORD are set */
  }
  return env;
}

const SHOTS = [
  {
    id: 'hero',
    file: 'dashboard_home.png',
    path: '/dashboard/people',
    entityMatch: /SwiftFreight/i,
    waitFor: /People & workforce|People &|Total staff|Module home/i,
    clip: { width: 1440, height: 900 },
  },
  {
    id: 'statutory',
    file: 'payroll_screenshot.png',
    path: '/dashboard/payroll/statutory',
    entityMatch: /SwiftFreight/i,
    waitFor: /Statutory|KRA PAYE|Employer/i,
    clip: { width: 1440, height: 900 },
  },
];

const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length).split(',') : null;

const ENTITY_COOKIE = 'hris_entity_id';
const ENTITY_STORAGE_KEY = 'hris_active_entity';

const ENTITY_SLUG_FALLBACKS = {
  hero: 'cargo-logistics__ke',
  statutory: 'cargo-logistics__ke',
};

async function resolveEntityId(page, shotId, entityMatch) {
  const payload = await page.evaluate(async () => {
    const r = await fetch('/api/config/entities');
    if (!r.ok) return null;
    return r.json();
  });

  const entities = payload?.entities ?? [];
  const fromApi = entities.find(
    (e) => entityMatch.test(e.name) || entityMatch.test(e.sector ?? ''),
  );
  if (fromApi?.id) return fromApi.id;

  return ENTITY_SLUG_FALLBACKS[shotId] ?? null;
}

async function switchEntity(page, shotId, entityMatch) {
  const entityId = await resolveEntityId(page, shotId, entityMatch);
  if (!entityId) return;

  await page.evaluate(
    ({ id, cookieName, storageKey }) => {
      localStorage.setItem(storageKey, id);
      const maxAge = 60 * 60 * 24 * 400;
      document.cookie = `${cookieName}=${encodeURIComponent(id)};path=/;max-age=${maxAge};SameSite=Lax`;
    },
    { id: entityId, cookieName: ENTITY_COOKIE, storageKey: ENTITY_STORAGE_KEY },
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

async function main() {
  const env = loadEnvLocal();
  const email = process.env.CAPTURE_EMAIL ?? env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL;
  const password = process.env.CAPTURE_PASSWORD ?? env.NEXT_PUBLIC_DEMO_PASSWORD;
  if (!email || !password) {
    throw new Error('Missing demo credentials — set CAPTURE_EMAIL/CAPTURE_PASSWORD or .env.local');
  }

  mkdir(IMAGES_DIR, { recursive: true }, () => {});

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });

  await context.addInitScript(() => {
    localStorage.setItem('hris-dashboard:theme', 'dark');
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  });

  const page = await context.newPage();
  console.log(`Signing in at ${BASE_URL}…`);
  await page.goto(`${BASE_URL}/dashboard/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByLabel('Email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/dashboard') && !url.pathname.includes('/login'), {
    timeout: 60_000,
  });

  const shots = ONLY ? SHOTS.filter((s) => ONLY.includes(s.id)) : SHOTS;

  for (const shot of shots) {
    console.log(`Capturing ${shot.id} → ${shot.file}`);
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await switchEntity(page, shot.id, shot.entityMatch);
    await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    if (shot.waitFor) {
      await page.getByText(shot.waitFor).first().waitFor({ state: 'visible', timeout: 30_000 });
    }
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      document.querySelectorAll('[data-marketing-screenshot-hide]').forEach((el) => {
        el.style.display = 'none';
      });
    });

    const outPath = join(IMAGES_DIR, shot.file);
    await page.screenshot({
      path: outPath,
      type: 'png',
      clip: { x: 0, y: 0, width: shot.clip.width, height: shot.clip.height },
    });
    console.log(`  saved ${outPath}`);
  }

  await browser.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
