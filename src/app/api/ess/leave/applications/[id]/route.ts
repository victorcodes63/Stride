import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';
import { getEssPortalUserIdForEmployee, sendNotification, transitionWorkflowRun } from '@/lib/notifications';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (user.role !== 'manager' && user.role !== 'hr') {
    return NextResponse.json({ error: 'Insufficient role to review leave applications.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const status = typeof b.status === 'string' ? b.status : '';
  const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim() : null;
  if (status !== 'approved' && status !== 'rejected') {
    return NextResponse.json({ error: 'Status must be approved or rejected.' }, { status: 400 });
  }

  const { id } = await params;
  const existing = await prisma.leaveApplication.findUnique({
    where: { id },
    include: { employee: { select: { managerEmployeeId: true } } },
  });
  if (!existing) return NextResponse.json({ error: 'Leave application not found.' }, { status: 404 });

  if (user.role !== 'hr') {
    if (!user.employeeId || existing.employee.managerEmployeeId !== user.employeeId) {
      return NextResponse.json({ error: 'You can only review leave for your direct reports.' }, { status: 403 });
    }
  }

  const updated = await prisma.leaveApplication.update({
    where: { id },
    data: { status },
    include: {
      leaveType: { select: { name: true } },
      employee: { select: { firstName: true, lastName: true } },
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorEmail: user.email,
      action: `ess.leave.${status}`,
      entityType: 'LeaveApplication',
      entityId: updated.id,
      route: '/api/ess/leave/applications/[id]',
      metadata: {
        reviewerRole: user.role,
        reviewerEssUserId: user.id,
        note,
      },
    },
  });

  try {
    const workflowRun = await prisma.workflowRun.findFirst({
      where: { entityType: 'LeaveApplication', entityId: updated.id },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (workflowRun) {
      await transitionWorkflowRun(workflowRun.id, status === 'approved' ? 'approved' : 'rejected', {
        reviewerEssUserId: user.id,
        reviewerRole: user.role,
      });
    }
    const employeeEssId = await getEssPortalUserIdForEmployee(updated.employeeId);
    if (employeeEssId) {
      await sendNotification({
        event: status === 'approved' ? 'leave_approved' : 'leave_rejected',
        recipientEssPortalUserIds: [employeeEssId],
        title: status === 'approved' ? 'Leave approved' : 'Leave not approved',
        body:
          status === 'approved'
            ? `Your ${updated.leaveType.name} leave from ${updated.startDate.toISOString().slice(0, 10)} to ${updated.endDate.toISOString().slice(0, 10)} has been approved by ${user.name}.`
            : `Your ${updated.leaveType.name} leave from ${updated.startDate.toISOString().slice(0, 10)} to ${updated.endDate.toISOString().slice(0, 10)} was not approved.${note ? ` Reason: ${note}` : ''}`,
        href: '/ess/leave',
        priority: 'info',
        channel: 'both',
        workflowRunId: workflowRun?.id,
        metadata: {
          leaveType: updated.leaveType.name,
          startDate: updated.startDate.toISOString().slice(0, 10),
          endDate: updated.endDate.toISOString().slice(0, 10),
          approverName: user.name,
          reason: note,
          workflowRunId: workflowRun?.id,
        },
      });
    }
  } catch (err) {
    console.error(`[notifications] Failed to send ess leave ${status}:`, err);
  }

  return NextResponse.json({
    id: updated.id,
    employeeName: `${updated.employee.firstName} ${updated.employee.lastName}`.trim(),
    leaveTypeName: updated.leaveType.name,
    startDate: updated.startDate.toISOString(),
    endDate: updated.endDate.toISOString(),
    status: updated.status,
    note,
  });
}
