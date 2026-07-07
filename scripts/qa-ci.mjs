#!/usr/bin/env node
/**
 * RAV-284 — Unified QA CI gate for pull requests.
 *
 * Hard gates (always):
 *   npm run test:run          — QA-01 unit golden cases + module tests
 *   npm run iso:ci            — ISO-07 static tenant isolation audits
 *   npm run build             — production build (skip with QA_CI_SKIP_BUILD=1)
 *
 * Live DB gates (when DATABASE_URL is set):
 *   npm run test:rls
 *   npm run test:cross-tenant — QA-02 module matrix
 *
 * Optional smoke (when QA_CI_SMOKE=1 and servers reachable):
 *   npm run smoke:surfaces
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const skipBuild = process.env.QA_CI_SKIP_BUILD === '1';
const runSmoke = process.env.QA_CI_SMOKE === '1';
const runE2e = process.env.QA_CI_E2E === '1';

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
    console.error(`\nQA CI FAILED at: ${label}\n`);
    process.exit(result.status || 1);
  }
  return ok;
}

console.log('\n══════════════════════════════════════════');
console.log('  Stride QA CI (RAV-280/281/284)');
console.log('══════════════════════════════════════════');

run('QA-01 critical logic tests (vitest)', ['run', 'test:qa']);
run('ISO-07 tenant isolation static audits', ['run', 'iso:ci']);

if (process.env.DATABASE_URL) {
  run('QA-02 RLS isolation (live DB)', ['run', 'test:rls']);
  run('QA-02 cross-tenant matrix (live DB)', ['run', 'test:cross-tenant']);
} else {
  console.log('\n── Live DB isolation tests ──\n');
  console.log('  SKIP — DATABASE_URL not set (static audits above still enforced).\n');
}

if (!skipBuild) {
  run('Production build', ['run', 'build']);
} else {
  console.log('\n── Production build ──\n  SKIP — QA_CI_SKIP_BUILD=1\n');
}

if (runSmoke) {
  run('QA-05 surface smoke', ['run', 'smoke:surfaces'], { optional: true });
}

if (runE2e) {
  run('QA-03 Playwright E2E', ['run', 'test:e2e'], { optional: true });
}

console.log('\nStride QA CI: PASS\n');
