#!/usr/bin/env node
/**
 * Apply single-tenant SwiftFreight demo env to stride-platform (production).
 * Merges deployments/app-getstride.env + deployments/cargo-logistics.env.
 *
 * Usage: node scripts/apply-app-getstride-production-env.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = 'production';

function parseEnvFile(text) {
  const map = new Map();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

function loadProfile(...names) {
  const merged = new Map();
  for (const name of names) {
    const filePath = path.join(root, 'deployments', name);
    if (!existsSync(filePath)) throw new Error(`Missing ${filePath}`);
    for (const [k, v] of parseEnvFile(readFileSync(filePath, 'utf8'))) {
      merged.set(k, v);
    }
  }
  return merged;
}

function addEnv(name, value, { sensitive = false } = {}) {
  if (value === undefined || value === '') {
    console.warn(`skip ${name} (empty)`);
    return;
  }
  const args = ['env', 'add', name, TARGET, '--value', value, '--force', '--yes'];
  if (sensitive) args.push('--sensitive');
  const result = spawnSync('vercel', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`vercel env add ${name} failed: ${result.stderr || result.stdout}`);
  }
  console.log(`✓ ${name}`);
}

function rmEnv(name) {
  const result = spawnSync('vercel', ['env', 'rm', name, TARGET, '--yes'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const msg = `${result.stderr || ''}${result.stdout || ''}`;
    if (/not found|does not exist/i.test(msg)) {
      console.log(`· ${name} (already absent)`);
      return;
    }
    throw new Error(`vercel env rm ${name} failed: ${msg}`);
  }
  console.log(`✗ removed ${name}`);
}

const profile = loadProfile('app-getstride.env', 'cargo-logistics.env');

// Production site URL overrides local cargo-logistics profile.
profile.set('NEXT_PUBLIC_SITE_URL', 'https://app.getstride.co.ke');
profile.set('NEXTAUTH_URL', 'https://app.getstride.co.ke');

// Single-tenant SwiftFreight — no multi-vertical switcher on app.getstride.co.ke.
profile.set('MULTI_ENTITY_ENABLED', 'false');
profile.delete('DEMO_MULTI_CONTEXT');

const SENSITIVE = new Set(['STAFF_PASSWORD', 'NEXTAUTH_SECRET', 'CRON_SECRET']);

const ORDER = [
  'SITE_MODE',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_APP_ORIGIN',
  'NEXTAUTH_URL',
  'NEXT_PUBLIC_APP_NAME',
  'NEXT_PUBLIC_APP_TAGLINE',
  'NEXT_PUBLIC_ORG_NAME',
  'NEXT_PUBLIC_BRAND_WORDMARK',
  'NEXT_PUBLIC_BRAND_LOGO',
  'NEXT_PUBLIC_BRAND_LOGO_PNG',
  'NEXT_PUBLIC_RECRUITMENT_EMPLOYER_NAME',
  'DEMO_MODE',
  'DEMO_PACK',
  'NEXT_PUBLIC_DEMO_MODE',
  'NEXT_PUBLIC_SHOW_DEMO_LOGIN_HINT',
  'NEXT_PUBLIC_TENANT_LOGIN_BRANDING',
  'NEXT_PUBLIC_INTERNAL_DEMO_SANDBOX',
  'NEXT_PUBLIC_DEMO_ACCESS_PAGE',
  'MULTI_ENTITY_ENABLED',
  'STAFF_ALLOWED_DOMAIN',
  'NEXT_PUBLIC_DEMO_ADMIN_EMAIL',
  'NEXT_PUBLIC_DEMO_HR_EMAIL',
  'NEXT_PUBLIC_DEMO_APPROVER_EMAIL',
  'NEXT_PUBLIC_DEMO_FINANCE_EMAIL',
  'NEXT_PUBLIC_DEMO_ESS_EMAIL',
  'NEXT_PUBLIC_DEMO_PASSWORD',
  'DEMO_UNIFIED_ADMIN_EMAIL',
  'STAFF_PASSWORD',
  'RUN_MIGRATIONS_ON_BUILD',
];

console.log(`Applying SwiftFreight single-tenant env to Vercel (${TARGET})…\n`);

for (const key of ['DEMO_MULTI_CONTEXT', 'DEMO_ENTITY_PREFIX']) {
  rmEnv(key);
}

const seen = new Set();
for (const key of ORDER) {
  if (profile.has(key)) {
    addEnv(key, profile.get(key), { sensitive: SENSITIVE.has(key) });
    seen.add(key);
  }
}

for (const [key, value] of profile.entries()) {
  if (seen.has(key)) continue;
  addEnv(key, value, { sensitive: SENSITIVE.has(key) });
}

console.log('\nDone. Redeploy production, then reseed: npm run demo:reseed:production');
