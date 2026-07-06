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

async function columnExists(db: PrismaClient, tableName: string, columnName: string): Promise<boolean> {
  const rows = await db.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${tableName} AND column_name = ${columnName}
    ) AS exists
  `;
  return Boolean(rows[0]?.exists);
}

async function tableRlsEnabled(db: PrismaClient, tableName: string): Promise<boolean> {
  const rows = await db.$queryRaw<{ enabled: boolean }[]>`
    SELECT COALESCE(c.relrowsecurity AND c.relforcerowsecurity, false) AS enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ${tableName}
  `;
  return Boolean(rows[0]?.enabled);
}

async function main() {
  const suffix = Date.now();
  const orgA = await withOwner((db) => createOrg(db, 'Org Alpha Test', `org-alpha-${suffix}`));
  const orgB = await withOwner((db) => createOrg(db, 'Org Beta Test', `org-beta-${suffix}`));

  const clientA = await withOwner(async (db) => {
    const hasStatus = await columnExists(db, 'OutsourcingClient', 'status');
    const name = `RLS Fleet Client A ${suffix}`;
    if (hasStatus) {
      return db.outsourcingClient.create({
        data: {
          organizationId: orgA.id,
          name,
          status: 'active',
          updatedAt: new Date(),
        },
      });
    }

    const id = `rls_client_${suffix}`;
    await db.$executeRaw`
      INSERT INTO "OutsourcingClient" ("id", "organizationId", "name", "updatedAt")
      VALUES (${id}, ${orgA.id}::uuid, ${name}, NOW())
    `;
    return { id };
  });

  const fleetTableReady = await withOwner(async (db) => {
    return (await tableExists(db, 'FleetGeofence')) && (await tableRlsEnabled(db, 'FleetGeofence'));
  });
  const auditTableReady = await withOwner(async (db) => {
    return (await tableExists(db, 'AuditEvent')) && (await tableRlsEnabled(db, 'AuditEvent'));
  });
  const jdTableReady = await withOwner(async (db) => {
    return (await tableExists(db, 'JobDescription')) && (await tableRlsEnabled(db, 'JobDescription'));
  });
  const salesTargetReady = await withOwner(async (db) => {
    return (await tableExists(db, 'SalesTarget')) && (await tableRlsEnabled(db, 'SalesTarget'));
  });
  const salesDealReady = await withOwner(async (db) => {
    return (await tableExists(db, 'SalesDeal')) && (await tableRlsEnabled(db, 'SalesDeal'));
  });
  const salesMetricReady = await withOwner(async (db) => {
    return (await tableExists(db, 'SalesRepPeriodMetric')) && (await tableRlsEnabled(db, 'SalesRepPeriodMetric'));
  });

  const entityId = `alpha-${suffix}`;
  let salesEmployeeId: string | null = null;

  await withAppRole(async (db) => {
    await withOrgContextOn(db, orgA.id, async (tx) => {
      if (auditTableReady) {
        await tx.auditEvent.create({
          data: {
            organizationId: orgA.id,
            action: 'test.created',
            entityType: 'test',
            entityId,
            actorEmail: `rls-a-${suffix}@example.com`,
          },
        });
      }
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
      if (jdTableReady) {
        const jd = await tx.jobDescription.create({
          data: {
            organizationId: orgA.id,
            title: `RLS JD Alpha ${suffix}`,
            grade: 'G3',
            status: 'published',
            jobPurpose: 'Tenant isolation test',
          },
        });
        await tx.jobDescription.update({
          where: { id: jd.id },
          data: { rootJobDescriptionId: jd.id },
        });
      }
      if (salesTargetReady || salesDealReady || salesMetricReady) {
        const employee = await tx.employee.create({
          data: {
            organizationId: orgA.id,
            outsourcingClientId: clientA.id,
            firstName: 'RLS',
            lastName: `Sales ${suffix}`,
            email: `rls-sales-${suffix}@example.com`,
            employmentStatus: 'active',
          },
        });
        salesEmployeeId = employee.id;
      }
      if (salesTargetReady && salesEmployeeId) {
        await tx.salesTarget.create({
          data: {
            organizationId: orgA.id,
            employeeId: salesEmployeeId,
            periodType: 'quarter',
            periodStart: new Date('2026-01-01'),
            periodEnd: new Date('2026-03-31'),
            amount: 500000,
            status: 'approved',
          },
        });
      }
      if (salesDealReady && salesEmployeeId) {
        await tx.salesDeal.create({
          data: {
            organizationId: orgA.id,
            name: `RLS Deal ${suffix}`,
            ownerEmployeeId: salesEmployeeId,
            value: 120000,
            stage: 'proposal',
          },
        });
      }
      if (salesMetricReady && salesEmployeeId) {
        await tx.salesRepPeriodMetric.create({
          data: {
            organizationId: orgA.id,
            employeeId: salesEmployeeId,
            periodStart: new Date('2026-01-01'),
            periodEnd: new Date('2026-06-30'),
            pipelineTarget: 1000000,
            pipelineClosed: 750000,
          },
        });
      }
    });
  });

  let auditLeaked = false;
  let fleetLeaked = false;
  let jdLeaked = false;
  let salesTargetLeaked = false;
  let salesDealLeaked = false;
  let salesMetricLeaked = false;
  await withAppRole(async (db) => {
    await withOrgContextOn(db, orgB.id, async (tx) => {
      if (auditTableReady) {
        const auditRows = await tx.auditEvent.findMany({ where: { entityId } });
        if (auditRows.some((row) => row.organizationId === orgA.id)) {
          auditLeaked = true;
        }
      }
      if (fleetTableReady) {
        const geofences = await tx.fleetGeofence.findMany({
          where: { name: `RLS Geofence ${suffix}` },
        });
        if (geofences.some((row) => row.organizationId === orgA.id)) {
          fleetLeaked = true;
        }
      }
      if (jdTableReady) {
        const jds = await tx.jobDescription.findMany({
          where: { title: `RLS JD Alpha ${suffix}` },
        });
        if (jds.some((row) => row.organizationId === orgA.id)) {
          jdLeaked = true;
        }
      }
      if (salesTargetReady) {
        const targets = await tx.salesTarget.findMany({
          where: { employeeId: salesEmployeeId ?? undefined },
        });
        if (targets.some((row) => row.organizationId === orgA.id)) {
          salesTargetLeaked = true;
        }
      }
      if (salesDealReady) {
        const deals = await tx.salesDeal.findMany({
          where: { name: `RLS Deal ${suffix}` },
        });
        if (deals.some((row) => row.organizationId === orgA.id)) {
          salesDealLeaked = true;
        }
      }
      if (salesMetricReady && salesEmployeeId) {
        const metrics = await tx.salesRepPeriodMetric.findMany({
          where: { employeeId: salesEmployeeId },
        });
        if (metrics.some((row) => row.organizationId === orgA.id)) {
          salesMetricLeaked = true;
        }
      }
    });
  });

  if (auditLeaked) {
    throw new Error('RLS FAILURE: Org B context could read Org A audit rows');
  }
  if (fleetLeaked) {
    throw new Error('RLS FAILURE: Org B context could read Org A FleetGeofence rows');
  }
  if (jdLeaked) {
    throw new Error('RLS FAILURE: Org B context could read Org A JobDescription rows');
  }
  if (salesTargetLeaked) {
    throw new Error('RLS FAILURE: Org B context could read Org A SalesTarget rows');
  }
  if (salesDealLeaked) {
    throw new Error('RLS FAILURE: Org B context could read Org A SalesDeal rows');
  }
  if (salesMetricLeaked) {
    throw new Error('RLS FAILURE: Org B context could read Org A SalesRepPeriodMetric rows');
  }

  const checked: string[] = [];
  if (auditTableReady) checked.push('AuditEvent');
  if (fleetTableReady) checked.push('FleetGeofence');
  if (jdTableReady) checked.push('JobDescription');
  if (salesTargetReady) checked.push('SalesTarget');
  if (salesDealReady) checked.push('SalesDeal');
  if (salesMetricReady) checked.push('SalesRepPeriodMetric');

  if (checked.length === 0) {
    throw new Error('RLS SKIPPED: no tenant tables with FORCE RLS enabled in this database');
  }

  console.log(`RLS isolation check passed for ${checked.join(', ')}.`);

  try {
    await withOwner(async (db) => {
      const hasClientStatus = await columnExists(db, 'OutsourcingClient', 'status');
      if (jdTableReady) {
        await db.$executeRaw`DELETE FROM "JobDescription" WHERE "title" = ${`RLS JD Alpha ${suffix}`}`;
      }
      if (fleetTableReady) {
        await db.fleetGeofence.deleteMany({ where: { organizationId: orgA.id } });
      }
      if (salesMetricReady) {
        await db.$executeRaw`DELETE FROM "SalesRepPeriodMetric" WHERE "organizationId" = ${orgA.id}::uuid`;
      }
      if (salesDealReady) {
        await db.$executeRaw`DELETE FROM "SalesDeal" WHERE "organizationId" = ${orgA.id}::uuid`;
      }
      if (salesTargetReady) {
        await db.$executeRaw`DELETE FROM "SalesTarget" WHERE "organizationId" = ${orgA.id}::uuid`;
      }
      if (salesEmployeeId) {
        await db.employee.deleteMany({ where: { email: `rls-sales-${suffix}@example.com` } });
      }
      await db.auditEvent.deleteMany({
        where: { organizationId: { in: [orgA.id, orgB.id] }, entityId },
      });
      if (hasClientStatus) {
        await db.outsourcingClient.deleteMany({ where: { id: clientA.id } });
      } else {
        await db.$executeRaw`DELETE FROM "OutsourcingClient" WHERE "id" = ${clientA.id}`;
      }
      await db.organization.deleteMany({
        where: { id: { in: [orgA.id, orgB.id] } },
      });
    });
  } catch (cleanupErr) {
    console.warn('RLS test cleanup warning (isolation still verified):', cleanupErr);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
