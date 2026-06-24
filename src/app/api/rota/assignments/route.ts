import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canWriteRota } from '@/lib/rota/api-auth';
import { resolveRotaPolicy } from '@/lib/rota/conflict-rules';
import { instantsFromTemplateMinutes } from '@/lib/rota/shift-instants';
import { toShiftWindows, assertWorkDateInRota, conflictsForProposed } from '@/lib/rota/assignment-helpers';

function parseHmToMinutes(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = parseInt(m[1]!, 10);
  const min = parseInt(m[2]!, 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

async function loadNeighborAssignments(employeeId: string, center: Date, excludeId?: string) {
  const from = new Date(center);
  from.setDate(from.getDate() - 35);
  const to = new Date(center);
  to.setDate(to.getDate() + 35);
  return prisma.shiftAssignment.findMany({
    where: {
      employeeId,
      id: excludeId ? { not: excludeId } : undefined,
      startsAt: { gte: from, lte: to },
    },
  });
}

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rotaPeriodId = request.nextUrl.searchParams.get('rotaPeriodId')?.trim();
  const employeeId = request.nextUrl.searchParams.get('employeeId')?.trim();
  if (!rotaPeriodId) {
    return NextResponse.json({ error: 'rotaPeriodId query is required' }, { status: 400 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const where: { rotaPeriodId: string; employeeId?: string } = { rotaPeriodId };
  if (employeeId) where.employeeId = employeeId;
  const list = await prisma.shiftAssignment.findMany({
    where,
    orderBy: { workDate: 'asc' },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
      shiftTemplate: { select: { id: true, name: true, color: true } },
    },
  });
  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canWriteRota(user)) {
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

  const rota = await prisma.rotaPeriod.findUnique({ where: { id: rotaPeriodId } });
  if (!rota) return NextResponse.json({ error: 'Rota period not found' }, { status: 404 });
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  if (emp.outsourcingClientId !== rota.outsourcingClientId) {
    return NextResponse.json(
      { error: 'Employee does not belong to the same outsourcing client as the rota period' },
      { status: 400 },
    );
  }

  try {
    assertWorkDateInRota(workDateStr, rota.startDate, rota.endDate);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid work date' }, { status: 400 });
  }

  const notes = body.notes != null ? String(body.notes) : null;
  let breakMinutes = body.breakMinutes != null ? parseInt(String(body.breakMinutes), 10) : 0;
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0) breakMinutes = 0;

  const shiftTemplateId = body.shiftTemplateId != null ? String(body.shiftTemplateId).trim() : '';
  const customStartM =
    body.startMinutes != null ? parseInt(String(body.startMinutes), 10) : NaN;
  const customEndM = body.endMinutes != null ? parseInt(String(body.endMinutes), 10) : NaN;
  const timeStart = body.startTime != null ? parseHmToMinutes(String(body.startTime)) : null;
  const timeEnd = body.endTime != null ? parseHmToMinutes(String(body.endTime)) : null;
  const fromIsoStart = body.startsAt != null ? new Date(String(body.startsAt)) : null;
  const fromIsoEnd = body.endsAt != null ? new Date(String(body.endsAt)) : null;

  let startsAt: Date;
  let endsAt: Date;
  let templateId: string | null = null;

  if (shiftTemplateId) {
    const t = await prisma.shiftTemplate.findFirst({
      where: { id: shiftTemplateId, outsourcingClientId: rota.outsourcingClientId, isActive: true },
    });
    if (!t) return NextResponse.json({ error: 'Shift template not found for this client' }, { status: 400 });
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
  } else if (fromIsoStart && fromIsoEnd && !Number.isNaN(fromIsoStart.getTime()) && !Number.isNaN(fromIsoEnd.getTime())) {
    startsAt = fromIsoStart;
    endsAt = fromIsoEnd;
  } else {
    return NextResponse.json(
      {
        error: 'Provide shiftTemplateId, or startMinutes+endMinutes, or startTime+endTime (HH:mm), or startsAt+endsAt (ISO)',
      },
      { status: 400 },
    );
  }

  if (endsAt.getTime() <= startsAt.getTime()) {
    return NextResponse.json({ error: 'endsAt must be after startsAt' }, { status: 400 });
  }

  const policy = resolveRotaPolicy({ employeeJobTitle: emp.jobTitle });
  const tempId = `proposed-${Date.now()}`;
  const neighbors = await loadNeighborAssignments(employeeId, startsAt);
  const c = conflictsForProposed(
    toShiftWindows(neighbors),
    { id: tempId, startsAt, endsAt, breakMinutes },
    employeeId,
    policy,
  );
  if (c.length) {
    return NextResponse.json({ error: 'Rota conflict', conflicts: c, policy }, { status: 409 });
  }

  const created = await prisma.shiftAssignment.create({
    data: {
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
  return NextResponse.json(created, { status: 201 });
}
