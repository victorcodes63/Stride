import { NextRequest, NextResponse } from 'next/server';

import { createObjective, listObjectiveTree, seedDefaultCompetencyFramework } from '@/lib/performance/specialization/objectives';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const cycleId = new URL(request.url).searchParams.get('cycleId');
    const objectives = await ctx.run((tx) => listObjectiveTree(tx, ctx.organizationId, cycleId));
    return NextResponse.json({ objectives });
  });
}

export async function POST(request: NextRequest) {
  return withTenant(
    request,
    async (ctx) => {
      const body = (await request.json().catch(() => ({}))) as {
        action?: string;
        cycleId?: string | null;
        parentObjectiveId?: string | null;
        level?: string;
        divisionId?: string | null;
        jobDescriptionId?: string | null;
        employeeId?: string | null;
        title?: string;
        description?: string | null;
        weightPercent?: number;
      };

      if (body.action === 'seed_framework') {
        const framework = await ctx.run((tx) => seedDefaultCompetencyFramework(tx, ctx.organizationId));
        return NextResponse.json({ frameworkId: framework.id });
      }

      const level =
        body.level === 'organization' ||
        body.level === 'division' ||
        body.level === 'role' ||
        body.level === 'individual'
          ? body.level
          : null;
      if (!level || !body.title?.trim()) {
        return NextResponse.json({ error: 'level and title are required' }, { status: 400 });
      }

      const objective = await ctx.run((tx) =>
        createObjective(tx, ctx.organizationId, {
          cycleId: body.cycleId ?? null,
          parentObjectiveId: body.parentObjectiveId ?? null,
          level,
          divisionId: body.divisionId ?? null,
          jobDescriptionId: body.jobDescriptionId ?? null,
          employeeId: body.employeeId ?? null,
          title: body.title,
          description: body.description ?? null,
          weightPercent: body.weightPercent,
        }),
      );

      await ctx.audit({
        action: 'performance.objective.created',
        entityType: 'PerformanceObjective',
        entityId: objective.id,
        route: 'POST /api/performance/objectives',
        metadata: { level },
      });

      return NextResponse.json({ objective }, { status: 201 });
    },
    { adminOnly: true },
  );
}
