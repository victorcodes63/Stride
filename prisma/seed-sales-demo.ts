/**
 * Seed Sales Phase 1–2 demo data for Savannah Freight (cargo-logistics).
 * Run: set -a && . ./.env.local && set +a && npx tsx prisma/seed-sales-demo.ts
 *
 * Resolves cargo-logistics__ke, then Savannah / legacy SwiftFreight name match.
 * Idempotent: wipes prior sales deals/targets/contacts/rules for the org first.
 */
import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  StaffUserType,
  UserRole,
  SalesCommissionRuleStatus,
  SalesDealStage,
  SalesForecastCategory,
  SalesQuoteStatus,
  SalesTargetPeriodType,
  SalesTargetStatus,
  SalesTaskStatus,
} from '@prisma/client';
import { syncRepPeriodMetric } from '../src/lib/sales/metrics-sync';
import {
  defaultForecastForStage,
  defaultProbabilityForStage,
  type SalesDealStage as Stage,
} from '../src/lib/sales/schema';
import { scoreLead } from '../src/lib/sales/lead-scoring';

const prisma = new PrismaClient();

const ACCOUNT_SPECS = [
  { name: 'Tusker Distillers Ltd', contact: 'Grace Wambui', email: 'grace.wambui@tusker.co.ke' },
  { name: 'Rift Valley Tea Exporters', contact: 'Peter Kiprono', email: 'peter@rvtea.co.ke' },
  { name: 'Coastal Fresh Produce Co', contact: 'Asha Mohamed', email: 'asha@coastalfresh.co.ke' },
  { name: 'Nairobi Pharma Distributors', contact: 'Brian Otieno', email: 'brian@nairobipharma.co.ke' },
  { name: 'Highland Cement Logistics', contact: 'Faith Chebet', email: 'faith@highlandcement.co.ke' },
  { name: 'Lake Basin Agro Hub', contact: 'Samuel Ouma', email: 'sam@lakebasin.co.ke' },
] as const;

type DealSpec = {
  name: string;
  accountIndex: number;
  stage: Stage;
  value: number;
  ownerIndex: number;
  daysToClose: number;
  source: string;
  nextStep?: string;
  stalledDaysAgo?: number;
};

const DEAL_SPECS: DealSpec[] = [
  {
    name: 'Mombasa → Nairobi pharma chilled LTL',
    accountIndex: 3,
    stage: 'won',
    value: 2_450_000,
    ownerIndex: 0,
    daysToClose: -12,
    source: 'Inbound web',
  },
  {
    name: 'Tea export consolidation — Mombasa CFS',
    accountIndex: 1,
    stage: 'won',
    value: 3_800_000,
    ownerIndex: 1,
    daysToClose: -5,
    source: 'Partner referral',
  },
  {
    name: 'Cement bulk haul — Athi River loop',
    accountIndex: 4,
    stage: 'won',
    value: 1_920_000,
    ownerIndex: 0,
    daysToClose: -2,
    source: 'Outbound',
  },
  {
    name: 'Spirits distribution — Western Kenya',
    accountIndex: 0,
    stage: 'negotiation',
    value: 4_200_000,
    ownerIndex: 0,
    daysToClose: 8,
    source: 'Renewal',
    nextStep: 'Send final rate card to Grace',
  },
  {
    name: 'Fresh produce reefers — coast corridor',
    accountIndex: 2,
    stage: 'proposal',
    value: 2_100_000,
    ownerIndex: 1,
    daysToClose: 14,
    source: 'Trade show',
    nextStep: 'Site visit to Mombasa cold store',
  },
  {
    name: 'Agro hub milk collection routes',
    accountIndex: 5,
    stage: 'qualified',
    value: 1_550_000,
    ownerIndex: 2,
    daysToClose: 21,
    source: 'Inbound call',
    nextStep: 'Qualify volume commitment',
  },
  {
    name: 'Tusker peak-season surge capacity',
    accountIndex: 0,
    stage: 'lead',
    value: 980_000,
    ownerIndex: 1,
    daysToClose: 35,
    source: 'Upsell',
  },
  {
    name: 'Pharma last-mile Nairobi CBD',
    accountIndex: 3,
    stage: 'proposal',
    value: 1_350_000,
    ownerIndex: 2,
    daysToClose: -3,
    source: 'Inbound web',
    nextStep: 'Reconfirm close date — slipped',
    stalledDaysAgo: 18,
  },
  {
    name: 'Tea empty container return lane',
    accountIndex: 1,
    stage: 'negotiation',
    value: 720_000,
    ownerIndex: 0,
    daysToClose: -1,
    source: 'Partner referral',
    nextStep: 'Legal MSA review',
    stalledDaysAgo: 22,
  },
  {
    name: 'Lake Basin maize silos → mill',
    accountIndex: 5,
    stage: 'qualified',
    value: 2_600_000,
    ownerIndex: 1,
    daysToClose: 28,
    source: 'Outbound',
    nextStep: 'Intro meeting with ops director',
  },
  {
    name: 'Coastal Fresh cross-border Uganda trial',
    accountIndex: 2,
    stage: 'lost',
    value: 1_100_000,
    ownerIndex: 2,
    daysToClose: -20,
    source: 'Trade show',
  },
  {
    name: 'Highland night-haul backhaul',
    accountIndex: 4,
    stage: 'lead',
    value: 640_000,
    ownerIndex: 0,
    daysToClose: 40,
    source: 'Cold call',
  },
];

function daysFromToday(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

function monthBounds(anchor = new Date()) {
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  return {
    periodStart: new Date(Date.UTC(y, m, 1)),
    periodEnd: new Date(Date.UTC(y, m + 1, 0)),
  };
}

async function resolveOrganizationId(): Promise<string> {
  const sharedOrg = await prisma.organization.findUnique({
    where: { slug: 'demo-multi-vertical' },
    select: { id: true },
  });
  if (sharedOrg) return sharedOrg.id;

  const client =
    (await prisma.outsourcingClient.findFirst({
      where: { entityCode: 'cargo-logistics__ke' },
      orderBy: { createdAt: 'desc' },
    })) ??
    (await prisma.outsourcingClient.findFirst({
      where: { name: { contains: 'Savannah Freight', mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
    })) ??
    (await prisma.outsourcingClient.findFirst({
      where: { name: { contains: 'SwiftFreight', mode: 'insensitive' } },
    })) ??
    (await prisma.outsourcingClient.findFirst({ orderBy: { createdAt: 'asc' } }));

  if (client?.organizationId) return client.organizationId;

  const org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!org) throw new Error('No organization found — run demo seed first.');
  return org.id;
}

async function wipeSales(organizationId: string) {
  await prisma.salesTask.deleteMany({ where: { organizationId } });
  await prisma.salesQuoteLineItem.deleteMany({ where: { organizationId } });
  await prisma.salesQuote.deleteMany({ where: { organizationId } });
  await prisma.salesDealActivity.deleteMany({ where: { organizationId } });
  await prisma.salesDealStageHistory.deleteMany({ where: { organizationId } });
  await prisma.salesDealLineItem.deleteMany({ where: { organizationId } });
  await prisma.salesLead.deleteMany({ where: { organizationId } });
  await prisma.salesForecastSnapshot.deleteMany({ where: { organizationId } });
  await prisma.salesActual.deleteMany({ where: { organizationId } });
  await prisma.salesRepPeriodMetric.deleteMany({ where: { organizationId } });
  await prisma.salesDeal.deleteMany({ where: { organizationId } });
  await prisma.salesContact.deleteMany({ where: { organizationId } });
  await prisma.salesProduct.deleteMany({ where: { organizationId } });
  await prisma.salesTarget.deleteMany({ where: { organizationId } });
  await prisma.salesCommissionRule.deleteMany({ where: { organizationId } });
}

const PRODUCT_SPECS = [
  { name: 'FTL Linehaul (per trip)', sku: 'FTL-LH', category: 'Linehaul', unitPrice: 180_000, isRecurring: false },
  { name: 'LTL Consolidation (per pallet)', sku: 'LTL-CON', category: 'Linehaul', unitPrice: 12_500, isRecurring: false },
  { name: 'Reefer Surcharge (per trip)', sku: 'REEF-SUR', category: 'Surcharge', unitPrice: 35_000, isRecurring: false },
  { name: 'Warehousing & Handling (monthly)', sku: 'WH-MON', category: 'Warehousing', unitPrice: 240_000, isRecurring: true, defaultTermMonths: 12 },
  { name: 'Fuel Surcharge (%)', sku: 'FUEL-SUR', category: 'Surcharge', unitPrice: 15_000, isRecurring: false },
  { name: 'Dedicated Fleet (monthly retainer)', sku: 'FLEET-RET', category: 'Retainer', unitPrice: 950_000, isRecurring: true, defaultTermMonths: 6 },
] as const;


async function ensureSalesStaffUsers(
  organizationId: string,
  reps: Array<{ id: string; firstName: string; lastName: string; email: string | null }>,
) {
  const password = process.env.DEMO_PASSWORD?.trim() || 'Demo@2026!';
  const hashed = await bcrypt.hash(password, 10);
  const specs: Array<{ email: string; name: string; staffUserType: StaffUserType; employeeId: string }> = [];
  if (reps[0]?.email) {
    specs.push({
      email: reps[0].email.toLowerCase(),
      name: `${reps[0].firstName} ${reps[0].lastName}`.trim(),
      staffUserType: StaffUserType.sales_manager,
      employeeId: reps[0].id,
    });
  }
  for (const r of reps.slice(1, 3)) {
    if (!r.email) continue;
    specs.push({
      email: r.email.toLowerCase(),
      name: `${r.firstName} ${r.lastName}`.trim(),
      staffUserType: StaffUserType.sales_rep,
      employeeId: r.id,
    });
  }
  for (const spec of specs) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: {
        name: spec.name,
        passwordHash: hashed,
        role: UserRole.staff,
        staffUserType: spec.staffUserType,
        isActive: true,
      },
      create: {
        email: spec.email,
        name: spec.name,
        passwordHash: hashed,
        role: UserRole.staff,
        staffUserType: spec.staffUserType,
        isActive: true,
      },
    });
    await prisma.organizationMembership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId } },
      update: { role: UserRole.staff, updatedAt: new Date() },
      create: {
        userId: user.id,
        organizationId,
        role: UserRole.staff,
        updatedAt: new Date(),
      },
    });
  }
  console.log(
    `→ Sales staff users: ${specs.map((s) => `${s.email} (${s.staffUserType})`).join(', ') || 'none'} — password ${password}`,
  );
}

async function ensureAccountClients(organizationId: string) {
  const clients = [];
  for (const spec of ACCOUNT_SPECS) {
    let client = await prisma.accountsClient.findFirst({
      where: { organizationId, name: spec.name },
    });
    if (!client) {
      client = await prisma.accountsClient.create({
        data: {
          organizationId,
          type: 'custom',
          name: spec.name,
          currency: 'KES',
          contactName: spec.contact,
          contactEmail: spec.email,
          billingNotes: 'Sales demo account — Savannah Freight pipeline.',
        },
      });
    }
    clients.push(client);
  }
  return clients;
}

const TRAVEL_ACCOUNT_SPECS = [
  { name: 'SafariCorp Executive Travel', contact: 'Linda Cherono', email: 'linda@safaricorp.co.ke' },
  { name: 'Lake Victoria Tours Ltd', contact: 'Otieno Otieno', email: 'otieno@lvtours.co.ke' },
  { name: 'Nairobi Chamber Business Desk', contact: 'Mercy Wanjiku', email: 'mercy@nairobihchamber.co.ke' },
] as const;

const TRAVEL_PRODUCT_SPECS = [
  { name: 'Corporate air ticketing (domestic)', sku: 'AIR-DOM', category: 'Ticketing', unitPrice: 28_000, isRecurring: false },
  { name: 'International fare management', sku: 'AIR-INT', category: 'Ticketing', unitPrice: 95_000, isRecurring: false },
  { name: 'Hotel & MICE booking desk', sku: 'HTL-MICE', category: 'Hospitality', unitPrice: 120_000, isRecurring: true, defaultTermMonths: 12 },
] as const;

const TRAVEL_DEAL_SPECS: DealSpec[] = [
  {
    name: 'SafariCorp — Q3 executive air programme',
    accountIndex: 0,
    stage: 'won',
    value: 1_850_000,
    ownerIndex: 0,
    daysToClose: -8,
    source: 'Renewal',
  },
  {
    name: 'Lake Victoria Tours — group FIT package',
    accountIndex: 1,
    stage: 'negotiation',
    value: 920_000,
    ownerIndex: 1,
    daysToClose: 12,
    source: 'Inbound web',
    nextStep: 'Confirm hotel allotment for July',
  },
  {
    name: 'Chamber desk — MICE Nairobi conference',
    accountIndex: 2,
    stage: 'proposal',
    value: 2_400_000,
    ownerIndex: 0,
    daysToClose: 21,
    source: 'Partner referral',
    nextStep: 'Send venue shortlist',
  },
];

async function main() {
  const organizationId = await resolveOrganizationId();
  const salesTheme = (process.env.SALES_THEME ?? 'cargo').trim().toLowerCase();
  console.log(`→ Sales seed for org ${organizationId} (theme=${salesTheme})`);

  await wipeSales(organizationId);

  const cargoClient = await prisma.outsourcingClient.findFirst({
    where: { organizationId, entityCode: 'cargo-logistics__ke' },
    select: { id: true },
  });
  const travelClient = await prisma.outsourcingClient.findFirst({
    where: { organizationId, entityCode: 'travel-agency__ke' },
    select: { id: true },
  });

  const employees = await prisma.employee.findMany({
    where: {
      organizationId,
      employmentStatus: 'active',
      ...(cargoClient ? { outsourcingClientId: cargoClient.id } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: 8,
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  if (employees.length < 2) {
    throw new Error('Need at least 2 active employees — run cargo demo seed first.');
  }

  const reps = employees.slice(0, 3);
  console.log(
    `→ Reps: ${reps.map((r) => `${r.firstName} ${r.lastName}`).join(', ')}`,
  );

  await ensureSalesStaffUsers(organizationId, reps);

  const accounts = await ensureAccountClients(organizationId);

  const products = [];
  for (const spec of PRODUCT_SPECS) {
    const product = await prisma.salesProduct.create({
      data: {
        organizationId,
        name: spec.name,
        sku: spec.sku,
        category: spec.category,
        unitPrice: spec.unitPrice,
        currency: 'KES',
        isRecurring: spec.isRecurring,
        defaultTermMonths: 'defaultTermMonths' in spec ? spec.defaultTermMonths : null,
        active: true,
      },
    });
    products.push(product);
  }

  const contacts = [];
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i]!;
    const spec = ACCOUNT_SPECS[i]!;
    const contact = await prisma.salesContact.create({
      data: {
        organizationId,
        accountsClientId: account.id,
        name: spec.contact,
        title: i % 2 === 0 ? 'Procurement Lead' : 'Logistics Manager',
        email: spec.email,
        phone: `+254 7${String(10000000 + i * 111).slice(0, 8)}`,
        isDecisionMaker: true,
        lastContactedAt: daysFromToday(-3 - i),
      },
    });
    contacts.push(contact);
  }

  const { periodStart, periodEnd } = monthBounds();
  const targetAmounts = [6_000_000, 5_500_000, 4_000_000];
  for (let i = 0; i < reps.length; i++) {
    await prisma.salesTarget.create({
      data: {
        organizationId,
        employeeId: reps[i]!.id,
        periodType: SalesTargetPeriodType.month,
        periodStart,
        periodEnd,
        amount: targetAmounts[i] ?? 4_000_000,
        currency: 'KES',
        region: 'Kenya',
        segment: 'Cargo',
        status: SalesTargetStatus.approved,
        approvedAt: new Date(),
        notes: 'Demo monthly quota',
      },
    });
  }

  await prisma.salesCommissionRule.create({
    data: {
      organizationId,
      name: 'Savannah Freight standard tiers',
      description: 'Demo commission tiers for cargo sales reps.',
      status: SalesCommissionRuleStatus.active,
      config: {
        tiers: [
          { minAttainmentPct: 0, ratePct: 2 },
          { minAttainmentPct: 80, ratePct: 3.5 },
          { minAttainmentPct: 100, ratePct: 5 },
        ],
        acceleratorAbovePct: 120,
        acceleratorMultiplier: 1.15,
        capAmount: 500_000,
      },
    },
  });

  const adminUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: 'demo@', mode: 'insensitive' } },
        { role: 'admin' },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const spec of DEAL_SPECS) {
    const owner = reps[Math.min(spec.ownerIndex, reps.length - 1)]!;
    const account = accounts[spec.accountIndex]!;
    const contact = contacts[spec.accountIndex]!;
    const closeDate = daysFromToday(spec.daysToClose);
    const stage = spec.stage as SalesDealStage;
    const updatedAt =
      spec.stalledDaysAgo != null ? daysFromToday(-spec.stalledDaysAgo) : new Date();

    const deal = await prisma.salesDeal.create({
      data: {
        organizationId,
        name: spec.name,
        stage,
        value: spec.value,
        currency: 'KES',
        ownerEmployeeId: owner.id,
        expectedCloseDate: closeDate,
        closedAt: stage === 'won' || stage === 'lost' ? closeDate : null,
        accountsClientId: account.id,
        primaryContactId: contact.id,
        probability: defaultProbabilityForStage(spec.stage),
        forecastCategory: defaultForecastForStage(spec.stage) as SalesForecastCategory,
        source: spec.source,
        nextStep: spec.nextStep ?? null,
        nextStepDue: spec.nextStep ? daysFromToday(3) : null,
        lostReason: stage === 'lost' ? 'Chose competitor rates' : null,
        competitor: stage === 'lost' ? 'Regional haulage rival' : null,
        notes: 'Savannah Freight sales demo deal',
        stageEnteredAt:
          stage === 'lead'
            ? daysFromToday(-40)
            : stage === 'won' || stage === 'lost'
              ? closeDate
              : daysFromToday(spec.stalledDaysAgo != null ? -spec.stalledDaysAgo : -7),
        lastActivityAt: updatedAt,
        createdAt: daysFromToday(-40),
        updatedAt,
      },
    });

    await prisma.salesDealStageHistory.create({
      data: {
        organizationId,
        dealId: deal.id,
        fromStage: null,
        toStage: 'lead',
        changedByUserId: adminUser?.id ?? null,
        changedAt: daysFromToday(-40),
      },
    });

    if (stage !== 'lead') {
      await prisma.salesDealStageHistory.create({
        data: {
          organizationId,
          dealId: deal.id,
          fromStage: 'lead',
          toStage: stage,
          changedByUserId: adminUser?.id ?? null,
          changedAt: daysFromToday(stage === 'won' || stage === 'lost' ? spec.daysToClose : -7),
        },
      });
    }

    if (spec.nextStep || stage === 'negotiation' || stage === 'proposal') {
      await prisma.salesDealActivity.create({
        data: {
          organizationId,
          dealId: deal.id,
          type: 'call',
          subject: 'Discovery / follow-up',
          body: `Logged for ${spec.name}`,
          outcome: 'Connected',
          actorEmployeeId: owner.id,
          contactId: contact.id,
          createdAt: daysFromToday(-4),
        },
      });
    }

    if (stage === 'won') {
      await prisma.salesActual.create({
        data: {
          organizationId,
          employeeId: owner.id,
          periodStart,
          periodEnd,
          amount: spec.value,
          currency: 'KES',
          source: 'deal',
          salesDealId: deal.id,
          notes: `Won deal: ${spec.name}`,
          recordedByUserId: adminUser?.id ?? null,
        },
      });
    }
  }

  for (const rep of reps) {
    await syncRepPeriodMetric(prisma, {
      organizationId,
      employeeId: rep.id,
      periodStart,
      periodEnd,
      currency: 'KES',
    });
  }

  // Phase 2: leads, line items, cargo weights, MSA contracts, forecast snapshot
  const openDeals = await prisma.salesDeal.findMany({
    where: {
      organizationId,
      stage: { in: ['proposal', 'negotiation', 'qualified'] },
    },
    take: 4,
  });
  const linehaulProduct = products.find((p) => p.sku === 'FTL-LH') ?? products[0];
  const warehousingProduct = products.find((p) => p.sku === 'WH-MON') ?? products[0];
  for (let i = 0; i < openDeals.length; i++) {
    const d = openDeals[i]!;
    const primaryProduct = i % 2 === 0 ? linehaulProduct : warehousingProduct;
    await prisma.salesDealLineItem.create({
      data: {
        organizationId,
        dealId: d.id,
        productId: primaryProduct?.id ?? null,
        description: i % 2 === 0 ? 'Linehaul rate card' : 'Warehousing + handling',
        quantity: 1,
        unitPrice: Math.round(Number(d.value) * 0.6),
        discountPct: 0,
        sortOrder: 0,
      },
    });
    await prisma.salesDealLineItem.create({
      data: {
        organizationId,
        dealId: d.id,
        description: 'Fuel surcharge',
        quantity: 1,
        unitPrice: Math.round(Number(d.value) * 0.15),
        discountPct: 5,
        sortOrder: 1,
      },
    });
    await prisma.salesDeal.update({
      where: { id: d.id },
      data: { cargoWeightKg: 8_000 + i * 4_000 },
    });
  }

  const leadSpecs = [
    { name: 'Janet Achieng', company: 'Kisumu Dairy Co-op', source: 'Referral', ownerIndex: 0, estimatedValue: 3_200_000, phone: true, activityDaysAgo: 1 },
    { name: 'David Mwangi', company: 'Thika Steel Fabricators', source: 'Inbound web', ownerIndex: 1, estimatedValue: 1_400_000, phone: true, activityDaysAgo: 6 },
    { name: 'Halima Yusuf', company: 'Garissa Agro Traders', source: 'Cold call', ownerIndex: 2, estimatedValue: 480_000, phone: false, activityDaysAgo: 45 },
    { name: 'Ken Barasa', company: 'Eldoret Millers', source: 'Partner', ownerIndex: 0, estimatedValue: 2_100_000, phone: true, activityDaysAgo: 3 },
    { name: 'Zawadi Njeri', company: 'Naivasha Flora Exports', source: 'Trade show', ownerIndex: 1, estimatedValue: 900_000, phone: false, activityDaysAgo: 20 },
  ] as const;
  for (let i = 0; i < leadSpecs.length; i++) {
    const spec = leadSpecs[i]!;
    const email = `${spec.name.split(' ')[0]!.toLowerCase()}@example.co.ke`;
    const status = i === 0 ? 'qualified' : i === leadSpecs.length - 1 ? 'disqualified' : 'new';
    const lastActivityAt = daysFromToday(-spec.activityDaysAgo);
    const { score, rating } = scoreLead({
      email,
      phone: spec.phone ? '+254700111222' : null,
      company: spec.company,
      source: spec.source,
      status,
      estimatedValue: spec.estimatedValue,
      lastActivityAt,
    });
    await prisma.salesLead.create({
      data: {
        organizationId,
        name: spec.name,
        company: spec.company,
        email,
        phone: spec.phone ? '+254700111222' : null,
        source: spec.source,
        status,
        estimatedValue: spec.estimatedValue,
        score,
        rating,
        lastActivityAt,
        ownerEmployeeId: reps[Math.min(spec.ownerIndex, reps.length - 1)]!.id,
        notes: 'Sales Phase 2 demo lead',
      },
    });
  }

  for (let ai = 0; ai < Math.min(4, accounts.length); ai++) {
    const account = accounts[ai]!;
    const existing = await prisma.accountsContract.findFirst({
      where: { organizationId, clientId: account.id },
    });
    if (!existing) {
      const endOffset = account.name.includes('Pharma') ? 25 : account.name.includes('Tea') ? -10 : 120;
      await prisma.accountsContract.create({
        data: {
          organizationId,
          clientId: account.id,
          title: `${account.name} MSA`,
          reference: `MSA-${String(ai + 1).padStart(2, '0')}-2026`,
          startDate: daysFromToday(-180),
          endDate: daysFromToday(endOffset),
        },
      });
    }
  }

  // Quotes: one per open deal (draft / sent / accepted mix) with product-linked lines.
  const quotableDeals = await prisma.salesDeal.findMany({
    where: { organizationId, stage: { in: ['proposal', 'negotiation'] } },
    include: { accountsClient: { select: { id: true } } },
    take: 3,
  });
  const quoteStatuses: SalesQuoteStatus[] = [
    SalesQuoteStatus.draft,
    SalesQuoteStatus.sent,
    SalesQuoteStatus.accepted,
  ];
  for (let i = 0; i < quotableDeals.length; i++) {
    const d = quotableDeals[i]!;
    const status = quoteStatuses[i % quoteStatuses.length]!;
    const linehaul = products.find((p) => p.sku === 'FTL-LH') ?? products[0]!;
    const fuel = products.find((p) => p.sku === 'FUEL-SUR') ?? products[1]!;
    const quote = await prisma.salesQuote.create({
      data: {
        organizationId,
        quoteNumber: i + 1,
        dealId: d.id,
        accountsClientId: d.accountsClientId,
        title: `Proposal — ${d.name}`,
        status,
        currency: 'KES',
        issueDate: daysFromToday(-7 + i),
        validUntil: daysFromToday(21 + i),
        discountPct: i === 2 ? 5 : 0,
        taxRateBps: 1600,
        notes: 'Savannah Freight demo quote',
        terms: 'Valid for 30 days. Rates exclusive of VAT unless stated.',
        sentAt: status === 'sent' || status === 'accepted' ? daysFromToday(-5 + i) : null,
        acceptedAt: status === 'accepted' ? daysFromToday(-2 + i) : null,
      },
    });
    await prisma.salesQuoteLineItem.create({
      data: {
        organizationId,
        quoteId: quote.id,
        productId: linehaul.id,
        description: linehaul.name,
        quantity: 4,
        unitPrice: Number(linehaul.unitPrice),
        discountPct: 0,
        isRecurring: false,
        sortOrder: 0,
      },
    });
    await prisma.salesQuoteLineItem.create({
      data: {
        organizationId,
        quoteId: quote.id,
        productId: fuel.id,
        description: fuel.name,
        quantity: 4,
        unitPrice: Number(fuel.unitPrice),
        discountPct: 0,
        isRecurring: false,
        sortOrder: 1,
      },
    });
  }

  // Tasks: a mix of open, overdue, and completed follow-ups across deals and leads.
  const taskDeals = await prisma.salesDeal.findMany({
    where: { organizationId, stage: { in: ['proposal', 'negotiation', 'qualified'] } },
    take: 4,
  });
  const seededLeads = await prisma.salesLead.findMany({ where: { organizationId }, take: 3 });
  const taskSpecs: Array<{
    title: string;
    type: 'call' | 'email' | 'meeting' | 'task';
    status: SalesTaskStatus;
    dueOffset: number;
    dealIndex?: number;
    leadIndex?: number;
  }> = [
    { title: 'Send rate card follow-up', type: 'email', status: SalesTaskStatus.open, dueOffset: 2, dealIndex: 0 },
    { title: 'Schedule site visit', type: 'meeting', status: SalesTaskStatus.open, dueOffset: 5, dealIndex: 1 },
    { title: 'Chase signed MSA', type: 'call', status: SalesTaskStatus.open, dueOffset: -3, dealIndex: 2 },
    { title: 'Qualify volume commitment', type: 'call', status: SalesTaskStatus.open, dueOffset: -8, dealIndex: 3 },
    { title: 'Intro call with new lead', type: 'call', status: SalesTaskStatus.completed, dueOffset: -1, leadIndex: 0 },
    { title: 'Send company profile', type: 'email', status: SalesTaskStatus.open, dueOffset: 1, leadIndex: 1 },
  ];
  for (const spec of taskSpecs) {
    const deal = spec.dealIndex != null ? taskDeals[spec.dealIndex] : undefined;
    const lead = spec.leadIndex != null ? seededLeads[spec.leadIndex] : undefined;
    if (spec.dealIndex != null && !deal) continue;
    if (spec.leadIndex != null && !lead) continue;
    await prisma.salesTask.create({
      data: {
        organizationId,
        title: spec.title,
        type: spec.type,
        status: spec.status,
        dueDate: daysFromToday(spec.dueOffset),
        completedAt: spec.status === SalesTaskStatus.completed ? daysFromToday(-1) : null,
        assigneeEmployeeId: (deal?.ownerEmployeeId ?? lead?.ownerEmployeeId) ?? reps[0]!.id,
        dealId: deal?.id ?? null,
        leadId: lead?.id ?? null,
      },
    });
  }

  // Travel-agency flavoured pipeline (same org; Horizon sidebar shows Sales).
  if ((salesTheme === 'both' || salesTheme === 'travel') && travelClient) {
    const travelReps = await prisma.employee.findMany({
      where: {
        organizationId,
        outsourcingClientId: travelClient.id,
        employmentStatus: 'active',
      },
      orderBy: { createdAt: 'asc' },
      take: 3,
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const tReps = travelReps.length >= 2 ? travelReps : reps;
    await ensureSalesStaffUsers(organizationId, tReps);

    const travelAccounts = [];
    for (const spec of TRAVEL_ACCOUNT_SPECS) {
      let client = await prisma.accountsClient.findFirst({
        where: { organizationId, name: spec.name },
      });
      if (!client) {
        client = await prisma.accountsClient.create({
          data: {
            organizationId,
            type: 'custom',
            name: spec.name,
            currency: 'KES',
            contactName: spec.contact,
            contactEmail: spec.email,
            billingNotes: 'Sales demo account — Horizon Travels pipeline.',
          },
        });
      }
      travelAccounts.push(client);
    }

    for (const spec of TRAVEL_PRODUCT_SPECS) {
      products.push(
        await prisma.salesProduct.create({
          data: {
            organizationId,
            name: spec.name,
            sku: spec.sku,
            category: spec.category,
            unitPrice: spec.unitPrice,
            currency: 'KES',
            isRecurring: spec.isRecurring,
            defaultTermMonths: 'defaultTermMonths' in spec ? spec.defaultTermMonths : null,
            active: true,
          },
        }),
      );
    }

    const travelContacts = [];
    for (let i = 0; i < travelAccounts.length; i++) {
      const account = travelAccounts[i]!;
      const spec = TRAVEL_ACCOUNT_SPECS[i]!;
      travelContacts.push(
        await prisma.salesContact.create({
          data: {
            organizationId,
            accountsClientId: account.id,
            name: spec.contact,
            title: 'Travel Manager',
            email: spec.email,
            phone: `+254 7${String(20000000 + i * 222).slice(0, 8)}`,
            isDecisionMaker: true,
            lastContactedAt: daysFromToday(-2 - i),
          },
        }),
      );
    }

    for (let i = 0; i < Math.min(tReps.length, 2); i++) {
      await prisma.salesTarget.create({
        data: {
          organizationId,
          employeeId: tReps[i]!.id,
          periodType: SalesTargetPeriodType.month,
          periodStart,
          periodEnd,
          amount: 3_500_000 - i * 500_000,
          currency: 'KES',
          region: 'Kenya',
          segment: 'Travel',
          status: SalesTargetStatus.approved,
          approvedAt: new Date(),
          notes: 'Horizon Travels monthly quota',
        },
      });
    }

    for (const spec of TRAVEL_DEAL_SPECS) {
      const owner = tReps[Math.min(spec.ownerIndex, tReps.length - 1)]!;
      const account = travelAccounts[spec.accountIndex]!;
      const contact = travelContacts[spec.accountIndex]!;
      const closeDate = daysFromToday(spec.daysToClose);
      const stage = spec.stage as SalesDealStage;
      const deal = await prisma.salesDeal.create({
        data: {
          organizationId,
          name: spec.name,
          stage,
          value: spec.value,
          currency: 'KES',
          ownerEmployeeId: owner.id,
          expectedCloseDate: closeDate,
          closedAt: stage === 'won' || stage === 'lost' ? closeDate : null,
          accountsClientId: account.id,
          primaryContactId: contact.id,
          probability: defaultProbabilityForStage(spec.stage),
          forecastCategory: defaultForecastForStage(spec.stage) as SalesForecastCategory,
          source: spec.source,
          nextStep: spec.nextStep ?? null,
          nextStepDue: spec.nextStep ? daysFromToday(4) : null,
          notes: 'Horizon Travels sales demo deal',
          stageEnteredAt: daysFromToday(-14),
          lastActivityAt: new Date(),
          createdAt: daysFromToday(-30),
        },
      });
      if (stage === 'won') {
        await prisma.salesActual.create({
          data: {
            organizationId,
            employeeId: owner.id,
            periodStart,
            periodEnd,
            amount: spec.value,
            currency: 'KES',
            source: 'deal',
            salesDealId: deal.id,
            notes: `Won deal: ${spec.name}`,
            recordedByUserId: adminUser?.id ?? null,
          },
        });
      }
    }

    for (const rep of tReps) {
      await syncRepPeriodMetric(prisma, {
        organizationId,
        employeeId: rep.id,
        periodStart,
        periodEnd,
        currency: 'KES',
      });
    }
    console.log(`→ Travel pipeline: ${TRAVEL_DEAL_SPECS.length} deals for Horizon Travels`);
  }

  const allDealsForSnap = await prisma.salesDeal.findMany({ where: { organizationId } });
  let commitAmt = 0;
  let bestAmt = 0;
  let pipeAmt = 0;
  let closedAmt = 0;
  for (const d of allDealsForSnap) {
    const v = Number(d.value);
    if (d.stage === 'won') closedAmt += v;
    else if (d.forecastCategory === 'commit') commitAmt += v;
    else if (d.forecastCategory === 'best_case') bestAmt += v;
    else if (d.forecastCategory !== 'omitted') pipeAmt += v;
  }
  await prisma.salesForecastSnapshot.create({
    data: {
      organizationId,
      periodStart,
      periodEnd,
      currency: 'KES',
      commitAmount: commitAmt,
      bestCaseAmount: bestAmt,
      pipelineAmount: pipeAmt,
      closedAmount: closedAmt,
      teamTarget: targetAmounts.slice(0, reps.length).reduce((a, b) => a + b, 0),
      notes: 'Demo baseline snapshot',
    },
  });

  const dealCount = await prisma.salesDeal.count({ where: { organizationId } });
  const metrics = await prisma.salesRepPeriodMetric.count({ where: { organizationId } });
  const leadCount = await prisma.salesLead.count({ where: { organizationId } });
  const lineCount = await prisma.salesDealLineItem.count({ where: { organizationId } });
  const productCount = await prisma.salesProduct.count({ where: { organizationId } });
  const quoteCount = await prisma.salesQuote.count({ where: { organizationId } });
  const taskCount = await prisma.salesTask.count({ where: { organizationId } });
  console.log(
    `→ Seeded ${dealCount} deals, ${contacts.length} contacts, ${leadCount} leads, ${lineCount} line items, ${productCount} products, ${quoteCount} quotes, ${taskCount} tasks, ${metrics} rep metrics.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
