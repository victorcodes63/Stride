import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { RotaPeriodStatus } from '@prisma/client';
import { canManageStaffRota } from '@/lib/staff-rota/api-auth';
import { resolveStaffRotaPolicy, isBlockingConflict } from '@/lib/staff-rota/policy-engine';
import {
  assertWorkDateInRota,
  conflictsForProposed,
  resolveShiftInstants,
  toShiftWindows,
} from '@/lib/staff-rota/assignment-helpers';
import { listOrgStaffUsers } from '@/lib/staff-time-attendance/staff-directory';
import { withTenant } from '@/lib/tenant-api';

const ASSIGNMENT_INCLUDE = {
  user: { select: { id: true, name: true, email: true, department: true, staffUserType: true } },
  shiftTemplate: { select: { id: true, name: true, color: true } },
} satisfies Prisma.StaffShiftAssignmentInclude;

async function loadNeighborAssignments(
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
  center: Date,
  excludeId?: string,
) {
  const from = new Date(center);
  from.setDate(from.getDate() - 35);
  const to = new Date(center);
  to.setDate(to.getDate() + 35);
  return tx.staffShiftAssignment.findMany({
    where: {
      organizationId,
      userId,
      id: excludeId ? { not: excludeId } : undefined,
      startsAt: { gte: from, lte: to },
    },
  });
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const rotaPeriodId = request.nextUrl.searchParams.get('rotaPeriodId')?.trim();
    const userId = request.nextUrl.searchParams.get('userId')?.trim();
    if (!rotaPeriodId) {
      return NextResponse.json({ error: 'rotaPeriodId query is required' }, { status: 400 });
    }

    const list = await ctx.run((tx) =>
      tx.staffShiftAssignment.findMany({
        where: ctx.where({ staffRotaPeriodId: rotaPeriodId, ...(userId ? { userId } : {}) }),
        orderBy: [{ workDate: 'asc' }, { startsAt: 'asc' }],
        include: ASSIGNMENT_INCLUDE,
      }),
    );
    return NextResponse.json(list);
  });
}

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
    const userId = String(body.userId || '').trim();
    const workDate = String(body.workDate || '').trim();
    if (!rotaPeriodId || !userId || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
      return NextResponse.json(
        { error: 'rotaPeriodId, userId, and workDate (YYYY-MM-DD) are required' },
        { status: 400 },
      );
    }

    const notes = body.notes != null ? String(body.notes).trim() || null : null;
    const breakProvided = body.breakMinutes != null;
    let breakMinutes = breakProvided ? parseInt(String(body.breakMinutes), 10) : 0;
    if (!Number.isFinite(breakMinutes) || breakMinutes < 0) breakMinutes = 0;
    const force = body.force === true;

    const result = await ctx.run(async (tx) => {
      const rota = await tx.staffRotaPeriod.findFirst({ where: ctx.where({ id: rotaPeriodId }) });
      if (!rota) return { status: 404 as const, error: 'Rota period not found' };
      if (rota.status === RotaPeriodStatus.published) {
        return { status: 409 as const, error: 'This period is published. Unpublish it to edit assignments.' };
      }

      const subjects = await listOrgStaffUsers(tx, ctx.organizationId);
      const subject = subjects.find((s) => s.id === userId);
      if (!subject) return { status: 404 as const, error: 'Staff member not found in this organization' };

      try {
        assertWorkDateInRota(workDate, rota.startDate, rota.endDate);
      } catch (e) {
        return { status: 400 as const, error: e instanceof Error ? e.message : 'Invalid work date' };
      }

      let template = null;
      const shiftTemplateId = body.shiftTemplateId != null ? String(body.shiftTemplateId).trim() : '';
      if (shiftTemplateId) {
        template = await tx.staffShiftTemplate.findFirst({
          where: ctx.where({ id: shiftTemplateId, isActive: true }),
        });
        if (!template) return { status: 400 as const, error: 'Shift template not found' };
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
      if ('error' in resolved) return { status: 400 as const, error: resolved.error };

      const policy = resolveStaffRotaPolicy({
        staffUserType: subject.staffUserType,
        department: subject.department,
      });
      const neighbors = await loadNeighborAssignments(tx, ctx.organizationId, userId, resolved.startsAt);
      const conflicts = conflictsForProposed(
        toShiftWindows(neighbors),
        { id: `proposed-${Date.now()}`, startsAt: resolved.startsAt, endsAt: resolved.endsAt, breakMinutes: resolved.breakMinutes },
        userId,
        policy,
      );
      const blocking = conflicts.filter(isBlockingConflict);
      if (blocking.length && !force) {
        return { status: 409 as const, conflicts: blocking, policy };
      }

      const created = await tx.staffShiftAssignment.create({
        data: {
          organizationId: ctx.organizationId,
          staffRotaPeriodId: rotaPeriodId,
          userId,
          staffShiftTemplateId: resolved.templateId,
          workDate: new Date(`${workDate}T12:00:00`),
          startsAt: resolved.startsAt,
          endsAt: resolved.endsAt,
          breakMinutes: resolved.breakMinutes,
          notes,
        },
        include: ASSIGNMENT_INCLUDE,
      });
      return { status: 201 as const, created, warnings: conflicts.filter((c) => !isBlockingConflict(c)) };
    });

    if ('conflicts' in result) {
      return NextResponse.json({ error: 'Rota conflict', conflicts: result.conflicts, policy: result.policy }, { status: 409 });
    }
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await ctx.audit({
      action: 'staff_rota.assignment.create',
      entityType: 'StaffShiftAssignment',
      entityId: result.created.id,
      route: request.nextUrl.pathname,
      metadata: { userId, workDate, rotaPeriodId },
    });

    return NextResponse.json({ ...result.created, warnings: result.warnings }, { status: 201 });
  });
}
