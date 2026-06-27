import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { createLpoFromPurchaseRequest } from '@/lib/procurement/lpo';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    try {
      const orders = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

        return tx.purchaseOrder.findMany({
          where: {
            ...ctx.where(),
            outsourcingClientId: clientId,
            ...(status ? { status: status as never } : {}),
          },
          include: {
            vendor: { select: { id: true, name: true } },
            purchaseRequest: { select: { id: true, requestNumber: true } },
            vendorBill: { select: { id: true, billRef: true, status: true } },
            _count: { select: { lines: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
        });
      });

      return NextResponse.json({
        orders: orders.map((o) => ({
          id: o.id,
          lpoNumber: o.lpoNumber,
          title: o.title,
          currency: o.currency,
          totalAmount: Number(o.totalAmount),
          status: o.status,
          lineCount: o._count.lines,
          vendor: o.vendor,
          purchaseRequest: o.purchaseRequest,
          vendorBill: o.vendorBill,
          issuedAt: o.issuedAt?.toISOString() ?? null,
          createdAt: o.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/procurement/purchase-orders',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load purchase orders.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const purchaseRequestId =
      typeof body.purchaseRequestId === 'string' ? body.purchaseRequestId.trim() : '';
    if (!purchaseRequestId) {
      return NextResponse.json({ error: 'purchaseRequestId is required.' }, { status: 400 });
    }

    try {
      const created = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        return createLpoFromPurchaseRequest(tx, {
          organizationId: ctx.organizationId,
          purchaseRequestId,
          outsourcingClientId: clientId,
        });
      });
      return NextResponse.json(created, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/procurement/purchase-orders',
        message: error instanceof Error ? error.message : String(error),
      });
      const message = error instanceof Error ? error.message : 'Failed to create purchase order.';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
