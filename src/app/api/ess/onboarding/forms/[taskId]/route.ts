import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import {
  OnboardingFormSubmissionStatus,
  OnboardingTaskStatus,
  OnboardingTaskType,
  WorkflowStatus,
} from '@prisma/client';
import { withEssTenant, type EssTenantContext } from '@/lib/ess-tenant-api';
import {
  getTaskDependencyBlocker,
  maybeCompleteWorkflow,
  refreshWorkflowTaskSLAs,
} from '@/lib/onboarding-workflows';
import { getHrUserIds, sendNotification } from '@/lib/notifications';

type RouteContext = { params: Promise<{ taskId: string }> };

type FieldDef = {
  key: string;
  label: string;
  type: string;
  required: boolean;
};

function parseFields(raw: unknown): FieldDef[] {
  if (!Array.isArray(raw)) return [];
  const out: FieldDef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const f = item as Record<string, unknown>;
    if (typeof f.key !== 'string' || typeof f.label !== 'string') continue;
    out.push({
      key: f.key,
      label: f.label,
      type: typeof f.type === 'string' ? f.type : 'text',
      required: Boolean(f.required),
    });
  }
  return out;
}

function missingRequired(fields: FieldDef[], data: Record<string, unknown>): string[] {
  const missing: string[] = [];
  for (const field of fields) {
    if (!field.required) continue;
    const value = data[field.key];
    if (field.type === 'checkbox') {
      if (value !== true) missing.push(field.label);
      continue;
    }
    if (value === null || value === undefined || String(value).trim() === '') {
      missing.push(field.label);
    }
  }
  return missing;
}

/** Load the FORM task for the current employee's in-progress workflow. */
async function loadFormTask(ctx: EssTenantContext, taskId: string) {
  return ctx.run((tx) =>
    tx.onboardingTask.findFirst({
      where: {
        id: taskId,
        ...ctx.where(),
        taskType: OnboardingTaskType.FORM,
        assignedRole: 'employee',
        workflow: { employeeId: ctx.employeeId!, status: WorkflowStatus.IN_PROGRESS },
      },
      include: {
        formTemplate: true,
        formSubmission: true,
        workflow: { select: { id: true, type: true, template: { select: { name: true } } } },
      },
    }),
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { taskId } = await context.params;
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json({ error: 'No employee profile.' }, { status: 400 });

    const task = await loadFormTask(ctx, taskId);
    if (!task) return NextResponse.json({ error: 'Form task not found.' }, { status: 404 });
    if (!task.formTemplate || !task.formTemplateId) {
      return NextResponse.json({ error: 'This form task has no template configured.' }, { status: 409 });
    }

    // Lazily create (and link) a DRAFT submission the first time the form is opened.
    let submission = task.formSubmission;
    if (!submission) {
      submission = await ctx.run(async (tx) => {
        const created = await tx.onboardingFormSubmission.create({
          data: {
            organizationId: ctx.organizationId,
            formTemplateId: task.formTemplateId!,
            employeeId: ctx.employeeId,
            essPortalUserId: ctx.essUser.id,
            data: {} as Prisma.InputJsonValue,
            status: OnboardingFormSubmissionStatus.DRAFT,
          },
        });
        await tx.onboardingTask.update({
          where: { id: task.id },
          data: { formSubmissionId: created.id },
        });
        return created;
      });
    }

    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        isRequired: task.isRequired,
        dueDate: task.dueDate?.toISOString() ?? null,
        taskType: task.taskType,
      },
      workflow: {
        id: task.workflow.id,
        type: task.workflow.type,
        templateName: task.workflow.template?.name ?? null,
      },
      formTemplate: {
        id: task.formTemplate.id,
        name: task.formTemplate.name,
        description: task.formTemplate.description,
        fields: task.formTemplate.fields,
      },
      submission: {
        id: submission.id,
        status: submission.status,
        data: submission.data,
        submittedAt: submission.submittedAt?.toISOString() ?? null,
        reviewNotes: submission.reviewNotes,
      },
    });
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { taskId } = await context.params;
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json({ error: 'No employee profile.' }, { status: 400 });

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const requestedStatus = typeof body?.status === 'string' ? body.status : 'DRAFT';
    if (requestedStatus !== 'DRAFT' && requestedStatus !== 'SUBMITTED') {
      return NextResponse.json({ error: "status must be 'DRAFT' or 'SUBMITTED'." }, { status: 400 });
    }
    const data =
      body?.data && typeof body.data === 'object' && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : {};

    const task = await loadFormTask(ctx, taskId);
    if (!task) return NextResponse.json({ error: 'Form task not found.' }, { status: 404 });
    if (!task.formTemplate || !task.formTemplateId) {
      return NextResponse.json({ error: 'This form task has no template configured.' }, { status: 409 });
    }
    if (task.formSubmission && task.formSubmission.status === OnboardingFormSubmissionStatus.APPROVED) {
      return NextResponse.json({ error: 'This form was already approved and is locked.' }, { status: 409 });
    }

    if (requestedStatus === 'SUBMITTED') {
      const fields = parseFields(task.formTemplate.fields);
      const missing = missingRequired(fields, data);
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Please complete required fields: ${missing.join(', ')}` },
          { status: 400 },
        );
      }
    }

    const isSubmit = requestedStatus === 'SUBMITTED';
    const status = isSubmit
      ? OnboardingFormSubmissionStatus.SUBMITTED
      : OnboardingFormSubmissionStatus.DRAFT;

    const submission = await ctx.run(async (tx) => {
      // Upsert the submission and ensure it is linked to the task.
      let sub = task.formSubmission;
      if (sub) {
        sub = await tx.onboardingFormSubmission.update({
          where: { id: sub.id },
          data: {
            data: data as Prisma.InputJsonValue,
            status,
            employeeId: ctx.employeeId,
            essPortalUserId: ctx.essUser.id,
            submittedAt: isSubmit ? new Date() : undefined,
          },
        });
      } else {
        sub = await tx.onboardingFormSubmission.create({
          data: {
            organizationId: ctx.organizationId,
            formTemplateId: task.formTemplateId!,
            employeeId: ctx.employeeId,
            essPortalUserId: ctx.essUser.id,
            data: data as Prisma.InputJsonValue,
            status,
            submittedAt: isSubmit ? new Date() : null,
          },
        });
      }
      if (task.formSubmissionId !== sub.id) {
        await tx.onboardingTask.update({
          where: { id: task.id },
          data: { formSubmissionId: sub.id },
        });
      }
      return sub;
    });

    if (isSubmit) {
      // Respect the module's dependency rules before completing the task.
      const blocker = await ctx.run(async (tx) => {
        const workflow = await tx.onboardingWorkflow.findFirst({
          where: { id: task.workflowId, ...ctx.where() },
          include: { tasks: true },
        });
        if (!workflow) return null;
        return getTaskDependencyBlocker({
          workflowType: workflow.type,
          targetTask: task,
          tasks: workflow.tasks,
        });
      });
      if (blocker) {
        return NextResponse.json({ error: blocker, submissionId: submission.id }, { status: 409 });
      }

      await ctx.run((tx) =>
        tx.onboardingTask.update({
          where: { id: task.id },
          data: { status: OnboardingTaskStatus.COMPLETED, completedAt: new Date() },
        }),
      );

      await refreshWorkflowTaskSLAs(task.workflowId);
      await maybeCompleteWorkflow(task.workflowId);

      await ctx.audit({
        action: 'ess.onboarding.form.submitted',
        entityType: 'OnboardingFormSubmission',
        entityId: submission.id,
        route: 'PUT /api/ess/onboarding/forms/[taskId]',
        metadata: { taskId: task.id, workflowId: task.workflowId, essUserId: ctx.essUser.id },
      });

      try {
        const hrUserIds = await getHrUserIds();
        await sendNotification({
          event: 'onboarding_task_assigned',
          recipientUserIds: hrUserIds,
          title: 'Onboarding form submitted',
          body: `${ctx.essUser.name} submitted "${task.formTemplate.name}" for review.`,
          href: `/dashboard/onboarding/forms/submissions/${submission.id}`,
          priority: 'action_required',
          channel: 'in_app',
        });
      } catch (error) {
        console.error('[onboarding] Failed to notify form submission:', error);
      }
    }

    return NextResponse.json({
      submission: {
        id: submission.id,
        status: submission.status,
        data: submission.data,
        submittedAt: submission.submittedAt?.toISOString() ?? null,
      },
    });
  });
}
