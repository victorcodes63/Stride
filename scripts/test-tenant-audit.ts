/**
 * RAV-64: Audit rows written via withOrgContext carry organizationId and respect RLS.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

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

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const org = await withOwner((db) =>
    db.organization.create({
      data: {
        name: `Audit Test Org ${suffix}`,
        slug: `audit-test-${suffix}`,
        country: 'KE',
        currency: 'KES',
        updatedAt: new Date(),
      },
    }),
  );

  let auditId = '';
  await withAppRole(async (db) => {
    auditId = await withOrgContextOn(db, org.id, async (tx) => {
      const row = await tx.auditEvent.create({
        data: {
          organizationId: org.id,
          actorUserId: null,
          actorEmail: 'test@stride.local',
          action: 'test.tenant_audit',
          entityType: 'Test',
          entityId: 'probe',
          route: 'scripts/test-tenant-audit',
        },
      });
      return row.id;
    });

    const visible = await withOrgContextOn(db, org.id, (tx) =>
      tx.auditEvent.findUnique({ where: { id: auditId } }),
    );
    if (!visible || visible.organizationId !== org.id) {
      throw new Error('Audit row not visible under matching org context');
    }

    const otherOrgId = randomUUID();
    const leaked = await withOrgContextOn(db, otherOrgId, (tx) =>
      tx.auditEvent.findUnique({ where: { id: auditId } }),
    );
    if (leaked) {
      throw new Error('Audit row leaked across org context');
    }
  });

  await withOwner(async (db) => {
    await db.auditEvent.deleteMany({ where: { id: auditId } });
    await db.organization.delete({ where: { id: org.id } });
  });

  console.log('PASS: tenant-scoped audit events are isolated by organizationId + RLS');
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
