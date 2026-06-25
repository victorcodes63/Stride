#!/usr/bin/env node
/**
 * Point production DATABASE_URL back at neondb_owner (pooled) so routes that
 * have not yet been migrated to withTenant() keep working under FORCE RLS.
 *
 * Keeps DIRECT_DATABASE_URL on neondb_owner direct for migrations.
 * Re-enable stride_app later after API routes use withTenant / org context.
 *
 * Usage: node scripts/restore-production-owner-database-url.mjs
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function pgUrl(raw) {
  return new URL(raw.replace('postgresql://', 'http://'));
}

function toPooledOwnerUrl(directOrPooledUrl) {
  const u = pgUrl(directOrPooledUrl);
  if (u.hostname.includes('-pooler')) {
    return `postgresql://${u.username}:${encodeURIComponent(u.password)}@${u.host}${u.pathname}${u.search}`;
  }
  u.hostname = u.hostname.replace(/^(ep-[^.]+)\./, '$1-pooler.');
  return `postgresql://${u.username}:${encodeURIComponent(u.password)}@${u.host}${u.pathname}${u.search}`;
}

function setEnv(name, value) {
  spawnSync('vercel', ['env', 'rm', name, 'production', '--yes'], { cwd: root, stdio: 'ignore' });
  const args = ['env', 'add', name, 'production', '--value', value, '--force', '--yes', '--sensitive'];
  const result = spawnSync('vercel', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`vercel env add ${name} failed: ${result.stderr || result.stdout}`);
  }
  console.log(`✓ ${name} → neondb_owner (pooled)`);
}

const inner = `
const direct =
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  '';
if (!direct.includes('neondb_owner')) {
  console.error('Expected neondb_owner in DIRECT_DATABASE_URL — got role:', direct.split('://')[1]?.split(':')[0] || 'unknown');
  process.exit(1);
}
function pgUrl(raw) {
  return new URL(raw.replace('postgresql://', 'http://'));
}
function toPooledOwnerUrl(directOrPooledUrl) {
  const u = pgUrl(directOrPooledUrl);
  if (u.hostname.includes('-pooler')) {
    return 'postgresql://' + u.username + ':' + encodeURIComponent(u.password) + '@' + u.host + u.pathname + u.search;
  }
  u.hostname = u.hostname.replace(/^(ep-[^.]+)\\./, '$1-pooler.');
  return 'postgresql://' + u.username + ':' + encodeURIComponent(u.password) + '@' + u.host + u.pathname + u.search;
}
console.log(toPooledOwnerUrl(direct));
`;

console.log('Reading DIRECT_DATABASE_URL from stride-platform production…');
const run = spawnSync(
  'vercel',
  ['env', 'run', '-e', 'production', '--', 'node', '-e', inner],
  { cwd: root, encoding: 'utf8' },
);

const ownerPooled = (run.stdout || '').trim().split('\n').pop()?.trim();
if (run.status !== 0 || !ownerPooled?.startsWith('postgresql://')) {
  console.error(run.stderr || run.stdout || 'Failed to derive owner pooled URL');
  process.exit(1);
}

console.log('Updating stride-platform production DATABASE_URL…');
setEnv('DATABASE_URL', ownerPooled);
setEnv('POSTGRES_PRISMA_URL', ownerPooled);
console.log('Done. Redeploy stride-platform (or push to main) for runtime to pick up the change.');
