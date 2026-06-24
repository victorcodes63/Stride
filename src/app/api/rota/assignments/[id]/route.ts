import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canWriteRota } from '@/lib/rota/api-auth';
import { resolveRotaPolicy } from '@/lib/rota/conflict-rules';
import { instantsFromTemplateMinutes } from '@/lib/rota/shift-instants';
import { toShiftWindows, assertWorkDateInRota, conflictsForProposed } from '@/lib/rota/assignment-helpers';
import { sendNotification } from '@/lib/notifications';

type P = { params: Promise<{ id: string }> };

function parseHmToMinutes(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = parseInt(m[1]!, 10);
  const min = parseInt(m[2]!, 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

async function loadNeighborAssignments(employeeId: string, center: Date, excludeId: string) {
  const from = new Date(center);
  from.setDate(from.getDate() - 35);
  const to = new Date(center);
  to.setDate(to.getDate() + 35);
  return prisma.shiftAssignment.findMany({
    where: {
      employeeId,
      id: { not: excludeId },
      startsAt: { gte: from, lte: to },
    },
  });
}

export async function GET(request: NextRequest, { params }: P) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  const a = await prisma.shiftAssignment.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, jobTitle: true } },
      shiftTemplate: { select: { id: true, name: true, startMinutes: true, endMinutes: true } },
      rotaPeriod: { select: { id: true, name: true, startDate: true, endDate: true, status: true } },
    },
  });
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(a);
}

export async function PATCH(request: NextRequest, { params }: P) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canWriteRota(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  const { id } = await params;
  const existing = await prisma.shiftAssignment.findUnique({ where: { id }, include: { employee: true, rotaPeriod: true } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

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
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid work date' }, { status: 400 });
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
      const t = await prisma.shiftTemplate.findFirst({
        where: {
          id: shiftTemplateId,
          outsourcingClientId: existing.rotaPeriod.outsourcingClientId,
          isActive: true,
        },
      });
      if (!t) {
        return NextResponse.json({ error: 'Shift template not found for this client' }, { status: 400 });
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
    } else if (fromIsoStart && fromIsoEnd && !Number.isNaN(fromIsoStart.getTime()) && !Number.isNaN(fromIsoEnd.getTime())) {
      startsAt = fromIsoStart;
      endsAt = fromIsoEnd;
      templateId = null;
    } else if (workDate && body.shiftTemplateId === undefined) {
      if (existing.shiftTemplateId) {
        const t = await prisma.shiftTemplate.findUnique({ where: { id: existing.shiftTemplateId } });
        if (t) {
          const inst = instantsFromTemplateMinutes(wDate, t.startMinutes, t.endMinutes);
          startsAt = inst.startsAt;
          endsAt = inst.endsAt;
        }
      }
    }

    if (endsAt.getTime() <= startsAt.getTime()) {
      return NextResponse.json({ error: 'endsAt must be after startsAt' }, { status: 400 });
    }
  }

  const workDateD = new Date(wDate + 'T12:00:00');
  const policy = resolveRotaPolicy({ employeeJobTitle: existing.employee.jobTitle });
  const tempId = `proposed-${id}`;
  const neighbors = await loadNeighborAssignments(existing.employeeId, startsAt, id);
  const c = conflictsForProposed(
    toShiftWindows(neighbors),
    { id: tempId, startsAt, endsAt, breakMinutes },
    existing.employeeId,
    policy,
  );
  if (c.length) {
    return NextResponse.json({ error: 'Rota conflict', conflicts: c, policy }, { status: 409 });
  }

  const updated = await prisma.shiftAssignment.update({
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
  try {
    const essIds = updated.employeeId
      ? (
          await prisma.employee.findUnique({
            where: { id: updated.employeeId },
            select: { essPortalUsers: { where: { isActive: true }, select: { id: true } } },
          })
        )?.essPortalUsers.map((u) => u.id) || []
      : [];
    if (essIds.length > 0) {
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
}

export async function DELETE(request: NextRequest, { params }: P) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canWriteRota(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  const { id } = await params;
  const existing = await prisma.shiftAssignment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const employee = await prisma.employee.findUnique({
    where: { id: existing.employeeId },
    select: { essPortalUsers: { where: { isActive: true }, select: { id: true } } },
  });
  await prisma.shiftAssignment.delete({ where: { id } });
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
}
