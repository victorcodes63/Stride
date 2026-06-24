import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';
import { logAuditEvent } from '@/lib/audit-events';
import { getHrUserIds, sendNotification } from '@/lib/notifications';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; actionId: string }> }) {
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ error: 'No employee profile' }, { status: 400 });
  const { id, actionId } = await params;

  const existing = await prisma.disciplinaryAction.findFirst({
    where: { id: actionId, caseId: id },
    include: { disciplinaryCase: { select: { employeeId: true } } },
  });
  if (!existing || existing.disciplinaryCase.employeeId !== user.employeeId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const employeeAcknowledged = typeof body.employeeAcknowledged === 'boolean' ? body.employeeAcknowledged : undefined;
  const employeeResponse = typeof body.employeeResponse === 'string' ? body.employeeResponse.trim() : undefined;

  const updated = await prisma.disciplinaryAction.update({
    where: { id: actionId },
    data: {
      ...(employeeResponse !== undefined ? { employeeResponse } : {}),
      ...(typeof employeeAcknowledged === 'boolean'
        ? { employeeAcknowledged, acknowledgedAt: employeeAcknowledged ? new Date() : null }
        : {}),
    },
  });

  await logAuditEvent({
    actor: { userId: null, email: user.email, name: user.name },
    action: 'ess.disciplinary.action.ack',
    entityType: 'DisciplinaryAction',
    entityId: actionId,
    route: 'PUT /api/ess/disciplinary/cases/[id]/actions/[actionId]',
    metadata: { caseId: id, employeeId: user.employeeId },
  });

  if (employeeAcknowledged) {
    const hrUserIds = await getHrUserIds();
    await sendNotification({
      event: 'disciplinary_acknowledged',
      recipientUserIds: hrUserIds,
      title: 'Employee acknowledged disciplinary action',
      body: `${user.name} acknowledged: ${updated.type.replaceAll('_', ' ')}.`,
      href: `/dashboard/disciplinary/cases/${id}`,
      priority: 'info',
      channel: 'in_app',
      metadata: { caseId: id, actionId },
    });
  }

  return NextResponse.json({
    ...updated,
    actionDate: updated.actionDate.toISOString(),
    acknowledgedAt: updated.acknowledgedAt?.toISOString() ?? null,
  });
}
