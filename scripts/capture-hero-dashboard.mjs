/**
 * Capture crisp PNG hero dashboard shot at 1x and 2x (no JPEG).
 * Usage: MARKETING_CAPTURE_BASE_URL=http://127.0.0.1:3000 node scripts/capture-hero-dashboard.mjs
 */

import { chromium } from 'playwright';
import { mkdir, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'marketing');
const BASE_URL = process.env.MARKETING_CAPTURE_BASE_URL ?? 'http://127.0.0.1:3000';
const PATH = '/dashboard/people';
const CLIP_HEIGHT = 720;

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

async function captureAtScale(browser, scale, env) {
  const email = process.env.CAPTURE_EMAIL ?? env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL;
  const password = process.env.CAPTURE_PASSWORD ?? env.NEXT_PUBLIC_DEMO_PASSWORD;
  if (!email || !password) throw new Error('Missing demo credentials in .env.local');

  const context = await browser.newContext({
    viewport: { width: 1024, height: 720 },
    deviceScaleFactor: scale,
    colorScheme: 'dark',
  });

  await context.addInitScript(() => {
    localStorage.setItem('hris-dashboard:theme', 'dark');
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  });

  const page = await context.newPage();
  await page.goto(`${BASE_URL}/dashboard/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByLabel('Email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/dashboard') && !url.pathname.includes('/login'), {
    timeout: 60_000,
  });

  await page.goto(`${BASE_URL}${PATH}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const suffix = scale === 2 ? '@2x' : '';
  const outPath = join(OUT_DIR, `stride-dashboard-hero${suffix}.png`);

  await page.screenshot({
    path: outPath,
    type: 'png',
    clip: { x: 0, y: 0, width: 1024, height: CLIP_HEIGHT },
  });

  console.log(`Saved ${outPath} (@${scale}x)`);
  await context.close();
}

async function main() {
  mkdir(OUT_DIR, { recursive: true }, () => {});
  const env = loadEnvLocal();
  const browser = await chromium.launch({ headless: true });
  await captureAtScale(browser, 1, env);
  await captureAtScale(browser, 2, env);
  await browser.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
