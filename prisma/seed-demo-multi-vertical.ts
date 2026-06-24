/**
 * Seed all vertical showcase packs into one database.
 * The entity switcher lists one Kenya entity per sector — switch without re-seeding.
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
} from '../src/lib/operating-entities';
import { UNIFIED_DEMO_EMAIL } from './demo-packs/build-from-generic';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const prisma = new PrismaClient();

async function seedCombinedOperatingEntities() {
  const clients = await prisma.outsourcingClient.findMany({
    where: { entityCode: { endsWith: '__ke' } },
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

  await prisma.systemSetting.upsert({
    where: { key: OPERATING_ENTITIES_SETTINGS_KEY },
    update: { value: settings },
    create: { key: OPERATING_ENTITIES_SETTINGS_KEY, value: settings },
  });

  console.log(`→ Vertical switcher: ${settings.entities.length} company contexts (one per sector)`);
  for (const e of settings.entities) {
    console.log(`   · ${e.legalName} (${e.id})`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }

  console.log('Seeding all vertical showcase contexts into one database…');
  console.log(`Unified admin login: ${UNIFIED_DEMO_EMAIL}\n`);

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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
