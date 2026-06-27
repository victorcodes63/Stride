import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (ctx.essUser.role !== 'manager' && ctx.essUser.role !== 'hr') {
      return NextResponse.json({ error: 'Insufficient role.' }, { status: 403 });
    }

    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    const where =
      ctx.essUser.role === 'hr'
        ? ctx.where({
            status: 'approved' as const,
            startDate: { lte: weekEnd },
            endDate: { gte: now },
          })
        : ctx.where({
            status: 'approved' as const,
            startDate: { lte: weekEnd },
            endDate: { gte: now },
            ...(ctx.employeeId
              ? { employee: { managerEmployeeId: ctx.employeeId } }
              : { employeeId: 'none' }),
          });

    const rows = await ctx.run((tx) =>
      tx.leaveApplication.findMany({
        where,
        orderBy: { startDate: 'asc' },
        include: {
          employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
          leaveType: { select: { name: true } },
        },
      }),
    );

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        employeeName: `${r.employee.firstName} ${r.employee.lastName}`.trim(),
        employeeNumber: r.employee.employeeNumber,
        leaveTypeName: r.leaveType.name,
        startDate: r.startDate.toISOString(),
        endDate: r.endDate.toISOString(),
        days: r.days,
      })),
    });
  });
}
