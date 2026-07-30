import { NextRequest, NextResponse } from 'next/server';
import { APP_TIMEZONE, dateTimeNairobi } from '@/lib/timezone';
import { occurrenceStartsForEvent } from '@/lib/collaborative-calendar';
import { sharedPersonalEventsForViewer } from '@/lib/personal-calendar-share';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 93;

const companyEventSelect = {
  id: true,
  kind: true,
  allDay: true,
  title: true,
  notes: true,
  status: true,
  eventType: true,
  startsAt: true,
  endsAt: true,
  recurrence: true,
  recurrenceUntil: true,
  reminderMinutes: true,
  createdById: true,
} as const;

function parseNairobiDate(value: string | null): Date | null {
  if (!value || !DATE_PATTERN.test(value)) return null;
  const date = dateTimeNairobi(value, '00:00');
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

function dateKey(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const includeCompany =
      searchParams.get('includeCompany') === '1' || searchParams.get('includeCompany') === 'true';
    const start = parseNairobiDate(startParam);
    const endStart = parseNairobiDate(endParam);

    if (!start || !endStart || !startParam || !endParam) {
      return NextResponse.json(
        { error: 'start and end are required in YYYY-MM-DD format.' },
        { status: 400 },
      );
    }
    if (endStart < start) {
      return NextResponse.json({ error: 'end must be on or after start.' }, { status: 400 });
    }
    if (daysBetween(start, endStart) > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `The requested range cannot exceed ${MAX_RANGE_DAYS + 1} days.` },
        { status: 400 },
      );
    }

    const endExclusive = new Date(endStart.getTime() + 86_400_000);
    const organizationId = ctx.organizationId;
    const userId = ctx.staff.id;

    const [personal, leave, tasks, companyEvents, sharedEvents] = await Promise.all([
      ctx.run((tx) =>
        tx.personalCalendarEvent.findMany({
          where: {
            organizationId,
            userId,
            status: { not: 'cancelled' },
            startsAt: { lt: endExclusive },
            OR: [{ recurrenceUntil: null }, { recurrenceUntil: { gte: start } }],
          },
        }),
      ),
      ctx.run((tx) =>
        tx.staffLeaveApplication.findMany({
          where: {
            organizationId,
            userId,
            status: { in: ['pending', 'approved'] },
            startDate: { lt: endExclusive },
            endDate: { gte: start },
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
            leaveType: { select: { name: true, color: true } },
          },
        }),
      ),
      ctx.run((tx) =>
        tx.staffTask.findMany({
          where: {
            organizationId,
            assigneeId: userId,
            status: { in: ['todo', 'in_progress'] },
            dueAt: { gte: start, lt: endExclusive },
          },
          select: { id: true, title: true, dueAt: true, priority: true, status: true },
        }),
      ),
      includeCompany
        ? ctx.run((tx) =>
            tx.companyCalendarEvent.findMany({
              where: {
                organizationId,
                status: { not: 'cancelled' },
                startsAt: { lt: endExclusive },
                AND: [
                  {
                    OR: [{ recurrenceUntil: null }, { recurrenceUntil: { gte: start } }],
                  },
                  {
                    OR: [
                      { createdById: userId },
                      { participants: { some: { userId } } },
                      { kind: 'note' },
                      { eventType: 'public_holiday' },
                    ],
                  },
                ],
              },
              select: companyEventSelect,
            }),
          )
        : Promise.resolve([]),
      sharedPersonalEventsForViewer(userId, start, endExclusive, organizationId).catch(() => []),
    ]);

    const events: Array<Record<string, unknown>> = [];

    for (const event of personal) {
      const starts = occurrenceStartsForEvent(event, start, endExclusive);
      for (const occurrence of starts) {
        const day = dateKey(occurrence);
        if (event.allDay || event.kind === 'note') {
          events.push({
            id: `personal:${event.id}:${day}`,
            sourceId: event.id,
            kind: event.kind === 'note' ? 'note' : event.kind === 'reminder' ? 'reminder' : event.isFocusBlock ? 'focus' : 'personal',
            title: event.title,
            notes: event.notes,
            allDay: true,
            startDate: day,
            endDate: day,
            status: event.status,
            priority: event.priority,
            linkedTaskId: event.linkedTaskId,
            recurrence: event.recurrence,
          });
        } else {
          const durationMs = Math.max(0, event.endsAt.getTime() - event.startsAt.getTime());
          events.push({
            id: `personal:${event.id}:${occurrence.toISOString()}`,
            sourceId: event.id,
            kind: event.kind === 'reminder' ? 'reminder' : event.isFocusBlock ? 'focus' : 'personal',
            title: event.title,
            notes: event.notes,
            startsAt: occurrence.toISOString(),
            endsAt: new Date(occurrence.getTime() + durationMs).toISOString(),
            allDay: false,
            status: event.status,
            priority: event.priority,
            linkedTaskId: event.linkedTaskId,
            recurrence: event.recurrence,
          });
        }
      }
    }

    for (const row of leave) {
      events.push({
        id: `leave:${row.id}`,
        sourceId: row.id,
        kind: 'leave',
        title: row.leaveType.name,
        allDay: true,
        startDate: dateKey(row.startDate),
        endDate: dateKey(row.endDate),
        status: row.status,
        color: row.leaveType.color,
      });
    }

    for (const task of tasks) {
      if (!task.dueAt) continue;
      events.push({
        id: `task:${task.id}`,
        sourceId: task.id,
        kind: 'task',
        title: task.title,
        startsAt: task.dueAt.toISOString(),
        allDay: false,
        status: task.status,
        priority: task.priority,
      });
    }

    for (const event of companyEvents as Array<{
      id: string;
      kind: string;
      allDay: boolean;
      title: string;
      notes: string | null;
      status: string;
      eventType: string;
      startsAt: Date;
      endsAt: Date;
      recurrence: string;
      recurrenceUntil: Date | null;
      reminderMinutes: number | null;
      createdById: string;
    }>) {
      const starts = occurrenceStartsForEvent(event, start, endExclusive);
      for (const occurrence of starts) {
        const day = dateKey(occurrence);
        if (event.allDay || event.kind === 'note') {
          events.push({
            id: `company:${event.id}:${day}`,
            sourceId: event.id,
            kind: event.kind === 'note' ? 'company_note' : 'company',
            title: event.title,
            notes: event.notes,
            eventType: event.eventType,
            allDay: true,
            startDate: day,
            endDate: day,
            status: event.status,
            createdById: event.createdById,
          });
        } else {
          const durationMs = Math.max(0, event.endsAt.getTime() - event.startsAt.getTime());
          events.push({
            id: `company:${event.id}:${occurrence.toISOString()}`,
            sourceId: event.id,
            kind: 'company',
            title: event.title,
            notes: event.notes,
            eventType: event.eventType,
            startsAt: occurrence.toISOString(),
            endsAt: new Date(occurrence.getTime() + durationMs).toISOString(),
            allDay: false,
            status: event.status,
            createdById: event.createdById,
          });
        }
      }
    }

    events.push(...sharedEvents);

    return NextResponse.json({ events, start: startParam, end: endParam });
  });
}
