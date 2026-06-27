import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;

    try {
      const row = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        return tx.purchaseOrder.findFirst({
          where: { ...ctx.where(), id, outsourcingClientId: clientId },
          include: {
            lines: { orderBy: { sortOrder: 'asc' } },
            vendor: { select: { id: true, name: true } },
            purchaseRequest: { select: { id: true, requestNumber: true, title: true } },
            vendorBill: { select: { id: true, billRef: true, status: true, issueDate: true } },
            issuedBy: { select: { id: true, name: true } },
          },
        });
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
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
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
      const result = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const row = await tx.purchaseOrder.findFirst({
          where: { ...ctx.where(), id, outsourcingClientId: clientId },
        });
        if (!row) return { kind: 'not_found' as const };

        const action = typeof body.action === 'string' ? body.action : '';

        if (action === 'issue') {
          if (row.status !== 'draft') {
            return { kind: 'error' as const, message: 'Can only issue draft LPOs.' };
          }
          await tx.purchaseOrder.update({
            where: { id },
            data: {
              status: 'issued',
              issuedAt: new Date(),
              issuedByUserId: ctx.staff.id,
            },
          });
          return { kind: 'ok' as const };
        }

        if (action === 'fulfill') {
          if (row.status !== 'issued') {
            return { kind: 'error' as const, message: 'Can only fulfill issued LPOs.' };
          }
          await tx.purchaseOrder.update({
            where: { id },
            data: { status: 'fulfilled' },
          });
          return { kind: 'ok' as const };
        }

        if (action === 'cancel') {
          if (row.status === 'fulfilled' || row.status === 'cancelled') {
            return { kind: 'error' as const, message: 'Cannot cancel this LPO.' };
          }
          await tx.purchaseOrder.update({
            where: { id },
            data: { status: 'cancelled' },
          });
          return { kind: 'ok' as const };
        }

        if (action === 'link_bill') {
          const vendorBillId = typeof body.vendorBillId === 'string' ? body.vendorBillId.trim() : '';
          if (!vendorBillId) {
            return { kind: 'error' as const, message: 'vendorBillId is required.' };
          }
          const bill = await tx.accountsVendorBill.findFirst({
            where: { ...ctx.where(), id: vendorBillId, vendorId: row.vendorId },
            select: { id: true },
          });
          if (!bill) {
            return { kind: 'error' as const, message: 'Vendor bill not found for this vendor.' };
          }
          await tx.purchaseOrder.update({
            where: { id },
            data: { vendorBillId },
          });
          return { kind: 'ok' as const };
        }

        return { kind: 'invalid' as const };
      });

      if (result.kind === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (result.kind === 'error') return NextResponse.json({ error: result.message }, { status: 400 });
      if (result.kind === 'invalid') return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: `PATCH /api/procurement/purchase-orders/${id}`,
        message: error instanceof Error ? error.message : String(error),
      });
      const message = error instanceof Error ? error.message : 'Failed to update purchase order.';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
