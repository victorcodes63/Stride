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

  const teamLeaveWhere =
    user.role === 'hr'
      ? { status: 'pending' as const }
      : {
          status: 'pending' as const,
          ...(user.employeeId
            ? { employee: { managerEmployeeId: user.employeeId } }
            : { employeeId: 'none' }),
        };

  const [leavePending, onLeaveThisWeek] = await Promise.all([
    prisma.leaveApplication.count({ where: teamLeaveWhere }),
    prisma.leaveApplication.count({
      where: {
        status: 'approved',
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
        ...(user.role === 'hr'
          ? {}
          : user.employeeId
            ? { employee: { managerEmployeeId: user.employeeId } }
            : { employeeId: 'none' }),
      },
    }),
  ]);

  return NextResponse.json({
    leavePending,
    onLeaveThisWeek,
    attendancePending: 0,
  });
}
