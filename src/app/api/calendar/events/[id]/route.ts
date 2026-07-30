import { NextRequest, NextResponse } from 'next/server';
import {
  activeParticipantIds,
  canManageCompanyCalendar,
  findCalendarConflicts,
  findParticipantConflictWarnings,
  notifyCompanyEventParticipants,
  parseCalendarDraft,
} from '@/lib/collaborative-calendar';
import { withTenant, type TenantContext } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

async function eventForUser(ctx: TenantContext, id: string) {
  const [personal, company] = await Promise.all([
    ctx.run((tx) =>
      tx.personalCalendarEvent.findFirst({
        where: { id, organizationId: ctx.organizationId, userId: ctx.staff.id },
      }),
    ),
    ctx.run((tx) =>
      tx.companyCalendarEvent.findFirst({
        where: { id, organizationId: ctx.organizationId },
      }),
    ),
  ]);
  if (personal) return { scope: 'personal' as const, event: personal };
  if (company && canManageCompanyCalendar(ctx.staff, company.createdById)) {
    return { scope: 'company' as const, event: company };
  }
  return null;
}

export async function PATCH(request: NextRequest, context: Context) {
  return withTenant(request, async (ctx) => {
    const existing = await eventForUser(ctx, (await context.params).id);
    if (!existing) {
      return NextResponse.json({ error: 'Event not found or not editable.' }, { status: 404 });
    }
    const body = await request.json().catch(() => null);
    const parsed = parseCalendarDraft(body);
    if (!parsed.draft || parsed.draft.scope !== existing.scope) {
      return NextResponse.json(
        { error: parsed.error ?? 'The event scope cannot be changed.' },
        { status: 400 },
      );
    }
    const draft = parsed.draft;
    const startsAt = new Date(draft.startsAt);
    const endsAt = new Date(draft.endsAt);
    const organizationId = ctx.organizationId;

    if (existing.scope === 'personal') {
      const priority = draft.priority ?? 'none';
      const event = await ctx.run(async (tx) => {
        let linkedTaskId = existing.event.linkedTaskId;
        if (draft.kind === 'reminder' && draft.linkToTask && !linkedTaskId) {
          const task = await tx.staffTask.create({
            data: {
              organizationId,
              title: draft.title,
              description: draft.notes ?? null,
              assigneeId: ctx.staff.id,
              createdById: ctx.staff.id,
              dueAt: startsAt,
              status: 'todo',
              priority,
            },
          });
          linkedTaskId = task.id;
        } else if (linkedTaskId && draft.kind === 'reminder') {
          await tx.staffTask.update({
            where: { id: linkedTaskId },
            data: { priority, title: draft.title, dueAt: startsAt },
          });
        }

        return tx.personalCalendarEvent.update({
          where: { id: existing.event.id },
          data: {
            kind: draft.kind,
            title: draft.title,
            startsAt,
            endsAt,
            allDay: Boolean(draft.allDay),
            notes: draft.notes,
            isFocusBlock: draft.kind === 'event' ? Boolean(draft.isFocusBlock) : false,
            recurrence: draft.recurrence ?? 'none',
            recurrenceUntil: draft.recurrenceUntil ? new Date(draft.recurrenceUntil) : null,
            reminderMinutes: draft.reminderMinutes,
            reminderSentAt: null,
            priority,
            linkedTaskId,
          },
        });
      });
      const conflicts =
        draft.kind === 'event'
          ? await findCalendarConflicts(ctx.staff, organizationId, startsAt, endsAt, {
              personalId: existing.event.id,
            })
          : [];
      return NextResponse.json({ event, conflicts });
    }

    const participantIds =
      draft.kind === 'note' ? [] : await activeParticipantIds(draft.participantIds ?? []);
    const previous = await ctx.run((tx) =>
      tx.companyCalendarEvent.findUniqueOrThrow({
        where: { id: existing.event.id },
        include: { participants: { select: { userId: true } } },
      }),
    );
    const previousIds = previous.participants.map((p) => p.userId);
    const addedIds = participantIds.filter((id) => !previousIds.includes(id));

    const event = await ctx.run(async (tx) => {
      await tx.companyCalendarEventParticipant.deleteMany({
        where: {
          eventId: existing.event.id,
          userId: { notIn: participantIds.length ? participantIds : ['__none__'] },
        },
      });
      for (const userId of addedIds) {
        await tx.companyCalendarEventParticipant.create({
          data: { organizationId, eventId: existing.event.id, userId },
        });
      }
      return tx.companyCalendarEvent.update({
        where: { id: existing.event.id },
        data: {
          kind: draft.kind,
          title: draft.title,
          eventType: draft.kind === 'note' ? 'note' : draft.eventType!,
          startsAt,
          endsAt,
          allDay: draft.kind === 'note' ? true : Boolean(draft.allDay),
          notes: draft.notes,
          recurrence: draft.kind === 'note' ? 'none' : (draft.recurrence ?? 'none'),
          recurrenceUntil:
            draft.kind === 'note' || !draft.recurrenceUntil ? null : new Date(draft.recurrenceUntil),
          reminderMinutes: draft.kind === 'note' ? null : draft.reminderMinutes,
          reminderSentAt: null,
        },
        include: {
          createdBy: { select: { name: true } },
          participants: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      });
    });

    if (draft.kind === 'event' && addedIds.length) {
      const recipients = event.participants
        .filter((p) => addedIds.includes(p.userId))
        .map((p) => p.user);
      await notifyCompanyEventParticipants(organizationId, event, recipients, 'invitation');
    }

    const conflicts =
      draft.kind === 'event'
        ? await findParticipantConflictWarnings(
            ctx.staff,
            organizationId,
            participantIds,
            startsAt,
            endsAt,
          )
        : [];
    return NextResponse.json({ event, conflicts });
  });
}

export async function DELETE(request: NextRequest, context: Context) {
  return withTenant(request, async (ctx) => {
    const existing = await eventForUser(ctx, (await context.params).id);
    if (!existing) {
      return NextResponse.json({ error: 'Event not found or not editable.' }, { status: 404 });
    }

    if (existing.scope === 'personal') {
      const cancelled = await ctx.run(async (tx) => {
        const event = await tx.personalCalendarEvent.update({
          where: { id: existing.event.id },
          data: { status: 'cancelled' },
        });
        if (existing.event.linkedTaskId) {
          await tx.staffTask.updateMany({
            where: { id: existing.event.linkedTaskId, organizationId: ctx.organizationId },
            data: { status: 'done', completedAt: new Date() },
          });
        }
        return event;
      });
      return NextResponse.json({ event: cancelled });
    }

    const event = await ctx.run(async (tx) => {
      const updated = await tx.companyCalendarEvent.update({
        where: { id: existing.event.id },
        data: { status: 'cancelled' },
        include: {
          createdBy: { select: { name: true } },
          participants: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      });
      return updated;
    });

    if (event.participants.length) {
      await notifyCompanyEventParticipants(
        ctx.organizationId,
        event,
        event.participants.map((p) => p.user),
        'cancelled',
      );
    }
    return NextResponse.json({ event });
  });
}
