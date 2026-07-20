import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { findScopedTask } from '@/lib/projects/route-helpers';
import { withTenant } from '@/lib/tenant-api';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; labelId: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id, labelId } = await params;

    try {
      const result = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const task = await findScopedTask(tx, {
          taskId: id,
          organizationId: ctx.organizationId,
          outsourcingClientId: clientId,
        });
        if (!task) return null;

        const link = await tx.projectTaskLabel.findFirst({
          where: { organizationId: ctx.organizationId, taskId: id, labelId },
          select: { id: true },
        });
        if (!link) return null;

        await tx.projectTaskLabel.delete({ where: { id: link.id } });
        return link;
      });

      if (!result) return NextResponse.json({ error: 'Label not attached to task.' }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/projects/tasks/[id]/labels/[labelId]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to remove label.' }, { status: 500 });
    }
  });
}
