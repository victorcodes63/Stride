import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminActor } from '@/lib/admin-security';
import { HikvisionIsapiAdapter } from '@/lib/biometric/hikvision-isapi-adapter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/biometric-devices/[id]/test-connection
 *
 * Verifies ISAPI reachability (Digest) and returns parsed `deviceInfo` when JSON, else a text snippet.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminActor(_request);
  if (error) return error;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const { id } = await context.params;
  const device = await prisma.biometricDevice.findUnique({
    where: { id },
    select: { id: true, adapterKind: true, config: true, name: true },
  });

  if (!device) {
    return NextResponse.json({ error: 'Biometric device not found.' }, { status: 404 });
  }

  if (device.adapterKind !== 'hikvision_isapi') {
    return NextResponse.json(
      {
        ok: false,
        error: `Connection test is only implemented for adapterKind "hikvision_isapi" (got "${device.adapterKind}").`,
      },
      { status: 400 }
    );
  }

  try {
    const adapter = new HikvisionIsapiAdapter(device);
    const result = await adapter.probeConnection();
    return NextResponse.json({
      deviceId: device.id,
      deviceName: device.name,
      ...result,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, deviceId: device.id, deviceName: device.name, error: message },
      { status: 500 }
    );
  }
}
