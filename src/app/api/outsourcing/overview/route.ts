import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

/**
 * Org-wide BPO module overview — end clients, outsourced workforce, and service signals.
 */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const todayStr = now.toISOString().slice(0, 10);
      const startToday = new Date(`${todayStr}T00:00:00.000Z`);
      const endToday = new Date(`${todayStr}T23:59:59.999Z`);

      const [
        endClientCount,
        activeEndClients,
        workforceTotal,
        activeWorkforce,
        pendingLeaveApprovals,
        onLeaveToday,
        payrollRunsThisMonth,
      ] = await ctx.run((tx) =>
        Promise.all([
          tx.outsourcingClient.count({ where: { organizationId: ctx.organizationId } }),
          tx.outsourcingClient.count({
            where: { organizationId: ctx.organizationId, status: 'active' },
          }),
          tx.employee.count({
            where: { client: { organizationId: ctx.organizationId } },
          }),
          tx.employee.count({
            where: {
              client: { organizationId: ctx.organizationId },
              employmentStatus: 'active',
            },
          }),
          tx.leaveApplication.count({
            where: {
              status: 'pending',
              employee: { client: { organizationId: ctx.organizationId } },
            },
          }),
          tx.leaveApplication.count({
            where: {
              status: 'approved',
              employee: { client: { organizationId: ctx.organizationId } },
              startDate: { lte: endToday },
              endDate: { gte: startToday },
            },
          }),
          tx.payroll.count({
            where: {
              month,
              year,
              employee: { client: { organizationId: ctx.organizationId } },
            },
          }),
        ]),
      );

      return NextResponse.json({
        endClients: { total: endClientCount, active: activeEndClients },
        workforce: { total: workforceTotal, active: activeWorkforce },
        leave: { pendingApprovals: pendingLeaveApprovals, onLeaveToday },
        payroll: { runsThisMonth: payrollRunsThisMonth, month, year },
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/outsourcing/overview',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load outsourcing overview.' }, { status: 500 });
    }
  });
}
