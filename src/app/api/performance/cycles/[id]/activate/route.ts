import { NextRequest, NextResponse } from 'next/server';

import { activatePerformanceCycle } from '@/lib/performance/service';
import { getHrUserIds, sendNotification } from '@/lib/notifications';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    const result = await ctx.run((tx) =>
      activatePerformanceCycle(tx, {
        organizationId: ctx.organizationId,
        cycleId: id,
      }),
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    await ctx.audit({
      action: 'performance.cycle.activated',
      entityType: 'PerformanceCycle',
      entityId: id,
      route: 'POST /api/performance/cycles/[id]/activate',
      metadata: { employeeCount: result.employeeCount },
    });

    const cycle = await ctx.run((tx) => tx.performanceCycle.findFirst({ where: ctx.where({ id }) }));
    if (cycle) {
      const hrUserIds = await getHrUserIds();
      await sendNotification({
        event: 'performance_cycle_activated',
        recipientUserIds: hrUserIds,
        title: `Performance cycle activated: ${cycle.name}`,
        body: `${result.employeeCount} employee reviews created. Employees can complete self-assessments in ESS.`,
        href: '/dashboard/performance',
        priority: 'action_required',
        channel: 'both',
        metadata: { cycleId: id, employeeCount: result.employeeCount },
      }).catch(() => null);
    }

    return NextResponse.json({ ok: true, employeeCount: result.employeeCount });
  });
}
