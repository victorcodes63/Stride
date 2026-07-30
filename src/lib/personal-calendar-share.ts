import { prisma } from '@/lib/prisma';
import { APP_TIMEZONE, dateTimeNairobi } from '@/lib/timezone';
import { occurrenceStartsForEvent } from '@/lib/collaborative-calendar';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const SHARE_WINDOW_PRESETS = [
  'today',
  'next_3_days',
  'week',
  'fortnight',
  'month',
  'custom',
] as const;

export type ShareWindowPreset = (typeof SHARE_WINDOW_PRESETS)[number];
export type ShareDetailLevel = 'titles' | 'busy';

export function nairobiDateKey(value: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

export function parseNairobiDateKey(value: string): Date | null {
  if (!DATE_PATTERN.test(value)) return null;
  const date = dateTimeNairobi(value, '00:00');
  return Number.isNaN(date.getTime()) ? null : date;
}

export function nairobiDayEnd(dateKey: string): Date {
  return dateTimeNairobi(dateKey, '23:59');
}

function addNairobiDays(dateKey: string, amount: number) {
  const base = parseNairobiDateKey(dateKey);
  if (!base) return null;
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + amount);
  return nairobiDateKey(next);
}

export function resolveShareWindow(
  preset: ShareWindowPreset,
  customStart?: string | null,
  customEnd?: string | null,
): { windowStart: Date; windowEnd: Date; windowStartKey: string; windowEndKey: string } | { error: string } {
  const todayKey = nairobiDateKey();
  let startKey = todayKey;
  let endKey = todayKey;

  if (preset === 'today') {
    endKey = todayKey;
  } else if (preset === 'next_3_days') {
    endKey = addNairobiDays(todayKey, 2) ?? todayKey;
  } else if (preset === 'week') {
    endKey = addNairobiDays(todayKey, 6) ?? todayKey;
  } else if (preset === 'fortnight') {
    endKey = addNairobiDays(todayKey, 13) ?? todayKey;
  } else if (preset === 'month') {
    endKey = addNairobiDays(todayKey, 29) ?? todayKey;
  } else {
    if (!customStart || !customEnd) {
      return { error: 'Choose a start and end date for the shared window.' };
    }
    startKey = customStart;
    endKey = customEnd;
  }

  const windowStart = parseNairobiDateKey(startKey);
  const windowEnd = parseNairobiDateKey(endKey);
  if (!windowStart || !windowEnd) return { error: 'Enter valid share dates (YYYY-MM-DD).' };
  if (windowEnd < windowStart) return { error: 'Share end date must be on or after the start date.' };
  const spanDays = Math.floor((windowEnd.getTime() - windowStart.getTime()) / 86_400_000);
  if (spanDays > 92) return { error: 'Shared windows can be at most 93 days.' };

  return { windowStart, windowEnd, windowStartKey: startKey, windowEndKey: endKey };
}

export function defaultAccessExpiresAt(windowEndKey: string) {
  // End of the last shared Nairobi day (+ a minute buffer via 23:59)
  return nairobiDayEnd(windowEndKey);
}

export async function listActiveSharesForViewer(
  viewerId: string,
  organizationId?: string,
  now = new Date(),
) {
  return prisma.personalCalendarShare.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      viewerId,
      status: 'active',
      accessExpiresAt: { gt: now },
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
    orderBy: { windowStart: 'asc' },
  });
}

export async function listSharesOwnedBy(ownerId: string, organizationId?: string) {
  return prisma.personalCalendarShare.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      ownerId,
      status: 'active',
      accessExpiresAt: { gt: new Date() },
    },
    include: {
      viewer: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

type FeedEvent = {
  id: string;
  sourceId?: string;
  kind: string;
  title: string;
  status: string;
  startsAt?: string;
  startDate?: string;
  endDate?: string;
  allDay?: boolean;
  durationMinutes?: number;
  [key: string]: unknown;
};

/** Load personal calendar items visible through active shares overlapping [start, endExclusive). */
export async function sharedPersonalEventsForViewer(
  viewerId: string,
  rangeStart: Date,
  rangeEndExclusive: Date,
  organizationId?: string,
): Promise<FeedEvent[]> {
  const shares = await listActiveSharesForViewer(viewerId, organizationId);
  if (!shares.length) return [];

  const windows = shares
    .map((share) => {
      const windowEndExclusive = new Date(share.windowEnd.getTime() + 86_400_000);
      const start = rangeStart > share.windowStart ? rangeStart : share.windowStart;
      const endExclusive =
        rangeEndExclusive < windowEndExclusive ? rangeEndExclusive : windowEndExclusive;
      if (endExclusive <= start) return null;
      return { share, start, endExclusive };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (!windows.length) return [];

  // Parallel per-share loads (avoids N+1 sequential awaits on the home calendar feed).
  const batches = await Promise.all(
    windows.map(async ({ share, start, endExclusive }) => {
      const [personal, leave] = await Promise.all([
        // Sticky notes stay private — never included in shared overlays.
        prisma.personalCalendarEvent.findMany({
          where: {
            ...(organizationId ? { organizationId } : {}),
            userId: share.ownerId,
            status: { not: 'cancelled' },
            kind: { not: 'note' },
            startsAt: { lte: endExclusive },
            OR: [{ recurrenceUntil: null }, { recurrenceUntil: { gte: start } }],
          },
          select: {
            id: true,
            kind: true,
            title: true,
            startsAt: true,
            endsAt: true,
            allDay: true,
            isFocusBlock: true,
            recurrence: true,
            recurrenceUntil: true,
            status: true,
          },
        }),
        prisma.staffLeaveApplication.findMany({
          where: {
            ...(organizationId ? { organizationId } : {}),
            userId: share.ownerId,
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
      ]);
      return { share, start, endExclusive, personal, leave };
    }),
  );

  const events: FeedEvent[] = [];

  for (const { share, start, endExclusive, personal, leave } of batches) {
    const ownerLabel = share.owner.name.split(' ')[0] || share.owner.name;
    const busyLabel = (kind: string, isFocus: boolean) => {
      if (share.detailLevel !== 'busy') return null;
      if (kind === 'reminder') return `${ownerLabel}: Reminder`;
      return isFocus ? `${ownerLabel}: Focus` : `${ownerLabel}: Busy`;
    };

    for (const event of personal) {
      const feedKind =
        event.kind === 'reminder' ? 'reminder' : event.isFocusBlock ? 'focus' : 'personal';
      const title =
        busyLabel(event.kind, event.isFocusBlock) ?? `${ownerLabel}: ${event.title}`;

      if (event.allDay) {
        const day = nairobiDateKey(event.startsAt);
        events.push({
          id: `shared:${share.id}:${event.id}:${day}`,
          sourceId: event.id,
          kind: 'shared',
          sharedKind: feedKind,
          allDay: true,
          startDate: day,
          endDate: day,
          title,
          status: event.status,
          eventScope: 'shared',
          canManage: false,
          ownerId: share.ownerId,
          ownerName: share.owner.name,
          shareId: share.id,
          detailLevel: share.detailLevel,
        });
        continue;
      }

      for (const startsAt of occurrenceStartsForEvent(event, start, endExclusive)) {
        const endsAt = new Date(
          startsAt.getTime() + Math.max(0, event.endsAt.getTime() - event.startsAt.getTime()),
        );
        if (endsAt <= start || startsAt >= endExclusive) continue;
        events.push({
          id: `shared:${share.id}:${event.id}:${startsAt.toISOString()}`,
          sourceId: event.id,
          kind: 'shared',
          sharedKind: feedKind,
          startsAt: startsAt.toISOString(),
          durationMinutes: Math.max(
            0,
            Math.round((event.endsAt.getTime() - event.startsAt.getTime()) / 60_000),
          ),
          title,
          status: event.status,
          eventScope: 'shared',
          canManage: false,
          ownerId: share.ownerId,
          ownerName: share.owner.name,
          shareId: share.id,
          detailLevel: share.detailLevel,
        });
      }
    }

    for (const application of leave) {
      events.push({
        id: `shared-leave:${share.id}:${application.id}`,
        sourceId: application.id,
        kind: 'shared',
        sharedKind: 'leave',
        allDay: true,
        startDate: nairobiDateKey(application.startDate),
        endDate: nairobiDateKey(application.endDate),
        title:
          share.detailLevel === 'busy'
            ? `${ownerLabel}: Away`
            : `${ownerLabel}: ${application.leaveType.name}`,
        status: application.status,
        color: application.leaveType.color,
        eventScope: 'shared',
        canManage: false,
        ownerId: share.ownerId,
        ownerName: share.owner.name,
        shareId: share.id,
        detailLevel: share.detailLevel,
      });
    }
  }

  return events;
}
