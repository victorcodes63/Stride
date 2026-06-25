import { Prisma } from '@prisma/client';

export type BillingLineDraft = {
  item: string;
  description?: string;
  amountExVat: number;
};

export type OutsourcingBillingProfile = {
  serviceFeeType: string | null;
  serviceFeeAmount: number | null;
  paymentTerms: string | null;
  currency: string | null;
};

export function parsePaymentTermsDays(paymentTerms: string | null | undefined): number {
  if (!paymentTerms) return 30;
  const match = paymentTerms.match(/net\s*(\d+)/i);
  if (match) return Math.max(1, parseInt(match[1]!, 10));
  return 30;
}

export function computeServiceFeeExVat(
  profile: OutsourcingBillingProfile,
  headcount: number,
  payrollGrossTotal = 0,
): number {
  const amount = profile.serviceFeeAmount ?? 0;
  const type = (profile.serviceFeeType ?? 'per_employee').toLowerCase();
  if (type === 'fixed') return round2(amount);
  if (type === 'percentage') return round2((payrollGrossTotal * amount) / 100);
  return round2(amount * Math.max(0, headcount));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function buildRecurringBillLines(input: {
  month: number;
  year: number;
  headcount: number;
  profile: OutsourcingBillingProfile;
}): BillingLineDraft[] {
  const monthLabel = MONTH_NAMES[input.month - 1] ?? String(input.month);
  const fee = computeServiceFeeExVat(input.profile, input.headcount);
  if (fee <= 0) return [];

  const feeType = (input.profile.serviceFeeType ?? 'per_employee').toLowerCase();
  const unit =
    feeType === 'fixed'
      ? 'Fixed monthly fee'
      : feeType === 'percentage'
        ? `${input.profile.serviceFeeAmount ?? 0}% of payroll gross`
        : `${input.headcount} employees × KES ${(input.profile.serviceFeeAmount ?? 0).toLocaleString('en-KE')}`;

  return [
    {
      item: `HR management fee — ${monthLabel} ${input.year}`,
      description: unit,
      amountExVat: fee,
    },
  ];
}

export function buildPayrollInvoiceLines(input: {
  month: number;
  year: number;
  headcount: number;
  profile: OutsourcingBillingProfile;
  payrollRows: Array<{ grossPay: number; netPay: number; nita: number }>;
}): BillingLineDraft[] {
  const monthLabel = MONTH_NAMES[input.month - 1] ?? String(input.month);
  const grossTotal = round2(input.payrollRows.reduce((s, r) => s + r.grossPay, 0));
  const netTotal = round2(input.payrollRows.reduce((s, r) => s + r.netPay, 0));
  const nitaTotal = round2(input.payrollRows.reduce((s, r) => s + r.nita, 0));
  const fee = computeServiceFeeExVat(input.profile, input.headcount, grossTotal);

  const lines: BillingLineDraft[] = [
    {
      item: `Payroll pass-through (net pay) — ${monthLabel} ${input.year}`,
      description: `${input.payrollRows.length} employees approved for disbursement`,
      amountExVat: netTotal,
    },
  ];

  if (nitaTotal > 0) {
    lines.push({
      item: `Employer NITA levy — ${monthLabel} ${input.year}`,
      description: 'Employer statutory levy (pass-through)',
      amountExVat: nitaTotal,
    });
  }

  if (fee > 0) {
    lines.push({
      item: `HR management fee — ${monthLabel} ${input.year}`,
      description: `Service fee (${input.profile.serviceFeeType ?? 'per_employee'})`,
      amountExVat: fee,
    });
  }

  return lines.filter((l) => l.amountExVat > 0);
}

export function dueDateFromIssue(issueDate: Date, paymentTerms: string | null | undefined): Date {
  const days = parsePaymentTermsDays(paymentTerms);
  const d = new Date(issueDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function createDraftAccountsInvoice(
  tx: Prisma.TransactionClient,
  input: {
    clientId: string;
    issueDate: Date;
    dueDate: Date | null;
    currency: string;
    notes: string | null;
    lines: BillingLineDraft[];
    vatRateBps?: number;
  },
) {
  if (input.lines.length === 0) {
    throw Object.assign(new Error('NO_BILLABLE_LINES'), { code: 'NO_BILLABLE_LINES' });
  }

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(424242);`;
  const maxInvoiceNumber = await tx.accountsInvoice.aggregate({ _max: { invoiceNumber: true } });
  const invoiceNumber = (maxInvoiceNumber._max.invoiceNumber ?? 0) + 1;

  return tx.accountsInvoice.create({
    data: {
      clientId: input.clientId,
      invoiceNumber,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      taxDate: input.issueDate,
      currency: input.currency,
      vatRateBps: input.vatRateBps ?? 1600,
      status: 'unpaid',
      paymentBank: 'consultancy_fees',
      notes: input.notes,
      lines: {
        create: input.lines.map((line, index) => ({
          item: line.item,
          description: line.description ?? null,
          amountExVat: new Prisma.Decimal(line.amountExVat),
          sortOrder: index,
        })),
      },
    },
    include: { lines: true },
  });
}
