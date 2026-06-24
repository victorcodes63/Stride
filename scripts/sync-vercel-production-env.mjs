#!/usr/bin/env node
/**
 * Sync Neon direct DB URL + production deploy env for automatic migrations on Vercel.
 * Reads DATABASE_URL_UNPOOLED from linked project and sets DIRECT_DATABASE_URL + flags.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const envFile = path.join(root, '.env.vercel-sync.tmp');

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

function addEnv(name, value, { sensitive = false } = {}) {
  const args = ['env', 'add', name, 'production', '--value', value, '--force', '--yes'];
  if (sensitive) args.push('--sensitive');
  const result = spawnSync('vercel', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`vercel env add ${name} failed: ${result.stderr || result.stdout}`);
  }
  console.log(`✓ ${name}`);
}

console.log('Pulling production env from Vercel…');
const pull = spawnSync('vercel', ['env', 'pull', envFile, '--environment=production', '--yes'], {
  cwd: root,
  encoding: 'utf8',
});
if (pull.status !== 0) {
  throw new Error(pull.stderr || pull.stdout || 'vercel env pull failed');
}

const env = parseEnv(fs.readFileSync(envFile, 'utf8'));
const unpooled =
  env.get('DATABASE_URL_UNPOOLED') ||
  env.get('POSTGRES_URL_NON_POOLING') ||
  env.get('DIRECT_DATABASE_URL') ||
  '';

if (!unpooled) {
  throw new Error('DATABASE_URL_UNPOOLED not found — ensure Neon is linked to the hcm project.');
}

console.log('Setting production env for automatic migrate-on-deploy…');
addEnv('DIRECT_DATABASE_URL', unpooled, { sensitive: true });
addEnv('RUN_MIGRATIONS_ON_BUILD', 'true');
addEnv('PRISMA_MIGRATE_ADVISORY_LOCK_TIMEOUT', '120000');

// Full-platform sales demo — every module and capability visible to prospects
addEnv('DEMO_MODE', 'true');
addEnv('NEXT_PUBLIC_DEMO_MODE', 'true');
addEnv('MULTI_ENTITY_ENABLED', 'true');
addEnv('DEMO_MULTI_CONTEXT', 'true');
addEnv('DEMO_UNIFIED_ADMIN_EMAIL', 'demo@demo.imara.co.ke');
addEnv('NEXT_PUBLIC_DEMO_ADMIN_EMAIL', 'demo@demo.imara.co.ke');
addEnv('NEXT_PUBLIC_DEMO_PASSWORD', 'Demo@2026!');

// Best-in-class paths (attendance reconciliation, leave policy engine, biometric ops)
addEnv('FEATURE_ATTENDANCE_V2', 'true');
addEnv('FEATURE_LEAVE_POLICY_V2', 'true');
addEnv('FEATURE_BIOMETRIC_OPS_V2', 'true');

// Clear wedge-only disables — demo mode licenses all modules; explicit true for clarity
for (const name of [
  'MODULE_ATS',
  'MODULE_ACCOUNTS',
  'MODULE_PERFORMANCE',
  'MODULE_HSE',
  'MODULE_ASSETS',
  'MODULE_COMMUNICATIONS',
  'MODULE_TRAINING',
  'MODULE_DOCUMENTS',
]) {
  addEnv(name, 'true');
}

try {
  fs.unlinkSync(envFile);
} catch {
  /* ignore */
}

console.log('Done. Push to main or run: vercel deploy --prod');
