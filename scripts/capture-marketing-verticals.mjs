/**
 * Capture dashboard screenshots for marketing vertical previews.
 *
 * Usage:
 *   node scripts/capture-marketing-verticals.mjs
 *   node scripts/capture-marketing-verticals.mjs --only=logistics,saccos
 *
 * Env: MARKETING_CAPTURE_BASE_URL (default https://app.getstride.co.ke)
 * Credentials: .env.local NEXT_PUBLIC_DEMO_ADMIN_EMAIL / NEXT_PUBLIC_DEMO_PASSWORD
 */

import { chromium } from 'playwright';
import { mkdir, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'marketing');

const BASE_URL = process.env.MARKETING_CAPTURE_BASE_URL ?? 'https://app.getstride.co.ke';
const THEME_STORAGE_KEY = 'hris-dashboard:theme';

function applyDarkModeInitScript() {
  return `(() => {
    try {
      localStorage.setItem('${THEME_STORAGE_KEY}', 'dark');
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } catch (e) {}
  })();`;
}

function loadEnvLocal() {
  const path = join(ROOT, '.env.local');
  const env = {};
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

/** @type {Array<{ id: string; file: string; path: string; entityMatch: RegExp; waitFor?: RegExp; maxClipHeight?: number }>} */
const SHOTS = [
  {
    id: 'logistics',
    file: 'stride-vertical-logistics.png',
    path: '/dashboard/fleet/trips',
    entityMatch: /SwiftFreight/i,
    waitFor: /Trip board/i,
  },
  {
    id: 'saccos',
    file: 'stride-vertical-saccos.png',
    path: '/dashboard/payroll/statutory',
    entityMatch: /Heritage Members|Nyati/i,
    waitFor: /Statutory|KRA PAYE|Heritage Members/i,
    maxClipHeight: 720,
  },
  {
    id: 'healthcare',
    file: 'stride-vertical-healthcare.png',
    path: '/dashboard/rota',
    entityMatch: /Amani Medical|healthcare/i,
    waitFor: /Rota|shift/i,
  },
  {
    id: 'energy',
    file: 'stride-vertical-energy.png',
    path: '/dashboard/hse',
    entityMatch: /Northline|Stabex|petroleum|energy/i,
    waitFor: /HSE|incident/i,
  },
  {
    id: 'construction',
    file: 'stride-vertical-construction.png',
    path: '/dashboard/assets',
    entityMatch: /Northline|Stabex|construction|asset/i,
    waitFor: /Asset|register/i,
  },
];

const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length).split(',') : null;

const ENTITY_COOKIE = 'hris_entity_id';
const ENTITY_STORAGE_KEY = 'hris_active_entity';

/** Known demo entity slugs when multi-context is enabled on the sales instance. */
const ENTITY_SLUG_FALLBACKS = {
  logistics: 'cargo-logistics__ke',
  saccos: 'imara-sacco__ke',
  healthcare: 'hospital-healthcare__ke',
  energy: 'petroleum-retail__ke',
  construction: 'petroleum-retail__ke',
};

async function hideMarketingChrome(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[data-marketing-screenshot-hide]').forEach((el) => {
      el.style.display = 'none';
    });
  });
}

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

  const fallback = ENTITY_SLUG_FALLBACKS[shotId];
  if (fallback) return fallback;

  return null;
}

async function setActiveEntity(page, shotId, entityMatch) {
  const entityId = await resolveEntityId(page, shotId, entityMatch);
  if (!entityId) {
    console.warn(`  could not resolve entity for ${shotId} (${entityMatch})`);
    return;
  }

  await page.evaluate(
    ({ id, cookieName, storageKey }) => {
      localStorage.setItem(storageKey, id);
      const maxAge = 60 * 60 * 24 * 400;
      document.cookie = `${cookieName}=${encodeURIComponent(id)};path=/;max-age=${maxAge};SameSite=Lax`;
    },
    { id: entityId, cookieName: ENTITY_COOKIE, storageKey: ENTITY_STORAGE_KEY },
  );

  console.log(`  active entity → ${entityId}`);
}

async function switchEntity(page, shotId, entityMatch) {
  await setActiveEntity(page, shotId, entityMatch);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const trigger = page.locator('button.dash-select-trigger').first();
  if (!(await trigger.isVisible().catch(() => false))) return;

  const currentTitle = await trigger.getAttribute('title');
  if (currentTitle && entityMatch.test(currentTitle)) return;

  await trigger.click();
  const option = page.getByRole('option', { name: entityMatch });
  if (await option.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await option.first().click();
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }
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
  await context.addInitScript(applyDarkModeInitScript());
  const page = await context.newPage();

  console.log(`Signing in at ${BASE_URL}…`);
  await page.goto(`${BASE_URL}/dashboard/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByLabel('Email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/dashboard') && !url.pathname.includes('/login'), {
    timeout: 60_000,
  });

  await page.evaluate(() => {
    localStorage.setItem('hris-dashboard:theme', 'dark');
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  const shots = ONLY ? SHOTS.filter((s) => ONLY.includes(s.id)) : SHOTS;
  if (shots.length === 0) {
    throw new Error(`No shots matched --only=${ONLY?.join(',')}`);
  }

  for (const shot of shots) {
    const url = `${BASE_URL}${shot.path}`;
    console.log(`Capturing ${shot.id} → ${shot.file}`);

    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await switchEntity(page, shot.id, shot.entityMatch);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

    if (shot.waitFor) {
      await page.getByText(shot.waitFor).first().waitFor({ state: 'visible', timeout: 30_000 });
    }
    await page.waitForTimeout(1200);
    await hideMarketingChrome(page);

    const main = page.locator('main').first();
    await main.waitFor({ state: 'visible', timeout: 30_000 });

    const outPath = join(OUT_DIR, shot.file);
    const box = await main.boundingBox();
    if (!box) throw new Error(`No bounding box for ${shot.id}`);

    const clipHeight =
      shot.maxClipHeight != null ? Math.min(box.height, shot.maxClipHeight) : box.height;

    await page.screenshot({
      path: outPath,
      type: 'png',
      clip: {
        x: box.x,
        y: box.y,
        width: box.width,
        height: clipHeight,
      },
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
