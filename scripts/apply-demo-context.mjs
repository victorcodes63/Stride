#!/usr/bin/env node
/**
 * Apply a demo context profile to .env.local and optionally re-seed.
 *
 * Usage:
 *   node scripts/apply-demo-context.mjs generic
 *   node scripts/apply-demo-context.mjs petroleum-retail --reseed
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const contexts = [
  'generic',
  'petroleum-retail',
  'imara-sacco',
  'cargo-logistics',
  'hospital-healthcare',
  'travel-agency',
  'all-verticals',
  'blank-shell',
];

function parseEnvFile(text) {
  const map = new Map();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return map;
}

function mergeEnv(localText, profileText) {
  const profile = parseEnvFile(profileText);
  const lines = localText.split('\n');
  const seen = new Set();
  const out = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      out.push(line);
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      out.push(line);
      continue;
    }
    const key = trimmed.slice(0, eq);
    if (profile.has(key)) {
      out.push(`${key}=${profile.get(key)}`);
      seen.add(key);
    } else {
      out.push(line);
    }
  }

  const additions = [];
  for (const [key, value] of profile.entries()) {
    if (!seen.has(key)) additions.push(`${key}=${value}`);
  }
  if (additions.length) {
    out.push('', '# —— Demo context (apply-demo-context) ——', ...additions);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

const context = (process.argv[2] || 'generic').trim();
const reseed = process.argv.includes('--reseed');

if (!contexts.includes(context)) {
  console.error(`Unknown context "${context}". Available: ${contexts.join(', ')}`);
  process.exit(1);
}

const profilePath = path.join(root, 'deployments', `${context}.env`);
const localPath = path.join(root, '.env.local');

if (!existsSync(profilePath)) {
  console.error(`Missing profile: ${profilePath}`);
  process.exit(1);
}
if (!existsSync(localPath)) {
  console.error('Missing .env.local — copy from .env.example first.');
  process.exit(1);
}

const merged = mergeEnv(readFileSync(localPath, 'utf8'), readFileSync(profilePath, 'utf8'));
writeFileSync(localPath, merged, 'utf8');
console.log(`Applied demo context "${context}" to .env.local`);

if (reseed) {
  if (!process.env.DATABASE_URL) {
    const local = parseEnvFile(merged);
    if (local.has('DATABASE_URL')) {
      process.env.DATABASE_URL = local.get('DATABASE_URL').replace(/^"|"$/g, '');
    }
  }
  console.log('\nSeeding demo pack…');
  execSync('npm run db:seed-all-demo', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, DEMO_PACK: context },
  });
  console.log('\nDone. Restart dev server if it is running.');
} else {
  console.log(`\nNext: npm run demo:reseed  (or: node scripts/apply-demo-context.mjs ${context} --reseed)`);
}
