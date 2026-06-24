#!/usr/bin/env node
/**
 * Generate STRIDE_CELL_PROVISION_KEY and push to Vercel production + preview.
 * Updates control-plane .env.local when present.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const cpEnvPath = join(appRoot, '..', 'control-plane', '.env.local');
const secretsPath = join(appRoot, '.stride-cell-provision-key.json');

const key = randomBytes(32).toString('hex');
writeFileSync(secretsPath, JSON.stringify({ key }, null, 2), { mode: 0o600 });

function setVercelEnv(name, value, target) {
  spawnSync('vercel', ['env', 'rm', name, target, '--yes'], { cwd: appRoot, stdio: 'ignore' });
  const args = ['env', 'add', name, target, '--value', value, '--force', '--yes', '--sensitive'];
  if (target === 'preview') args.splice(3, 0, '*');
  const result = spawnSync('vercel', args, { cwd: appRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) {
    throw new Error(`vercel env add ${name} (${target}) failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  console.log(`✓ ${name} (${target})`);
}

function upsertEnvLocal(path, name, value) {
  if (!existsSync(path)) return false;
  let content = readFileSync(path, 'utf8');
  const line = `${name}=${value}`;
  if (new RegExp(`^${name}=`, 'm').test(content)) {
    content = content.replace(new RegExp(`^${name}=.*$`, 'm'), line);
  } else {
    content = content.trimEnd() + `\n${line}\n`;
  }
  writeFileSync(path, content);
  return true;
}

console.log('Setting STRIDE_CELL_PROVISION_KEY on stride-platform (Vercel)…');
setVercelEnv('STRIDE_CELL_PROVISION_KEY', key, 'production');
try {
  setVercelEnv('STRIDE_CELL_PROVISION_KEY', key, 'preview');
} catch (e) {
  console.warn('Preview env skipped:', e.message);
}

if (upsertEnvLocal(join(appRoot, '.env.local'), 'STRIDE_CELL_PROVISION_KEY', key)) {
  console.log('✓ app .env.local');
}
if (upsertEnvLocal(cpEnvPath, 'STRIDE_CELL_PROVISION_KEY', key)) {
  console.log('✓ control-plane .env.local');
}

console.log('\nDone. Redeploy stride-platform for production to pick up the new var.');
console.log('Key stored temporarily in .stride-cell-provision-key.json (delete after verifying).');
