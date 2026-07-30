import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { returnSalesOrderLines } from '@/lib/sales/order-lifecycle';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';
type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const lines = Array.isArray(body.lines) ? (body.lines as Array<Record<string, unknown>>) : [];
    if (lines.length === 0) {
      return NextResponse.json({ error: 'lines required.' }, { status: 400 });
    }
    try {
      const ret = await ctx.run((tx) =>
        returnSalesOrderLines(tx, {
          organizationId: ctx.organizationId,
          orderId: id,
          reason: typeof body.reason === 'string' ? body.reason : undefined,
          userId: ctx.staff.id,
          lines: lines.map((l) => ({
            orderLineId: String(l.orderLineId),
            qtyReturned: Number(l.qtyReturned) || 0,
          })),
        }),
      );
      return NextResponse.json({ return: { id: ret.id, status: ret.status } }, { status: 201 });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'ORDER_NOT_FOUND') {
        return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
      }
      if (err.code === 'ORDER_NOT_RETURNABLE') {
        return NextResponse.json({ error: 'Order cannot accept returns yet.' }, { status: 400 });
      }
      await reportApiError({
        route: 'POST /api/sales/orders/[id]/returns',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to process return.' }, { status: 500 });
    }
  });
}
