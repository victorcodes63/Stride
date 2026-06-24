import type { Prisma } from '@prisma/client';
import { Prisma as PrismaRuntime } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildNotificationEmail, type NotificationEvent } from '@/lib/notification-emails';
import { sendEmail } from '@/lib/email';
import { logAuditEvent } from '@/lib/audit-events';

export type NotificationChannel = 'in_app' | 'email' | 'both';
export type NotificationPriority = 'info' | 'action_required' | 'urgent';
export type WorkflowState =
  | 'pending'
  | 'in_progress'
  | 'delegated'
  | 'escalated'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled';
type WorkflowRecipientKind = 'staff' | 'ess';

export interface NotificationPayload {
  event: NotificationEvent;
  recipientUserIds?: string[];
  recipientEssPortalUserIds?: string[];
  title: string;
  body: string;
  href?: string;
  priority: NotificationPriority;
  channel: NotificationChannel;
  emailSubject?: string;
  emailHtml?: string;
  metadata?: Record<string, unknown>;
  workflowRunId?: string;
  triggerType?: 'event' | 'time' | 'manual';
}

export interface WorkflowPrimitivePayload {
  module: 'leave' | 'onboarding' | 'credentials' | 'payroll' | 'general';
  event: string;
  entityType: string;
  entityId: string;
  entityCode?: string | null;
  assigneeUserId?: string | null;
  assigneeEssPortalUserId?: string | null;
  dueAt?: Date | null;
  metadata?: Record<string, unknown>;
}

export interface DelegateWorkflowPayload {
  workflowRunId: string;
  fromUserId: string;
  toUserId: string;
  actor: { userId: string; email: string; name?: string | null | undefined };
  reason?: string | null;
}

function parseMinutes(value?: string | null): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(':').map((n) => parseInt(n, 10));
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function isWithinQuietHours(
  now: Date,
  quietHoursStart?: string | null,
  quietHoursEnd?: string | null
): boolean {
  const start = parseMinutes(quietHoursStart);
  const end = parseMinutes(quietHoursEnd);
  if (start === null || end === null) return false;
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (start === end) return true;
  if (start < end) return mins >= start && mins < end;
  return mins >= start || mins < end;
}

export function shouldEscalateWorkflow(input: {
  dueAt: Date | null;
  status: WorkflowState;
  now: Date;
}): boolean {
  if (!input.dueAt) return false;
  if (!['pending', 'in_progress', 'delegated'].includes(input.status)) return false;
  return input.dueAt.getTime() < input.now.getTime();
}

function channelAllowedByPolicy(policy: {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  actionRequiredEmail: boolean;
  urgentEmail: boolean;
} | null, channel: NotificationChannel, priority: NotificationPriority): boolean {
  if (!policy) return true;
  if (channel === 'in_app') return policy.inAppEnabled;
  if (channel === 'email') {
    if (!policy.emailEnabled) return false;
    if (priority === 'action_required' && !policy.actionRequiredEmail) return false;
    if (priority === 'urgent' && !policy.urgentEmail) return false;
    return true;
  }
  return policy.inAppEnabled || policy.emailEnabled;
}

async function createDeliveryRecord(input: {
  staffNotificationId?: string | null;
  workflowRunId?: string | null;
  event: string;
  triggerType: 'event' | 'time' | 'manual';
  recipientKind: WorkflowRecipientKind;
  recipientUserId?: string | null;
  recipientEssPortalUserId?: string | null;
  channel: NotificationChannel;
  status: 'pending' | 'sent' | 'failed' | 'skipped_quiet_hours' | 'skipped_policy';
  provider?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.notificationDelivery.create({
    data: {
      staffNotificationId: input.staffNotificationId ?? null,
      workflowRunId: input.workflowRunId ?? null,
      event: input.event,
      triggerType: input.triggerType,
      recipientKind: input.recipientKind,
      recipientUserId: input.recipientUserId ?? null,
      recipientEssPortalUserId: input.recipientEssPortalUserId ?? null,
      channel: input.channel,
      status: input.status,
      provider: input.provider ?? null,
      error: input.error ?? null,
      deliveredAt: input.status === 'sent' ? new Date() : null,
      metadata: toPrismaJson(input.metadata),
    },
  });
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof PrismaRuntime.JsonNull {
  if (value == null) return PrismaRuntime.JsonNull;
  return value as Prisma.InputJsonValue;
}

export async function getUserIdsByRole(role: 'admin' | 'staff' | 'viewer'): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { role, isActive: true },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function getHrUserIds(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [{ role: 'admin' }, { staffUserType: { in: ['operations', 'business_manager'] } }],
    },
    select: { id: true },
  });
  return [...new Set(users.map((u) => u.id))];
}

export async function getPayrollUserIds(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [{ role: 'admin' }, { staffUserType: 'finance' }],
    },
    select: { id: true },
  });
  return [...new Set(users.map((u) => u.id))];
}

export async function getManagerUserIdForEmployee(employeeId: string): Promise<string | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { managerEmployeeId: true },
  });
  if (!employee?.managerEmployeeId) return null;
  const managerEss = await prisma.essPortalUser.findFirst({
    where: { employeeId: employee.managerEmployeeId, isActive: true },
    select: { id: true },
  });
  return managerEss?.id ?? null;
}

export async function getEssPortalUserIdForEmployee(employeeId: string): Promise<string | null> {
  const essUser = await prisma.essPortalUser.findFirst({
    where: { employeeId, isActive: true },
    select: { id: true },
  });
  return essUser?.id ?? null;
}

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const staffIds = [...new Set(payload.recipientUserIds ?? [])];
  const essIds = [...new Set(payload.recipientEssPortalUserIds ?? [])];
  const triggerType = payload.triggerType ?? 'event';

  const [staffPolicies, essPolicies] = await Promise.all([
    staffIds.length
      ? prisma.notificationPolicy.findMany({
          where: { userId: { in: staffIds } },
          select: {
            userId: true,
            inAppEnabled: true,
            emailEnabled: true,
            actionRequiredEmail: true,
            urgentEmail: true,
            quietHoursEnabled: true,
            quietHoursStart: true,
            quietHoursEnd: true,
          },
        })
      : Promise.resolve([]),
    essIds.length
      ? prisma.notificationPolicy.findMany({
          where: { essPortalUserId: { in: essIds } },
          select: {
            essPortalUserId: true,
            inAppEnabled: true,
            emailEnabled: true,
            actionRequiredEmail: true,
            urgentEmail: true,
            quietHoursEnabled: true,
            quietHoursStart: true,
            quietHoursEnd: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const staffPolicyMap = new Map(staffPolicies.map((p) => [p.userId as string, p]));
  const essPolicyMap = new Map(essPolicies.map((p) => [p.essPortalUserId as string, p]));
  const now = new Date();

  if (payload.channel === 'in_app' || payload.channel === 'both') {
    if (staffIds.length > 0) {
      for (const userId of staffIds) {
        const policy = staffPolicyMap.get(userId) ?? null;
        if (!channelAllowedByPolicy(policy, 'in_app', payload.priority)) {
          await createDeliveryRecord({
            workflowRunId: payload.workflowRunId ?? null,
            event: payload.event,
            triggerType,
            recipientKind: 'staff',
            recipientUserId: userId,
            channel: 'in_app',
            status: 'skipped_policy',
            metadata: payload.metadata,
          });
          continue;
        }
        const notification = await prisma.staffNotification.create({
          data: {
            userId,
            title: payload.title,
            body: payload.body,
            href: payload.href || null,
            event: payload.event,
            priority: payload.priority,
          },
          select: { id: true },
        });
        await createDeliveryRecord({
          staffNotificationId: notification.id,
          workflowRunId: payload.workflowRunId ?? null,
          event: payload.event,
          triggerType,
          recipientKind: 'staff',
          recipientUserId: userId,
          channel: 'in_app',
          status: 'sent',
          provider: 'database',
          metadata: payload.metadata,
        });
      }
    }
    if (essIds.length > 0) {
      for (const essPortalUserId of essIds) {
        const policy = essPolicyMap.get(essPortalUserId) ?? null;
        if (!channelAllowedByPolicy(policy, 'in_app', payload.priority)) {
          await createDeliveryRecord({
            workflowRunId: payload.workflowRunId ?? null,
            event: payload.event,
            triggerType,
            recipientKind: 'ess',
            recipientEssPortalUserId: essPortalUserId,
            channel: 'in_app',
            status: 'skipped_policy',
            metadata: payload.metadata,
          });
          continue;
        }
        const notification = await prisma.staffNotification.create({
          data: {
            essPortalUserId,
            title: payload.title,
            body: payload.body,
            href: payload.href || null,
            event: payload.event,
            priority: payload.priority,
          },
          select: { id: true },
        });
        await createDeliveryRecord({
          staffNotificationId: notification.id,
          workflowRunId: payload.workflowRunId ?? null,
          event: payload.event,
          triggerType,
          recipientKind: 'ess',
          recipientEssPortalUserId: essPortalUserId,
          channel: 'in_app',
          status: 'sent',
          provider: 'database',
          metadata: payload.metadata,
        });
      }
    }
  }

  if (payload.channel === 'email' || payload.channel === 'both') {
    let emailSubject = payload.emailSubject;
    let emailHtml = payload.emailHtml;
    if (!emailHtml) {
      const generated = buildNotificationEmail(payload.event, {
        ...(payload.metadata || {}),
        body: payload.body,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '',
      });
      emailSubject = emailSubject || generated.subject;
      emailHtml = generated.html;
    }
    if (!emailSubject || !emailHtml) {
      console.warn(`[notifications] Event ${payload.event} requested email but no subject/html provided`);
      return;
    }

    if (staffIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: staffIds }, isActive: true },
        select: { id: true, email: true },
      });
      for (const user of users) {
        if (!user.email) continue;
        const policy = staffPolicyMap.get(user.id) ?? null;
        if (!channelAllowedByPolicy(policy, 'email', payload.priority)) {
          await createDeliveryRecord({
            workflowRunId: payload.workflowRunId ?? null,
            event: payload.event,
            triggerType,
            recipientKind: 'staff',
            recipientUserId: user.id,
            channel: 'email',
            status: 'skipped_policy',
            metadata: payload.metadata,
          });
          continue;
        }
        if (policy?.quietHoursEnabled && isWithinQuietHours(now, policy.quietHoursStart, policy.quietHoursEnd)) {
          await createDeliveryRecord({
            workflowRunId: payload.workflowRunId ?? null,
            event: payload.event,
            triggerType,
            recipientKind: 'staff',
            recipientUserId: user.id,
            channel: 'email',
            status: 'skipped_quiet_hours',
            metadata: payload.metadata,
          });
          continue;
        }
        try {
          const result = await sendEmail({ to: user.email, subject: emailSubject, html: emailHtml });
          await createDeliveryRecord({
            workflowRunId: payload.workflowRunId ?? null,
            event: payload.event,
            triggerType,
            recipientKind: 'staff',
            recipientUserId: user.id,
            channel: 'email',
            status: result.sent ? 'sent' : 'failed',
            provider: result.sent ? 'email' : null,
            error: result.sent ? null : result.error,
            metadata: payload.metadata,
          });
        } catch (err) {
          console.error(`[notifications] Failed to email ${user.email} for ${payload.event}:`, err);
          await createDeliveryRecord({
            workflowRunId: payload.workflowRunId ?? null,
            event: payload.event,
            triggerType,
            recipientKind: 'staff',
            recipientUserId: user.id,
            channel: 'email',
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
            metadata: payload.metadata,
          });
        }
      }
    }

    if (essIds.length > 0) {
      const users = await prisma.essPortalUser.findMany({
        where: { id: { in: essIds }, isActive: true },
        select: { id: true, email: true },
      });
      for (const user of users) {
        if (!user.email) continue;
        const policy = essPolicyMap.get(user.id) ?? null;
        if (!channelAllowedByPolicy(policy, 'email', payload.priority)) {
          await createDeliveryRecord({
            workflowRunId: payload.workflowRunId ?? null,
            event: payload.event,
            triggerType,
            recipientKind: 'ess',
            recipientEssPortalUserId: user.id,
            channel: 'email',
            status: 'skipped_policy',
            metadata: payload.metadata,
          });
          continue;
        }
        if (policy?.quietHoursEnabled && isWithinQuietHours(now, policy.quietHoursStart, policy.quietHoursEnd)) {
          await createDeliveryRecord({
            workflowRunId: payload.workflowRunId ?? null,
            event: payload.event,
            triggerType,
            recipientKind: 'ess',
            recipientEssPortalUserId: user.id,
            channel: 'email',
            status: 'skipped_quiet_hours',
            metadata: payload.metadata,
          });
          continue;
        }
        try {
          const result = await sendEmail({ to: user.email, subject: emailSubject, html: emailHtml });
          await createDeliveryRecord({
            workflowRunId: payload.workflowRunId ?? null,
            event: payload.event,
            triggerType,
            recipientKind: 'ess',
            recipientEssPortalUserId: user.id,
            channel: 'email',
            status: result.sent ? 'sent' : 'failed',
            provider: result.sent ? 'email' : null,
            error: result.sent ? null : result.error,
            metadata: payload.metadata,
          });
        } catch (err) {
          console.error(`[notifications] Failed to email ESS ${user.email} for ${payload.event}:`, err);
          await createDeliveryRecord({
            workflowRunId: payload.workflowRunId ?? null,
            event: payload.event,
            triggerType,
            recipientKind: 'ess',
            recipientEssPortalUserId: user.id,
            channel: 'email',
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
            metadata: payload.metadata,
          });
        }
      }
    }
  }
}

export async function createWorkflowRun(payload: WorkflowPrimitivePayload) {
  const run = await prisma.workflowRun.create({
    data: {
      module: payload.module,
      event: payload.event,
      entityType: payload.entityType,
      entityId: payload.entityId,
      entityCode: payload.entityCode ?? null,
      status: 'pending',
      currentAssigneeUserId: payload.assigneeUserId ?? null,
      currentAssigneeEssPortalUserId: payload.assigneeEssPortalUserId ?? null,
      dueAt: payload.dueAt ?? null,
      metadata: toPrismaJson(payload.metadata),
    },
  });
  await prisma.workflowEvent.create({
    data: {
      workflowRunId: run.id,
      triggerType: 'event',
      eventType: 'workflow_created',
      status: 'pending',
      dueAt: payload.dueAt ?? null,
      recipientKind: payload.assigneeUserId ? 'staff' : payload.assigneeEssPortalUserId ? 'ess' : null,
      recipientUserId: payload.assigneeUserId ?? null,
      recipientEssPortalUserId: payload.assigneeEssPortalUserId ?? null,
      metadata: toPrismaJson(payload.metadata),
    },
  });
  return run;
}

export async function transitionWorkflowRun(
  workflowRunId: string,
  status: WorkflowState,
  metadata?: Record<string, unknown>
) {
  const run = await prisma.workflowRun.update({
    where: { id: workflowRunId },
    data: {
      status,
      ...(status === 'approved' || status === 'rejected' || status === 'completed' || status === 'cancelled'
        ? { completedAt: new Date() }
        : {}),
      metadata: metadata != null ? toPrismaJson(metadata) : undefined,
    },
  });
  await prisma.workflowEvent.create({
    data: {
      workflowRunId,
      triggerType: 'event',
      eventType: `workflow_${status}`,
      status,
      dueAt: run.dueAt,
      metadata: toPrismaJson(metadata),
    },
  });
  return run;
}

export async function delegateWorkflowRun(input: DelegateWorkflowPayload) {
  const run = await prisma.workflowRun.update({
    where: { id: input.workflowRunId },
    data: {
      status: 'delegated',
      delegatedFromUserId: input.fromUserId,
      delegatedToUserId: input.toUserId,
      delegatedAt: new Date(),
      currentAssigneeUserId: input.toUserId,
    },
  });
  await prisma.workflowEvent.create({
    data: {
      workflowRunId: input.workflowRunId,
      triggerType: 'manual',
      eventType: 'workflow_delegated',
      recipientKind: 'staff',
      recipientUserId: input.toUserId,
      status: 'delegated',
      dueAt: run.dueAt,
      metadata: { reason: input.reason ?? null, fromUserId: input.fromUserId },
    },
  });
  await logAuditEvent({
    actor: { ...input.actor, name: input.actor.name ?? null },
    action: 'workflow.delegated',
    entityType: 'WorkflowRun',
    entityId: input.workflowRunId,
    route: 'module14/workflow',
    metadata: { fromUserId: input.fromUserId, toUserId: input.toUserId, reason: input.reason ?? null },
  });
  return run;
}

export async function runWorkflowEscalationSweep(now = new Date()) {
  const overdue = await prisma.workflowRun.findMany({
    where: {
      status: { in: ['pending', 'in_progress', 'delegated'] },
      dueAt: { not: null },
    },
    select: {
      id: true,
      module: true,
      status: true,
      dueAt: true,
      currentAssigneeUserId: true,
      entityType: true,
      entityId: true,
    },
  });
  const due = overdue.filter((run) =>
    shouldEscalateWorkflow({ dueAt: run.dueAt, status: run.status as WorkflowState, now })
  );
  if (!due.length) return { escalated: 0 };

  const escalations = await Promise.all(
    due.map(async (run) => {
      const escalationUserIds = await getHrUserIds();
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: { status: 'escalated', escalatedAt: now },
      });
      await prisma.workflowEvent.create({
        data: {
          workflowRunId: run.id,
          triggerType: 'time',
          eventType: 'workflow_escalated',
          recipientKind: 'staff',
          recipientUserId: run.currentAssigneeUserId ?? null,
          status: 'escalated',
          dueAt: run.dueAt,
          metadata: { escalatedAt: now.toISOString() },
        },
      });
      await sendNotification({
        event: 'profile_change_requested',
        recipientUserIds: escalationUserIds,
        title: `Escalation: ${run.module} workflow overdue`,
        body: `${run.entityType} ${run.entityId} exceeded SLA and requires intervention.`,
        href: '/dashboard/notifications',
        priority: 'urgent',
        channel: 'both',
        triggerType: 'time',
        workflowRunId: run.id,
        metadata: { workflowRunId: run.id, dueAt: run.dueAt?.toISOString() ?? null },
      });
      return run.id;
    })
  );
  return { escalated: escalations.length };
}
