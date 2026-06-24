import { NextRequest, NextResponse } from 'next/server';

import { activatePerformanceCycle } from '@/lib/performance/service';
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

    return NextResponse.json({ ok: true, employeeCount: result.employeeCount });
  });
}
