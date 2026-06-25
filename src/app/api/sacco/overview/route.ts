import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessSacco, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { serializeDividendRun } from '@/lib/sacco/serialize';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessSacco(user)) {
    return forbiddenResponse('SACCO access is restricted to finance and admin users.');
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);

    const [memberCount, activeMembers, accounts, latestRun] = await Promise.all([
      prisma.saccoMember.count({ where: { outsourcingClientId: clientId } }),
      prisma.saccoMember.count({ where: { outsourcingClientId: clientId, status: 'active' } }),
      prisma.saccoAccount.findMany({
        where: { member: { outsourcingClientId: clientId } },
        select: { accountType: true, balance: true },
      }),
      prisma.saccoDividendRun.findFirst({
        where: { outsourcingClientId: clientId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { lines: true } } },
      }),
    ]);

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
}
