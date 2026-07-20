import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { logProjectActivity } from '@/lib/projects/activity';
import {
  filterValidMentions,
  findScopedTask,
  normalizeMentionIds,
} from '@/lib/projects/route-helpers';
import { serializeComment } from '@/lib/projects/serialize';
import { withTenant } from '@/lib/tenant-api';

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

        return tx.projectComment.findMany({
          where: ctx.where({ taskId: id }),
          include: { author: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          take: 200,
        });
      });

      if (!result) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
      return NextResponse.json({ comments: result.map(serializeComment) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/projects/tasks/[id]/comments',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load comments.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const text = typeof body.body === 'string' ? body.body.trim() : '';
    if (!text) return NextResponse.json({ error: 'Comment body required.' }, { status: 400 });
    if (text.length > 5000) {
      return NextResponse.json({ error: 'Comment too long (max 5000 characters).' }, { status: 400 });
    }
    const rawMentions = normalizeMentionIds(body.mentions);

    try {
      const result = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const task = await findScopedTask(tx, {
          taskId: id,
          organizationId: ctx.organizationId,
          outsourcingClientId: clientId,
        });
        if (!task) return null;

        const mentions = await filterValidMentions(tx, {
          organizationId: ctx.organizationId,
          candidateIds: rawMentions,
          excludeUserId: ctx.staff.id,
        });

        const comment = await tx.projectComment.create({
          data: {
            organizationId: ctx.organizationId,
            projectId: task.projectId,
            taskId: task.id,
            authorUserId: ctx.staff.id,
            body: text,
            mentions,
          },
          include: { author: { select: { id: true, name: true, email: true } } },
        });

        await logProjectActivity(tx, {
          organizationId: ctx.organizationId,
          projectId: task.projectId,
          taskId: task.id,
          type: 'comment',
          actorUserId: ctx.staff.id,
          summary: `Commented on "${task.title}"`,
          metadata: { commentId: comment.id },
        });

        // Best-effort notifications — never fail the request on notification errors.
        if (mentions.length > 0) {
          try {
            const authorName = comment.author?.name ?? ctx.staff.email;
            const preview = text.length > 140 ? `${text.slice(0, 140)}…` : text;
            await tx.staffNotification.createMany({
              data: mentions.map((userId) => ({
                organizationId: ctx.organizationId,
                userId,
                title: `${authorName} mentioned you on a task`,
                body: `${task.title}: ${preview}`,
                href: `/dashboard/projects/${task.projectId}?taskId=${task.id}`,
                event: 'project.task.comment_mention',
                priority: 'info',
              })),
            });
          } catch {
            // swallow — notification is non-critical
          }
        }

        return comment;
      });

      if (!result) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
      return NextResponse.json({ comment: serializeComment(result) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/projects/tasks/[id]/comments',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to save comment.' }, { status: 500 });
    }
  });
}
