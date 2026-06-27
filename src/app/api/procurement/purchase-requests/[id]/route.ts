import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { createLpoFromPurchaseRequest } from '@/lib/procurement/lpo';
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
        return tx.purchaseRequest.findFirst({
          where: { ...ctx.where(), id, outsourcingClientId: clientId },
          include: {
            lines: { orderBy: { sortOrder: 'asc' } },
            vendor: { select: { id: true, name: true } },
            requestedBy: { select: { id: true, name: true, email: true } },
            reviewedBy: { select: { id: true, name: true } },
          },
        });
      });

      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      return NextResponse.json({
        request: {
          id: row.id,
          requestNumber: row.requestNumber,
          title: row.title,
          department: row.department,
          justification: row.justification,
          currency: row.currency,
          totalAmount: Number(row.totalAmount),
          status: row.status,
          vendor: row.vendor,
          requestedBy: row.requestedBy,
          reviewedBy: row.reviewedBy,
          submittedAt: row.submittedAt?.toISOString() ?? null,
          reviewedAt: row.reviewedAt?.toISOString() ?? null,
          rejectionReason: row.rejectionReason,
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
        route: `GET /api/procurement/purchase-requests/${id}`,
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load purchase request.' }, { status: 500 });
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
        const resolvedClientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        const row = await tx.purchaseRequest.findFirst({
          where: { ...ctx.where(), id, outsourcingClientId: resolvedClientId },
        });
        if (!row) return { kind: 'not_found' as const };

        const action = typeof body.action === 'string' ? body.action : '';

        if (action === 'submit') {
          if (row.status !== 'draft') {
            return { kind: 'error' as const, message: 'Can only submit draft requests.' };
          }
          await tx.purchaseRequest.update({
            where: { id },
            data: { status: 'submitted', submittedAt: new Date() },
          });
          return { kind: 'ok' as const };
        }

        if (action === 'approve') {
          if (row.status !== 'submitted') {
            return { kind: 'error' as const, message: 'Can only approve submitted requests.' };
          }
          if (!row.vendorId) {
            return { kind: 'error' as const, message: 'Assign a vendor before approving.' };
          }
          await tx.purchaseRequest.update({
            where: { id },
            data: {
              status: 'approved',
              reviewedAt: new Date(),
              reviewedByUserId: ctx.staff.id,
            },
          });
          const lpo = await createLpoFromPurchaseRequest(tx, {
            organizationId: ctx.organizationId,
            purchaseRequestId: id,
            outsourcingClientId: resolvedClientId,
          });
          return { kind: 'lpo' as const, lpo };
        }

        if (action === 'reject') {
          if (row.status !== 'submitted') {
            return { kind: 'error' as const, message: 'Can only reject submitted requests.' };
          }
          const reason = typeof body.reason === 'string' ? body.reason.trim() || null : null;
          await tx.purchaseRequest.update({
            where: { id },
            data: {
              status: 'rejected',
              reviewedAt: new Date(),
              reviewedByUserId: ctx.staff.id,
              rejectionReason: reason,
            },
          });
          return { kind: 'ok' as const };
        }

        if (action === 'cancel') {
          if (row.status !== 'draft' && row.status !== 'submitted') {
            return { kind: 'error' as const, message: 'Can only cancel draft or submitted requests.' };
          }
          await tx.purchaseRequest.update({
            where: { id },
            data: { status: 'cancelled' },
          });
          return { kind: 'ok' as const };
        }

        return { kind: 'invalid' as const };
      });

      if (result.kind === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (result.kind === 'error') return NextResponse.json({ error: result.message }, { status: 400 });
      if (result.kind === 'invalid') return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
      if (result.kind === 'lpo') return NextResponse.json({ ok: true, lpo: result.lpo });
      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: `PATCH /api/procurement/purchase-requests/${id}`,
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update purchase request.' }, { status: 500 });
    }
  });
}
