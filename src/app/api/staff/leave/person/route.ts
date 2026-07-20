import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/staff-api-auth';
import { canViewerApproveLeaveForUser } from '@/lib/staff-leave-team';
import { syncStaffLeaveUsedDaysForUsersYear } from '@/lib/staff-leave-balance';
import { buildStaffLeaveReport, personToDetail } from '@/lib/leave/leave-report-builders';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

/** GET ?userId=&year= — full leave detail for one internal staff member. */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const sp = request.nextUrl.searchParams;
    const year = parseInt(sp.get('year') || String(new Date().getFullYear()), 10);
    const targetUserId = sp.get('userId')?.trim() || ctx.staff.id;

    if (targetUserId !== ctx.staff.id && !isAdmin(ctx.staff)) {
      const allowed = await canViewerApproveLeaveForUser(ctx.staff, targetUserId);
      if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const dataset = await ctx.run(async (tx) => {
      await syncStaffLeaveUsedDaysForUsersYear(tx, [targetUserId], year);
      return buildStaffLeaveReport(tx, { organizationId: ctx.organizationId, memberIds: [targetUserId], year });
    });

    const person = dataset.people.find((p) => p.id === targetUserId);
    if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(personToDetail(person, dataset));
  });
}
