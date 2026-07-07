#!/usr/bin/env node
/**
 * RAV-251 ISO-07 — CI gate orchestrator for tenant isolation.
 *
 * Hard gates (always):
 *   npm run audit:module-tenant
 *   npm run audit:api-prisma
 *
 * Live DB gates (when DATABASE_URL is set):
 *   npm run test:rls
 *   npm run test:cross-tenant
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(label, args, { optional = false } = {}) {
  console.log(`\n── ${label} ──\n`);
  const result = spawnSync('npm', args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  const ok = result.status === 0;
  if (!ok && !optional) {
    console.error(`\nISO CI FAILED at: ${label}\n`);
    process.exit(result.status || 1);
  }
  return ok;
}

console.log('\n══════════════════════════════════════════');
console.log('  ISO-07 tenant isolation CI (RAV-251)');
console.log('══════════════════════════════════════════');

run('Module tenant migration + RLS schema', ['run', 'audit:module-tenant']);
run('API prisma scope', ['run', 'audit:api-prisma']);

if (process.env.DATABASE_URL) {
  run('RLS isolation (live DB)', ['run', 'test:rls']);
  run('Cross-tenant API isolation (live DB)', ['run', 'test:cross-tenant']);
} else {
  console.log('\n── Live DB isolation tests ──\n');
  console.log('  SKIP — DATABASE_URL not set (static audits above still enforced).\n');
}

console.log('\nISO-07 tenant isolation CI: PASS\n');
