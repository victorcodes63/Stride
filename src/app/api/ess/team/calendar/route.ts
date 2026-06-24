import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (user.role !== 'manager' && user.role !== 'hr') {
    return NextResponse.json({ error: 'Insufficient role.' }, { status: 403 });
  }

  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const where =
    user.role === 'hr'
      ? {
          status: 'approved' as const,
          startDate: { lte: weekEnd },
          endDate: { gte: now },
        }
      : {
          status: 'approved' as const,
          startDate: { lte: weekEnd },
          endDate: { gte: now },
          ...(user.employeeId
            ? { employee: { managerEmployeeId: user.employeeId } }
            : { employeeId: 'none' }),
        };

  const rows = await prisma.leaveApplication.findMany({
    where,
    orderBy: { startDate: 'asc' },
    include: {
      employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
      leaveType: { select: { name: true } },
    },
  });

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
}
