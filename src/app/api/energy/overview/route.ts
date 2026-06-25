import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessEnergy, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { buildEnergyHseRollup } from '@/lib/energy/hse-rollup';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessEnergy(user)) {
    return forbiddenResponse('Energy access is restricted to operations and admin users.');
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const soon = new Date();
    soon.setDate(soon.getDate() + 60);

    const [activeSites, activePermits, expiringPermits, expiredPermits, openIncidents] =
      await Promise.all([
        prisma.energySite.count({ where: { outsourcingClientId: clientId, isActive: true } }),
        prisma.energyPermit.count({
          where: { outsourcingClientId: clientId, status: 'active' },
        }),
        prisma.energyPermit.count({
          where: {
            outsourcingClientId: clientId,
            status: 'expiring_soon',
          },
        }),
        prisma.energyPermit.count({
          where: { outsourcingClientId: clientId, status: 'expired' },
        }),
        prisma.hseIncident.count({
          where: {
            outsourcingClientId: clientId,
            status: { in: ['open', 'investigating'] },
          },
        }),
      ]);

    const rollup = await buildEnergyHseRollup(prisma, user.currentOrgId);

    return NextResponse.json({
      summary: {
        activeSites,
        activePermits,
        expiringPermits,
        expiredPermits,
        openIncidents,
        entityCount: rollup.length,
      },
      rollup,
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/energy/overview',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load energy overview.' }, { status: 500 });
  }
}
