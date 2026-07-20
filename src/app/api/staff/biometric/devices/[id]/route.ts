import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import {
  buildStaffDeviceConfigFromBody,
  canManageStaffBiometric,
  getSubjectMap,
  isStaffBiometricAdapterKind,
  parseStaffDeviceConfig,
  publicStaffDeviceConfig,
  serializeStaffDeviceConfig,
} from '@/lib/staff-biometric/config';

/** GET /api/staff/biometric/devices/[id] — full device detail (incl. subject map). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const { id } = await params;
    const device = await ctx.run((tx) =>
      tx.staffBiometricDevice.findFirst({ where: ctx.where({ id }) }),
    );
    if (!device) return NextResponse.json({ error: 'Device not found.' }, { status: 404 });

    const pub = publicStaffDeviceConfig(device.config);
    return NextResponse.json({
      id: device.id,
      name: device.name,
      adapterKind: device.adapterKind,
      isActive: device.isActive,
      lastPollAt: device.lastPollAt?.toISOString() ?? null,
      createdAt: device.createdAt.toISOString(),
      ...pub,
      subjectMap: getSubjectMap(device.config),
      canManage: canManageStaffBiometric(ctx.staff),
    });
  });
}

/** PATCH /api/staff/biometric/devices/[id] — update fields / activate-deactivate. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    if (!canManageStaffBiometric(ctx.staff)) {
      return NextResponse.json({ error: 'You do not have permission to manage devices.' }, { status: 403 });
    }
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const existing = await ctx.run((tx) =>
      tx.staffBiometricDevice.findFirst({ where: ctx.where({ id }) }),
    );
    if (!existing) return NextResponse.json({ error: 'Device not found.' }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: 'Device name cannot be empty.' }, { status: 400 });
      data.name = name;
    }
    if (body.adapterKind != null) {
      const adapterKind = String(body.adapterKind).trim();
      if (!isStaffBiometricAdapterKind(adapterKind)) {
        return NextResponse.json({ error: 'Unsupported adapter kind.' }, { status: 400 });
      }
      data.adapterKind = adapterKind;
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    // Any connection field present → the submitted form is authoritative for the
    // connection details, but we always preserve the subjectMap and keep existing
    // credentials when the form omits them (so a blank password isn't destructive).
    const connectionKeys = ['host', 'port', 'notes', 'username', 'password', 'timezone', 'useHttps'];
    if (connectionKeys.some((k) => body[k] !== undefined)) {
      const incoming = buildStaffDeviceConfigFromBody(body);
      const current = parseStaffDeviceConfig(existing.config);
      if (body.username === undefined && current.username) incoming.username = current.username;
      if (body.password === undefined && current.password) incoming.password = current.password;
      incoming.subjectMap = current.subjectMap ?? {};
      data.config = serializeStaffDeviceConfig(incoming);
    }

    const updated = await ctx.run((tx) =>
      tx.staffBiometricDevice.update({ where: { id }, data }),
    );

    await ctx.audit({
      action: 'staff_biometric_device.update',
      entityType: 'StaffBiometricDevice',
      entityId: id,
      route: `/api/staff/biometric/devices/${id}`,
      metadata: { fields: Object.keys(data) },
    });

    return NextResponse.json({ id: updated.id });
  });
}

/** DELETE /api/staff/biometric/devices/[id] — remove device (cascades punches). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    if (!canManageStaffBiometric(ctx.staff)) {
      return NextResponse.json({ error: 'You do not have permission to manage devices.' }, { status: 403 });
    }
    const { id } = await params;

    const existing = await ctx.run((tx) =>
      tx.staffBiometricDevice.findFirst({ where: ctx.where({ id }), select: { id: true, name: true } }),
    );
    if (!existing) return NextResponse.json({ error: 'Device not found.' }, { status: 404 });

    await ctx.run((tx) => tx.staffBiometricDevice.delete({ where: { id } }));

    await ctx.audit({
      action: 'staff_biometric_device.delete',
      entityType: 'StaffBiometricDevice',
      entityId: id,
      route: `/api/staff/biometric/devices/${id}`,
      metadata: { name: existing.name },
    });

    return NextResponse.json({ ok: true });
  });
}
