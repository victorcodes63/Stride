/**
 * Seed Sales Phase 1 demo data for SwiftFreight (cargo-logistics).
 * Run: set -a && . ./.env.local && set +a && npx tsx prisma/seed-sales-demo.ts
 *
 * Idempotent: wipes prior sales deals/targets/contacts/rules for the org first.
 */
import {
  PrismaClient,
  SalesCommissionRuleStatus,
  SalesDealStage,
  SalesForecastCategory,
  SalesTargetPeriodType,
  SalesTargetStatus,
} from '@prisma/client';
import { syncRepPeriodMetric } from '../src/lib/sales/metrics-sync';
import {
  defaultForecastForStage,
  defaultProbabilityForStage,
  type SalesDealStage as Stage,
} from '../src/lib/sales/schema';

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
  const client =
    (await prisma.outsourcingClient.findFirst({ where: { entityCode: 'cargo-logistics__ke' } })) ??
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
  await prisma.salesDealActivity.deleteMany({ where: { organizationId } });
  await prisma.salesDealStageHistory.deleteMany({ where: { organizationId } });
  await prisma.salesActual.deleteMany({ where: { organizationId } });
  await prisma.salesRepPeriodMetric.deleteMany({ where: { organizationId } });
  await prisma.salesDeal.deleteMany({ where: { organizationId } });
  await prisma.salesContact.deleteMany({ where: { organizationId } });
  await prisma.salesTarget.deleteMany({ where: { organizationId } });
  await prisma.salesCommissionRule.deleteMany({ where: { organizationId } });
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
          billingNotes: 'Sales demo account — SwiftFreight pipeline.',
        },
      });
    }
    clients.push(client);
  }
  return clients;
}

async function main() {
  const organizationId = await resolveOrganizationId();
  console.log(`→ Sales seed for org ${organizationId}`);

  await wipeSales(organizationId);

  const employees = await prisma.employee.findMany({
    where: { organizationId, employmentStatus: 'active' },
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

  const accounts = await ensureAccountClients(organizationId);
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
      name: 'SwiftFreight standard tiers',
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
        notes: 'SwiftFreight sales demo deal',
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

  const dealCount = await prisma.salesDeal.count({ where: { organizationId } });
  const metrics = await prisma.salesRepPeriodMetric.count({ where: { organizationId } });
  console.log(`→ Seeded ${dealCount} deals, ${contacts.length} contacts, ${metrics} rep metrics.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
