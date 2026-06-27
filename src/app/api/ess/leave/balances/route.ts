import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json([]);

    const year = Number(request.nextUrl.searchParams.get('year') || new Date().getFullYear());
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const { leaveTypes, balances, pending } = await ctx.run(async (tx) => {
      const types = await tx.leaveType.findMany({
        where: ctx.where(),
        orderBy: { name: 'asc' },
        select: { id: true, name: true, daysPerYear: true },
      });
      const balanceRows = await tx.leaveBalance.findMany({
        where: ctx.where({ employeeId: ctx.employeeId!, year }),
        select: { leaveTypeId: true, balance: true, used: true },
      });
      const pendingRows = await tx.leaveApplication.groupBy({
        by: ['leaveTypeId'],
        where: ctx.where({
          employeeId: ctx.employeeId!,
          status: 'pending',
          startDate: { gte: yearStart, lte: yearEnd },
        }),
        _sum: { days: true },
      });
      return { leaveTypes: types, balances: balanceRows, pending: pendingRows };
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
  });
}
