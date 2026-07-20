import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { findScopedTask } from '@/lib/projects/route-helpers';
import { withTenant } from '@/lib/tenant-api';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id, attachmentId } = await params;

    try {
      const result = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const task = await findScopedTask(tx, {
          taskId: id,
          organizationId: ctx.organizationId,
          outsourcingClientId: clientId,
        });
        if (!task) return null;

        const attachment = await tx.projectAttachment.findFirst({
          where: ctx.where({ id: attachmentId, taskId: id }),
          select: { id: true },
        });
        if (!attachment) return null;

        await tx.projectAttachment.delete({ where: { id: attachmentId } });
        return attachment;
      });

      if (!result) return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/projects/tasks/[id]/attachments/[attachmentId]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete attachment.' }, { status: 500 });
    }
  });
}
