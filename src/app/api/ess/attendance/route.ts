import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';

function parseDateOnly(value: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });

  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 });

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get('page') || 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize') || 20)));
  const from = parseDateOnly(params.get('from'));
  const to = parseDateOnly(params.get('to'));

  const where = {
    employeeId: user.employeeId,
    ...(from || to
      ? {
          workDate: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [total, summaries] = await Promise.all([
    prisma.attendanceDaySummary.count({ where }),
    prisma.attendanceDaySummary.findMany({
      where,
      orderBy: { workDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        workDate: true,
        firstInAt: true,
        lastOutAt: true,
        minutesWorked: true,
        overtimeMinutes: true,
        lateMinutes: true,
        status: true,
      },
    }),
  ]);

  const workDates = summaries.map((s) => s.workDate);
  const [shiftAssignments, exceptions] = await Promise.all([
    workDates.length
      ? prisma.shiftAssignment.findMany({
          where: {
            employeeId: user.employeeId,
            workDate: { in: workDates },
          },
          select: {
            workDate: true,
            startsAt: true,
            endsAt: true,
            shiftTemplate: { select: { name: true } },
          },
          orderBy: [{ workDate: 'desc' }, { startsAt: 'asc' }],
        })
      : Promise.resolve([]),
    workDates.length
      ? prisma.attendanceException.findMany({
          where: {
            employeeId: user.employeeId,
            workDate: { in: workDates },
          },
          select: {
            workDate: true,
            type: true,
            status: true,
            description: true,
            resolvedByUser: { select: { name: true, email: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const assignmentByDate = new Map<string, (typeof shiftAssignments)[number]>();
  for (const assignment of shiftAssignments) {
    const key = assignment.workDate.toISOString().slice(0, 10);
    if (!assignmentByDate.has(key)) assignmentByDate.set(key, assignment);
  }

  const exceptionsByDate = new Map<string, typeof exceptions>();
  for (const item of exceptions) {
    const key = item.workDate.toISOString().slice(0, 10);
    const current = exceptionsByDate.get(key) ?? [];
    current.push(item);
    exceptionsByDate.set(key, current);
  }

  const items = summaries.map((row) => {
    const dateKey = row.workDate.toISOString().slice(0, 10);
    const assignment = assignmentByDate.get(dateKey) ?? null;
    const rowExceptions = exceptionsByDate.get(dateKey) ?? [];

    const missingOut = rowExceptions.some((item) => item.type === 'missing_check_out' && item.status === 'open');
    const missingIn = rowExceptions.some((item) => item.type === 'missing_check_in' && item.status === 'open');
    const correctedBy = rowExceptions.find((item) => item.resolvedByUser?.name || item.resolvedByUser?.email)?.resolvedByUser;

    const derivedStatus = missingOut || missingIn
      ? 'pending_review'
      : row.lateMinutes > 0
        ? 'late'
        : row.status === 'approved'
          ? 'corrected'
          : 'complete';

    const note = missingOut
      ? 'Missing clock-out — supervisor notified'
      : missingIn
        ? 'Missing clock-in — supervisor notified'
        : derivedStatus === 'corrected'
          ? `Corrected by ${correctedBy?.name || correctedBy?.email || 'supervisor'}`
          : null;

    return {
      date: row.workDate.toISOString(),
      shiftName: assignment?.shiftTemplate?.name || 'Unscheduled',
      scheduledStart: assignment?.startsAt.toISOString() ?? null,
      scheduledEnd: assignment?.endsAt.toISOString() ?? null,
      clockIn: row.firstInAt?.toISOString() ?? null,
      clockOut: row.lastOutAt?.toISOString() ?? null,
      totalHours: Number((row.minutesWorked / 60).toFixed(1)),
      overtimeHours: Number((row.overtimeMinutes / 60).toFixed(1)),
      lateMinutes: row.lateMinutes,
      status: derivedStatus,
      note,
    };
  });

  return NextResponse.json({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    from: from?.toISOString() ?? null,
    to: to ? addDays(to, 1).toISOString() : null,
  });
}
