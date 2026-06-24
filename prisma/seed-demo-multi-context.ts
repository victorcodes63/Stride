/**
 * Seed all demo packs into one database so the entity switcher can move between
 * company contexts (generic, petroleum-retail, …) without reseeding.
 *
 * Run: npm run demo:reseed:all-contexts
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { DEMO_PACK_IDS } from './demo-packs/load-pack';
import {
  OPERATING_ENTITIES_SETTINGS_KEY,
  sanitizeOperatingEntitiesSettings,
} from '../src/lib/operating-entities';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const prisma = new PrismaClient();

async function seedCombinedOperatingEntities() {
  const clients = await prisma.outsourcingClient.findMany({
    where: {
      OR: [{ entityCode: { endsWith: '__ke' } }, { entityCode: { endsWith: '__ug' } }],
    },
    orderBy: [{ entityCode: 'asc' }],
  });

  if (clients.length === 0) {
    console.warn('No composite entity clients found — skip operating entities merge.');
    return;
  }

  const entities = clients.map((client) => {
    const slug = client.entityCode!.toLowerCase();
    const countryCode = slug.endsWith('__ug') ? 'UG' : 'KE';
    return {
      id: slug,
      legalName: client.name,
      countryCode,
      currency: client.currency ?? (countryCode === 'UG' ? 'UGX' : 'KES'),
      employeeNumberPrefix: client.employeeNumberPrefix ?? 'EMP',
      isActive: true,
    };
  });

  const settings = sanitizeOperatingEntitiesSettings({
    multiEntityEnabled: true,
    defaultEntityId: entities[0]!.id,
    entities,
  });

  await prisma.systemSetting.upsert({
    where: { key: OPERATING_ENTITIES_SETTINGS_KEY },
    update: { value: settings },
    create: { key: OPERATING_ENTITIES_SETTINGS_KEY, value: settings },
  });

  console.log(`→ Operating entities: ${entities.length} contexts in entity switcher`);
  for (const e of entities) {
    console.log(`   · ${e.legalName} (${e.id})`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }

  console.log('Seeding all demo contexts into one database…\n');

  for (const packId of DEMO_PACK_IDS) {
    console.log(`\n════════ ${packId} ════════\n`);
    execSync('npx tsx prisma/seed-demo.ts', {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        DEMO_PACK: packId,
        DEMO_MULTI_CONTEXT: 'true',
        DEMO_ENTITY_PREFIX: packId,
      },
    });
  }

  await seedCombinedOperatingEntities();
  console.log('\nAll demo contexts seeded. Use the top-bar entity switcher to change company context.\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
