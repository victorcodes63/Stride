#!/usr/bin/env npx tsx
/**
 * RAV-281 — QA-02 cross-tenant isolation matrix for tenant-scoped modules.
 * Creates Org A + Org B, seeds module rows under A, asserts B cannot read them.
 *
 * Also covers public HMAC-token routes (quote e-accept) — the pattern to copy for
 * future public token surfaces (Phase D M-Pesa payment links, Phase F client portal):
 *   1. Seed entity + valid token per org
 *   2. Happy-path GET/POST with the matching token
 *   3. Reject HMAC tamper (foreign id + stolen signature) with explicit 4xx
 *   4. Under the token's org context, foreign entity id must 404 — not empty 200
 *
 * Usage: npm run test:cross-tenant
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { GET as quoteAcceptGet, POST as quoteAcceptPost } from '../src/app/api/quote/accept/route';
import {
  createQuoteAcceptToken,
  withQuoteAcceptContext,
} from '../src/lib/sales/quote-accept-token';

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

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Foreign entity id + stolen HMAC signature from another token (must fail verify). */
function forgeTokenWithStolenSig(foreignEntityId: string, victimToken: string): string {
  const stolenSig = victimToken.split('.')[1];
  if (!stolenSig) throw new Error('victim token missing signature part');
  return `${base64UrlEncode(Buffer.from(foreignEntityId, 'utf8'))}.${stolenSig}`;
}

async function jsonStatus(res: Response): Promise<{ status: number; body: Record<string, unknown> }> {
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

/**
 * Public-token isolation probe (copy for M-Pesa / client-portal later).
 * Exercises the real /api/quote/accept handlers against live DB.
 */
async function runPublicQuoteAcceptIsolation(params: {
  orgAId: string;
  orgBId: string;
  suffix: string;
}): Promise<string[]> {
  const { orgAId, orgBId, suffix } = params;
  const failures: string[] = [];
  const titleA = `ISO Quote A ${suffix}`;
  const titleB = `ISO Quote B ${suffix}`;

  let quoteAId = '';
  let quoteBId = '';
  let tokenA = '';
  let tokenB = '';

  await withOwner(async (db) => {
    const quoteA = await db.salesQuote.create({
      data: {
        organizationId: orgAId,
        quoteNumber: 900001,
        version: 1,
        title: titleA,
        status: 'sent',
        currency: 'KES',
        discountPct: 0,
        taxRateBps: 1600,
        sentAt: new Date(),
        terms: 'ISO cross-tenant A',
        lineItems: {
          create: [
            {
              organizationId: orgAId,
              description: 'Org A line',
              quantity: 1,
              unitPrice: 10000,
              discountPct: 0,
              sortOrder: 0,
            },
          ],
        },
      },
    });
    const quoteB = await db.salesQuote.create({
      data: {
        organizationId: orgBId,
        quoteNumber: 900001,
        version: 1,
        title: titleB,
        status: 'sent',
        currency: 'KES',
        discountPct: 0,
        taxRateBps: 1600,
        sentAt: new Date(),
        terms: 'ISO cross-tenant B',
        lineItems: {
          create: [
            {
              organizationId: orgBId,
              description: 'Org B line',
              quantity: 1,
              unitPrice: 20000,
              discountPct: 0,
              sortOrder: 0,
            },
          ],
        },
      },
    });
    quoteAId = quoteA.id;
    quoteBId = quoteB.id;
    tokenA = createQuoteAcceptToken(quoteAId);
    tokenB = createQuoteAcceptToken(quoteBId);
  });

  // 1) Matching token — GET Org A quote
  {
    const req = new NextRequest(
      `http://localhost/api/quote/accept?token=${encodeURIComponent(tokenA)}`,
    );
    const { status, body } = await jsonStatus(await quoteAcceptGet(req));
    if (status !== 200 || body.valid !== true || body.title !== titleA) {
      failures.push(
        `quote-accept GET A expected 200+titleA, got status=${status} title=${String(body.title)} error=${String(body.error)}`,
      );
    }
    if (body.title === titleB) {
      failures.push('quote-accept GET A leaked Org B title');
    }
  }

  // 2) Matching token — POST-accept Org A
  {
    const req = new NextRequest('http://localhost/api/quote/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenA, acceptedByName: 'ISO Accept A' }),
    });
    const { status, body } = await jsonStatus(await quoteAcceptPost(req));
    if (status !== 200 || body.success !== true) {
      failures.push(
        `quote-accept POST A expected 200 success, got status=${status} error=${String(body.error)}`,
      );
    }
    await withOwner(async (db) => {
      const row = await db.salesQuote.findUnique({ where: { id: quoteAId } });
      if (!row?.acceptedAt || row.acceptedByName !== 'ISO Accept A') {
        failures.push('quote-accept POST A did not stamp acceptedAt/acceptedByName on Org A quote');
      }
      const other = await db.salesQuote.findUnique({ where: { id: quoteBId } });
      if (other?.acceptedAt) {
        failures.push('quote-accept POST A incorrectly stamped Org B quote as accepted');
      }
    });
  }

  // 3a) Mismatched token — Org A token must not surface Org B (GET with token B is B's world;
  //     cross check: under token A's scoped context, quote B id is an explicit miss)
  {
    const scoped = await withQuoteAcceptContext(tokenA, async ({ tx, organizationId }) => {
      return tx.salesQuote.findFirst({
        where: { id: quoteBId, organizationId },
        select: { id: true, title: true },
      });
    });
    if (!scoped.ok) {
      failures.push(`quote-accept scoped probe failed to open Org A context: ${scoped.reason}`);
    } else if (scoped.result != null) {
      failures.push(
        `quote-accept scoped probe: Org A context returned Org B quote (id=${scoped.result.id}) — expected null/404-class miss`,
      );
    }
  }

  // 3b) Manipulated token: Org B quote id + Org A's stolen HMAC signature → clear 4xx
  {
    const forged = forgeTokenWithStolenSig(quoteBId, tokenA);
    const getReq = new NextRequest(
      `http://localhost/api/quote/accept?token=${encodeURIComponent(forged)}`,
    );
    const getRes = await jsonStatus(await quoteAcceptGet(getReq));
    if (getRes.status === 200 || getRes.body.valid === true) {
      failures.push(
        `quote-accept forged GET must not succeed (got status=${getRes.status} valid=${String(getRes.body.valid)})`,
      );
    } else if (getRes.status !== 400 && getRes.status !== 403 && getRes.status !== 404) {
      failures.push(
        `quote-accept forged GET expected 400/403/404, got ${getRes.status} body=${JSON.stringify(getRes.body)}`,
      );
    } else if (!getRes.body.error || typeof getRes.body.error !== 'string') {
      failures.push('quote-accept forged GET rejected without explicit error message');
    }

    const postReq = new NextRequest('http://localhost/api/quote/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: forged, acceptedByName: 'Attacker' }),
    });
    const postRes = await jsonStatus(await quoteAcceptPost(postReq));
    if (postRes.status === 200 && postRes.body.success === true) {
      failures.push('quote-accept forged POST must not succeed');
    } else if (postRes.status !== 400 && postRes.status !== 403 && postRes.status !== 404) {
      failures.push(
        `quote-accept forged POST expected 400/403/404, got ${postRes.status} body=${JSON.stringify(postRes.body)}`,
      );
    } else if (!postRes.body.error || typeof postRes.body.error !== 'string') {
      failures.push('quote-accept forged POST rejected without explicit error message');
    }

    await withOwner(async (db) => {
      const other = await db.salesQuote.findUnique({ where: { id: quoteBId } });
      if (other?.acceptedAt) {
        failures.push('forged POST incorrectly accepted Org B quote');
      }
    });
  }

  // Org B token still works for GET (isolation did not brick sibling tenant)
  {
    const req = new NextRequest(
      `http://localhost/api/quote/accept?token=${encodeURIComponent(tokenB)}`,
    );
    const { status, body } = await jsonStatus(await quoteAcceptGet(req));
    if (status !== 200 || body.title !== titleB) {
      failures.push(
        `quote-accept GET B expected 200+titleB, got status=${status} title=${String(body.title)}`,
      );
    }
  }

  await withOwner(async (cleanup) => {
    await cleanup.salesQuoteLineItem
      .deleteMany({ where: { quoteId: { in: [quoteAId, quoteBId] } } })
      .catch(() => null);
    await cleanup.auditEvent
      .deleteMany({
        where: {
          entityId: { in: [quoteAId, quoteBId] },
          action: 'sales.quote.e_accepted',
        },
      })
      .catch(() => null);
    await cleanup.salesQuote.deleteMany({ where: { id: { in: [quoteAId, quoteBId] } } }).catch(() => null);
  });

  if (failures.length === 0) {
    console.log('PASS: public quote-accept cross-tenant (GET/POST match + forged reject + scoped miss)');
  }
  return failures;
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

  const salesQuoteReady = await withOwner((odb) => tableReady(odb, 'SalesQuote'));
  if (salesQuoteReady) {
    const quoteFailures = await runPublicQuoteAcceptIsolation({
      orgAId: orgA!.id,
      orgBId: orgB!.id,
      suffix: String(suffix),
    });
    failures.push(...quoteFailures);
  } else {
    console.warn('SKIP: public quote-accept probe (SalesQuote missing or RLS not forced)');
  }

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
