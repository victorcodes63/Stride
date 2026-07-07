#!/usr/bin/env npx tsx
/**
 * RAV-281 — QA-02 cross-tenant isolation matrix for tenant-scoped modules.
 * Creates Org A + Org B, seeds module rows under A, asserts B cannot read them.
 *
 * Usage: npm run test:cross-tenant
 */
import { PrismaClient, type Prisma } from '@prisma/client';

function ownerClient(): PrismaClient {
  const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  return url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient();
}

function appClient(): PrismaClient {
  return new PrismaClient();
}

type ModuleProbe = {
  name: string;
  ready: boolean;
  seed: (tx: Prisma.TransactionClient, orgId: string, clientId: string, suffix: string) => Promise<string>;
  probe: (tx: Prisma.TransactionClient, marker: string) => Promise<boolean>;
  cleanup?: (db: PrismaClient, orgAId: string, suffix: string) => Promise<void>;
};

async function withAppRole<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = appClient();
  try {
    await db.$executeRaw`SET ROLE stride_app`.catch(() => null);
    return await fn(db);
  } finally {
    await db.$disconnect();
  }
}

async function withOwner<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = ownerClient();
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

async function tableReady(db: PrismaClient, tableName: string): Promise<boolean> {
  const rows = await db.$queryRaw<{ exists: boolean; rls: boolean }[]>`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ${tableName}
      ) AS exists,
      COALESCE((
        SELECT c.relrowsecurity AND c.relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = ${tableName}
      ), false) AS rls
  `;
  return Boolean(rows[0]?.exists && rows[0]?.rls);
}

async function main() {
  const suffix = Date.now();
  const db = ownerClient();
  let orgA: { id: string };
  let orgB: { id: string };
  let clientA: { id: string };
  let salesEmployeeId: string | null = null;

  const probes: ModuleProbe[] = [
    {
      name: 'Employee (core HR)',
      ready: await tableReady(db, 'Employee'),
      seed: async (tx, orgId, clientId, sfx) => {
        await tx.employee.create({
          data: {
            organizationId: orgId,
            outsourcingClientId: clientId,
            firstName: 'Iso',
            lastName: `LeakTest-${sfx}`,
            email: `iso-leak-${sfx}@example.com`,
            employmentStatus: 'active',
            updatedAt: new Date(),
          },
        });
        return `LeakTest-${sfx}`;
      },
      probe: async (tx, marker) => {
        const rows = await tx.employee.findMany({ where: { lastName: marker } });
        return rows.length > 0;
      },
    },
    {
      name: 'AuditEvent',
      ready: await tableReady(db, 'AuditEvent'),
      seed: async (tx, orgId, _clientId, sfx) => {
        const entityId = `iso-audit-${sfx}`;
        await tx.auditEvent.create({
          data: {
            organizationId: orgId,
            action: 'test.created',
            entityType: 'test',
            entityId,
            actorEmail: `iso-audit-${sfx}@example.com`,
          },
        });
        return entityId;
      },
      probe: async (tx, marker) => {
        const rows = await tx.auditEvent.findMany({ where: { entityId: marker } });
        return rows.length > 0;
      },
    },
    {
      name: 'FleetGeofence',
      ready: await tableReady(db, 'FleetGeofence'),
      seed: async (tx, orgId, clientId, sfx) => {
        const name = `ISO Geofence ${sfx}`;
        await tx.fleetGeofence.create({
          data: {
            organizationId: orgId,
            outsourcingClientId: clientId,
            name,
            geometry: { type: 'Point', coordinates: [36.8, -1.3] },
          },
        });
        return name;
      },
      probe: async (tx, marker) => {
        const rows = await tx.fleetGeofence.findMany({ where: { name: marker } });
        return rows.length > 0;
      },
    },
    {
      name: 'JobDescription (performance)',
      ready: await tableReady(db, 'JobDescription'),
      seed: async (tx, orgId, _clientId, sfx) => {
        const title = `ISO JD ${sfx}`;
        const jd = await tx.jobDescription.create({
          data: {
            organizationId: orgId,
            title,
            grade: 'G3',
            status: 'published',
            jobPurpose: 'Tenant isolation test',
          },
        });
        await tx.jobDescription.update({
          where: { id: jd.id },
          data: { rootJobDescriptionId: jd.id },
        });
        return title;
      },
      probe: async (tx, marker) => {
        const rows = await tx.jobDescription.findMany({ where: { title: marker } });
        return rows.length > 0;
      },
    },
    {
      name: 'SalesDeal',
      ready: await tableReady(db, 'SalesDeal'),
      seed: async (tx, orgId, clientId, sfx) => {
        const employee = await tx.employee.create({
          data: {
            organizationId: orgId,
            outsourcingClientId: clientId,
            firstName: 'ISO',
            lastName: `Sales-${sfx}`,
            email: `iso-sales-${sfx}@example.com`,
            employmentStatus: 'active',
            updatedAt: new Date(),
          },
        });
        salesEmployeeId = employee.id;
        const name = `ISO Deal ${sfx}`;
        await tx.salesDeal.create({
          data: {
            organizationId: orgId,
            name,
            ownerEmployeeId: employee.id,
            value: 120000,
            stage: 'proposal',
          },
        });
        return name;
      },
      probe: async (tx, marker) => {
        const rows = await tx.salesDeal.findMany({ where: { name: marker } });
        return rows.length > 0;
      },
    },
  ];

  const activeProbes = probes.filter((p) => p.ready);
  const markers = new Map<string, string>();

  try {
    orgA = await db.organization.create({
      data: {
        name: `ISO Cross A ${suffix}`,
        slug: `iso-a-${suffix}`,
        country: 'KE',
        currency: 'KES',
        updatedAt: new Date(),
      },
    });
    orgB = await db.organization.create({
      data: {
        name: `ISO Cross B ${suffix}`,
        slug: `iso-b-${suffix}`,
        country: 'KE',
        currency: 'KES',
        updatedAt: new Date(),
      },
    });
    clientA = await db.outsourcingClient.create({
      data: {
        organizationId: orgA.id,
        name: `Client A ${suffix}`,
        updatedAt: new Date(),
      },
    });

    for (const probe of activeProbes) {
      await withAppRole(async (appDb) => {
        const marker = await withOrgContextOn(appDb, orgA.id, (tx) =>
          probe.seed(tx, orgA.id, clientA.id, String(suffix)),
        );
        markers.set(probe.name, marker);
      });
    }
  } finally {
    await db.$disconnect();
  }

  const failures: string[] = [];
  await withAppRole(async (appDb) => {
    for (const probe of activeProbes) {
      const marker = markers.get(probe.name)!;
      const leaked = await withOrgContextOn(appDb, orgB.id, (tx) => probe.probe(tx, marker));
      if (leaked) failures.push(probe.name);
    }

    const employeeMarker = markers.get('Employee (core HR)');
    if (employeeMarker) {
      const visibleInA = await withOrgContextOn(appDb, orgA.id, (tx) =>
        tx.employee.count({ where: { lastName: employeeMarker } }),
      );
      if (visibleInA !== 1) {
        failures.push(`Employee visibility in Org A (expected 1, got ${visibleInA})`);
      }
    }
  });

  if (failures.length > 0) {
    console.error('FAIL: cross-tenant leaks detected:', failures);
    process.exit(1);
  }

  if (activeProbes.length === 0) {
    console.error('FAIL: no tenant tables with FORCE RLS enabled');
    process.exit(1);
  }

  console.log(`PASS: cross-tenant isolation (${activeProbes.map((p) => p.name).join(', ')})`);

  await withOwner(async (cleanup) => {
    if (salesEmployeeId) {
      await cleanup.employee.deleteMany({ where: { email: { contains: `iso-sales-${suffix}` } } }).catch(() => null);
    }
    await cleanup.employee.deleteMany({ where: { email: { contains: `iso-leak-${suffix}` } } }).catch(() => null);
    await cleanup.$executeRaw`DELETE FROM "SalesDeal" WHERE "organizationId" = ${orgA!.id}::uuid`.catch(() => null);
    await cleanup.$executeRaw`DELETE FROM "JobDescription" WHERE "organizationId" = ${orgA!.id}::uuid`.catch(() => null);
    await cleanup.fleetGeofence.deleteMany({ where: { organizationId: orgA!.id } }).catch(() => null);
    await cleanup.auditEvent.deleteMany({ where: { organizationId: orgA!.id } }).catch(() => null);
    await cleanup.outsourcingClient.delete({ where: { id: clientA!.id } }).catch(() => null);
    await cleanup.organization.deleteMany({ where: { id: { in: [orgA!.id, orgB!.id] } } }).catch(() => null);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
