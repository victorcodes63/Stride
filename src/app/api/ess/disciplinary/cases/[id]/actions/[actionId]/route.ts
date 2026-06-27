import { NextRequest, NextResponse } from 'next/server';
import { getHrUserIds, sendNotification } from '@/lib/notifications';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; actionId: string }> }) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.essUser.employeeId) return NextResponse.json({ error: 'No employee profile' }, { status: 400 });
    const { id, actionId } = await params;

    const existing = await ctx.run((tx) =>
      tx.disciplinaryAction.findFirst({
        where: { id: actionId, caseId: id, disciplinaryCase: ctx.where({ employeeId: ctx.essUser.employeeId! }) },
        include: { disciplinaryCase: { select: { employeeId: true } } },
      }),
    );
    if (!existing || existing.disciplinaryCase.employeeId !== ctx.essUser.employeeId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const employeeAcknowledged = typeof body.employeeAcknowledged === 'boolean' ? body.employeeAcknowledged : undefined;
    const employeeResponse = typeof body.employeeResponse === 'string' ? body.employeeResponse.trim() : undefined;

    const updated = await ctx.run((tx) =>
      tx.disciplinaryAction.update({
        where: { id: actionId },
        data: {
          ...(employeeResponse !== undefined ? { employeeResponse } : {}),
          ...(typeof employeeAcknowledged === 'boolean'
            ? { employeeAcknowledged, acknowledgedAt: employeeAcknowledged ? new Date() : null }
            : {}),
        },
      }),
    );

    await ctx.audit({
      action: 'ess.disciplinary.action.ack',
      entityType: 'DisciplinaryAction',
      entityId: actionId,
      route: 'PUT /api/ess/disciplinary/cases/[id]/actions/[actionId]',
      metadata: { caseId: id, employeeId: ctx.essUser.employeeId },
    });

    if (employeeAcknowledged) {
      const hrUserIds = await getHrUserIds();
      await sendNotification({
        event: 'disciplinary_acknowledged',
        recipientUserIds: hrUserIds,
        title: 'Employee acknowledged disciplinary action',
        body: `${ctx.essUser.name} acknowledged: ${updated.type.replaceAll('_', ' ')}.`,
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
  });
}
