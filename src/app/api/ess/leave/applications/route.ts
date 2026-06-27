import { NextRequest, NextResponse } from 'next/server';
import { canRequestLeave, computeRemainingLeaveDays, countInclusiveDays } from '@/lib/ess/leave-rules';
import {
  createWorkflowRun,
  getEssPortalUserIdForEmployee,
  getHrUserIds,
  sendNotification,
} from '@/lib/notifications';
import { withEssTenant } from '@/lib/ess-tenant-api';

function toUtcDateStart(dateInput: string) {
  return new Date(`${dateInput}T00:00:00.000Z`);
}

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json([]);

    const applications = await ctx.run((tx) =>
      tx.leaveApplication.findMany({
        where: ctx.where({ employeeId: ctx.employeeId! }),
        orderBy: { createdAt: 'desc' },
        include: { leaveType: { select: { id: true, name: true } } },
      }),
    );

    return NextResponse.json(
      applications.map((item) => ({
        id: item.id,
        leaveTypeId: item.leaveTypeId,
        leaveTypeName: item.leaveType.name,
        startDate: item.startDate.toISOString(),
        endDate: item.endDate.toISOString(),
        days: item.days,
        status: item.status,
        reason: item.reason,
        createdAt: item.createdAt.toISOString(),
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) {
      return NextResponse.json({ error: 'No linked employee profile for this ESS user.' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    const leaveTypeId = typeof b.leaveTypeId === 'string' ? b.leaveTypeId.trim() : '';
    const startDateRaw = typeof b.startDate === 'string' ? b.startDate.trim() : '';
    const endDateRaw = typeof b.endDate === 'string' ? b.endDate.trim() : '';
    const reason = typeof b.reason === 'string' && b.reason.trim() ? b.reason.trim() : null;

    if (!leaveTypeId || !startDateRaw || !endDateRaw) {
      return NextResponse.json({ error: 'Leave type, start date, and end date are required.' }, { status: 400 });
    }

    const startDate = toUtcDateStart(startDateRaw);
    const endDate = toUtcDateStart(endDateRaw);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid start or end date.' }, { status: 400 });
    }
    if (endDate < startDate) {
      return NextResponse.json({ error: 'End date cannot be before start date.' }, { status: 400 });
    }

    const days = countInclusiveDays(startDate, endDate);
    if (days <= 0) return NextResponse.json({ error: 'Invalid leave duration.' }, { status: 400 });

    const leaveResult = await ctx.run(async (tx) => {
      const leaveType = await tx.leaveType.findFirst({ where: ctx.where({ id: leaveTypeId }) });
      if (!leaveType) return { error: 'Leave type not found.' as const };

      const overlap = await tx.leaveApplication.findFirst({
        where: ctx.where({
          employeeId: ctx.employeeId!,
          status: { in: ['pending', 'approved'] },
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        }),
        select: { id: true },
      });
      if (overlap) {
        return {
          error: 'You already have a pending/approved leave request that overlaps these dates.',
        };
      }

      const year = startDate.getUTCFullYear();
      const yearStart = new Date(Date.UTC(year, 0, 1));
      const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      const balance = await tx.leaveBalance.findFirst({
        where: ctx.where({
          employeeId: ctx.employeeId!,
          leaveTypeId,
          year,
        }),
        select: { balance: true, used: true },
      });
      const pendingAgg = await tx.leaveApplication.aggregate({
        where: ctx.where({
          employeeId: ctx.employeeId!,
          leaveTypeId,
          status: 'pending',
          startDate: { gte: yearStart, lte: yearEnd },
        }),
        _sum: { days: true },
      });
      const entitled = balance?.balance ?? leaveType.daysPerYear;
      const used = balance?.used ?? 0;
      const pending = pendingAgg._sum.days ?? 0;
      const remaining = computeRemainingLeaveDays({ entitled, used, pending });
      if (!canRequestLeave({ requestedDays: days, entitled, used, pending })) {
        return {
          error: `Insufficient balance. Remaining ${remaining} day(s) for ${leaveType.name}.`,
        };
      }

      const leave = await tx.leaveApplication.create({
        data: {
          organizationId: ctx.organizationId,
          employeeId: ctx.employeeId!,
          leaveTypeId,
          startDate,
          endDate,
          days,
          reason,
          status: 'pending',
        },
        include: {
          leaveType: { select: { id: true, name: true } },
          employee: {
            select: { managerEmployeeId: true, outsourcingClientId: true, client: { select: { entityCode: true } } },
          },
        },
      });

      return { leave };
    });

    if ('error' in leaveResult) {
      const status = leaveResult.error.includes('not found') ? 404 : leaveResult.error.includes('overlap') ? 409 : 400;
      return NextResponse.json({ error: leaveResult.error }, { status });
    }

    const { leave } = leaveResult;

    await ctx.audit({
      action: 'ess.leave.requested',
      entityType: 'LeaveApplication',
      entityId: leave.id,
      route: '/api/ess/leave/applications',
      metadata: {
        leaveTypeId: leave.leaveTypeId,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        days: leave.days,
      },
    });

    try {
      const managerEssId = leave.employee.managerEmployeeId
        ? await getEssPortalUserIdForEmployee(leave.employee.managerEmployeeId)
        : null;
      const hrUserIds = await getHrUserIds();
      const workflow = await createWorkflowRun({
        module: 'leave',
        event: 'leave_submitted',
        entityType: 'LeaveApplication',
        entityId: leave.id,
        entityCode: leave.employee.client.entityCode ?? null,
        assigneeEssPortalUserId: managerEssId,
        dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        metadata: { employeeId: leave.employeeId, leaveTypeId: leave.leaveTypeId },
      });
      await sendNotification({
        event: 'leave_submitted',
        recipientUserIds: hrUserIds,
        recipientEssPortalUserIds: managerEssId ? [managerEssId] : [],
        title: `Leave request from ${ctx.essUser.name || 'Employee'}`,
        body: `${ctx.essUser.name || 'Employee'} submitted ${leave.leaveType.name} leave for ${leave.startDate.toISOString().slice(0, 10)} to ${leave.endDate.toISOString().slice(0, 10)}.`,
        href: '/ess/team/leave',
        priority: 'action_required',
        channel: 'in_app',
        workflowRunId: workflow.id,
        metadata: { leaveApplicationId: leave.id, workflowRunId: workflow.id },
      });
    } catch (err) {
      console.error('[notifications] Failed to send leave_submitted:', err);
    }

    return NextResponse.json({
      id: leave.id,
      leaveTypeId: leave.leaveTypeId,
      leaveTypeName: leave.leaveType.name,
      startDate: leave.startDate.toISOString(),
      endDate: leave.endDate.toISOString(),
      days: leave.days,
      status: leave.status,
      reason: leave.reason,
      createdAt: leave.createdAt.toISOString(),
    });
  });
}
