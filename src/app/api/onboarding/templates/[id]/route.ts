import { NextRequest, NextResponse } from 'next/server';
import { WorkflowType } from '@prisma/client';
import { canManageOnboarding } from '@/lib/hr-onboarding-access';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Onboarding template access requires HR admin privileges.');
    }

    const template = await ctx.run((tx) =>
      tx.onboardingTemplate.findFirst({
        where: ctx.where({ id }),
        include: { steps: { orderBy: { order: 'asc' } } },
      }),
    );
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    return NextResponse.json(template);
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Onboarding template access requires HR admin privileges.');
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const updated = await ctx.run(async (tx) => {
      const existing = await tx.onboardingTemplate.findFirst({ where: ctx.where({ id }) });
      if (!existing) return null;

      if (body.isDefault === true) {
        await tx.onboardingTemplate.updateMany({
          where: { organizationId: ctx.organizationId, type: existing.type, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.onboardingTemplate.update({
        where: { id },
        data: {
          name: typeof body.name === 'string' ? body.name : undefined,
          type: typeof body.type === 'string' ? (body.type as WorkflowType) : undefined,
          isDefault: typeof body.isDefault === 'boolean' ? body.isDefault : undefined,
        },
      });
    });

    if (!updated) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    return NextResponse.json(updated);
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Onboarding template access requires HR admin privileges.');
    }

    const deleted = await ctx.run(async (tx) => {
      const existing = await tx.onboardingTemplate.findFirst({ where: ctx.where({ id }) });
      if (!existing) return false;
      await tx.onboardingTemplate.delete({ where: { id } });
      return true;
    });

    if (!deleted) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  });
}
