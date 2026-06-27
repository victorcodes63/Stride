import { NextRequest, NextResponse } from 'next/server';
import { WorkflowStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canManageOnboarding } from '@/lib/hr-onboarding-access';
import { refreshWorkflowTaskSLAs } from '@/lib/onboarding-workflows';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    await refreshWorkflowTaskSLAs(id);
    const workspaceClientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      null,
      request,
      ctx.organizationId,
    );

    const workflow = await ctx.run((tx) =>
      tx.onboardingWorkflow.findFirst({
        where: ctx.where({ id }),
        include: {
          employee: { include: { department: true } },
          template: true,
          tasks: { orderBy: { order: 'asc' } },
        },
      }),
    );
    if (!workflow || workflow.employee.outsourcingClientId !== workspaceClientId) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }
    return NextResponse.json(workflow);
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Workflow updates require HR admin privileges.');
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const status = body?.status as WorkflowStatus | undefined;
    if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 });

    const workspaceClientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      null,
      request,
      ctx.organizationId,
    );

    const workflow = await ctx.run(async (tx) => {
      const existing = await tx.onboardingWorkflow.findFirst({
        where: ctx.where({ id }),
        select: { id: true, employee: { select: { outsourcingClientId: true } } },
      });
      if (!existing || existing.employee.outsourcingClientId !== workspaceClientId) return null;

      return tx.onboardingWorkflow.update({
        where: { id },
        data: {
          status,
          completedAt: status === WorkflowStatus.COMPLETED ? new Date() : null,
        },
      });
    });

    if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    await ctx.audit({
      action: 'onboarding.workflow.updated',
      entityType: 'OnboardingWorkflow',
      entityId: workflow.id,
      route: 'PUT /api/onboarding/workflows/[id]',
      metadata: { status: workflow.status },
    });

    return NextResponse.json(workflow);
  });
}
