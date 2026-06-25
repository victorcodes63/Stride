import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeMilestone, serializeProject, serializeTask } from '@/lib/projects/serialize';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const row = await prisma.project.findFirst({
      where: { id, outsourcingClientId: clientId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        budget: { select: { id: true, name: true } },
        milestones: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: { _count: { select: { tasks: true } } },
        },
        tasks: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            assignee: { select: { id: true, name: true, email: true } },
            milestone: { select: { id: true, title: true } },
          },
        },
        _count: { select: { tasks: true, milestones: true } },
      },
    });

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      project: serializeProject(row),
      milestones: row.milestones.map(serializeMilestone),
      tasks: row.tasks.map((t) => serializeTask(t)),
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/projects/[id]',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load project.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
  if (typeof body.description === 'string') data.description = body.description.trim() || null;
  if (typeof body.department === 'string') data.department = body.department.trim() || null;
  if (
    typeof body.status === 'string' &&
    ['planning', 'active', 'on_hold', 'completed', 'cancelled'].includes(body.status)
  ) {
    data.status = body.status;
    if (body.status === 'completed') data.completedAt = new Date();
    if (body.status !== 'completed') data.completedAt = null;
  }
  if (typeof body.budgetAmount === 'number' && Number.isFinite(body.budgetAmount)) {
    data.budgetAmount = body.budgetAmount;
  }
  if (typeof body.startDate === 'string') {
    data.startDate = body.startDate.trim() ? new Date(body.startDate) : null;
  }
  if (typeof body.dueDate === 'string') {
    data.dueDate = body.dueDate.trim() ? new Date(body.dueDate) : null;
  }
  if (typeof body.ownerUserId === 'string') {
    data.ownerUserId = body.ownerUserId.trim() || null;
  }
  if (body.budgetId === null || body.budgetId === '') {
    data.budgetId = null;
  } else if (typeof body.budgetId === 'string' && body.budgetId.trim()) {
    data.budgetId = body.budgetId.trim();
  }
  if (typeof body.budgetAmount === 'number' && Number.isFinite(body.budgetAmount)) {
    data.budgetAmount = body.budgetAmount;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const existing = await prisma.project.findFirst({
      where: { id, outsourcingClientId: clientId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = await prisma.project.update({
      where: { id },
      data,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        budget: { select: { id: true, name: true } },
        _count: { select: { tasks: true, milestones: true } },
      },
    });

    return NextResponse.json({ project: serializeProject(updated) });
  } catch (error) {
    await reportApiError({
      route: 'PATCH /api/projects/[id]',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update project.' }, { status: 500 });
  }
}
