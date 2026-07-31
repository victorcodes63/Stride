import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { receiveStock } from '@/lib/inventory/atp';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('inventory', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const facilitySiteId = typeof body.facilitySiteId === 'string' ? body.facilitySiteId : '';
    const productId = typeof body.productId === 'string' ? body.productId : '';
    const qtyBase = Number(body.qtyBase);
    if (!facilitySiteId || !productId || !Number.isFinite(qtyBase) || qtyBase <= 0) {
      return NextResponse.json({ error: 'facilitySiteId, productId, qtyBase (>0) required.' }, { status: 400 });
    }
    try {
      await ctx.run((tx) =>
        receiveStock(tx, {
          organizationId: ctx.organizationId,
          facilitySiteId,
          productId,
          qtyBase,
          userId: ctx.staff.id,
          notes: typeof body.notes === 'string' ? body.notes : null,
        }),
      );
      return NextResponse.json({ ok: true }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/inventory/receipts',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to receive stock.' }, { status: 500 });
    }
  });
}
