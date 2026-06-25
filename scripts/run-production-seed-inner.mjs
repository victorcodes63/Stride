#!/usr/bin/env node
/**
 * Run cargo-logistics seed using owner DB URL (bypasses stride_app RLS).
 * Invoked inside `vercel env run -e production`.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const ownerUrl =
  process.env.DIRECT_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
  process.env.POSTGRES_URL_NON_POOLING?.trim() ||
  '';

if (!ownerUrl) {
  console.error('Missing DIRECT_DATABASE_URL (neondb_owner) — cannot seed through stride_app RLS.');
  process.exit(1);
}

const result = spawnSync('npx', ['tsx', 'prisma/seed-demo.ts'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: ownerUrl,
    DIRECT_DATABASE_URL: ownerUrl,
    DEMO_PACK: 'cargo-logistics',
    DEMO_MODE: 'true',
    DEMO_MULTI_CONTEXT: '',
    MULTI_ENTITY_ENABLED: 'false',
  },
});

process.exit(result.status ?? 1);
