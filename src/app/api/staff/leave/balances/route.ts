import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser, isAdmin } from '@/lib/staff-api-auth';
import { syncStaffLeaveUsedDaysForUserYear } from '@/lib/staff-leave-balance';

/** GET ?year=2026 — my balances. Admin: ?userId= & year= */
export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const year = parseInt(request.nextUrl.searchParams.get('year') || String(new Date().getFullYear()), 10);
  const targetUserId = request.nextUrl.searchParams.get('userId')?.trim();
  const uid = isAdmin(user) && targetUserId ? targetUserId : user.id;

  await syncStaffLeaveUsedDaysForUserYear(prisma, uid, year);

  const balances = await prisma.staffLeaveBalance.findMany({
    where: { userId: uid, year },
    include: { leaveType: true },
    orderBy: { leaveType: { sortOrder: 'asc' } },
  });
  const pending = await prisma.staffLeaveApplication.groupBy({
    by: ['leaveTypeId'],
    where: { userId: uid, status: 'pending', startDate: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) } },
    _sum: { totalDays: true },
  });
  const pendingMap = new Map(pending.map((p) => [p.leaveTypeId, p._sum.totalDays ?? 0]));
  return NextResponse.json({
    year,
    userId: uid,
    balances: balances.map((b) => ({
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
}

/** POST admin: ensure all users have balances for year (entitled from type) */
export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  let body: { year?: number };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const year = body.year ?? new Date().getFullYear();
  const types = await prisma.staffLeaveType.findMany({ where: { active: true } });
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
  let created = 0;
  for (const u of users) {
    for (const t of types) {
      const existing = await prisma.staffLeaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId: u.id, leaveTypeId: t.id, year } },
      });
      if (!existing) {
        await prisma.staffLeaveBalance.create({
          data: {
            userId: u.id,
            leaveTypeId: t.id,
            year,
            entitledDays: t.daysPerYear,
            usedDays: 0,
            carriedOver: 0,
          },
        });
        created++;
      }
    }
  }
  return NextResponse.json({ ok: true, year, created });
}
