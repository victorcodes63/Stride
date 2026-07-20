import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { listOrgStaffUsers } from '@/lib/staff-time-attendance/staff-directory';

/**
 * GET /api/staff/attendance/subjects
 * Active internal staff users (subjects for manual overrides, policy assignment,
 * and filters) plus the distinct department list.
 */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const search = request.nextUrl.searchParams.get('search')?.trim() || undefined;
    const department = request.nextUrl.searchParams.get('department')?.trim() || undefined;

    const users = await ctx.run((tx) =>
      listOrgStaffUsers(tx, ctx.organizationId, { search, department }),
    );

    const departments = Array.from(
      new Set(users.map((u) => u.department).filter((d): d is string => Boolean(d))),
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ users, departments });
  });
}
