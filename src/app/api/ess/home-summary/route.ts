import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    const badges: Record<string, number> = {};
    const actions: Array<{
      id: string;
      type: string;
      title: string;
      subtitle: string;
      href: string;
      priority: number;
    }> = [];
    const widgets: Record<string, unknown> = {};
    const activity: Array<{ id: string; kind: string; title: string; at: string; href?: string }> = [];

    if (ctx.essUser.mustResetPassword) {
      actions.push({
        id: 'reset-password',
        type: 'security',
        title: 'Update your password',
        subtitle: 'Required before you continue',
        href: '/ess/account-security',
        priority: 0,
      });
    }

    if (ctx.employeeId) {
      const employeeId = ctx.employeeId;
      const year = new Date().getUTCFullYear();

      const [pendingLeave, balances, latestPayslip, attendanceSummary, onboardingTasks, expiringCreds] =
        await ctx.run((tx) =>
          Promise.all([
            tx.leaveApplication.count({
              where: ctx.where({ employeeId, status: 'pending' }),
            }),
            tx.leaveType.findMany({
              where: ctx.where(),
              orderBy: { name: 'asc' },
              take: 1,
              select: { id: true, name: true, daysPerYear: true },
            }),
            tx.payroll.findFirst({
              where: ctx.where({ employeeId, status: { in: ['approved', 'paid'] } }),
              orderBy: [{ year: 'desc' }, { month: 'desc' }],
              select: { id: true, month: true, year: true, netPay: true, status: true },
            }),
            tx.attendanceDaySummary.aggregate({
              where: ctx.where({
                employeeId,
                workDate: {
                  gte: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)),
                },
              }),
              _sum: { minutesWorked: true },
              _count: true,
            }),
            tx.onboardingTask.count({
              where: ctx.where({
                workflow: { employeeId, status: 'IN_PROGRESS' },
                status: { in: ['PENDING', 'IN_PROGRESS'] },
              }),
            }),
            tx.employeeCredential.count({
              where: ctx.where({
                employeeId,
                status: 'active',
                expiryDate: {
                  lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                  gte: new Date(),
                },
              }),
            }),
          ]),
        );

      if (pendingLeave > 0) badges.leavePending = pendingLeave;
      if (onboardingTasks > 0) {
        badges.onboardingDue = onboardingTasks;
        actions.push({
          id: 'onboarding',
          type: 'onboarding',
          title: 'Onboarding tasks',
          subtitle: `${onboardingTasks} task(s) to complete`,
          href: '/ess/onboarding',
          priority: 2,
        });
      }
      if (expiringCreds > 0) {
        badges.credentialsExpiring = expiringCreds;
        actions.push({
          id: 'credentials',
          type: 'credential',
          title: 'Credentials expiring soon',
          subtitle: `${expiringCreds} need attention`,
          href: '/ess/credentials',
          priority: 3,
        });
      }

      const primaryType = balances[0];
      if (primaryType) {
        const [lb, pendingDays] = await ctx.run((tx) =>
          Promise.all([
            tx.leaveBalance.findFirst({
              where: ctx.where({
                employeeId,
                leaveTypeId: primaryType.id,
                year,
              }),
            }),
            tx.leaveApplication.aggregate({
              where: ctx.where({ employeeId, leaveTypeId: primaryType.id, status: 'pending' }),
              _sum: { days: true },
            }),
          ]),
        );
        const entitled = lb?.balance ?? primaryType.daysPerYear;
        const used = lb?.used ?? 0;
        const pending = pendingDays._sum.days ?? 0;
        widgets.leave = {
          typeName: primaryType.name,
          remaining: entitled - used - pending,
          entitled,
        };
      }

      if (latestPayslip) {
        widgets.payslip = {
          id: latestPayslip.id,
          month: latestPayslip.month,
          year: latestPayslip.year,
          netPay: Number(latestPayslip.netPay),
          status: latestPayslip.status,
        };
      }

      const hours = Math.round((attendanceSummary._sum.minutesWorked ?? 0) / 60);
      widgets.attendance = {
        daysWorked: attendanceSummary._count,
        hoursThisMonth: hours,
      };

      const nextShift = await ctx.run((tx) =>
        tx.shiftAssignment.findFirst({
          where: ctx.where({
            employeeId,
            startsAt: { gte: new Date() },
          }),
          orderBy: { startsAt: 'asc' },
          select: { startsAt: true, endsAt: true, shiftTemplate: { select: { name: true } } },
        }),
      );
      if (nextShift) {
        widgets.shift = {
          startsAt: nextShift.startsAt.toISOString(),
          endsAt: nextShift.endsAt.toISOString(),
          name: nextShift.shiftTemplate?.name ?? 'Shift',
        };
      }

      const recentLeave = await ctx.run((tx) =>
        tx.leaveApplication.findMany({
          where: ctx.where({ employeeId }),
          orderBy: { updatedAt: 'desc' },
          take: 3,
          select: { id: true, status: true, startDate: true, endDate: true, updatedAt: true },
        }),
      );
      for (const row of recentLeave) {
        activity.push({
          id: `leave-${row.id}`,
          kind: 'leave',
          title: `Leave ${row.status}`,
          at: row.updatedAt.toISOString(),
          href: '/ess/leave',
        });
      }
    }

    if ((ctx.essUser.role === 'manager' || ctx.essUser.role === 'hr') && ctx.employeeId) {
      const teamWhere =
        ctx.essUser.role === 'hr'
          ? ctx.where({ status: 'pending' as const })
          : ctx.where({
              status: 'pending' as const,
              employee: { managerEmployeeId: ctx.employeeId },
            });
      const teamPending = await ctx.run((tx) => tx.leaveApplication.count({ where: teamWhere }));
      if (teamPending > 0) {
        badges.teamLeavePending = teamPending;
        actions.push({
          id: 'team-leave',
          type: 'approval',
          title: 'Leave approvals',
          subtitle: `${teamPending} request(s) waiting`,
          href: '/ess/team/leave',
          priority: 1,
        });
      }
    }

    actions.sort((a, b) => a.priority - b.priority);

    return NextResponse.json({ actions, widgets, activity: activity.slice(0, 8), badges });
  });
}
