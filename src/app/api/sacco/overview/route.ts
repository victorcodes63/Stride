import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessSacco, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { serializeDividendRun } from '@/lib/sacco/serialize';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessSacco(ctx.staff)) {
      return forbiddenResponse('SACCO access is restricted to finance and admin users.');
    }

    try {
      const { memberCount, activeMembers, accounts, latestRun } = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );

        return Promise.all([
          tx.saccoMember.count({ where: { ...ctx.where(), outsourcingClientId: clientId } }),
          tx.saccoMember.count({
            where: { ...ctx.where(), outsourcingClientId: clientId, status: 'active' },
          }),
          tx.saccoAccount.findMany({
            where: { ...ctx.where(), member: { outsourcingClientId: clientId } },
            select: { accountType: true, balance: true },
          }),
          tx.saccoDividendRun.findFirst({
            where: { ...ctx.where(), outsourcingClientId: clientId },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { lines: true } } },
          }),
        ]);
      });

      const totals = { shares: 0, bosa: 0, fosa: 0 };
      for (const row of accounts) {
        totals[row.accountType] += Number(row.balance);
      }

      return NextResponse.json({
        summary: {
          memberCount,
          activeMembers,
          sharesTotal: totals.shares,
          bosaTotal: totals.bosa,
          fosaTotal: totals.fosa,
        },
        latestDividendRun: latestRun ? serializeDividendRun(latestRun) : null,
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sacco/overview',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load SACCO overview.' }, { status: 500 });
    }
  });
}
