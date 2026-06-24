import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';
import { logAuditEvent } from '@/lib/audit-events';

export async function GET(request: NextRequest) {
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json([]);
  if (!process.env.DATABASE_URL) return NextResponse.json([]);

  const cases = await prisma.disciplinaryCase.findMany({
    where: { employeeId: user.employeeId },
    include: { actions: { select: { id: true } } },
    orderBy: { createdAt: 'desc' },
  });

  await logAuditEvent({
    actor: { userId: null, email: user.email, name: user.name },
    action: 'ess.disciplinary.list',
    entityType: 'DisciplinaryCase',
    route: 'GET /api/ess/disciplinary/cases',
    metadata: { employeeId: user.employeeId },
  });

  return NextResponse.json(
    cases.map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      type: c.type,
      status: c.status,
      severity: c.severity,
      subject: c.subject,
      incidentDate: c.incidentDate.toISOString(),
      laborJurisdiction: c.laborJurisdiction,
      showCauseResponseDueAt: c.showCauseResponseDueAt?.toISOString() ?? null,
      hearingAt: c.hearingAt?.toISOString() ?? null,
      resolution: c.resolution,
      resolvedAt: c.resolvedAt?.toISOString() ?? null,
      actionCount: c.actions.length,
      createdAt: c.createdAt.toISOString(),
    })),
  );
}
