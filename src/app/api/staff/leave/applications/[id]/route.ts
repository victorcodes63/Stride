import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser, isAdmin, canApproveStaffLeaveRequests } from '@/lib/staff-api-auth';
import { logAuditEvent } from '@/lib/audit-events';
import { syncStaffLeaveUsedDaysForUserYear } from '@/lib/staff-leave-balance';
import { canViewerApproveLeaveForUser } from '@/lib/staff-leave-team';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  let body: { action?: string; reviewNote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const action = body.action;

  const app = await prisma.staffLeaveApplication.findUnique({
    where: { id },
    include: { leaveType: true, approvalSteps: { orderBy: { stepOrder: 'asc' } } },
  });
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'cancel') {
    if (app.userId !== user.id && !isAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (app.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending requests can be cancelled' }, { status: 400 });
    }
    const updated = await prisma.staffLeaveApplication.update({
      where: { id },
      data: { status: 'cancelled', approvalState: 'cancelled', reviewNote: body.reviewNote || null },
    });
    await prisma.leaveApprovalAction.create({
      data: {
        staffLeaveApplicationId: id,
        actorUserId: user.id,
        action: 'cancelled',
        note: body.reviewNote?.trim() || null,
      },
    });
    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'leave.cancelled',
      entityType: 'StaffLeaveApplication',
      entityId: id,
      route: 'PATCH /api/staff/leave/applications/[id]',
      metadata: { action: 'cancel', reviewNote: body.reviewNote?.trim() || null },
    });
    await syncStaffLeaveUsedDaysForUserYear(prisma, app.userId, app.startDate.getFullYear());
    return NextResponse.json(updated);
  }

  if (action === 'approve' || action === 'reject') {
    if (!canApproveStaffLeaveRequests(user)) {
      return NextResponse.json({ error: 'Not allowed to approve leave.' }, { status: 403 });
    }
    const mayAct = await canViewerApproveLeaveForUser(user, app.userId);
    if (!mayAct) {
      return NextResponse.json({ error: 'Not allowed to act on this request.' }, { status: 403 });
    }
    if (app.status !== 'pending') {
      return NextResponse.json({ error: 'Already decided' }, { status: 400 });
    }
    if (action === 'reject') {
      const updated = await prisma.staffLeaveApplication.update({
        where: { id },
        data: {
          status: 'rejected',
          approvalState: 'rejected',
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewNote: body.reviewNote?.trim() || null,
        },
      });
      await prisma.leaveApprovalStep.updateMany({
        where: { staffLeaveApplicationId: id, status: 'pending' },
        data: { status: 'rejected', actedAt: new Date(), notes: body.reviewNote?.trim() || null },
      });
      await prisma.leaveApprovalAction.create({
        data: {
          staffLeaveApplicationId: id,
          actorUserId: user.id,
          action: 'rejected',
          note: body.reviewNote?.trim() || null,
        },
      });
      await logAuditEvent({
        actor: { userId: user.id, email: user.email, name: user.name },
        action: 'leave.rejected',
        entityType: 'StaffLeaveApplication',
        entityId: id,
        route: 'PATCH /api/staff/leave/applications/[id]',
        metadata: { action: 'reject', reviewNote: body.reviewNote?.trim() || null },
      });
      return NextResponse.json(updated);
    }
    const year = app.startDate.getFullYear();
    const balance = await prisma.staffLeaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: { userId: app.userId, leaveTypeId: app.leaveTypeId, year },
      },
    });
    if (!balance) {
      return NextResponse.json({ error: 'No balance row for this year' }, { status: 400 });
    }
    const pendingOthers = await prisma.staffLeaveApplication.aggregate({
      where: {
        userId: app.userId,
        leaveTypeId: app.leaveTypeId,
        status: 'pending',
        id: { not: id },
        startDate: { gte: new Date(year, 0, 1) },
      },
      _sum: { totalDays: true },
    });
    const skipBalance = app.leaveType.daysPerYear <= 0;
    const available =
      balance.entitledDays + balance.carriedOver - balance.usedDays - (pendingOthers._sum.totalDays ?? 0);
    if (!skipBalance && available < app.totalDays) {
      return NextResponse.json({ error: `Insufficient balance (${available} days available)` }, { status: 400 });
    }
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.staffLeaveApplication.update({
        where: { id },
        data: {
          status: 'approved',
          approvalState: 'approved',
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewNote: body.reviewNote?.trim() || null,
        },
        include: { leaveType: true, user: { select: { name: true, email: true } } },
      });
      await tx.leaveApprovalStep.updateMany({
        where: { staffLeaveApplicationId: id, status: 'pending' },
        data: { status: 'approved', actedAt: new Date(), notes: body.reviewNote?.trim() || null },
      });
      await tx.leaveApprovalAction.create({
        data: {
          staffLeaveApplicationId: id,
          actorUserId: user.id,
          action: 'approved',
          note: body.reviewNote?.trim() || null,
        },
      });
      return u;
    });
    await syncStaffLeaveUsedDaysForUserYear(prisma, app.userId, year);
    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'leave.approved',
      entityType: 'StaffLeaveApplication',
      entityId: id,
      route: 'PATCH /api/staff/leave/applications/[id]',
      metadata: { action: 'approve', reviewNote: body.reviewNote?.trim() || null },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
