import { NextRequest, NextResponse } from 'next/server';
import { canAccessCompanyTasks } from '@/lib/staff-api-auth';
import { buildStaffTaskWorkload } from '@/lib/staff-task-workload';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessCompanyTasks(ctx.staff)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const workload = await ctx.run((tx) =>
      buildStaffTaskWorkload(ctx.organizationId, tx),
    );
    return NextResponse.json(workload);
  });
}
