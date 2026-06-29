#!/usr/bin/env node
/**
 * Create/link stride-demo Vercel project and push demo.getstride.co.ke env profile.
 *
 * Requires .env.demo-cell.local (Neon URLs) + deployments/demo-getstride.env
 *
 * Usage: npm run demo:cell:deploy
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMO_PROJECT = 'stride-demo';
const DEMO_DOMAIN = 'demo.getstride.co.ke';

function parseEnvFile(text) {
  const map = new Map();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
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

function run(cmd, args, { cwd = root, inherit = false } = {}) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  if (r.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(' ')} failed: ${(r.stderr || r.stdout || '').trim()}`,
    );
  }
  return (r.stdout || '').trim();
}

function addEnv(name, value, { sensitive = false, target = 'production' } = {}) {
  if (!value) {
    console.warn(`skip ${name} (empty)`);
    return;
  }
  spawnSync('vercel', ['env', 'rm', name, target, '--yes'], { cwd: root, stdio: 'ignore' });
  const args = ['env', 'add', name, target, '--value', value, '--force', '--yes'];
  if (sensitive) args.push('--sensitive');
  const r = spawnSync('vercel', args, { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`vercel env add ${name} failed`);
  console.log(`✓ ${name}`);
}

const cellEnvPath = path.join(root, '.env.demo-cell.local');
if (!existsSync(cellEnvPath)) {
  throw new Error('Missing .env.demo-cell.local');
}

const cell = parseEnvFile(readFileSync(cellEnvPath, 'utf8'));
const profile = parseEnvFile(readFileSync(path.join(root, 'deployments', 'demo-getstride.env'), 'utf8'));

const pooled = cell.get('DATABASE_URL');
const direct = cell.get('DIRECT_DATABASE_URL') || pooled;
if (!pooled || !direct) {
  throw new Error('.env.demo-cell.local needs DATABASE_URL and DIRECT_DATABASE_URL');
}

// Ensure stride-demo project exists
const list = run('vercel', ['project', 'ls']);
if (!list.includes(DEMO_PROJECT)) {
  console.log(`Creating Vercel project ${DEMO_PROJECT}…`);
  run('vercel', ['project', 'add', DEMO_PROJECT], { inherit: true });
}

// Link this repo to stride-demo for deploy
const vercelDir = path.join(root, '.vercel');
const platformLink = path.join(vercelDir, 'project.stride-platform.json');
if (existsSync(platformLink) && !existsSync(path.join(vercelDir, 'project.stride-platform.json.bak'))) {
  run('cp', [path.join(vercelDir, 'project.json'), platformLink]);
}

run('vercel', ['link', '--project', DEMO_PROJECT, '--yes'], { inherit: true });

console.log(`\nApplying demo env to ${DEMO_PROJECT} (production)…\n`);

const SENSITIVE = new Set([
  'DATABASE_URL',
  'DIRECT_DATABASE_URL',
  'POSTGRES_PRISMA_URL',
  'STAFF_PASSWORD',
  'NEXTAUTH_SECRET',
  'CRON_SECRET',
  'STRIDE_CELL_PROVISION_KEY',
]);

addEnv('DATABASE_URL', pooled, { sensitive: true });
addEnv('DIRECT_DATABASE_URL', direct, { sensitive: true });
addEnv('POSTGRES_PRISMA_URL', pooled, { sensitive: true });

for (const [key, value] of profile.entries()) {
  if (SENSITIVE.has(key)) continue;
  addEnv(key, value);
}

addEnv('NEXTAUTH_SECRET', crypto.randomBytes(32).toString('base64url'), { sensitive: true });
addEnv('CRON_SECRET', crypto.randomBytes(32).toString('base64url'), { sensitive: true });

function readProvisionKey() {
  const localPaths = [
    path.join(root, '.env.local'),
    path.join(root, '..', 'control-plane', '.env.local'),
  ];
  for (const file of localPaths) {
    if (!existsSync(file)) continue;
    const map = parseEnvFile(readFileSync(file, 'utf8'));
    const key = map.get('STRIDE_CELL_PROVISION_KEY')?.trim();
    if (key) return key;
  }
  return '';
}

const provisionKey = readProvisionKey();
if (provisionKey) {
  addEnv('STRIDE_CELL_PROVISION_KEY', provisionKey, { sensitive: true });
} else {
  console.warn(
    'STRIDE_CELL_PROVISION_KEY not found in app or control-plane .env.local — set manually on stride-demo for control-plane Users tab.',
  );
}

console.log(`\nDeploying to production…`);
run('vercel', ['deploy', '--prod', '--yes'], { inherit: true });

console.log(`\nAdding domain ${DEMO_DOMAIN}…`);
try {
  run('vercel', ['domains', 'add', DEMO_DOMAIN, DEMO_PROJECT], { inherit: true });
} catch {
  console.warn(
    `Could not add ${DEMO_DOMAIN} automatically — add CNAME in DNS and attach domain in Vercel dashboard.`,
  );
}

console.log('\nDone.');
console.log(`  Demo URL: https://${DEMO_DOMAIN} (after DNS)`);
console.log(`  Vercel:   https://vercel.com/rtgprojects/${DEMO_PROJECT}`);
console.log('  Restore stride-platform link: cp .vercel/project.stride-platform.json .vercel/project.json');
