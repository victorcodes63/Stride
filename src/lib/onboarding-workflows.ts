import {
  Prisma,
  WorkflowType,
  WorkflowStatus,
  OnboardingTaskStatus,
  OnboardingTaskType,
  OnboardingSignatureStatus,
  TaskRecurrence,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createWorkflowRun, getHrUserIds, sendNotification, transitionWorkflowRun } from '@/lib/notifications';
import {
  deriveOffboardingCheckpointState,
  getUnsatisfiedOffboardingCheckpoints,
  type OffboardingCheckpointKey,
} from '@/lib/onboarding-checkpoints';

export { deriveOffboardingCheckpointState, getUnsatisfiedOffboardingCheckpoints };
export type { OffboardingCheckpointKey };

const CLINICAL_KEYWORDS = [
  'doctor',
  'nurse',
  'clinical',
  'lab',
  'pharmac',
  'theatre',
  'icu',
  'radiolog',
  'surgeon',
  'anesth',
];

function isClinicalEmployee(input: { jobTitle?: string | null; departmentName?: string | null }): boolean {
  const text = `${input.jobTitle ?? ''} ${input.departmentName ?? ''}`.toLowerCase();
  return CLINICAL_KEYWORDS.some((keyword) => text.includes(keyword));
}

export function getRoleKeysForUser(user: { role: string; staffUserType?: string | null }): string[] {
  const roles = new Set<string>();
  if (user.role === 'admin') roles.add('admin');
  if (user.role === 'admin' || user.staffUserType === 'business_manager' || user.staffUserType === 'operations') roles.add('hr');
  if (user.role === 'admin' || user.staffUserType === 'operations') roles.add('it');
  if (user.role === 'admin' || user.staffUserType === 'director' || user.staffUserType === 'business_manager') {
    roles.add('department_head');
  }
  return [...roles];
}

type TaskShape = {
  id: string;
  title: string;
  category: string | null;
  assignedRole?: string;
  status: OnboardingTaskStatus;
  isRequired: boolean;
  dueDate: Date | null;
  order: number;
};

const ACTIVE_TASK_STATUSES: OnboardingTaskStatus[] = [OnboardingTaskStatus.PENDING, OnboardingTaskStatus.IN_PROGRESS];
const COMPLETED_TASK_STATUSES: OnboardingTaskStatus[] = [OnboardingTaskStatus.COMPLETED, OnboardingTaskStatus.SKIPPED];

function normalizeTaskText(task: Pick<TaskShape, 'title' | 'category'>): string {
  return `${task.title} ${task.category ?? ''}`.toLowerCase();
}

function taskMatchesKeywords(task: Pick<TaskShape, 'title' | 'category'>, keywords: readonly string[]): boolean {
  const text = normalizeTaskText(task);
  return keywords.some((keyword) => text.includes(keyword));
}

const OFFBOARDING_CHECKPOINTS = {
  clearance: ['clearance'],
  assetRecovery: ['collect', 'asset', 'equipment', 'badge', 'uniform', 'keys'],
  accessRevocation: ['revoke', 'access', 'credential', 'login', 'biometric'],
  finalSettlement: ['final pay', 'settle', 'loan', 'advance', 'settlement'],
  evidenceArchive: ['archive', 'records', 'certificate', 'signed', 'document'],
} as const;

export function getTaskDependencyBlocker(params: {
  workflowType: WorkflowType;
  targetTask: TaskShape;
  tasks: TaskShape[];
}): string | null {
  const { workflowType, targetTask, tasks } = params;
  const normalizedCategory = (targetTask.category ?? '').toLowerCase();

  if (workflowType === WorkflowType.ONBOARDING) {
    if (normalizedCategory === 'orientation') {
      const blockers = tasks.filter((task) => {
        const category = (task.category ?? '').toLowerCase();
        if (!['documents', 'access', 'compliance'].includes(category)) return false;
        if (!task.isRequired) return false;
        return !COMPLETED_TASK_STATUSES.includes(task.status);
      });
      if (blockers.length > 0) return 'Complete required document/access/compliance tasks before orientation.';
    }

    if (normalizedCategory === 'access') {
      const blockers = tasks.filter((task) => {
        const category = (task.category ?? '').toLowerCase();
        if (!['documents', 'compliance'].includes(category)) return false;
        if (!task.isRequired) return false;
        return !COMPLETED_TASK_STATUSES.includes(task.status);
      });
      if (blockers.length > 0) return 'Complete required document/compliance tasks before granting access.';
    }
    return null;
  }

  if (workflowType === WorkflowType.OFFBOARDING) {
    if (taskMatchesKeywords(targetTask, OFFBOARDING_CHECKPOINTS.evidenceArchive)) {
      const blockers = getUnsatisfiedOffboardingCheckpoints(tasks.filter((task) => task.id !== targetTask.id));
      if (blockers.length > 0) return 'Complete clearance, access revocation, asset recovery and settlement checkpoints first.';
    }
    return null;
  }

  return null;
}

export function canUserActionTask(
  task: { assignedRole: string; assignedToId?: string | null },
  user: { id: string; role: string; staffUserType?: string | null },
): boolean {
  if (user.role === 'admin') return true;
  if (task.assignedToId && task.assignedToId === user.id) return true;
  const roleKeys = getRoleKeysForUser(user);
  return roleKeys.includes(task.assignedRole);
}

export async function refreshWorkflowTaskSLAs(workflowId: string, now = new Date()) {
  const workflow = await prisma.onboardingWorkflow.findUnique({
    where: { id: workflowId },
    include: { tasks: true },
  });
  if (!workflow || workflow.status !== WorkflowStatus.IN_PROGRESS) return { overdueMarked: 0, escalated: false };

  const overdueTaskIds = workflow.tasks
    .filter((task) => task.dueDate && task.dueDate.getTime() < now.getTime())
    .filter((task) => ACTIVE_TASK_STATUSES.includes(task.status))
    .map((task) => task.id);

  if (overdueTaskIds.length > 0) {
    await prisma.onboardingTask.updateMany({
      where: { id: { in: overdueTaskIds } },
      data: { status: OnboardingTaskStatus.OVERDUE },
    });
  }

  const shouldEscalate = overdueTaskIds.length > 0 && workflow.tasks.some((task) => task.isRequired && overdueTaskIds.includes(task.id));
  let escalated = false;
  if (shouldEscalate) {
    const run = await prisma.workflowRun.findFirst({
      where: { entityType: 'OnboardingWorkflow', entityId: workflowId },
      select: { id: true, status: true },
      orderBy: { createdAt: 'desc' },
    });
    if (run && run.status !== 'escalated') {
      await transitionWorkflowRun(run.id, 'escalated', {
        escalatedAt: now.toISOString(),
        overdueTaskCount: overdueTaskIds.length,
      });
      escalated = true;
      const hrUserIds = await getHrUserIds();
      await sendNotification({
        event: 'profile_change_requested',
        recipientUserIds: hrUserIds,
        title: 'Onboarding/offboarding tasks overdue',
        body: `${workflow.type === WorkflowType.ONBOARDING ? 'Onboarding' : 'Offboarding'} workflow has overdue required tasks.`,
        href: `/dashboard/onboarding/${workflowId}`,
        priority: 'urgent',
        channel: 'both',
        workflowRunId: run.id,
        metadata: { workflowId, overdueTaskIds },
      });
    }
  }

  return { overdueMarked: overdueTaskIds.length, escalated };
}

async function selectDefaultTemplate(
  employeeId: string,
  type: WorkflowType,
  tx: Prisma.TransactionClient,
  organizationId?: string,
) {
  const employee = await tx.employee.findUnique({
    where: { id: employeeId },
    select: { jobTitle: true, organizationId: true, department: { select: { name: true } } },
  });
  if (!employee) return null;

  const clinical = isClinicalEmployee({
    jobTitle: employee.jobTitle,
    departmentName: employee.department?.name,
  });

  const orgId = organizationId ?? employee.organizationId;
  const baseWhere: Prisma.OnboardingTemplateWhereInput = {
    type,
    isDefault: true,
    ...(orgId ? { organizationId: orgId } : {}),
  };
  if (type === WorkflowType.ONBOARDING) {
    const preferredName = clinical ? 'clinical' : 'non-clinical';
    const preferred = await tx.onboardingTemplate.findFirst({
      where: { ...baseWhere, name: { contains: preferredName, mode: 'insensitive' } },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (preferred) return preferred;
  }

  return tx.onboardingTemplate.findFirst({
    where: baseWhere,
    include: { steps: { orderBy: { order: 'asc' } } },
  });
}

export async function startWorkflowForEmployee(params: {
  employeeId: string;
  type: WorkflowType;
  templateId?: string;
}) {
  const { employeeId, type, templateId } = params;

  const result = await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, firstName: true, lastName: true, organizationId: true },
    });
    if (!employee) return null;

    const existing = await tx.onboardingWorkflow.findFirst({
      where: { employeeId, type, status: WorkflowStatus.IN_PROGRESS },
      include: { tasks: true },
    });
    if (existing) return { employee, workflow: existing, created: false };

    const template = templateId
      ? await tx.onboardingTemplate.findFirst({
          where: { id: templateId, type, organizationId: employee.organizationId },
          include: { steps: { orderBy: { order: 'asc' } } },
        })
      : await selectDefaultTemplate(employeeId, type, tx, employee.organizationId);
    if (!template) return null;

    const workflow = await tx.onboardingWorkflow.create({
      data: {
        organizationId: employee.organizationId,
        employeeId,
        templateId: template.id,
        type,
        status: WorkflowStatus.IN_PROGRESS,
      },
    });

    if (template.steps.length > 0) {
      const startedAt = workflow.startedAt ?? new Date();
      // Instantiate one task per step. Signature steps pre-create a pending
      // signature request so HR can track it; form steps carry the form template
      // and lazily create a submission when the participant first opens the task.
      for (const step of template.steps) {
        let signatureRequestId: string | undefined;
        if (step.taskType === OnboardingTaskType.SIGNATURE) {
          const sig = await tx.onboardingSignatureRequest.create({
            data: {
              organizationId: employee.organizationId,
              documentTitle: step.signatureDocumentTitle?.trim() || step.title,
              documentPath: step.signatureDocumentPath ?? null,
              employeeId,
              status: OnboardingSignatureStatus.PENDING,
            },
            select: { id: true },
          });
          signatureRequestId = sig.id;
        }
        await tx.onboardingTask.create({
          data: {
            organizationId: employee.organizationId,
            workflowId: workflow.id,
            title: step.title,
            description: step.description,
            assignedRole: step.assignedRole,
            category: step.category,
            order: step.order,
            isRequired: step.isRequired,
            startDate: startedAt,
            // Negative dueDaysOffset supports pre-boarding tasks (before the start date).
            dueDate: new Date(startedAt.getTime() + step.dueDaysOffset * 86400000),
            status: OnboardingTaskStatus.PENDING,
            taskType: step.taskType,
            formTemplateId: step.taskType === OnboardingTaskType.FORM ? step.formTemplateId : null,
            signatureRequestId,
          },
        });
      }
    }

    const full = await tx.onboardingWorkflow.findUnique({
      where: { id: workflow.id },
      include: { tasks: true },
    });
    return full ? { employee, workflow: full, created: true } : null;
  });

  if (result?.created) {
    try {
      const hrUserIds = await getHrUserIds();
      const typeLabel = result.workflow.type === WorkflowType.ONBOARDING ? 'onboarding' : 'offboarding';
      const workflowRun = await createWorkflowRun({
        module: 'onboarding',
        event: 'workflow_started',
        entityType: 'OnboardingWorkflow',
        entityId: result.workflow.id,
        dueAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        assigneeUserId: hrUserIds[0] ?? null,
        metadata: { employeeId: result.employee.id, type: result.workflow.type },
      });
      await sendNotification({
        event: 'employee_created',
        recipientUserIds: hrUserIds,
        title: `${typeLabel[0].toUpperCase()}${typeLabel.slice(1)} workflow started`,
        body: `${typeLabel} started for ${result.employee.firstName} ${result.employee.lastName}. ${result.workflow.tasks.length} tasks created.`,
        href: `/dashboard/onboarding/${result.workflow.id}`,
        priority: 'action_required',
        channel: 'in_app',
        workflowRunId: workflowRun.id,
      });
    } catch (error) {
      console.error('[onboarding] Failed to send start notification:', error);
    }
  }

  return result;
}

export async function maybeCompleteWorkflow(workflowId: string) {
  const workflow = await prisma.onboardingWorkflow.findUnique({
    where: { id: workflowId },
    include: {
      employee: { select: { firstName: true, lastName: true } },
      tasks: { select: { isRequired: true, status: true } },
    },
  });
  if (!workflow || workflow.status !== WorkflowStatus.IN_PROGRESS) return null;
  // Operational buckets are ongoing containers — they never auto-complete.
  if (workflow.type === WorkflowType.OPERATIONAL) return null;

  await refreshWorkflowTaskSLAs(workflowId);
  const refreshed = await prisma.onboardingWorkflow.findUnique({
    where: { id: workflowId },
    include: {
      employee: { select: { firstName: true, lastName: true } },
      tasks: { select: { id: true, title: true, category: true, isRequired: true, status: true, dueDate: true, order: true } },
    },
  });
  if (!refreshed || refreshed.status !== WorkflowStatus.IN_PROGRESS) return null;

  const hasPendingRequired = refreshed.tasks.some(
    (task) => task.isRequired && task.status !== OnboardingTaskStatus.COMPLETED,
  );
  if (hasPendingRequired) return null;

  if (refreshed.type === WorkflowType.OFFBOARDING) {
    const unsatisfied = getUnsatisfiedOffboardingCheckpoints(refreshed.tasks);
    if (unsatisfied.length > 0) return null;
  }

  const completed = await prisma.onboardingWorkflow.update({
    where: { id: workflowId },
    data: { status: WorkflowStatus.COMPLETED, completedAt: new Date() },
  });

  try {
    const workflowRun = await prisma.workflowRun.findFirst({
      where: { entityType: 'OnboardingWorkflow', entityId: workflowId },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (workflowRun) {
      await transitionWorkflowRun(workflowRun.id, 'completed', { completedAt: new Date().toISOString() });
    }
    const hrUserIds = await getHrUserIds();
    await sendNotification({
      event: 'employee_created',
      recipientUserIds: hrUserIds,
      title: 'Workflow completed',
      body: `${refreshed.type === WorkflowType.ONBOARDING ? 'Onboarding' : 'Offboarding'} completed for ${refreshed.employee?.firstName ?? ''} ${refreshed.employee?.lastName ?? ''}.`,
      href: `/dashboard/onboarding/${workflowId}`,
      priority: 'info',
      channel: 'in_app',
      workflowRunId: workflowRun?.id,
    });
  } catch (error) {
    console.error('[onboarding] Failed to send completion notification:', error);
  }

  return completed;
}

/** Advance a date by one recurrence interval. */
export function advanceByRecurrence(date: Date, recurrence: TaskRecurrence): Date {
  const next = new Date(date);
  switch (recurrence) {
    case TaskRecurrence.DAILY:
      next.setDate(next.getDate() + 1);
      break;
    case TaskRecurrence.WEEKLY:
      next.setDate(next.getDate() + 7);
      break;
    case TaskRecurrence.MONTHLY:
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      break;
  }
  return next;
}

/**
 * When a recurring task is completed, create its next occurrence with dates
 * shifted forward by one interval. Returns the new task (or null when the
 * series has ended / the task is not recurring).
 */
export async function spawnRecurrenceFollowUp(taskId: string) {
  const task = await prisma.onboardingTask.findUnique({ where: { id: taskId } });
  if (!task || task.recurrence === TaskRecurrence.NONE) return null;

  const baseDue = task.dueDate ?? new Date();
  const nextDue = advanceByRecurrence(baseDue, task.recurrence);
  if (task.recurrenceEndsAt && nextDue.getTime() > task.recurrenceEndsAt.getTime()) return null;

  const nextStart = task.startDate ? advanceByRecurrence(task.startDate, task.recurrence) : new Date();
  const last = await prisma.onboardingTask.findFirst({
    where: { workflowId: task.workflowId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });

  const created = await prisma.onboardingTask.create({
    data: {
      organizationId: task.organizationId,
      workflowId: task.workflowId,
      title: task.title,
      description: task.description,
      assignedRole: task.assignedRole,
      assignedToId: task.assignedToId,
      category: task.category,
      order: (last?.order ?? 0) + 1,
      isRequired: task.isRequired,
      priority: task.priority,
      recurrence: task.recurrence,
      recurrenceEndsAt: task.recurrenceEndsAt,
      employeeId: task.employeeId,
      startDate: nextStart,
      dueDate: nextDue,
      status: OnboardingTaskStatus.PENDING,
    },
  });

  if (created.assignedToId) {
    try {
      await sendNotification({
        event: 'onboarding_task_assigned',
        recipientUserIds: [created.assignedToId],
        title: 'Recurring task ready',
        body: `The next occurrence of "${created.title}" is now open.`,
        href: '/dashboard/people/tasks',
        priority: 'action_required',
        channel: 'both',
        metadata: {
          taskId: created.id,
          taskTitle: created.title,
          dueLabel: created.dueDate ? created.dueDate.toISOString().slice(0, 10) : 'No due date',
        },
      });
    } catch (error) {
      console.error('[onboarding] Failed to notify recurring task assignee:', error);
    }
  }

  return created;
}

/**
 * Find (or lazily create) the single OPERATIONAL workflow bucket that holds a
 * workspace's ad-hoc operational tasks. Runs inside the caller's tenant tx.
 */
export async function ensureOperationalWorkflow(
  tx: Prisma.TransactionClient,
  organizationId: string,
  outsourcingClientId: string,
) {
  const existing = await tx.onboardingWorkflow.findFirst({
    where: { organizationId, type: WorkflowType.OPERATIONAL, outsourcingClientId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.onboardingWorkflow.create({
    data: {
      organizationId,
      type: WorkflowType.OPERATIONAL,
      status: WorkflowStatus.IN_PROGRESS,
      outsourcingClientId,
      title: 'Operational tasks',
    },
    select: { id: true },
  });
  return created.id;
}
