import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { detectConflictsForEmployee, resolveRotaPolicy } from '@/lib/rota/conflict-rules';
import { toShiftWindows } from '@/lib/rota/assignment-helpers';

/**
 * GET /api/rota/conflicts?rotaPeriodId=... — all employee conflicts in a rota period.
 * Optional: employeeId=..., from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  const rota = await prisma.rotaPeriod.findUnique({ where: { id: rotaPeriodId } });
  if (!rota) return NextResponse.json({ error: 'Rota period not found' }, { status: 404 });

  const where2: { rotaPeriodId: string; employeeId?: string; workDate?: { gte: Date; lte: Date } } = { rotaPeriodId };
  if (employeeId) where2.employeeId = employeeId;
  if (fromStr && /^\d{4}-\d{2}-\d{2}$/.test(fromStr) && toStr && /^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
    where2.workDate = {
      gte: new Date(fromStr + 'T00:00:00'),
      lte: new Date(toStr + 'T23:59:59.999'),
    };
  }

  const rows = await prisma.shiftAssignment.findMany({
    where: where2,
    include: { employee: { select: { id: true, jobTitle: true } } },
  });

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
    const policy = resolveRotaPolicy({ employeeJobTitle: jobTitle, staffUserType: user.staffUserType });
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
}
