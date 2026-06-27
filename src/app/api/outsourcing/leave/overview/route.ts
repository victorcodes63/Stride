import { NextRequest, NextResponse } from 'next/server';

import { buildEmployeeLeaveOverview } from '@/lib/leave/employee-overview';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { prisma } from '@/lib/prisma';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year')
      ? parseInt(searchParams.get('year')!, 10)
      : new Date().getFullYear();
    const month = searchParams.get('month')
      ? parseInt(searchParams.get('month')!, 10)
      : new Date().getMonth() + 1;

    if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Valid year and month (1-12) required' }, { status: 400 });
    }

      const clientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      searchParams.get('clientId'),
      request,
      ctx.organizationId,
    );

    const overview = await buildEmployeeLeaveOverview(prisma, { clientId, year, month });
    return NextResponse.json(overview);
  });
}
