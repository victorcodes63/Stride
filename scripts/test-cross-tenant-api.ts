#!/usr/bin/env npx tsx
/**
 * ISO-03 cross-tenant check: Org A row must not appear under Org B context.
 * Requires DATABASE_URL with neondb_owner or stride_app + test:rls org creation pattern.
 *
 * Usage: npm run test:cross-tenant  (or DATABASE_URL=... npx tsx scripts/test-cross-tenant-api.ts)
 */
import { PrismaClient, type Prisma } from '@prisma/client';

async function withAppRole<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = new PrismaClient();
  try {
    await db.$executeRaw`SET ROLE stride_app`.catch(() => null);
    return await fn(db);
  } finally {
    await db.$disconnect();
  }
}

async function withOrgContextOn<T>(
  db: PrismaClient,
  organizationId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org', ${organizationId}, true)`;
    return fn(tx);
  });
}

async function main() {
  const suffix = Date.now();
  const db = new PrismaClient();
  let orgA: { id: string };
  let orgB: { id: string };
  let clientA: { id: string };

  try {
    orgA = await db.organization.create({
      data: { name: `ISO Cross A ${suffix}`, slug: `iso-a-${suffix}`, country: 'KE', currency: 'KES', updatedAt: new Date() },
    });
    orgB = await db.organization.create({
      data: { name: `ISO Cross B ${suffix}`, slug: `iso-b-${suffix}`, country: 'KE', currency: 'KES', updatedAt: new Date() },
    });
    clientA = await db.outsourcingClient.create({
      data: {
        organizationId: orgA.id,
        name: `Client A ${suffix}`,
        updatedAt: new Date(),
      },
    });
    await db.employee.create({
      data: {
        organizationId: orgA.id,
        outsourcingClientId: clientA.id,
        firstName: 'Iso',
        lastName: 'LeakTest',
        email: `iso-leak-${suffix}@example.com`,
        employmentStatus: 'active',
        updatedAt: new Date(),
      },
    });
  } finally {
    await db.$disconnect();
  }

  await withAppRole(async (db) => {
    const visibleInB = await withOrgContextOn(db, orgB.id, (tx) =>
      tx.employee.findMany({
        where: { lastName: 'LeakTest' },
        select: { id: true, organizationId: true },
      }),
    );
    if (visibleInB.length > 0) {
      console.error('FAIL: Org B can see Org A employee rows', visibleInB);
      process.exit(1);
    }
    const visibleInA = await withOrgContextOn(db, orgA.id, (tx) =>
      tx.employee.count({ where: { lastName: 'LeakTest' } }),
    );
    if (visibleInA !== 1) {
      console.error('FAIL: Org A should see exactly 1 test employee, got', visibleInA);
      process.exit(1);
    }
    console.log('PASS: cross-tenant employee isolation under RLS (stride_app)');
  });

  const cleanup = new PrismaClient();
  await cleanup.employee.deleteMany({ where: { email: { contains: `iso-leak-${suffix}` } } }).catch(() => null);
  await cleanup.outsourcingClient.delete({ where: { id: clientA!.id } }).catch(() => null);
  await cleanup.organization.deleteMany({ where: { id: { in: [orgA!.id, orgB!.id] } } }).catch(() => null);
  await cleanup.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
