import { NextRequest, NextResponse } from 'next/server';
import { detectConflictsForEmployee, resolveRotaPolicy } from '@/lib/rota/conflict-rules';
import { toShiftWindows } from '@/lib/rota/assignment-helpers';
import { withTenant } from '@/lib/tenant-api';

/**
 * GET /api/rota/conflicts?rotaPeriodId=... — all employee conflicts in a rota period.
 * Optional: employeeId=..., from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const rotaPeriodId = request.nextUrl.searchParams.get('rotaPeriodId')?.trim();
    const employeeId = request.nextUrl.searchParams.get('employeeId')?.trim() || undefined;
    const fromStr = request.nextUrl.searchParams.get('from')?.trim();
    const toStr = request.nextUrl.searchParams.get('to')?.trim();

    if (!rotaPeriodId) {
      return NextResponse.json({ error: 'rotaPeriodId query is required' }, { status: 400 });
    }

    const { rota, rows } = await ctx.run(async (tx) => {
      const period = await tx.rotaPeriod.findFirst({ where: ctx.where({ id: rotaPeriodId }) });
      if (!period) return { rota: null, rows: [] as Awaited<ReturnType<typeof tx.shiftAssignment.findMany>> };

      const where2: {
        rotaPeriodId: string;
        employeeId?: string;
        workDate?: { gte: Date; lte: Date };
      } = { rotaPeriodId };
      if (employeeId) where2.employeeId = employeeId;
      if (fromStr && /^\d{4}-\d{2}-\d{2}$/.test(fromStr) && toStr && /^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
        where2.workDate = {
          gte: new Date(fromStr + 'T00:00:00'),
          lte: new Date(toStr + 'T23:59:59.999'),
        };
      }

      const assignmentRows = await tx.shiftAssignment.findMany({
        where: { ...ctx.where(), ...where2 },
        include: { employee: { select: { id: true, jobTitle: true } } },
      });

      return { rota: period, rows: assignmentRows };
    });

    if (!rota) return NextResponse.json({ error: 'Rota period not found' }, { status: 404 });

    const byEmp = new Map<string, { shifts: typeof rows; jobTitle: string | null }>();
    for (const a of rows) {
      const eid = a.employeeId;
      if (!byEmp.has(eid)) {
        byEmp.set(eid, { shifts: [], jobTitle: a.employee?.jobTitle ?? null });
      }
      byEmp.get(eid)!.shifts.push(a);
    }

    const conflicts: ReturnType<typeof detectConflictsForEmployee> = [];
    for (const [eid, { shifts, jobTitle }] of byEmp) {
      const policy = resolveRotaPolicy({ employeeJobTitle: jobTitle, staffUserType: ctx.staff.staffUserType });
      conflicts.push(
        ...detectConflictsForEmployee(
          eid,
          toShiftWindows(
            shifts.map((s) => ({
              id: s.id,
              startsAt: s.startsAt,
              endsAt: s.endsAt,
              breakMinutes: s.breakMinutes,
            })),
          ),
          policy,
        ),
      );
    }

    return NextResponse.json({ rotaPeriodId, conflicts, defaultPolicy: resolveRotaPolicy() });
  });
}
