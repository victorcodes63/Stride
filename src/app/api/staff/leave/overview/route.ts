import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser, canAccessTeamLeaveScope } from '@/lib/staff-api-auth';
import { syncStaffLeaveUsedDaysForUsersYear } from '@/lib/staff-leave-balance';
import { getTeamLeaveMemberIds } from '@/lib/staff-leave-team';

const LOW_BALANCE_THRESHOLD = 3;

/** GET ?year=2026 — team leave overview (approvers + admin). */
export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessTeamLeaveScope(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const year = parseInt(request.nextUrl.searchParams.get('year') || String(new Date().getFullYear()), 10);
  const memberIds = await getTeamLeaveMemberIds(user);
  if (memberIds.length === 0) {
    return NextResponse.json({
      year,
      kpis: {
        activeStaff: 0,
        pendingApprovals: 0,
        daysTakenYtd: 0,
        onLeaveToday: 0,
        lowBalanceCount: 0,
      },
      staff: [],
      upcoming: [],
      recentActivity: [],
    });
  }

  await syncStaffLeaveUsedDaysForUsersYear(prisma, memberIds, year);

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const [members, pendingApprovals, approvedApps, upcoming, recentActions] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: memberIds }, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        staffUserType: true,
        staffLeaveBalances: {
          where: { year },
          include: { leaveType: { select: { id: true, name: true, color: true, sortOrder: true } } },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.staffLeaveApplication.count({
      where: { userId: { in: memberIds }, status: 'pending' },
    }),
    prisma.staffLeaveApplication.findMany({
      where: {
        userId: { in: memberIds },
        status: 'approved',
        startDate: { gte: yearStart, lte: yearEnd },
      },
      select: { userId: true, totalDays: true, startDate: true, endDate: true, leaveType: { select: { name: true } } },
      orderBy: { startDate: 'desc' },
    }),
    prisma.staffLeaveApplication.findMany({
      where: {
        userId: { in: memberIds },
        status: 'approved',
        startDate: { gt: today },
      },
      include: {
        user: { select: { name: true } },
        leaveType: { select: { name: true, color: true } },
      },
      orderBy: { startDate: 'asc' },
      take: 8,
    }),
    prisma.leaveApprovalAction.findMany({
      where: {
        application: { userId: { in: memberIds } },
        action: { in: ['approved', 'rejected', 'submitted', 'cancelled'] },
      },
      include: {
        application: {
          select: {
            totalDays: true,
            user: { select: { name: true } },
            leaveType: { select: { name: true } },
          },
        },
        actor: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
  ]);

  const pendingByUser = await prisma.staffLeaveApplication.groupBy({
    by: ['userId'],
    where: { userId: { in: memberIds }, status: 'pending' },
    _count: { _all: true },
  });
  const pendingMap = new Map(pendingByUser.map((p) => [p.userId, p._count._all]));

  const lastApprovedByUser = new Map<string, { startDate: Date; endDate: Date; totalDays: number }>();
  for (const app of approvedApps) {
    if (!lastApprovedByUser.has(app.userId)) {
      lastApprovedByUser.set(app.userId, {
        startDate: app.startDate,
        endDate: app.endDate,
        totalDays: app.totalDays,
      });
    }
  }

  const annualType = await prisma.staffLeaveType.findFirst({
    where: { active: true, name: { contains: 'Annual', mode: 'insensitive' } },
    select: { id: true },
  });

  let onLeaveToday = 0;
  let lowBalanceCount = 0;
  let daysTakenYtd = 0;

  const staff = members.map((m) => {
    const balances = m.staffLeaveBalances
      .sort((a, b) => a.leaveType.sortOrder - b.leaveType.sortOrder)
      .map((b) => {
        const remaining = b.entitledDays + b.carriedOver - b.usedDays;
        return {
          leaveTypeId: b.leaveTypeId,
          name: b.leaveType.name,
          color: b.leaveType.color,
          entitledDays: b.entitledDays,
          carriedOver: b.carriedOver,
          usedDays: b.usedDays,
          remaining,
        };
      });

    const annualBal = annualType
      ? balances.find((b) => b.leaveTypeId === annualType.id)
      : balances.find((b) => /annual/i.test(b.name));

    const annualEntitled = annualBal ? annualBal.entitledDays + annualBal.carriedOver : 0;
    const annualUsed = annualBal?.usedDays ?? 0;
    const annualRemaining = annualBal?.remaining ?? 0;

    if (annualBal && annualRemaining <= LOW_BALANCE_THRESHOLD && annualEntitled > 0) {
      lowBalanceCount++;
    }

    const userApproved = approvedApps.filter((a) => a.userId === m.id);
    daysTakenYtd += userApproved.reduce((s, a) => s + a.totalDays, 0);

    const onLeave = userApproved.some((a) => {
      const s = new Date(a.startDate);
      s.setHours(0, 0, 0, 0);
      const e = new Date(a.endDate);
      e.setHours(23, 59, 59, 999);
      return s <= today && e >= today;
    });
    if (onLeave) onLeaveToday++;

    const last = lastApprovedByUser.get(m.id);

    return {
      id: m.id,
      name: m.name,
      email: m.email,
      staffUserType: m.staffUserType,
      annualEntitled,
      annualUsed,
      annualRemaining,
      pendingCount: pendingMap.get(m.id) ?? 0,
      lastLeave: last
        ? {
            startDate: last.startDate.toISOString(),
            endDate: last.endDate.toISOString(),
            totalDays: last.totalDays,
          }
        : null,
      balances,
    };
  });

  return NextResponse.json({
    year,
    kpis: {
      activeStaff: members.length,
      pendingApprovals,
      daysTakenYtd,
      onLeaveToday,
      lowBalanceCount,
    },
    staff,
    upcoming: upcoming.map((u) => ({
      id: u.id,
      userName: u.user.name,
      leaveType: u.leaveType.name,
      color: u.leaveType.color,
      startDate: u.startDate.toISOString(),
      endDate: u.endDate.toISOString(),
      totalDays: u.totalDays,
    })),
    recentActivity: recentActions.map((a) => ({
      id: a.id,
      action: a.action,
      at: a.createdAt.toISOString(),
      actorName: a.actor.name,
      userName: a.application.user.name,
      leaveType: a.application.leaveType.name,
      totalDays: a.application.totalDays,
    })),
  });
}
