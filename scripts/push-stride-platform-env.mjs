#!/usr/bin/env node
/**
 * Push .env.local (+ app overrides) to linked stride-platform on Vercel.
 * Usage: node scripts/push-stride-platform-env.mjs
 */
import { readFileSync } from 'fs';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = dirname(fileURLToPath(import.meta.url));
const root = join(rootDir, '..');
const APP_URL = 'https://app.getstride.co.ke';

function parseEnvFile(path) {
  const out = {};
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function resolveInterpolated(env) {
  const resolved = { ...env };
  for (const [k, v] of Object.entries(resolved)) {
    if (v.includes('${')) {
      resolved[k] = v.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => resolved[name] ?? '');
    }
  }
  return resolved;
}

const local = resolveInterpolated(parseEnvFile(join(root, '.env.local')));

const SKIP = new Set([
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_OIDC_TOKEN',
  'VERCEL_TARGET_ENV',
  'VERCEL_GIT_PROVIDER',
  'VERCEL_GIT_REPO_SLUG',
  'VERCEL_GIT_COMMIT_REF',
  'VERCEL_GIT_COMMIT_SHA',
  'VERCEL_GIT_PULL_REQUEST_ID',
  'NX_DAEMON',
  'TURBO_CACHE',
  'TURBO_DOWNLOAD_LOCAL_ENABLED',
  'TURBO_REMOTE_ONLY',
  'TURBO_RUN_SUMMARY',
  'NEXT_PUBLIC_SITE_URL',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
]);

const OVERRIDES = {
  NEXT_PUBLIC_SITE_URL: APP_URL,
  NEXT_PUBLIC_APP_ORIGIN: APP_URL,
  NEXTAUTH_URL: APP_URL,
  NEXTAUTH_SECRET: local.NEXTAUTH_SECRET || randomBytes(32).toString('base64'),
  RUN_MIGRATIONS_ON_BUILD: 'true',
  NEXT_PUBLIC_TENANT_LOGIN_BRANDING: 'true',
  NEXT_PUBLIC_SHOW_DEMO_LOGIN_HINT: 'true',
};

if (!local.DIRECT_DATABASE_URL && local.DATABASE_URL_UNPOOLED) {
  local.DIRECT_DATABASE_URL = local.DATABASE_URL_UNPOOLED;
}

const SENSITIVE = /SECRET|PASSWORD|URL|TOKEN|KEY|DATABASE|POSTGRES|^PG/i;

function addEnv(name, value) {
  if (!value) {
    console.warn(`skip ${name} (empty)`);
    return;
  }
  for (const target of ['production']) {
    const args = ['env', 'add', name, target, '--value', value, '--force', '--yes'];
    if (SENSITIVE.test(name)) args.push('--sensitive');
    const result = spawnSync('vercel', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      const err = `${result.stderr || ''}${result.stdout || ''}`.trim();
      throw new Error(`vercel env add ${name} (${target}) failed: ${err}`);
    }
  }
  console.log(`✓ ${name}`);
}

console.log(`Pushing local env to stride-platform (${APP_URL})…`);

for (const [k, v] of Object.entries(OVERRIDES)) {
  addEnv(k, v);
}

for (const [k, v] of Object.entries(local)) {
  if (SKIP.has(k) || OVERRIDES[k] !== undefined) continue;
  addEnv(k, v);
}

console.log('Done.');
