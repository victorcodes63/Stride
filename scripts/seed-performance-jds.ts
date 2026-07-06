/**
 * PERF-01: Seed Stabex JD reference pack for the first organization.
 * Run: npm run db:seed-performance-jds
 */
import { PrismaClient } from '@prisma/client';

import { ensureJdParserConfigManual, importStabexReferencePack } from '../src/lib/performance/jd/service';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!org) {
    console.error('No Organization row — run tenancy migration / seed first.');
    process.exit(1);
  }

  const result = await prisma.$transaction(async (tx) => {
    await ensureJdParserConfigManual(tx, org.id);
    return importStabexReferencePack(tx, {
      organizationId: org.id,
      replaceExisting: true,
    });
  });

  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }

  console.log(
    `Imported ${result.packName}: ${result.divisionCount} divisions, ${result.roleCount} published JDs for org ${org.slug}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
