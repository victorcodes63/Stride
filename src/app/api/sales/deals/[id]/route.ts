import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { syncRepPeriodMetric } from '@/lib/sales/metrics-sync';
import { SALES_DEAL_STAGES } from '@/lib/sales/schema';
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

    const stage = typeof body.stage === 'string' ? body.stage.trim() : undefined;
    if (stage && !SALES_DEAL_STAGES.includes(stage as never)) {
      return NextResponse.json({ error: 'Invalid stage.' }, { status: 400 });
    }

    try {
      const deal = await ctx.run(async (tx) => {
        const existing = await tx.salesDeal.findFirst({ where: { id, ...ctx.where() } });
        if (!existing) return null;

        const nextStage = (stage ?? existing.stage) as typeof existing.stage;
        const updated = await tx.salesDeal.update({
          where: { id },
          data: {
            ...(stage ? { stage: nextStage } : {}),
            ...(body.value != null && Number.isFinite(Number(body.value))
              ? { value: Number(body.value) }
              : {}),
            ...(typeof body.accountsInvoiceId === 'string'
              ? { accountsInvoiceId: body.accountsInvoiceId.trim() || null }
              : {}),
            closedAt:
              nextStage === 'won' || nextStage === 'lost'
                ? existing.closedAt ?? new Date()
                : null,
          },
        });

        if (nextStage === 'won') {
          const now = new Date();
          const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
          const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
          await syncRepPeriodMetric(tx, {
            organizationId: ctx.organizationId,
            employeeId: updated.ownerEmployeeId,
            periodStart,
            periodEnd,
            currency: updated.currency,
          });
        }

        return updated;
      });

      if (!deal) {
        return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });
      }

      return NextResponse.json({ deal: { id: deal.id, stage: deal.stage } });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/sales/deals/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update deal.' }, { status: 500 });
    }
  });
}
