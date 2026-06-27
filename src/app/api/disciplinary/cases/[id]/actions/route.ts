import { NextRequest, NextResponse } from 'next/server';
import { canAccessDisciplinaryRecords } from '@/lib/hr-access';
import { validateNextAction } from '@/lib/disciplinary';
import { getEssPortalUserIdForEmployee, sendNotification } from '@/lib/notifications';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!canAccessDisciplinaryRecords(ctx.staff)) {
      return forbiddenResponse('Disciplinary access required.');
    }

    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const type = (typeof body.type === 'string' ? body.type : '') as never;
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
    const overrideSequence = Boolean(body.overrideSequence);
    const overrideReason = typeof body.overrideReason === 'string' ? body.overrideReason.trim() : null;
    if (!type || !description) return NextResponse.json({ error: 'type and description are required' }, { status: 400 });

    const disciplinaryCase = await ctx.run((tx) =>
      tx.disciplinaryCase.findFirst({
        where: ctx.where({ id }),
        include: { actions: true },
      }),
    );
    if (!disciplinaryCase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    const validation = validateNextAction(disciplinaryCase.actions, type, disciplinaryCase.severity);
    if (!validation.valid && !overrideSequence) {
      return NextResponse.json({ error: validation.message, warnings: validation.warnings, requiresOverride: true }, { status: 400 });
    }
    if (!validation.valid && overrideSequence && !overrideReason) {
      return NextResponse.json({ error: 'Override reason is required when bypassing sequence.' }, { status: 400 });
    }

    const action = await ctx.run((tx) =>
      tx.disciplinaryAction.create({
        data: {
          organizationId: ctx.organizationId,
          caseId: id,
          type,
          description,
          notes,
          performedById: ctx.staff.id,
          overrideSequence: !validation.valid,
          overrideReason: !validation.valid ? overrideReason : null,
        },
      }),
    );

    await ctx.audit({
      action: 'disciplinary.action.created',
      entityType: 'DisciplinaryAction',
      entityId: action.id,
      route: 'POST /api/disciplinary/cases/[id]/actions',
      metadata: { caseId: id, type, validationWarnings: validation.warnings, overridden: !validation.valid },
    });

    const essId = await getEssPortalUserIdForEmployee(disciplinaryCase.employeeId);
    if (essId) {
      await sendNotification({
        event: 'disciplinary_action_added',
        recipientEssPortalUserIds: [essId],
        title: `Disciplinary action: ${String(type).replaceAll('_', ' ')}`,
        body: description,
        href: '/ess/profile',
        priority: 'action_required',
        channel: 'in_app',
        metadata: { caseId: id, actionId: action.id },
      });
    }

    return NextResponse.json({ action, validationWarnings: validation.warnings }, { status: 201 });
  });
}
