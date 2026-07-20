import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { reportApiError } from '@/lib/monitoring';
import { serializeLabel } from '@/lib/projects/serialize';
import { withTenant } from '@/lib/tenant-api';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (typeof body.color === 'string' && HEX_COLOR.test(body.color.trim())) data.color = body.color.trim();

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
    }

    try {
      const result = await ctx.run(async (tx) => {
        const existing = await tx.projectLabel.findFirst({
          where: ctx.where({ id }),
          select: { id: true },
        });
        if (!existing) return { notFound: true as const };

        try {
          const label = await tx.projectLabel.update({ where: { id }, data });
          return { label };
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            return { conflict: true as const };
          }
          throw err;
        }
      });

      if ('notFound' in result) return NextResponse.json({ error: 'Label not found.' }, { status: 404 });
      if ('conflict' in result) {
        return NextResponse.json({ error: 'A label with this name already exists.' }, { status: 409 });
      }
      return NextResponse.json({ label: serializeLabel(result.label) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/projects/labels/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update label.' }, { status: 500 });
    }
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    try {
      const deleted = await ctx.run(async (tx) => {
        const existing = await tx.projectLabel.findFirst({
          where: ctx.where({ id }),
          select: { id: true },
        });
        if (!existing) return null;
        // ProjectTaskLabel rows cascade at the DB level.
        await tx.projectLabel.delete({ where: { id } });
        return existing;
      });

      if (!deleted) return NextResponse.json({ error: 'Label not found.' }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/projects/labels/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete label.' }, { status: 500 });
    }
  });
}
