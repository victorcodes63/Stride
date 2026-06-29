#!/usr/bin/env node
/**
 * Provision the isolated demo Neon cell: migrate → RLS → stride_app role → SwiftFreight seed.
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

function loadDemoCellEnv() {
  if (!existsSync(envPath)) {
    throw new Error(
      'Missing .env.demo-cell.local — copy .env.demo-cell.example and add Neon owner URLs.',
    );
  }
  const map = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
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

const map = loadDemoCellEnv();
const direct = map.DIRECT_DATABASE_URL || map.DATABASE_URL;
const pooled = map.DATABASE_URL || direct;
if (!direct?.includes('neondb_owner')) {
  throw new Error('DIRECT_DATABASE_URL must use neondb_owner for demo cell provisioning');
}

const baseEnv = {
  DATABASE_URL: pooled,
  DIRECT_DATABASE_URL: direct,
};

console.log('Provisioning stride-demo Neon cell…');
console.log(`  Host: ${(direct.match(/@([^/?]+)/) || [])[1] || 'unknown'}`);

// Fresh Neon projects hit migration-order deps (tenancy before fleet). db push syncs schema.prisma directly.
run('prisma db push', 'npx', ['prisma', 'db', 'push', '--accept-data-loss'], baseEnv);
run('stride_app role', 'npx', ['prisma', 'db', 'execute', '--file', 'prisma/migrations/stride_app_role.sql'], {
  ...baseEnv,
  DATABASE_URL: direct,
});
// Demo cell uses neondb_owner at runtime — skip RLS apply (rls_policies.sql expects legacy table names).
console.log('\n→ RLS policies (skipped on demo cell — isolated DB uses neondb_owner runtime)');
run('SwiftFreight demo seed', 'npx', ['tsx', 'prisma/seed-demo.ts'], {
  ...baseEnv,
  DATABASE_URL: direct,
  DEMO_MODE: 'true',
  DEMO_PACK: 'cargo-logistics',
});
run('demo email domains', 'npx', ['tsx', 'scripts/seed-demo-email-domains.mjs'], {
  ...baseEnv,
  DATABASE_URL: direct,
  DEMO_MODE: 'true',
  DEMO_PACK: 'cargo-logistics',
  STAFF_ALLOWED_DOMAIN: 'swiftfreight.imara.co.ke,imara.co.ke,example.com',
});

console.log('\n✓ Demo cell provisioned.');
console.log('  Admin: admin@imara.co.ke / Demo@2026!');
console.log('  Next: npm run demo:cell:deploy');
