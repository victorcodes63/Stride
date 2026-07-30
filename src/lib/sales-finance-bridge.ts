/**
 * B4 — CRM ↔ Finance invoice bridge.
 *
 * Sales creates invoices only via `createDraftAccountsInvoice` (shared with Finance
 * billing automation). Finance's manual AR POST route remains untouched.
 */
import type { Prisma } from '@prisma/client';
import {
  createDraftAccountsInvoice,
  dueDateFromIssue,
  type BillingLineDraft,
} from '@/lib/accounts/billing-automation';
import { lineItemExtendedAmount } from '@/lib/sales/access';
import { currentMonthPeriod } from '@/lib/sales/api-helpers';
import { syncRepPeriodMetric } from '@/lib/sales/metrics-sync';
import { resolveAccountsClient } from '@/lib/sales/resolve-accounts-client';

type Tx = Prisma.TransactionClient;

const round2 = (n: number) => Math.round(n * 100) / 100;

export type QuoteToInvoiceResult = {
  quoteId: string;
  quoteNumber: number;
  accountsInvoiceId: string;
  invoiceNumber: number;
  alreadyLinked?: boolean;
};

export type DealToInvoiceResult = {
  dealId: string;
  accountsInvoiceId: string;
  invoiceNumber: number;
  salesActualId: string | null;
  alreadyLinked?: boolean;
};

/** Convert an accepted quote → Finance invoice; idempotent on accountsInvoiceId. */
export async function convertAcceptedQuoteToInvoice(
  tx: Tx,
  params: { organizationId: string; quoteId: string },
): Promise<QuoteToInvoiceResult> {
  const quote = await tx.salesQuote.findFirst({
    where: { id: params.quoteId, organizationId: params.organizationId },
    include: {
      accountsClient: {
        include: { outsourcingClient: { select: { paymentTerms: true } } },
      },
      lineItems: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!quote) throw Object.assign(new Error('QUOTE_NOT_FOUND'), { code: 'QUOTE_NOT_FOUND' });
  if (quote.accountsInvoiceId) {
    const existing = await tx.accountsInvoice.findFirst({
      where: { id: quote.accountsInvoiceId, organizationId: params.organizationId },
      select: { id: true, invoiceNumber: true },
    });
    if (existing) {
      return {
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        accountsInvoiceId: existing.id,
        invoiceNumber: existing.invoiceNumber,
        alreadyLinked: true,
      };
    }
  }
  if (quote.status !== 'accepted') {
    throw Object.assign(new Error('QUOTE_NOT_ACCEPTED'), { code: 'QUOTE_NOT_ACCEPTED' });
  }
  // B3 versioning: never invoice a superseded revision (status may still be accepted).
  if (quote.supersededById) {
    throw Object.assign(new Error('QUOTE_SUPERSEDED'), { code: 'QUOTE_SUPERSEDED' });
  }
  if (!quote.accountsClientId) {
    throw Object.assign(new Error('CLIENT_REQUIRED'), { code: 'CLIENT_REQUIRED' });
  }
  if (quote.lineItems.length === 0) {
    throw Object.assign(new Error('NO_BILLABLE_LINES'), { code: 'NO_BILLABLE_LINES' });
  }

  const discountPct = Math.min(100, Math.max(0, Number(quote.discountPct)));
  const discountFactor = 1 - discountPct / 100;

  const lines: BillingLineDraft[] = quote.lineItems.map((li) => {
    const gross = lineItemExtendedAmount({
      quantity: Number(li.quantity),
      unitPrice: Number(li.unitPrice),
      discountPct: Number(li.discountPct),
      isRecurring: li.isRecurring,
      termMonths: li.termMonths,
    });
    return {
      item: li.description,
      description: li.isRecurring
        ? `Recurring (${li.termMonths ?? 1} mo)${discountPct > 0 ? ` · incl. ${discountPct}% quote discount` : ''}`
        : discountPct > 0
          ? `Incl. ${discountPct}% quote discount`
          : `Quote Q-${String(quote.quoteNumber).padStart(4, '0')} line`,
      amountExVat: round2(gross * discountFactor),
    };
  });

  const issueDate = quote.issueDate ?? new Date();
  const paymentTerms = quote.accountsClient?.outsourcingClient?.paymentTerms ?? null;
  const dueDate = quote.validUntil ?? dueDateFromIssue(issueDate, paymentTerms);

  const invoice = await createDraftAccountsInvoice(tx, {
    organizationId: params.organizationId,
    clientId: quote.accountsClientId,
    issueDate,
    dueDate,
    currency: quote.currency,
    notes: `Generated from quote Q-${String(quote.quoteNumber).padStart(4, '0')}: ${quote.title}`,
    lines,
    vatRateBps: quote.taxRateBps,
  });

  await tx.salesQuote.update({
    where: { id: quote.id },
    data: { accountsInvoiceId: invoice.id },
  });

  if (quote.dealId) {
    const deal = await tx.salesDeal.findFirst({
      where: { id: quote.dealId, organizationId: params.organizationId },
      select: { id: true, accountsInvoiceId: true },
    });
    if (deal && !deal.accountsInvoiceId) {
      await tx.salesDeal.update({
        where: { id: deal.id },
        data: { accountsInvoiceId: invoice.id },
      });
    }
  }

  return {
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    accountsInvoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
  };
}

/**
 * Create Finance invoice from a won deal (deal lines or value).
 * Idempotent on deal.accountsInvoiceId; SalesActual created at most once per deal.
 */
export async function createInvoiceFromWonDeal(
  tx: Tx,
  params: {
    organizationId: string;
    dealId: string;
    recordedByUserId: string;
    /** When false, skip SalesActual even if none exists. */
    createSalesActual?: boolean;
  },
): Promise<DealToInvoiceResult> {
  const deal = await tx.salesDeal.findFirst({
    where: { id: params.dealId, organizationId: params.organizationId },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!deal) throw Object.assign(new Error('DEAL_NOT_FOUND'), { code: 'DEAL_NOT_FOUND' });
  if (deal.stage !== 'won') {
    throw Object.assign(new Error('DEAL_NOT_WON'), { code: 'DEAL_NOT_WON' });
  }

  if (deal.accountsInvoiceId) {
    const existing = await tx.accountsInvoice.findFirst({
      where: { id: deal.accountsInvoiceId, organizationId: params.organizationId },
      select: { id: true, invoiceNumber: true },
    });
    if (existing) {
      const actual = await tx.salesActual.findFirst({
        where: { organizationId: params.organizationId, salesDealId: deal.id },
        select: { id: true },
      });
      return {
        dealId: deal.id,
        accountsInvoiceId: existing.id,
        invoiceNumber: existing.invoiceNumber,
        salesActualId: actual?.id ?? null,
        alreadyLinked: true,
      };
    }
  }

  const client = await resolveAccountsClient(tx, params.organizationId, deal.accountsClientId);
  if (!client) {
    throw Object.assign(new Error('CLIENT_REQUIRED'), { code: 'CLIENT_REQUIRED' });
  }

  const issueDate = deal.closedAt ?? new Date();
  const dueDate = dueDateFromIssue(issueDate, client.paymentTerms);
  const dealValue = Number(deal.value);

  const lines: BillingLineDraft[] =
    deal.lineItems.length > 0
      ? deal.lineItems.map((li) => ({
          item: li.description,
          description: li.isRecurring
            ? `Recurring (${li.termMonths ?? 1} mo)`
            : 'Sales deal line',
          amountExVat: lineItemExtendedAmount({
            quantity: Number(li.quantity),
            unitPrice: Number(li.unitPrice),
            discountPct: Number(li.discountPct),
            isRecurring: li.isRecurring,
            termMonths: li.termMonths,
          }),
        }))
      : [
          {
            item: deal.name,
            description: 'Sales deal — closed won',
            amountExVat: dealValue,
          },
        ];

  const invoice = await createDraftAccountsInvoice(tx, {
    organizationId: params.organizationId,
    clientId: client.id,
    issueDate,
    dueDate,
    currency: deal.currency,
    notes: `Closed-won deal: ${deal.name}`,
    lines,
  });

  await tx.salesDeal.update({
    where: { id: deal.id },
    data: { accountsInvoiceId: invoice.id },
  });

  let salesActualId: string | null = null;
  if (params.createSalesActual !== false) {
    salesActualId = await ensureSalesActualForDeal(tx, {
      organizationId: params.organizationId,
      dealId: deal.id,
      ownerEmployeeId: deal.ownerEmployeeId,
      amount: dealValue,
      currency: deal.currency,
      closedAt: deal.closedAt,
      accountsInvoiceId: invoice.id,
      recordedByUserId: params.recordedByUserId,
      notes: `Auto-created from closed-won deal: ${deal.name}`,
      source: 'finance_invoice',
    });
  }

  const { periodStart, periodEnd } = currentMonthPeriod(deal.closedAt ?? new Date());
  await syncRepPeriodMetric(tx, {
    organizationId: params.organizationId,
    employeeId: deal.ownerEmployeeId,
    periodStart,
    periodEnd,
    currency: deal.currency,
  });

  return {
    dealId: deal.id,
    accountsInvoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    salesActualId,
  };
}

export async function ensureSalesActualForDeal(
  tx: Tx,
  params: {
    organizationId: string;
    dealId: string;
    ownerEmployeeId: string;
    amount: number;
    currency: string;
    closedAt: Date | null;
    accountsInvoiceId?: string | null;
    recordedByUserId: string;
    notes: string;
    source: 'deal' | 'finance_invoice';
  },
): Promise<string> {
  const existing = await tx.salesActual.findFirst({
    where: {
      organizationId: params.organizationId,
      salesDealId: params.dealId,
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const { periodStart, periodEnd } = currentMonthPeriod(params.closedAt ?? new Date());
  const actual = await tx.salesActual.create({
    data: {
      organizationId: params.organizationId,
      employeeId: params.ownerEmployeeId,
      periodStart,
      periodEnd,
      amount: params.amount,
      currency: params.currency,
      source: params.source,
      salesDealId: params.dealId,
      accountsInvoiceId: params.accountsInvoiceId ?? null,
      notes: params.notes,
      recordedByUserId: params.recordedByUserId,
    },
  });
  return actual.id;
}
