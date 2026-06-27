import { NextRequest, NextResponse } from 'next/server';
import { canAccessDisciplinaryRecords } from '@/lib/hr-access';
import { getEssPortalUserIdForEmployee, sendNotification } from '@/lib/notifications';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    if (!canAccessDisciplinaryRecords(ctx.staff)) {
      return forbiddenResponse('Disciplinary access required.');
    }

    const grievance = await ctx.run((tx) =>
      tx.grievance.findFirst({
        where: ctx.where({ id }),
        include: { employee: true, against: true, documents: true },
      }),
    );
    if (!grievance) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await ctx.audit({
      action: 'grievance.view',
      entityType: 'Grievance',
      entityId: id,
      route: 'GET /api/grievances/[id]',
    });

    return NextResponse.json(grievance);
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    if (!canAccessDisciplinaryRecords(ctx.staff)) {
      return forbiddenResponse('Disciplinary access required.');
    }

    const body = (await request.json()) as Record<string, unknown>;
    const status = typeof body.status === 'string' ? body.status : undefined;
    const investigationNotes = typeof body.investigationNotes === 'string' ? body.investigationNotes : undefined;
    const resolution = typeof body.resolution === 'string' ? body.resolution : undefined;

    const updated = await ctx.run(async (tx) => {
      const existing = await tx.grievance.findFirst({ where: ctx.where({ id }) });
      if (!existing) return null;

      return tx.grievance.update({
        where: { id },
        data: {
          ...(status ? { status: status as never } : {}),
          ...(investigationNotes !== undefined ? { investigationNotes } : {}),
          ...(resolution !== undefined ? { resolution, resolvedAt: new Date(), resolvedById: ctx.staff.id } : {}),
        },
      });
    });

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await ctx.audit({
      action: 'grievance.updated',
      entityType: 'Grievance',
      entityId: id,
      route: 'PUT /api/grievances/[id]',
    });

    const essId = await getEssPortalUserIdForEmployee(updated.employeeId);
    if (essId && status) {
      await sendNotification({
        event: 'grievance_status_changed',
        recipientEssPortalUserIds: [essId],
        title: `Grievance ${updated.grievanceNumber} status updated`,
        body: `Status changed to ${status.replaceAll('_', ' ')}`,
        href: `/ess/grievances/${id}`,
        priority: 'info',
        channel: 'in_app',
        metadata: { grievanceId: id, status },
      });
    }

    return NextResponse.json(updated);
  });
}
