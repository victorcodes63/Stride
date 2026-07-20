import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { lineItemExtendedAmount, requireAccessibleDeal, SalesAccessError } from '@/lib/sales/access';
import { mapLineItemToJson } from '@/lib/sales/api-helpers';
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
    const unitPrice = Number(body.unitPrice);
    const quantity = body.quantity != null ? Number(body.quantity) : 1;
    if (!description || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return NextResponse.json(
        { error: 'description and non-negative unitPrice are required.' },
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

        const created = await tx.salesDealLineItem.create({
          data: {
            organizationId: ctx.organizationId,
            dealId,
            description,
            quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
            unitPrice,
            discountPct:
              body.discountPct != null && Number.isFinite(Number(body.discountPct))
                ? Number(body.discountPct)
                : 0,
            isRecurring: body.isRecurring === true,
            termMonths:
              body.termMonths != null && Number.isFinite(Number(body.termMonths))
                ? Math.round(Number(body.termMonths))
                : null,
            productId:
              typeof body.productId === 'string' ? body.productId.trim() || null : null,
            sortOrder: deal.lineItems.length,
          },
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
