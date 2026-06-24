import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { unauthorizedResponse } from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { logAuditEvent } from '@/lib/audit-events';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const requestedClientId = request.nextUrl.searchParams.get('clientId') || undefined;
  const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);

  const sites = await prisma.attendanceWorkSite.findMany({
    where: { outsourcingClientId: clientId },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });

  const policy = await prisma.attendancePolicy.findFirst({
    where: { outsourcingClientId: clientId, isDefault: true, isActive: true },
    select: {
      id: true,
      mobileGeofenceEnabled: true,
      rejectOutsideGeofence: true,
    },
  });

  return NextResponse.json({
    sites: sites.map((site) => ({
      id: site.id,
      name: site.name,
      code: site.code,
      latitude: site.latitude.toNumber(),
      longitude: site.longitude.toNumber(),
      radiusMeters: site.radiusMeters,
      isActive: site.isActive,
    })),
    policy: policy
      ? {
          id: policy.id,
          mobileGeofenceEnabled: policy.mobileGeofenceEnabled,
          rejectOutsideGeofence: policy.rejectOutsideGeofence,
        }
      : null,
  });
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const requestedClientId = typeof body.clientId === 'string' ? body.clientId : undefined;
  const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const latitude = typeof body.latitude === 'number' ? body.latitude : Number(body.latitude);
  const longitude = typeof body.longitude === 'number' ? body.longitude : Number(body.longitude);
  const radiusMeters =
    typeof body.radiusMeters === 'number' ? Math.round(body.radiusMeters) : Number(body.radiusMeters) || 150;
  const code = typeof body.code === 'string' ? body.code.trim() || null : null;

  if (!name || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return NextResponse.json({ error: 'name, latitude, and longitude are required.' }, { status: 400 });
  }

  const client = await prisma.outsourcingClient.findUnique({
    where: { id: clientId },
    select: { organizationId: true },
  });
  if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

  const site = await prisma.attendanceWorkSite.create({
    data: {
      organizationId: client.organizationId,
      outsourcingClientId: clientId,
      name,
      code,
      latitude,
      longitude,
      radiusMeters: Math.max(25, Math.min(radiusMeters, 5000)),
      isActive: true,
    },
  });

  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: 'attendance.work_site.create',
    entityType: 'AttendanceWorkSite',
    entityId: site.id,
    route: 'POST /api/outsourcing/attendance/work-sites',
    metadata: { clientId, name },
  });

  return NextResponse.json({
    id: site.id,
    name: site.name,
    latitude: site.latitude.toNumber(),
    longitude: site.longitude.toNumber(),
    radiusMeters: site.radiusMeters,
  });
}

export async function PATCH(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const requestedClientId = typeof body.clientId === 'string' ? body.clientId : undefined;
  const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);

  if (
    typeof body.mobileGeofenceEnabled === 'boolean' ||
    typeof body.rejectOutsideGeofence === 'boolean'
  ) {
    await prisma.attendancePolicy.updateMany({
      where: { outsourcingClientId: clientId, isDefault: true },
      data: {
        ...(typeof body.mobileGeofenceEnabled === 'boolean'
          ? { mobileGeofenceEnabled: body.mobileGeofenceEnabled }
          : {}),
        ...(typeof body.rejectOutsideGeofence === 'boolean'
          ? { rejectOutsideGeofence: body.rejectOutsideGeofence }
          : {}),
      },
    });
  }

  const siteId = typeof body.id === 'string' ? body.id.trim() : '';
  if (!siteId) {
    return NextResponse.json({ ok: true });
  }

  const existing = await prisma.attendanceWorkSite.findUnique({ where: { id: siteId } });
  if (!existing) return NextResponse.json({ error: 'Work site not found.' }, { status: 404 });

  const site = await prisma.attendanceWorkSite.update({
    where: { id: siteId },
    data: {
      ...(typeof body.name === 'string' && body.name.trim() ? { name: body.name.trim() } : {}),
      ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
    },
  });

  return NextResponse.json({ id: site.id, isActive: site.isActive, name: site.name });
}
