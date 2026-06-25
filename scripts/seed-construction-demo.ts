/**
 * RAV-96: Seed construction site hierarchy, plant assets, and subcontractors.
 */
import type { PrismaClient } from '@prisma/client';

export async function seedConstructionVerticalDemo(
  db: PrismaClient,
  organizationId: string,
  outsourcingClientId: string,
) {
  const existing = await db.constructionSite.count({ where: { outsourcingClientId } });
  if (existing > 0) {
    console.log('  Construction vertical demo already seeded — skipping');
    return;
  }

  console.log('  Seeding construction sites, plant, and subcontractors…');

  const programme = await db.constructionSite.create({
    data: {
      organizationId,
      outsourcingClientId,
      code: 'PROG-WL',
      name: 'Westlands Tower Programme',
      status: 'active',
      location: 'Westlands, Nairobi',
    },
  });

  const phase1 = await db.constructionSite.create({
    data: {
      organizationId,
      outsourcingClientId,
      code: 'WL-P1',
      name: 'Westlands Tower — Phase 1',
      status: 'active',
      location: 'Ring Road, Westlands',
      parentSiteId: programme.id,
    },
  });

  const depot = await db.constructionSite.create({
    data: {
      organizationId,
      outsourcingClientId,
      code: 'THK-DEP',
      name: 'Thika Road Plant Depot',
      status: 'active',
      location: 'Thika Road',
    },
  });

  const projects = await db.project.findMany({
    where: { outsourcingClientId },
    take: 1,
    orderBy: { createdAt: 'asc' },
  });
  if (projects[0]) {
    await db.constructionSite.update({
      where: { id: phase1.id },
      data: { projectId: projects[0].id },
    });
  }

  const plantRows = [
    { siteId: phase1.id, tag: 'EXC-01', name: 'CAT 320 Excavator', category: 'Excavator', rate: 85000 },
    { siteId: phase1.id, tag: 'CRN-02', name: 'Tower Crane TC-5013', category: 'Crane', rate: 120000 },
    { siteId: depot.id, tag: 'LDV-14', name: 'Isuzu NQR Tipper', category: 'Haulage', rate: 35000 },
  ];

  for (const p of plantRows) {
    await db.constructionPlantAsset.create({
      data: {
        organizationId,
        outsourcingClientId,
        siteId: p.siteId,
        assetTag: p.tag,
        name: p.name,
        category: p.category,
        status: 'on_site',
        dailyHireRate: p.rate,
        onSiteSince: new Date(),
      },
    });
  }

  const subs = [
    {
      siteId: phase1.id,
      name: 'Mabati Roofing Ltd',
      trade: 'Roofing',
      contractValue: 4_200_000,
      invoiced: 1_680_000,
      paid: 840_000,
      retentionPct: 5,
    },
    {
      siteId: phase1.id,
      name: 'Cityline MEP Contractors',
      trade: 'MEP',
      contractValue: 8_500_000,
      invoiced: 3_400_000,
      paid: 2_550_000,
      retentionPct: 10,
    },
    {
      siteId: depot.id,
      name: 'Plant Hire Kenya',
      trade: 'Plant hire',
      contractValue: 1_200_000,
      invoiced: 600_000,
      paid: 600_000,
      retentionPct: 0,
    },
  ];

  for (const s of subs) {
    await db.constructionSubcontractor.create({
      data: {
        organizationId,
        outsourcingClientId,
        siteId: s.siteId,
        name: s.name,
        trade: s.trade,
        contractValue: s.contractValue,
        amountInvoiced: s.invoiced,
        amountPaid: s.paid,
        retentionPct: s.retentionPct,
        status: 'active',
        contactName: 'Site manager',
        contactPhone: '+254700000000',
      },
    });
  }

  console.log(`  Construction vertical demo: 3 sites, ${plantRows.length} plant, ${subs.length} subcontractors`);
}
