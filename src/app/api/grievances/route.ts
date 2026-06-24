import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessDisciplinaryRecords } from '@/lib/hr-access';
import { toGrievanceNumber } from '@/lib/disciplinary';
import { logAuditEvent } from '@/lib/audit-events';
import { getHrUserIds, sendNotification } from '@/lib/notifications';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessDisciplinaryRecords(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const status = request.nextUrl.searchParams.get('status') || undefined;
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const grievances = await prisma.grievance.findMany({
    where: {
      employee: { outsourcingClientId: workspaceClientId },
      ...(status ? { status: status as never } : {}),
    },
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { submittedAt: 'desc' },
  });
  await logAuditEvent({ actor: { userId: user.id, email: user.email, name: user.name }, action: 'grievance.list', entityType: 'Grievance', route: 'GET /api/grievances' });
  return NextResponse.json(grievances);
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessDisciplinaryRecords(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = (await request.json()) as Record<string, unknown>;
  const employeeId = typeof body.employeeId === 'string' ? body.employeeId : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const category = (typeof body.category === 'string' ? body.category : 'OTHER') as never;
  const againstId = typeof body.againstId === 'string' && body.againstId.trim() ? body.againstId : null;
  if (!employeeId || !subject || !description) return NextResponse.json({ error: 'employeeId, subject, description required' }, { status: 400 });
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const empInScope = await prisma.employee.findFirst({
    where: { id: employeeId, outsourcingClientId: workspaceClientId },
    select: { id: true },
  });
  if (!empInScope) return NextResponse.json({ error: 'Employee not found for this entity' }, { status: 404 });
  const year = new Date().getUTCFullYear();
  const count = await prisma.grievance.count({ where: { submittedAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } } });
  const grievance = await prisma.grievance.create({
    data: { employeeId, grievanceNumber: toGrievanceNumber(year, count + 1), subject, description, category, againstId },
  });
  await logAuditEvent({ actor: { userId: user.id, email: user.email, name: user.name }, action: 'grievance.created', entityType: 'Grievance', entityId: grievance.id, route: 'POST /api/grievances' });
  const hrUserIds = await getHrUserIds();
  await sendNotification({
    event: 'grievance_submitted',
    recipientUserIds: hrUserIds,
    title: `New grievance ${grievance.grievanceNumber}`,
    body: grievance.subject,
    href: `/dashboard/disciplinary/grievances/${grievance.id}`,
    priority: 'action_required',
    channel: 'in_app',
    metadata: { grievanceId: grievance.id },
  });
  return NextResponse.json(grievance, { status: 201 });
}
