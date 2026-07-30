import { prisma } from '@/lib/prisma';
import { occurrenceStartsForEvent } from '@/lib/collaborative-calendar';

/**
 * Fire due calendar reminders into StaffNotification (inbox only).
 * Call from a cron/job when available; safe to invoke on-demand.
 */
export async function processDueCalendarReminders(organizationId?: string) {
  const now = new Date();
  const horizon = new Date(now.getTime() + 60 * 60_000);

  const personalWhere = {
    status: 'scheduled' as const,
    reminderMinutes: { not: null },
    ...(organizationId ? { organizationId } : {}),
  };
  const companyWhere = {
    status: 'scheduled' as const,
    reminderMinutes: { not: null },
    kind: 'event' as const,
    ...(organizationId ? { organizationId } : {}),
  };

  const [personal, company] = await Promise.all([
    prisma.personalCalendarEvent.findMany({
      where: personalWhere,
      take: 200,
    }),
    prisma.companyCalendarEvent.findMany({
      where: companyWhere,
      include: {
        participants: { where: { status: { not: 'declined' } }, select: { userId: true } },
        createdBy: { select: { id: true, name: true } },
      },
      take: 200,
    }),
  ]);

  let sent = 0;

  for (const event of personal) {
    if (event.reminderMinutes == null) continue;
    const orgId = event.organizationId;
    const windowStart = new Date(now.getTime() - 24 * 60 * 60_000);
    const windowEnd = new Date(horizon.getTime() + 24 * 60 * 60_000);
    for (const occurrence of occurrenceStartsForEvent(event, windowStart, windowEnd)) {
      const fireAt = new Date(occurrence.getTime() - event.reminderMinutes * 60_000);
      if (fireAt > now || fireAt < new Date(now.getTime() - 30 * 60_000)) continue;
      const existing = await prisma.calendarReminderDelivery.findFirst({
        where: {
          organizationId: orgId,
          eventScope: 'personal',
          eventId: event.id,
          occurrenceStartsAt: occurrence,
          channel: 'inbox',
        },
      });
      if (existing) continue;
      const when = occurrence.toLocaleString('en-KE', {
        timeZone: 'Africa/Nairobi',
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      await prisma.staffNotification.create({
        data: {
          organizationId: orgId,
          userId: event.userId,
          title: event.kind === 'reminder' ? 'Reminder' : 'Upcoming event',
          body: `${event.title} — ${when}`,
          href: `/dashboard/calendar?scope=personal&event=${encodeURIComponent(event.id)}`,
          event: 'calendar.reminder',
          priority: 'info',
        },
      });
      await prisma.calendarReminderDelivery.create({
        data: {
          organizationId: orgId,
          eventScope: 'personal',
          eventId: event.id,
          occurrenceStartsAt: occurrence,
          channel: 'inbox',
        },
      });
      sent += 1;
    }
  }

  for (const event of company) {
    if (event.reminderMinutes == null) continue;
    const orgId = event.organizationId;
    const windowStart = new Date(now.getTime() - 24 * 60 * 60_000);
    const windowEnd = new Date(horizon.getTime() + 24 * 60 * 60_000);
    const recipientIds = [
      ...new Set([event.createdById, ...event.participants.map((p) => p.userId)]),
    ];
    for (const occurrence of occurrenceStartsForEvent(event, windowStart, windowEnd)) {
      const fireAt = new Date(occurrence.getTime() - event.reminderMinutes * 60_000);
      if (fireAt > now || fireAt < new Date(now.getTime() - 30 * 60_000)) continue;
      const existing = await prisma.calendarReminderDelivery.findFirst({
        where: {
          organizationId: orgId,
          eventScope: 'company',
          eventId: event.id,
          occurrenceStartsAt: occurrence,
          channel: 'inbox',
        },
      });
      if (existing) continue;
      const when = occurrence.toLocaleString('en-KE', {
        timeZone: 'Africa/Nairobi',
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      await prisma.staffNotification.createMany({
        data: recipientIds.map((userId) => ({
          organizationId: orgId,
          userId,
          title: 'Upcoming company event',
          body: `${event.title} — ${when}`,
          href: `/dashboard/calendar?scope=company&event=${encodeURIComponent(event.id)}`,
          event: 'calendar.reminder',
          priority: 'info',
        })),
      });
      await prisma.calendarReminderDelivery.create({
        data: {
          organizationId: orgId,
          eventScope: 'company',
          eventId: event.id,
          occurrenceStartsAt: occurrence,
          channel: 'inbox',
        },
      });
      sent += 1;
    }
  }

  return { sent };
}
