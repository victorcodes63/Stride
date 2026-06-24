import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json([]);

  const year = Number(request.nextUrl.searchParams.get('year') || new Date().getFullYear());
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const leaveTypes = await prisma.leaveType.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, daysPerYear: true },
  });
  const balances = await prisma.leaveBalance.findMany({
    where: { employeeId: user.employeeId, year },
    select: { leaveTypeId: true, balance: true, used: true },
  });
  const pending = await prisma.leaveApplication.groupBy({
    by: ['leaveTypeId'],
    where: {
      employeeId: user.employeeId,
      status: 'pending',
      startDate: { gte: yearStart, lte: yearEnd },
    },
    _sum: { days: true },
  });

  const balanceMap = new Map(balances.map((b) => [b.leaveTypeId, b]));
  const pendingMap = new Map(pending.map((p) => [p.leaveTypeId, p._sum.days ?? 0]));

  return NextResponse.json(
    leaveTypes.map((type) => {
      const row = balanceMap.get(type.id);
      const entitled = row?.balance ?? type.daysPerYear;
      const used = row?.used ?? 0;
      const pendingDays = pendingMap.get(type.id) ?? 0;
      return {
        leaveTypeId: type.id,
        leaveTypeName: type.name,
        entitled,
        used,
        pending: pendingDays,
        remaining: entitled - used - pendingDays,
      };
    }),
  );
}
