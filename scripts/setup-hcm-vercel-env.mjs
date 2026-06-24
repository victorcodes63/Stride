#!/usr/bin/env node
/**
 * Push fresh demo env vars to the linked Vercel project (hcm).
 * Does not copy anything from eagle-hr. Neon DATABASE_URL is assumed already provisioned.
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const envPath = path.join(root, '.env.local');

function parseEnv(text) {
  const map = new Map();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
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

const TARGETS = ['production'];

function addEnv(name, value, { sensitive = false, targets = TARGETS } = {}) {
  if (!value) {
    console.warn(`skip ${name} (empty)`);
    return;
  }
  for (const target of targets) {
    const args = ['env', 'add', name, target, '--value', value, '--force', '--yes'];
    if (sensitive) args.push('--sensitive');
    const result = spawnSync('vercel', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      const err = `${result.stderr || ''}${result.stdout || ''}`.trim();
      throw new Error(`vercel env add ${name} (${target}) failed: ${err}`);
    }
  }
  console.log(`✓ ${name}`);
}

const local = parseEnv(fs.readFileSync(envPath, 'utf8'));
const direct =
  local.get('DIRECT_DATABASE_URL') ||
  local.get('DATABASE_URL_UNPOOLED') ||
  local.get('POSTGRES_URL_NON_POOLING') ||
  '';

const siteUrl = process.env.HCM_SITE_URL || 'https://hcm.vercel.app';
const nextAuthSecret = crypto.randomBytes(32).toString('base64url');
const cronSecret = crypto.randomBytes(32).toString('base64url');

const vars = [
  ['DIRECT_DATABASE_URL', direct, { sensitive: true }],
  ['DEMO_PACK', 'generic'],
  ['DEMO_MODE', 'true'],
  ['NEXT_PUBLIC_DEMO_MODE', 'true'],
  ['NEXT_PUBLIC_APP_NAME', 'Stride'],
  ['NEXT_PUBLIC_ORG_NAME', 'Demo Corporation'],
  ['NEXT_PUBLIC_BRAND_LOGO', '/brand/platform-logo.png'],
  ['NEXT_PUBLIC_BRAND_LOGO_PNG', '/brand/platform-logo.png'],
  ['NEXT_PUBLIC_BRAND_WORDMARK', 'Stride'],
  ['NEXT_PUBLIC_RECRUITMENT_EMPLOYER_NAME', 'Demo Corporation'],
  ['STAFF_ALLOWED_DOMAIN', 'demo.example.com,example.com'],
  ['STAFF_PASSWORD', 'Demo@2026!', { sensitive: true }],
  ['NEXT_PUBLIC_DEMO_ADMIN_EMAIL', 'demo@demo.example.com'],
  ['NEXT_PUBLIC_DEMO_HR_EMAIL', 'hr.demo@demo.example.com'],
  ['NEXT_PUBLIC_DEMO_FINANCE_EMAIL', 'finance.demo@demo.example.com'],
  ['NEXT_PUBLIC_DEMO_ESS_EMAIL', 'employee@demo.example.com'],
  ['NEXT_PUBLIC_DEMO_PASSWORD', 'Demo@2026!'],
  ['NEXT_PUBLIC_SITE_URL', siteUrl],
  ['NEXTAUTH_SECRET', nextAuthSecret, { sensitive: true }],
  ['NEXTAUTH_URL', siteUrl],
  ['CRON_SECRET', cronSecret, { sensitive: true }],
  ['RUN_MIGRATIONS_ON_BUILD', 'true'],
];

console.log('Setting hcm Vercel env vars (fresh demo profile)…');
for (const [name, value, opts = {}] of vars) {
  addEnv(name, value, opts);
}
console.log('Done.');
