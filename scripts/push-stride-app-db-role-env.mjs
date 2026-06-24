#!/usr/bin/env node
/**
 * Point Vercel DATABASE_URL at stride_app (RLS enforced); keep neondb_owner on DIRECT_DATABASE_URL.
 * Reads URLs from .stride-app-env.json (created by push flow / agent).
 */
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const secretsPath = join(root, '.stride-app-env.json');

if (!existsSync(secretsPath)) {
  console.error('Missing .stride-app-env.json — run stride_app password setup first.');
  process.exit(1);
}

const { stridePooledUrl, directUrl } = JSON.parse(readFileSync(secretsPath, 'utf8'));

function setEnv(name, value, { sensitive = false, targets = ['production'] } = {}) {
  for (const target of targets) {
    spawnSync('vercel', ['env', 'rm', name, target, '--yes'], { cwd: root, stdio: 'ignore' });
    const args = ['env', 'add', name, target, '--value', value, '--force', '--yes'];
    if (sensitive) args.push('--sensitive');
    const result = spawnSync('vercel', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (result.status !== 0) {
      throw new Error(
        `vercel env add ${name} (${target}) failed: ${(result.stderr || result.stdout || '').trim()}`,
      );
    }
  }
  console.log(`✓ ${name}`);
}

console.log('Updating stride-platform Vercel DB env (stride_app runtime + owner migrations)…');
setEnv('DATABASE_URL', stridePooledUrl, { sensitive: true });
setEnv('DIRECT_DATABASE_URL', directUrl, { sensitive: true });
setEnv('POSTGRES_PRISMA_URL', stridePooledUrl, { sensitive: true });
console.log('Done. Redeploy stride-platform for changes to take effect.');
unlinkSync(secretsPath);
