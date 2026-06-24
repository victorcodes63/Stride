import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json([]);

  if (user.role !== 'manager' && user.role !== 'hr') {
    return NextResponse.json({ error: 'Insufficient role to view team leave approvals.' }, { status: 403 });
  }

  const where =
    user.role === 'hr'
      ? {}
      : {
          employee: {
            managerEmployeeId: user.employeeId,
          },
        };

  const rows = await prisma.leaveApplication.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      leaveType: { select: { name: true } },
      employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
    },
  });

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
}
