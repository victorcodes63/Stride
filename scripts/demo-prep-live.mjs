#!/usr/bin/env node
/**
 * Prep the live demo cell for client week:
 *   schema push → multi-vertical seed (+ enrichment, fleet, sales) → email domains → smoke checklist.
 *
 * Requires .env.demo-cell.local (same as demo:cell:provision).
 *
 * Usage: npm run demo:prep:live
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(label, cmd, args, env) {
  console.log(`\n═══ ${label} ═══\n`);
  const r = spawnSync(cmd, args, { cwd: root, env, stdio: 'inherit' });
  if (r.status !== 0) {
    throw new Error(`${label} failed (exit ${r.status})`);
  }
}

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

function main() {
  const cell = loadEnvFile(path.join(root, '.env.demo-cell.local'));
  const profile = loadEnvFile(path.join(root, 'deployments', 'demo-getstride.env'));
  const direct = cell.DIRECT_DATABASE_URL || cell.DATABASE_URL;
  const unifiedAdmin = profile.DEMO_UNIFIED_ADMIN_EMAIL || 'admin@imara.co.ke';

  console.log('demo:prep:live — provision multi-vertical demo cell + smoke checklist');
  console.log(`  Admin: ${unifiedAdmin}`);

  run('provision', 'node', ['scripts/provision-demo-neon-cell.mjs'], process.env);

  run('smoke checklist', 'npx', ['tsx', 'scripts/demo-prep-live-smoke.mjs'], {
    ...process.env,
    DATABASE_URL: direct,
    DIRECT_DATABASE_URL: direct,
    DEMO_UNIFIED_ADMIN_EMAIL: unifiedAdmin,
  });
}

main();
