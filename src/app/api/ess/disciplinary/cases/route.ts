import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.essUser.employeeId) return NextResponse.json([]);

    const cases = await ctx.run((tx) =>
      tx.disciplinaryCase.findMany({
        where: ctx.where({ employeeId: ctx.essUser.employeeId! }),
        include: { actions: { select: { id: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );

    await ctx.audit({
      action: 'ess.disciplinary.list',
      entityType: 'DisciplinaryCase',
      route: 'GET /api/ess/disciplinary/cases',
      metadata: { employeeId: ctx.essUser.employeeId },
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
  });
}
