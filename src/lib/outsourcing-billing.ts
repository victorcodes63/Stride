/**
 * OUT-07 — BPO billing automation: rate card + headcount + payroll pass-through → Finance AR.
 */
import type { Prisma } from '@prisma/client';
import type { BillingLineDraft } from '@/lib/accounts/billing-automation';
import {
  buildPayrollInvoiceLines,
  buildRecurringBillLines,
  createDraftAccountsInvoice,
  dueDateFromIssue,
  type OutsourcingBillingProfile,
} from '@/lib/accounts/billing-automation';
import {
  computeRateCardLineAmount,
  type OutsourcingRateCardJson,
} from '@/lib/outsourcing-client';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type OutsourcingBillMode = 'monthly' | 'payroll';

export function buildRateCardInvoiceLines(input: {
  month: number;
  year: number;
  clientName: string;
  rateCard: Pick<OutsourcingRateCardJson, 'lines' | 'currency' | 'name'>;
  headcount: number;
  payrollGrossTotal?: number;
}): BillingLineDraft[] {
  const monthLabel = MONTH_NAMES[input.month - 1] ?? String(input.month);
  const ctx = {
    headcount: input.headcount,
    payrollGrossTotal: input.payrollGrossTotal ?? 0,
  };

  return input.rateCard.lines
    .map((line) => {
      const amountExVat = computeRateCardLineAmount(line, ctx);
      if (amountExVat <= 0) return null;
      const unitHint =
        line.pricingModel === 'per_head'
          ? `${input.headcount} headcount`
          : line.pricingModel === 'percentage'
            ? `${(line.percentageBps ?? 0) / 100}% of payroll gross`
            : 'flat fee';
      return {
        item: `${line.label} — ${monthLabel} ${input.year}`,
        description: `${input.clientName} · ${unitHint}`,
        amountExVat,
      } satisfies BillingLineDraft;
    })
    .filter((line): line is BillingLineDraft => line !== null);
}

export function mergeBillingLines(...groups: BillingLineDraft[][]): BillingLineDraft[] {
  return groups.flat().filter((line) => line.amountExVat > 0);
}

export function resolveBillingProfile(client: {
  serviceFeeType: string | null;
  serviceFeeAmount: Prisma.Decimal | null;
  paymentTerms: string | null;
  currency: string | null;
}): OutsourcingBillingProfile {
  return {
    serviceFeeType: client.serviceFeeType,
    serviceFeeAmount: client.serviceFeeAmount ? Number(client.serviceFeeAmount) : null,
    paymentTerms: client.paymentTerms,
    currency: client.currency,
  };
}

export async function ensureAccountsClientForOutsourcing(
  tx: Prisma.TransactionClient,
  organizationId: string,
  outsourcingClientId: string,
): Promise<{ accountsClientId: string; profile: OutsourcingBillingProfile }> {
  const client = await tx.outsourcingClient.findFirst({
    where: { id: outsourcingClientId, organizationId },
    select: {
      id: true,
      name: true,
      currency: true,
      serviceFeeType: true,
      serviceFeeAmount: true,
      paymentTerms: true,
      accountsClient: { select: { id: true } },
    },
  });
  if (!client) {
    throw Object.assign(new Error('OUTSOURCING_CLIENT_NOT_FOUND'), { code: 'OUTSOURCING_CLIENT_NOT_FOUND' });
  }

  let accountsClientId = client.accountsClient?.id ?? null;
  if (!accountsClientId) {
    const created = await tx.accountsClient.create({
      data: {
        organizationId,
        type: 'outsourcing',
        name: client.name,
        currency: (client.currency ?? 'KES').trim() || 'KES',
        outsourcingClientId: client.id,
      },
      select: { id: true },
    });
    accountsClientId = created.id;
  }

  return {
    accountsClientId,
    profile: resolveBillingProfile(client),
  };
}

export async function generateOutsourcingClientInvoice(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    outsourcingClientId: string;
    month: number;
    year: number;
    mode: OutsourcingBillMode;
  },
) {
  const { accountsClientId, profile } = await ensureAccountsClientForOutsourcing(
    tx,
    input.organizationId,
    input.outsourcingClientId,
  );

  const client = await tx.outsourcingClient.findFirstOrThrow({
    where: { id: input.outsourcingClientId, organizationId: input.organizationId },
    include: {
      rateCards: {
        where: { isActive: true },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  });

  const headcount = await tx.employee.count({
    where: {
      organizationId: input.organizationId,
      outsourcingClientId: input.outsourcingClientId,
      employmentStatus: 'active',
    },
  });

  const activeRateCard = client.rateCards[0] ?? null;
  const rateCardLines: BillingLineDraft[] = activeRateCard
    ? buildRateCardInvoiceLines({
        month: input.month,
        year: input.year,
        clientName: client.name,
        rateCard: {
          name: activeRateCard.name,
          currency: activeRateCard.currency,
          lines: activeRateCard.lines.map((line) => ({
            label: line.label,
            serviceKey: line.serviceKey,
            pricingModel: line.pricingModel as OutsourcingRateCardJson['lines'][number]['pricingModel'],
            unitAmount: String(line.unitAmount),
            percentageBps: line.percentageBps,
          })),
        },
        headcount,
      })
    : buildRecurringBillLines({
        month: input.month,
        year: input.year,
        headcount,
        profile,
      });

  let payrollLines: BillingLineDraft[] = [];
  let payrollGrossTotal = 0;

  if (input.mode === 'payroll') {
    const payrollRows = await tx.payroll.findMany({
      where: {
        organizationId: input.organizationId,
        month: input.month,
        year: input.year,
        status: { in: ['approved', 'paid'] },
        employee: { outsourcingClientId: input.outsourcingClientId },
      },
      select: { grossPay: true, netPay: true, nita: true },
    });

    if (payrollRows.length === 0) {
      throw Object.assign(new Error('PAYROLL_NOT_APPROVED'), { code: 'PAYROLL_NOT_APPROVED' });
    }

    const mapped = payrollRows.map((line) => ({
      grossPay: Number(line.grossPay),
      netPay: Number(line.netPay),
      nita: Number(line.nita ?? 0),
    }));
    payrollGrossTotal = mapped.reduce((sum, row) => sum + row.grossPay, 0);

    payrollLines = buildPayrollInvoiceLines({
      month: input.month,
      year: input.year,
      headcount: mapped.length || headcount,
      profile,
      payrollRows: mapped,
    });

    // When rate card exists, service-fee lines from payroll builder may duplicate rate card — keep pass-through only.
    if (activeRateCard) {
      payrollLines = payrollLines.filter(
        (line) => !line.item.toLowerCase().includes('management fee'),
      );
      const rateWithPayroll = buildRateCardInvoiceLines({
        month: input.month,
        year: input.year,
        clientName: client.name,
        rateCard: {
          name: activeRateCard.name,
          currency: activeRateCard.currency,
          lines: activeRateCard.lines.map((line) => ({
            label: line.label,
            serviceKey: line.serviceKey,
            pricingModel: line.pricingModel as OutsourcingRateCardJson['lines'][number]['pricingModel'],
            unitAmount: String(line.unitAmount),
            percentageBps: line.percentageBps,
          })),
        },
        headcount,
        payrollGrossTotal,
      });
      rateCardLines.splice(0, rateCardLines.length, ...rateWithPayroll);
    }
  }

  const lines = mergeBillingLines(rateCardLines, payrollLines);
  if (lines.length === 0) {
    throw Object.assign(new Error('NO_BILLABLE_LINES'), { code: 'NO_BILLABLE_LINES' });
  }

  const issueDate = new Date(Date.UTC(input.year, input.month - 1, 1, 12, 0, 0));
  const dueDate = dueDateFromIssue(issueDate, profile.paymentTerms);
  const currency = profile.currency ?? client.currency ?? 'KES';

  const invoice = await createDraftAccountsInvoice(tx, {
    organizationId: input.organizationId,
    clientId: accountsClientId,
    issueDate,
    dueDate,
    currency,
    notes:
      input.mode === 'payroll'
        ? `OUT-07 payroll bill for ${client.name} (${input.month}/${input.year}, ${headcount} active employees).`
        : `OUT-07 monthly bill for ${client.name} (${input.month}/${input.year}, ${headcount} active employees).`,
    lines,
  });

  return { invoice, headcount, lines, accountsClientId };
}
