import { NextRequest, NextResponse } from 'next/server';
import {
  assertReportsStaffRole,
  parseDateParam,
  parseFormat,
  respondWithReport,
  startOfDayUtc,
  ymd,
} from '@/app/api/reports/_shared';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatEnum(value: string | null): string {
  if (!value) return 'Unspecified';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const denied = assertReportsStaffRole(ctx.staff);
    if (denied) return denied;
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const params = request.nextUrl.searchParams;
    const format = parseFormat(request);
    const defaultFrom = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const from = startOfDayUtc(parseDateParam(params.get('from'), defaultFrom));
    const toDay = startOfDayUtc(parseDateParam(params.get('to'), new Date()));
    const to = new Date(toDay.getTime() + 24 * 60 * 60 * 1000 - 1);

    const programs = await ctx.run((tx) =>
      tx.trainingProgram.findMany({
        where: {
          ...ctx.where(),
          OR: [
            { startDate: { gte: from, lte: to } },
            { startDate: null, createdAt: { gte: from, lte: to } },
          ],
        },
        select: {
          title: true,
          category: true,
          status: true,
          cost: true,
          startDate: true,
          enrollments: { select: { status: true } },
        },
        orderBy: { startDate: 'desc' },
      }),
    );

    const byStatusMap = new Map<string, { status: string; count: number }>();
    let totalEnrolments = 0;
    let completedEnrolments = 0;
    let totalCost = 0;

    const byProgram = programs.map((program) => {
      const enrolled = program.enrollments.length;
      const completed = program.enrollments.filter((e) => e.status === 'completed').length;
      totalEnrolments += enrolled;
      completedEnrolments += completed;
      totalCost += money(program.cost);

      const status = formatEnum(program.status);
      const s = byStatusMap.get(status) ?? { status, count: 0 };
      s.count += 1;
      byStatusMap.set(status, s);

      return {
        program: program.title,
        category: program.category ?? 'General',
        status: formatEnum(program.status),
        enrolled,
        completed,
        startDate: program.startDate ? ymd(program.startDate) : '',
      };
    });

    const byStatus = Array.from(byStatusMap.values()).sort((a, b) => b.count - a.count);
    const completionRate = totalEnrolments > 0 ? Math.round((completedEnrolments / totalEnrolments) * 100) : 0;

    const report = {
      from: ymd(from),
      to: ymd(toDay),
      totalPrograms: programs.length,
      totalEnrolments,
      completedEnrolments,
      completionRate,
      totalCost: round2(totalCost),
      byStatus,
      byProgram,
    };

    return respondWithReport({
      format,
      json: report,
      title: 'Training & Development Report',
      sheetName: 'Training',
      baseFilename: `training-${ymd(from)}_${ymd(toDay)}`,
      headers: ['Program', 'Category', 'Status', 'Enrolled', 'Completed'],
      rows: byProgram.map((row) => [row.program, row.category, row.status, row.enrolled, row.completed]),
      summaryLines: [
        `Period: ${ymd(from)} → ${ymd(toDay)}`,
        `Programs: ${report.totalPrograms}`,
        `Enrolments: ${report.totalEnrolments}`,
        `Completed: ${report.completedEnrolments} (${report.completionRate}%)`,
        `Total cost: ${report.totalCost}`,
      ],
    });
  });
}
