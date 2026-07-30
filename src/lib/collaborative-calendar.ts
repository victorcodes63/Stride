import type { StaffTaskPriority } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { StaffUser } from '@/lib/staff-api-auth';
import { parseStaffTaskPriority } from '@/lib/staff-task-api';

export const COMPANY_EVENT_TYPES = ['bid_submission', 'training', 'meeting', 'public_holiday', 'other', 'note'] as const;
export const RECURRENCES = ['none', 'daily', 'weekly', 'monthly'] as const;
export const PERSONAL_KINDS = ['event', 'note', 'reminder'] as const;
export const COMPANY_KINDS = ['event', 'note'] as const;

export type CalendarItemKind = 'event' | 'note' | 'reminder';

export type CalendarDraft = {
  scope: 'personal' | 'company';
  kind: CalendarItemKind;
  title: string;
  eventType?: string;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  notes?: string;
  isFocusBlock?: boolean;
  recurrence?: string;
  recurrenceUntil?: string | null;
  reminderMinutes?: number | null;
  participantIds?: string[];
  linkToTask?: boolean;
  /** Personal reminders/events — same scale as StaffTask. */
  priority?: StaffTaskPriority;
};

function nairobiDayBounds(isoOrDate: string): { startsAt: string; endsAt: string } {
  const d = new Date(isoOrDate);
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  // Store as UTC instants representing Nairobi midnight → next midnight via offset-safe local construction
  const start = new Date(`${key}T00:00:00+03:00`);
  const end = new Date(`${key}T23:59:59.999+03:00`);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

export function parseCalendarDraft(input: unknown): { draft?: CalendarDraft; error?: string } {
  if (!input || typeof input !== 'object') return { error: 'A calendar event is required.' };
  const value = input as Record<string, unknown>;
  const scope = value.scope === 'company' ? 'company' : value.scope === 'personal' ? 'personal' : null;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  let startsAt = typeof value.startsAt === 'string' ? value.startsAt : '';
  let endsAt = typeof value.endsAt === 'string' ? value.endsAt : '';
  const recurrence = typeof value.recurrence === 'string' ? value.recurrence : 'none';
  const reminderMinutes =
    value.reminderMinutes == null || value.reminderMinutes === '' ? null : Number(value.reminderMinutes);

  const rawKind = typeof value.kind === 'string' ? value.kind : 'event';
  if (!scope || !title || title.length > 160) {
    return { error: 'Choose a scope and enter a title of up to 160 characters.' };
  }

  let kind: CalendarItemKind = 'event';
  if (scope === 'personal') {
    if (!PERSONAL_KINDS.includes(rawKind as (typeof PERSONAL_KINDS)[number])) {
      return { error: 'Choose a valid personal item kind (event, note, or reminder).' };
    }
    kind = rawKind as CalendarItemKind;
  } else {
    if (!COMPANY_KINDS.includes(rawKind as (typeof COMPANY_KINDS)[number])) {
      return { error: 'Company calendar supports events and shared notes only.' };
    }
    kind = rawKind as 'event' | 'note';
  }

  let allDay = Boolean(value.allDay);
  let isFocusBlock = Boolean(value.isFocusBlock);
  let eventType = typeof value.eventType === 'string' ? value.eventType : undefined;

  if (kind === 'note') {
    allDay = true;
    isFocusBlock = false;
    const bounds = nairobiDayBounds(startsAt || new Date().toISOString());
    startsAt = bounds.startsAt;
    endsAt = bounds.endsAt;
    if (scope === 'company') eventType = 'note';
    if (reminderMinutes != null) {
      /* notes do not push */
    }
  }

  if (kind === 'reminder') {
    allDay = false;
    isFocusBlock = false;
    if (!Number.isFinite(new Date(startsAt).getTime())) {
      return { error: 'Choose a valid reminder time.' };
    }
    // Zero-duration reminder at due time
    endsAt = startsAt;
  }

  if (scope === 'company' && kind === 'event') {
    if (!eventType || !COMPANY_EVENT_TYPES.includes(eventType as (typeof COMPANY_EVENT_TYPES)[number]) || eventType === 'note') {
      return { error: 'Choose a valid shared event type.' };
    }
  }

  if (!RECURRENCES.includes(recurrence as (typeof RECURRENCES)[number])) {
    return { error: 'Choose a valid recurrence.' };
  }

  const startMs = new Date(startsAt).getTime();
  const endMs = new Date(endsAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return { error: 'Enter valid start and end times.' };
  }
  if (kind === 'event' && endMs <= startMs) {
    return { error: 'The event end time must be after its start time.' };
  }
  if (kind !== 'event' && endMs < startMs) {
    return { error: 'End time cannot be before start time.' };
  }

  const effectiveReminder =
    kind === 'reminder' ? (reminderMinutes == null ? 0 : reminderMinutes) : kind === 'note' ? null : reminderMinutes;
  if (
    effectiveReminder !== null &&
    (!Number.isInteger(effectiveReminder) || effectiveReminder < 0 || effectiveReminder > 43_200)
  ) {
    return { error: 'Reminder time must be between 0 and 43,200 minutes.' };
  }

  const recurrenceUntil =
    typeof value.recurrenceUntil === 'string' && value.recurrenceUntil ? value.recurrenceUntil : null;
  if (recurrenceUntil && new Date(recurrenceUntil) < new Date(startsAt)) {
    return { error: 'Recurrence end must be after the first occurrence.' };
  }

  const participantIds = Array.isArray(value.participantIds)
    ? [
        ...new Set(
          value.participantIds.filter(
            (id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64,
          ),
        ),
      ]
    : [];

  const priority =
    scope === 'personal' ? (parseStaffTaskPriority(value.priority) ?? 'none') : undefined;

  return {
    draft: {
      scope,
      kind,
      title,
      eventType,
      startsAt,
      endsAt,
      allDay,
      notes: typeof value.notes === 'string' ? value.notes.trim().slice(0, 4_000) : undefined,
      isFocusBlock,
      recurrence,
      recurrenceUntil,
      reminderMinutes: effectiveReminder,
      participantIds,
      linkToTask: value.linkToTask === true,
      priority,
    },
  };
}

export function occurrenceStarts(
  startsAt: Date,
  recurrence: string,
  until: Date | null,
  rangeStart: Date,
  rangeEnd: Date,
): Date[] {
  const result: Date[] = [];
  for (let current = new Date(startsAt); current <= rangeEnd && (!until || current <= until); ) {
    if (current >= rangeStart) result.push(new Date(current));
    if (recurrence === 'daily') current.setUTCDate(current.getUTCDate() + 1);
    else if (recurrence === 'weekly') current.setUTCDate(current.getUTCDate() + 7);
    else if (recurrence === 'monthly') current.setUTCMonth(current.getUTCMonth() + 1);
    else break;
  }
  return result;
}

/** Convenience for event-shaped rows (Eagle-compatible call sites). */
export function occurrenceStartsForEvent(
  event: {
    startsAt: Date;
    recurrence: string;
    recurrenceUntil?: Date | null;
  },
  rangeStart: Date,
  rangeEnd: Date,
): Date[] {
  return occurrenceStarts(
    event.startsAt,
    event.recurrence ?? 'none',
    event.recurrenceUntil ?? null,
    rangeStart,
    rangeEnd,
  );
}

/** Interviews rarely exceed this; used to bound conflict scans (avoid loading all history). */
const MAX_INTERVIEW_DURATION_MS = 12 * 60 * 60 * 1000;

function interviewScheduleWindow(startsAt: Date, endsAt: Date) {
  return {
    gte: new Date(startsAt.getTime() - MAX_INTERVIEW_DURATION_MS),
    lt: endsAt,
  };
}

export async function findCalendarConflicts(
  user: StaffUser,
  organizationId: string,
  startsAt: Date,
  endsAt: Date,
  exclude?: { personalId?: string; companyId?: string },
) {
  if (endsAt.getTime() <= startsAt.getTime()) return [];

  const interviewWindow = interviewScheduleWindow(startsAt, endsAt);

  const [personal, shared, leave, interviews] = await Promise.all([
    prisma.personalCalendarEvent.findMany({
      where: {
        organizationId,
        userId: user.id,
        status: 'scheduled',
        kind: 'event',
        id: exclude?.personalId ? { not: exclude.personalId } : undefined,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true, title: true, startsAt: true, endsAt: true },
    }),
    prisma.companyCalendarEvent.findMany({
      where: {
        organizationId,
        status: 'scheduled',
        kind: 'event',
        id: exclude?.companyId ? { not: exclude.companyId } : undefined,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true, title: true, startsAt: true, endsAt: true },
    }),
    prisma.staffLeaveApplication.findMany({
      where: {
        organizationId,
        userId: user.id,
        status: { in: ['pending', 'approved'] },
        startDate: { lte: endsAt },
        endDate: { gte: startsAt },
      },
      select: { id: true, startDate: true, endDate: true, leaveType: { select: { name: true } } },
    }),
    prisma.interview
      .findMany({
        where: {
          organizationId,
          status: 'scheduled',
          scheduledAt: interviewWindow,
        },
        select: {
          id: true,
          scheduledAt: true,
          durationMinutes: true,
          application: { select: { job: { select: { title: true } } } },
        },
        take: 100,
      })
      .catch(() => [] as Array<{
        id: string;
        scheduledAt: Date;
        durationMinutes: number;
        application: { job: { title: string } };
      }>),
  ]);
  return [
    ...personal.map((item) => ({
      source: 'personal',
      title: item.title,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
    })),
    ...shared.map((item) => ({
      source: 'company',
      title: item.title,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
    })),
    ...leave.map((item) => ({
      source: 'leave',
      title: item.leaveType.name,
      startsAt: item.startDate,
      endsAt: item.endDate,
    })),
    ...interviews
      .filter((item) => new Date(item.scheduledAt.getTime() + item.durationMinutes * 60_000) > startsAt)
      .map((item) => ({
        source: 'interview',
        title: item.application.job.title,
        startsAt: item.scheduledAt,
        endsAt: new Date(item.scheduledAt.getTime() + item.durationMinutes * 60_000),
      })),
  ];
}

export function canManageCompanyCalendar(user: StaffUser, createdById: string) {
  return user.id === createdById || user.role === 'admin' || user.staffUserType === 'operations';
}

export async function activeParticipantIds(ids: string[]) {
  if (!ids.length) return [];
  const users = await prisma.user.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true } });
  return users.map((user) => user.id);
}

export async function findParticipantConflictWarnings(
  actor: StaffUser,
  organizationId: string,
  participantIds: string[],
  startsAt: Date,
  endsAt: Date,
) {
  if (!participantIds.length) return [];
  const warnings: Array<{ userId: string; source: 'leave' | 'interview'; title: string }> = [];
  const leaves = await prisma.staffLeaveApplication.findMany({
    where: {
      organizationId,
      userId: { in: participantIds },
      status: { in: ['pending', 'approved'] },
      startDate: { lte: endsAt },
      endDate: { gte: startsAt },
    },
    select: { userId: true },
  });
  warnings.push(
    ...leaves.map((leave) => ({
      userId: leave.userId,
      source: 'leave' as const,
      title: 'Leave request overlaps this event',
    })),
  );
  void actor;
  return warnings;
}

export async function notifyCompanyEventParticipants(
  organizationId: string,
  event: { id: string; title: string; startsAt: Date; endsAt: Date; createdBy: { name: string } },
  recipients: Array<{ id: string; name: string; email: string }>,
  kind: 'invitation' | 'updated' | 'cancelled',
) {
  if (!recipients.length) return;
  const when = event.startsAt.toLocaleString('en-KE', {
    timeZone: 'Africa/Nairobi',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const title =
    kind === 'cancelled'
      ? 'Company event cancelled'
      : kind === 'updated'
        ? 'Company event updated'
        : 'Company calendar invitation';
  const body =
    kind === 'cancelled'
      ? `${event.title} has been cancelled.`
      : kind === 'updated'
        ? `${event.title} has been updated and is scheduled for ${when}.`
        : `${event.createdBy.name} invited you to ${event.title} on ${when}.`;
  const href = `/dashboard/calendar?scope=company&event=${encodeURIComponent(event.id)}`;
  await prisma.staffNotification.createMany({
    data: recipients.map((recipient) => ({
      organizationId,
      userId: recipient.id,
      title,
      body,
      href,
      event: `calendar.company.${kind}`,
      priority: 'info',
    })),
  });
}
