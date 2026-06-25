#!/usr/bin/env node
/**
 * Push marketing domain env vars to the linked Vercel project.
 *
 * Usage (from Stride/):
 *   MARKETING_SITE_URL=https://getstride.co.ke node scripts/setup-marketing-vercel-env.mjs
 *
 * Requires: vercel CLI linked to the target project.
 */
import { spawnSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const siteUrl = (process.env.MARKETING_SITE_URL || 'https://getstride.co.ke').replace(/\/$/, '');
const marketingDomain = process.env.MARKETING_DOMAIN || 'getstride.co.ke';
const appOrigin = (process.env.MARKETING_APP_ORIGIN || 'https://app.getstride.co.ke').replace(
  /\/$/,
  '',
);

const TARGETS = ['production', 'preview'];

function addEnv(name, value, { sensitive = false, targets = TARGETS } = {}) {
  if (!value) {
    console.warn(`skip ${name} (empty)`);
    return;
  }
  for (const target of targets) {
    const args = ['env', 'add', name, target, '--value', value, '--force', '--yes'];
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
  ['NEXT_PUBLIC_SITE_URL', siteUrl],
  ['NEXT_PUBLIC_MARKETING_DOMAIN', marketingDomain],
  ['NEXT_PUBLIC_APP_ORIGIN', appOrigin],
  ['NEXT_PUBLIC_APP_NAME', 'Stride'],
  ['NEXT_PUBLIC_BRAND_WORDMARK', 'Stride'],
  ['NEXT_PUBLIC_BRAND_LOGO', '/brand/stride-mark.svg'],
  ['NEXT_PUBLIC_BRAND_LOGO_PNG', '/brand/stride-mark.svg'],
  ['NEXT_PUBLIC_BRAND_WORDMARK', '/brand/stride-wordmark.svg'],
  ['DEMO_MODE', 'false'],
  ['NEXT_PUBLIC_DEMO_MODE', 'false'],
  ['NEXT_PUBLIC_SHOW_DEMO_LOGIN_HINT', 'false'],
  ['NEXT_PUBLIC_GENERIC_PUBLIC_LOGIN', 'true'],
  ['NEXT_PUBLIC_INTERNAL_DEMO_SANDBOX', 'false'],
  ['NEXT_PUBLIC_DEMO_ACCESS_PAGE', 'false'],
  ['RUN_MIGRATIONS_ON_BUILD', 'false'],
];

console.log(`Setting marketing Vercel env for ${siteUrl}…`);
for (const [name, value] of vars) {
  addEnv(name, value);
}
console.log('Done. Attach getstride.co.ke in Vercel → Project → Domains, then redeploy.');
