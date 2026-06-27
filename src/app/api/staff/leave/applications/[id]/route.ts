import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, canApproveStaffLeaveRequests } from '@/lib/staff-api-auth';
import { syncStaffLeaveUsedDaysForUserYear } from '@/lib/staff-leave-balance';
import { canViewerApproveLeaveForUser } from '@/lib/staff-leave-team';
import { withTenant } from '@/lib/tenant-api';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    let body: { action?: string; reviewNote?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const action = body.action;

    const app = await ctx.run((tx) =>
      tx.staffLeaveApplication.findFirst({
        where: ctx.where({ id }),
        include: { leaveType: true, approvalSteps: { orderBy: { stepOrder: 'asc' } } },
      }),
    );
    if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (action === 'cancel') {
      if (app.userId !== ctx.staff.id && !isAdmin(ctx.staff)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (app.status !== 'pending') {
        return NextResponse.json({ error: 'Only pending requests can be cancelled' }, { status: 400 });
      }
      const updated = await ctx.run(async (tx) => {
        const row = await tx.staffLeaveApplication.update({
          where: { id },
          data: { status: 'cancelled', approvalState: 'cancelled', reviewNote: body.reviewNote || null },
        });
        await tx.leaveApprovalAction.create({
          data: {
            staffLeaveApplicationId: id,
            actorUserId: ctx.staff.id,
            action: 'cancelled',
            note: body.reviewNote?.trim() || null,
          },
        });
        return row;
      });
      await ctx.audit({
        action: 'leave.cancelled',
        entityType: 'StaffLeaveApplication',
        entityId: id,
        route: 'PATCH /api/staff/leave/applications/[id]',
        metadata: { action: 'cancel', reviewNote: body.reviewNote?.trim() || null },
      });
      await ctx.run((tx) => syncStaffLeaveUsedDaysForUserYear(tx, app.userId, app.startDate.getFullYear()));
      return NextResponse.json(updated);
    }

    if (action === 'approve' || action === 'reject') {
      if (!canApproveStaffLeaveRequests(ctx.staff)) {
        return NextResponse.json({ error: 'Not allowed to approve leave.' }, { status: 403 });
      }
      const mayAct = await canViewerApproveLeaveForUser(ctx.staff, app.userId);
      if (!mayAct) {
        return NextResponse.json({ error: 'Not allowed to act on this request.' }, { status: 403 });
      }
      if (app.status !== 'pending') {
        return NextResponse.json({ error: 'Already decided' }, { status: 400 });
      }
      if (action === 'reject') {
        const updated = await ctx.run(async (tx) => {
          const row = await tx.staffLeaveApplication.update({
            where: { id },
            data: {
              status: 'rejected',
              approvalState: 'rejected',
              reviewedById: ctx.staff.id,
              reviewedAt: new Date(),
              reviewNote: body.reviewNote?.trim() || null,
            },
          });
          await tx.leaveApprovalStep.updateMany({
            where: { staffLeaveApplicationId: id, status: 'pending' },
            data: { status: 'rejected', actedAt: new Date(), notes: body.reviewNote?.trim() || null },
          });
          await tx.leaveApprovalAction.create({
            data: {
              staffLeaveApplicationId: id,
              actorUserId: ctx.staff.id,
              action: 'rejected',
              note: body.reviewNote?.trim() || null,
            },
          });
          return row;
        });
        await ctx.audit({
          action: 'leave.rejected',
          entityType: 'StaffLeaveApplication',
          entityId: id,
          route: 'PATCH /api/staff/leave/applications/[id]',
          metadata: { action: 'reject', reviewNote: body.reviewNote?.trim() || null },
        });
        return NextResponse.json(updated);
      }

      const year = app.startDate.getFullYear();
      const balance = await ctx.run((tx) =>
        tx.staffLeaveBalance.findFirst({
          where: ctx.where({
            userId: app.userId,
            leaveTypeId: app.leaveTypeId,
            year,
          }),
        }),
      );
      if (!balance) {
        return NextResponse.json({ error: 'No balance row for this year' }, { status: 400 });
      }

      const pendingOthers = await ctx.run((tx) =>
        tx.staffLeaveApplication.aggregate({
          where: ctx.where({
            userId: app.userId,
            leaveTypeId: app.leaveTypeId,
            status: 'pending',
            id: { not: id },
            startDate: { gte: new Date(year, 0, 1) },
          }),
          _sum: { totalDays: true },
        }),
      );

      const skipBalance = app.leaveType.daysPerYear <= 0;
      const available =
        balance.entitledDays + balance.carriedOver - balance.usedDays - (pendingOthers._sum.totalDays ?? 0);
      if (!skipBalance && available < app.totalDays) {
        return NextResponse.json({ error: `Insufficient balance (${available} days available)` }, { status: 400 });
      }

      const updated = await ctx.run(async (tx) => {
        const u = await tx.staffLeaveApplication.update({
          where: { id },
          data: {
            status: 'approved',
            approvalState: 'approved',
            reviewedById: ctx.staff.id,
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
            actorUserId: ctx.staff.id,
            action: 'approved',
            note: body.reviewNote?.trim() || null,
          },
        });
        return u;
      });

      await ctx.run((tx) => syncStaffLeaveUsedDaysForUserYear(tx, app.userId, year));
      await ctx.audit({
        action: 'leave.approved',
        entityType: 'StaffLeaveApplication',
        entityId: id,
        route: 'PATCH /api/staff/leave/applications/[id]',
        metadata: { action: 'approve', reviewNote: body.reviewNote?.trim() || null },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  });
}
