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

async function tableExists(db: PrismaClient, tableName: string): Promise<boolean> {
  const rows = await db.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${tableName}
    ) AS exists
  `;
  return Boolean(rows[0]?.exists);
}

async function main() {
  const suffix = Date.now();
  const orgA = await withOwner((db) => createOrg(db, 'Org Alpha Test', `org-alpha-${suffix}`));
  const orgB = await withOwner((db) => createOrg(db, 'Org Beta Test', `org-beta-${suffix}`));

  const clientA = await withOwner((db) =>
    db.outsourcingClient.create({
      data: {
        organizationId: orgA.id,
        name: `RLS Fleet Client A ${suffix}`,
        updatedAt: new Date(),
      },
    }),
  );

  const fleetTableReady = await withOwner((db) => tableExists(db, 'FleetGeofence'));

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
      if (fleetTableReady) {
        await tx.fleetGeofence.create({
          data: {
            organizationId: orgA.id,
            outsourcingClientId: clientA.id,
            name: `RLS Geofence ${suffix}`,
            geometry: { type: 'Point', coordinates: [36.8, -1.3] },
          },
        });
      }
    });
  });

  let auditLeaked = false;
  let fleetLeaked = false;
  await withAppRole(async (db) => {
    await withOrgContextOn(db, orgB.id, async (tx) => {
      const auditRows = await tx.auditEvent.findMany({ where: { entityId: 'alpha' } });
      if (auditRows.some((row) => row.organizationId === orgA.id)) {
        auditLeaked = true;
      }
      if (fleetTableReady) {
        const geofences = await tx.fleetGeofence.findMany({
          where: { name: `RLS Geofence ${suffix}` },
        });
        if (geofences.some((row) => row.organizationId === orgA.id)) {
          fleetLeaked = true;
        }
      }
    });
  });

  await withOwner(async (db) => {
    if (fleetTableReady) {
      await db.fleetGeofence.deleteMany({ where: { organizationId: orgA.id } });
    }
    await db.auditEvent.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await db.outsourcingClient.deleteMany({ where: { id: clientA.id } });
    await db.organization.deleteMany({
      where: { id: { in: [orgA.id, orgB.id] } },
    });
  });

  if (auditLeaked) {
    throw new Error('RLS FAILURE: Org B context could read Org A audit rows');
  }
  if (fleetLeaked) {
    throw new Error('RLS FAILURE: Org B context could read Org A FleetGeofence rows');
  }

  console.log(
    fleetTableReady
      ? 'RLS isolation check passed for AuditEvent and FleetGeofence.'
      : 'RLS isolation check passed for AuditEvent (FleetGeofence table not migrated yet — run migrate deploy).',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
