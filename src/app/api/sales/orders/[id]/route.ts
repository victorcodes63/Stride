import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;
    const { id } = await params;
    try {
      const order = await ctx.run((tx) =>
        tx.salesOrder.findFirst({
          where: { id, organizationId: ctx.organizationId },
          include: {
            accountsClient: { select: { id: true, name: true, creditLimit: true, creditHold: true } },
            lineItems: { orderBy: { sortOrder: 'asc' } },
            facilitySite: { select: { id: true, name: true, siteCode: true } },
          },
        }),
      );
      if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
      return NextResponse.json({
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          currency: order.currency,
          notes: order.notes,
          accountsClientId: order.accountsClientId,
          accountsClient: order.accountsClient,
          facilitySiteId: order.facilitySiteId,
          facilitySite: order.facilitySite,
          dealId: order.dealId,
          quoteId: order.quoteId,
          fleetOrderId: order.fleetOrderId,
          accountsInvoiceId: order.accountsInvoiceId,
          publicStatusToken: order.publicStatusToken,
          confirmedAt: order.confirmedAt?.toISOString() ?? null,
          shippedAt: order.shippedAt?.toISOString() ?? null,
          invoicedAt: order.invoicedAt?.toISOString() ?? null,
          createdAt: order.createdAt.toISOString(),
          lineItems: order.lineItems.map((l) => ({
            id: l.id,
            productId: l.productId,
            description: l.description,
            uom: l.uom,
            qtyOrdered: Number(l.qtyOrdered),
            qtyReserved: Number(l.qtyReserved),
            qtyShipped: Number(l.qtyShipped),
            qtyInvoiced: Number(l.qtyInvoiced),
            unitPrice: Number(l.unitPrice),
            discountPct: Number(l.discountPct),
          })),
        },
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/orders/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load order.' }, { status: 500 });
    }
  });
}
