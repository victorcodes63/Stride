import { NextRequest, NextResponse } from 'next/server';
import { WorkflowType } from '@prisma/client';
import { canManageOnboarding } from '@/lib/hr-onboarding-access';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Onboarding template access requires HR admin privileges.');
    }

    const type = request.nextUrl.searchParams.get('type') as WorkflowType | null;
    const templates = await ctx.run((tx) =>
      tx.onboardingTemplate.findMany({
        where: {
          ...ctx.where(),
          ...(type ? { type } : {}),
        },
        include: { _count: { select: { steps: true, workflows: true } } },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      }),
    );

    return NextResponse.json(templates);
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Onboarding template access requires HR admin privileges.');
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body?.name || !body?.type) {
      return NextResponse.json({ error: 'name and type are required' }, { status: 400 });
    }

    const template = await ctx.run((tx) =>
      tx.onboardingTemplate.create({
        data: {
          organizationId: ctx.organizationId,
          name: String(body.name),
          type: String(body.type) as WorkflowType,
          isDefault: Boolean(body.isDefault),
        },
      }),
    );

    await ctx.audit({
      action: 'onboarding.template.created',
      entityType: 'OnboardingTemplate',
      entityId: template.id,
      route: 'POST /api/onboarding/templates',
    });

    return NextResponse.json(template, { status: 201 });
  });
}
