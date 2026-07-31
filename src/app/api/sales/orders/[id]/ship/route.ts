import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { shipSalesOrder } from '@/lib/sales/order-lifecycle';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';
type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;
    const { id } = await params;
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      /* empty */
    }
    try {
      const order = await ctx.run((tx) =>
        shipSalesOrder(tx, {
          organizationId: ctx.organizationId,
          orderId: id,
          fleetOrderId: typeof body.fleetOrderId === 'string' ? body.fleetOrderId : null,
          pickupLocation: typeof body.pickupLocation === 'string' ? body.pickupLocation : undefined,
          deliveryLocation:
            typeof body.deliveryLocation === 'string' ? body.deliveryLocation : undefined,
          outsourcingClientId:
            typeof body.outsourcingClientId === 'string' ? body.outsourcingClientId : undefined,
          fleetCustomerId: typeof body.fleetCustomerId === 'string' ? body.fleetCustomerId : undefined,
        }),
      );
      return NextResponse.json({ order: { id: order.id, status: order.status } });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'ORDER_NOT_FOUND') {
        return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
      }
      if (err.code === 'ORDER_NOT_CONFIRMED') {
        return NextResponse.json({ error: 'Confirm the order before shipping.' }, { status: 400 });
      }
      await reportApiError({
        route: 'POST /api/sales/orders/[id]/ship',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to ship order.' }, { status: 500 });
    }
  });
}
