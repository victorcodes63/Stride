import { PrismaClient } from '@prisma/client';
import {
  OPERATING_ENTITIES_SETTINGS_KEY,
  buildVerticalShowcaseOperatingEntitiesSettings,
} from '../src/lib/operating-entities';

const prisma = new PrismaClient();

async function main() {
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

  await prisma.systemSetting.upsert({
    where: { key: OPERATING_ENTITIES_SETTINGS_KEY },
    update: { value: settings },
    create: { key: OPERATING_ENTITIES_SETTINGS_KEY, value: settings },
  });

  console.log(`Updated switcher with ${settings.entities.length} showcase context(s):`);
  for (const e of settings.entities) console.log(`  · ${e.legalName} (${e.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
