import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (ctx.essUser.role !== 'manager' && ctx.essUser.role !== 'hr') {
      return NextResponse.json({ error: 'Insufficient role.' }, { status: 403 });
    }

    const teamLeaveWhere =
      ctx.essUser.role === 'hr'
        ? ctx.where({ status: 'pending' as const })
        : ctx.where({
            status: 'pending' as const,
            ...(ctx.employeeId
              ? { employee: { managerEmployeeId: ctx.employeeId } }
              : { employeeId: 'none' }),
          });

    const onLeaveWhere =
      ctx.essUser.role === 'hr'
        ? ctx.where({
            status: 'approved',
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
          })
        : ctx.where({
            status: 'approved',
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
            ...(ctx.employeeId
              ? { employee: { managerEmployeeId: ctx.employeeId } }
              : { employeeId: 'none' }),
          });

    const [leavePending, onLeaveThisWeek] = await ctx.run((tx) =>
      Promise.all([
        tx.leaveApplication.count({ where: teamLeaveWhere }),
        tx.leaveApplication.count({ where: onLeaveWhere }),
      ]),
    );

    return NextResponse.json({
      leavePending,
      onLeaveThisWeek,
      attendancePending: 0,
    });
  });
}
