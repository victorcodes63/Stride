import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { canAccessTeamLeaveScope } from '@/lib/staff-api-auth';
import { getTeamLeaveMemberIds } from '@/lib/staff-leave-team';
import { STAFF_USER_TYPE_LABELS } from '@/lib/staff-permissions';
import type { StaffUserType } from '@/types/dashboard';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * GET ?year=&month= — team coverage calendar for a single month.
 * Returns team members and their approved/pending leave entries so the client
 * can render a who-is-off grid and flag same-department overlaps.
 */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessTeamLeaveScope(ctx.staff)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const now = new Date();
    const year = parseInt(sp.get('year') || String(now.getFullYear()), 10);
    const monthParam = parseInt(sp.get('month') || String(now.getMonth() + 1), 10);
    const month = Math.min(12, Math.max(1, Number.isNaN(monthParam) ? now.getMonth() + 1 : monthParam));

    const memberIds = await getTeamLeaveMemberIds(ctx.staff);
    if (memberIds.length === 0) {
      return NextResponse.json({ year, month, members: [], entries: [] });
    }

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const result = await ctx.run(async (tx) => {
      const [members, applications] = await Promise.all([
        tx.user.findMany({
          where: { id: { in: memberIds }, isActive: true },
          select: { id: true, name: true, email: true, department: true, staffUserType: true },
          orderBy: { name: 'asc' },
        }),
        tx.staffLeaveApplication.findMany({
          where: ctx.where({
            userId: { in: memberIds },
            status: { in: ['approved', 'pending'] },
            startDate: { lte: monthEnd },
            endDate: { gte: monthStart },
          }) as Prisma.StaffLeaveApplicationWhereInput,
          include: {
            leaveType: { select: { name: true, color: true } },
            user: { select: { name: true, department: true } },
          },
          orderBy: { startDate: 'asc' },
        }),
      ]);
      return { members, applications };
    });

    return NextResponse.json({
      year,
      month,
      members: result.members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        department:
          m.department?.trim() ||
          STAFF_USER_TYPE_LABELS[m.staffUserType as StaffUserType] ||
          'Unassigned',
      })),
      entries: result.applications.map((a) => ({
        id: a.id,
        userId: a.userId,
        userName: a.user.name,
        department: a.user.department?.trim() || 'Unassigned',
        leaveTypeName: a.leaveType.name,
        color: a.leaveType.color,
        startDate: iso(a.startDate),
        endDate: iso(a.endDate),
        status: a.status,
        totalDays: a.totalDays,
      })),
    });
  });
}
