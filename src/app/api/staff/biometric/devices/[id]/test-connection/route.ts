import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { canManageStaffBiometric } from '@/lib/staff-biometric/config';
import { probeStaffDevice } from '@/lib/staff-biometric/staff-adapter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/staff/biometric/devices/[id]/test-connection
 *
 * Verifies device reachability/credentials (Hikvision ISAPI Digest) and returns
 * status, HTTP code, latency, and parsed device info or an error message.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    if (!canManageStaffBiometric(ctx.staff)) {
      return NextResponse.json({ error: 'You do not have permission to test devices.' }, { status: 403 });
    }
    const { id } = await params;

    const device = await ctx.run((tx) =>
      tx.staffBiometricDevice.findFirst({
        where: ctx.where({ id }),
        select: { id: true, name: true, adapterKind: true, config: true },
      }),
    );
    if (!device) return NextResponse.json({ error: 'Device not found.' }, { status: 404 });

    const startedAt = Date.now();
    const result = await probeStaffDevice(device);
    const latencyMs = Date.now() - startedAt;

    await ctx.audit({
      action: 'staff_biometric_device.test_connection',
      entityType: 'StaffBiometricDevice',
      entityId: id,
      route: `/api/staff/biometric/devices/${id}/test-connection`,
      metadata: { ok: result.ok, httpStatus: result.httpStatus ?? null, latencyMs },
    });

    return NextResponse.json({
      deviceId: device.id,
      deviceName: device.name,
      latencyMs,
      testedAt: new Date().toISOString(),
      ...result,
    });
  });
}
