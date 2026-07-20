import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { findScopedTask } from '@/lib/projects/route-helpers';
import { serializeComment } from '@/lib/projects/serialize';
import { withTenant } from '@/lib/tenant-api';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id, commentId } = await params;

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

    try {
      const result = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const task = await findScopedTask(tx, {
          taskId: id,
          organizationId: ctx.organizationId,
          outsourcingClientId: clientId,
        });
        if (!task) return { notFound: true as const };

        const existing = await tx.projectComment.findFirst({
          where: ctx.where({ id: commentId, taskId: id }),
          select: { id: true, authorUserId: true },
        });
        if (!existing) return { notFound: true as const };
        if (existing.authorUserId !== ctx.staff.id) return { forbidden: true as const };

        const updated = await tx.projectComment.update({
          where: { id: commentId },
          data: { body: text },
          include: { author: { select: { id: true, name: true, email: true } } },
        });
        return { comment: updated };
      });

      if ('notFound' in result) return NextResponse.json({ error: 'Comment not found.' }, { status: 404 });
      if ('forbidden' in result) {
        return NextResponse.json({ error: 'Only the author can edit this comment.' }, { status: 403 });
      }
      return NextResponse.json({ comment: serializeComment(result.comment) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/projects/tasks/[id]/comments/[commentId]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update comment.' }, { status: 500 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id, commentId } = await params;

    try {
      const result = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const task = await findScopedTask(tx, {
          taskId: id,
          organizationId: ctx.organizationId,
          outsourcingClientId: clientId,
        });
        if (!task) return { notFound: true as const };

        const existing = await tx.projectComment.findFirst({
          where: ctx.where({ id: commentId, taskId: id }),
          select: { id: true, authorUserId: true },
        });
        if (!existing) return { notFound: true as const };
        if (existing.authorUserId !== ctx.staff.id && ctx.staff.role !== 'admin') {
          return { forbidden: true as const };
        }

        await tx.projectComment.delete({ where: { id: commentId } });
        return { ok: true as const };
      });

      if ('notFound' in result) return NextResponse.json({ error: 'Comment not found.' }, { status: 404 });
      if ('forbidden' in result) {
        return NextResponse.json({ error: 'Not allowed to delete this comment.' }, { status: 403 });
      }
      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/projects/tasks/[id]/comments/[commentId]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete comment.' }, { status: 500 });
    }
  });
}
