import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessEnergy, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { buildEnergyHseRollup } from '@/lib/energy/hse-rollup';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessEnergy(ctx.staff)) {
      return forbiddenResponse('Energy access is restricted to operations and admin users.');
    }

    try {
      const { activeSites, activePermits, expiringPermits, expiredPermits, openIncidents, rollup } =
        await ctx.run(async (tx) => {
          const clientId = await resolvePrimaryWorkspaceClientId(
            tx,
            undefined,
            request,
            ctx.organizationId,
          );

          const [sites, permitsActive, permitsExpiring, permitsExpired, incidents, hseRollup] =
            await Promise.all([
              tx.energySite.count({
                where: { ...ctx.where(), outsourcingClientId: clientId, isActive: true },
              }),
              tx.energyPermit.count({
                where: { ...ctx.where(), outsourcingClientId: clientId, status: 'active' },
              }),
              tx.energyPermit.count({
                where: {
                  ...ctx.where(),
                  outsourcingClientId: clientId,
                  status: 'expiring_soon',
                },
              }),
              tx.energyPermit.count({
                where: { ...ctx.where(), outsourcingClientId: clientId, status: 'expired' },
              }),
              tx.hseIncident.count({
                where: {
                  ...ctx.where(),
                  outsourcingClientId: clientId,
                  status: { in: ['open', 'investigating'] },
                },
              }),
              buildEnergyHseRollup(tx, ctx.organizationId),
            ]);

          return {
            activeSites: sites,
            activePermits: permitsActive,
            expiringPermits: permitsExpiring,
            expiredPermits: permitsExpired,
            openIncidents: incidents,
            rollup: hseRollup,
          };
        });

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
  });
}
