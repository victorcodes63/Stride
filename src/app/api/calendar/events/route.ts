import { NextRequest, NextResponse } from 'next/server';
import {
  activeParticipantIds,
  findCalendarConflicts,
  findParticipantConflictWarnings,
  notifyCompanyEventParticipants,
  parseCalendarDraft,
} from '@/lib/collaborative-calendar';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const parsed = parseCalendarDraft(await request.json().catch(() => null));
    if (!parsed.draft) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const draft = parsed.draft;
    const startsAt = new Date(draft.startsAt);
    const endsAt = new Date(draft.endsAt);
    const organizationId = ctx.organizationId;

    if (draft.scope === 'personal') {
      const priority = draft.priority ?? 'none';
      const { event, conflicts } = await ctx.run(async (tx) => {
        let linkedTaskId: string | null = null;
        if (draft.kind === 'reminder' && draft.linkToTask) {
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
        }

        const created = await tx.personalCalendarEvent.create({
          data: {
            organizationId,
            userId: ctx.staff.id,
            kind: draft.kind,
            title: draft.title,
            notes: draft.notes,
            startsAt,
            endsAt,
            allDay: Boolean(draft.allDay),
            isFocusBlock: draft.kind === 'event' ? Boolean(draft.isFocusBlock) : false,
            recurrence: draft.recurrence ?? 'none',
            recurrenceUntil: draft.recurrenceUntil ? new Date(draft.recurrenceUntil) : null,
            reminderMinutes: draft.reminderMinutes,
            priority,
            linkedTaskId,
          },
        });
        return { event: created, conflicts: null as unknown[] | null };
      });

      const conflictList =
        draft.kind === 'event'
          ? await findCalendarConflicts(ctx.staff, organizationId, startsAt, endsAt)
          : [];
      return NextResponse.json({ event, conflicts: conflictList }, { status: 201 });
    }

    const participantIds =
      draft.kind === 'note' ? [] : await activeParticipantIds(draft.participantIds ?? []);

    const event = await ctx.run(async (tx) =>
      tx.companyCalendarEvent.create({
        data: {
          organizationId,
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
          createdById: ctx.staff.id,
          participants: participantIds.length
            ? {
                create: participantIds.map((userId) => ({
                  organizationId,
                  userId,
                })),
              }
            : undefined,
        },
        include: {
          createdBy: { select: { name: true } },
          participants: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      }),
    );

    if (draft.kind === 'event' && event.participants.length) {
      await notifyCompanyEventParticipants(
        organizationId,
        event,
        event.participants.map((participant) => participant.user),
        'invitation',
      );
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
    return NextResponse.json({ event, conflicts }, { status: 201 });
  });
}
