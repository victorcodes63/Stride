import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { RotaPeriodStatus } from '@prisma/client';
import { canManageStaffRota } from '@/lib/staff-rota/api-auth';
import { resolveStaffRotaPolicy, isBlockingConflict } from '@/lib/staff-rota/policy-engine';
import {
  assertWorkDateInRota,
  conflictsForProposed,
  dateKeyLocal,
  resolveShiftInstants,
  toShiftWindows,
} from '@/lib/staff-rota/assignment-helpers';
import { listOrgStaffUsers } from '@/lib/staff-time-attendance/staff-directory';
import { withTenant } from '@/lib/tenant-api';

type P = { params: Promise<{ id: string }> };

const ASSIGNMENT_INCLUDE = {
  user: { select: { id: true, name: true, email: true, department: true, staffUserType: true } },
  shiftTemplate: { select: { id: true, name: true, color: true } },
} satisfies Prisma.StaffShiftAssignmentInclude;

async function loadNeighborAssignments(
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
  center: Date,
  excludeId: string,
) {
  const from = new Date(center);
  from.setDate(from.getDate() - 35);
  const to = new Date(center);
  to.setDate(to.getDate() + 35);
  return tx.staffShiftAssignment.findMany({
    where: { organizationId, userId, id: { not: excludeId }, startsAt: { gte: from, lte: to } },
  });
}

export async function GET(request: NextRequest, { params }: P) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const a = await ctx.run((tx) =>
      tx.staffShiftAssignment.findFirst({
        where: ctx.where({ id }),
        include: {
          ...ASSIGNMENT_INCLUDE,
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
    if (!canManageStaffRota(ctx.staff)) {
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
    const force = body.force === true;

    const result = await ctx.run(async (tx) => {
      const existing = await tx.staffShiftAssignment.findFirst({
        where: ctx.where({ id }),
        include: { rotaPeriod: true },
      });
      if (!existing) return { status: 404 as const, error: 'Not found' };
      if (existing.rotaPeriod.status === RotaPeriodStatus.published) {
        return { status: 409 as const, error: 'This period is published. Unpublish it to edit assignments.' };
      }

      const workDateStr = body.workDate != null ? String(body.workDate).trim() : null;
      const workDate =
        workDateStr && /^\d{4}-\d{2}-\d{2}$/.test(workDateStr) ? workDateStr : dateKeyLocal(existing.workDate);

      try {
        assertWorkDateInRota(workDate, existing.rotaPeriod.startDate, existing.rotaPeriod.endDate);
      } catch (e) {
        return { status: 400 as const, error: e instanceof Error ? e.message : 'Invalid work date' };
      }

      const notes = body.notes !== undefined ? (body.notes == null ? null : String(body.notes).trim() || null) : existing.notes;
      const breakProvided = body.breakMinutes != null;
      let breakMinutes = existing.breakMinutes;
      if (breakProvided) {
        const n = parseInt(String(body.breakMinutes), 10);
        if (Number.isFinite(n) && n >= 0) breakMinutes = n;
      }

      const recompute =
        body.shiftTemplateId !== undefined ||
        body.startMinutes != null ||
        body.endMinutes != null ||
        body.startTime != null ||
        body.endTime != null ||
        body.startsAt != null ||
        body.endsAt != null ||
        (workDateStr != null && workDateStr !== dateKeyLocal(existing.workDate));

      let startsAt = existing.startsAt;
      let endsAt = existing.endsAt;
      let templateId = existing.staffShiftTemplateId;

      if (recompute) {
        let template = null;
        const shiftTemplateId =
          body.shiftTemplateId !== undefined ? String(body.shiftTemplateId || '').trim() : '';
        const explicitTime =
          body.startMinutes != null ||
          body.startTime != null ||
          body.startsAt != null;

        if (shiftTemplateId) {
          template = await tx.staffShiftTemplate.findFirst({
            where: ctx.where({ id: shiftTemplateId, isActive: true }),
          });
          if (!template) return { status: 400 as const, error: 'Shift template not found' };
        } else if (!explicitTime && existing.staffShiftTemplateId && body.shiftTemplateId === undefined) {
          // Only the work date changed — re-anchor the existing template's times to the new day.
          template = await tx.staffShiftTemplate.findFirst({
            where: ctx.where({ id: existing.staffShiftTemplateId }),
          });
        }

        const resolved = resolveShiftInstants({
          workDate,
          template,
          startMinutes: body.startMinutes != null ? parseInt(String(body.startMinutes), 10) : undefined,
          endMinutes: body.endMinutes != null ? parseInt(String(body.endMinutes), 10) : undefined,
          startTime: body.startTime != null ? String(body.startTime) : null,
          endTime: body.endTime != null ? String(body.endTime) : null,
          startsAtIso: body.startsAt != null ? String(body.startsAt) : null,
          endsAtIso: body.endsAt != null ? String(body.endsAt) : null,
          breakMinutes,
          breakProvided,
        });
        if ('error' in resolved) {
          // If nothing usable was provided but the date moved, keep the wall-clock time on the new day.
          if (!template && !explicitTime) {
            const dayShift =
              new Date(`${workDate}T00:00:00`).getTime() - new Date(`${dateKeyLocal(existing.startsAt)}T00:00:00`).getTime();
            startsAt = new Date(existing.startsAt.getTime() + dayShift);
            endsAt = new Date(existing.endsAt.getTime() + dayShift);
          } else {
            return { status: 400 as const, error: resolved.error };
          }
        } else {
          startsAt = resolved.startsAt;
          endsAt = resolved.endsAt;
          templateId = resolved.templateId;
          breakMinutes = resolved.breakMinutes;
        }
      }

      if (endsAt.getTime() <= startsAt.getTime()) {
        return { status: 400 as const, error: 'endsAt must be after startsAt' };
      }

      const subjects = await listOrgStaffUsers(tx, ctx.organizationId);
      // Allow reassigning the shift to another staff member (drag across rows).
      const requestedUserId = body.userId != null ? String(body.userId).trim() : '';
      const targetUserId = requestedUserId || existing.userId;
      const subject = subjects.find((s) => s.id === targetUserId);
      if (requestedUserId && !subject) {
        return { status: 404 as const, error: 'Staff member not found in this organization' };
      }
      const policy = resolveStaffRotaPolicy({
        staffUserType: subject?.staffUserType,
        department: subject?.department,
      });
      const neighbors = await loadNeighborAssignments(tx, ctx.organizationId, targetUserId, startsAt, id);
      const conflicts = conflictsForProposed(
        toShiftWindows(neighbors),
        { id: `proposed-${id}`, startsAt, endsAt, breakMinutes },
        targetUserId,
        policy,
      );
      const blocking = conflicts.filter(isBlockingConflict);
      if (blocking.length && !force) {
        return { status: 409 as const, conflicts: blocking, policy };
      }

      const updated = await tx.staffShiftAssignment.update({
        where: { id },
        data: {
          userId: targetUserId,
          workDate: new Date(`${workDate}T12:00:00`),
          staffShiftTemplateId: templateId,
          startsAt,
          endsAt,
          breakMinutes,
          notes,
        },
        include: ASSIGNMENT_INCLUDE,
      });
      return { status: 200 as const, updated, warnings: conflicts.filter((c) => !isBlockingConflict(c)) };
    });

    if ('conflicts' in result) {
      return NextResponse.json({ error: 'Rota conflict', conflicts: result.conflicts, policy: result.policy }, { status: 409 });
    }
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await ctx.audit({
      action: 'staff_rota.assignment.update',
      entityType: 'StaffShiftAssignment',
      entityId: id,
      route: request.nextUrl.pathname,
      metadata: { userId: result.updated.userId },
    });

    return NextResponse.json({ ...result.updated, warnings: result.warnings });
  });
}

export async function DELETE(request: NextRequest, { params }: P) {
  return withTenant(request, async (ctx) => {
    if (!canManageStaffRota(ctx.staff)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const { id } = await params;

    const result = await ctx.run(async (tx) => {
      const existing = await tx.staffShiftAssignment.findFirst({
        where: ctx.where({ id }),
        include: { rotaPeriod: { select: { status: true } } },
      });
      if (!existing) return { status: 404 as const, error: 'Not found' };
      if (existing.rotaPeriod.status === RotaPeriodStatus.published) {
        return { status: 409 as const, error: 'This period is published. Unpublish it to delete assignments.' };
      }
      await tx.staffShiftAssignment.delete({ where: { id } });
      return { status: 200 as const, userId: existing.userId };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await ctx.audit({
      action: 'staff_rota.assignment.delete',
      entityType: 'StaffShiftAssignment',
      entityId: id,
      route: request.nextUrl.pathname,
      metadata: { userId: result.userId },
    });

    return NextResponse.json({ ok: true });
  });
}
