import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json([]);

    if (ctx.essUser.role !== 'manager' && ctx.essUser.role !== 'hr') {
      return NextResponse.json({ error: 'Insufficient role to view team leave approvals.' }, { status: 403 });
    }

    const where =
      ctx.essUser.role === 'hr'
        ? ctx.where()
        : ctx.where({
            employee: {
              managerEmployeeId: ctx.employeeId!,
            },
          });

    const rows = await ctx.run((tx) =>
      tx.leaveApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          leaveType: { select: { name: true } },
          employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        },
      }),
    );

    return NextResponse.json(
      rows.map((item) => ({
        id: item.id,
        employeeId: item.employeeId,
        employeeName: `${item.employee.firstName} ${item.employee.lastName}`.trim(),
        employeeNumber: item.employee.employeeNumber,
        leaveTypeName: item.leaveType.name,
        startDate: item.startDate.toISOString(),
        endDate: item.endDate.toISOString(),
        days: item.days,
        status: item.status,
        reason: item.reason,
        createdAt: item.createdAt.toISOString(),
      })),
    );
  });
}
