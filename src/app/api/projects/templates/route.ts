import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { serializeTemplate } from '@/lib/projects/serialize';
import { expandTemplateBlueprint } from '@/lib/projects/templates';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const templates = await ctx.run((tx) =>
        tx.projectTemplate.findMany({
          where: ctx.where(),
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
          take: 200,
        }),
      );
      return NextResponse.json({ templates: templates.map(serializeTemplate) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/projects/templates',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load templates.' }, { status: 500 });
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
    const description = typeof body.description === 'string' ? body.description.trim() || null : null;
    const category = typeof body.category === 'string' ? body.category.trim() || null : null;

    // Normalize the (possibly untrusted) blueprint so we store a clean shape.
    const expanded = expandTemplateBlueprint(body.blueprint);
    const blueprint = {
      milestones: expanded.milestones.map((m) => ({
        title: m.title,
        description: m.description,
        tasks: m.tasks,
      })),
      tasks: expanded.tasks,
    } as unknown as Prisma.InputJsonValue;

    try {
      const template = await ctx.run((tx) =>
        tx.projectTemplate.create({
          data: {
            organizationId: ctx.organizationId,
            name,
            description,
            category,
            blueprint,
            createdByUserId: ctx.staff.id,
          },
        }),
      );
      return NextResponse.json({ template: serializeTemplate(template) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/projects/templates',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create template.' }, { status: 500 });
    }
  });
}
