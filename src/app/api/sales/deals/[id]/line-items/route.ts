import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { lineItemExtendedAmount, requireAccessibleDeal, SalesAccessError } from '@/lib/sales/access';
import { mapLineItemToJson } from '@/lib/sales/api-helpers';
import { resolveLineUnitPrice } from '@/lib/sales/default-price-book';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id: dealId } = await params;
    try {
      const items = await ctx.run(async (tx) => {
        await requireAccessibleDeal(tx, ctx.staff, ctx.organizationId, dealId);
        return tx.salesDealLineItem.findMany({
          where: { dealId, organizationId: ctx.organizationId },
          orderBy: { sortOrder: 'asc' },
          include: { product: { select: { id: true, name: true } } },
        });
      });
      return NextResponse.json({ lineItems: items.map(mapLineItemToJson) });
    } catch (error) {
      if (error instanceof SalesAccessError) {
        return NextResponse.json({ error: error.message }, { status: error.code === 'FORBIDDEN' ? 403 : 404 });
      }
      await reportApiError({
        route: 'GET /api/sales/deals/[id]/line-items',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load line items.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id: dealId } = await params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const quantity = body.quantity != null ? Number(body.quantity) : 1;
    const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    const productId =
      typeof body.productId === 'string' ? body.productId.trim() || null : null;
    const priceBookId =
      typeof body.priceBookId === 'string' ? body.priceBookId.trim() || null : null;
    const rawUnit = body.unitPrice != null ? Number(body.unitPrice) : null;
    const explicitUnit =
      rawUnit != null && Number.isFinite(rawUnit) && rawUnit >= 0 ? rawUnit : null;

    if (!description && !productId) {
      return NextResponse.json(
        { error: 'description or productId is required.' },
        { status: 400 },
      );
    }

    try {
      const result = await ctx.run(async (tx) => {
        await requireAccessibleDeal(tx, ctx.staff, ctx.organizationId, dealId);
        const deal = await tx.salesDeal.findFirst({
          where: { id: dealId, ...ctx.where() },
          include: { lineItems: true },
        });
        if (!deal) return null;

        let product: { id: string; name: string; unitPrice: unknown } | null = null;
        if (productId) {
          product = await tx.salesProduct.findFirst({
            where: { id: productId, organizationId: ctx.organizationId },
            select: { id: true, name: true, unitPrice: true },
          });
          if (!product) {
            throw Object.assign(new Error('PRODUCT_NOT_FOUND'), { code: 'PRODUCT_NOT_FOUND' });
          }
        }

        const lineDescription = description || product?.name || '';
        if (!lineDescription) {
          throw Object.assign(new Error('NO_DESCRIPTION'), { code: 'NO_DESCRIPTION' });
        }

        const priced = await resolveLineUnitPrice(tx, ctx.organizationId, {
          productId: product?.id ?? null,
          quantity: qty,
          priceBookId,
          unitPrice: explicitUnit,
          priceOverridden: body.priceOverridden === true,
          catalogUnitPrice: product ? Number(product.unitPrice) : null,
        });

        const created = await tx.salesDealLineItem.create({
          data: {
            organizationId: ctx.organizationId,
            dealId,
            description: lineDescription,
            quantity: qty,
            unitPrice: priced.unitPrice,
            priceOverridden: priced.priceOverridden,
            discountPct:
              body.discountPct != null && Number.isFinite(Number(body.discountPct))
                ? Number(body.discountPct)
                : 0,
            isRecurring: body.isRecurring === true,
            termMonths:
              body.termMonths != null && Number.isFinite(Number(body.termMonths))
                ? Math.round(Number(body.termMonths))
                : null,
            productId: product?.id ?? null,
            sortOrder: deal.lineItems.length,
          },
          include: { product: { select: { id: true, name: true } } },
        });

        const all = [...deal.lineItems, created];
        const total = all.reduce(
          (s, i) =>
            s +
            lineItemExtendedAmount({
              quantity: Number(i.quantity),
              unitPrice: Number(i.unitPrice),
              discountPct: Number(i.discountPct),
              isRecurring: i.isRecurring,
              termMonths: i.termMonths,
            }),
          0,
        );

        if (body.syncDealValue === true && total > 0) {
          await tx.salesDeal.update({
            where: { id: dealId },
            data: { value: total },
          });
        }

        return { item: created, dealValue: total };
      });

      if (!result) {
        return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });
      }

      return NextResponse.json(
        { lineItem: mapLineItemToJson(result.item), dealValue: result.dealValue },
        { status: 201 },
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'PRODUCT_NOT_FOUND') {
        return NextResponse.json({ error: 'Product not found.' }, { status: 400 });
      }
      if (code === 'NO_DESCRIPTION') {
        return NextResponse.json(
          { error: 'description or productId is required.' },
          { status: 400 },
        );
      }
      if (error instanceof SalesAccessError) {
        return NextResponse.json({ error: error.message }, { status: error.code === 'FORBIDDEN' ? 403 : 404 });
      }
      await reportApiError({
        route: 'POST /api/sales/deals/[id]/line-items',
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

    const { id: dealId } = await params;
    const lineItemId = request.nextUrl.searchParams.get('lineItemId')?.trim();
    if (!lineItemId) {
      return NextResponse.json({ error: 'lineItemId is required.' }, { status: 400 });
    }

    try {
      await ctx.run(async (tx) => {
        await requireAccessibleDeal(tx, ctx.staff, ctx.organizationId, dealId);
        await tx.salesDealLineItem.deleteMany({
          where: { id: lineItemId, dealId, organizationId: ctx.organizationId },
        });
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof SalesAccessError) {
        return NextResponse.json({ error: error.message }, { status: error.code === 'FORBIDDEN' ? 403 : 404 });
      }
      await reportApiError({
        route: 'DELETE /api/sales/deals/[id]/line-items',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete line item.' }, { status: 500 });
    }
  });
}
