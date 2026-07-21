import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { canViewSalesMargin } from '@/lib/sales/access';
import { resolveLineUnitPrice } from '@/lib/sales/default-price-book';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id: quoteId } = await params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const includeCost = await canViewSalesMargin(ctx.staff);

    try {
      const result = await ctx.run(async (tx) => {
        const quote = await tx.salesQuote.findFirst({
          where: { id: quoteId, organizationId: ctx.organizationId },
          select: { id: true, supersededById: true },
        });
        if (!quote) return { status: 'not_found' as const };
        if (quote.supersededById) return { status: 'read_only' as const };

        let product: {
          id: string;
          name: string;
          unitPrice: unknown;
          costPrice: unknown;
          isRecurring: boolean;
          defaultTermMonths: number | null;
          sku: string | null;
        } | null = null;
        const productId =
          typeof body.productId === 'string' && body.productId.trim() ? body.productId.trim() : null;
        if (productId) {
          product = await tx.salesProduct.findFirst({
            where: { id: productId, organizationId: ctx.organizationId },
          });
          if (!product) return { status: 'bad_product' as const };
        }

        const description =
          (typeof body.description === 'string' && body.description.trim()) || product?.name || '';
        if (!description) return { status: 'no_description' as const };

        const qty = Number(body.quantity);
        const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
        const rawUnit = body.unitPrice != null ? Number(body.unitPrice) : null;
        const explicitUnit =
          rawUnit != null && Number.isFinite(rawUnit) && rawUnit >= 0 ? rawUnit : null;
        const priceBookId =
          typeof body.priceBookId === 'string' ? body.priceBookId.trim() || null : null;

        const priced = await resolveLineUnitPrice(tx, ctx.organizationId, {
          productId: product?.id ?? null,
          quantity,
          priceBookId,
          unitPrice: explicitUnit,
          priceOverridden: body.priceOverridden === true,
          catalogUnitPrice: product ? Number(product.unitPrice) : null,
        });

        const rawDisc = Number(body.discountPct);
        const discountPct = Number.isFinite(rawDisc) && rawDisc >= 0 ? Math.min(100, rawDisc) : 0;
        const isRecurring =
          body.isRecurring === true ||
          (body.isRecurring === undefined && product?.isRecurring === true);
        const rawTerm = Number(body.termMonths);
        const termMonths =
          isRecurring && Number.isFinite(rawTerm) && rawTerm > 0
            ? Math.round(rawTerm)
            : isRecurring
              ? product?.defaultTermMonths ?? null
              : null;

        const maxSort = await tx.salesQuoteLineItem.aggregate({
          where: { quoteId, organizationId: ctx.organizationId },
          _max: { sortOrder: true },
        });
        const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

        const line = await tx.salesQuoteLineItem.create({
          data: {
            organizationId: ctx.organizationId,
            quoteId,
            productId: product?.id ?? null,
            description,
            quantity,
            unitPrice: priced.unitPrice,
            priceOverridden: priced.priceOverridden,
            discountPct,
            isRecurring,
            termMonths,
            sortOrder,
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                ...(includeCost ? { costPrice: true } : {}),
              },
            },
          },
        });
        await tx.salesQuote.update({ where: { id: quoteId }, data: { updatedAt: new Date() } });
        return { status: 'ok' as const, line, listPrice: priced.listPrice };
      });

      if (result.status === 'not_found') {
        return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
      }
      if (result.status === 'read_only') {
        return NextResponse.json(
          { error: 'This quote version is superseded and read-only.' },
          { status: 409 },
        );
      }
      if (result.status === 'bad_product') {
        return NextResponse.json({ error: 'Product not found.' }, { status: 400 });
      }
      if (result.status === 'no_description') {
        return NextResponse.json(
          { error: 'A description or product is required.' },
          { status: 400 },
        );
      }

      const { line, listPrice } = result;
      const unitPrice = Number(line.unitPrice);
      const costPrice =
        includeCost &&
        line.product &&
        'costPrice' in line.product &&
        line.product.costPrice != null
          ? Number(line.product.costPrice)
          : null;

      return NextResponse.json(
        {
          lineItem: {
            id: line.id,
            productId: line.productId,
            product: line.product
              ? {
                  id: line.product.id,
                  name: line.product.name,
                  sku: line.product.sku,
                }
              : null,
            description: line.description,
            quantity: Number(line.quantity),
            unitPrice,
            discountPct: Number(line.discountPct),
            priceOverridden: line.priceOverridden,
            listPrice,
            isRecurring: line.isRecurring,
            termMonths: line.termMonths,
            sortOrder: line.sortOrder,
            ...(includeCost
              ? {
                  costPrice,
                  margin:
                    costPrice != null
                      ? Math.round((unitPrice - costPrice) * 100) / 100
                      : null,
                }
              : {}),
          },
        },
        { status: 201 },
      );
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/quotes/[id]/line-items',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to add line item.' }, { status: 500 });
    }
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id: quoteId } = await params;
    const lineItemId = request.nextUrl.searchParams.get('lineItemId')?.trim();
    if (!lineItemId) {
      return NextResponse.json({ error: 'lineItemId is required.' }, { status: 400 });
    }

    try {
      const deleted = await ctx.run(async (tx) => {
        const quote = await tx.salesQuote.findFirst({
          where: { id: quoteId, organizationId: ctx.organizationId },
          select: { id: true, supersededById: true },
        });
        if (!quote) return { kind: 'quote_missing' as const };
        if (quote.supersededById) return { kind: 'read_only' as const };

        const existing = await tx.salesQuoteLineItem.findFirst({
          where: { id: lineItemId, quoteId, organizationId: ctx.organizationId },
        });
        if (!existing) return { kind: 'not_found' as const };
        await tx.salesQuoteLineItem.delete({ where: { id: lineItemId } });
        await tx.salesQuote.update({ where: { id: quoteId }, data: { updatedAt: new Date() } });
        return { kind: 'ok' as const };
      });
      if (deleted.kind === 'quote_missing') {
        return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
      }
      if (deleted.kind === 'read_only') {
        return NextResponse.json(
          { error: 'This quote version is superseded and read-only.' },
          { status: 409 },
        );
      }
      if (deleted.kind === 'not_found') {
        return NextResponse.json({ error: 'Line item not found.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true, id: lineItemId });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/sales/quotes/[id]/line-items',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to remove line item.' }, { status: 500 });
    }
  });
}
