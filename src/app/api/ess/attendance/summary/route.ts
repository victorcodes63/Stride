import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';

function monthRange(monthParam: string | null): { from: Date; to: Date; month: string } {
  const now = new Date();
  const fallback = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const month = /^\d{4}-\d{2}$/.test(monthParam || '') ? (monthParam as string) : fallback;
  const [year, monthIndex] = month.split('-').map(Number);
  const from = new Date(Date.UTC(year, monthIndex - 1, 1));
  const to = new Date(Date.UTC(year, monthIndex, 1));
  return { from, to, month };
}

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });

  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) {
    return NextResponse.json({
      month: null,
      totalDaysWorked: 0,
      totalScheduledDays: 0,
      totalHours: 0,
      overtimeHours: 0,
      lateCount: 0,
      absentCount: 0,
      pendingReviewCount: 0,
    });
  }

  const { month, from, to } = monthRange(request.nextUrl.searchParams.get('month'));

  const [summaries, exceptions, scheduled] = await Promise.all([
    prisma.attendanceDaySummary.findMany({
      where: {
        employeeId: user.employeeId,
        workDate: {
          gte: from,
          lt: to,
        },
      },
      select: {
        workDate: true,
        minutesWorked: true,
        overtimeMinutes: true,
        lateMinutes: true,
        status: true,
      },
    }),
    prisma.attendanceException.findMany({
      where: {
        employeeId: user.employeeId,
        workDate: {
          gte: from,
          lt: to,
        },
      },
      select: {
        workDate: true,
        type: true,
        status: true,
      },
    }),
    prisma.shiftAssignment.findMany({
      where: {
        employeeId: user.employeeId,
        workDate: {
          gte: from,
          lt: to,
        },
      },
      select: { workDate: true },
    }),
  ]);

  const summaryByDate = new Map<string, (typeof summaries)[number]>();
  for (const row of summaries) summaryByDate.set(row.workDate.toISOString().slice(0, 10), row);

  const exceptionsByDate = new Map<string, (typeof exceptions)[number][]>();
  for (const row of exceptions) {
    const key = row.workDate.toISOString().slice(0, 10);
    const bucket = exceptionsByDate.get(key) ?? [];
    bucket.push(row);
    exceptionsByDate.set(key, bucket);
  }

  const scheduledDates = new Set(scheduled.map((row) => row.workDate.toISOString().slice(0, 10)));
  let absentCount = 0;
  for (const dateKey of scheduledDates) {
    const attendance = summaryByDate.get(dateKey);
    if (!attendance || attendance.minutesWorked <= 0) absentCount += 1;
  }

  const totalMinutes = summaries.reduce((sum, row) => sum + row.minutesWorked, 0);
  const overtimeMinutes = summaries.reduce((sum, row) => sum + row.overtimeMinutes, 0);
  const totalDaysWorked = summaries.filter((row) => row.minutesWorked > 0).length;
  const lateCount = summaries.filter((row) => row.lateMinutes > 0).length;
  const pendingReviewCount = summaries.filter((row) => {
    const key = row.workDate.toISOString().slice(0, 10);
    const rowExceptions = exceptionsByDate.get(key) ?? [];
    const hasOpenMissing = rowExceptions.some(
      (item) => item.status === 'open' && (item.type === 'missing_check_in' || item.type === 'missing_check_out')
    );
    return hasOpenMissing || row.status === 'draft';
  }).length;

  return NextResponse.json({
    month,
    totalDaysWorked,
    totalScheduledDays: scheduledDates.size,
    totalHours: Number((totalMinutes / 60).toFixed(1)),
    overtimeHours: Number((overtimeMinutes / 60).toFixed(1)),
    lateCount,
    absentCount,
    pendingReviewCount,
  });
}
