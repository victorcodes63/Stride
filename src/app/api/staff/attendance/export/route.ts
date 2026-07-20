import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { listOrgStaffUserIds } from '@/lib/staff-time-attendance/staff-directory';
import { toWorkDateUtc } from '@/lib/staff-time-attendance/attendance-serialize';

export const dynamic = 'force-dynamic';

function csvCell(value: string | number | null | undefined): string {
  const str = value == null ? '' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function fmtTime(value: Date | null): string {
  return value ? value.toISOString() : '';
}

/**
 * GET /api/staff/attendance/export
 * CSV export of day summaries for a date range. Filters: from, to, department, status.
 */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const sp = request.nextUrl.searchParams;
    const from = sp.get('from')?.trim() || undefined;
    const to = sp.get('to')?.trim() || undefined;
    const department = sp.get('department')?.trim() || undefined;
    const status = sp.get('status')?.trim() || undefined;

    const rows = await ctx.run(async (tx) => {
      const staffIds = await listOrgStaffUserIds(tx, ctx.organizationId);
      if (staffIds.length === 0) return [];
      return tx.staffAttendanceDaySummary.findMany({
        where: ctx.where({
          userId: { in: staffIds },
          ...(status && status !== 'all' ? { status } : {}),
          ...(department ? { user: { department } } : {}),
          ...(from || to
            ? {
                workDate: {
                  ...(from ? { gte: toWorkDateUtc(from) } : {}),
                  ...(to ? { lte: toWorkDateUtc(to) } : {}),
                },
              }
            : {}),
        }) as unknown as Prisma.StaffAttendanceDaySummaryWhereInput,
        include: { user: { select: { name: true, email: true, department: true } } },
        orderBy: [{ workDate: 'desc' }, { user: { name: 'asc' } }],
        take: 5000,
      });
    });

    const header = [
      'Work date',
      'Staff',
      'Email',
      'Department',
      'First in',
      'Last out',
      'Worked hours',
      'Late minutes',
      'Undertime minutes',
      'Overtime minutes',
      'Holiday OT minutes',
      'Public holiday',
      'Status',
    ];

    const lines = [header.map(csvCell).join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.workDate.toISOString().slice(0, 10),
          r.user?.name ?? '',
          r.user?.email ?? '',
          r.user?.department ?? '',
          fmtTime(r.firstInAt),
          fmtTime(r.lastOutAt),
          (r.minutesWorked / 60).toFixed(2),
          r.lateMinutes,
          r.undertimeMinutes,
          r.overtimeMinutes,
          r.holidayOvertimeMinutes,
          r.publicHolidayName ?? '',
          r.status,
        ]
          .map(csvCell)
          .join(','),
      );
    }

    const csv = `\uFEFF${lines.join('\n')}`;
    const filename = `staff-attendance_${from ?? 'all'}_${to ?? 'all'}.csv`;

    await ctx.audit({
      action: 'staff_attendance.export',
      entityType: 'StaffAttendanceDaySummary',
      route: 'GET /api/staff/attendance/export',
      metadata: { from, to, department, status, rows: rows.length },
    });

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  });
}
