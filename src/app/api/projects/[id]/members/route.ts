import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { findScopedProject } from '@/lib/projects/route-helpers';
import { serializeMember } from '@/lib/projects/serialize';
import { withTenant } from '@/lib/tenant-api';

const MEMBER_ROLES = ['owner', 'lead', 'member', 'viewer'] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    try {
      const result = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const project = await findScopedProject(tx, {
          projectId: id,
          organizationId: ctx.organizationId,
          outsourcingClientId: clientId,
        });
        if (!project) return null;

        return tx.projectMember.findMany({
          where: ctx.where({ projectId: id }),
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        });
      });

      if (!result) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
      return NextResponse.json({ members: result.map(serializeMember) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/projects/[id]/members',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load members.' }, { status: 500 });
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

    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    if (!userId) return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
    const role =
      typeof body.role === 'string' && MEMBER_ROLES.includes(body.role as (typeof MEMBER_ROLES)[number])
        ? body.role
        : 'member';

    try {
      const result = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const project = await findScopedProject(tx, {
          projectId: id,
          organizationId: ctx.organizationId,
          outsourcingClientId: clientId,
        });
        if (!project) return { notFound: true as const };

        // Only allow real, active members of the organization to be added.
        const membership = await tx.organizationMembership.findFirst({
          where: { organizationId: ctx.organizationId, userId, status: 'active' },
          select: { userId: true },
        });
        if (!membership) return { badRequest: 'User is not an active member of this organization.' as const };

        const member = await tx.projectMember.upsert({
          where: { projectId_userId: { projectId: id, userId } },
          create: { organizationId: ctx.organizationId, projectId: id, userId, role },
          update: { role },
          include: { user: { select: { id: true, name: true, email: true } } },
        });
        return { member };
      });

      if ('notFound' in result) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
      if ('badRequest' in result) return NextResponse.json({ error: result.badRequest }, { status: 400 });
      return NextResponse.json({ member: serializeMember(result.member) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/projects/[id]/members',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to add member.' }, { status: 500 });
    }
  });
}
