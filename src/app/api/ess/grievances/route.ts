import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';
import { toGrievanceNumber } from '@/lib/disciplinary';
import { logAuditEvent } from '@/lib/audit-events';
import { getHrUserIds, sendNotification } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json([]);
  const grievances = await prisma.grievance.findMany({
    where: { employeeId: user.employeeId },
    orderBy: { submittedAt: 'desc' },
  });
  await logAuditEvent({ actor: { userId: null, email: user.email, name: user.name }, action: 'ess.grievance.list', entityType: 'Grievance', route: 'GET /api/ess/grievances', metadata: { employeeId: user.employeeId } });
  return NextResponse.json(grievances);
}

export async function POST(request: NextRequest) {
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ error: 'No linked employee profile' }, { status: 400 });
  const body = (await request.json()) as Record<string, unknown>;
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const category = (typeof body.category === 'string' ? body.category : 'OTHER') as never;
  if (!subject || !description) return NextResponse.json({ error: 'subject and description are required' }, { status: 400 });
  const year = new Date().getUTCFullYear();
  const count = await prisma.grievance.count({ where: { submittedAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } } });
  const grievance = await prisma.grievance.create({
    data: { employeeId: user.employeeId, grievanceNumber: toGrievanceNumber(year, count + 1), subject, description, category },
  });
  await logAuditEvent({ actor: { userId: null, email: user.email, name: user.name }, action: 'ess.grievance.created', entityType: 'Grievance', entityId: grievance.id, route: 'POST /api/ess/grievances', metadata: { employeeId: user.employeeId } });
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
