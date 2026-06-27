import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeMilestone } from '@/lib/projects/serialize';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const projectId = request.nextUrl.searchParams.get('projectId')?.trim();
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 });
    }

    try {
      const milestones = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const project = await tx.project.findFirst({
          where: ctx.where({ id: projectId, outsourcingClientId: clientId }),
          select: { id: true },
        });
        if (!project) return null;

        return tx.projectMilestone.findMany({
          where: ctx.where({ projectId }),
          include: { _count: { select: { tasks: true } } },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
      });

      if (!milestones) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
      return NextResponse.json({ milestones: milestones.map(serializeMilestone) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/projects/milestones',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load milestones.' }, { status: 500 });
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
    const dueDate =
      typeof body.dueDate === 'string' && body.dueDate.trim() ? new Date(body.dueDate) : null;

    try {
      const created = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const project = await tx.project.findFirst({
          where: ctx.where({ id: projectId, outsourcingClientId: clientId }),
          select: { id: true },
        });
        if (!project) return null;

        const sortOrder = await tx.projectMilestone.count({ where: ctx.where({ projectId }) });

        return tx.projectMilestone.create({
          data: {
            organizationId: ctx.organizationId,
            projectId,
            title,
            description,
            dueDate,
            sortOrder,
          },
          include: { _count: { select: { tasks: true } } },
        });
      });

      if (!created) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
      return NextResponse.json({ milestone: serializeMilestone(created) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/projects/milestones',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create milestone.' }, { status: 500 });
    }
  });
}
