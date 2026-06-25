import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeTask } from '@/lib/projects/serialize';

const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'blocked', 'done'] as const;
const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = request.nextUrl.searchParams.get('projectId')?.trim() || undefined;
  const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;
  const assigneeUserId = request.nextUrl.searchParams.get('assigneeUserId')?.trim() || undefined;

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);

    const tasks = await prisma.projectTask.findMany({
      where: {
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

    return NextResponse.json({ tasks: tasks.map((t) => serializeTask(t)) });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/projects/tasks',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load tasks.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const project = await prisma.project.findFirst({
      where: { id: projectId, outsourcingClientId: clientId },
      select: { id: true, organizationId: true },
    });
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });

    if (milestoneId) {
      const milestone = await prisma.projectMilestone.findFirst({
        where: { id: milestoneId, projectId },
        select: { id: true },
      });
      if (!milestone) {
        return NextResponse.json({ error: 'Milestone not found for this project.' }, { status: 400 });
      }
    }

    const sortOrder = await prisma.projectTask.count({ where: { projectId, status: status as never } });

    const created = await prisma.projectTask.create({
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
        createdByUserId: user.id,
        completedAt: status === 'done' ? new Date() : null,
      },
      include: {
        project: { select: { id: true, projectCode: true, name: true } },
        milestone: { select: { id: true, title: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ task: serializeTask(created) }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/projects/tasks',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create task.' }, { status: 500 });
  }
}
