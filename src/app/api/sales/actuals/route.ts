import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { syncRepPeriodMetric } from '@/lib/sales/metrics-sync';
import { SALES_ACTUAL_SOURCES } from '@/lib/sales/schema';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const employeeId = typeof body.employeeId === 'string' ? body.employeeId.trim() : '';
    const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount);
    const periodStartStr = typeof body.periodStart === 'string' ? body.periodStart : '';
    const periodEndStr = typeof body.periodEnd === 'string' ? body.periodEnd : '';
    const source = typeof body.source === 'string' ? body.source.trim() : 'manual';

    if (!employeeId || !periodStartStr || !periodEndStr) {
      return NextResponse.json(
        { error: 'employeeId, periodStart, and periodEnd are required.' },
        { status: 400 },
      );
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number.' }, { status: 400 });
    }
    if (!SALES_ACTUAL_SOURCES.includes(source as never)) {
      return NextResponse.json({ error: 'Invalid source.' }, { status: 400 });
    }

    const periodStart = new Date(`${periodStartStr}T00:00:00.000Z`);
    const periodEnd = new Date(`${periodEndStr}T00:00:00.000Z`);

    try {
      const actual = await ctx.run(async (tx) => {
        const row = await tx.salesActual.create({
          data: {
            organizationId: ctx.organizationId,
            employeeId,
            periodStart,
            periodEnd,
            amount,
            currency: typeof body.currency === 'string' ? body.currency.trim() : 'KES',
            source: source as never,
            salesDealId:
              typeof body.salesDealId === 'string' ? body.salesDealId.trim() || null : null,
            accountsInvoiceId:
              typeof body.accountsInvoiceId === 'string' ? body.accountsInvoiceId.trim() || null : null,
            notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
            recordedByUserId: ctx.staff.id ?? null,
          },
        });

        await syncRepPeriodMetric(tx, {
          organizationId: ctx.organizationId,
          employeeId,
          periodStart,
          periodEnd,
          currency: row.currency,
        });

        return row;
      });

      return NextResponse.json({ actual: { id: actual.id } }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/actuals',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to record actual.' }, { status: 500 });
    }
  });
}
