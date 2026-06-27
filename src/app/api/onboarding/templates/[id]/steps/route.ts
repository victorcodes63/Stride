import { NextRequest, NextResponse } from 'next/server';
import { canManageOnboarding } from '@/lib/hr-onboarding-access';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: templateId } = await context.params;
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Onboarding template access requires HR admin privileges.');
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body?.title || !body?.assignedRole) {
      return NextResponse.json({ error: 'title and assignedRole are required' }, { status: 400 });
    }

    const step = await ctx.run(async (tx) => {
      const template = await tx.onboardingTemplate.findFirst({ where: ctx.where({ id: templateId }) });
      if (!template) return null;
      return tx.onboardingTemplateStep.create({
        data: {
          organizationId: ctx.organizationId,
          templateId,
          title: String(body.title),
          description: typeof body.description === 'string' ? body.description : null,
          assignedRole: String(body.assignedRole),
          order: Number(body.order ?? 1),
          dueDaysOffset: Number(body.dueDaysOffset ?? 3),
          isRequired: body.isRequired === undefined ? true : Boolean(body.isRequired),
          category: typeof body.category === 'string' ? body.category : null,
        },
      });
    });

    if (!step) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    return NextResponse.json(step, { status: 201 });
  });
}
