import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { findScopedTask } from '@/lib/projects/route-helpers';
import { withTenant } from '@/lib/tenant-api';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dependencyId: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id, dependencyId } = await params;

    try {
      const result = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const task = await findScopedTask(tx, {
          taskId: id,
          organizationId: ctx.organizationId,
          outsourcingClientId: clientId,
        });
        if (!task) return null;

        // The dependency must reference this task on either side.
        const dependency = await tx.projectTaskDependency.findFirst({
          where: {
            id: dependencyId,
            organizationId: ctx.organizationId,
            OR: [{ blockingTaskId: id }, { blockedTaskId: id }],
          },
          select: { id: true },
        });
        if (!dependency) return null;

        await tx.projectTaskDependency.delete({ where: { id: dependencyId } });
        return dependency;
      });

      if (!result) return NextResponse.json({ error: 'Dependency not found.' }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/projects/tasks/[id]/dependencies/[dependencyId]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete dependency.' }, { status: 500 });
    }
  });
}
