import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { canWriteRota } from '@/lib/rota/api-auth';
import { resolveRotaPolicy } from '@/lib/rota/conflict-rules';
import { instantsFromTemplateMinutes } from '@/lib/rota/shift-instants';
import { toShiftWindows, assertWorkDateInRota, conflictsForProposed } from '@/lib/rota/assignment-helpers';
import { sendNotification } from '@/lib/notifications';
import { withTenant } from '@/lib/tenant-api';

type P = { params: Promise<{ id: string }> };

function parseHmToMinutes(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = parseInt(m[1]!, 10);
  const min = parseInt(m[2]!, 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

async function loadNeighborAssignments(
  tx: Prisma.TransactionClient,
  employeeId: string,
  center: Date,
  excludeId: string,
) {
  const from = new Date(center);
  from.setDate(from.getDate() - 35);
  const to = new Date(center);
  to.setDate(to.getDate() + 35);
  return tx.shiftAssignment.findMany({
    where: {
      employeeId,
      id: { not: excludeId },
      startsAt: { gte: from, lte: to },
    },
  });
}

export async function GET(request: NextRequest, { params }: P) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const a = await ctx.run((tx) =>
      tx.shiftAssignment.findFirst({
        where: ctx.where({ id }),
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, jobTitle: true } },
          shiftTemplate: { select: { id: true, name: true, startMinutes: true, endMinutes: true } },
          rotaPeriod: { select: { id: true, name: true, startDate: true, endDate: true, status: true } },
        },
      }),
    );
    if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(a);
  });
}

export async function PATCH(request: NextRequest, { params }: P) {
  return withTenant(request, async (ctx) => {
    if (!canWriteRota(ctx.staff)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const patchResult = await ctx.run(async (tx) => {
      const existing = await tx.shiftAssignment.findFirst({
        where: ctx.where({ id }),
        include: { employee: true, rotaPeriod: true },
      });
      if (!existing) return { error: 'Not found' as const };

      const workDateStr = body.workDate != null ? String(body.workDate).trim() : null;
      const workDate = workDateStr && /^\d{4}-\d{2}-\d{2}$/.test(workDateStr) ? workDateStr : null;
      const wDate = workDate
        ? workDate
        : existing.workDate.getFullYear() +
          '-' +
          String(existing.workDate.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(existing.workDate.getDate()).padStart(2, '0');

      try {
        assertWorkDateInRota(wDate, existing.rotaPeriod.startDate, existing.rotaPeriod.endDate);
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Invalid work date' };
      }

      const notes = body.notes !== undefined ? (body.notes == null ? null : String(body.notes)) : existing.notes;

      let breakMinutes = existing.breakMinutes;
      if (body.breakMinutes != null) {
        const n = parseInt(String(body.breakMinutes), 10);
        if (Number.isFinite(n) && n >= 0) breakMinutes = n;
      }

      const shiftTemplateId = body.shiftTemplateId !== undefined ? String(body.shiftTemplateId || '').trim() : null;
      const customStartM = body.startMinutes != null ? parseInt(String(body.startMinutes), 10) : NaN;
      const customEndM = body.endMinutes != null ? parseInt(String(body.endMinutes), 10) : NaN;
      const timeStart = body.startTime != null ? parseHmToMinutes(String(body.startTime)) : null;
      const timeEnd = body.endTime != null ? parseHmToMinutes(String(body.endTime)) : null;
      const fromIsoStart = body.startsAt != null ? new Date(String(body.startsAt)) : null;
      const fromIsoEnd = body.endsAt != null ? new Date(String(body.endsAt)) : null;

      let startsAt = existing.startsAt;
      let endsAt = existing.endsAt;
      let templateId: string | null = existing.shiftTemplateId;

      const recompute = Boolean(
        shiftTemplateId !== null ||
          body.startMinutes != null ||
          body.endMinutes != null ||
          body.startTime != null ||
          body.endTime != null ||
          body.startsAt != null ||
          body.endsAt != null ||
          workDate,
      );

      if (recompute) {
        if (shiftTemplateId) {
          const t = await tx.shiftTemplate.findFirst({
            where: ctx.where({
              id: shiftTemplateId,
              outsourcingClientId: existing.rotaPeriod.outsourcingClientId,
              isActive: true,
            }),
          });
          if (!t) {
            return { error: 'Shift template not found for this client' as const };
          }
          templateId = t.id;
          const inst = instantsFromTemplateMinutes(wDate, t.startMinutes, t.endMinutes);
          startsAt = inst.startsAt;
          endsAt = inst.endsAt;
          if (body.breakMinutes == null && t.breakMinutes) breakMinutes = t.breakMinutes;
        } else if (Number.isFinite(customStartM) && Number.isFinite(customEndM)) {
          const inst = instantsFromTemplateMinutes(wDate, customStartM, customEndM);
          startsAt = inst.startsAt;
          endsAt = inst.endsAt;
          templateId = null;
        } else if (timeStart != null && timeEnd != null) {
          const inst = instantsFromTemplateMinutes(wDate, timeStart, timeEnd);
          startsAt = inst.startsAt;
          endsAt = inst.endsAt;
          templateId = null;
        } else if (
          fromIsoStart &&
          fromIsoEnd &&
          !Number.isNaN(fromIsoStart.getTime()) &&
          !Number.isNaN(fromIsoEnd.getTime())
        ) {
          startsAt = fromIsoStart;
          endsAt = fromIsoEnd;
          templateId = null;
        } else if (workDate && body.shiftTemplateId === undefined) {
          if (existing.shiftTemplateId) {
            const t = await tx.shiftTemplate.findFirst({
              where: ctx.where({ id: existing.shiftTemplateId }),
            });
            if (t) {
              const inst = instantsFromTemplateMinutes(wDate, t.startMinutes, t.endMinutes);
              startsAt = inst.startsAt;
              endsAt = inst.endsAt;
            }
          }
        }

        if (endsAt.getTime() <= startsAt.getTime()) {
          return { error: 'endsAt must be after startsAt' as const };
        }
      }

      const policy = resolveRotaPolicy({ employeeJobTitle: existing.employee.jobTitle });
      const tempId = `proposed-${id}`;
      const neighbors = await loadNeighborAssignments(tx, existing.employeeId, startsAt, id);
      const c = conflictsForProposed(
        toShiftWindows(neighbors),
        { id: tempId, startsAt, endsAt, breakMinutes },
        existing.employeeId,
        policy,
      );
      if (c.length) {
        return { conflict: true as const, conflicts: c, policy };
      }

      const workDateD = new Date(wDate + 'T12:00:00');
      return tx.shiftAssignment.update({
        where: { id },
        data: {
          workDate: workDateD,
          shiftTemplateId: templateId,
          startsAt,
          endsAt,
          breakMinutes,
          notes,
        },
        include: {
          employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
          shiftTemplate: { select: { name: true } },
        },
      });
    });

    if ('conflict' in patchResult && patchResult.conflict) {
      return NextResponse.json(
        { error: 'Rota conflict', conflicts: patchResult.conflicts, policy: patchResult.policy },
        { status: 409 },
      );
    }
    if ('error' in patchResult) {
      const status = patchResult.error === 'Not found' ? 404 : 400;
      return NextResponse.json({ error: patchResult.error }, { status });
    }

    const updated = patchResult;
    try {
      const essIds = updated.employeeId
        ? (
            await ctx.run((tx) =>
              tx.employee.findFirst({
                where: ctx.where({ id: updated.employeeId }),
                select: { essPortalUsers: { where: { isActive: true }, select: { id: true } } },
              }),
            )
          )?.essPortalUsers.map((u) => u.id) || []
        : [];
      if (essIds.length > 0) {
        const wDate =
          body.workDate != null && /^\d{4}-\d{2}-\d{2}$/.test(String(body.workDate).trim())
            ? String(body.workDate).trim()
            : updated.workDate.toISOString().slice(0, 10);
        await sendNotification({
          event: 'shift_changed',
          recipientEssPortalUserIds: essIds,
          title: 'Shift change',
          body: `Your shift on ${wDate} has been changed.`,
          href: '/ess/attendance',
          priority: 'action_required',
          channel: 'in_app',
          metadata: { assignmentId: updated.id, workDate: wDate },
        });
      }
    } catch (err) {
      console.error('[notifications] Failed to send shift_changed:', err);
    }
    return NextResponse.json(updated);
  });
}

export async function DELETE(request: NextRequest, { params }: P) {
  return withTenant(request, async (ctx) => {
    if (!canWriteRota(ctx.staff)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const { id } = await params;

    const employee = await ctx.run(async (tx) => {
      const existing = await tx.shiftAssignment.findFirst({ where: ctx.where({ id }) });
      if (!existing) return null;
      const emp = await tx.employee.findFirst({
        where: ctx.where({ id: existing.employeeId }),
        select: { essPortalUsers: { where: { isActive: true }, select: { id: true } } },
      });
      await tx.shiftAssignment.delete({ where: { id } });
      return emp;
    });

    if (employee === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    try {
      const essIds = employee?.essPortalUsers.map((u) => u.id) || [];
      if (essIds.length > 0) {
        await sendNotification({
          event: 'shift_changed',
          recipientEssPortalUserIds: essIds,
          title: 'Shift change',
          body: 'One of your scheduled shifts has been removed or changed. Please review your rota.',
          href: '/ess/attendance',
          priority: 'action_required',
          channel: 'in_app',
          metadata: { assignmentId: id },
        });
      }
    } catch (err) {
      console.error('[notifications] Failed to send shift_changed on delete:', err);
    }
    return NextResponse.json({ ok: true });
  });
}
