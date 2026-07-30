#!/usr/bin/env node
/**
 * Smoke checklist against demo Neon (used by demo:prep:live after provision).
 * Env: DATABASE_URL, DEMO_UNIFIED_ADMIN_EMAIL
 */
import { PrismaClient } from '@prisma/client';

/** Keep in sync with prisma/demo-security-bpo-constants.ts */
const SECURITY_BPO_MARKER = '[demo-security-bpo]';

const SHOWCASE = [
  'imara-sacco',
  'petroleum-retail',
  'cargo-logistics',
  'hospital-healthcare',
  'travel-agency',
  'construction',
];

const prisma = new PrismaClient();
const unifiedAdmin = (process.env.DEMO_UNIFIED_ADMIN_EMAIL || 'admin@imara.co.ke').toLowerCase();

async function main() {
  const sharedOrg = await prisma.organization.findUnique({
    where: { slug: 'demo-multi-vertical' },
    select: { id: true },
  });

  const expectedKe = SHOWCASE.map((id) => `${id}__ke`);
  const keClients = await prisma.outsourcingClient.findMany({
    where: {
      entityCode: { in: expectedKe },
      ...(sharedOrg ? { organizationId: sharedOrg.id } : {}),
    },
    select: { name: true, entityCode: true, id: true },
    orderBy: { entityCode: 'asc' },
  });

  const seen = new Set();
  const uniqueKe = [];
  for (const c of keClients) {
    if (seen.has(c.entityCode)) continue;
    seen.add(c.entityCode);
    uniqueKe.push(c);
  }

  const admin = await prisma.user.findUnique({
    where: { email: unifiedAdmin },
    select: { id: true, email: true, isActive: true },
  });

  const cargoRows = await prisma.outsourcingClient.findMany({
    where: {
      entityCode: 'cargo-logistics__ke',
      ...(sharedOrg ? { organizationId: sharedOrg.id } : {}),
    },
    select: { id: true, name: true },
  });
  const cargo = cargoRows[0];

  let vehicleCount = 0;
  let tripCount = 0;
  let savannahEmployees = 0;
  let biometricPunches = 0;
  let attendanceEvents = 0;
  let invoices = 0;
  if (cargo) {
    vehicleCount = await prisma.fleetVehicle.count({ where: { outsourcingClientId: cargo.id } });
    tripCount = await prisma.fleetTrip.count({ where: { outsourcingClientId: cargo.id } });
    savannahEmployees = await prisma.employee.count({ where: { outsourcingClientId: cargo.id } });
    biometricPunches = await prisma.biometricPunch.count({
      where: { device: { outsourcingClientId: cargo.id } },
    });
    attendanceEvents = await prisma.attendanceEvent.count({
      where: { outsourcingClientId: cargo.id },
    });
    const ac = await prisma.accountsClient.findUnique({
      where: { outsourcingClientId: cargo.id },
      select: { id: true },
    });
    if (ac) {
      invoices = await prisma.accountsInvoice.count({ where: { clientId: ac.id } });
    }
  }

  const legacyOrphans = sharedOrg
    ? await prisma.outsourcingClient.count({
        where: {
          organizationId: sharedOrg.id,
          OR: [
            { entityCode: { in: ['ke', 'ug'] } },
            {
              AND: [
                { OR: [{ name: { contains: 'Savannah', mode: 'insensitive' } }, { name: { contains: 'SwiftFreight', mode: 'insensitive' } }] },
                { entityCode: { notIn: ['cargo-logistics__ke', 'cargo-logistics__ug'] } },
              ],
            },
          ],
        },
      })
    : -1;

  const securityClients = sharedOrg
    ? await prisma.outsourcingClient.findMany({
        where: {
          organizationId: sharedOrg.id,
          entityCode: null,
          contractNotes: { contains: SECURITY_BPO_MARKER },
        },
        select: { id: true, name: true, _count: { select: { employees: true } } },
      })
    : [];
  const securityWithStaff = securityClients.filter((c) => c._count.employees > 0);

  const moses = await prisma.user.findFirst({
    where: { email: 'moses.okello@savannahfreight.co.ke', isActive: true },
    select: { email: true },
  });

  console.log('\n════════════════════════════════════════');
  console.log('  LIVE DEMO SMOKE CHECKLIST');
  console.log('════════════════════════════════════════');
  console.log(`  Shared org: ${sharedOrg ? 'demo-multi-vertical ✓' : 'missing ✗'}`);
  console.log(`  Unified admin: ${unifiedAdmin}${admin?.isActive ? ' ✓' : ' ✗ MISSING'}`);
  console.log(`  Switcher companies (KE): ${uniqueKe.length}/${SHOWCASE.length}`);
  for (const c of uniqueKe) {
    console.log(`    · ${c.name} (${c.entityCode})`);
  }
  const missing = expectedKe.filter((code) => !uniqueKe.some((c) => c.entityCode === code));
  if (missing.length) {
    console.log(`  ✗ Missing entities: ${missing.join(', ')}`);
  }
  console.log(
    `  Savannah cargo-logistics__ke rows: ${cargoRows.length}${cargoRows.length === 1 ? ' ✓' : ' ✗ expected 1'}`,
  );
  console.log(
    `  Legacy ke/ug / orphan Savannah: ${legacyOrphans}${legacyOrphans === 0 ? ' ✓' : ' ✗'}`,
  );
  console.log(
    `  Savannah employees: ${savannahEmployees}${savannahEmployees >= 100 ? ' ✓' : ' ✗ need ≥100'}`,
  );
  console.log(
    `  Savannah fleet: ${vehicleCount} vehicle(s), ${tripCount} trip(s)${vehicleCount > 0 ? ' ✓' : ' ✗'}`,
  );
  console.log(
    `  Savannah biometric punches: ${biometricPunches}${biometricPunches > 0 ? ' ✓' : ' ✗'}`,
  );
  console.log(
    `  Savannah attendance events: ${attendanceEvents}${attendanceEvents > 0 ? ' ✓' : ' ✗'}`,
  );
  console.log(`  Savannah invoices: ${invoices}${invoices > 0 ? ' ✓' : ' ✗'}`);
  console.log(
    `  Security end-clients with staff: ${securityWithStaff.length}${securityWithStaff.length >= 6 ? ' ✓' : ' ✗ need ≥6'}`,
  );
  for (const c of securityWithStaff) {
    console.log(`    · ${c.name} (${c._count.employees} guards)`);
  }
  console.log(`  ESS Moses: ${moses ? moses.email + ' ✓' : 'MISSING ✗'}`);
  console.log('\n  Manual smoke on https://demo.getstride.co.ke:');
  console.log('    1. Login admin@imara.co.ke / Demo@2026!');
  console.log('    2. Top-bar switcher = six companies; stay on Savannah Freight');
  console.log('    3. Outsourcing → end-clients (mall/campus/warehouse…) with guards');
  console.log('    4. Rota / attendance / payroll / ESS / one invoice');
  console.log('════════════════════════════════════════\n');

  const failed =
    !sharedOrg ||
    !admin?.isActive ||
    uniqueKe.length < SHOWCASE.length ||
    cargoRows.length !== 1 ||
    legacyOrphans !== 0 ||
    savannahEmployees < 100 ||
    vehicleCount === 0 ||
    biometricPunches === 0 ||
    attendanceEvents === 0 ||
    invoices === 0 ||
    securityWithStaff.length < 6 ||
    !moses;

  if (failed) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
