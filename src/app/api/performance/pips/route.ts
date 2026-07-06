import { NextRequest, NextResponse } from 'next/server';

import { activatePip, add360Raters, createPip } from '@/lib/performance/specialization/pip-and-360';
import { withTenant } from '@/lib/tenant-api';

export async function POST(request: NextRequest) {
  return withTenant(
    request,
    async (ctx) => {
      const body = (await request.json().catch(() => ({}))) as {
        action?: string;
        employeeId?: string;
        cycleId?: string | null;
        reviewId?: string | null;
        startDate?: string;
        endDate?: string;
        goals?: unknown;
        notes?: string | null;
        pipId?: string;
        raters?: Array<{ raterEmployeeId: string; relationship: string }>;
      };

      if (body.action === 'activate_pip') {
        if (!body.pipId) {
          return NextResponse.json({ error: 'pipId is required' }, { status: 400 });
        }
        const pip = await ctx.run((tx) => activatePip(tx, ctx.organizationId, body.pipId!));
        return NextResponse.json({ pip });
      }

      if (body.action === 'add_360_raters') {
        if (!body.reviewId || !body.raters?.length) {
          return NextResponse.json({ error: 'reviewId and raters are required' }, { status: 400 });
        }
        const raters = await ctx.run((tx) =>
          add360Raters(tx, {
            organizationId: ctx.organizationId,
            reviewId: body.reviewId!,
            raters: body.raters!,
          }),
        );
        return NextResponse.json({ raters });
      }

      if (!body.employeeId || !body.startDate || !body.endDate) {
        return NextResponse.json({ error: 'employeeId, startDate, and endDate are required' }, { status: 400 });
      }

      const pip = await ctx.run((tx) =>
        createPip(tx, {
          organizationId: ctx.organizationId,
          employeeId: body.employeeId!,
          cycleId: body.cycleId ?? null,
          reviewId: body.reviewId ?? null,
          startDate: new Date(body.startDate!),
          endDate: new Date(body.endDate!),
          goals: body.goals,
          notes: body.notes ?? null,
        }),
      );

      await ctx.audit({
        action: 'performance.pip.created',
        entityType: 'PerformancePip',
        entityId: pip.id,
        route: 'POST /api/performance/pips',
      });

      return NextResponse.json({ pip }, { status: 201 });
    },
    { adminOnly: true },
  );
}
