import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { findScopedProject } from '@/lib/projects/route-helpers';
import { serializeLabel } from '@/lib/projects/serialize';
import { withTenant } from '@/lib/tenant-api';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const projectId = request.nextUrl.searchParams.get('projectId')?.trim() || undefined;

    try {
      const labels = await ctx.run((tx) =>
        tx.projectLabel.findMany({
          // Org-wide labels (projectId null) plus, when requested, labels scoped to a project.
          where: ctx.where(projectId ? { OR: [{ projectId: null }, { projectId }] } : {}),
          orderBy: [{ projectId: 'asc' }, { name: 'asc' }],
        }),
      );
      return NextResponse.json({ labels: labels.map(serializeLabel) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/projects/labels',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load labels.' }, { status: 500 });
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
    if (!name) return NextResponse.json({ error: 'name is required.' }, { status: 400 });
    const color = typeof body.color === 'string' && HEX_COLOR.test(body.color.trim())
      ? body.color.trim()
      : '#6b7280';
    const projectId = typeof body.projectId === 'string' && body.projectId.trim() ? body.projectId.trim() : null;

    try {
      const result = await ctx.run(async (tx) => {
        if (projectId) {
          const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
          const project = await findScopedProject(tx, {
            projectId,
            organizationId: ctx.organizationId,
            outsourcingClientId: clientId,
          });
          if (!project) return { notFound: true as const };
        }

        try {
          const label = await tx.projectLabel.create({
            data: { organizationId: ctx.organizationId, projectId, name, color },
          });
          return { label };
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            return { conflict: true as const };
          }
          throw err;
        }
      });

      if ('notFound' in result) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
      if ('conflict' in result) {
        return NextResponse.json({ error: 'A label with this name already exists.' }, { status: 409 });
      }
      return NextResponse.json({ label: serializeLabel(result.label) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/projects/labels',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create label.' }, { status: 500 });
    }
  });
}
