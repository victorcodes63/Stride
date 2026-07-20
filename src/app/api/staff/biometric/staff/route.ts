import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { listOrgStaffUsers } from '@/lib/staff-time-attendance/staff-directory';

/** GET /api/staff/biometric/staff — active internal staff for subject mapping. */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const search = request.nextUrl.searchParams.get('search')?.trim() || undefined;

    const users = await ctx.run((tx) => listOrgStaffUsers(tx, ctx.organizationId, { search }));

    return NextResponse.json({
      staff: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        department: u.department,
        staffUserType: u.staffUserType,
      })),
    });
  });
}
