import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { allocateProjectCode } from '@/lib/projects/project-code';
import { serializeProject } from '@/lib/projects/serialize';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const [clientId, projects, openTasks, activeCount] = await ctx.run(async (tx) => {
        const resolvedClientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

        const [projectRows, openTaskCount, activeProjectCount] = await Promise.all([
          tx.project.findMany({
            where: {
              organizationId: ctx.organizationId,
              outsourcingClientId: resolvedClientId,
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
          tx.projectTask.count({
            where: {
              organizationId: ctx.organizationId,
              project: { outsourcingClientId: resolvedClientId },
              status: { not: 'done' },
            },
          }),
          tx.project.count({
            where: {
              organizationId: ctx.organizationId,
              outsourcingClientId: resolvedClientId,
              status: 'active',
            },
          }),
        ]);

        return [resolvedClientId, projectRows, openTaskCount, activeProjectCount] as const;
      });

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
    const created = await ctx.run(async (tx) => {
      const clientId = await resolvePrimaryWorkspaceClientId(
        tx,
        undefined,
        request,
        ctx.organizationId,
      );
      const projectCode = await allocateProjectCode(tx, clientId);

      return tx.project.create({
        data: {
          organizationId: ctx.organizationId,
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
          ownerUserId: ownerUserId || ctx.staff.id,
          createdByUserId: ctx.staff.id,
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          budget: { select: { id: true, name: true } },
          _count: { select: { tasks: true, milestones: true } },
        },
      });
    });

    return NextResponse.json({ project: serializeProject(created) }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/projects',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create project.' }, { status: 500 });
  }
  });
}
