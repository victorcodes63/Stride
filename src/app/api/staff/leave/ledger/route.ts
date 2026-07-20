import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/staff-api-auth';
import { canViewerApproveLeaveForUser } from '@/lib/staff-leave-team';
import { syncStaffLeaveUsedDaysForUserYear } from '@/lib/staff-leave-balance';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type LedgerEntryType = 'carry_forward' | 'accrual' | 'debit';

type LedgerEntry = {
  id: string;
  date: string;
  type: LedgerEntryType;
  label: string;
  /** Positive for credits (carry / accrual), negative for debits. */
  days: number;
  balanceAfter: number;
};

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * GET ?userId=&year= — derived balance ledger for one staff member.
 *
 * There is no dedicated ledger table for internal staff (LeaveBalanceLedger is
 * for outsourced employees), so the accrual / carry-forward / debit history is
 * reconstructed from StaffLeaveBalance + approved StaffLeaveApplication rows.
 */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const sp = request.nextUrl.searchParams;
    const year = parseInt(sp.get('year') || String(new Date().getFullYear()), 10);
    const targetUserId = sp.get('userId')?.trim() || ctx.staff.id;

    if (targetUserId !== ctx.staff.id && !isAdmin(ctx.staff)) {
      const allowed = await canViewerApproveLeaveForUser(ctx.staff, targetUserId);
      if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    const data = await ctx.run(async (tx) => {
      await syncStaffLeaveUsedDaysForUserYear(tx, targetUserId, year);
      const [balances, approved] = await Promise.all([
        tx.staffLeaveBalance.findMany({
          where: ctx.where({ userId: targetUserId, year }) as Prisma.StaffLeaveBalanceWhereInput,
          include: { leaveType: { select: { id: true, name: true, color: true, sortOrder: true } } },
          orderBy: { leaveType: { sortOrder: 'asc' } },
        }),
        tx.staffLeaveApplication.findMany({
          where: ctx.where({
            userId: targetUserId,
            status: 'approved',
            startDate: { gte: yearStart, lte: yearEnd },
          }) as Prisma.StaffLeaveApplicationWhereInput,
          select: { id: true, leaveTypeId: true, startDate: true, endDate: true, totalDays: true },
          orderBy: { startDate: 'asc' },
        }),
      ]);
      return { balances, approved };
    });

    const debitsByType = new Map<string, typeof data.approved>();
    for (const app of data.approved) {
      const list = debitsByType.get(app.leaveTypeId) ?? [];
      list.push(app);
      debitsByType.set(app.leaveTypeId, list);
    }

    const ledgers = data.balances.map((b) => {
      const entries: LedgerEntry[] = [];
      let running = 0;

      if (b.carriedOver !== 0) {
        running += b.carriedOver;
        entries.push({
          id: `${b.id}-carry`,
          date: `${year}-01-01`,
          type: 'carry_forward',
          label: `Carried forward from ${year - 1}`,
          days: b.carriedOver,
          balanceAfter: running,
        });
      }

      running += b.entitledDays;
      entries.push({
        id: `${b.id}-accrual`,
        date: `${year}-01-01`,
        type: 'accrual',
        label: `${year} entitlement`,
        days: b.entitledDays,
        balanceAfter: running,
      });

      for (const app of debitsByType.get(b.leaveTypeId) ?? []) {
        running -= app.totalDays;
        entries.push({
          id: app.id,
          date: iso(app.startDate),
          type: 'debit',
          label: `Leave taken (${iso(app.startDate)} → ${iso(app.endDate)})`,
          days: -app.totalDays,
          balanceAfter: running,
        });
      }

      return {
        leaveTypeId: b.leaveTypeId,
        name: b.leaveType.name,
        color: b.leaveType.color,
        entitled: b.entitledDays,
        carriedOver: b.carriedOver,
        used: b.usedDays,
        remaining: b.entitledDays + b.carriedOver - b.usedDays,
        entries,
      };
    });

    return NextResponse.json({ year, userId: targetUserId, ledgers });
  });
}
