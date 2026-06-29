import { NextRequest, NextResponse } from 'next/server';
import type { StatutoryItemStatus } from '@prisma/client';
import { deriveReturnStatus } from '@/lib/statutory-returns';
import { canAccessPayroll, forbiddenResponse } from '@/lib/demo-route-access';
import { enforceSodCheck, SodViolationError } from '@/lib/admin-security';
import { guardSensitiveAction } from '@/lib/sensitive-reauth-policy';
import { withTenant } from '@/lib/tenant-api';

const ALLOWED_STATUS = new Set(['pending', 'prepared', 'submitted', 'paid', 'overdue'] as const);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> },
) {
  return withTenant(request, async (ctx) => {
    try {
      if (!canAccessPayroll(ctx.staff)) return forbiddenResponse('Payroll/statutory access is restricted.');
      const { itemId } = await context.params;
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const statusInput = typeof body.status === 'string' ? body.status : null;
      if (!statusInput || !ALLOWED_STATUS.has(statusInput as never)) {
        return NextResponse.json({ error: 'Invalid item status' }, { status: 400 });
      }

      const referenceNumber = typeof body.referenceNumber === 'string' ? body.referenceNumber.trim() : undefined;
      const paymentReference = typeof body.paymentReference === 'string' ? body.paymentReference.trim() : undefined;
      const notes = typeof body.notes === 'string' ? body.notes.trim() : undefined;
      const now = new Date();
      const sensitiveSubmit = statusInput === 'submitted' || statusInput === 'paid';
      if (sensitiveSubmit) {
        const reauthError = await guardSensitiveAction(request, {
          userId: ctx.staff.id,
          userRole: ctx.staff.role,
          organizationId: ctx.organizationId,
        });
        if (reauthError) return reauthError;
        await enforceSodCheck({
          actorUserId: ctx.staff.id,
          organizationId: ctx.organizationId,
          entityType: 'StatutoryReturnItem',
          entityId: itemId,
          forbiddenActions: ['statutory.item.prepared'],
          actionLabel: `statutory item ${statusInput}`,
        });
      }

      const updated = await ctx.run(async (tx) => {
        const existingItem = await tx.statutoryReturnItem.findFirst({
          where: { id: itemId, organizationId: ctx.organizationId },
          select: { id: true },
        });
        if (!existingItem) {
          throw new Error('Statutory item not found');
        }

        const item = await tx.statutoryReturnItem.update({
          where: { id: itemId },
          data: {
            status: statusInput as StatutoryItemStatus,
            ...(referenceNumber !== undefined ? { referenceNumber: referenceNumber || null } : {}),
            ...(paymentReference !== undefined ? { paymentReference: paymentReference || null } : {}),
            ...(notes !== undefined ? { notes: notes || null } : {}),
            submittedAt: statusInput === 'submitted' ? now : statusInput === 'pending' || statusInput === 'prepared' ? null : undefined,
            paidAt: statusInput === 'paid' ? now : statusInput === 'pending' || statusInput === 'prepared' || statusInput === 'submitted' ? null : undefined,
          },
          select: { statutoryReturnId: true },
        });

        const parent = await tx.statutoryReturn.findFirst({
          where: { id: item.statutoryReturnId, organizationId: ctx.organizationId },
          include: { items: { select: { status: true, dueDate: true } } },
        });
        if (parent) {
          const dueDate = parent.items[0]?.dueDate ?? new Date();
          const returnStatus = deriveReturnStatus(parent.items.map((i) => i.status), dueDate);
          await tx.statutoryReturn.update({
            where: { id: parent.id },
            data: {
              status: returnStatus,
              submittedAt:
                returnStatus === 'filed' || returnStatus === 'paid'
                  ? parent.submittedAt || now
                  : returnStatus === 'draft'
                    ? null
                    : parent.submittedAt,
              paidAt: returnStatus === 'paid' ? parent.paidAt || now : returnStatus === 'draft' ? null : parent.paidAt,
            },
          });
        }
        return item;
      });

      await ctx.audit({
        action: sensitiveSubmit ? 'statutory.item.submitted' : 'statutory.item.prepared',
        entityType: 'StatutoryReturnItem',
        entityId: itemId,
        route: 'PATCH /api/payroll/statutory/items/[itemId]',
        metadata: { status: statusInput },
      });

      return NextResponse.json({ ok: true, statutoryReturnId: updated.statutoryReturnId });
    } catch (error) {
      if (error instanceof SodViolationError) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error instanceof Error && error.message === 'Statutory item not found') {
        return NextResponse.json({ error: 'Statutory item not found' }, { status: 404 });
      }
      throw error;
    }
  });
}
