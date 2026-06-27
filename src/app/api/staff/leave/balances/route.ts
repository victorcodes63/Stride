import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/staff-api-auth';
import { syncStaffLeaveUsedDaysForUserYear } from '@/lib/staff-leave-balance';
import { withTenant } from '@/lib/tenant-api';

/** GET ?year=2026 — my balances. Admin: ?userId= & year= */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const year = parseInt(request.nextUrl.searchParams.get('year') || String(new Date().getFullYear()), 10);
    const targetUserId = request.nextUrl.searchParams.get('userId')?.trim();
    const uid = isAdmin(ctx.staff) && targetUserId ? targetUserId : ctx.staff.id;

    const data = await ctx.run(async (tx) => {
      await syncStaffLeaveUsedDaysForUserYear(tx, uid, year);

      const balances = await tx.staffLeaveBalance.findMany({
        where: ctx.where({ userId: uid, year }),
        include: { leaveType: true },
        orderBy: { leaveType: { sortOrder: 'asc' } },
      });
      const pending = await tx.staffLeaveApplication.groupBy({
        by: ['leaveTypeId'],
        where: ctx.where({
          userId: uid,
          status: 'pending',
          startDate: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) },
        }),
        _sum: { totalDays: true },
      });
      return { balances, pending };
    });

    const pendingMap = new Map(data.pending.map((p) => [p.leaveTypeId, p._sum.totalDays ?? 0]));
    return NextResponse.json({
      year,
      userId: uid,
      balances: data.balances.map((b) => ({
        id: b.id,
        leaveTypeId: b.leaveTypeId,
        name: b.leaveType.name,
        color: b.leaveType.color,
        entitledDays: b.entitledDays,
        usedDays: b.usedDays,
        carriedOver: b.carriedOver,
        pendingDays: pendingMap.get(b.leaveTypeId) ?? 0,
        remaining: b.entitledDays + b.carriedOver - b.usedDays,
      })),
    });
  });
}

/** POST admin: ensure all users have balances for year (entitled from type) */
export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!isAdmin(ctx.staff)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    let body: { year?: number };
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const year = body.year ?? new Date().getFullYear();

    const created = await ctx.run(async (tx) => {
      const types = await tx.staffLeaveType.findMany({ where: ctx.where({ active: true }) });
      const users = await tx.user.findMany({ where: { isActive: true }, select: { id: true } });
      let count = 0;
      for (const u of users) {
        for (const t of types) {
          const existing = await tx.staffLeaveBalance.findFirst({
            where: ctx.where({ userId: u.id, leaveTypeId: t.id, year }),
          });
          if (!existing) {
            await tx.staffLeaveBalance.create({
              data: {
                organizationId: ctx.organizationId,
                userId: u.id,
                leaveTypeId: t.id,
                year,
                entitledDays: t.daysPerYear,
                usedDays: 0,
                carriedOver: 0,
              },
            });
            count++;
          }
        }
      }
      return count;
    });

    return NextResponse.json({ ok: true, year, created });
  });
}
