import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const status = typeof (body as Record<string, unknown>).status === 'string'
    ? String((body as Record<string, unknown>).status).trim().toLowerCase()
    : '';
  if (status !== 'approved' && status !== 'rejected') {
    return NextResponse.json({ error: 'Status must be approved or rejected.' }, { status: 400 });
  }

  const { id } = await params;
  const clientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);

  const existing = await prisma.leaveApplication.findFirst({
    where: { id, employee: { outsourcingClientId: clientId } },
    include: {
      leaveType: { select: { name: true } },
      employee: { select: { firstName: true, lastName: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: 'Leave application not found.' }, { status: 404 });

  const updated = await prisma.leaveApplication.update({
    where: { id },
    data: { status },
    include: {
      leaveType: { select: { name: true } },
      employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: user.id,
      actorEmail: user.email,
      action: `leave.${status}`,
      entityType: 'LeaveApplication',
      entityId: updated.id,
      route: 'PATCH /api/outsourcing/leave/applications/[id]',
    },
  });

  return NextResponse.json({
    id: updated.id,
    employeeName: `${updated.employee.firstName} ${updated.employee.lastName}`.trim(),
    employeeNumber: updated.employee.employeeNumber,
    leaveTypeName: updated.leaveType.name,
    startDate: updated.startDate.toISOString().slice(0, 10),
    endDate: updated.endDate.toISOString().slice(0, 10),
    days: updated.days,
    status: updated.status,
  });
}
