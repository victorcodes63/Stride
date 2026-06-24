import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessDisciplinaryRecords } from '@/lib/hr-access';
import { logAuditEvent } from '@/lib/audit-events';
import { getHrUserIds, sendNotification } from '@/lib/notifications';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; actionId: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessDisciplinaryRecords(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id, actionId } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const updated = await prisma.disciplinaryAction.update({
    where: { id: actionId },
    data: {
      ...(typeof body.employeeResponse === 'string' ? { employeeResponse: body.employeeResponse.trim() } : {}),
      ...(typeof body.employeeAcknowledged === 'boolean'
        ? { employeeAcknowledged: body.employeeAcknowledged, acknowledgedAt: body.employeeAcknowledged ? new Date() : null }
        : {}),
      ...(typeof body.notes === 'string' ? { notes: body.notes.trim() } : {}),
    },
  });
  await logAuditEvent({ actor: { userId: user.id, email: user.email, name: user.name }, action: 'disciplinary.action.updated', entityType: 'DisciplinaryAction', entityId: actionId, route: 'PUT /api/disciplinary/cases/[id]/actions/[actionId]', metadata: { caseId: id } });
  if (typeof body.employeeAcknowledged === 'boolean' && body.employeeAcknowledged) {
    const caseData = await prisma.disciplinaryCase.findUnique({ where: { id }, select: { reportedById: true } });
    const hrUserIds = caseData?.reportedById ? [caseData.reportedById] : await getHrUserIds();
    await sendNotification({
      event: 'disciplinary_acknowledged',
      recipientUserIds: hrUserIds,
      title: 'Employee acknowledged disciplinary action',
      body: `Action ${updated.type.replaceAll('_', ' ')} has been acknowledged.`,
      href: `/dashboard/disciplinary/cases/${id}`,
      priority: 'info',
      channel: 'in_app',
      metadata: { caseId: id, actionId },
    });
  }
  return NextResponse.json(updated);
}
