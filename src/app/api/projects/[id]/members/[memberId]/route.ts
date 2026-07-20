import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { serializeMember } from '@/lib/projects/serialize';
import { withTenant } from '@/lib/tenant-api';

const MEMBER_ROLES = ['owner', 'lead', 'member', 'viewer'] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id, memberId } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const role =
      typeof body.role === 'string' && MEMBER_ROLES.includes(body.role as (typeof MEMBER_ROLES)[number])
        ? body.role
        : null;
    if (!role) return NextResponse.json({ error: 'A valid role is required.' }, { status: 400 });

    try {
      const result = await ctx.run(async (tx) => {
        const existing = await tx.projectMember.findFirst({
          where: ctx.where({ id: memberId, projectId: id }),
          select: { id: true },
        });
        if (!existing) return null;

        return tx.projectMember.update({
          where: { id: memberId },
          data: { role },
          include: { user: { select: { id: true, name: true, email: true } } },
        });
      });

      if (!result) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
      return NextResponse.json({ member: serializeMember(result) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/projects/[id]/members/[memberId]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update member.' }, { status: 500 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id, memberId } = await params;

    try {
      const deleted = await ctx.run(async (tx) => {
        const existing = await tx.projectMember.findFirst({
          where: ctx.where({ id: memberId, projectId: id }),
          select: { id: true },
        });
        if (!existing) return null;
        await tx.projectMember.delete({ where: { id: memberId } });
        return existing;
      });

      if (!deleted) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/projects/[id]/members/[memberId]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to remove member.' }, { status: 500 });
    }
  });
}
