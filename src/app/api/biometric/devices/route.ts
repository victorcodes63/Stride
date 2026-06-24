import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

export async function GET(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const requestedClientId = request.nextUrl.searchParams.get('clientId') || undefined;
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);
    const devices = await prisma.biometricDevice.findMany({
      where: { outsourcingClientId: clientId },
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { punches: true } },
      },
      orderBy: [{ client: { name: 'asc' } }, { name: 'asc' }],
    });

    const payload = await Promise.all(
      devices.map(async (device) => {
        const lastPunch = await prisma.biometricPunch.findFirst({
          where: { biometricDeviceId: device.id },
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

    return NextResponse.json({ devices: payload, biometricOpsV2: isFeatureEnabled('biometricOpsV2') });
  } catch (error) {
    console.error('[biometric/devices GET]', error);
    return NextResponse.json({ error: 'Failed to load biometric devices.' }, { status: 500 });
  }
}

