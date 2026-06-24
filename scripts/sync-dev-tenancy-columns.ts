/**
 * Dev helper: add + backfill organizationId on legacy DBs where the tenancy
 * migration failed partway (e.g. missing FleetVehicle).
 *
 * Usage: npx tsx scripts/sync-dev-tenancy-columns.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEFAULT_ORG_ID = '00000000-0000-4000-8000-000000000001';

const SKIP_TABLES = new Set([
  'Organization',
  'User',
  'PermissionDefinition',
  'RolePermission',
  'CountryConfig',
  'SchedulerLock',
  '_prisma_migrations',
]);

async function ensureDefaultOrg() {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")
    VALUES ('${DEFAULT_ORG_ID}', 'Default Organization', 'default', CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO NOTHING
  `);
}

async function main() {
  await ensureDefaultOrg();

  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;

  let altered = 0;
  for (const { tablename } of tables) {
    if (SKIP_TABLES.has(tablename)) continue;

    const cols = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${tablename}
    `;
    if (cols.length === 0) continue;
    if (cols.some((c) => c.column_name === 'organizationId')) continue;

    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${tablename}" ADD COLUMN IF NOT EXISTS "organizationId" UUID`,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "${tablename}" SET "organizationId" = '${DEFAULT_ORG_ID}' WHERE "organizationId" IS NULL`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${tablename}" ALTER COLUMN "organizationId" SET NOT NULL`,
    );
    altered += 1;
    console.log(`→ ${tablename}`);
  }

  console.log(`Backfilled organizationId on ${altered} table(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
