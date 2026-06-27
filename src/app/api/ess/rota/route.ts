import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json({ items: [] });

    const from = new Date();
    const to = new Date();
    to.setUTCDate(to.getUTCDate() + 28);

    const rows = await ctx.run((tx) =>
      tx.shiftAssignment.findMany({
        where: ctx.where({
          employeeId: ctx.employeeId!,
          startsAt: { gte: from, lte: to },
        }),
        orderBy: { startsAt: 'asc' },
        include: {
          shiftTemplate: { select: { name: true } },
          rotaPeriod: { select: { name: true, status: true } },
        },
      }),
    );

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        workDate: r.workDate.toISOString().slice(0, 10),
        startsAt: r.startsAt.toISOString(),
        endsAt: r.endsAt.toISOString(),
        shiftName: r.shiftTemplate?.name ?? 'Shift',
        periodName: r.rotaPeriod.name,
        periodStatus: r.rotaPeriod.status,
        notes: r.notes,
      })),
    });
  });
}
