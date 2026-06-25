#!/usr/bin/env node
/**
 * RAV-97 — G1 launch quality bar orchestrator.
 *
 * Hard gates (exit 1 on failure):
 *   npm run audit:dashboard-mock
 *   npm run audit:module-tenant
 *   next build (unless QUALITY_BAR_SKIP_BUILD=1)
 *
 * Advisory (reported, non-blocking unless STRICT_BUILD=true):
 *   audit:api-auth, typecheck, lint
 *
 * Optional (runs when prerequisites exist):
 *   test:rls — requires DATABASE_URL
 *   smoke:marketing — requires running server (QUALITY_BAR_BASE_URL or localhost:3000)
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.env.STRICT_BUILD === 'true';
const skipBuild = process.env.QUALITY_BAR_SKIP_BUILD === '1';
const baseUrl = (process.env.QUALITY_BAR_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

const summary = [];

function run(label, cmd, args, { optional = false, env = {} } = {}) {
  console.log(`\n── ${label} ──\n`);
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: process.platform === 'win32',
  });
  const ok = result.status === 0;
  summary.push({ label, ok, optional });
  if (!ok && !optional) {
    console.error(`\nQuality bar FAILED at: ${label}\n`);
    process.exit(result.status || 1);
  }
  return ok;
}

async function serverReachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function main() {
  console.log('\n══════════════════════════════════════════');
  console.log('  Stride G1 quality bar (RAV-97)');
  console.log('══════════════════════════════════════════');

  run('Dashboard mock routes', 'node', ['scripts/audit-dashboard-mock-routes.mjs']);
  run('Module tenant + RLS schema', 'npm', ['run', 'audit:module-tenant']);
  run('API auth scan (advisory)', 'npm', ['run', 'audit:api-auth'], { optional: !strict });

  const typecheckOk = run('TypeScript', 'npm', ['run', 'typecheck'], { optional: !strict });
  if (!typecheckOk && strict) process.exit(1);

  run('ESLint', 'npm', ['run', 'lint'], { optional: !strict });

  if (process.env.DATABASE_URL) {
    run('RLS isolation (live DB)', 'npm', ['run', 'test:rls']);
  } else {
    console.log('\n── RLS isolation (live DB) ──\n');
    console.log('  SKIP — DATABASE_URL not set (schema audit above covers policy coverage).\n');
    summary.push({ label: 'RLS isolation (live DB)', ok: true, optional: true, skipped: true });
  }

  if (!skipBuild) {
    run('Production build', 'npm', ['run', 'build']);
  } else {
    console.log('\n── Production build ──\n  SKIP — QUALITY_BAR_SKIP_BUILD=1\n');
  }

  if (await serverReachable(baseUrl)) {
    run('Marketing smoke', 'npm', ['run', 'smoke:marketing'], {
      env: { SMOKE_MARKETING_BASE_URL: baseUrl },
    });
  } else {
    console.log(`\n── Marketing smoke ──\n  SKIP — no server at ${baseUrl}\n`);
    summary.push({ label: 'Marketing smoke', ok: true, optional: true, skipped: true });
  }

  console.log('\n══════════════════════════════════════════');
  console.log('  Quality bar summary');
  console.log('══════════════════════════════════════════\n');
  for (const row of summary) {
    const tag = row.skipped ? 'SKIP' : row.ok ? 'PASS' : row.optional ? 'WARN' : 'FAIL';
    console.log(`  [${tag}] ${row.label}`);
  }
  console.log('\nG1 quality bar: PASS\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
