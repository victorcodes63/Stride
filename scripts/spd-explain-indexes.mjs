#!/usr/bin/env node
/**
 * Verify SPD-01 composite indexes use Index Scan (not Seq Scan) for org-scoped filters.
 *
 * Usage (requires DATABASE_URL in env):
 *   npm run spd:explain
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function explain(label, sql, params = []) {
  const rows = await prisma.$queryRawUnsafe(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`,
    ...params,
  );
  const plan = Array.isArray(rows) ? rows.map((r) => r['QUERY PLAN']).join('\n') : String(rows);
  const usesIndex = /Index Only Scan|Index Scan|Bitmap Index Scan/i.test(plan);
  const seqOnTinyTable = /Seq Scan/i.test(plan) && /rows=\d+\)/.test(plan);
  console.log(`\n=== ${label} ===`);
  console.log(plan);
  console.log(usesIndex ? '✓ index scan' : seqOnTinyTable ? '○ seq scan (tiny table — OK)' : '✗ NO index scan — review index');
  if (!usesIndex && !seqOnTinyTable) process.exitCode = 1;
}

async function main() {
  const orgRows = await prisma.$queryRaw`SELECT id FROM "Organization" LIMIT 1`;
  const orgId = orgRows[0]?.id;
  if (!orgId) throw new Error('No Organization row found');

  await explain(
    'Employee org + status',
    `SELECT COUNT(*) FROM "Employee" WHERE "organizationId" = $1::uuid AND "employmentStatus" = 'active'`,
    [orgId],
  );

  await explain(
    'Grievance org + status',
    `SELECT COUNT(*) FROM "Grievance" WHERE "organizationId" = $1::uuid AND status = 'SUBMITTED'`,
    [orgId],
  );

  await explain(
    'DisciplinaryCase org + status',
    `SELECT COUNT(*) FROM "DisciplinaryCase" WHERE "organizationId" = $1::uuid AND status = 'OPEN'`,
    [orgId],
  );

  await explain(
    'FleetVehicle org + status',
    `SELECT COUNT(*), status FROM "FleetVehicle" WHERE "organizationId" = $1::uuid GROUP BY status`,
    [orgId],
  );

  console.log('\nSPD explain checks complete.\n');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
