import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { findScopedProject } from '@/lib/projects/route-helpers';
import { serializeActivity } from '@/lib/projects/serialize';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    const sp = request.nextUrl.searchParams;

    const takeRaw = Number.parseInt(sp.get('take') ?? '', 10);
    const take = Number.isFinite(takeRaw) ? Math.min(100, Math.max(1, takeRaw)) : 50;
    const cursor = sp.get('cursor')?.trim() || undefined;
    const beforeRaw = sp.get('before')?.trim();
    const before = beforeRaw ? new Date(beforeRaw) : undefined;
    const taskId = sp.get('taskId')?.trim() || undefined;

    try {
      const result = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const project = await findScopedProject(tx, {
          projectId: id,
          organizationId: ctx.organizationId,
          outsourcingClientId: clientId,
        });
        if (!project) return null;

        const where: Prisma.ProjectActivityWhereInput = ctx.where({
          projectId: id,
          ...(taskId ? { taskId } : {}),
          ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}),
        });

        // Fetch one extra row to determine whether more pages exist.
        const rows = await tx.projectActivity.findMany({
          where,
          include: { actor: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          take: take + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        return rows;
      });

      if (!result) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });

      const hasMore = result.length > take;
      const page = hasMore ? result.slice(0, take) : result;
      const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

      return NextResponse.json({
        activity: page.map(serializeActivity),
        nextCursor,
        hasMore,
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/projects/[id]/activity',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load activity.' }, { status: 500 });
    }
  });
}
