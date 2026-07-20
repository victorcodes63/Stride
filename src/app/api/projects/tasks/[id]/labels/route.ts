import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { logProjectActivity } from '@/lib/projects/activity';
import { findScopedTask } from '@/lib/projects/route-helpers';
import { serializeLabel } from '@/lib/projects/serialize';
import { withTenant } from '@/lib/tenant-api';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const labelId = typeof body.labelId === 'string' ? body.labelId.trim() : '';
    if (!labelId) return NextResponse.json({ error: 'labelId is required.' }, { status: 400 });

    try {
      const result = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const task = await findScopedTask(tx, {
          taskId: id,
          organizationId: ctx.organizationId,
          outsourcingClientId: clientId,
        });
        if (!task) return { notFound: true as const };

        const label = await tx.projectLabel.findFirst({
          where: {
            id: labelId,
            organizationId: ctx.organizationId,
            OR: [{ projectId: null }, { projectId: task.projectId }],
          },
        });
        if (!label) return { badRequest: 'Label is not available for this project.' as const };

        await tx.projectTaskLabel.upsert({
          where: { taskId_labelId: { taskId: id, labelId } },
          create: { organizationId: ctx.organizationId, taskId: id, labelId },
          update: {},
        });

        await logProjectActivity(tx, {
          organizationId: ctx.organizationId,
          projectId: task.projectId,
          taskId: task.id,
          type: 'label_added',
          actorUserId: ctx.staff.id,
          summary: `Label "${label.name}" added to "${task.title}"`,
          metadata: { labelId },
        });

        return { label };
      });

      if ('notFound' in result) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
      if ('badRequest' in result) return NextResponse.json({ error: result.badRequest }, { status: 400 });
      return NextResponse.json({ label: serializeLabel(result.label) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/projects/tasks/[id]/labels',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to attach label.' }, { status: 500 });
    }
  });
}
