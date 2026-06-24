import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { unauthorizedResponse } from '@/lib/demo-route-access';

/**
 * Workforce leave counts for the primary outsourcing client (same scope as /outsourcing/employees).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireStaffUser(request);
    if (!user) return unauthorizedResponse();
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const requestedClientId = request.nextUrl.searchParams.get('clientId') || undefined;
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);

    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date();
    endToday.setHours(23, 59, 59, 999);

    const [pendingApprovals, onLeaveToday] = await Promise.all([
      prisma.leaveApplication.count({
        where: {
          status: 'pending',
          employee: { outsourcingClientId: clientId },
        },
      }),
      prisma.leaveApplication.count({
        where: {
          status: 'approved',
          employee: { outsourcingClientId: clientId },
          startDate: { lte: endToday },
          endDate: { gte: startToday },
        },
      }),
    ]);

    return NextResponse.json({ pendingApprovals, onLeaveToday });
  } catch (e) {
    console.error('[outsourcing/overview-stats]', e);
    return NextResponse.json({ error: 'Failed to load overview stats.' }, { status: 500 });
  }
}
