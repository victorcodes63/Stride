import type { Prisma } from '@prisma/client';
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
            organizationId: ctx.organizationId,
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
      if (app.status !== 'pending') {
        return NextResponse.json({ error: 'Already decided' }, { status: 400 });
      }

      const steps = app.approvalSteps ?? [];
      const pendingSteps = steps.filter((s) => s.status === 'pending');
      // The step awaiting action is the current one (by order), else the first pending.
      const currentStep =
        pendingSteps.find((s) => s.stepOrder === app.currentStepOrder) ?? pendingSteps[0] ?? null;

      // Authorization: an admin, the applicant's manager, or the approver
      // assigned to the current pending step may act.
      const isStepApprover = currentStep?.approverUserId === ctx.staff.id;
      const mayAct =
        isAdmin(ctx.staff) || isStepApprover || (await canViewerApproveLeaveForUser(ctx.staff, app.userId));
      if (!mayAct) {
        return NextResponse.json({ error: 'Not allowed to act on this request.' }, { status: 403 });
      }

      const reviewNote = body.reviewNote?.trim() || null;

      if (action === 'reject') {
        const updated = await ctx.run(async (tx) => {
          const row = await tx.staffLeaveApplication.update({
            where: { id },
            data: {
              status: 'rejected',
              approvalState: 'rejected',
              reviewedById: ctx.staff.id,
              reviewedAt: new Date(),
              reviewNote,
            },
          });
          await tx.leaveApprovalStep.updateMany({
            where: { staffLeaveApplicationId: id, status: 'pending' },
            data: { status: 'rejected', actedAt: new Date(), notes: reviewNote },
          });
          await tx.leaveApprovalAction.create({
            data: {
              organizationId: ctx.organizationId,
              staffLeaveApplicationId: id,
              leaveApprovalStepId: currentStep?.id ?? null,
              actorUserId: ctx.staff.id,
              action: 'rejected',
              note: reviewNote,
            },
          });
          return row;
        });
        await ctx.audit({
          action: 'leave.rejected',
          entityType: 'StaffLeaveApplication',
          entityId: id,
          route: 'PATCH /api/staff/leave/applications/[id]',
          metadata: { action: 'reject', reviewNote, stepOrder: currentStep?.stepOrder ?? null },
        });
        return NextResponse.json(updated);
      }

      // ── APPROVE ─────────────────────────────────────────────────────────
      // Advance one step. Only the final step finalizes the whole request.
      const remainingAfterThis = pendingSteps.filter(
        (s) => currentStep == null || s.id !== currentStep.id,
      );
      const isFinalStep = remainingAfterThis.length === 0;

      if (!isFinalStep) {
        const nextStep = remainingAfterThis
          .slice()
          .sort((a, b) => a.stepOrder - b.stepOrder)[0]!;
        const updated = await ctx.run(async (tx) => {
          if (currentStep) {
            await tx.leaveApprovalStep.update({
              where: { id: currentStep.id },
              data: { status: 'approved', actedAt: new Date(), notes: reviewNote },
            });
          }
          await tx.leaveApprovalAction.create({
            data: {
              organizationId: ctx.organizationId,
              staffLeaveApplicationId: id,
              leaveApprovalStepId: currentStep?.id ?? null,
              actorUserId: ctx.staff.id,
              action: 'approved',
              note: reviewNote,
            },
          });
          return tx.staffLeaveApplication.update({
            where: { id },
            data: { approvalState: 'in_progress', currentStepOrder: nextStep.stepOrder },
            include: { leaveType: true, user: { select: { name: true, email: true } } },
          });
        });
        await ctx.audit({
          action: 'leave.step_approved',
          entityType: 'StaffLeaveApplication',
          entityId: id,
          route: 'PATCH /api/staff/leave/applications/[id]',
          metadata: {
            action: 'approve',
            reviewNote,
            stepOrder: currentStep?.stepOrder ?? null,
            nextStepOrder: nextStep.stepOrder,
          },
        });
        return NextResponse.json(updated);
      }

      // Final step (or no steps at all): validate balance then approve fully.
      const year = app.startDate.getFullYear();
      const balance = await ctx.run((tx) =>
        tx.staffLeaveBalance.findFirst({
          where: ctx.where({
            userId: app.userId,
            leaveTypeId: app.leaveTypeId,
            year,
          }) as Prisma.StaffLeaveBalanceWhereInput,
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
          }) as Prisma.StaffLeaveApplicationWhereInput,
          _sum: { totalDays: true },
        }),
      );

      const skipBalance = app.leaveType.daysPerYear <= 0;
      const available =
        balance.entitledDays + balance.carriedOver - balance.usedDays - (pendingOthers._sum?.totalDays ?? 0);
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
            reviewNote,
          },
          include: { leaveType: true, user: { select: { name: true, email: true } } },
        });
        await tx.leaveApprovalStep.updateMany({
          where: { staffLeaveApplicationId: id, status: 'pending' },
          data: { status: 'approved', actedAt: new Date(), notes: reviewNote },
        });
        await tx.leaveApprovalAction.create({
          data: {
            organizationId: ctx.organizationId,
            staffLeaveApplicationId: id,
            leaveApprovalStepId: currentStep?.id ?? null,
            actorUserId: ctx.staff.id,
            action: 'approved',
            note: reviewNote,
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
        metadata: { action: 'approve', reviewNote, final: true },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  });
}
