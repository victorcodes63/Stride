import type { Prisma, PrismaClient } from '@prisma/client';

import { computeAttainmentPercent } from '@/lib/sales/schema';

type Db = PrismaClient | Prisma.TransactionClient;

export type RepAttainmentRow = {
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  target: number;
  actual: number;
  attainmentPct: number | null;
  currency: string;
  pacingPct: number | null;
};

export type AttainmentReport = {
  periodStart: string;
  periodEnd: string;
  currency: string;
  teamTotals: {
    target: number;
    actual: number;
    attainmentPct: number | null;
  };
  reps: RepAttainmentRow[];
  leaderboard: RepAttainmentRow[];
};

function periodProgress(periodStart: Date, periodEnd: Date, now = new Date()): number {
  const start = periodStart.getTime();
  const end = periodEnd.getTime() + 86400000;
  if (now.getTime() <= start) return 0;
  if (now.getTime() >= end) return 100;
  return Math.round(((now.getTime() - start) / (end - start)) * 1000) / 10;
}

export async function buildAttainmentReport(
  db: Db,
  params: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
  },
): Promise<AttainmentReport> {
  const metrics = await db.salesRepPeriodMetric.findMany({
    where: {
      organizationId: params.organizationId,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
    },
    orderBy: { pipelineClosed: 'desc' },
  });

  const progress = periodProgress(params.periodStart, params.periodEnd);
  const currency = metrics[0]?.currency ?? 'KES';

  const reps: RepAttainmentRow[] = metrics.map((m) => {
    const target = Number(m.pipelineTarget);
    const actual = Number(m.pipelineClosed);
    const attainmentPct = computeAttainmentPercent(actual, target);
    const pacingPct =
      attainmentPct != null && progress > 0
        ? Math.round((attainmentPct / progress) * 1000) / 10
        : null;
    return {
      employeeId: m.employeeId,
      employeeName: `${m.employee.firstName} ${m.employee.lastName}`.trim(),
      departmentName: m.employee.department?.name ?? null,
      target,
      actual,
      attainmentPct,
      currency: m.currency,
      pacingPct,
    };
  });

  const teamTarget = reps.reduce((s, r) => s + r.target, 0);
  const teamActual = reps.reduce((s, r) => s + r.actual, 0);

  const leaderboard = [...reps].sort((a, b) => (b.attainmentPct ?? 0) - (a.attainmentPct ?? 0));

  return {
    periodStart: params.periodStart.toISOString().slice(0, 10),
    periodEnd: params.periodEnd.toISOString().slice(0, 10),
    currency,
    teamTotals: {
      target: Math.round(teamTarget * 100) / 100,
      actual: Math.round(teamActual * 100) / 100,
      attainmentPct: computeAttainmentPercent(teamActual, teamTarget),
    },
    reps,
    leaderboard,
  };
}
