import { NextRequest, NextResponse } from 'next/server';
import { OnboardingFormSubmissionStatus } from '@prisma/client';
import { canManageOnboarding } from '@/lib/hr-onboarding-access';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';
import { getEssPortalUserIdForEmployee, sendNotification } from '@/lib/notifications';

type RouteContext = { params: Promise<{ id: string }> };

const REVIEW_STATUSES: OnboardingFormSubmissionStatus[] = [
  OnboardingFormSubmissionStatus.APPROVED,
  OnboardingFormSubmissionStatus.REJECTED,
];

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Onboarding form review requires HR admin privileges.');
    }

    const submission = await ctx.run((tx) =>
      tx.onboardingFormSubmission.findFirst({
        where: ctx.where({ id }),
        include: {
          formTemplate: { select: { id: true, name: true, description: true, fields: true } },
          employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
          essPortalUser: { select: { id: true, name: true, email: true } },
          reviewedBy: { select: { id: true, name: true, email: true } },
          task: { select: { id: true, title: true, status: true, workflowId: true } },
        },
      }),
    );
    if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    return NextResponse.json(submission);
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Onboarding form review requires HR admin privileges.');
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const status = typeof body?.status === 'string' ? (body.status as OnboardingFormSubmissionStatus) : null;
    if (!status || !REVIEW_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'status must be APPROVED or REJECTED.' }, { status: 400 });
    }
    const reviewNotes = typeof body?.reviewNotes === 'string' ? body.reviewNotes : null;

    const result = await ctx.run(async (tx) => {
      const existing = await tx.onboardingFormSubmission.findFirst({
        where: ctx.where({ id }),
        select: { id: true, status: true, employeeId: true },
      });
      if (!existing) return null;
      if (existing.status === OnboardingFormSubmissionStatus.DRAFT) {
        return { error: 'Cannot review a draft submission.' as const };
      }
      const updated = await tx.onboardingFormSubmission.update({
        where: { id },
        data: {
          status,
          reviewedByUserId: ctx.staff.id,
          reviewNotes,
        },
        include: {
          formTemplate: { select: { id: true, name: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      return { updated, employeeId: existing.employeeId };
    });

    if (!result) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 409 });

    await ctx.audit({
      action: `onboarding.form_submission.${status.toLowerCase()}`,
      entityType: 'OnboardingFormSubmission',
      entityId: id,
      route: 'PUT /api/onboarding/forms/submissions/[id]',
      metadata: { status, hasNotes: Boolean(reviewNotes) },
    });

    // Notify the employee (best-effort) that their submission was reviewed.
    try {
      if (result.employeeId) {
        const essId = await getEssPortalUserIdForEmployee(result.employeeId);
        if (essId) {
          const approved = status === OnboardingFormSubmissionStatus.APPROVED;
          await sendNotification({
            event: 'onboarding_task_assigned',
            recipientEssPortalUserIds: [essId],
            title: approved ? 'Form approved' : 'Form needs changes',
            body: approved
              ? `Your "${result.updated.formTemplate.name}" submission was approved.`
              : `Your "${result.updated.formTemplate.name}" submission was rejected${reviewNotes ? `: ${reviewNotes}` : '.'}`,
            href: '/ess/onboarding',
            priority: approved ? 'info' : 'action_required',
            channel: 'in_app',
          });
        }
      }
    } catch (error) {
      console.error('[onboarding] Failed to notify submission review:', error);
    }

    return NextResponse.json(result.updated);
  });
}
