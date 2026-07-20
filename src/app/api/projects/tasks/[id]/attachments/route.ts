import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { logProjectActivity } from '@/lib/projects/activity';
import { storeProjectAttachment, validateUploadFile } from '@/lib/projects/attachments';
import { findScopedTask } from '@/lib/projects/route-helpers';
import { serializeAttachment } from '@/lib/projects/serialize';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    try {
      const result = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const task = await findScopedTask(tx, {
          taskId: id,
          organizationId: ctx.organizationId,
          outsourcingClientId: clientId,
        });
        if (!task) return null;

        return tx.projectAttachment.findMany({
          where: ctx.where({ taskId: id }),
          include: { uploadedBy: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        });
      });

      if (!result) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
      return NextResponse.json({ attachments: result.map(serializeAttachment) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/projects/tasks/[id]/attachments',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load attachments.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    try {
      const clientId = await ctx.run((tx) =>
        resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId),
      );
      const task = await ctx.run((tx) =>
        findScopedTask(tx, { taskId: id, organizationId: ctx.organizationId, outsourcingClientId: clientId }),
      );
      if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });

      const form = await request.formData();
      const file = form.get('file');
      const validationError = validateUploadFile(file);
      if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

      const stored = await storeProjectAttachment(
        file as File,
        `projects/${task.projectId}/tasks/${task.id}`,
      );

      const attachment = await ctx.run(async (tx) => {
        const row = await tx.projectAttachment.create({
          data: {
            organizationId: ctx.organizationId,
            projectId: task.projectId,
            taskId: task.id,
            fileName: stored.fileName,
            fileUrl: stored.fileUrl,
            fileSize: stored.fileSize,
            contentType: stored.contentType,
            uploadedByUserId: ctx.staff.id,
          },
          include: { uploadedBy: { select: { id: true, name: true, email: true } } },
        });

        await logProjectActivity(tx, {
          organizationId: ctx.organizationId,
          projectId: task.projectId,
          taskId: task.id,
          type: 'attachment_added',
          actorUserId: ctx.staff.id,
          summary: `Attached "${row.fileName}" to "${task.title}"`,
          metadata: { attachmentId: row.id, fileName: row.fileName },
        });

        return row;
      });

      return NextResponse.json({ attachment: serializeAttachment(attachment) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/projects/tasks/[id]/attachments',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to upload attachment.' }, { status: 500 });
    }
  });
}
