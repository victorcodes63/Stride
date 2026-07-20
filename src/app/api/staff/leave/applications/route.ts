import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { canAccessTeamLeaveScope } from '@/lib/staff-api-auth';
import { workingDaysBetween } from '@/lib/staff-leave-days';
import { getTeamLeaveMemberIds } from '@/lib/staff-leave-team';
import { syncStaffLeaveUsedDaysForUserYear } from '@/lib/staff-leave-balance';
import { resolveStaffLeaveApprovalChain } from '@/lib/leave/approval-chain';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const scope = request.nextUrl.searchParams.get('scope') || 'me';
    const status = request.nextUrl.searchParams.get('status') as
      | 'pending'
      | 'approved'
      | 'rejected'
      | 'cancelled'
      | null;

    const filter: Prisma.StaffLeaveApplicationWhereInput = {};
    if (scope === 'team' && canAccessTeamLeaveScope(ctx.staff)) {
      const memberIds = await getTeamLeaveMemberIds(ctx.staff);
      // Visible when the viewer manages the applicant OR is the approver on the
      // current pending step (so multi-step approvers see items awaiting them).
      filter.OR = [
        { userId: { in: memberIds } },
        { approvalSteps: { some: { approverUserId: ctx.staff.id, status: 'pending' } } },
      ];
    } else {
      filter.userId = ctx.staff.id;
    }
    if (status) filter.status = status;
    const where = ctx.where(filter) as Prisma.StaffLeaveApplicationWhereInput;

    try {
      const list = await ctx.run((tx) =>
        tx.staffLeaveApplication.findMany({
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
              select: {
                id: true,
                action: true,
                note: true,
                createdAt: true,
                actor: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
      );
      return NextResponse.json(list);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!message.includes('Unknown field `approvalSteps`')) throw error;
      const baseList = await ctx.run((tx) =>
        tx.staffLeaveApplication.findMany({
          where,
          include: {
            leaveType: { select: { id: true, name: true, color: true } },
            user: { select: { id: true, name: true, email: true } },
            reviewedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
      );
      return NextResponse.json(
        baseList.map((row) => ({
          ...row,
          approvalSteps: [],
          approvalActions: [],
        })),
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
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

    const totalDays =
      body.totalDays != null ? Math.max(1, parseInt(String(body.totalDays), 10) || 1) : workingDaysBetween(start, end);
    if (totalDays < 1) return NextResponse.json({ error: 'At least 1 working day' }, { status: 400 });

    const year = start.getFullYear();

    const result = await ctx.run(async (tx) => {
      const type = await tx.staffLeaveType.findFirst({
        where: ctx.where({ id: leaveTypeId, active: true }),
      });
      if (!type) return { error: 'Leave type not found' as const };

      let balance = await tx.staffLeaveBalance.findFirst({
        where: ctx.where({
          userId: ctx.staff.id,
          leaveTypeId,
          year,
        }),
      });
      if (!balance) {
        balance = await tx.staffLeaveBalance.create({
          data: {
            organizationId: ctx.organizationId,
            userId: ctx.staff.id,
            leaveTypeId,
            year,
            entitledDays: type.daysPerYear,
            usedDays: 0,
            carriedOver: 0,
          },
        });
      }

      const skipBalance = type.daysPerYear <= 0;
      const pendingSum = await tx.staffLeaveApplication.aggregate({
        where: ctx.where({
          userId: ctx.staff.id,
          leaveTypeId,
          status: 'pending',
          startDate: { gte: new Date(year, 0, 1) },
        }) as Prisma.StaffLeaveApplicationWhereInput,
        _sum: { totalDays: true },
      });
      const pendingDays = pendingSum._sum?.totalDays ?? 0;
      const available = balance.entitledDays + balance.carriedOver - balance.usedDays - pendingDays;
      if (!skipBalance && type.requiresApproval && available < totalDays) {
        return {
          error: `Insufficient balance. Available: ${available} days (pending requests count).`,
        };
      }

      if (!type.requiresApproval) {
        const app = await tx.staffLeaveApplication.create({
          data: {
            organizationId: ctx.organizationId,
            userId: ctx.staff.id,
            leaveTypeId,
            startDate: start,
            endDate: end,
            totalDays,
            reason: body.reason ? String(body.reason).trim() || null : null,
            status: 'approved',
            reviewedById: ctx.staff.id,
            reviewedAt: new Date(),
            reviewNote: 'Auto-approved (no approval required)',
            approvalState: 'approved',
            currentStepOrder: 1,
          },
          include: { leaveType: true, user: { select: { name: true, email: true } } },
        });
        return { app, autoApproved: true as const };
      }

      const app = await tx.staffLeaveApplication.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.staff.id,
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

      // Build the full ordered approval chain (manager -> dept head -> HR/admin).
      // Collapses to a single step in small orgs, preserving prior behaviour.
      const chain = await resolveStaffLeaveApprovalChain(tx, {
        organizationId: ctx.organizationId,
        applicantId: ctx.staff.id,
        requiresApproval: true,
      });
      for (const stage of chain) {
        await tx.leaveApprovalStep.create({
          data: {
            organizationId: ctx.organizationId,
            staffLeaveApplicationId: app.id,
            stepOrder: stage.order,
            approverUserId: stage.approverUserId,
          },
        });
      }
      await tx.leaveApprovalAction.create({
        data: {
          organizationId: ctx.organizationId,
          staffLeaveApplicationId: app.id,
          actorUserId: ctx.staff.id,
          action: 'submitted',
          note: body.reason ? String(body.reason).trim() : null,
        },
      });

      return { app, autoApproved: false as const };
    });

    if ('error' in result) {
      const errorMessage = result.error ?? 'Request failed';
      return NextResponse.json(
        { error: errorMessage },
        { status: errorMessage.includes('not found') ? 404 : 400 },
      );
    }

    await ctx.run((tx) => syncStaffLeaveUsedDaysForUserYear(tx, ctx.staff.id, year));
    return NextResponse.json(result.app);
  });
}
