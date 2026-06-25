import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reportApiError } from '@/lib/monitoring';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { createLpoFromPurchaseRequest } from '@/lib/procurement/lpo';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
  if (moduleBlock) return moduleBlock;

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

    const orders = await prisma.purchaseOrder.findMany({
      where: {
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
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const created = await createLpoFromPurchaseRequest(prisma, {
      organizationId: user.currentOrgId,
      purchaseRequestId,
      outsourcingClientId: clientId,
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
}
