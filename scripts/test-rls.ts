/**
 * RAV-62: Prove Org A data is invisible to Org B under Postgres RLS.
 * Uses SET ROLE stride_app so RLS is enforced (neondb_owner has BYPASSRLS).
 */
import { PrismaClient, type Prisma } from '@prisma/client';

async function withAppRole<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = new PrismaClient();
  try {
    await db.$executeRaw`SET ROLE stride_app`;
    return await fn(db);
  } finally {
    await db.$executeRaw`RESET ROLE`.catch(() => null);
    await db.$disconnect();
  }
}

async function withOwner<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = new PrismaClient();
  try {
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

async function createOrg(db: PrismaClient, name: string, slug: string) {
  return db.organization.create({
    data: {
      name,
      slug,
      country: 'KE',
      currency: 'KES',
      updatedAt: new Date(),
    },
  });
}

async function main() {
  const suffix = Date.now();
  const orgA = await withOwner((db) => createOrg(db, 'Org Alpha Test', `org-alpha-${suffix}`));
  const orgB = await withOwner((db) => createOrg(db, 'Org Beta Test', `org-beta-${suffix}`));

  await withAppRole(async (db) => {
    await withOrgContextOn(db, orgA.id, async (tx) => {
      await tx.auditEvent.create({
        data: {
          organizationId: orgA.id,
          action: 'test.created',
          entityType: 'test',
          entityId: 'alpha',
          actorEmail: `rls-a-${suffix}@example.com`,
        },
      });
    });
  });

  let leaked = false;
  await withAppRole(async (db) => {
    await withOrgContextOn(db, orgB.id, async (tx) => {
      const rows = await tx.auditEvent.findMany({ where: { entityId: 'alpha' } });
      if (rows.some((row) => row.organizationId === orgA.id)) {
        leaked = true;
      }
    });
  });

  await withOwner(async (db) => {
    await db.auditEvent.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await db.organization.deleteMany({
      where: { id: { in: [orgA.id, orgB.id] } },
    });
  });

  if (leaked) {
    throw new Error('RLS FAILURE: Org B context could read Org A audit rows');
  }

  console.log('RLS isolation check passed for AuditEvent.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
