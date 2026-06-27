import { NextRequest, NextResponse } from 'next/server';
import { canAccessDisciplinaryRecords } from '@/lib/hr-access';
import { getEssPortalUserIdForEmployee, sendNotification } from '@/lib/notifications';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!canAccessDisciplinaryRecords(ctx.staff)) {
      return forbiddenResponse('Disciplinary access required.');
    }

    const { id } = await params;
    const record = await ctx.run((tx) =>
      tx.disciplinaryCase.findFirst({
        where: ctx.where({ id }),
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
          actions: { orderBy: { actionDate: 'asc' }, include: { performedBy: { select: { id: true, name: true } } } },
          documents: { orderBy: { uploadedAt: 'desc' } },
        },
      }),
    );
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await ctx.audit({
      action: 'disciplinary.case.view',
      entityType: 'DisciplinaryCase',
      entityId: id,
      route: 'GET /api/disciplinary/cases/[id]',
    });

    return NextResponse.json(record);
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!canAccessDisciplinaryRecords(ctx.staff)) {
      return forbiddenResponse('Disciplinary access required.');
    }

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

    const updated = await ctx.run((tx) =>
      tx.disciplinaryCase.update({
        where: { id },
        data: {
          ...(status ? { status: status as never } : {}),
          ...(resolution !== undefined ? { resolution, resolvedAt: new Date(), resolvedById: ctx.staff.id } : {}),
          ...(laborJurisdiction ? { laborJurisdiction } : {}),
          ...(showCauseResponseDueAt !== undefined ? { showCauseResponseDueAt } : {}),
          ...(hearingAt !== undefined ? { hearingAt } : {}),
        },
      }),
    );

    await ctx.audit({
      action: 'disciplinary.case.updated',
      entityType: 'DisciplinaryCase',
      entityId: id,
      route: 'PUT /api/disciplinary/cases/[id]',
    });

    if (status === 'RESOLVED' || status === 'CLOSED') {
      const linked = await ctx.run((tx) =>
        tx.disciplinaryCase.findFirst({
          where: ctx.where({ id }),
          select: { employeeId: true, caseNumber: true },
        }),
      );
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
  });
}
