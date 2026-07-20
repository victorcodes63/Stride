import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { listOrgStaffUsers } from '@/lib/staff-time-attendance/staff-directory';
import { todayWorkDate, toWorkDateUtc } from '@/lib/staff-time-attendance/attendance-serialize';

export type LiveBoardEntry = {
  userId: string;
  name: string;
  email: string;
  department: string | null;
  firstInAt: string | null;
  lastOutAt: string | null;
  minutesWorked: number;
  lateMinutes: number;
  /** in | completed | missing_check_out | absent */
  state: 'in' | 'completed' | 'missing_check_out' | 'absent';
};

/**
 * GET /api/staff/attendance/today
 * Live "who's in / late / missing clock-out" board for the current work date,
 * computed from today's day summaries + the active staff roster.
 */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const workDate = todayWorkDate();

    const board = await ctx.run(async (tx) => {
      const users = await listOrgStaffUsers(tx, ctx.organizationId);
      if (users.length === 0) return [];

      const summaries = await tx.staffAttendanceDaySummary.findMany({
        where: ctx.where({ userId: { in: users.map((u) => u.id) }, workDate: toWorkDateUtc(workDate) }),
        select: { userId: true, firstInAt: true, lastOutAt: true, minutesWorked: true, lateMinutes: true },
      });
      const byUser = new Map(summaries.map((s) => [s.userId, s]));

      return users.map<LiveBoardEntry>((u) => {
        const s = byUser.get(u.id);
        let state: LiveBoardEntry['state'] = 'absent';
        if (s?.firstInAt && s.lastOutAt) state = 'completed';
        else if (s?.firstInAt && !s.lastOutAt) state = 'missing_check_out';
        // "in" = clocked in within the last 20h and not yet out (recently active)
        if (state === 'missing_check_out' && s?.firstInAt) {
          const hoursSinceIn = (Date.now() - new Date(s.firstInAt).getTime()) / 3_600_000;
          if (hoursSinceIn <= 16) state = 'in';
        }
        return {
          userId: u.id,
          name: u.name,
          email: u.email,
          department: u.department,
          firstInAt: s?.firstInAt ? new Date(s.firstInAt).toISOString() : null,
          lastOutAt: s?.lastOutAt ? new Date(s.lastOutAt).toISOString() : null,
          minutesWorked: s?.minutesWorked ?? 0,
          lateMinutes: s?.lateMinutes ?? 0,
          state,
        };
      });
    });

    const counts = {
      in: board.filter((b) => b.state === 'in').length,
      missingCheckOut: board.filter((b) => b.state === 'missing_check_out').length,
      late: board.filter((b) => b.lateMinutes > 0).length,
      completed: board.filter((b) => b.state === 'completed').length,
      absent: board.filter((b) => b.state === 'absent').length,
    };

    return NextResponse.json({ workDate, board, counts });
  });
}
