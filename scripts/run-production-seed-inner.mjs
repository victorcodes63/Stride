#!/usr/bin/env node
/**
 * Run multi-vertical demo seed using owner DB URL (bypasses stride_app RLS).
 * Invoked inside `vercel env run -e production`.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const profilePath = path.join(root, 'deployments', 'demo-getstride.env');

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

const ownerUrl =
  process.env.DIRECT_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
  process.env.POSTGRES_URL_NON_POOLING?.trim() ||
  '';

if (!ownerUrl) {
  console.error('Missing DIRECT_DATABASE_URL (neondb_owner) — cannot seed through stride_app RLS.');
  process.exit(1);
}

const profile = existsSync(profilePath) ? parseEnv(readFileSync(profilePath, 'utf8')) : new Map();
const unifiedAdmin =
  process.env.DEMO_UNIFIED_ADMIN_EMAIL?.trim() ||
  profile.get('DEMO_UNIFIED_ADMIN_EMAIL') ||
  'admin@imara.co.ke';
const staffDomains =
  process.env.STAFF_ALLOWED_DOMAIN?.trim() ||
  profile.get('STAFF_ALLOWED_DOMAIN') ||
  'imara.co.ke,savannahfreight.co.ke,heritage.demo.getstride.co.ke,northline.imara.co.ke,amani.imara.co.ke,horizon.imara.co.ke,kilimani.imara.co.ke,example.com';

const seedEnv = {
  ...process.env,
  DATABASE_URL: ownerUrl,
  DIRECT_DATABASE_URL: ownerUrl,
  DEMO_MODE: 'true',
  DEMO_MULTI_CONTEXT: 'true',
  MULTI_ENTITY_ENABLED: 'true',
  DEMO_UNIFIED_ADMIN_EMAIL: unifiedAdmin,
  NEXT_PUBLIC_DEMO_ADMIN_EMAIL: unifiedAdmin,
  STAFF_ALLOWED_DOMAIN: staffDomains,
};

function run(label, args) {
  console.log(`\n→ ${label}`);
  const result = spawnSync('npx', args, { cwd: root, stdio: 'inherit', env: seedEnv });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('multi-vertical seed', ['tsx', 'prisma/seed-demo-multi-vertical.ts']);
run('email domains', ['tsx', 'scripts/seed-demo-email-domains.mjs']);

process.exit(0);
