import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';

/**
 * Workforce leave counts for the primary outsourcing client (same scope as /outsourcing/employees).
 */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    try {
      const requestedClientId = request.nextUrl.searchParams.get('clientId') || undefined;
      const clientId = await ctx.run((tx) =>
        resolvePrimaryWorkspaceClientId(tx, requestedClientId, request, ctx.organizationId),
      );

      const startToday = new Date();
      startToday.setHours(0, 0, 0, 0);
      const endToday = new Date();
      endToday.setHours(23, 59, 59, 999);

      const [pendingApprovals, onLeaveToday] = await ctx.run((tx) =>
        Promise.all([
          tx.leaveApplication.count({
            where: {
              status: 'pending',
              employee: {
                outsourcingClientId: clientId,
                client: { organizationId: ctx.organizationId },
              },
            },
          }),
          tx.leaveApplication.count({
            where: {
              status: 'approved',
              employee: {
                outsourcingClientId: clientId,
                client: { organizationId: ctx.organizationId },
              },
              startDate: { lte: endToday },
              endDate: { gte: startToday },
            },
          }),
        ]),
      );

      return NextResponse.json({ pendingApprovals, onLeaveToday });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/outsourcing/overview-stats',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load overview stats.' }, { status: 500 });
    }
  });
}
