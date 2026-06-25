import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reportApiError } from '@/lib/monitoring';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
  if (moduleBlock) return moduleBlock;

  const { id } = await params;

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const row = await prisma.purchaseOrder.findFirst({
      where: { id, outsourcingClientId: clientId },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        vendor: { select: { id: true, name: true } },
        purchaseRequest: { select: { id: true, requestNumber: true, title: true } },
        vendorBill: { select: { id: true, billRef: true, status: true, issueDate: true } },
        issuedBy: { select: { id: true, name: true } },
      },
    });

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      order: {
        id: row.id,
        lpoNumber: row.lpoNumber,
        title: row.title,
        currency: row.currency,
        totalAmount: Number(row.totalAmount),
        status: row.status,
        notes: row.notes,
        vendor: row.vendor,
        purchaseRequest: row.purchaseRequest,
        vendorBill: row.vendorBill
          ? {
              ...row.vendorBill,
              issueDate: row.vendorBill.issueDate.toISOString().slice(0, 10),
            }
          : null,
        issuedBy: row.issuedBy,
        issuedAt: row.issuedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        lines: row.lines.map((line) => ({
          id: line.id,
          item: line.item,
          description: line.description,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          lineTotal: Math.round(Number(line.quantity) * Number(line.unitPrice) * 100) / 100,
        })),
      },
    });
  } catch (error) {
    await reportApiError({
      route: `GET /api/procurement/purchase-orders/${id}`,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load purchase order.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
  if (moduleBlock) return moduleBlock;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const row = await prisma.purchaseOrder.findFirst({
      where: { id, outsourcingClientId: clientId },
    });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'issue') {
      if (row.status !== 'draft') {
        return NextResponse.json({ error: 'Can only issue draft LPOs.' }, { status: 400 });
      }
      await prisma.purchaseOrder.update({
        where: { id },
        data: {
          status: 'issued',
          issuedAt: new Date(),
          issuedByUserId: user.id,
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'fulfill') {
      if (row.status !== 'issued') {
        return NextResponse.json({ error: 'Can only fulfill issued LPOs.' }, { status: 400 });
      }
      await prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'fulfilled' },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'cancel') {
      if (row.status === 'fulfilled' || row.status === 'cancelled') {
        return NextResponse.json({ error: 'Cannot cancel this LPO.' }, { status: 400 });
      }
      await prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'cancelled' },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'link_bill') {
      const vendorBillId = typeof body.vendorBillId === 'string' ? body.vendorBillId.trim() : '';
      if (!vendorBillId) {
        return NextResponse.json({ error: 'vendorBillId is required.' }, { status: 400 });
      }
      const bill = await prisma.accountsVendorBill.findFirst({
        where: { id: vendorBillId, vendorId: row.vendorId },
        select: { id: true },
      });
      if (!bill) {
        return NextResponse.json({ error: 'Vendor bill not found for this vendor.' }, { status: 400 });
      }
      await prisma.purchaseOrder.update({
        where: { id },
        data: { vendorBillId },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    await reportApiError({
      route: `PATCH /api/procurement/purchase-orders/${id}`,
      message: error instanceof Error ? error.message : String(error),
    });
    const message = error instanceof Error ? error.message : 'Failed to update purchase order.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
