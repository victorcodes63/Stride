/**
 * Per–showcase-company depth for modules that industry packs enable but
 * foundational/sector enrichment leaves thin: assets, HSE, procurement, performance.
 *
 * Idempotent by entity-prefixed tags / request numbers / cycle names.
 * Run: npx tsx prisma/seed-demo-industry-depth.ts
 * Or via seed-demo-enrichment after vertical engines.
 */
import { Prisma, PrismaClient, type AssetCategory, type HseIncidentType, type HseIncidentSeverity } from '@prisma/client';
import { DEMO_VERTICAL_EXTRA_MODULES, DEMO_FOUNDATIONAL_MODULES } from '../src/lib/demo-vertical-module-packs';
import { VERTICAL_SHOWCASE_PACK_IDS } from './demo-packs/types';
import type { ModuleKey } from '../src/lib/module-registry';

const prisma = new PrismaClient();

type ClientRow = {
  id: string;
  name: string;
  organizationId: string;
  entityCode: string | null;
};

type AssetSpec = {
  assetTag: string;
  name: string;
  category: AssetCategory;
  location: string;
  manufacturer?: string;
  model?: string;
};

type HseSpec = {
  incidentNumber: string;
  title: string;
  description: string;
  incidentType: HseIncidentType;
  severity: HseIncidentSeverity;
  location: string;
  siteName?: string;
};

type ProcSpec = {
  requestNumber: string;
  title: string;
  department: string;
  justification: string;
  totalAmount: string;
  status: 'submitted' | 'approved';
  vendorName: string;
  lines: Array<{ item: string; quantity: string; unitPrice: string; description?: string }>;
};

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function packIdFromEntity(entityCode: string): string {
  return entityCode.replace(/__(ke|ug)$/i, '');
}

function prefixFromEntity(entityCode: string): string {
  const pack = packIdFromEntity(entityCode);
  return pack
    .split('-')
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 4);
}

function modulesForPack(packId: string): Set<ModuleKey> {
  if (packId === 'cargo-logistics') {
    return new Set([
      ...DEMO_FOUNDATIONAL_MODULES,
      'performance',
      'procurement',
      'assets',
      'hse',
      'fleet',
      'sales',
      'outsourcing',
      'projects',
    ] as ModuleKey[]);
  }
  const extras = DEMO_VERTICAL_EXTRA_MODULES[packId] ?? [];
  return new Set([...DEMO_FOUNDATIONAL_MODULES, ...extras] as ModuleKey[]);
}

function assetCatalog(packId: string, prefix: string): AssetSpec[] {
  const catalogs: Record<string, AssetSpec[]> = {
    'cargo-logistics': [
      {
        assetTag: `${prefix}-LAP-01`,
        name: 'Dispatch laptop — ThinkPad E14',
        category: 'it_equipment',
        location: 'Nairobi control tower',
        manufacturer: 'Lenovo',
        model: 'E14 Gen 5',
      },
      {
        assetTag: `${prefix}-RAD-01`,
        name: 'Yard handheld radio set',
        category: 'tools',
        location: 'Industrial Area yard',
        manufacturer: 'Hytera',
        model: 'PD505',
      },
      {
        assetTag: `${prefix}-PPE-01`,
        name: 'Corridor PPE kit (bulk)',
        category: 'uniform_ppe',
        location: 'Fleet stores — Mombasa',
      },
    ],
    'imara-sacco': [
      {
        assetTag: `${prefix}-PC-01`,
        name: 'Teller workstation — Branch HQ',
        category: 'it_equipment',
        location: 'Member services hall',
        manufacturer: 'HP',
        model: 'ProDesk 400',
      },
      {
        assetTag: `${prefix}-SAFE-01`,
        name: 'Cash office safe (demo tag)',
        category: 'other',
        location: 'Strong room',
      },
      {
        assetTag: `${prefix}-FUR-01`,
        name: 'Member waiting lounge set',
        category: 'furniture',
        location: 'Ground floor lobby',
      },
    ],
    'hospital-healthcare': [
      {
        assetTag: `${prefix}-MON-01`,
        name: 'Patient monitor — Ward A',
        category: 'tools',
        location: 'Medical ward A',
        manufacturer: 'Mindray',
        model: 'uMEC10',
      },
      {
        assetTag: `${prefix}-LAP-01`,
        name: 'Clinical station laptop',
        category: 'it_equipment',
        location: 'Nursing station',
        manufacturer: 'Dell',
        model: 'Latitude 5440',
      },
      {
        assetTag: `${prefix}-PPE-01`,
        name: 'Theatre PPE cart',
        category: 'uniform_ppe',
        location: 'Theatre scrub room',
      },
    ],
    'petroleum-retail': [
      {
        assetTag: `${prefix}-PUMP-01`,
        name: 'Forecourt pump nozzle kit',
        category: 'tools',
        location: 'Station 12 — Thika Road',
      },
      {
        assetTag: `${prefix}-LAP-01`,
        name: 'Station manager tablet',
        category: 'mobile_device',
        location: 'Cash office',
        manufacturer: 'Samsung',
        model: 'Galaxy Tab A9',
      },
      {
        assetTag: `${prefix}-PPE-01`,
        name: 'Depot flame-retardant coveralls',
        category: 'uniform_ppe',
        location: 'Depot HSE stores',
      },
    ],
    construction: [
      {
        assetTag: `${prefix}-TOOL-01`,
        name: 'Site survey total station',
        category: 'tools',
        location: 'Westlands Tower — Phase 1',
        manufacturer: 'Leica',
        model: 'TS16',
      },
      {
        assetTag: `${prefix}-LAP-01`,
        name: 'QS field laptop',
        category: 'it_equipment',
        location: 'Site office cabin',
      },
      {
        assetTag: `${prefix}-PPE-01`,
        name: 'Site PPE crate (hard hats + boots)',
        category: 'uniform_ppe',
        location: 'Plant depot stores',
      },
    ],
    'travel-agency': [
      {
        assetTag: `${prefix}-PC-01`,
        name: 'Ticketing desk PC',
        category: 'it_equipment',
        location: 'Westlands booking floor',
      },
      {
        assetTag: `${prefix}-PHN-01`,
        name: 'Corporate travel advisor handset',
        category: 'mobile_device',
        location: 'Sales pod B',
        manufacturer: 'Apple',
        model: 'iPhone 14',
      },
    ],
  };
  return catalogs[packId] ?? catalogs['cargo-logistics']!;
}

function hseCatalog(packId: string, prefix: string, year: number): HseSpec[] {
  const catalogs: Record<string, HseSpec[]> = {
    'cargo-logistics': [
      {
        incidentNumber: `HSE-${prefix}-${year}-01`,
        title: 'Near-miss — reversing in crowded yard',
        description:
          'Articulated unit reversed without banksman during peak unload. No injury; yard protocol refresh scheduled.',
        incidentType: 'near_miss',
        severity: 'medium',
        location: 'Industrial Area yard bay 4',
        siteName: 'Nairobi hub',
      },
      {
        incidentNumber: `HSE-${prefix}-${year}-02`,
        title: 'Minor sprain — warehouse picker',
        description: 'Picker twisted ankle on wet dock plate after rain. First aid given; dock mat replaced.',
        incidentType: 'injury',
        severity: 'low',
        location: 'Warehouse dock 2',
        siteName: 'Nairobi hub',
      },
    ],
    'imara-sacco': [
      {
        incidentNumber: `HSE-${prefix}-${year}-01`,
        title: 'Slip hazard — member lobby after mopping',
        description: 'Wet floor sign missing during morning clean. Member nearly slipped; signage restocked.',
        incidentType: 'near_miss',
        severity: 'low',
        location: 'Member services lobby',
        siteName: 'HQ branch',
      },
    ],
    'hospital-healthcare': [
      {
        incidentNumber: `HSE-${prefix}-${year}-01`,
        title: 'Sharps near-miss — Ward A disposal',
        description: 'Used sharps found beside overfull bin. Immediate containment; bin schedule reviewed.',
        incidentType: 'near_miss',
        severity: 'high',
        location: 'Ward A treatment room',
        siteName: 'Amani Medical Centre',
      },
      {
        incidentNumber: `HSE-${prefix}-${year}-02`,
        title: 'Chemical splash — pharmacy prep',
        description: 'Diluent splash on glove during IV prep. PPE held; eyewash unused. Retraining logged.',
        incidentType: 'hazard',
        severity: 'medium',
        location: 'Pharmacy clean room',
        siteName: 'Amani Medical Centre',
      },
    ],
    'petroleum-retail': [
      {
        incidentNumber: `HSE-${prefix}-${year}-01`,
        title: 'Fuel spill — nozzle overrun',
        description: 'Customer tank overflow ~2L on apron. Spill kit used; incident logged for ERB visit prep.',
        incidentType: 'environmental',
        severity: 'medium',
        location: 'Pump island 2',
        siteName: 'Station 12 — Thika Road',
      },
      {
        incidentNumber: `HSE-${prefix}-${year}-02`,
        title: 'Static discharge near-miss at fill point',
        description: 'Attendant reported static snap while grounding cable was not clipped. Procedure reminder issued.',
        incidentType: 'near_miss',
        severity: 'high',
        location: 'Underground tank fill point',
        siteName: 'Station 12 — Thika Road',
      },
    ],
    construction: [
      {
        incidentNumber: `HSE-${prefix}-${year}-01`,
        title: 'Scaffold toe-board missing — Level 3',
        description: 'Daily inspection found missing toe-board on edge bay. Work stopped until rectified.',
        incidentType: 'hazard',
        severity: 'high',
        location: 'Westlands Tower — Level 3',
        siteName: 'Westlands Tower — Phase 1',
      },
      {
        incidentNumber: `HSE-${prefix}-${year}-02`,
        title: 'Plant near-miss — excavator swing radius',
        description: 'Banksman called stop when pedestrian entered swing radius. Toolbox talk completed same day.',
        incidentType: 'near_miss',
        severity: 'medium',
        location: 'Foundation pit',
        siteName: 'Westlands Tower — Phase 1',
      },
    ],
  };
  return catalogs[packId] ?? [];
}

function procurementCatalog(packId: string, prefix: string): ProcSpec[] {
  const catalogs: Record<string, ProcSpec[]> = {
    'cargo-logistics': [
      {
        requestNumber: `${prefix}-PR-0001`,
        title: 'Fleet tyres — Mombasa corridor units',
        department: 'Fleet & Drivers',
        justification: 'Replace worn steer tyres ahead of peak season NTSA checks.',
        totalAmount: '111000',
        status: 'submitted',
        vendorName: `${prefix} East Africa Fleet Supplies`,
        lines: [
          { item: 'Steer tyre 315/80R22.5', quantity: '6', unitPrice: '18500' },
        ],
      },
      {
        requestNumber: `${prefix}-PR-0002`,
        title: 'Warehouse HSE signage pack',
        department: 'Warehouse',
        justification: 'Replace faded safety signage after internal audit.',
        totalAmount: '28000',
        status: 'approved',
        vendorName: `${prefix} East Africa Fleet Supplies`,
        lines: [
          { item: 'HSE warehouse signage pack', quantity: '2', unitPrice: '14000' },
        ],
      },
    ],
    'imara-sacco': [
      {
        requestNumber: `${prefix}-PR-0001`,
        title: 'Branch stationery & KYC forms reprint',
        department: 'Operations',
        justification: 'Restock member onboarding packs for AGM season.',
        totalAmount: '45000',
        status: 'submitted',
        vendorName: `${prefix} OfficeMart Kenya`,
        lines: [
          { item: 'KYC member pack (500)', quantity: '3', unitPrice: '15000' },
        ],
      },
      {
        requestNumber: `${prefix}-PR-0002`,
        title: 'Teller receipt printer ribbons',
        department: 'IT',
        justification: 'Critical stock-out risk on HQ teller line.',
        totalAmount: '18000',
        status: 'approved',
        vendorName: `${prefix} OfficeMart Kenya`,
        lines: [{ item: 'Ribbon cartridge pack', quantity: '12', unitPrice: '1500' }],
      },
    ],
    'hospital-healthcare': [
      {
        requestNumber: `${prefix}-PR-0001`,
        title: 'Ward consumables — gloves & aprons',
        department: 'Clinical Services',
        justification: 'IPC stock replenishment for Ward A and theatre.',
        totalAmount: '96000',
        status: 'submitted',
        vendorName: `${prefix} MedSupply East Africa`,
        lines: [
          { item: 'Nitrile gloves carton', quantity: '8', unitPrice: '8500' },
          { item: 'Disposable apron pack', quantity: '4', unitPrice: '7000' },
        ],
      },
      {
        requestNumber: `${prefix}-PR-0002`,
        title: 'Pulse oximeter replacements',
        department: 'Biomedical',
        justification: 'Two ward units failed calibration.',
        totalAmount: '42000',
        status: 'approved',
        vendorName: `${prefix} MedSupply East Africa`,
        lines: [{ item: 'Handheld pulse oximeter', quantity: '3', unitPrice: '14000' }],
      },
    ],
    'petroleum-retail': [
      {
        requestNumber: `${prefix}-PR-0001`,
        title: 'Spill kit & absorbent replenishment',
        department: 'HSE',
        justification: 'Restock after nozzle overrun drill and live spill.',
        totalAmount: '52000',
        status: 'submitted',
        vendorName: `${prefix} Energy Safety Supplies`,
        lines: [{ item: 'Forecourt spill kit', quantity: '4', unitPrice: '13000' }],
      },
      {
        requestNumber: `${prefix}-PR-0002`,
        title: 'Attendant PPE — FR coveralls',
        department: 'Retail Ops',
        justification: 'New hires at Station 12 need FR kits before night shift.',
        totalAmount: '36000',
        status: 'approved',
        vendorName: `${prefix} Energy Safety Supplies`,
        lines: [{ item: 'FR coverall set', quantity: '6', unitPrice: '6000' }],
      },
    ],
    construction: [
      {
        requestNumber: `${prefix}-PR-0001`,
        title: 'Scaffold couplers & toe-boards',
        department: 'Site Operations',
        justification: 'Rectify Level 3 edge protection finding.',
        totalAmount: '185000',
        status: 'submitted',
        vendorName: `${prefix} SiteFix Hardware`,
        lines: [
          { item: 'Scaffold coupler set', quantity: '40', unitPrice: '2500' },
          { item: 'Timber toe-board 2.5m', quantity: '35', unitPrice: '2500' },
        ],
      },
      {
        requestNumber: `${prefix}-PR-0002`,
        title: 'PPE crate restock — hard hats',
        department: 'HSE',
        justification: 'Visitor and subcontractor induction stock low.',
        totalAmount: '30000',
        status: 'approved',
        vendorName: `${prefix} SiteFix Hardware`,
        lines: [{ item: 'Hard hat (yellow)', quantity: '50', unitPrice: '600' }],
      },
    ],
    'travel-agency': [
      {
        requestNumber: `${prefix}-PR-0001`,
        title: 'GDS workstation monitors',
        department: 'IT',
        justification: 'Dual-screen upgrade for corporate desk agents.',
        totalAmount: '72000',
        status: 'submitted',
        vendorName: `${prefix} OfficeTech Nairobi`,
        lines: [{ item: '24\" IPS monitor', quantity: '6', unitPrice: '12000' }],
      },
      {
        requestNumber: `${prefix}-PR-0002`,
        title: 'Client hospitality vouchers stock',
        department: 'Sales',
        justification: 'Airport meet-and-greet kit for VIP corporate accounts.',
        totalAmount: '25000',
        status: 'approved',
        vendorName: `${prefix} OfficeTech Nairobi`,
        lines: [{ item: 'VIP hospitality voucher pack', quantity: '5', unitPrice: '5000' }],
      },
    ],
  };
  return catalogs[packId] ?? catalogs['cargo-logistics']!;
}

async function resolveAdminUser() {
  return (
    (await prisma.user.findFirst({
      where: { email: process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL ?? 'admin@imara.co.ke' },
    })) ??
    (await prisma.user.findFirst({ where: { role: 'admin', isActive: true } })) ??
    (await prisma.user.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }))
  );
}

async function seedAssetsForClient(
  client: ClientRow,
  packId: string,
  prefix: string,
  adminUserId: string,
) {
  const employees = await prisma.employee.findMany({
    where: { outsourcingClientId: client.id, employmentStatus: 'active' },
    orderBy: { employeeNumber: 'asc' },
    take: 3,
    select: { id: true },
  });
  const specs = assetCatalog(packId, prefix);
  for (const [i, spec] of specs.entries()) {
    const assignee = employees[i % Math.max(employees.length, 1)];
    await prisma.companyAsset.upsert({
      where: {
        outsourcingClientId_assetTag: {
          outsourcingClientId: client.id,
          assetTag: spec.assetTag,
        },
      },
      update: {
        name: spec.name,
        category: spec.category,
        location: spec.location,
        manufacturer: spec.manufacturer ?? null,
        model: spec.model ?? null,
        status: assignee ? 'assigned' : 'available',
        assignedEmployeeId: assignee?.id ?? null,
        assignedAt: assignee ? daysAgo(20 + i) : null,
        assignedByUserId: assignee ? adminUserId : null,
      },
      create: {
        organizationId: client.organizationId,
        outsourcingClientId: client.id,
        assetTag: spec.assetTag,
        name: spec.name,
        category: spec.category,
        location: spec.location,
        manufacturer: spec.manufacturer ?? null,
        model: spec.model ?? null,
        status: assignee ? 'assigned' : 'available',
        assignedEmployeeId: assignee?.id ?? null,
        assignedAt: assignee ? daysAgo(20 + i) : null,
        assignedByUserId: assignee ? adminUserId : null,
        purchaseDate: daysAgo(180),
        purchaseCost: new Prisma.Decimal(45000 + i * 12000),
      },
    });
  }
  return specs.length;
}

async function seedHseForClient(client: ClientRow, packId: string, prefix: string, adminUserId: string) {
  const year = new Date().getUTCFullYear();
  const specs = hseCatalog(packId, prefix, year);
  const reporter = await prisma.employee.findFirst({
    where: { outsourcingClientId: client.id, employmentStatus: 'active' },
    orderBy: { employeeNumber: 'asc' },
    select: { id: true },
  });

  for (const [i, spec] of specs.entries()) {
    await prisma.hseIncident.deleteMany({
      where: { outsourcingClientId: client.id, incidentNumber: spec.incidentNumber },
    });
    await prisma.hseIncident.create({
      data: {
        organizationId: client.organizationId,
        outsourcingClientId: client.id,
        incidentNumber: spec.incidentNumber,
        title: spec.title,
        description: spec.description,
        incidentType: spec.incidentType,
        severity: spec.severity,
        status: i === 0 ? 'investigating' : 'open',
        location: spec.location,
        siteName: spec.siteName ?? null,
        occurredAt: daysAgo(5 + i * 3),
        immediateAction: 'Area secured; toolbox talk scheduled.',
        reportedByUserId: adminUserId,
        reportedByEmployeeId: reporter?.id ?? null,
        createdByUserId: adminUserId,
        lostTimeInjury: false,
        reportableToAuthority: spec.severity === 'high' || spec.severity === 'critical',
      },
    });
  }
  return specs.length;
}

async function seedProcurementForClient(
  client: ClientRow,
  packId: string,
  prefix: string,
  requesterId: string,
  approverId: string,
) {
  const specs = procurementCatalog(packId, prefix);
  const numbers = specs.map((s) => s.requestNumber);
  const existing = await prisma.purchaseRequest.findMany({
    where: { outsourcingClientId: client.id, requestNumber: { in: numbers } },
    select: { id: true },
  });
  if (existing.length) {
    const ids = existing.map((r) => r.id);
    await prisma.purchaseOrder.deleteMany({ where: { purchaseRequestId: { in: ids } } });
    await prisma.purchaseRequestLine.deleteMany({ where: { requestId: { in: ids } } });
    await prisma.purchaseRequest.deleteMany({ where: { id: { in: ids } } });
  }

  const vendorName = specs[0]?.vendorName ?? `${prefix} Demo Supplies`;
  let vendor = await prisma.accountsVendor.findFirst({
    where: { organizationId: client.organizationId, name: vendorName },
  });
  if (!vendor) {
    vendor = await prisma.accountsVendor.create({
      data: {
        organizationId: client.organizationId,
        name: vendorName,
        contactName: 'Demo Procurement',
        contactEmail: `orders@${prefix.toLowerCase()}.demo.ke`,
        contactPhone: '+254 700 000000',
        currency: 'KES',
        notes: `Industry-depth vendor for ${client.name}`,
      },
    });
  }

  let created = 0;
  for (const spec of specs) {
    const pr = await prisma.purchaseRequest.create({
      data: {
        organizationId: client.organizationId,
        outsourcingClientId: client.id,
        requestNumber: spec.requestNumber,
        title: spec.title,
        department: spec.department,
        justification: spec.justification,
        currency: 'KES',
        totalAmount: new Prisma.Decimal(spec.totalAmount),
        status: spec.status,
        vendorId: vendor.id,
        requestedByUserId: requesterId,
        submittedAt: daysAgo(spec.status === 'approved' ? 8 : 2),
        reviewedAt: spec.status === 'approved' ? daysAgo(6) : null,
        reviewedByUserId: spec.status === 'approved' ? approverId : null,
        lines: {
          create: spec.lines.map((line, sortOrder) => ({
            organizationId: client.organizationId,
            item: line.item,
            description: line.description ?? null,
            quantity: new Prisma.Decimal(line.quantity),
            unitPrice: new Prisma.Decimal(line.unitPrice),
            sortOrder,
          })),
        },
      },
    });
    created += 1;

    if (spec.status === 'approved') {
      try {
        // lpoNumber is globally unique — prefix by entity so multi-company seed does not collide.
        const lpoNumber = `${prefix}-LPO-${spec.requestNumber.slice(-4)}`;
        await prisma.purchaseOrder.deleteMany({ where: { lpoNumber } });
        await prisma.purchaseOrder.create({
          data: {
            organizationId: client.organizationId,
            outsourcingClientId: client.id,
            purchaseRequestId: pr.id,
            lpoNumber,
            title: spec.title,
            currency: 'KES',
            totalAmount: new Prisma.Decimal(spec.totalAmount),
            status: 'issued',
            vendorId: vendor.id,
            issuedAt: daysAgo(5),
            issuedByUserId: approverId,
            lines: {
              create: spec.lines.map((line, sortOrder) => ({
                organizationId: client.organizationId,
                item: line.item,
                description: line.description ?? null,
                quantity: new Prisma.Decimal(line.quantity),
                unitPrice: new Prisma.Decimal(line.unitPrice),
                sortOrder,
              })),
            },
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`    · LPO skip ${spec.requestNumber}: ${message.slice(0, 120)}`);
      }
    }
  }
  return created;
}

async function seedPerformanceForClient(client: ClientRow, packId: string) {
  const cycleName = `${client.name.split(' ')[0]} H1 2026 Review`;
  const existing = await prisma.performanceCycle.findFirst({
    where: {
      organizationId: client.organizationId,
      outsourcingClientId: client.id,
      name: cycleName,
    },
  });
  if (existing) {
    const count = await prisma.performanceReview.count({ where: { cycleId: existing.id } });
    if (count > 0) {
      return { cycle: existing.name, reviews: count, created: false };
    }
    // Incomplete prior attempt — wipe and recreate.
    await prisma.performanceGoal.deleteMany({ where: { cycleId: existing.id } });
    await prisma.performanceReviewRating.deleteMany({
      where: { review: { cycleId: existing.id } },
    });
    await prisma.performanceReview.deleteMany({ where: { cycleId: existing.id } });
    await prisma.performanceCycle.delete({ where: { id: existing.id } });
  }

  const employees = await prisma.employee.findMany({
    where: { outsourcingClientId: client.id, employmentStatus: 'active' },
    orderBy: { employeeNumber: 'asc' },
    take: 25,
    select: { id: true },
  });
  if (!employees.length) {
    return { cycle: cycleName, reviews: 0, created: false };
  }

  // Lightweight cycle + reviews (avoid activatePerformanceCycle Neon/JD coupling).
  const cycle = await prisma.performanceCycle.create({
    data: {
      organizationId: client.organizationId,
      name: cycleName,
      description: `Demo mid-year cycle for ${packId} (${client.name})`,
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2026-06-30T00:00:00.000Z'),
      outsourcingClientId: client.id,
      status: 'active',
      activatedAt: new Date(),
    },
  });

  for (const [i, employee] of employees.entries()) {
    await prisma.performanceReview.create({
      data: {
        organizationId: client.organizationId,
        cycleId: cycle.id,
        employeeId: employee.id,
        status: i < 8 ? 'self_submitted' : 'not_started',
        overallSelfRating: i < 8 ? 3 + (i % 3) : null,
        selfSummary: i < 8 ? `Demo self-assessment — ${packId}` : null,
        selfSubmittedAt: i < 8 ? daysAgo(3) : null,
        ratings: {
          create: ['Delivery', 'Collaboration', 'Ownership'].map((dimension, sortOrder) => ({
            organizationId: client.organizationId,
            dimension,
            sortOrder,
            selfScore: i < 8 ? 3 + ((i + sortOrder) % 2) : null,
          })),
        },
      },
    });

    await prisma.performanceGoal.createMany({
      data: [
        {
          organizationId: client.organizationId,
          cycleId: cycle.id,
          employeeId: employee.id,
          title: 'Role delivery goals',
          description: `Demo goal pack for ${packId}`,
          weightPercent: 50,
          sortOrder: 0,
          selfScore: i < 8 ? 4 : null,
        },
        {
          organizationId: client.organizationId,
          cycleId: cycle.id,
          employeeId: employee.id,
          title: 'Team contribution',
          weightPercent: 50,
          sortOrder: 1,
          selfScore: i < 8 ? 3 : null,
        },
      ],
    });
  }

  return { cycle: cycle.name, reviews: employees.length, created: true };
}

/** Link construction sites to matching projects when projectId is still null. */
export async function relinkConstructionSitesToProjects() {
  const clients = await prisma.outsourcingClient.findMany({
    where: { entityCode: { startsWith: 'construction__' } },
    select: { id: true, name: true },
  });

  let linked = 0;
  for (const client of clients) {
    const sites = await prisma.constructionSite.findMany({
      where: { outsourcingClientId: client.id, projectId: null },
      select: { id: true, name: true },
    });
    if (!sites.length) continue;

    const projects = await prisma.project.findMany({
      where: { outsourcingClientId: client.id },
      select: { id: true, name: true },
    });

    for (const site of sites) {
      const match =
        projects.find((p) => p.name === site.name) ??
        projects.find((p) => site.name.includes(p.name) || p.name.includes(site.name.split('—')[0]?.trim() ?? '')) ??
        projects[0];
      if (!match) continue;
      await prisma.constructionSite.update({
        where: { id: site.id },
        data: { projectId: match.id },
      });
      linked += 1;
    }
  }
  return linked;
}

export async function seedIndustryDepthForAll() {
  const admin = await resolveAdminUser();
  if (!admin) {
    console.warn('→ Industry depth: no admin user — skipped');
    return;
  }

  const showcaseCodes = VERTICAL_SHOWCASE_PACK_IDS.map((id) => `${id}__ke`);
  const sharedOrg = await prisma.organization.findUnique({
    where: { slug: 'demo-multi-vertical' },
    select: { id: true },
  });

  const clients = await prisma.outsourcingClient.findMany({
    where: {
      entityCode: { in: showcaseCodes },
      ...(sharedOrg ? { organizationId: sharedOrg.id } : {}),
    },
    orderBy: { entityCode: 'asc' },
  });

  if (!clients.length) {
    console.warn('→ Industry depth: no showcase KE clients — skipped');
    return;
  }

  console.log(`\n→ Industry depth for ${clients.length} companies…`);

  for (const client of clients) {
    if (!client.entityCode) continue;
    const packId = packIdFromEntity(client.entityCode);
    const prefix = prefixFromEntity(client.entityCode);
    const modules = modulesForPack(packId);
    const row: ClientRow = {
      id: client.id,
      name: client.name,
      organizationId: client.organizationId,
      entityCode: client.entityCode,
    };

    const parts: string[] = [];

    const run = async (label: string, fn: () => Promise<string | void>) => {
      try {
        const msg = await fn();
        if (msg) parts.push(msg);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`    · ${label} skipped: ${message.slice(0, 160)}`);
      }
    };

    await run('assets', async () => {
      if (!modules.has('assets')) return;
      const n = await seedAssetsForClient(row, packId, prefix, admin.id);
      return `${n} assets`;
    });
    await run('hse', async () => {
      if (!modules.has('hse')) return;
      const n = await seedHseForClient(row, packId, prefix, admin.id);
      return `${n} HSE`;
    });
    await run('procurement', async () => {
      if (!modules.has('procurement')) return;
      const n = await seedProcurementForClient(row, packId, prefix, admin.id, admin.id);
      return `${n} PRs`;
    });
    await run('performance', async () => {
      if (!modules.has('performance')) return;
      const perf = await seedPerformanceForClient(row, packId);
      return `perf ${perf.reviews} reviews`;
    });

    console.log(`  ✓ ${client.name}: ${parts.join(', ') || 'no depth modules'}`);
  }

  const linked = await relinkConstructionSitesToProjects();
  if (linked > 0) {
    console.log(`  ✓ Construction: linked ${linked} sites → projects`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.');
  await seedIndustryDepthForAll();
  console.log('\nIndustry depth seed complete.\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
