#!/usr/bin/env node
/**
 * ISO-01: Apply customer-cell env to stride-platform (production).
 * Strips demo vars; applies deployments/app-getstride.env only.
 *
 * Usage: node scripts/apply-app-getstride-customer-production-env.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = 'production';

const DEMO_KEYS_TO_REMOVE = [
  'DEMO_MODE',
  'DEMO_PACK',
  'NEXT_PUBLIC_DEMO_MODE',
  'NEXT_PUBLIC_ORG_NAME',
  'NEXT_PUBLIC_RECRUITMENT_EMPLOYER_NAME',
  'NEXT_PUBLIC_SHOW_DEMO_LOGIN_HINT',
  'NEXT_PUBLIC_INTERNAL_DEMO_SANDBOX',
  'DEMO_MULTI_CONTEXT',
  'DEMO_ENTITY_PREFIX',
  'DEMO_UNIFIED_ADMIN_EMAIL',
  'NEXT_PUBLIC_DEMO_ADMIN_EMAIL',
  'NEXT_PUBLIC_DEMO_HR_EMAIL',
  'NEXT_PUBLIC_DEMO_APPROVER_EMAIL',
  'NEXT_PUBLIC_DEMO_FINANCE_EMAIL',
  'NEXT_PUBLIC_DEMO_ESS_EMAIL',
  'NEXT_PUBLIC_DEMO_PASSWORD',
  'MULTI_ENTITY_ENABLED',
];

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

function addEnv(name, value, { sensitive = false } = {}) {
  if (value === undefined || value === '') {
    console.warn(`skip ${name} (empty)`);
    return;
  }
  spawnSync('vercel', ['env', 'rm', name, TARGET, '--yes'], { cwd: root, stdio: 'ignore' });
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

const filePath = path.join(root, 'deployments', 'app-getstride.env');
if (!existsSync(filePath)) throw new Error(`Missing ${filePath}`);

const profile = parseEnvFile(readFileSync(filePath, 'utf8'));
profile.set('NEXT_PUBLIC_SITE_URL', 'https://app.getstride.co.ke');
profile.set('NEXTAUTH_URL', 'https://app.getstride.co.ke');

console.log(`ISO-01: Applying customer-cell env to Vercel (${TARGET})…\n`);

console.log('Removing demo vars…');
for (const key of DEMO_KEYS_TO_REMOVE) rmEnv(key);

console.log('\nApplying customer profile…');
for (const [key, value] of profile.entries()) {
  addEnv(key, value);
}

console.log('\nDone. Redeploy stride-platform production.');
