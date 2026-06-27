import { NextRequest, NextResponse } from 'next/server';
import { canAccessDisciplinaryRecords } from '@/lib/hr-access';
import { getHrUserIds, sendNotification } from '@/lib/notifications';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; actionId: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!canAccessDisciplinaryRecords(ctx.staff)) {
      return forbiddenResponse('Disciplinary access required.');
    }

    const { id, actionId } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const updated = await ctx.run((tx) =>
      tx.disciplinaryAction.update({
        where: { id: actionId },
        data: {
          ...(typeof body.employeeResponse === 'string' ? { employeeResponse: body.employeeResponse.trim() } : {}),
          ...(typeof body.employeeAcknowledged === 'boolean'
            ? { employeeAcknowledged: body.employeeAcknowledged, acknowledgedAt: body.employeeAcknowledged ? new Date() : null }
            : {}),
          ...(typeof body.notes === 'string' ? { notes: body.notes.trim() } : {}),
        },
      }),
    );

    await ctx.audit({
      action: 'disciplinary.action.updated',
      entityType: 'DisciplinaryAction',
      entityId: actionId,
      route: 'PUT /api/disciplinary/cases/[id]/actions/[actionId]',
      metadata: { caseId: id },
    });

    if (typeof body.employeeAcknowledged === 'boolean' && body.employeeAcknowledged) {
      const caseData = await ctx.run((tx) =>
        tx.disciplinaryCase.findFirst({
          where: ctx.where({ id }),
          select: { reportedById: true },
        }),
      );
      const hrUserIds = caseData?.reportedById ? [caseData.reportedById] : await getHrUserIds();
      await sendNotification({
        event: 'disciplinary_acknowledged',
        recipientUserIds: hrUserIds,
        title: 'Employee acknowledged disciplinary action',
        body: `Action ${updated.type.replaceAll('_', ' ')} has been acknowledged.`,
        href: `/dashboard/disciplinary/cases/${id}`,
        priority: 'info',
        channel: 'in_app',
        metadata: { caseId: id, actionId },
      });
    }

    return NextResponse.json(updated);
  });
}
