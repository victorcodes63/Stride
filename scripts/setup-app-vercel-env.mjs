#!/usr/bin/env node
/**
 * Push app.getstride.co.ke platform env vars to the linked Vercel project.
 *
 * Usage (from Stride/):
 *   node scripts/setup-app-vercel-env.mjs
 *
 * Requires: vercel CLI linked to stride-platform (or your app project).
 * Copy DATABASE_URL + DIRECT_DATABASE_URL from Neon separately (see deployments/app-getstride.env).
 */
import { spawnSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const appUrl = (process.env.APP_SITE_URL || 'https://app.getstride.co.ke').replace(/\/$/, '');
const TARGETS = ['production', 'preview'];

function addEnv(name, value, { sensitive = false, targets = TARGETS } = {}) {
  if (value === undefined || value === null || value === '') {
    console.warn(`skip ${name} (empty)`);
    return;
  }
  for (const target of targets) {
    const args = ['env', 'add', name, target, '--value', String(value), '--force', '--yes'];
    if (sensitive) args.push('--sensitive');
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

const vars = [
  ['NEXT_PUBLIC_SITE_URL', appUrl],
  ['SITE_MODE', 'app'],
  ['NEXT_PUBLIC_APP_ORIGIN', appUrl],
  ['NEXT_PUBLIC_APP_NAME', 'Stride'],
  ['NEXT_PUBLIC_ORG_NAME', 'Stride'],
  ['NEXT_PUBLIC_BRAND_WORDMARK', 'Stride'],
  ['NEXT_PUBLIC_BRAND_LOGO', '/brand/stride-mark.svg'],
  ['NEXT_PUBLIC_BRAND_LOGO_PNG', '/brand/stride-mark.svg'],
  ['DEMO_MODE', 'true'],
  ['NEXT_PUBLIC_DEMO_MODE', 'true'],
  ['NEXT_PUBLIC_SHOW_DEMO_LOGIN_HINT', 'false'],
  ['NEXT_PUBLIC_TENANT_LOGIN_BRANDING', 'true'],
  ['NEXT_PUBLIC_INTERNAL_DEMO_SANDBOX', 'false'],
  ['NEXT_PUBLIC_DEMO_ACCESS_PAGE', 'false'],
  ['RUN_MIGRATIONS_ON_BUILD', 'true'],
];

console.log(`Setting platform Vercel env for ${appUrl}…`);
for (const [name, value] of vars) {
  addEnv(name, value);
}
console.log('Done. Add DATABASE_URL from Neon, attach app.getstride.co.ke, then redeploy.');
