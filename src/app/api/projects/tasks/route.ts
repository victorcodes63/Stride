import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeTask } from '@/lib/projects/serialize';
import { withTenant } from '@/lib/tenant-api';

const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'blocked', 'done'] as const;
const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const projectId = request.nextUrl.searchParams.get('projectId')?.trim() || undefined;
    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;
    const assigneeUserId = request.nextUrl.searchParams.get('assigneeUserId')?.trim() || undefined;

    try {
      const tasks = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );

        return tx.projectTask.findMany({
          where: {
            organizationId: ctx.organizationId,
            project: { outsourcingClientId: clientId },
            ...(projectId ? { projectId } : {}),
            ...(status ? { status: status as never } : {}),
            ...(assigneeUserId ? { assigneeUserId } : {}),
          },
          include: {
            project: { select: { id: true, projectCode: true, name: true } },
            milestone: { select: { id: true, title: true } },
            assignee: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
          take: 500,
        });
      });

      return NextResponse.json({ tasks: tasks.map((t) => serializeTask(t)) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/projects/tasks',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load tasks.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!projectId || !title) {
      return NextResponse.json({ error: 'projectId and title are required.' }, { status: 400 });
    }

    const description = typeof body.description === 'string' ? body.description.trim() : null;
    const milestoneId = typeof body.milestoneId === 'string' ? body.milestoneId.trim() : null;
    const status =
      typeof body.status === 'string' && TASK_STATUSES.includes(body.status as (typeof TASK_STATUSES)[number])
        ? body.status
        : 'todo';
    const priority =
      typeof body.priority === 'string' &&
      TASK_PRIORITIES.includes(body.priority as (typeof TASK_PRIORITIES)[number])
        ? body.priority
        : 'medium';
    const assigneeUserId = typeof body.assigneeUserId === 'string' ? body.assigneeUserId.trim() : null;
    const dueDate =
      typeof body.dueDate === 'string' && body.dueDate.trim() ? new Date(body.dueDate) : null;

    try {
      const created = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        const project = await tx.project.findFirst({
          where: { id: projectId, organizationId: ctx.organizationId, outsourcingClientId: clientId },
          select: { id: true, organizationId: true },
        });
        if (!project) throw new Error('Project not found.');

        if (milestoneId) {
          const milestone = await tx.projectMilestone.findFirst({
            where: { id: milestoneId, projectId, organizationId: ctx.organizationId },
            select: { id: true },
          });
          if (!milestone) throw new Error('Milestone not found for this project.');
        }

        const sortOrder = await tx.projectTask.count({
          where: { projectId, organizationId: ctx.organizationId, status: status as never },
        });

        return tx.projectTask.create({
          data: {
            organizationId: project.organizationId,
            projectId,
            milestoneId,
            title,
            description,
            status: status as never,
            priority: priority as never,
            assigneeUserId,
            dueDate,
            sortOrder,
            createdByUserId: ctx.staff.id,
            completedAt: status === 'done' ? new Date() : null,
          },
          include: {
            project: { select: { id: true, projectCode: true, name: true } },
            milestone: { select: { id: true, title: true } },
            assignee: { select: { id: true, name: true, email: true } },
          },
        });
      });

      return NextResponse.json({ task: serializeTask(created) }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Project not found.') {
        return NextResponse.json({ error: message }, { status: 404 });
      }
      if (message === 'Milestone not found for this project.') {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      await reportApiError({
        route: 'POST /api/projects/tasks',
        message,
      });
      return NextResponse.json({ error: 'Failed to create task.' }, { status: 500 });
    }
  });
}
