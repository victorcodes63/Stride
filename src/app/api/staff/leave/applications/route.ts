import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser, canAccessTeamLeaveScope } from '@/lib/staff-api-auth';
import { workingDaysBetween } from '@/lib/staff-leave-days';
import { getTeamLeaveMemberIds } from '@/lib/staff-leave-team';
import { syncStaffLeaveUsedDaysForUserYear } from '@/lib/staff-leave-balance';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const scope = request.nextUrl.searchParams.get('scope') || 'me';
  const status = request.nextUrl.searchParams.get('status') as
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'cancelled'
    | null;

  const where: Record<string, unknown> = {};
  if (scope === 'team' && canAccessTeamLeaveScope(user)) {
    const memberIds = await getTeamLeaveMemberIds(user);
    where.userId = { in: memberIds };
    if (status) where.status = status;
  } else {
    where.userId = user.id;
    if (status) where.status = status;
  }

  try {
    const list = await prisma.staffLeaveApplication.findMany({
      where,
      include: {
        leaveType: { select: { id: true, name: true, color: true } },
        user: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true } },
        approvalSteps: {
          orderBy: { stepOrder: 'asc' },
          select: {
            id: true,
            stepOrder: true,
            status: true,
            actedAt: true,
            approver: { select: { id: true, name: true } },
          },
        },
        approvalActions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, action: true, note: true, createdAt: true, actor: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json(list);
  } catch (error) {
    // Compatibility fallback: older generated Prisma clients can miss new relations.
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('Unknown field `approvalSteps`')) throw error;
    const baseList = await prisma.staffLeaveApplication.findMany({
      where,
      include: {
        leaveType: { select: { id: true, name: true, color: true } },
        user: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json(
      baseList.map((row) => ({
        ...row,
        approvalSteps: [],
        approvalActions: [],
      }))
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const leaveTypeId = String(body.leaveTypeId || '').trim();
  const start = new Date(String(body.startDate || ''));
  const end = new Date(String(body.endDate || ''));
  if (!leaveTypeId || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: 'leaveTypeId, startDate, endDate required' }, { status: 400 });
  }
  if (end < start) return NextResponse.json({ error: 'endDate before startDate' }, { status: 400 });

  const type = await prisma.staffLeaveType.findFirst({ where: { id: leaveTypeId, active: true } });
  if (!type) return NextResponse.json({ error: 'Leave type not found' }, { status: 404 });

  const totalDays =
    body.totalDays != null ? Math.max(1, parseInt(String(body.totalDays), 10) || 1) : workingDaysBetween(start, end);
  if (totalDays < 1) return NextResponse.json({ error: 'At least 1 working day' }, { status: 400 });

  const year = start.getFullYear();
  let balance = await prisma.staffLeaveBalance.findUnique({
    where: { userId_leaveTypeId_year: { userId: user.id, leaveTypeId, year } },
  });
  if (!balance) {
    balance = await prisma.staffLeaveBalance.create({
      data: {
        userId: user.id,
        leaveTypeId,
        year,
        entitledDays: type.daysPerYear,
        usedDays: 0,
        carriedOver: 0,
      },
    });
  }

  const skipBalance = type.daysPerYear <= 0; // e.g. unpaid leave
  const pendingSum = await prisma.staffLeaveApplication.aggregate({
    where: { userId: user.id, leaveTypeId, status: 'pending', startDate: { gte: new Date(year, 0, 1) } },
    _sum: { totalDays: true },
  });
  const pendingDays = pendingSum._sum.totalDays ?? 0;
  const available = balance.entitledDays + balance.carriedOver - balance.usedDays - pendingDays;
  if (!skipBalance && type.requiresApproval && available < totalDays) {
    return NextResponse.json(
      { error: `Insufficient balance. Available: ${available} days (pending requests count).` },
      { status: 400 }
    );
  }

  if (!type.requiresApproval) {
    const app = await prisma.$transaction(async (tx) => {
      const a = await tx.staffLeaveApplication.create({
        data: {
          userId: user.id,
          leaveTypeId,
          startDate: start,
          endDate: end,
          totalDays,
          reason: body.reason ? String(body.reason).trim() || null : null,
          status: 'approved',
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewNote: 'Auto-approved (no approval required)',
          approvalState: 'approved',
          currentStepOrder: 1,
        },
        include: { leaveType: true, user: { select: { name: true, email: true } } },
      });
      return a;
    });
    await syncStaffLeaveUsedDaysForUserYear(prisma, user.id, year);
    return NextResponse.json(app);
  }

  const app = await prisma.staffLeaveApplication.create({
    data: {
      userId: user.id,
      leaveTypeId,
      startDate: start,
      endDate: end,
      totalDays,
      reason: body.reason ? String(body.reason).trim() || null : null,
      status: 'pending',
      approvalState: 'pending',
      currentStepOrder: 1,
    },
    include: { leaveType: true, user: { select: { name: true, email: true } } },
  });
  const applicantRow = await prisma.user.findUnique({
    where: { id: user.id },
    select: { leaveApproverId: true },
  });
  const approverOr: Array<{ id: string } | { role: 'admin' } | { staffUserType: 'business_manager' }> = [];
  if (applicantRow?.leaveApproverId) {
    approverOr.push({ id: applicantRow.leaveApproverId });
  }
  approverOr.push({ role: 'admin' }, { staffUserType: 'business_manager' });

  const defaultApprover = await prisma.user.findFirst({
    where: {
      isActive: true,
      id: { not: user.id },
      OR: approverOr,
    },
    orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  if (defaultApprover) {
    await prisma.leaveApprovalStep.create({
      data: {
        staffLeaveApplicationId: app.id,
        stepOrder: 1,
        approverUserId: defaultApprover.id,
      },
    });
  }
  await prisma.leaveApprovalAction.create({
    data: {
      staffLeaveApplicationId: app.id,
      actorUserId: user.id,
      action: 'submitted',
      note: body.reason ? String(body.reason).trim() : null,
    },
  });
  return NextResponse.json(app);
}
