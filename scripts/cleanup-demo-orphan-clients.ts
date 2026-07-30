/**
 * Remove legacy / duplicate OutsourcingClient rows from the multi-vertical demo org.
 *
 * Targets org slug `demo-multi-vertical` only:
 *  - bare entityCode `ke` / `ug` (pre multi-context)
 *  - Savannah/SwiftFreight-named clients that are not cargo-logistics__ke|ug
 *  - empty null-entityCode clients that are NOT tagged [demo-security-bpo]
 *
 * Usage:
 *   npx tsx scripts/cleanup-demo-orphan-clients.ts
 *   DEMO_CLEANUP_DRY_RUN=1 npx tsx scripts/cleanup-demo-orphan-clients.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  MULTI_VERTICAL_ORG_SLUG,
  SECURITY_BPO_MARKER,
} from '../prisma/demo-security-bpo-constants';

const KEEP_CARGO_CODES = new Set(['cargo-logistics__ke', 'cargo-logistics__ug']);
const LEGACY_ENTITY_CODES = new Set(['ke', 'ug']);

const prisma = new PrismaClient();

export { MULTI_VERTICAL_ORG_SLUG, SECURITY_BPO_MARKER };

function isSavannahOrphanName(name: string): boolean {
  return /savannah|swiftfreight|swift freight/i.test(name);
}

async function main() {
  const dryRun = process.env.DEMO_CLEANUP_DRY_RUN === '1' || process.env.DEMO_CLEANUP_DRY_RUN === 'true';

  const org = await prisma.organization.findUnique({
    where: { slug: MULTI_VERTICAL_ORG_SLUG },
    select: { id: true, name: true },
  });
  if (!org) {
    console.warn(`Org ${MULTI_VERTICAL_ORG_SLUG} not found — nothing to clean.`);
    return;
  }

  const clients = await prisma.outsourcingClient.findMany({
    where: { organizationId: org.id },
    select: {
      id: true,
      name: true,
      entityCode: true,
      contractNotes: true,
      _count: { select: { employees: true } },
    },
    orderBy: { name: 'asc' },
  });

  const toDelete = clients.filter((c) => {
    const code = c.entityCode ?? null;
    if (code && LEGACY_ENTITY_CODES.has(code)) return true;
    // Showcase codes kept here; duplicate showcase rows handled below.
    if (code && KEEP_CARGO_CODES.has(code)) return false;
    if (code && code.includes('__')) return false;
    if (isSavannahOrphanName(c.name) && (!code || !KEEP_CARGO_CODES.has(code))) return true;
    if (code === null) {
      const tagged = (c.contractNotes ?? '').includes(SECURITY_BPO_MARKER);
      if (tagged) return false;
      return c._count.employees === 0;
    }
    return false;
  });

  // Also drop empty/extra duplicate showcase entityCodes (keep the row with most employees).
  const showcaseCodes = [
    'cargo-logistics__ke',
    'cargo-logistics__ug',
    'imara-sacco__ke',
    'imara-sacco__ug',
    'petroleum-retail__ke',
    'petroleum-retail__ug',
    'hospital-healthcare__ke',
    'hospital-healthcare__ug',
    'travel-agency__ke',
    'travel-agency__ug',
    'construction__ke',
    'construction__ug',
  ];
  for (const code of showcaseCodes) {
    const rows = await prisma.outsourcingClient.findMany({
      where: { organizationId: org.id, entityCode: code },
      select: { id: true, name: true, _count: { select: { employees: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (rows.length <= 1) continue;
    rows.sort((a, b) => b._count.employees - a._count.employees);
    const [, ...dupes] = rows;
    for (const d of dupes) {
      if (!toDelete.some((c) => c.id === d.id)) {
        toDelete.push({
          id: d.id,
          name: `${d.name} (duplicate ${code})`,
          entityCode: code,
          contractNotes: null,
          _count: { employees: d._count.employees },
        });
      }
    }
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`  Demo orphan client cleanup`);
  console.log(`════════════════════════════════════════`);
  console.log(`  Org: ${org.name} (${org.id})`);
  console.log(`  Mode: ${dryRun ? 'DRY RUN' : 'DELETE'}`);
  console.log(`  Candidates: ${toDelete.length}`);
  for (const c of toDelete) {
    console.log(
      `    · ${c.name} | entityCode=${c.entityCode ?? 'null'} | employees=${c._count.employees} | ${c.id}`,
    );
  }

  if (toDelete.length === 0) {
    console.log('  Nothing to delete.\n');
    return;
  }
  if (dryRun) {
    console.log('  Dry run complete — no changes.\n');
    return;
  }

  const ids = toDelete.map((c) => c.id);

  await prisma.employeeEntityTransfer.deleteMany({
    where: {
      OR: [{ sourceClientId: { in: ids } }, { targetClientId: { in: ids } }],
    },
  });

  const accountsClients = await prisma.accountsClient.findMany({
    where: { outsourcingClientId: { in: ids } },
    select: { id: true },
  });
  const accountsIds = accountsClients.map((a) => a.id);
  if (accountsIds.length > 0) {
    await prisma.accountsInvoicePaymentAllocation.deleteMany({
      where: { invoice: { clientId: { in: accountsIds } } },
    });
    await prisma.accountsClientPayment.deleteMany({ where: { clientId: { in: accountsIds } } });
    await prisma.accountsInvoiceLine.deleteMany({ where: { invoice: { clientId: { in: accountsIds } } } });
    await prisma.accountsInvoice.deleteMany({ where: { clientId: { in: accountsIds } } });
    await prisma.accountsContract.deleteMany({ where: { clientId: { in: accountsIds } } });
    await prisma.accountsClient.deleteMany({ where: { id: { in: accountsIds } } });
  }

  // Null any leftover billing links (SetNull FK) then delete clients.
  await prisma.accountsClient.updateMany({
    where: { outsourcingClientId: { in: ids } },
    data: { outsourcingClientId: null },
  });

  let deleted = 0;
  for (const id of ids) {
    try {
      await prisma.outsourcingClient.delete({ where: { id } });
      deleted += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`  ✗ Failed to delete ${id}: ${message.slice(0, 160)}`);
    }
  }

  console.log(`  Deleted ${deleted}/${ids.length} outsourcing client(s).\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
