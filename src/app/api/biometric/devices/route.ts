import { NextRequest, NextResponse } from 'next/server';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
      }
      const requestedClientId = request.nextUrl.searchParams.get('clientId') || undefined;
      const payload = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          requestedClientId,
          request,
          ctx.organizationId,
        );
        const devices = await tx.biometricDevice.findMany({
          where: ctx.where({ outsourcingClientId: clientId }),
          include: {
            client: { select: { id: true, name: true } },
            _count: { select: { punches: true } },
          },
          orderBy: [{ client: { name: 'asc' } }, { name: 'asc' }],
        });

        return Promise.all(
          devices.map(async (device) => {
            const lastPunch = await tx.biometricPunch.findFirst({
              where: ctx.where({ biometricDeviceId: device.id }),
              orderBy: { observedAt: 'desc' },
              select: { observedAt: true },
            });
            return {
              id: device.id,
              name: device.name,
              adapterKind: device.adapterKind,
              isActive: device.isActive,
              clientId: device.outsourcingClientId,
              clientName: device.client.name,
              punchCount: device._count.punches,
              lastObservedAt: lastPunch?.observedAt?.toISOString() ?? null,
            };
          }),
        );
      });

      return NextResponse.json({ devices: payload, biometricOpsV2: isFeatureEnabled('biometricOpsV2') });
    } catch (error) {
      console.error('[biometric/devices GET]', error);
      return NextResponse.json({ error: 'Failed to load biometric devices.' }, { status: 500 });
    }
  });
}
