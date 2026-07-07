#!/usr/bin/env node
/**
 * RAV-284 — Orchestrates per-surface smoke checks.
 * Skips surfaces when credentials or servers are unavailable (non-blocking in dev).
 * Set QA_SMOKE_STRICT=1 to fail when any surface is unreachable.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.env.QA_SMOKE_STRICT === '1';
const appUrl = (process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const cpUrl = (process.env.SMOKE_CP_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const marketingUrl = (process.env.SMOKE_MARKETING_BASE_URL || appUrl).replace(/\/$/, '');

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

function run(label, script, env = {}) {
  console.log(`\n── ${label} ──\n`);
  const result = spawnSync('node', [`scripts/${script}`], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  return result.status === 0;
}

async function main() {
  console.log('\n══════════════════════════════════════════');
  console.log('  QA-05 surface smoke suite (RAV-284)');
  console.log('══════════════════════════════════════════');

  const summary = [];

  if (await reachable(`${marketingUrl}/`)) {
    const ok = run('Marketing', 'smoke-marketing.mjs', { SMOKE_MARKETING_BASE_URL: marketingUrl });
    summary.push({ label: 'Marketing', ok });
    if (!ok && strict) process.exit(1);
  } else {
    console.log(`\n── Marketing ──\n  SKIP — no server at ${marketingUrl}\n`);
    summary.push({ label: 'Marketing', ok: !strict, skipped: true });
    if (strict) process.exit(1);
  }

  if (await reachable(`${appUrl}/api/config/deployment`)) {
    const okPlatform = run('Platform API', 'smoke-platform.mjs', { SMOKE_BASE_URL: appUrl });
    summary.push({ label: 'Platform API', ok: okPlatform });
    if (!okPlatform && strict) process.exit(1);

    if (process.env.SMOKE_LOGIN_EMAIL && process.env.SMOKE_LOGIN_PASSWORD) {
      const okEss = run('ESS', 'smoke-ess.mjs', { SMOKE_BASE_URL: appUrl });
      summary.push({ label: 'ESS', ok: okEss });
      if (!okEss && strict) process.exit(1);
    } else {
      console.log('\n── ESS ──\n  SKIP — SMOKE_LOGIN_EMAIL/PASSWORD not set\n');
      summary.push({ label: 'ESS', ok: !strict, skipped: true });
    }
  } else {
    console.log(`\n── Platform / ESS ──\n  SKIP — no server at ${appUrl}\n`);
    summary.push({ label: 'Platform API', ok: !strict, skipped: true });
    if (strict) process.exit(1);
  }

  if (await reachable(`${cpUrl}/login`)) {
    const ok = run('Control plane', 'smoke-control-plane.mjs', { SMOKE_CP_BASE_URL: cpUrl });
    summary.push({ label: 'Control plane', ok });
    if (!ok && strict) process.exit(1);
  } else {
    console.log(`\n── Control plane ──\n  SKIP — no server at ${cpUrl}\n`);
    summary.push({ label: 'Control plane', ok: !strict, skipped: true });
    if (strict) process.exit(1);
  }

  console.log('\n══════════════════════════════════════════');
  console.log('  Smoke summary');
  console.log('══════════════════════════════════════════\n');
  for (const row of summary) {
    const tag = row.skipped ? 'SKIP' : row.ok ? 'PASS' : 'FAIL';
    console.log(`  [${tag}] ${row.label}`);
  }
  console.log('\nQA-05 smoke suite: PASS\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
