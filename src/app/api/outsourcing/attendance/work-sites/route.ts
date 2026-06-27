import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const requestedClientId = request.nextUrl.searchParams.get('clientId') || undefined;
    const { sites, policy } = await ctx.run(async (tx) => {
      const clientId = await resolvePrimaryWorkspaceClientId(
        tx,
        requestedClientId,
        request,
        ctx.organizationId,
      );

      const siteRows = await tx.attendanceWorkSite.findMany({
        where: ctx.where({ outsourcingClientId: clientId }),
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      });

      const policyRow = await tx.attendancePolicy.findFirst({
        where: ctx.where({ outsourcingClientId: clientId, isDefault: true, isActive: true }),
        select: {
          id: true,
          mobileGeofenceEnabled: true,
          rejectOutsideGeofence: true,
        },
      });

      return { sites: siteRows, policy: policyRow };
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
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const requestedClientId = typeof body.clientId === 'string' ? body.clientId : undefined;

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const latitude = typeof body.latitude === 'number' ? body.latitude : Number(body.latitude);
    const longitude = typeof body.longitude === 'number' ? body.longitude : Number(body.longitude);
    const radiusMeters =
      typeof body.radiusMeters === 'number' ? Math.round(body.radiusMeters) : Number(body.radiusMeters) || 150;
    const code = typeof body.code === 'string' ? body.code.trim() || null : null;

    if (!name || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return NextResponse.json({ error: 'name, latitude, and longitude are required.' }, { status: 400 });
    }

    const site = await ctx.run(async (tx) => {
      const clientId = await resolvePrimaryWorkspaceClientId(
        tx,
        requestedClientId,
        request,
        ctx.organizationId,
      );

      const client = await tx.outsourcingClient.findFirst({
        where: ctx.where({ id: clientId }),
        select: { organizationId: true },
      });
      if (!client) return null;

      return tx.attendanceWorkSite.create({
        data: {
          organizationId: ctx.organizationId,
          outsourcingClientId: clientId,
          name,
          code,
          latitude,
          longitude,
          radiusMeters: Math.max(25, Math.min(radiusMeters, 5000)),
          isActive: true,
        },
      });
    });

    if (!site) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

    await ctx.audit({
      action: 'attendance.work_site.create',
      entityType: 'AttendanceWorkSite',
      entityId: site.id,
      route: 'POST /api/outsourcing/attendance/work-sites',
      metadata: { clientId: site.outsourcingClientId, name },
    });

    return NextResponse.json({
      id: site.id,
      name: site.name,
      latitude: site.latitude.toNumber(),
      longitude: site.longitude.toNumber(),
      radiusMeters: site.radiusMeters,
    });
  });
}

export async function PATCH(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const requestedClientId = typeof body.clientId === 'string' ? body.clientId : undefined;

    const result = await ctx.run(async (tx) => {
      const clientId = await resolvePrimaryWorkspaceClientId(
        tx,
        requestedClientId,
        request,
        ctx.organizationId,
      );

      if (
        typeof body.mobileGeofenceEnabled === 'boolean' ||
        typeof body.rejectOutsideGeofence === 'boolean'
      ) {
        await tx.attendancePolicy.updateMany({
          where: ctx.where({ outsourcingClientId: clientId, isDefault: true }),
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
        return { ok: true as const };
      }

      const existing = await tx.attendanceWorkSite.findFirst({
        where: ctx.where({ id: siteId }),
      });
      if (!existing) return { error: 'Work site not found.' as const };

      const site = await tx.attendanceWorkSite.update({
        where: { id: siteId },
        data: {
          ...(typeof body.name === 'string' && body.name.trim() ? { name: body.name.trim() } : {}),
          ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
        },
      });

      return { id: site.id, isActive: site.isActive, name: site.name };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    if ('ok' in result) {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(result);
  });
}
