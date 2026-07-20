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
      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

      const outsourcedEmployee = {
        client: { organizationId: ctx.organizationId },
      } as const;

      const [
        endClientCount,
        activeEndClients,
        workforceTotal,
        activeWorkforce,
        pendingLeaveApprovals,
        onLeaveToday,
        payrollRunsThisMonth,
        openAttendanceExceptions,
        openDisciplinaryCases,
        invoicesThisMonth,
        openRpoJobs,
      ] = await ctx.run((tx) =>
        Promise.all([
          tx.outsourcingClient.count({ where: { organizationId: ctx.organizationId } }),
          tx.outsourcingClient.count({
            where: { organizationId: ctx.organizationId, status: 'active' },
          }),
          tx.employee.count({ where: outsourcedEmployee }),
          tx.employee.count({
            where: {
              ...outsourcedEmployee,
              employmentStatus: 'active',
            },
          }),
          tx.leaveApplication.count({
            where: {
              status: 'pending',
              employee: outsourcedEmployee,
            },
          }),
          tx.leaveApplication.count({
            where: {
              status: 'approved',
              employee: outsourcedEmployee,
              startDate: { lte: endToday },
              endDate: { gte: startToday },
            },
          }),
          tx.payroll.count({
            where: {
              month,
              year,
              employee: outsourcedEmployee,
            },
          }),
          tx.attendanceException.count({
            where: {
              status: 'open',
              employee: outsourcedEmployee,
            },
          }),
          tx.disciplinaryCase.count({
            where: {
              organizationId: ctx.organizationId,
              status: { notIn: ['RESOLVED', 'CLOSED'] },
              employee: outsourcedEmployee,
            },
          }),
          tx.accountsInvoice.count({
            where: {
              organizationId: ctx.organizationId,
              issueDate: { gte: monthStart, lte: monthEnd },
              accountsClient: { outsourcingClientId: { not: null } },
            },
          }),
          tx.job.count({
            where: {
              organizationId: ctx.organizationId,
              outsourcingClientId: { not: null },
              isActive: true,
            },
          }),
        ]),
      );

      return NextResponse.json({
        endClients: { total: endClientCount, active: activeEndClients },
        workforce: { total: workforceTotal, active: activeWorkforce },
        leave: { pendingApprovals: pendingLeaveApprovals, onLeaveToday },
        payroll: { runsThisMonth: payrollRunsThisMonth, month, year },
        attendance: { openExceptions: openAttendanceExceptions },
        disciplinary: { openCases: openDisciplinaryCases },
        billing: { invoicesThisMonth },
        rpo: { openJobs: openRpoJobs },
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
