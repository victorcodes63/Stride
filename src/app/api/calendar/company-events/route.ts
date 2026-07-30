import { NextRequest, NextResponse } from 'next/server';
import { APP_TIMEZONE, dateTimeNairobi } from '@/lib/timezone';
import { occurrenceStartsForEvent } from '@/lib/collaborative-calendar';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseNairobiDate(value: string | null): Date | null {
  if (!value || !DATE_PATTERN.test(value)) return null;
  const date = dateTimeNairobi(value, '00:00');
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

/** Company-scope feed (shared events + notes). Birthdays/interviews omitted in v1. */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const { searchParams } = new URL(request.url);
    const start = parseNairobiDate(searchParams.get('start'));
    const endStart = parseNairobiDate(searchParams.get('end'));
    if (!start || !endStart) {
      return NextResponse.json({ error: 'start and end are required (YYYY-MM-DD).' }, { status: 400 });
    }
    const endExclusive = new Date(endStart.getTime() + 86_400_000);
    const rows = await ctx.run((tx) =>
      tx.companyCalendarEvent.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: { not: 'cancelled' },
          startsAt: { lt: endExclusive },
          OR: [{ recurrenceUntil: null }, { recurrenceUntil: { gte: start } }],
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          participants: { select: { userId: true, status: true } },
        },
      }),
    );

    const events: Array<Record<string, unknown>> = [];
    for (const event of rows) {
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
            createdByName: event.createdBy.name,
            participants: event.participants,
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
            createdByName: event.createdBy.name,
            participants: event.participants,
          });
        }
      }
    }

    return NextResponse.json({ events });
  });
}
