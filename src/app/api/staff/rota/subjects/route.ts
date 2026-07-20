import { NextRequest, NextResponse } from 'next/server';
import { listOrgStaffUsers } from '@/lib/staff-time-attendance/staff-directory';
import { resolveStaffRotaPolicy } from '@/lib/staff-rota/policy-engine';
import { withTenant } from '@/lib/tenant-api';

/**
 * GET /api/staff/rota/subjects
 * List internal staff (tenant-own) Users who can be scheduled, with their
 * resolved rota policy label so the planner can surface per-person limits.
 */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const search = request.nextUrl.searchParams.get('search')?.trim() || undefined;
    const department = request.nextUrl.searchParams.get('department')?.trim() || undefined;

    const users = await ctx.run((tx) =>
      listOrgStaffUsers(tx, ctx.organizationId, { search, department }),
    );

    const subjects = users.map((u) => {
      const policy = resolveStaffRotaPolicy({ staffUserType: u.staffUserType, department: u.department });
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        staffUserType: u.staffUserType,
        department: u.department,
        role: u.role,
        policy: {
          key: policy.key,
          label: policy.label,
          minRestHours: policy.minRestMs / 3_600_000,
          maxWeekWorkHours: policy.maxWeekWorkMs / 3_600_000,
        },
      };
    });

    return NextResponse.json(subjects);
  });
}
