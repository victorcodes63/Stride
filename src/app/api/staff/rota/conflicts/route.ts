import { NextRequest, NextResponse } from 'next/server';
import {
  detectConflictsForUser,
  detectCoverageGaps,
  resolveStaffRotaPolicy,
  DEFAULT_STAFF_ROTA_POLICY,
  type StaffRotaConflict,
} from '@/lib/staff-rota/policy-engine';
import { toShiftWindows, dateKeyLocal } from '@/lib/staff-rota/assignment-helpers';
import { listOrgStaffUsers } from '@/lib/staff-time-attendance/staff-directory';
import { withTenant } from '@/lib/tenant-api';

/**
 * GET /api/staff/rota/conflicts?rotaPeriodId=...
 * Full conflict + coverage scan for a staff rota period.
 * Optional: userId, from=YYYY-MM-DD & to=YYYY-MM-DD, minPerDay (coverage target).
 */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const rotaPeriodId = request.nextUrl.searchParams.get('rotaPeriodId')?.trim();
    const userId = request.nextUrl.searchParams.get('userId')?.trim() || undefined;
    const fromStr = request.nextUrl.searchParams.get('from')?.trim();
    const toStr = request.nextUrl.searchParams.get('to')?.trim();
    const minPerDayRaw = request.nextUrl.searchParams.get('minPerDay')?.trim();
    const minPerDay = minPerDayRaw ? Math.max(0, parseInt(minPerDayRaw, 10) || 0) : 0;

    if (!rotaPeriodId) {
      return NextResponse.json({ error: 'rotaPeriodId query is required' }, { status: 400 });
    }

    const scan = await ctx.run(async (tx) => {
      const period = await tx.staffRotaPeriod.findFirst({ where: ctx.where({ id: rotaPeriodId }) });
      if (!period) return null;

      const where: {
        staffRotaPeriodId: string;
        userId?: string;
        workDate?: { gte: Date; lte: Date };
      } = { staffRotaPeriodId: rotaPeriodId };
      if (userId) where.userId = userId;
      if (fromStr && /^\d{4}-\d{2}-\d{2}$/.test(fromStr) && toStr && /^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
        where.workDate = { gte: new Date(`${fromStr}T00:00:00`), lte: new Date(`${toStr}T23:59:59.999`) };
      }

      const rows = await tx.staffShiftAssignment.findMany({
        where: ctx.where(where),
        select: { id: true, userId: true, startsAt: true, endsAt: true, breakMinutes: true, workDate: true },
      });
      const subjects = await listOrgStaffUsers(tx, ctx.organizationId);
      return { period, rows, subjects };
    });

    if (!scan) return NextResponse.json({ error: 'Rota period not found' }, { status: 404 });

    const subjectById = new Map(scan.subjects.map((s) => [s.id, s]));

    // Per-person conflicts.
    const byUser = new Map<string, typeof scan.rows>();
    for (const a of scan.rows) {
      const arr = byUser.get(a.userId) ?? [];
      arr.push(a);
      byUser.set(a.userId, arr);
    }
    const conflicts: StaffRotaConflict[] = [];
    for (const [uid, shifts] of byUser) {
      const subject = subjectById.get(uid);
      const policy = resolveStaffRotaPolicy({ staffUserType: subject?.staffUserType, department: subject?.department });
      conflicts.push(...detectConflictsForUser(uid, toShiftWindows(shifts), policy));
    }

    // Coverage gaps across the period (or the requested window).
    if (minPerDay > 0) {
      const start = scan.period.startDate;
      const end = scan.period.endDate;
      const dayKeys: string[] = [];
      const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      while (cursor.getTime() <= last.getTime()) {
        dayKeys.push(dateKeyLocal(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      const byDay = new Map<string, { userIds: Set<string>; assignmentIds: string[] }>();
      for (const a of scan.rows) {
        const key = dateKeyLocal(a.workDate);
        const entry = byDay.get(key) ?? { userIds: new Set<string>(), assignmentIds: [] };
        entry.userIds.add(a.userId);
        entry.assignmentIds.push(a.id);
        byDay.set(key, entry);
      }
      conflicts.push(...detectCoverageGaps(dayKeys, byDay, minPerDay));
    }

    return NextResponse.json({
      rotaPeriodId,
      conflicts,
      counts: {
        errors: conflicts.filter((c) => c.severity === 'error').length,
        warnings: conflicts.filter((c) => c.severity === 'warning').length,
      },
      defaultPolicy: {
        minRestHours: DEFAULT_STAFF_ROTA_POLICY.minRestMs / 3_600_000,
        maxWeekWorkHours: DEFAULT_STAFF_ROTA_POLICY.maxWeekWorkMs / 3_600_000,
      },
    });
  });
}
