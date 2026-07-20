import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { RotaPeriodStatus } from '@prisma/client';
import { canManageStaffRota } from '@/lib/staff-rota/api-auth';
import {
  detectConflictsForUser,
  resolveStaffRotaPolicy,
  isBlockingConflict,
  type ShiftWindow,
  type StaffRotaConflict,
} from '@/lib/staff-rota/policy-engine';
import { assertWorkDateInRota, resolveShiftInstants } from '@/lib/staff-rota/assignment-helpers';
import { listOrgStaffUsers } from '@/lib/staff-time-attendance/staff-directory';
import { withTenant } from '@/lib/tenant-api';

type BatchItem = {
  userId: string;
  workDate: string;
  shiftTemplateId?: string | null;
  startMinutes?: number;
  endMinutes?: number;
  startTime?: string | null;
  endTime?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  breakMinutes?: number;
  notes?: string | null;
};

const ASSIGNMENT_INCLUDE = {
  user: { select: { id: true, name: true, email: true, department: true, staffUserType: true } },
  shiftTemplate: { select: { id: true, name: true, color: true } },
} satisfies Prisma.StaffShiftAssignmentInclude;

/**
 * POST /api/staff/rota/assignments/batch
 * Create many assignments in a single transaction. This replaces the
 * one-request-per-cell pattern (bulk-assign a template across a week, copy the
 * previous week, seed a demo week, retry failed CSV rows).
 *
 * Body: { rotaPeriodId, items: BatchItem[], skipConflicts?: boolean, force?: boolean }
 * - skipConflicts (default true): rows with blocking conflicts are skipped and
 *   reported; other rows still commit.
 * - force: create even when blocking conflicts are detected.
 */
export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canManageStaffRota(ctx.staff)) {
      return NextResponse.json({ error: 'You do not have permission to manage the rota' }, { status: 403 });
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const rotaPeriodId = String(body.rotaPeriodId || '').trim();
    const items = Array.isArray(body.items) ? (body.items as BatchItem[]) : [];
    const skipConflicts = body.skipConflicts !== false;
    const force = body.force === true;
    if (!rotaPeriodId) {
      return NextResponse.json({ error: 'rotaPeriodId is required' }, { status: 400 });
    }
    if (!items.length) {
      return NextResponse.json({ error: 'items[] must contain at least one assignment' }, { status: 400 });
    }
    if (items.length > 1000) {
      return NextResponse.json({ error: 'Batch too large (max 1000 items)' }, { status: 400 });
    }

    const outcome = await ctx.run(async (tx) => {
      const rota = await tx.staffRotaPeriod.findFirst({ where: ctx.where({ id: rotaPeriodId }) });
      if (!rota) return { status: 404 as const, error: 'Rota period not found' };
      if (rota.status === RotaPeriodStatus.published) {
        return { status: 409 as const, error: 'This period is published. Unpublish it to edit assignments.' };
      }

      const subjects = await listOrgStaffUsers(tx, ctx.organizationId);
      const subjectById = new Map(subjects.map((s) => [s.id, s]));

      const templates = await tx.staffShiftTemplate.findMany({
        where: ctx.where({ isActive: true }),
      });
      const templateById = new Map(templates.map((t) => [t.id, t]));

      // Pre-load existing shifts per involved user across a padded window so we
      // can conflict-check in memory without a query per row.
      const userIds = [...new Set(items.map((i) => String(i.userId || '').trim()).filter(Boolean))];
      const from = new Date(rota.startDate);
      from.setDate(from.getDate() - 35);
      const to = new Date(rota.endDate);
      to.setDate(to.getDate() + 35);
      const existing = await tx.staffShiftAssignment.findMany({
        where: { organizationId: ctx.organizationId, userId: { in: userIds }, startsAt: { gte: from, lte: to } },
        select: { id: true, userId: true, startsAt: true, endsAt: true, breakMinutes: true },
      });
      const windowsByUser = new Map<string, ShiftWindow[]>();
      for (const uid of userIds) windowsByUser.set(uid, []);
      for (const e of existing) {
        windowsByUser.get(e.userId)?.push({ id: e.id, startsAt: e.startsAt, endsAt: e.endsAt, breakMinutes: e.breakMinutes });
      }

      const skipped: { index: number; userId: string; workDate: string; reason: string; conflicts?: StaffRotaConflict[] }[] = [];
      const toCreate: Prisma.StaffShiftAssignmentCreateManyInput[] = [];
      let tempSeq = 0;

      for (let index = 0; index < items.length; index++) {
        const item = items[index]!;
        const userId = String(item.userId || '').trim();
        const workDate = String(item.workDate || '').trim();
        if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
          skipped.push({ index, userId, workDate, reason: 'userId and workDate (YYYY-MM-DD) are required' });
          continue;
        }
        const subject = subjectById.get(userId);
        if (!subject) {
          skipped.push({ index, userId, workDate, reason: 'Staff member not found in this organization' });
          continue;
        }
        try {
          assertWorkDateInRota(workDate, rota.startDate, rota.endDate);
        } catch {
          skipped.push({ index, userId, workDate, reason: 'Work date outside the rota period' });
          continue;
        }

        let template = null;
        if (item.shiftTemplateId) {
          template = templateById.get(String(item.shiftTemplateId)) ?? null;
          if (!template) {
            skipped.push({ index, userId, workDate, reason: 'Shift template not found' });
            continue;
          }
        }

        const breakProvided = item.breakMinutes != null;
        const resolved = resolveShiftInstants({
          workDate,
          template,
          startMinutes: item.startMinutes,
          endMinutes: item.endMinutes,
          startTime: item.startTime ?? null,
          endTime: item.endTime ?? null,
          startsAtIso: item.startsAt ?? null,
          endsAtIso: item.endsAt ?? null,
          breakMinutes: breakProvided ? Math.max(0, Number(item.breakMinutes) || 0) : 0,
          breakProvided,
        });
        if ('error' in resolved) {
          skipped.push({ index, userId, workDate, reason: resolved.error });
          continue;
        }

        const policy = resolveStaffRotaPolicy({ staffUserType: subject.staffUserType, department: subject.department });
        const tempId = `batch-${index}-${tempSeq++}`;
        const windows = windowsByUser.get(userId) ?? [];
        const proposed: ShiftWindow = {
          id: tempId,
          startsAt: resolved.startsAt,
          endsAt: resolved.endsAt,
          breakMinutes: resolved.breakMinutes,
        };
        const conflicts = detectConflictsForUser(userId, [...windows, proposed], policy);
        const blocking = conflicts.filter(isBlockingConflict);
        if (blocking.length && !force) {
          if (skipConflicts) {
            skipped.push({
              index,
              userId,
              workDate,
              reason: blocking.map((c) => c.message).slice(0, 2).join('; '),
              conflicts: blocking,
            });
            continue;
          }
          return { status: 409 as const, error: 'Rota conflict in batch', conflicts: blocking, index };
        }

        // Accept: add to the in-memory window set so subsequent rows in the same
        // batch are checked against it too.
        windows.push(proposed);
        windowsByUser.set(userId, windows);
        toCreate.push({
          organizationId: ctx.organizationId,
          staffRotaPeriodId: rotaPeriodId,
          userId,
          staffShiftTemplateId: resolved.templateId,
          workDate: new Date(`${workDate}T12:00:00`),
          startsAt: resolved.startsAt,
          endsAt: resolved.endsAt,
          breakMinutes: resolved.breakMinutes,
          notes: item.notes != null ? String(item.notes).trim() || null : null,
        });
      }

      if (toCreate.length) {
        await tx.staffShiftAssignment.createMany({ data: toCreate });
      }

      // Return the freshly created rows (hydrated) for optimistic reconciliation.
      const created = toCreate.length
        ? await tx.staffShiftAssignment.findMany({
            where: ctx.where({ staffRotaPeriodId: rotaPeriodId }),
            orderBy: [{ createdAt: 'desc' }],
            take: toCreate.length,
            include: ASSIGNMENT_INCLUDE,
          })
        : [];

      return { status: 200 as const, created, createdCount: toCreate.length, skipped };
    });

    if ('error' in outcome) {
      const payload: Record<string, unknown> = { error: outcome.error };
      if ('conflicts' in outcome) payload.conflicts = outcome.conflicts;
      if ('index' in outcome) payload.index = outcome.index;
      return NextResponse.json(payload, { status: outcome.status });
    }

    await ctx.audit({
      action: 'staff_rota.assignment.batch_create',
      entityType: 'StaffRotaPeriod',
      entityId: rotaPeriodId,
      route: request.nextUrl.pathname,
      metadata: { created: outcome.createdCount, skipped: outcome.skipped.length },
    });

    return NextResponse.json({
      ok: true,
      created: outcome.createdCount,
      skipped: outcome.skipped,
      assignments: outcome.created,
    });
  });
}
