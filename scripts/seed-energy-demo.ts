/**
 * RAV-95: Seed energy sites, permits, and sample HSE incidents for petroleum-retail demo.
 */
import type { PrismaClient } from '@prisma/client';
import { derivePermitStatus } from '../src/lib/energy/permits';

const SITES = [
  { code: 'NRB-01', name: 'Westlands Service Station', region: 'Nairobi', entity: 'Northline Petroleum Co.' },
  { code: 'NRB-DEP', name: 'Embakasi Fuel Depot', region: 'Nairobi', entity: 'Northline Petroleum Co.' },
  { code: 'MSA-02', name: 'Mombasa Road Terminal', region: 'Coast', entity: 'Northline Coastal JV' },
] as const;

const PERMITS = [
  { siteCode: 'NRB-01', number: 'NEMA-ENV-2024-1182', type: 'environmental' as const, authority: 'NEMA', daysToExpiry: 120 },
  { siteCode: 'NRB-01', number: 'EPRA-RET-8821', type: 'operating' as const, authority: 'EPRA', daysToExpiry: 45 },
  { siteCode: 'NRB-DEP', number: 'NEMA-ENV-2023-4401', type: 'environmental' as const, authority: 'NEMA', daysToExpiry: 25 },
  { siteCode: 'MSA-02', number: 'KPA-TRANS-771', type: 'transport' as const, authority: 'Kenya Ports Authority', daysToExpiry: 200 },
] as const;

export async function seedEnergyDemo(
  db: PrismaClient,
  organizationId: string,
  outsourcingClientId: string,
) {
  const existing = await db.energySite.count({ where: { outsourcingClientId } });
  if (existing > 0) {
    console.log('  Energy demo already seeded — skipping');
    return;
  }

  console.log('  Seeding energy sites and permits…');

  const siteByCode = new Map<string, string>();

  for (const s of SITES) {
    const site = await db.energySite.create({
      data: {
        organizationId,
        outsourcingClientId,
        code: s.code,
        name: s.name,
        region: s.region,
        operatingEntityLabel: s.entity,
      },
    });
    siteByCode.set(s.code, site.id);
  }

  const today = new Date();

  for (const p of PERMITS) {
    const siteId = siteByCode.get(p.siteCode);
    if (!siteId) continue;

    const expiresAt = new Date(today);
    expiresAt.setDate(expiresAt.getDate() + p.daysToExpiry);

    const issuedAt = new Date(today);
    issuedAt.setFullYear(issuedAt.getFullYear() - 1);

    await db.energyPermit.create({
      data: {
        organizationId,
        outsourcingClientId,
        siteId,
        permitNumber: p.number,
        permitType: p.type,
        issuingAuthority: p.authority,
        issuedAt,
        expiresAt,
        status: derivePermitStatus(expiresAt),
      },
    });
  }

  const incidentCount = await db.hseIncident.count({ where: { outsourcingClientId } });
  if (incidentCount === 0) {
    await db.hseIncident.create({
      data: {
        organizationId,
        outsourcingClientId,
        incidentNumber: 'HSE-ENR-001',
        title: 'Minor diesel spill — bund area',
        description: 'Approximately 15 litres contained within secondary containment during tanker offloading.',
        incidentType: 'environmental',
        severity: 'medium',
        status: 'investigating',
        siteName: 'Embakasi Fuel Depot',
        occurredAt: new Date(Date.now() - 3 * 86400000),
      },
    });
  }

  console.log(`  Energy demo: ${SITES.length} sites, ${PERMITS.length} permits`);
}
