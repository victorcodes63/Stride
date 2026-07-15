import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { estimateCommissionsForPeriod } from '@/lib/sales/commission';
import { parsePeriodBounds } from '@/lib/sales/schema';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const periodType = request.nextUrl.searchParams.get('periodType')?.trim() || 'month';
    const anchor = new Date();
    const { periodStart, periodEnd } = parsePeriodBounds(
      periodType === 'quarter' || periodType === 'year' ? periodType : 'month',
      anchor,
    );

    try {
      const estimates = await ctx.run(async (tx) => {
        const rows = await estimateCommissionsForPeriod(tx, {
          organizationId: ctx.organizationId,
          periodStart,
          periodEnd,
        });
        const ids = rows.map((r) => r.employeeId);
        const employees = await tx.employee.findMany({
          where: { id: { in: ids }, organizationId: ctx.organizationId },
          select: { id: true, firstName: true, lastName: true },
        });
        const nameById = new Map(
          employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`.trim()] as const),
        );
        return rows.map((r) => ({
          ...r,
          employeeName: nameById.get(r.employeeId) ?? r.employeeId.slice(0, 8),
        }));
      });

      return NextResponse.json({
        estimates,
        periodStart: periodStart.toISOString().slice(0, 10),
        periodEnd: periodEnd.toISOString().slice(0, 10),
        victorTodo: 'Wire commission payouts to payroll disbursement (SALES-05 enterprise gate).',
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/commissions',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to estimate commissions.' }, { status: 500 });
    }
  });
}

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

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const config = body.config;
    if (!name || !config || typeof config !== 'object') {
      return NextResponse.json({ error: 'name and config are required.' }, { status: 400 });
    }

    try {
      const rule = await ctx.run((tx) =>
        tx.salesCommissionRule.create({
          data: {
            organizationId: ctx.organizationId,
            name,
            description: typeof body.description === 'string' ? body.description.trim() || null : null,
            status: body.activate === true ? 'active' : 'draft',
            config: config as never,
          },
        }),
      );

      return NextResponse.json({ rule: { id: rule.id, status: rule.status } }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/commissions',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to save commission rule.' }, { status: 500 });
    }
  });
}
