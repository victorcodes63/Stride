#!/usr/bin/env node
/**
 * Reseed the linked Vercel production Neon DB with cargo-logistics (SwiftFreight) only.
 * Does NOT touch local .env.local.
 *
 * Usage: node scripts/reseed-production-cargo-logistics.mjs
 */
import { readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env.production-reseed.tmp');

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

console.log('Pulling production env from Vercel…');
const pull = spawnSync('vercel', ['env', 'pull', envFile, '--environment=production', '--yes'], {
  cwd: root,
  encoding: 'utf8',
});
if (pull.status !== 0) {
  throw new Error(pull.stderr || pull.stdout || 'vercel env pull failed');
}

const env = parseEnv(readFileSync(envFile, 'utf8'));
let databaseUrl =
  process.env.PRODUCTION_DATABASE_URL?.trim() ||
  env.get('DATABASE_URL') ||
  env.get('POSTGRES_URL') ||
  env.get('POSTGRES_PRISMA_URL') ||
  '';
let directUrl =
  process.env.PRODUCTION_DIRECT_DATABASE_URL?.trim() ||
  env.get('DATABASE_URL_UNPOOLED') ||
  env.get('POSTGRES_URL_NON_POOLING') ||
  env.get('DIRECT_DATABASE_URL') ||
  databaseUrl;

if (!databaseUrl) {
  console.log('DATABASE_URL not in env pull (sensitive) — using vercel env run + owner URL…');
  const result = spawnSync(
    'vercel',
    ['env', 'run', '-e', 'production', '--', 'node', 'scripts/run-production-seed-inner.mjs'],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );
  try {
    unlinkSync(envFile);
  } catch {
    /* ignore */
  }
  process.exit(result.status ?? 0);
}

console.log('Reseeding production DB with DEMO_PACK=cargo-logistics (single tenant)…\n');

const ownerUrl = directUrl || databaseUrl;

const seedEnv = {
  ...process.env,
  DATABASE_URL: ownerUrl,
  DIRECT_DATABASE_URL: ownerUrl,
  DEMO_PACK: 'cargo-logistics',
  DEMO_MODE: 'true',
  DEMO_MULTI_CONTEXT: '',
  MULTI_ENTITY_ENABLED: 'false',
  NEXT_PUBLIC_DEMO_ADMIN_EMAIL: env.get('NEXT_PUBLIC_DEMO_ADMIN_EMAIL') ?? 'admin@imara.co.ke',
  DEMO_UNIFIED_ADMIN_EMAIL: env.get('DEMO_UNIFIED_ADMIN_EMAIL') ?? 'admin@imara.co.ke',
  STAFF_PASSWORD: env.get('STAFF_PASSWORD') ?? env.get('NEXT_PUBLIC_DEMO_PASSWORD') ?? 'Demo@2026!',
  NEXT_PUBLIC_DEMO_PASSWORD: env.get('NEXT_PUBLIC_DEMO_PASSWORD') ?? 'Demo@2026!',
};

const result = spawnSync('npx', ['tsx', 'prisma/seed-all-demo.ts'], {
  cwd: root,
  stdio: 'inherit',
  env: seedEnv,
});

try {
  unlinkSync(envFile);
} catch {
  /* ignore */
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log('\nProduction cargo-logistics reseed complete.');
