import { NextRequest, NextResponse } from 'next/server';
import type {
  LegalObligationCategory,
  LegalObligationPriority,
  LegalObligationStatus,
  Prisma,
} from '@prisma/client';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';
import { toRecord } from '../route';

export const dynamic = 'force-dynamic';

const CATEGORIES = new Set<LegalObligationCategory>([
  'filing',
  'permit',
  'licence',
  'board',
  'regulator',
  'insurance',
  'other',
]);
const STATUSES = new Set<LegalObligationStatus>(['pending', 'completed', 'waived']);
const PRIORITIES = new Set<LegalObligationPriority>(['low', 'medium', 'high', 'critical']);

const OBLIGATION_INCLUDE = {
  owner: { select: { id: true, name: true, email: true } },
} satisfies Prisma.LegalObligationInclude;

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseIntOrNull(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function addMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()),
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    try {
      const row = await ctx.run((tx) =>
        tx.legalObligation.findFirst({
          where: { ...ctx.where(), id },
          include: {
            owner: { select: { id: true, name: true, email: true } },
            events: {
              orderBy: { createdAt: 'desc' },
              include: { actor: { select: { id: true, name: true } } },
            },
          },
        }),
      );
      if (!row) {
        return NextResponse.json({ error: 'Compliance obligation not found.' }, { status: 404 });
      }
      return NextResponse.json({
        ...toRecord(row),
        events: row.events.map((e) => ({
          id: e.id,
          type: e.type,
          fromStatus: e.fromStatus,
          toStatus: e.toStatus,
          note: e.note,
          createdAt: e.createdAt.toISOString(),
          actor: e.actor ? { id: e.actor.id, name: e.actor.name } : null,
        })),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/legal/obligations/records/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load compliance obligation.' }, { status: 500 });
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const dueDate = parseDate(body.dueDate);
    if (dueDate === null) {
      return NextResponse.json({ error: 'Invalid dueDate.' }, { status: 400 });
    }

    const nextStatus =
      typeof body.status === 'string' && STATUSES.has(body.status as LegalObligationStatus)
        ? (body.status as LegalObligationStatus)
        : undefined;
    const waivedReason =
      typeof body.waivedReason === 'string' ? body.waivedReason.trim() : undefined;
    const note = typeof body.note === 'string' ? body.note.trim() || null : null;

    try {
      const existing = await ctx.run((tx) =>
        tx.legalObligation.findFirst({
          where: { ...ctx.where(), id },
          include: OBLIGATION_INCLUDE,
        }),
      );
      if (!existing) {
        return NextResponse.json({ error: 'Compliance obligation not found.' }, { status: 404 });
      }

      // Owner assignment change detection.
      let nextOwnerId: string | null | undefined;
      if (body.ownerUserId !== undefined) {
        nextOwnerId =
          typeof body.ownerUserId === 'string' && body.ownerUserId.trim()
            ? body.ownerUserId.trim()
            : null;
      }
      const ownerChanged = nextOwnerId !== undefined && nextOwnerId !== existing.ownerUserId;
      const statusChanged = nextStatus !== undefined && nextStatus !== existing.status;

      if (statusChanged && nextStatus === 'waived' && !waivedReason && !existing.waivedReason) {
        return NextResponse.json(
          { error: 'A reason is required to waive an obligation.' },
          { status: 400 },
        );
      }

      const data: Prisma.LegalObligationUpdateInput = {
        ...(typeof body.title === 'string' ? { title: body.title.trim() } : {}),
        ...(body.description !== undefined
          ? {
              description:
                typeof body.description === 'string' ? body.description.trim() || null : null,
            }
          : {}),
        ...(typeof body.category === 'string' && CATEGORIES.has(body.category as LegalObligationCategory)
          ? { category: body.category as LegalObligationCategory }
          : {}),
        ...(typeof body.priority === 'string' && PRIORITIES.has(body.priority as LegalObligationPriority)
          ? { priority: body.priority as LegalObligationPriority }
          : {}),
        ...(dueDate !== undefined ? { dueDate } : {}),
        ...(nextStatus !== undefined ? { status: nextStatus } : {}),
        ...(nextOwnerId !== undefined
          ? { owner: nextOwnerId ? { connect: { id: nextOwnerId } } : { disconnect: true } }
          : {}),
        ...(body.regulator !== undefined
          ? { regulator: typeof body.regulator === 'string' ? body.regulator.trim() || null : null }
          : {}),
        ...(body.reminderDays !== undefined
          ? { reminderDays: Math.max(0, parseIntOrNull(body.reminderDays) ?? existing.reminderDays) }
          : {}),
        ...(body.recurrenceMonths !== undefined
          ? {
              recurrenceMonths: (() => {
                const n = parseIntOrNull(body.recurrenceMonths);
                return n != null && n > 0 ? n : null;
              })(),
            }
          : {}),
        ...(body.notes !== undefined
          ? { notes: typeof body.notes === 'string' ? body.notes.trim() || null : null }
          : {}),
      };

      // Status-driven side effects.
      if (statusChanged) {
        if (nextStatus === 'completed') {
          data.completedAt = new Date();
        } else if (nextStatus === 'pending') {
          data.completedAt = null;
        }
        if (nextStatus === 'waived' && waivedReason) {
          data.waivedReason = waivedReason;
        }
      }

      const updated = await ctx.run(async (tx) => {
        const row = await tx.legalObligation.update({
          where: { id },
          data,
          include: OBLIGATION_INCLUDE,
        });

        const events: Prisma.LegalObligationEventCreateManyInput[] = [];
        if (ownerChanged) {
          events.push({
            organizationId: ctx.organizationId,
            obligationId: id,
            actorUserId: ctx.staff.id,
            type: 'assigned',
            note,
          });
        }
        if (statusChanged) {
          const type =
            nextStatus === 'completed'
              ? 'completed'
              : nextStatus === 'waived'
                ? 'waived'
                : nextStatus === 'pending'
                  ? 'reopened'
                  : 'status_changed';
          events.push({
            organizationId: ctx.organizationId,
            obligationId: id,
            actorUserId: ctx.staff.id,
            type,
            fromStatus: existing.status,
            toStatus: nextStatus,
            note: nextStatus === 'waived' ? waivedReason ?? note : note,
          });
        }
        if (!ownerChanged && !statusChanged) {
          events.push({
            organizationId: ctx.organizationId,
            obligationId: id,
            actorUserId: ctx.staff.id,
            type: 'updated',
            note,
          });
        }
        if (events.length) {
          await tx.legalObligationEvent.createMany({ data: events });
        }

        // Recurrence: when completed and a cadence is configured, spawn the next cycle.
        const recurrence = row.recurrenceMonths;
        if (statusChanged && nextStatus === 'completed' && recurrence && recurrence > 0) {
          const nextDue = addMonths(row.dueDate, recurrence);
          const next = await tx.legalObligation.create({
            data: {
              organizationId: ctx.organizationId,
              title: row.title,
              description: row.description,
              category: row.category,
              priority: row.priority,
              dueDate: nextDue,
              status: 'pending',
              ownerUserId: row.ownerUserId,
              regulator: row.regulator,
              reminderDays: row.reminderDays,
              recurrenceMonths: row.recurrenceMonths,
              notes: row.notes,
            },
          });
          await tx.legalObligationEvent.create({
            data: {
              organizationId: ctx.organizationId,
              obligationId: next.id,
              actorUserId: ctx.staff.id,
              type: 'created',
              toStatus: 'pending',
              note: `Auto-created from recurring obligation ${row.title}.`,
            },
          });
        }

        return row;
      });

      await ctx.audit({
        action: statusChanged
          ? `legal_obligation.${nextStatus}`
          : ownerChanged
            ? 'legal_obligation.assigned'
            : 'legal_obligation.updated',
        entityType: 'LegalObligation',
        entityId: id,
        route: 'PATCH /api/legal/obligations/records/[id]',
      });

      return NextResponse.json(toRecord(updated));
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/legal/obligations/records/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update compliance obligation.' }, { status: 500 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    try {
      const existing = await ctx.run((tx) =>
        tx.legalObligation.findFirst({
          where: { ...ctx.where(), id },
          select: { id: true },
        }),
      );
      if (!existing) {
        return NextResponse.json({ error: 'Compliance obligation not found.' }, { status: 404 });
      }

      await ctx.run((tx) => tx.legalObligation.delete({ where: { id } }));

      await ctx.audit({
        action: 'legal_obligation.deleted',
        entityType: 'LegalObligation',
        entityId: id,
        route: 'DELETE /api/legal/obligations/records/[id]',
      });

      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/legal/obligations/records/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete compliance obligation.' }, { status: 500 });
    }
  });
}
