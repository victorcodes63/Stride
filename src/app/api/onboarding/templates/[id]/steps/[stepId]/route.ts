import { NextRequest, NextResponse } from 'next/server';
import { canManageOnboarding } from '@/lib/hr-onboarding-access';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string; stepId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id: templateId, stepId } = await context.params;
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Onboarding template access requires HR admin privileges.');
    }

    const deleted = await ctx.run(async (tx) => {
      const template = await tx.onboardingTemplate.findFirst({ where: ctx.where({ id: templateId }) });
      if (!template) return false;

      const step = await tx.onboardingTemplateStep.findFirst({
        where: { id: stepId, templateId, organizationId: ctx.organizationId },
      });
      if (!step) return false;

      await tx.onboardingTemplateStep.delete({ where: { id: stepId } });
      return true;
    });

    if (!deleted) return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  });
}
