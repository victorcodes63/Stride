#!/usr/bin/env node
/**
 * Push Imara SACCO demo env from deployments/imara-sacco.env to linked Vercel project.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const profilePath = path.join(root, 'deployments/imara-sacco.env');

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
  if (!value) return;
  const args = ['env', 'add', name, 'production', '--value', value, '--force', '--yes'];
  if (sensitive) args.push('--sensitive');
  const result = spawnSync('vercel', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`vercel env add ${name} failed: ${result.stderr || result.stdout}`);
  }
  console.log(`✓ ${name}`);
}

const vars = parseEnv(fs.readFileSync(profilePath, 'utf8'));
const sensitive = new Set(['STAFF_PASSWORD', 'NEXT_PUBLIC_DEMO_PASSWORD', 'NEXTAUTH_SECRET', 'CRON_SECRET']);

console.log('Applying Imara SACCO profile to Vercel production…');
for (const [name, value] of vars) {
  addEnv(name, value, { sensitive: sensitive.has(name) });
}
console.log('Done. Redeploy with: vercel deploy --prod');
