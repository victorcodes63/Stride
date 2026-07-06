import type { Prisma } from '@prisma/client';

import type { KpiMeasurementContext, KpiSourceProvider } from '@/lib/performance/kpi/kpi-source-provider';
import { prisma } from '@/lib/prisma';

export const TIME_ATTENDANCE_RATE_KEY = 'time.attendance_rate';
export const ATS_TIME_TO_HIRE_KEY = 'ats.time_to_hire_days';
export const HR_HEADCOUNT_TURNOVER_KEY = 'hr.headcount_turnover_pct';

function db(ctx: KpiMeasurementContext): Prisma.TransactionClient | typeof prisma {
  return ctx.tx ?? prisma;
}

async function measureAttendanceRate(ctx: KpiMeasurementContext) {
  const client = db(ctx);
  const rows = await client.attendanceDaySummary.findMany({
    where: {
      organizationId: ctx.organizationId,
      employeeId: ctx.employeeId,
      workDate: { gte: ctx.periodStart, lte: ctx.periodEnd },
    },
    select: { minutesWorked: true },
  });
  if (rows.length === 0) return null;

  const presentDays = rows.filter((row) => (row.minutesWorked ?? 0) > 0).length;
  const pct = Math.round((presentDays / rows.length) * 1000) / 10;
  return { value: pct, unit: '%', asOf: ctx.periodEnd.toISOString() };
}

async function measureTimeToHire(ctx: KpiMeasurementContext) {
  const client = db(ctx);
  const apps = await client.application.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: 'hired',
      updatedAt: { gte: ctx.periodStart, lte: ctx.periodEnd },
    },
    select: { appliedDate: true, updatedAt: true },
    take: 50,
  });
  if (apps.length === 0) return null;

  const days = apps.map((a) => {
    const ms = a.updatedAt.getTime() - a.appliedDate.getTime();
    return Math.max(0, Math.round(ms / 86_400_000));
  });
  const avg = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
  return { value: avg, unit: 'days', asOf: ctx.periodEnd.toISOString() };
}

async function measureHeadcountTurnover(ctx: KpiMeasurementContext) {
  const client = db(ctx);
  const [active, ended] = await Promise.all([
    client.employee.count({
      where: { organizationId: ctx.organizationId, employmentStatus: 'active' },
    }),
    client.employee.count({
      where: {
        organizationId: ctx.organizationId,
        employmentEndedAt: { gte: ctx.periodStart, lte: ctx.periodEnd },
      },
    }),
  ]);
  if (active === 0) return null;

  const pct = Math.round((ended / active) * 1000) / 10;
  return { value: pct, unit: '%', asOf: ctx.periodEnd.toISOString() };
}

export const timeAttendanceRateProvider: KpiSourceProvider = {
  key: TIME_ATTENDANCE_RATE_KEY,
  label: 'Attendance rate',
  module: 'time',
  measure: measureAttendanceRate,
};

export const atsTimeToHireProvider: KpiSourceProvider = {
  key: ATS_TIME_TO_HIRE_KEY,
  label: 'Average time to hire',
  module: 'ats',
  measure: measureTimeToHire,
};

export const hrHeadcountTurnoverProvider: KpiSourceProvider = {
  key: HR_HEADCOUNT_TURNOVER_KEY,
  label: 'Headcount turnover',
  module: 'core',
  measure: measureHeadcountTurnover,
};

export const BUILTIN_KPI_PROVIDERS: KpiSourceProvider[] = [
  timeAttendanceRateProvider,
  atsTimeToHireProvider,
  hrHeadcountTurnoverProvider,
];
