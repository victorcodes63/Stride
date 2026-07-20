import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { SALES_QUOTE_STATUSES } from '@/lib/sales/schema';
import { withTenant } from '@/lib/tenant-api';
import { computeQuoteTotals } from '../route';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const quoteInclude = {
  accountsClient: { select: { id: true, name: true, currency: true } },
  deal: { select: { id: true, name: true, stage: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  lineItems: {
    orderBy: { sortOrder: 'asc' as const },
    include: { product: { select: { id: true, name: true, sku: true } } },
  },
} as const;

type QuoteWithRelations = {
  id: string;
  quoteNumber: number;
  title: string;
  status: string;
  currency: string;
  dealId: string | null;
  accountsClientId: string | null;
  accountsInvoiceId: string | null;
  issueDate: Date;
  validUntil: Date | null;
  discountPct: unknown;
  taxRateBps: number;
  notes: string | null;
  terms: string | null;
  sentAt: Date | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  accountsClient: { id: string; name: string; currency: string } | null;
  deal: { id: string; name: string; stage: string } | null;
  createdBy: { id: string; firstName: string; lastName: string } | null;
  lineItems: Array<{
    id: string;
    productId: string | null;
    description: string;
    quantity: unknown;
    unitPrice: unknown;
    discountPct: unknown;
    isRecurring: boolean;
    termMonths: number | null;
    sortOrder: number;
    product: { id: string; name: string; sku: string | null } | null;
  }>;
};

function mapQuote(quote: QuoteWithRelations) {
  const lineItems = quote.lineItems.map((li) => ({
    id: li.id,
    productId: li.productId,
    product: li.product,
    description: li.description,
    quantity: Number(li.quantity),
    unitPrice: Number(li.unitPrice),
    discountPct: Number(li.discountPct),
    isRecurring: li.isRecurring,
    termMonths: li.termMonths,
    sortOrder: li.sortOrder,
  }));
  const totals = computeQuoteTotals(Number(quote.discountPct), quote.taxRateBps, quote.lineItems);
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    title: quote.title,
    status: quote.status,
    currency: quote.currency,
    dealId: quote.dealId,
    deal: quote.deal,
    accountsClientId: quote.accountsClientId,
    accountsClient: quote.accountsClient,
    accountsInvoiceId: quote.accountsInvoiceId,
    issueDate: quote.issueDate.toISOString(),
    validUntil: quote.validUntil?.toISOString() ?? null,
    discountPct: Number(quote.discountPct),
    taxRateBps: quote.taxRateBps,
    notes: quote.notes,
    terms: quote.terms,
    sentAt: quote.sentAt?.toISOString() ?? null,
    acceptedAt: quote.acceptedAt?.toISOString() ?? null,
    createdBy: quote.createdBy
      ? { id: quote.createdBy.id, name: `${quote.createdBy.firstName} ${quote.createdBy.lastName}`.trim() }
      : null,
    lineItems,
    totals,
    createdAt: quote.createdAt.toISOString(),
    updatedAt: quote.updatedAt.toISOString(),
  };
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Allowed status transitions for a quote lifecycle. */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent', 'expired'],
  sent: ['accepted', 'rejected', 'expired', 'draft'],
  accepted: ['sent'],
  rejected: ['draft', 'sent'],
  expired: ['draft', 'sent'],
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;
    try {
      const quote = await ctx.run((tx) =>
        tx.salesQuote.findFirst({
          where: { id, organizationId: ctx.organizationId },
          include: quoteInclude,
        }),
      );
      if (!quote) {
        return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
      }
      return NextResponse.json({ quote: mapQuote(quote as QuoteWithRelations) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/quotes/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load quote.' }, { status: 500 });
    }
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const nextStatus =
      typeof body.status === 'string' && SALES_QUOTE_STATUSES.includes(body.status as never)
        ? (body.status as string)
        : null;

    try {
      const result = await ctx.run(async (tx) => {
        const existing = await tx.salesQuote.findFirst({
          where: { id, organizationId: ctx.organizationId },
        });
        if (!existing) return { status: 'not_found' as const };

        const data: Prisma.SalesQuoteUncheckedUpdateInput = {};

        if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
        if ('accountsClientId' in body)
          data.accountsClientId =
            typeof body.accountsClientId === 'string'
              ? body.accountsClientId.trim() || null
              : null;
        if ('dealId' in body)
          data.dealId = typeof body.dealId === 'string' ? body.dealId.trim() || null : null;
        if (typeof body.currency === 'string' && body.currency.trim())
          data.currency = body.currency.trim();
        if ('discountPct' in body) {
          const p = Number(body.discountPct);
          if (Number.isFinite(p) && p >= 0) data.discountPct = Math.min(100, p);
        }
        if ('taxRateBps' in body) {
          const t = Number(body.taxRateBps);
          if (Number.isFinite(t) && t >= 0) data.taxRateBps = Math.round(t);
        }
        if ('notes' in body)
          data.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
        if ('terms' in body)
          data.terms = typeof body.terms === 'string' ? body.terms.trim() || null : null;
        if ('issueDate' in body) {
          const d = parseDate(body.issueDate);
          if (d) data.issueDate = d;
        }
        if ('validUntil' in body) data.validUntil = parseDate(body.validUntil);

        if (nextStatus && nextStatus !== existing.status) {
          const allowed = STATUS_TRANSITIONS[existing.status] ?? [];
          if (!allowed.includes(nextStatus)) {
            return { status: 'invalid_transition' as const, from: existing.status, to: nextStatus };
          }
          data.status = nextStatus as Prisma.SalesQuoteUncheckedUpdateInput['status'];
          const now = new Date();
          if (nextStatus === 'sent' && !existing.sentAt) data.sentAt = now;
          if (nextStatus === 'accepted') {
            data.acceptedAt = now;
            if (!existing.sentAt) data.sentAt = now;
          }
          // Re-opening a quote clears the accepted timestamp.
          if (nextStatus === 'draft') data.acceptedAt = null;
        }

        const updated = await tx.salesQuote.update({
          where: { id },
          data,
          include: quoteInclude,
        });
        return { status: 'ok' as const, quote: updated as QuoteWithRelations };
      });

      if (result.status === 'not_found') {
        return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
      }
      if (result.status === 'invalid_transition') {
        return NextResponse.json(
          { error: `Cannot move quote from ${result.from} to ${result.to}.` },
          { status: 400 },
        );
      }
      return NextResponse.json({ quote: mapQuote(result.quote) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/sales/quotes/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update quote.' }, { status: 500 });
    }
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;
    try {
      const deleted = await ctx.run(async (tx) => {
        const existing = await tx.salesQuote.findFirst({
          where: { id, organizationId: ctx.organizationId },
        });
        if (!existing) return null;
        await tx.salesQuote.delete({ where: { id } });
        return existing;
      });
      if (!deleted) {
        return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true, id });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/sales/quotes/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete quote.' }, { status: 500 });
    }
  });
}
