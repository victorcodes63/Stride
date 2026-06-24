import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ items: [] });

  const from = new Date();
  const to = new Date();
  to.setUTCDate(to.getUTCDate() + 28);

  const rows = await prisma.shiftAssignment.findMany({
    where: {
      employeeId: user.employeeId,
      startsAt: { gte: from, lte: to },
    },
    orderBy: { startsAt: 'asc' },
    include: {
      shiftTemplate: { select: { name: true } },
      rotaPeriod: { select: { name: true, status: true } },
    },
  });

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
}
