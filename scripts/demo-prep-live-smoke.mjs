#!/usr/bin/env node
/**
 * Smoke checklist against demo Neon (used by demo:prep:live after provision).
 * Env: DATABASE_URL, DEMO_UNIFIED_ADMIN_EMAIL
 */
import { PrismaClient } from '@prisma/client';

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

  // Dedupe by entityCode if legacy rows linger
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

  const cargo = uniqueKe.find((c) => c.entityCode === 'cargo-logistics__ke');
  let vehicleCount = 0;
  let tripCount = 0;
  if (cargo) {
    vehicleCount = await prisma.fleetVehicle.count({ where: { outsourcingClientId: cargo.id } });
    tripCount = await prisma.fleetTrip.count({ where: { outsourcingClientId: cargo.id } });
  }

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
    `  Savannah fleet: ${vehicleCount} vehicle(s), ${tripCount} trip(s)${vehicleCount > 0 ? ' ✓' : ' ✗'}`,
  );
  console.log('\n  Manual smoke on https://demo.getstride.co.ke:');
  console.log('    1. Login with unified admin + Demo@2026!');
  console.log('    2. Top-bar switcher lists all six companies');
  console.log('    3. Switch to Savannah Freight → Fleet shows vehicles/trips');
  console.log('    4. Switch to Heritage SACCO + Amani → payroll/rota non-empty');
  console.log('    5. Push Vercel env if needed: npm run demo:cell:deploy');
  console.log('════════════════════════════════════════\n');

  if (!sharedOrg || !admin?.isActive || uniqueKe.length < SHOWCASE.length || vehicleCount === 0) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
