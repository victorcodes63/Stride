import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reportApiError } from '@/lib/monitoring';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
  if (moduleBlock) return moduleBlock;

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const purchaseOrderId = request.nextUrl.searchParams.get('purchaseOrderId')?.trim() || undefined;

    const receipts = await prisma.goodsReceipt.findMany({
      where: {
        outsourcingClientId: clientId,
        ...(purchaseOrderId ? { purchaseOrderId } : {}),
      },
      include: {
        purchaseOrder: { select: { lpoNumber: true } },
        receivedBy: { select: { name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { receivedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      receipts: receipts.map((r) => ({
        id: r.id,
        grnNumber: r.grnNumber,
        status: r.status,
        receivedAt: r.receivedAt.toISOString().slice(0, 10),
        lpoNumber: r.purchaseOrder.lpoNumber,
        purchaseOrderId: r.purchaseOrderId,
        receivedBy: r.receivedBy.name,
        lineCount: r._count.lines,
      })),
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/procurement/goods-receipts',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load goods receipts.' }, { status: 500 });
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

  const purchaseOrderId = typeof body.purchaseOrderId === 'string' ? body.purchaseOrderId.trim() : '';
  const receivedAt = typeof body.receivedAt === 'string' ? body.receivedAt.trim() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
  const lines = body.lines;

  if (!purchaseOrderId || !receivedAt) {
    return NextResponse.json({ error: 'purchaseOrderId and receivedAt are required.' }, { status: 400 });
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ error: 'At least one receipt line is required.' }, { status: 400 });
  }

  const parsedLines = lines.map((line: Record<string, unknown>) => {
    const purchaseOrderLineId =
      typeof line.purchaseOrderLineId === 'string' ? line.purchaseOrderLineId.trim() : '';
    const quantityReceived = Number(line.quantityReceived) || 0;
    if (!purchaseOrderLineId || quantityReceived <= 0) return null;
    return { purchaseOrderLineId, quantityReceived };
  });
  const validLines = parsedLines.filter(Boolean) as {
    purchaseOrderLineId: string;
    quantityReceived: number;
  }[];
  if (validLines.length === 0) {
    return NextResponse.json({ error: 'Each line needs purchaseOrderLineId and quantityReceived.' }, { status: 400 });
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const order = await prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, outsourcingClientId: clientId },
      include: { lines: { select: { id: true } } },
    });
    if (!order) return NextResponse.json({ error: 'Purchase order not found.' }, { status: 404 });
    if (order.status !== 'issued' && order.status !== 'fulfilled') {
      return NextResponse.json({ error: 'Can only receive goods against issued LPOs.' }, { status: 400 });
    }

    const lineIds = new Set(order.lines.map((l) => l.id));
    for (const line of validLines) {
      if (!lineIds.has(line.purchaseOrderLineId)) {
        return NextResponse.json({ error: 'Invalid purchase order line.' }, { status: 400 });
      }
    }

    const count = await prisma.goodsReceipt.count({ where: { outsourcingClientId: clientId } });
    const grnNumber = `GRN-${String(count + 1).padStart(4, '0')}`;

    const created = await prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.create({
        data: {
          organizationId: user.currentOrgId,
          outsourcingClientId: clientId,
          purchaseOrderId,
          grnNumber,
          receivedAt: new Date(receivedAt),
          receivedByUserId: user.id,
          status: 'posted',
          notes,
          lines: {
            create: validLines.map((line) => ({
              organizationId: user.currentOrgId,
              purchaseOrderLineId: line.purchaseOrderLineId,
              quantityReceived: line.quantityReceived,
            })),
          },
        },
        select: { id: true, grnNumber: true },
      });

      if (order.status === 'issued') {
        await tx.purchaseOrder.update({
          where: { id: purchaseOrderId },
          data: { status: 'fulfilled' },
        });
      }

      return receipt;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/procurement/goods-receipts',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create goods receipt.' }, { status: 500 });
  }
}
