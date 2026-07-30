#!/usr/bin/env node
/**
 * Provision the isolated demo Neon cell: schema → stride_app role → multi-vertical seed.
 *
 * Requires .env.demo-cell.local with DATABASE_URL + DIRECT_DATABASE_URL (neondb_owner).
 *
 * Usage: npm run demo:cell:provision
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env.demo-cell.local');
const profilePath = path.join(root, 'deployments', 'demo-getstride.env');

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing ${path.basename(filePath)}`);
  }
  const map = {};
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    map[t.slice(0, eq).trim()] = v;
  }
  return map;
}

function run(label, cmd, args, extraEnv = {}) {
  console.log(`\n→ ${label}`);
  const env = { ...process.env, ...extraEnv };
  const r = spawnSync(cmd, args, { cwd: root, env, stdio: 'inherit' });
  if (r.status !== 0) {
    throw new Error(`${label} failed (exit ${r.status})`);
  }
}

const map = loadEnvFile(envPath);
const profile = loadEnvFile(profilePath);
const direct = map.DIRECT_DATABASE_URL || map.DATABASE_URL;
const pooled = map.DATABASE_URL || direct;
if (!direct?.includes('neondb_owner')) {
  throw new Error('DIRECT_DATABASE_URL must use neondb_owner for demo cell provisioning');
}

const unifiedAdmin =
  profile.DEMO_UNIFIED_ADMIN_EMAIL ||
  profile.NEXT_PUBLIC_DEMO_ADMIN_EMAIL ||
  'admin@imara.co.ke';
const staffDomains =
  profile.STAFF_ALLOWED_DOMAIN ||
  'imara.co.ke,savannahfreight.co.ke,heritage.demo.getstride.co.ke,northline.imara.co.ke,amani.imara.co.ke,horizon.imara.co.ke,kilimani.imara.co.ke,example.com';

const baseEnv = {
  DATABASE_URL: pooled,
  DIRECT_DATABASE_URL: direct,
};

const multiVerticalEnv = {
  ...baseEnv,
  DATABASE_URL: direct,
  DEMO_MODE: 'true',
  DEMO_MULTI_CONTEXT: 'true',
  MULTI_ENTITY_ENABLED: 'true',
  DEMO_UNIFIED_ADMIN_EMAIL: unifiedAdmin,
  NEXT_PUBLIC_DEMO_ADMIN_EMAIL: unifiedAdmin,
  STAFF_PASSWORD: profile.STAFF_PASSWORD || profile.NEXT_PUBLIC_DEMO_PASSWORD || 'Demo@2026!',
  NEXT_PUBLIC_DEMO_PASSWORD: profile.NEXT_PUBLIC_DEMO_PASSWORD || 'Demo@2026!',
  STAFF_ALLOWED_DOMAIN: staffDomains,
};

console.log('Provisioning stride-demo Neon cell (multi-vertical)…');
console.log(`  Host: ${(direct.match(/@([^/?]+)/) || [])[1] || 'unknown'}`);
console.log(`  Unified admin: ${unifiedAdmin}`);

// Fresh Neon projects hit migration-order deps (tenancy before fleet). db push syncs schema.prisma directly.
run('prisma db push', 'npx', ['prisma', 'db', 'push', '--accept-data-loss'], baseEnv);
run('stride_app role', 'npx', ['prisma', 'db', 'execute', '--file', 'prisma/migrations/stride_app_role.sql'], {
  ...baseEnv,
  DATABASE_URL: direct,
});
// Demo cell uses neondb_owner at runtime — skip RLS apply (rls_policies.sql expects legacy table names).
console.log('\n→ RLS policies (skipped on demo cell — isolated DB uses neondb_owner runtime)');

run('multi-vertical demo seed', 'npx', ['tsx', 'prisma/seed-demo-multi-vertical.ts'], multiVerticalEnv);

// Defense-in-depth: cleanup + security roster also run at end of multi-vertical seed.
run('orphan client cleanup', 'npx', ['tsx', 'scripts/cleanup-demo-orphan-clients.ts'], multiVerticalEnv);

run('demo email domains (all showcase orgs)', 'npx', ['tsx', 'scripts/seed-demo-email-domains.mjs'], {
  ...multiVerticalEnv,
  DEMO_MULTI_CONTEXT: 'true',
});

console.log('\n✓ Demo cell provisioned (multi-vertical industry tour).');
console.log(`  Admin: ${unifiedAdmin} / ${profile.NEXT_PUBLIC_DEMO_PASSWORD || 'Demo@2026!'}`);
console.log('  Switch company in the top bar to tour SACCO, energy, logistics, healthcare, travel, construction.');
console.log('  Next: npm run demo:cell:deploy');
