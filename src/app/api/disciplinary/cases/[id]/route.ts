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
  const record = await prisma.disciplinaryCase.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
      actions: { orderBy: { actionDate: 'asc' }, include: { performedBy: { select: { id: true, name: true } } } },
      documents: { orderBy: { uploadedAt: 'desc' } },
    },
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await logAuditEvent({ actor: { userId: user.id, email: user.email, name: user.name }, action: 'disciplinary.case.view', entityType: 'DisciplinaryCase', entityId: id, route: 'GET /api/disciplinary/cases/[id]' });
  return NextResponse.json(record);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessDisciplinaryRecords(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const status = typeof body.status === 'string' ? body.status : undefined;
  const resolution = typeof body.resolution === 'string' ? body.resolution : undefined;
  const laborJurisdiction =
    typeof body.laborJurisdiction === 'string' && body.laborJurisdiction.trim()
      ? body.laborJurisdiction.trim().toUpperCase().slice(0, 8)
      : undefined;
  const showCauseResponseDueAt =
    body.showCauseResponseDueAt === null
      ? null
      : typeof body.showCauseResponseDueAt === 'string' && body.showCauseResponseDueAt
        ? new Date(body.showCauseResponseDueAt)
        : undefined;
  const hearingAt =
    body.hearingAt === null ? null : typeof body.hearingAt === 'string' && body.hearingAt ? new Date(body.hearingAt) : undefined;
  const updated = await prisma.disciplinaryCase.update({
    where: { id },
    data: {
      ...(status ? { status: status as never } : {}),
      ...(resolution !== undefined ? { resolution, resolvedAt: new Date(), resolvedById: user.id } : {}),
      ...(laborJurisdiction ? { laborJurisdiction } : {}),
      ...(showCauseResponseDueAt !== undefined ? { showCauseResponseDueAt } : {}),
      ...(hearingAt !== undefined ? { hearingAt } : {}),
    },
  });
  await logAuditEvent({ actor: { userId: user.id, email: user.email, name: user.name }, action: 'disciplinary.case.updated', entityType: 'DisciplinaryCase', entityId: id, route: 'PUT /api/disciplinary/cases/[id]' });
  if (status === 'RESOLVED' || status === 'CLOSED') {
    const linked = await prisma.disciplinaryCase.findUnique({ where: { id }, select: { employeeId: true, caseNumber: true } });
    if (linked) {
      const essId = await getEssPortalUserIdForEmployee(linked.employeeId);
      if (essId) {
        await sendNotification({
          event: 'disciplinary_case_resolved',
          recipientEssPortalUserIds: [essId],
          title: `Case ${linked.caseNumber} resolved`,
          body: resolution || 'Disciplinary case has been concluded.',
          href: '/ess/disciplinary',
          priority: 'info',
          channel: 'in_app',
        });
      }
    }
  }
  return NextResponse.json(updated);
}
