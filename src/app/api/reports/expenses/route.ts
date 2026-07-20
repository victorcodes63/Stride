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

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const denied = assertReportsStaffRole(ctx.staff);
    if (denied) return denied;
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const params = request.nextUrl.searchParams;
    const format = parseFormat(request);
    const defaultFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const from = startOfDayUtc(parseDateParam(params.get('from'), defaultFrom));
    const toDay = startOfDayUtc(parseDateParam(params.get('to'), new Date()));
    const to = new Date(toDay.getTime() + 24 * 60 * 60 * 1000 - 1);

    const claims = await ctx.run((tx) =>
      tx.expenseClaim.findMany({
        where: { ...ctx.where(), createdAt: { gte: from, lte: to } },
        select: {
          claimNumber: true,
          claimantName: true,
          department: true,
          status: true,
          currency: true,
          totalAmount: true,
          submittedAt: true,
          approvedAt: true,
          reimbursedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    );

    const byStatusMap = new Map<string, { status: string; count: number; amount: number }>();
    const byDeptMap = new Map<string, { department: string; count: number; amount: number }>();
    let totalAmount = 0;
    let pendingReimbursement = 0;

    for (const claim of claims) {
      const amount = money(claim.totalAmount);
      totalAmount += amount;

      const status = claim.status ?? 'draft';
      const s = byStatusMap.get(status) ?? { status, count: 0, amount: 0 };
      s.count += 1;
      s.amount += amount;
      byStatusMap.set(status, s);

      const dept = claim.department?.trim() || 'Unassigned';
      const d = byDeptMap.get(dept) ?? { department: dept, count: 0, amount: 0 };
      d.count += 1;
      d.amount += amount;
      byDeptMap.set(dept, d);

      if (claim.approvedAt && !claim.reimbursedAt) pendingReimbursement += amount;
    }

    const byStatus = Array.from(byStatusMap.values())
      .map((row) => ({ ...row, amount: round2(row.amount) }))
      .sort((a, b) => b.amount - a.amount);
    const byDepartment = Array.from(byDeptMap.values())
      .map((row) => ({ ...row, amount: round2(row.amount) }))
      .sort((a, b) => b.amount - a.amount);

    const details = claims.map((claim) => ({
      claimNumber: claim.claimNumber,
      claimant: claim.claimantName,
      department: claim.department ?? 'Unassigned',
      status: claim.status,
      amount: money(claim.totalAmount),
      currency: claim.currency,
      submitted: claim.submittedAt ? ymd(claim.submittedAt) : '',
      reimbursed: claim.reimbursedAt ? ymd(claim.reimbursedAt) : '',
    }));

    const report = {
      from: ymd(from),
      to: ymd(toDay),
      totalClaims: claims.length,
      totalAmount: round2(totalAmount),
      pendingReimbursement: round2(pendingReimbursement),
      byStatus,
      byDepartment,
      details,
    };

    return respondWithReport({
      format,
      json: report,
      title: 'Expense Claims Report',
      sheetName: 'Expenses',
      baseFilename: `expenses-${ymd(from)}_${ymd(toDay)}`,
      headers: ['Status', 'Claims', 'Amount'],
      rows: byStatus.map((row) => [row.status, row.count, row.amount]),
      summaryLines: [
        `Period: ${ymd(from)} → ${ymd(toDay)}`,
        `Total claims: ${report.totalClaims}`,
        `Total value: ${report.totalAmount}`,
        `Pending reimbursement: ${report.pendingReimbursement}`,
      ],
    });
  });
}
