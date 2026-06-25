import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { allocateProjectCode } from '@/lib/projects/project-code';
import { serializeProject } from '@/lib/projects/serialize';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

    const [projects, openTasks, activeCount] = await Promise.all([
      prisma.project.findMany({
        where: {
          outsourcingClientId: clientId,
          ...(status ? { status: status as never } : {}),
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          budget: { select: { id: true, name: true } },
          _count: { select: { tasks: true, milestones: true } },
        },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        take: 200,
      }),
      prisma.projectTask.count({
        where: {
          project: { outsourcingClientId: clientId },
          status: { not: 'done' },
        },
      }),
      prisma.project.count({
        where: { outsourcingClientId: clientId, status: 'active' },
      }),
    ]);

    return NextResponse.json({
      projects: projects.map(serializeProject),
      summary: {
        total: projects.length,
        active: activeCount,
        openTasks,
      },
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/projects',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load projects.' }, { status: 500 });
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

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'Project name is required.' }, { status: 400 });
  }

  const description = typeof body.description === 'string' ? body.description.trim() : null;
  const department = typeof body.department === 'string' ? body.department.trim() : null;
  const status =
    typeof body.status === 'string' &&
    ['planning', 'active', 'on_hold', 'completed', 'cancelled'].includes(body.status)
      ? body.status
      : 'planning';
  const currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim() : 'KES';
  const budgetAmount =
    typeof body.budgetAmount === 'number' && Number.isFinite(body.budgetAmount)
      ? body.budgetAmount
      : null;
  const startDate =
    typeof body.startDate === 'string' && body.startDate.trim() ? new Date(body.startDate) : null;
  const dueDate =
    typeof body.dueDate === 'string' && body.dueDate.trim() ? new Date(body.dueDate) : null;
  const ownerUserId = typeof body.ownerUserId === 'string' ? body.ownerUserId.trim() : null;

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const projectCode = await allocateProjectCode(prisma, clientId);

    const created = await prisma.project.create({
      data: {
        organizationId: user.currentOrgId,
        outsourcingClientId: clientId,
        projectCode,
        name,
        description,
        department,
        status: status as never,
        currency,
        budgetAmount,
        startDate,
        dueDate,
        ownerUserId: ownerUserId || user.id,
        createdByUserId: user.id,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        budget: { select: { id: true, name: true } },
        _count: { select: { tasks: true, milestones: true } },
      },
    });

    return NextResponse.json({ project: serializeProject(created) }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/projects',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create project.' }, { status: 500 });
  }
}
