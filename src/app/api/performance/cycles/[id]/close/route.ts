import { NextRequest, NextResponse } from 'next/server';

import { closePerformanceCycle } from '@/lib/performance/service';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    const result = await ctx.run((tx) =>
      closePerformanceCycle(tx, { organizationId: ctx.organizationId, cycleId: id }),
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    await ctx.audit({
      action: 'performance.cycle.closed',
      entityType: 'PerformanceCycle',
      entityId: id,
      route: 'POST /api/performance/cycles/[id]/close',
    });

    return NextResponse.json({ ok: true });
  });
}
