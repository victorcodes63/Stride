import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';
import { toGrievanceNumber } from '@/lib/disciplinary';
import { logAuditEvent } from '@/lib/audit-events';
import { getHrUserIds, sendNotification } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ items: [] });

  const items = await prisma.grievance.findMany({
    where: {
      employeeId: user.employeeId,
      category: 'WORKPLACE_SAFETY',
      subject: { startsWith: 'HSE report:' },
    },
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true,
      grievanceNumber: true,
      subject: true,
      description: true,
      status: true,
      submittedAt: true,
    },
  });

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ error: 'No linked employee profile.' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const description = typeof payload.description === 'string' ? payload.description.trim() : '';
  const location = typeof payload.location === 'string' ? payload.location.trim() : '';
  const severity = typeof payload.severity === 'string' ? payload.severity.trim() : 'medium';
  const happenedAt = typeof payload.happenedAt === 'string' ? payload.happenedAt.trim() : '';

  if (!description) {
    return NextResponse.json({ error: 'Please describe what happened.' }, { status: 400 });
  }

  const year = new Date().getUTCFullYear();
  const count = await prisma.grievance.count({
    where: {
      submittedAt: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
  });

  const details = [
    `Severity: ${severity}`,
    location ? `Location: ${location}` : null,
    happenedAt ? `Happened at: ${happenedAt}` : null,
    '',
    description,
  ]
    .filter((part): part is string => part !== null)
    .join('\n');

  const report = await prisma.grievance.create({
    data: {
      employeeId: user.employeeId,
      grievanceNumber: toGrievanceNumber(year, count + 1),
      subject: `HSE report: ${location || 'Incident or near-miss'}`,
      description: details,
      category: 'WORKPLACE_SAFETY',
    },
  });

  await logAuditEvent({
    actor: { userId: null, email: user.email, name: user.name },
    action: 'ess.hse.report.created',
    entityType: 'Grievance',
    entityId: report.id,
    route: 'POST /api/ess/hse/reports',
    metadata: { employeeId: user.employeeId, severity, location },
  });

  const hrUserIds = await getHrUserIds();
  await sendNotification({
    event: 'grievance_submitted',
    recipientUserIds: hrUserIds,
    title: `New HSE report ${report.grievanceNumber}`,
    body: `${user.name} reported ${location || 'an incident or near-miss'}.`,
    href: `/dashboard/disciplinary/grievances/${report.id}`,
    priority: severity === 'high' ? 'urgent' : 'action_required',
    channel: 'in_app',
    metadata: { reportId: report.id, severity, location },
  });

  return NextResponse.json(report, { status: 201 });
}
