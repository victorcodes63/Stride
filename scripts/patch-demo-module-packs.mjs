#!/usr/bin/env node
/**
 * Patch admin.company.setup:${packId} moduleAdminFlags on the shared multi-vertical org.
 * Does not reseed employees — only company-setup rows.
 *
 * Usage (demo Neon):
 *   DATABASE_URL=... DEMO_MULTI_CONTEXT=true npx tsx scripts/patch-demo-module-packs.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { getDemoModuleAdminFlags } from '../src/lib/demo-vertical-module-packs.ts';
import { companySetupKeyForContext } from '../src/lib/demo-entity-slug.ts';
import { VERTICAL_SHOWCASE_PACK_IDS } from '../prisma/demo-packs/types.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MULTI_SLUG = 'demo-multi-vertical';

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const map = {};
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    map[t.slice(0, eq).trim()] = v;
  }
  return map;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    const cell = loadEnvFile(path.join(root, '.env.demo-cell.local'));
    const url = cell.DIRECT_DATABASE_URL || cell.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL not set');
    process.env.DATABASE_URL = url;
    process.env.DIRECT_DATABASE_URL = url;
  }

  const prisma = new PrismaClient();
  try {
    const org = await prisma.organization.findUnique({ where: { slug: MULTI_SLUG } });
    if (!org) {
      throw new Error(`Org ${MULTI_SLUG} not found — run multi-vertical seed first`);
    }

    for (const packId of VERTICAL_SHOWCASE_PACK_IDS) {
      const key = companySetupKeyForContext(packId);
      const flags = getDemoModuleAdminFlags(packId);
      const existing = await prisma.systemSetting.findUnique({
        where: { organizationId_key: { organizationId: org.id, key } },
      });
      const prev =
        existing?.value && typeof existing.value === 'object' && !Array.isArray(existing.value)
          ? existing.value
          : {};
      const next = { ...prev, moduleAdminFlags: flags };
      await prisma.systemSetting.upsert({
        where: { organizationId_key: { organizationId: org.id, key } },
        create: {
          organizationId: org.id,
          key,
          value: next,
          updatedAt: new Date(),
        },
        update: { value: next, updatedAt: new Date() },
      });
      const off = Object.entries(flags)
        .filter(([, v]) => !v)
        .map(([k]) => k);
      console.log(`✓ ${key} — hidden: ${off.length ? off.join(', ') : '(none — full platform)'}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
