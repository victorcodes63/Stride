import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { logProjectActivity } from '@/lib/projects/activity';
import { detectDependencyCycle } from '@/lib/projects/dependencies';
import { findScopedTask } from '@/lib/projects/route-helpers';
import { serializeDependency } from '@/lib/projects/serialize';
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

        const [blocking, blockedBy] = await Promise.all([
          // Edges where THIS task blocks others.
          tx.projectTaskDependency.findMany({
            where: ctx.where({ blockingTaskId: id }),
            orderBy: { createdAt: 'asc' },
          }),
          // Edges where THIS task is blocked by others.
          tx.projectTaskDependency.findMany({
            where: ctx.where({ blockedTaskId: id }),
            orderBy: { createdAt: 'asc' },
          }),
        ]);
        return { blocking, blockedBy };
      });

      if (!result) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
      return NextResponse.json({
        blocking: result.blocking.map(serializeDependency),
        blockedBy: result.blockedBy.map(serializeDependency),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/projects/tasks/[id]/dependencies',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load dependencies.' }, { status: 500 });
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

    const blockedTaskId = typeof body.blockedTaskId === 'string' ? body.blockedTaskId.trim() : '';
    if (!blockedTaskId) {
      return NextResponse.json({ error: 'blockedTaskId is required.' }, { status: 400 });
    }
    if (blockedTaskId === id) {
      return NextResponse.json({ error: 'A task cannot block itself.' }, { status: 400 });
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

        const blocked = await tx.projectTask.findFirst({
          where: {
            id: blockedTaskId,
            organizationId: ctx.organizationId,
            projectId: task.projectId,
          },
          select: { id: true, title: true },
        });
        if (!blocked) {
          return { badRequest: 'Blocked task must belong to the same project.' as const };
        }

        const existingEdge = await tx.projectTaskDependency.findFirst({
          where: ctx.where({ blockingTaskId: id, blockedTaskId }),
          select: { id: true },
        });
        if (existingEdge) return { badRequest: 'Dependency already exists.' as const };

        // Cycle check over the project's dependency graph.
        const edges = await tx.projectTaskDependency.findMany({
          where: { organizationId: ctx.organizationId, blockingTask: { projectId: task.projectId } },
          select: { blockingTaskId: true, blockedTaskId: true },
        });
        if (detectDependencyCycle(edges, id, blockedTaskId)) {
          return { badRequest: 'Dependency would create a cycle.' as const };
        }

        const dependency = await tx.projectTaskDependency.create({
          data: {
            organizationId: ctx.organizationId,
            blockingTaskId: id,
            blockedTaskId,
            createdByUserId: ctx.staff.id,
          },
        });

        await logProjectActivity(tx, {
          organizationId: ctx.organizationId,
          projectId: task.projectId,
          taskId: task.id,
          type: 'dependency_added',
          actorUserId: ctx.staff.id,
          summary: `"${task.title}" now blocks "${blocked.title}"`,
          metadata: { blockingTaskId: id, blockedTaskId },
        });

        return { dependency };
      });

      if ('notFound' in result) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
      if ('badRequest' in result) return NextResponse.json({ error: result.badRequest }, { status: 400 });
      return NextResponse.json({ dependency: serializeDependency(result.dependency) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/projects/tasks/[id]/dependencies',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to add dependency.' }, { status: 500 });
    }
  });
}
