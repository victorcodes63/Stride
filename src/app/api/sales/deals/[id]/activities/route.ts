import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { resolveEmployeeIdForStaff } from '@/lib/sales/api-helpers';
import { SALES_DEAL_ACTIVITY_TYPES } from '@/lib/sales/schema';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id: dealId } = await params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const type = typeof body.type === 'string' ? body.type.trim() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';

    if (!type || !subject) {
      return NextResponse.json({ error: 'type and subject are required.' }, { status: 400 });
    }
    if (!SALES_DEAL_ACTIVITY_TYPES.includes(type as never)) {
      return NextResponse.json({ error: 'Invalid activity type.' }, { status: 400 });
    }

    try {
      const activity = await ctx.run(async (tx) => {
        const deal = await tx.salesDeal.findFirst({
          where: { id: dealId, ...ctx.where() },
          select: { id: true },
        });
        if (!deal) return null;

        let actorEmployeeId =
          typeof body.actorEmployeeId === 'string' ? body.actorEmployeeId.trim() : '';
        if (!actorEmployeeId) {
          const linked = await resolveEmployeeIdForStaff(tx, ctx.staff, ctx.organizationId);
          if (!linked) {
            throw Object.assign(new Error('ACTOR_REQUIRED'), { code: 'ACTOR_REQUIRED' });
          }
          actorEmployeeId = linked;
        }

        return tx.salesDealActivity.create({
          data: {
            organizationId: ctx.organizationId,
            dealId,
            type: type as never,
            subject,
            body: typeof body.body === 'string' ? body.body.trim() || null : null,
            outcome: typeof body.outcome === 'string' ? body.outcome.trim() || null : null,
            actorEmployeeId,
            contactId:
              typeof body.contactId === 'string' ? body.contactId.trim() || null : null,
          },
          include: {
            actor: { select: { id: true, firstName: true, lastName: true } },
            contact: { select: { id: true, name: true } },
          },
        });
      });

      if (!activity) {
        return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });
      }

      return NextResponse.json(
        {
          activity: {
            id: activity.id,
            type: activity.type,
            subject: activity.subject,
            body: activity.body,
            outcome: activity.outcome,
            actorEmployeeId: activity.actorEmployeeId,
            actor: activity.actor
              ? {
                  id: activity.actor.id,
                  name: `${activity.actor.firstName} ${activity.actor.lastName}`.trim(),
                }
              : null,
            contactId: activity.contactId,
            contact: activity.contact,
            createdAt: activity.createdAt.toISOString(),
          },
        },
        { status: 201 },
      );
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'ACTOR_REQUIRED') {
        return NextResponse.json(
          { error: 'actorEmployeeId is required when staff is not linked to an employee.' },
          { status: 400 },
        );
      }
      await reportApiError({
        route: 'POST /api/sales/deals/[id]/activities',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create activity.' }, { status: 500 });
    }
  });
}
