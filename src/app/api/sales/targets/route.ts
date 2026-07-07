import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { syncRepPeriodMetric } from '@/lib/sales/metrics-sync';
import { parsePeriodBounds, SALES_TARGET_PERIOD_TYPES } from '@/lib/sales/schema';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    try {
      const employeeId = request.nextUrl.searchParams.get('employeeId')?.trim() || undefined;
      const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

      const targets = await ctx.run((tx) =>
        tx.salesTarget.findMany({
          where: {
            ...ctx.where(),
            ...(employeeId ? { employeeId } : {}),
            ...(status ? { status: status as never } : {}),
          },
          include: {
            employee: { select: { id: true, firstName: true, lastName: true } },
            department: { select: { id: true, name: true } },
            setBy: { select: { id: true, name: true } },
            approvedBy: { select: { id: true, name: true } },
          },
          orderBy: { periodStart: 'desc' },
          take: 200,
        }),
      );

      return NextResponse.json({
        targets: targets.map((t) => ({
          id: t.id,
          employeeId: t.employeeId,
          departmentId: t.departmentId,
          employee: t.employee
            ? { id: t.employee.id, name: `${t.employee.firstName} ${t.employee.lastName}`.trim() }
            : null,
          department: t.department,
          periodType: t.periodType,
          periodStart: t.periodStart.toISOString().slice(0, 10),
          periodEnd: t.periodEnd.toISOString().slice(0, 10),
          amount: Number(t.amount),
          currency: t.currency,
          product: t.product,
          region: t.region,
          segment: t.segment,
          status: t.status,
          parentTargetId: t.parentTargetId,
          setBy: t.setBy,
          approvedBy: t.approvedBy,
          approvedAt: t.approvedAt?.toISOString() ?? null,
          notes: t.notes,
          createdAt: t.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/targets',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load sales targets.' }, { status: 500 });
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

    const employeeId = typeof body.employeeId === 'string' ? body.employeeId.trim() : '';
    const departmentId = typeof body.departmentId === 'string' ? body.departmentId.trim() : '';
    const periodType = typeof body.periodType === 'string' ? body.periodType.trim() : 'month';
    const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount);
    const currency = typeof body.currency === 'string' ? body.currency.trim() : 'KES';
    const submitForApproval = body.submitForApproval === true;

    if (!employeeId && !departmentId) {
      return NextResponse.json({ error: 'employeeId or departmentId is required.' }, { status: 400 });
    }
    if (!SALES_TARGET_PERIOD_TYPES.includes(periodType as never)) {
      return NextResponse.json({ error: 'Invalid periodType.' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number.' }, { status: 400 });
    }

    const anchor =
      typeof body.periodStart === 'string' && body.periodStart
        ? new Date(`${body.periodStart}T00:00:00.000Z`)
        : new Date();
    const { periodStart, periodEnd } = parsePeriodBounds(periodType as never, anchor);

    try {
      const target = await ctx.run(async (tx) => {
        const created = await tx.salesTarget.create({
          data: {
            organizationId: ctx.organizationId,
            employeeId: employeeId || null,
            departmentId: departmentId || null,
            periodType: periodType as never,
            periodStart,
            periodEnd,
            amount,
            currency,
            product: typeof body.product === 'string' ? body.product.trim() || null : null,
            region: typeof body.region === 'string' ? body.region.trim() || null : null,
            segment: typeof body.segment === 'string' ? body.segment.trim() || null : null,
            status: submitForApproval ? 'pending_approval' : 'draft',
            setByUserId: ctx.staff.id ?? null,
            notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
            parentTargetId:
              typeof body.parentTargetId === 'string' ? body.parentTargetId.trim() || null : null,
          },
        });

        if (employeeId && submitForApproval) {
          await syncRepPeriodMetric(tx, {
            organizationId: ctx.organizationId,
            employeeId,
            periodStart,
            periodEnd,
            currency,
          });
        }

        return created;
      });

      return NextResponse.json({ target: { id: target.id, status: target.status } }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/targets',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create sales target.' }, { status: 500 });
    }
  });
}
