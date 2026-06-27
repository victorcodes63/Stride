import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { canWriteRota } from '@/lib/rota/api-auth';
import { resolveRotaPolicy } from '@/lib/rota/conflict-rules';
import { instantsFromTemplateMinutes } from '@/lib/rota/shift-instants';
import { toShiftWindows, assertWorkDateInRota, conflictsForProposed } from '@/lib/rota/assignment-helpers';
import { withTenant } from '@/lib/tenant-api';

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
  excludeId?: string,
) {
  const from = new Date(center);
  from.setDate(from.getDate() - 35);
  const to = new Date(center);
  to.setDate(to.getDate() + 35);
  return tx.shiftAssignment.findMany({
    where: {
      employeeId,
      id: excludeId ? { not: excludeId } : undefined,
      startsAt: { gte: from, lte: to },
    },
  });
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const rotaPeriodId = request.nextUrl.searchParams.get('rotaPeriodId')?.trim();
    const employeeId = request.nextUrl.searchParams.get('employeeId')?.trim();
    if (!rotaPeriodId) {
      return NextResponse.json({ error: 'rotaPeriodId query is required' }, { status: 400 });
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const list = await ctx.run((tx) => {
      const where: { rotaPeriodId: string; employeeId?: string } = { rotaPeriodId };
      if (employeeId) where.employeeId = employeeId;
      return tx.shiftAssignment.findMany({
        where: { ...ctx.where(), ...where },
        orderBy: { workDate: 'asc' },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
          shiftTemplate: { select: { id: true, name: true, color: true } },
        },
      });
    });
    return NextResponse.json(list);
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canWriteRota(ctx.staff)) {
      return NextResponse.json({ error: 'Viewers cannot create rota data' }, { status: 403 });
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
    const employeeId = String(body.employeeId || '').trim();
    const workDateStr = String(body.workDate || '').trim();
    if (!rotaPeriodId || !employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(workDateStr)) {
      return NextResponse.json(
        { error: 'rotaPeriodId, employeeId, and workDate (YYYY-MM-DD) are required' },
        { status: 400 },
      );
    }

    const notes = body.notes != null ? String(body.notes) : null;
    let breakMinutes = body.breakMinutes != null ? parseInt(String(body.breakMinutes), 10) : 0;
    if (!Number.isFinite(breakMinutes) || breakMinutes < 0) breakMinutes = 0;

    const shiftTemplateId = body.shiftTemplateId != null ? String(body.shiftTemplateId).trim() : '';
    const customStartM = body.startMinutes != null ? parseInt(String(body.startMinutes), 10) : NaN;
    const customEndM = body.endMinutes != null ? parseInt(String(body.endMinutes), 10) : NaN;
    const timeStart = body.startTime != null ? parseHmToMinutes(String(body.startTime)) : null;
    const timeEnd = body.endTime != null ? parseHmToMinutes(String(body.endTime)) : null;
    const fromIsoStart = body.startsAt != null ? new Date(String(body.startsAt)) : null;
    const fromIsoEnd = body.endsAt != null ? new Date(String(body.endsAt)) : null;

    const result = await ctx.run(async (tx) => {
      const rota = await tx.rotaPeriod.findFirst({ where: ctx.where({ id: rotaPeriodId }) });
      if (!rota) return { error: 'Rota period not found' as const };
      const emp = await tx.employee.findFirst({ where: ctx.where({ id: employeeId }) });
      if (!emp) return { error: 'Employee not found' as const };
      if (emp.outsourcingClientId !== rota.outsourcingClientId) {
        return { error: 'Employee does not belong to the same outsourcing client as the rota period' as const };
      }

      try {
        assertWorkDateInRota(workDateStr, rota.startDate, rota.endDate);
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Invalid work date' };
      }

      let startsAt: Date;
      let endsAt: Date;
      let templateId: string | null = null;

      if (shiftTemplateId) {
        const t = await tx.shiftTemplate.findFirst({
          where: ctx.where({ id: shiftTemplateId, outsourcingClientId: rota.outsourcingClientId, isActive: true }),
        });
        if (!t) return { error: 'Shift template not found for this client' as const };
        templateId = t.id;
        const inst = instantsFromTemplateMinutes(workDateStr, t.startMinutes, t.endMinutes);
        startsAt = inst.startsAt;
        endsAt = inst.endsAt;
        if (!body.breakMinutes && t.breakMinutes) breakMinutes = t.breakMinutes;
      } else if (Number.isFinite(customStartM) && Number.isFinite(customEndM)) {
        const inst = instantsFromTemplateMinutes(workDateStr, customStartM, customEndM);
        startsAt = inst.startsAt;
        endsAt = inst.endsAt;
      } else if (timeStart != null && timeEnd != null) {
        const inst = instantsFromTemplateMinutes(workDateStr, timeStart, timeEnd);
        startsAt = inst.startsAt;
        endsAt = inst.endsAt;
      } else if (
        fromIsoStart &&
        fromIsoEnd &&
        !Number.isNaN(fromIsoStart.getTime()) &&
        !Number.isNaN(fromIsoEnd.getTime())
      ) {
        startsAt = fromIsoStart;
        endsAt = fromIsoEnd;
      } else {
        return {
          error:
            'Provide shiftTemplateId, or startMinutes+endMinutes, or startTime+endTime (HH:mm), or startsAt+endsAt (ISO)',
        };
      }

      if (endsAt.getTime() <= startsAt.getTime()) {
        return { error: 'endsAt must be after startsAt' as const };
      }

      const policy = resolveRotaPolicy({ employeeJobTitle: emp.jobTitle });
      const tempId = `proposed-${Date.now()}`;
      const neighbors = await loadNeighborAssignments(tx, employeeId, startsAt);
      const c = conflictsForProposed(
        toShiftWindows(neighbors),
        { id: tempId, startsAt, endsAt, breakMinutes },
        employeeId,
        policy,
      );
      if (c.length) {
        return { conflict: true as const, conflicts: c, policy };
      }

      return tx.shiftAssignment.create({
        data: {
          organizationId: ctx.organizationId,
          rotaPeriodId,
          employeeId,
          shiftTemplateId: templateId,
          workDate: new Date(workDateStr + 'T12:00:00'),
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

    if ('conflict' in result && result.conflict) {
      return NextResponse.json(
        { error: 'Rota conflict', conflicts: result.conflicts, policy: result.policy },
        { status: 409 },
      );
    }
    if ('error' in result && typeof result.error === 'string') {
      const status =
        result.error === 'Rota period not found' || result.error === 'Employee not found' ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json(result, { status: 201 });
  });
}
