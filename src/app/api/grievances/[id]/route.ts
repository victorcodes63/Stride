import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessDisciplinaryRecords } from '@/lib/hr-access';
import { logAuditEvent } from '@/lib/audit-events';
import { getEssPortalUserIdForEmployee, sendNotification } from '@/lib/notifications';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessDisciplinaryRecords(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const grievance = await prisma.grievance.findUnique({ where: { id }, include: { employee: true, against: true } });
  if (!grievance) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await logAuditEvent({ actor: { userId: user.id, email: user.email, name: user.name }, action: 'grievance.view', entityType: 'Grievance', entityId: id, route: 'GET /api/grievances/[id]' });
  return NextResponse.json(grievance);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessDisciplinaryRecords(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const status = typeof body.status === 'string' ? body.status : undefined;
  const investigationNotes = typeof body.investigationNotes === 'string' ? body.investigationNotes : undefined;
  const resolution = typeof body.resolution === 'string' ? body.resolution : undefined;
  const updated = await prisma.grievance.update({
    where: { id },
    data: {
      ...(status ? { status: status as never } : {}),
      ...(investigationNotes !== undefined ? { investigationNotes } : {}),
      ...(resolution !== undefined ? { resolution, resolvedAt: new Date(), resolvedById: user.id } : {}),
    },
  });
  await logAuditEvent({ actor: { userId: user.id, email: user.email, name: user.name }, action: 'grievance.updated', entityType: 'Grievance', entityId: id, route: 'PUT /api/grievances/[id]' });
  const essId = await getEssPortalUserIdForEmployee(updated.employeeId);
  if (essId && status) {
    await sendNotification({
      event: 'grievance_status_changed',
      recipientEssPortalUserIds: [essId],
      title: `Grievance ${updated.grievanceNumber} status updated`,
      body: `Status changed to ${status.replaceAll('_', ' ')}`,
      href: '/ess/grievances',
      priority: 'info',
      channel: 'in_app',
      metadata: { grievanceId: id, status },
    });
  }
  return NextResponse.json(updated);
}
