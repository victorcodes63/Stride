/**
 * Pre-boarding automation sweep.
 *
 * Runs shortly before employees' start dates to:
 *  1. Auto-start the default ONBOARDING workflow (deduped via startWorkflowForEmployee).
 *  2. Send a warm welcome across in-app + email + WhatsApp when a workflow is newly created.
 *  3. Send "starting soon" reminders to employees whose start date is imminent and who still
 *     have open onboarding tasks — guarded against duplicates via the NotificationDelivery table.
 *
 * Mirrors the direct-`prisma` approach used by the onboarding-overdue cron. Per-employee work
 * is wrapped in try/catch so one bad record never aborts the whole sweep.
 */

import { WorkflowType, WorkflowStatus, OnboardingTaskStatus, EmployeeEmploymentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { startWorkflowForEmployee } from '@/lib/onboarding-workflows';
import { getEssPortalUserIdForEmployee, sendNotification } from '@/lib/notifications';

const DAY_MS = 86_400_000;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** How many days ahead of the start date onboarding should auto-start. */
export const PREBOARDING_LEAD_DAYS = envInt('ONBOARDING_PREBOARDING_LEAD_DAYS', 7);
/** How many days before the start date to send "starting soon" reminders. */
export const PREBOARDING_REMINDER_DAYS = envInt('ONBOARDING_PREBOARDING_REMINDER_DAYS', 2);
/** Duplicate-guard window for reminders (hours). */
const REMINDER_DEDUPE_HOURS = envInt('ONBOARDING_PREBOARDING_REMINDER_DEDUPE_HOURS', 20);

const ACTIVE_TASK_STATUSES: OnboardingTaskStatus[] = [
  OnboardingTaskStatus.PENDING,
  OnboardingTaskStatus.IN_PROGRESS,
  OnboardingTaskStatus.OVERDUE,
];

const ELIGIBLE_EMPLOYMENT_STATUSES: EmployeeEmploymentStatus[] = [
  EmployeeEmploymentStatus.active,
  EmployeeEmploymentStatus.probation,
];

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function runPreboardingSweep(
  now = new Date(),
): Promise<{ started: number; welcomed: number; reminded: number }> {
  const leadWindowEnd = new Date(now.getTime() + PREBOARDING_LEAD_DAYS * DAY_MS);
  // Allow start dates up to 1 day in the past to catch employees who started just before a sweep ran.
  const windowStart = new Date(now.getTime() - 1 * DAY_MS);

  let started = 0;
  let welcomed = 0;
  let reminded = 0;

  const candidates = await prisma.employee.findMany({
    where: {
      dateOfJoining: { gte: windowStart, lte: leadWindowEnd },
      employmentStatus: { in: ELIGIBLE_EMPLOYMENT_STATUSES },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      organizationId: true,
      dateOfJoining: true,
      client: { select: { name: true } },
    },
  });

  const reminderWindowEnd = new Date(now.getTime() + PREBOARDING_REMINDER_DAYS * DAY_MS);
  const dedupeSince = new Date(now.getTime() - REMINDER_DEDUPE_HOURS * 60 * 60 * 1000);

  for (const employee of candidates) {
    try {
      const employeeName = `${employee.firstName} ${employee.lastName}`.trim();
      const startDateLabel = employee.dateOfJoining ? formatDate(employee.dateOfJoining) : null;
      const companyName = employee.client?.name ?? null;

      // 1) Ensure onboarding is started (dedupes internally on an IN_PROGRESS workflow).
      const result = await startWorkflowForEmployee({
        employeeId: employee.id,
        type: WorkflowType.ONBOARDING,
      });

      if (result?.created) {
        started += 1;
        const essUserId = await getEssPortalUserIdForEmployee(employee.id);
        if (essUserId) {
          await sendNotification({
            event: 'onboarding_preboarding_welcome',
            recipientEssPortalUserIds: [essUserId],
            title: `Welcome to ${companyName ?? 'the team'}`,
            body: startDateLabel
              ? `We're excited for your first day on ${startDateLabel}. Open your onboarding hub to get a head start before you arrive.`
              : `We're excited to have you join us. Open your onboarding hub to get a head start before day one.`,
            href: '/ess/onboarding',
            priority: 'action_required',
            channel: 'both',
            whatsapp: true,
            triggerType: 'time',
            metadata: {
              employeeId: employee.id,
              employeeName,
              startDate: startDateLabel,
              companyName,
            },
          });
          welcomed += 1;
        }
        // A newly-created workflow won't also need a same-run reminder.
        continue;
      }

      // 2) Reminder path: only for employees starting very soon with open onboarding tasks.
      const startsSoon =
        employee.dateOfJoining != null &&
        employee.dateOfJoining.getTime() <= reminderWindowEnd.getTime() &&
        employee.dateOfJoining.getTime() >= windowStart.getTime();
      if (!startsSoon) continue;

      const workflow = await prisma.onboardingWorkflow.findFirst({
        where: {
          employeeId: employee.id,
          type: WorkflowType.ONBOARDING,
          status: WorkflowStatus.IN_PROGRESS,
        },
        select: {
          id: true,
          tasks: { select: { id: true, status: true } },
        },
      });
      if (!workflow) continue;

      const openTaskCount = workflow.tasks.filter((task) =>
        ACTIVE_TASK_STATUSES.includes(task.status),
      ).length;
      if (openTaskCount === 0) continue;

      const essUserId = await getEssPortalUserIdForEmployee(employee.id);
      if (!essUserId) continue;

      // Duplicate guard: skip if we already reminded this recipient within the dedupe window.
      const recentReminder = await prisma.notificationDelivery.findFirst({
        where: {
          event: 'onboarding_starting_soon',
          recipientEssPortalUserId: essUserId,
          createdAt: { gte: dedupeSince },
        },
        select: { id: true },
      });
      if (recentReminder) continue;

      await sendNotification({
        event: 'onboarding_starting_soon',
        recipientEssPortalUserIds: [essUserId],
        title: 'Your start date is coming up',
        body: startDateLabel
          ? `You start on ${startDateLabel}. You still have ${openTaskCount} open onboarding task${openTaskCount === 1 ? '' : 's'} to complete.`
          : `Your start date is approaching. You still have ${openTaskCount} open onboarding task${openTaskCount === 1 ? '' : 's'} to complete.`,
        href: '/ess/onboarding',
        priority: 'action_required',
        channel: 'both',
        whatsapp: true,
        triggerType: 'time',
        metadata: {
          employeeId: employee.id,
          employeeName,
          startDate: startDateLabel,
          openTaskCount,
        },
      });
      reminded += 1;
    } catch (error) {
      console.error(
        `[onboarding-preboarding] Failed processing employee ${employee.id}:`,
        error,
      );
    }
  }

  return { started, welcomed, reminded };
}
