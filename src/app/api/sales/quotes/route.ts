import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { lineItemExtendedAmount } from '@/lib/sales/access';
import { resolveLineUnitPrice } from '@/lib/sales/default-price-book';
import { SALES_QUOTE_STATUSES } from '@/lib/sales/schema';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

const round2 = (n: number) => Math.round(n * 100) / 100;

type QuoteLineItem = {
  quantity: Prisma.Decimal | number | unknown;
  unitPrice: Prisma.Decimal | number | unknown;
  discountPct: Prisma.Decimal | number | unknown;
  isRecurring: boolean;
  termMonths: number | null;
};

/** Quote monetary rollup: line subtotal → header discount → VAT → grand total. */
export function computeQuoteTotals(
  discountPct: number,
  taxRateBps: number,
  lineItems: QuoteLineItem[],
) {
  const subtotal = round2(
    lineItems.reduce(
      (sum, li) =>
        sum +
        lineItemExtendedAmount({
          quantity: Number(li.quantity),
          unitPrice: Number(li.unitPrice),
          discountPct: Number(li.discountPct),
          isRecurring: li.isRecurring,
          termMonths: li.termMonths,
        }),
      0,
    ),
  );
  const pct = Math.min(100, Math.max(0, discountPct));
  const discountAmount = round2((subtotal * pct) / 100);
  const netAmount = round2(subtotal - discountAmount);
  const taxAmount = round2((netAmount * Math.max(0, taxRateBps)) / 10000);
  const total = round2(netAmount + taxAmount);
  return { subtotal, discountAmount, netAmount, taxAmount, total };
}

/** Parse a YYYY-MM-DD (or ISO) string into a UTC Date, else null. */
function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const params = request.nextUrl.searchParams;
    const status = params.get('status')?.trim() || undefined;
    const q = params.get('q')?.trim() || undefined;

    try {
      const quotes = await ctx.run((tx) =>
        tx.salesQuote.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...(status && SALES_QUOTE_STATUSES.includes(status as never)
              ? { status: status as never }
              : {}),
            ...(q
              ? {
                  OR: [
                    { title: { contains: q, mode: 'insensitive' } },
                    { notes: { contains: q, mode: 'insensitive' } },
                    { accountsClient: { name: { contains: q, mode: 'insensitive' } } },
                  ],
                }
              : {}),
          },
          include: {
            accountsClient: { select: { id: true, name: true, currency: true } },
            deal: { select: { id: true, name: true } },
            lineItems: {
              select: {
                quantity: true,
                unitPrice: true,
                discountPct: true,
                isRecurring: true,
                termMonths: true,
              },
            },
          },
          orderBy: [{ quoteNumber: 'desc' }],
          take: 300,
        }),
      );

      return NextResponse.json({
        quotes: quotes.map((quote) => {
          const totals = computeQuoteTotals(
            Number(quote.discountPct),
            quote.taxRateBps,
            quote.lineItems,
          );
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
            sentAt: quote.sentAt?.toISOString() ?? null,
            acceptedAt: quote.acceptedAt?.toISOString() ?? null,
            lineItemCount: quote.lineItems.length,
            totals,
            createdAt: quote.createdAt.toISOString(),
            updatedAt: quote.updatedAt.toISOString(),
          };
        }),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/quotes',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load quotes.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'title is required.' }, { status: 400 });
    }

    const accountsClientId =
      typeof body.accountsClientId === 'string' ? body.accountsClientId.trim() || null : null;
    const dealId = typeof body.dealId === 'string' ? body.dealId.trim() || null : null;
    const currency =
      typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim() : 'KES';
    const rawDiscount = Number(body.discountPct);
    const discountPct =
      Number.isFinite(rawDiscount) && rawDiscount >= 0 ? Math.min(100, rawDiscount) : 0;
    const rawTax = Number(body.taxRateBps);
    const taxRateBps = Number.isFinite(rawTax) && rawTax >= 0 ? Math.round(rawTax) : 1600;
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
    const terms = typeof body.terms === 'string' ? body.terms.trim() || null : null;
    const issueDate = parseDate(body.issueDate) ?? new Date();
    const validUntil = parseDate(body.validUntil);

    const rawLines = Array.isArray(body.lineItems) ? body.lineItems : [];

    try {
      const quote = await ctx.run(async (tx) => {
        // Serialize quote-number assignment per org to avoid duplicate numbers.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.organizationId}), 736100);`;
        const agg = await tx.salesQuote.aggregate({
          where: { organizationId: ctx.organizationId },
          _max: { quoteNumber: true },
        });
        const quoteNumber = (agg._max.quoteNumber ?? 0) + 1;

        // Resolve any product prefills for lines that reference a product.
        const productIds = rawLines
          .map((l) => (l && typeof l === 'object' ? (l as Record<string, unknown>).productId : null))
          .filter((v): v is string => typeof v === 'string' && v.length > 0);
        const products = productIds.length
          ? await tx.salesProduct.findMany({
              where: { id: { in: productIds }, organizationId: ctx.organizationId },
            })
          : [];
        const productMap = new Map(products.map((p) => [p.id, p]));

        const lineData: Array<{
          organizationId: string;
          productId: string | null;
          description: string;
          quantity: number;
          unitPrice: number;
          priceOverridden: boolean;
          discountPct: number;
          isRecurring: boolean;
          termMonths: number | null;
          sortOrder: number;
        }> = [];

        for (let index = 0; index < rawLines.length; index += 1) {
          const raw = rawLines[index];
          if (!raw || typeof raw !== 'object') continue;
          const l = raw as Record<string, unknown>;
          const productId =
            typeof l.productId === 'string' && productMap.has(l.productId) ? l.productId : null;
          const product = productId ? productMap.get(productId)! : null;
          const description =
            (typeof l.description === 'string' && l.description.trim()) || product?.name || '';
          if (!description) continue;
          const qty = Number(l.quantity);
          const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
          const rawUnit = l.unitPrice != null ? Number(l.unitPrice) : null;
          const explicitUnit =
            rawUnit != null && Number.isFinite(rawUnit) && rawUnit >= 0 ? rawUnit : null;
          const priceBookId =
            typeof l.priceBookId === 'string' ? l.priceBookId.trim() || null : null;
          const priced = await resolveLineUnitPrice(tx, ctx.organizationId, {
            productId,
            quantity,
            priceBookId,
            unitPrice: explicitUnit,
            priceOverridden: l.priceOverridden === true,
            catalogUnitPrice: product ? Number(product.unitPrice) : null,
          });
          const rawDisc = Number(l.discountPct);
          const lineDiscount =
            Number.isFinite(rawDisc) && rawDisc >= 0 ? Math.min(100, rawDisc) : 0;
          const isRecurring =
            l.isRecurring === true ||
            (l.isRecurring === undefined && product?.isRecurring === true);
          const rawTerm = Number(l.termMonths);
          const termMonths =
            isRecurring && Number.isFinite(rawTerm) && rawTerm > 0
              ? Math.round(rawTerm)
              : isRecurring
                ? product?.defaultTermMonths ?? null
                : null;
          lineData.push({
            organizationId: ctx.organizationId,
            productId,
            description,
            quantity,
            unitPrice: priced.unitPrice,
            priceOverridden: priced.priceOverridden,
            discountPct: lineDiscount,
            isRecurring,
            termMonths,
            sortOrder: index,
          });
        }

        return tx.salesQuote.create({
          data: {
            organizationId: ctx.organizationId,
            quoteNumber,
            title,
            accountsClientId,
            dealId,
            currency,
            discountPct,
            taxRateBps,
            notes,
            terms,
            issueDate,
            validUntil,
            status: 'draft',
            createdByUserId: ctx.staff.id,
            ...(lineData.length ? { lineItems: { create: lineData } } : {}),
          },
          select: { id: true, quoteNumber: true },
        });
      });

      return NextResponse.json(
        { quote: { id: quote.id, quoteNumber: quote.quoteNumber } },
        { status: 201 },
      );
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/quotes',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create quote.' }, { status: 500 });
    }
  });
}
