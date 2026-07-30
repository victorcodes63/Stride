import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { confirmSalesOrder } from '@/lib/sales/order-lifecycle';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';
type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;
    const { id } = await params;
    let acknowledgeWarnings = false;
    try {
      const body = await request.json();
      acknowledgeWarnings = body?.acknowledgeWarnings === true;
    } catch {
      /* empty */
    }
    try {
      const order = await ctx.run((tx) =>
        confirmSalesOrder(tx, {
          organizationId: ctx.organizationId,
          orderId: id,
          acknowledgeWarnings,
        }),
      );
      return NextResponse.json({ order: { id: order.id, status: order.status } });
    } catch (error: unknown) {
      const err = error as { code?: string; warnings?: string[] };
      if (err.code === 'WARNINGS') {
        return NextResponse.json(
          { error: 'Confirmation blocked by warnings.', warnings: err.warnings ?? [], code: 'WARNINGS' },
          { status: 409 },
        );
      }
      if (err.code === 'ORDER_NOT_FOUND') {
        return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
      }
      if (err.code === 'WAREHOUSE_REQUIRED') {
        return NextResponse.json({ error: 'Select a warehouse before confirming.' }, { status: 400 });
      }
      await reportApiError({
        route: 'POST /api/sales/orders/[id]/confirm',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to confirm order.' }, { status: 500 });
    }
  });
}
