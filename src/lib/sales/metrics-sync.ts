import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/** Recompute SalesRepPeriodMetric roll-ups from approved targets + actuals (won deals + manual + finance). */
export async function syncRepPeriodMetric(
  db: Db,
  params: {
    organizationId: string;
    employeeId: string;
    periodStart: Date;
    periodEnd: Date;
    currency?: string;
  },
): Promise<void> {
  const { organizationId, employeeId, periodStart, periodEnd } = params;
  const currency = params.currency ?? 'KES';

  const approvedTarget = await db.salesTarget.findFirst({
    where: {
      organizationId,
      employeeId,
      status: 'approved',
      periodStart: { lte: periodEnd },
      periodEnd: { gte: periodStart },
    },
    orderBy: { periodEnd: 'desc' },
  });

  const targetAmount = approvedTarget ? Number(approvedTarget.amount) : 0;

  const actualRows = await db.salesActual.findMany({
    where: {
      organizationId,
      employeeId,
      periodStart: { lte: periodEnd },
      periodEnd: { gte: periodStart },
    },
  });

  const wonDeals = await db.salesDeal.findMany({
    where: {
      organizationId,
      ownerEmployeeId: employeeId,
      stage: 'won',
      closedAt: {
        gte: periodStart,
        lte: new Date(periodEnd.getTime() + 86400000),
      },
    },
  });

  const dealIdsInActuals = new Set(actualRows.filter((a) => a.salesDealId).map((a) => a.salesDealId));
  let closed = actualRows.reduce((sum, row) => sum + Number(row.amount), 0);

  for (const deal of wonDeals) {
    if (dealIdsInActuals.has(deal.id)) continue;
    if (deal.accountsInvoiceId) {
      const invoice = await db.accountsInvoice.findFirst({
        where: { id: deal.accountsInvoiceId, organizationId },
        include: { lines: true, creditNotes: true },
      });
      if (invoice) {
        closed += computeInvoiceRevenue(invoice);
        continue;
      }
    }
    closed += Number(deal.value);
  }

  closed = Math.round(closed * 100) / 100;

  if (targetAmount <= 0 && closed <= 0) return;

  await db.salesRepPeriodMetric.upsert({
    where: {
      organizationId_employeeId_periodStart_periodEnd: {
        organizationId,
        employeeId,
        periodStart,
        periodEnd,
      },
    },
    create: {
      organizationId,
      employeeId,
      periodStart,
      periodEnd,
      pipelineTarget: targetAmount,
      pipelineClosed: closed,
      currency,
    },
    update: {
      pipelineTarget: targetAmount,
      pipelineClosed: closed,
      currency,
    },
  });
}

function computeInvoiceRevenue(invoice: {
  totalOverrideIncVat: Prisma.Decimal | null;
  vatRateBps: number;
  lines: Array<{ amountExVat: Prisma.Decimal }>;
  creditNotes: Array<{ totalIncVat: Prisma.Decimal }>;
}): number {
  if (invoice.totalOverrideIncVat != null) {
    return Number(invoice.totalOverrideIncVat);
  }
  const vat = invoice.vatRateBps / 10000;
  let subtotal = invoice.lines.reduce((sum, line) => sum + Number(line.amountExVat) * (1 + vat), 0);
  for (const cn of invoice.creditNotes) {
    subtotal -= Number(cn.totalIncVat);
  }
  return Math.round(subtotal * 100) / 100;
}
