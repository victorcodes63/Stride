import { NextRequest, NextResponse } from 'next/server';
import { OnboardingTaskType } from '@prisma/client';
import { canManageOnboarding } from '@/lib/hr-onboarding-access';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

const TASK_TYPES = Object.values(OnboardingTaskType) as string[];

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

    const taskType =
      typeof body.taskType === 'string' && TASK_TYPES.includes(body.taskType)
        ? (body.taskType as OnboardingTaskType)
        : OnboardingTaskType.CHECKLIST;
    const formTemplateId =
      taskType === OnboardingTaskType.FORM && typeof body.formTemplateId === 'string'
        ? body.formTemplateId
        : null;
    const signatureDocumentTitle =
      taskType === OnboardingTaskType.SIGNATURE && typeof body.signatureDocumentTitle === 'string'
        ? body.signatureDocumentTitle
        : null;
    const signatureDocumentPath =
      taskType === OnboardingTaskType.SIGNATURE && typeof body.signatureDocumentPath === 'string'
        ? body.signatureDocumentPath
        : null;

    if (taskType === OnboardingTaskType.FORM && !formTemplateId) {
      return NextResponse.json({ error: 'formTemplateId is required for FORM steps.' }, { status: 400 });
    }

    const step = await ctx.run(async (tx) => {
      const template = await tx.onboardingTemplate.findFirst({ where: ctx.where({ id: templateId }) });
      if (!template) return null;

      // Defense in depth: ensure the chosen form template belongs to this tenant.
      if (formTemplateId) {
        const form = await tx.onboardingFormTemplate.findFirst({
          where: ctx.where({ id: formTemplateId }),
          select: { id: true },
        });
        if (!form) return 'FORM_NOT_FOUND' as const;
      }

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
          taskType,
          formTemplateId,
          signatureDocumentTitle,
          signatureDocumentPath,
        },
      });
    });

    if (step === null) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    if (step === 'FORM_NOT_FOUND') {
      return NextResponse.json({ error: 'Selected form template not found.' }, { status: 400 });
    }
    return NextResponse.json(step, { status: 201 });
  });
}
