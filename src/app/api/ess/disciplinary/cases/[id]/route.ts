import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.essUser.employeeId) return NextResponse.json({ error: 'No employee profile' }, { status: 400 });
    const { id } = await params;

    const record = await ctx.run((tx) =>
      tx.disciplinaryCase.findFirst({
        where: ctx.where({ id, employeeId: ctx.essUser.employeeId! }),
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
          actions: { orderBy: { actionDate: 'asc' }, include: { performedBy: { select: { name: true } } } },
          documents: { orderBy: { uploadedAt: 'desc' }, select: { id: true, title: true, fileName: true, uploadedAt: true } },
        },
      }),
    );
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await ctx.audit({
      action: 'ess.disciplinary.view',
      entityType: 'DisciplinaryCase',
      entityId: id,
      route: 'GET /api/ess/disciplinary/cases/[id]',
      metadata: { employeeId: ctx.essUser.employeeId },
    });

    return NextResponse.json({
      ...record,
      incidentDate: record.incidentDate.toISOString(),
      reportedDate: record.reportedDate.toISOString(),
      showCauseResponseDueAt: record.showCauseResponseDueAt?.toISOString() ?? null,
      hearingAt: record.hearingAt?.toISOString() ?? null,
      resolvedAt: record.resolvedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      actions: record.actions.map((a) => ({
        ...a,
        actionDate: a.actionDate.toISOString(),
        acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
      })),
      documents: record.documents.map((d) => ({
        ...d,
        uploadedAt: d.uploadedAt.toISOString(),
      })),
    });
  });
}
