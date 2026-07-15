import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { syncRepPeriodMetric } from '@/lib/sales/metrics-sync';
import { canManageSalesTargets } from '@/lib/staff-permissions';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const action = typeof body.action === 'string' ? body.action.trim() : '';

    if (action === 'approve' && !canManageSalesTargets(ctx.staff.role, ctx.staff.staffUserType)) {
      return NextResponse.json(
        { error: 'Only sales managers and finance can approve targets.' },
        { status: 403 },
      );
    }

    try {
      const updated = await ctx.run(async (tx) => {
        const existing = await tx.salesTarget.findFirst({
          where: { id, ...ctx.where() },
        });
        if (!existing) return null;

        if (action === 'approve') {
          const row = await tx.salesTarget.update({
            where: { id },
            data: {
              status: 'approved',
              approvedByUserId: ctx.staff.id ?? null,
              approvedAt: new Date(),
            },
          });
          if (row.employeeId) {
            await syncRepPeriodMetric(tx, {
              organizationId: ctx.organizationId,
              employeeId: row.employeeId,
              periodStart: row.periodStart,
              periodEnd: row.periodEnd,
              currency: row.currency,
            });
          }
          return row;
        }

        if (action === 'submit') {
          return tx.salesTarget.update({
            where: { id },
            data: { status: 'pending_approval' },
          });
        }

        const amount = body.amount != null ? Number(body.amount) : undefined;
        return tx.salesTarget.update({
          where: { id },
          data: {
            ...(Number.isFinite(amount) ? { amount } : {}),
            notes: typeof body.notes === 'string' ? body.notes.trim() || null : undefined,
          },
        });
      });

      if (!updated) {
        return NextResponse.json({ error: 'Target not found.' }, { status: 404 });
      }

      return NextResponse.json({ target: { id: updated.id, status: updated.status } });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/sales/targets/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update sales target.' }, { status: 500 });
    }
  });
}
