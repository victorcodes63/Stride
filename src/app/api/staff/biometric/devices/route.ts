import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import {
  buildStaffDeviceConfigFromBody,
  canManageStaffBiometric,
  getSubjectMap,
  isStaffBiometricAdapterKind,
  publicStaffDeviceConfig,
  serializeStaffDeviceConfig,
} from '@/lib/staff-biometric/config';

const DAY_MS = 24 * 60 * 60 * 1000;
/** An active, network-capable device is "stale" if not polled within this window. */
const STALE_POLL_MS = DAY_MS;

/** GET /api/staff/biometric/devices — list tenant-own devices with health metrics. */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const now = new Date();
    const since24h = new Date(now.getTime() - DAY_MS);
    const since7d = new Date(now.getTime() - 7 * DAY_MS);

    const payload = await ctx.run(async (tx) => {
      const devices = await tx.staffBiometricDevice.findMany({
        where: ctx.where(),
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      });
      const ids = devices.map((d) => d.id);

      if (ids.length === 0) return [];

      const scope = { staffBiometricDeviceId: { in: ids } };
      const [totals, last24h, last7d, unmatched, subjects] = await Promise.all([
        tx.staffBiometricPunch.groupBy({
          by: ['staffBiometricDeviceId'],
          where: ctx.where(scope),
          _count: { _all: true },
          _max: { observedAt: true },
        }),
        tx.staffBiometricPunch.groupBy({
          by: ['staffBiometricDeviceId'],
          where: ctx.where({ ...scope, observedAt: { gte: since24h } }),
          _count: { _all: true },
        }),
        tx.staffBiometricPunch.groupBy({
          by: ['staffBiometricDeviceId'],
          where: ctx.where({ ...scope, observedAt: { gte: since7d } }),
          _count: { _all: true },
        }),
        tx.staffBiometricPunch.groupBy({
          by: ['staffBiometricDeviceId'],
          where: ctx.where({ ...scope, userId: null }),
          _count: { _all: true },
        }),
        tx.staffBiometricPunch.groupBy({
          by: ['staffBiometricDeviceId', 'rawSubjectId'],
          where: ctx.where(scope),
        }),
      ]);

      const totalMap = new Map(totals.map((r) => [r.staffBiometricDeviceId, r]));
      const map24h = new Map(last24h.map((r) => [r.staffBiometricDeviceId, r._count._all]));
      const map7d = new Map(last7d.map((r) => [r.staffBiometricDeviceId, r._count._all]));
      const unmatchedMap = new Map(unmatched.map((r) => [r.staffBiometricDeviceId, r._count._all]));
      const distinctSubjectMap = new Map<string, number>();
      for (const row of subjects) {
        distinctSubjectMap.set(
          row.staffBiometricDeviceId,
          (distinctSubjectMap.get(row.staffBiometricDeviceId) ?? 0) + 1,
        );
      }

      return devices.map((device) => {
        const totalRow = totalMap.get(device.id);
        const pub = publicStaffDeviceConfig(device.config);
        const mappedSubjectCount = Object.keys(getSubjectMap(device.config)).length;
        const supportsConnection = device.adapterKind === 'hikvision_isapi';
        const stale =
          device.isActive &&
          supportsConnection &&
          (!device.lastPollAt || device.lastPollAt.getTime() < now.getTime() - STALE_POLL_MS);

        return {
          id: device.id,
          name: device.name,
          adapterKind: device.adapterKind,
          isActive: device.isActive,
          host: pub.host,
          port: pub.port,
          notes: pub.notes,
          timezone: pub.timezone,
          useHttps: pub.useHttps,
          hasCredentials: pub.hasCredentials,
          supportsConnection,
          lastPollAt: device.lastPollAt?.toISOString() ?? null,
          createdAt: device.createdAt.toISOString(),
          punchCount: totalRow?._count._all ?? 0,
          punches24h: map24h.get(device.id) ?? 0,
          punches7d: map7d.get(device.id) ?? 0,
          unmatchedPunchCount: unmatchedMap.get(device.id) ?? 0,
          distinctSubjectCount: distinctSubjectMap.get(device.id) ?? 0,
          mappedSubjectCount,
          lastObservedAt: totalRow?._max.observedAt?.toISOString() ?? null,
          stale,
        };
      });
    });

    return NextResponse.json({
      devices: payload,
      canManage: canManageStaffBiometric(ctx.staff),
    });
  });
}

/** POST /api/staff/biometric/devices — create a device. */
export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    if (!canManageStaffBiometric(ctx.staff)) {
      return NextResponse.json({ error: 'You do not have permission to manage devices.' }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const name = String(body.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'Device name is required.' }, { status: 400 });

    const adapterKind = String(body.adapterKind ?? '').trim();
    if (!isStaffBiometricAdapterKind(adapterKind)) {
      return NextResponse.json({ error: 'Unsupported adapter kind.' }, { status: 400 });
    }

    const config = buildStaffDeviceConfigFromBody(body);

    const created = await ctx.run((tx) =>
      tx.staffBiometricDevice.create({
        data: {
          organizationId: ctx.organizationId,
          name,
          adapterKind,
          config: serializeStaffDeviceConfig(config),
          isActive: body.isActive !== false,
        },
      }),
    );

    await ctx.audit({
      action: 'staff_biometric_device.create',
      entityType: 'StaffBiometricDevice',
      entityId: created.id,
      route: '/api/staff/biometric/devices',
      metadata: { name, adapterKind },
    });

    return NextResponse.json({ id: created.id });
  });
}
