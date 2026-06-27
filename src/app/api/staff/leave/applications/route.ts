import { NextRequest, NextResponse } from 'next/server';
import { canAccessTeamLeaveScope } from '@/lib/staff-api-auth';
import { workingDaysBetween } from '@/lib/staff-leave-days';
import { getTeamLeaveMemberIds } from '@/lib/staff-leave-team';
import { syncStaffLeaveUsedDaysForUserYear } from '@/lib/staff-leave-balance';
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

    const where: Record<string, unknown> = {};
    if (scope === 'team' && canAccessTeamLeaveScope(ctx.staff)) {
      const memberIds = await getTeamLeaveMemberIds(ctx.staff);
      where.userId = { in: memberIds };
      if (status) where.status = status;
    } else {
      where.userId = ctx.staff.id;
      if (status) where.status = status;
    }

    try {
      const list = await ctx.run((tx) =>
        tx.staffLeaveApplication.findMany({
          where: ctx.where(where),
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
          where: ctx.where(where),
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
        }),
        _sum: { totalDays: true },
      });
      const pendingDays = pendingSum._sum.totalDays ?? 0;
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

      const applicantRow = await tx.user.findUnique({
        where: { id: ctx.staff.id },
        select: { leaveApproverId: true },
      });
      const approverOr: Array<{ id: string } | { role: 'admin' } | { staffUserType: 'business_manager' }> = [];
      if (applicantRow?.leaveApproverId) {
        approverOr.push({ id: applicantRow.leaveApproverId });
      }
      approverOr.push({ role: 'admin' }, { staffUserType: 'business_manager' });

      const defaultApprover = await tx.user.findFirst({
        where: {
          isActive: true,
          id: { not: ctx.staff.id },
          OR: approverOr,
        },
        orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
        select: { id: true },
      });
      if (defaultApprover) {
        await tx.leaveApprovalStep.create({
          data: {
            staffLeaveApplicationId: app.id,
            stepOrder: 1,
            approverUserId: defaultApprover.id,
          },
        });
      }
      await tx.leaveApprovalAction.create({
        data: {
          staffLeaveApplicationId: app.id,
          actorUserId: ctx.staff.id,
          action: 'submitted',
          note: body.reason ? String(body.reason).trim() : null,
        },
      });

      return { app, autoApproved: false as const };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.error.includes('not found') ? 404 : 400 });
    }

    await ctx.run((tx) => syncStaffLeaveUsedDaysForUserYear(tx, ctx.staff.id, year));
    return NextResponse.json(result.app);
  });
}
