#!/usr/bin/env node
/**
 * Align runtime DB role everywhere: stride_app (RLS) + neondb_owner direct for migrations.
 * Updates .env.local and writes .stride-app-env.json for Vercel push.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envLocalPath = join(root, '.env.local');
const secretsPath = join(root, '.stride-app-env.json');

function parseEnvFile(path) {
  const out = { lines: readFileSync(path, 'utf8').split('\n'), map: {} };
  for (const line of out.lines) {
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
    out.map[key] = val;
  }
  return out;
}

function quoteEnv(val) {
  if (/[\s#"'\\]/.test(val)) return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  return val;
}

function upsertEnvLocal(key, value) {
  const env = parseEnvFile(envLocalPath);
  const prefix = `${key}=`;
  let found = false;
  env.lines = env.lines.map((line) => {
    if (line.startsWith(prefix) || line.trim().startsWith(`${key}=`)) {
      found = true;
      return `${key}=${quoteEnv(value)}`;
    }
    return line;
  });
  if (!found) env.lines.push(`${key}=${quoteEnv(value)}`);
  writeFileSync(envLocalPath, `${env.lines.join('\n').replace(/\n*$/, '')}\n`, 'utf8');
}

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

function toDirectOwnerUrl(directOrPooledUrl) {
  const u = pgUrl(directOrPooledUrl);
  u.hostname = u.hostname.replace('-pooler', '');
  return `postgresql://${u.username}:${encodeURIComponent(u.password)}@${u.host}${u.pathname}${u.search}`;
}

function buildStrideUrls(ownerPooledUrl, password) {
  const owner = pgUrl(ownerPooledUrl);
  const stridePass = encodeURIComponent(password);
  const stridePooledUrl = `postgresql://stride_app:${stridePass}@${owner.host}${owner.pathname}${owner.search}`;
  const directUrl = toDirectOwnerUrl(ownerPooledUrl);
  return { stridePooledUrl, directUrl };
}

async function main() {
  if (!existsSync(envLocalPath)) {
    throw new Error('Missing .env.local');
  }

  const env = parseEnvFile(envLocalPath);
  const adminUrl = env.map.DIRECT_DATABASE_URL?.includes('neondb_owner')
    ? env.map.DIRECT_DATABASE_URL
    : env.map.DATABASE_URL?.includes('neondb_owner')
      ? env.map.DATABASE_URL
      : null;

  if (!adminUrl) {
    throw new Error('Need neondb_owner in DATABASE_URL or DIRECT_DATABASE_URL to rotate stride_app password');
  }

  const ownerPooledUrl = toPooledOwnerUrl(adminUrl);
  const password = randomBytes(24).toString('base64url');
  const db = new PrismaClient({ datasources: { db: { url: adminUrl } } });

  try {
    await db.$executeRawUnsafe(
      `ALTER ROLE stride_app WITH LOGIN PASSWORD '${password.replace(/'/g, "''")}'`,
    );
  } finally {
    await db.$disconnect();
  }

  const { stridePooledUrl, directUrl } = buildStrideUrls(ownerPooledUrl, password);

  upsertEnvLocal('DATABASE_URL', stridePooledUrl);
  upsertEnvLocal('DIRECT_DATABASE_URL', directUrl);

  writeFileSync(secretsPath, JSON.stringify({ stridePooledUrl, directUrl }, null, 2), {
    mode: 0o600,
  });

  console.log('✓ stride_app password rotated');
  console.log('✓ .env.local DATABASE_URL → stride_app, DIRECT_DATABASE_URL → neondb_owner (direct)');
  console.log('✓ wrote .stride-app-env.json for Vercel push');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
