import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';
import { canRequestLeave, computeRemainingLeaveDays, countInclusiveDays } from '@/lib/ess/leave-rules';
import {
  createWorkflowRun,
  getEssPortalUserIdForEmployee,
  getHrUserIds,
  sendNotification,
} from '@/lib/notifications';

function toUtcDateStart(dateInput: string) {
  return new Date(`${dateInput}T00:00:00.000Z`);
}

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json([]);

  const applications = await prisma.leaveApplication.findMany({
    where: { employeeId: user.employeeId },
    orderBy: { createdAt: 'desc' },
    include: { leaveType: { select: { id: true, name: true } } },
  });

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
}

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ error: 'No linked employee profile for this ESS user.' }, { status: 400 });

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

  const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
  if (!leaveType) return NextResponse.json({ error: 'Leave type not found.' }, { status: 404 });

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

  const overlap = await prisma.leaveApplication.findFirst({
    where: {
      employeeId: user.employeeId,
      status: { in: ['pending', 'approved'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true },
  });
  if (overlap) {
    return NextResponse.json(
      { error: 'You already have a pending/approved leave request that overlaps these dates.' },
      { status: 409 },
    );
  }

  const year = startDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  const balance = await prisma.leaveBalance.findUnique({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId: user.employeeId,
        leaveTypeId,
        year,
      },
    },
    select: { balance: true, used: true },
  });
  const pendingAgg = await prisma.leaveApplication.aggregate({
    where: {
      employeeId: user.employeeId,
      leaveTypeId,
      status: 'pending',
      startDate: { gte: yearStart, lte: yearEnd },
    },
    _sum: { days: true },
  });
  const entitled = balance?.balance ?? leaveType.daysPerYear;
  const used = balance?.used ?? 0;
  const pending = pendingAgg._sum.days ?? 0;
  const remaining = computeRemainingLeaveDays({ entitled, used, pending });
  if (!canRequestLeave({ requestedDays: days, entitled, used, pending })) {
    return NextResponse.json(
      { error: `Insufficient balance. Remaining ${remaining} day(s) for ${leaveType.name}.` },
      { status: 400 },
    );
  }

  const leave = await prisma.leaveApplication.create({
    data: {
      employeeId: user.employeeId,
      leaveTypeId,
      startDate,
      endDate,
      days,
      reason,
      status: 'pending',
    },
    include: {
      leaveType: { select: { id: true, name: true } },
      employee: { select: { managerEmployeeId: true, outsourcingClientId: true, client: { select: { entityCode: true } } } },
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorEmail: user.email,
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
      title: `Leave request from ${user.name || 'Employee'}`,
      body: `${user.name || 'Employee'} submitted ${leave.leaveType.name} leave for ${leave.startDate.toISOString().slice(0, 10)} to ${leave.endDate.toISOString().slice(0, 10)}.`,
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
}
