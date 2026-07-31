import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { invoiceSalesOrder } from '@/lib/sales/order-lifecycle';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';
type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;
    const { id } = await params;
    try {
      const order = await ctx.run((tx) =>
        invoiceSalesOrder(tx, { organizationId: ctx.organizationId, orderId: id }),
      );
      return NextResponse.json({
        order: {
          id: order.id,
          status: order.status,
          accountsInvoiceId: order.accountsInvoiceId,
        },
      });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'ORDER_NOT_FOUND') {
        return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
      }
      if (err.code === 'ORDER_NOT_SHIPPED') {
        return NextResponse.json({ error: 'Ship the order before invoicing.' }, { status: 400 });
      }
      if (err.code === 'INVOICE_EXISTS') {
        return NextResponse.json({ error: 'Order already invoiced.' }, { status: 409 });
      }
      await reportApiError({
        route: 'POST /api/sales/orders/[id]/invoice',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to invoice order.' }, { status: 500 });
    }
  });
}
