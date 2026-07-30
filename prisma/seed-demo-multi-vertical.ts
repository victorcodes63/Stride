/**
 * Seed all vertical showcase packs into one database.
 * The entity switcher lists one Kenya entity per sector — switch without re-seeding.
 *
 * All packs share org slug `demo-multi-vertical` so login brand + switcher + session
 * use the same source of truth (not six separate tenants).
 *
 * Run: npm run demo:reseed:all-verticals
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import {
  OPERATING_ENTITIES_SETTINGS_KEY,
  buildVerticalShowcaseOperatingEntitiesSettings,
} from '../src/lib/operating-entities-shared';
import { UNIFIED_DEMO_EMAIL } from './demo-packs/build-from-generic';
import { VERTICAL_SHOWCASE_PACK_IDS } from './demo-packs/types';
import { SEED_DEFAULT_ORG_ID, systemSettingUpsert } from './system-setting-seed';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const prisma = new PrismaClient();

export const MULTI_VERTICAL_ORG_SLUG = 'demo-multi-vertical';

async function seedCombinedOperatingEntities() {
  const sharedOrg = await prisma.organization.findUnique({
    where: { slug: MULTI_VERTICAL_ORG_SLUG },
    select: { id: true, name: true, slug: true },
  });
  if (!sharedOrg) {
    console.warn(`Shared org ${MULTI_VERTICAL_ORG_SLUG} missing — skip operating entities merge.`);
    return;
  }

  const clients = await prisma.outsourcingClient.findMany({
    where: {
      organizationId: sharedOrg.id,
      entityCode: { endsWith: '__ke' },
    },
    orderBy: [{ entityCode: 'asc' }],
    select: {
      entityCode: true,
      name: true,
      currency: true,
      employeeNumberPrefix: true,
    },
  });

  const settings = buildVerticalShowcaseOperatingEntitiesSettings(clients);

  if (settings.entities.length === 0) {
    console.warn('No vertical showcase entities found — skip operating entities merge.');
    return;
  }

  // Session org (real) + legacy DEFAULT id used by some public brand loaders.
  await systemSettingUpsert(prisma, sharedOrg.id, OPERATING_ENTITIES_SETTINGS_KEY, settings);
  await systemSettingUpsert(prisma, SEED_DEFAULT_ORG_ID, OPERATING_ENTITIES_SETTINGS_KEY, settings);

  console.log(
    `→ Vertical switcher on ${sharedOrg.slug}: ${settings.entities.length} companies (default ${settings.defaultEntityId})`,
  );
  for (const e of settings.entities) {
    console.log(`   · ${e.legalName} (${e.id})`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }

  console.log('Seeding all vertical showcase contexts into one shared organization…');
  console.log(`  Org slug: ${MULTI_VERTICAL_ORG_SLUG}`);
  console.log(
    `  Unified admin login: ${process.env.DEMO_UNIFIED_ADMIN_EMAIL ?? UNIFIED_DEMO_EMAIL}\n`,
  );

  for (const packId of VERTICAL_SHOWCASE_PACK_IDS) {
    console.log(`\n════════ ${packId} ════════\n`);
    execSync('npx tsx prisma/seed-demo.ts', {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        DEMO_PACK: packId,
        DEMO_MULTI_CONTEXT: 'true',
        DEMO_ENTITY_PREFIX: packId,
        DEMO_UNIFIED_ADMIN_EMAIL: process.env.DEMO_UNIFIED_ADMIN_EMAIL ?? UNIFIED_DEMO_EMAIL,
      },
    });
  }

  await seedCombinedOperatingEntities();
  console.log('\nAll vertical contexts seeded. Use the top-bar switcher to change sector demo.\n');

  execSync('npx tsx prisma/seed-demo-enrichment.ts', {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      DEMO_UNIFIED_ADMIN_EMAIL: process.env.DEMO_UNIFIED_ADMIN_EMAIL ?? UNIFIED_DEMO_EMAIL,
    },
  });

  console.log('\n→ Cleanup legacy/orphan outsourcing clients…');
  execSync('npx tsx scripts/cleanup-demo-orphan-clients.ts', {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });

  console.log('\n→ Security / manpower end-client roster…');
  execSync('npx tsx prisma/seed-demo-security-bpo.ts', {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      DEMO_UNIFIED_ADMIN_EMAIL: process.env.DEMO_UNIFIED_ADMIN_EMAIL ?? UNIFIED_DEMO_EMAIL,
      NEXT_PUBLIC_DEMO_PASSWORD:
        process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? process.env.STAFF_PASSWORD ?? 'Demo@2026!',
    },
  });

  // Re-merge switcher after cleanup (must still be exactly the 6 showcase KE entities).
  await seedCombinedOperatingEntities();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
