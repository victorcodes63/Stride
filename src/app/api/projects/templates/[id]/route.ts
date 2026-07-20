import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { serializeTemplate } from '@/lib/projects/serialize';
import { expandTemplateBlueprint } from '@/lib/projects/templates';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    try {
      const template = await ctx.run((tx) =>
        tx.projectTemplate.findFirst({ where: ctx.where({ id }) }),
      );
      if (!template) return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
      return NextResponse.json({ template: serializeTemplate(template) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/projects/templates/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load template.' }, { status: 500 });
    }
  });
}

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
    if (typeof body.description === 'string') data.description = body.description.trim() || null;
    if (typeof body.category === 'string') data.category = body.category.trim() || null;
    if (body.blueprint !== undefined) {
      const expanded = expandTemplateBlueprint(body.blueprint);
      data.blueprint = {
        milestones: expanded.milestones.map((m) => ({
          title: m.title,
          description: m.description,
          tasks: m.tasks,
        })),
        tasks: expanded.tasks,
      } as unknown as Prisma.InputJsonValue;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
    }

    try {
      const result = await ctx.run(async (tx) => {
        const existing = await tx.projectTemplate.findFirst({
          where: ctx.where({ id }),
          select: { id: true },
        });
        if (!existing) return null;
        return tx.projectTemplate.update({ where: { id }, data });
      });

      if (!result) return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
      return NextResponse.json({ template: serializeTemplate(result) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/projects/templates/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update template.' }, { status: 500 });
    }
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    try {
      const deleted = await ctx.run(async (tx) => {
        const existing = await tx.projectTemplate.findFirst({
          where: ctx.where({ id }),
          select: { id: true },
        });
        if (!existing) return null;
        await tx.projectTemplate.delete({ where: { id } });
        return existing;
      });

      if (!deleted) return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/projects/templates/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete template.' }, { status: 500 });
    }
  });
}
