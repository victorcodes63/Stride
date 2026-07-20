import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { staffUserCanManageAttendance } from '@/lib/staff-time-attendance/attendance-access';

/**
 * GET /api/staff/attendance/work-sites
 * Geofenced work sites for internal-staff mobile clock-in (org-scoped, no client)
 * plus the default policy's geofence flags.
 */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const { sites, policy } = await ctx.run(async (tx) => {
      const siteRows = await tx.staffAttendanceWorkSite.findMany({
        where: ctx.where(),
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      });
      const policyRow = await tx.staffAttendancePolicy.findFirst({
        where: ctx.where({ isDefault: true, isActive: true }),
        select: { id: true, mobileGeofenceEnabled: true, rejectOutsideGeofence: true },
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
      canManage: staffUserCanManageAttendance(ctx.staff),
    });
  });
}

/** POST /api/staff/attendance/work-sites — create a work site. */
export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    if (!staffUserCanManageAttendance(ctx.staff)) {
      return NextResponse.json({ error: 'Not allowed to manage work sites.' }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const latitude = typeof body.latitude === 'number' ? body.latitude : Number(body.latitude);
    const longitude = typeof body.longitude === 'number' ? body.longitude : Number(body.longitude);
    const radiusMeters =
      typeof body.radiusMeters === 'number' ? Math.round(body.radiusMeters) : Number(body.radiusMeters) || 150;
    const code = typeof body.code === 'string' ? body.code.trim() || null : null;

    if (!name || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return NextResponse.json({ error: 'name, latitude, and longitude are required.' }, { status: 400 });
    }

    const site = await ctx.run((tx) =>
      tx.staffAttendanceWorkSite.create({
        data: {
          organizationId: ctx.organizationId,
          name,
          code,
          latitude,
          longitude,
          radiusMeters: Math.max(25, Math.min(radiusMeters, 5000)),
          isActive: true,
        },
      }),
    );

    await ctx.audit({
      action: 'staff_attendance.work_site.create',
      entityType: 'StaffAttendanceWorkSite',
      entityId: site.id,
      route: 'POST /api/staff/attendance/work-sites',
      metadata: { name },
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

/**
 * PATCH /api/staff/attendance/work-sites
 * Update a work site (name/isActive) and/or the default policy geofence flags.
 */
export async function PATCH(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    if (!staffUserCanManageAttendance(ctx.staff)) {
      return NextResponse.json({ error: 'Not allowed to manage work sites.' }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const result = await ctx.run(async (tx) => {
      if (
        typeof body.mobileGeofenceEnabled === 'boolean' ||
        typeof body.rejectOutsideGeofence === 'boolean'
      ) {
        await tx.staffAttendancePolicy.updateMany({
          where: ctx.where({ isDefault: true }),
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
      if (!siteId) return { ok: true as const };

      const existing = await tx.staffAttendanceWorkSite.findFirst({ where: ctx.where({ id: siteId }) });
      if (!existing) return { error: 'not_found' as const };

      const site = await tx.staffAttendanceWorkSite.update({
        where: { id: siteId },
        data: {
          ...(typeof body.name === 'string' && body.name.trim() ? { name: body.name.trim() } : {}),
          ...(typeof body.radiusMeters === 'number' || typeof body.radiusMeters === 'string'
            ? { radiusMeters: Math.max(25, Math.min(Math.round(Number(body.radiusMeters)) || 150, 5000)) }
            : {}),
          ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
        },
      });
      return { id: site.id, isActive: site.isActive, name: site.name };
    });

    if ('error' in result) return NextResponse.json({ error: 'Work site not found.' }, { status: 404 });

    await ctx.audit({
      action: 'staff_attendance.work_site.update',
      entityType: 'StaffAttendanceWorkSite',
      entityId: typeof body.id === 'string' ? body.id : null,
      route: 'PATCH /api/staff/attendance/work-sites',
      metadata: {
        geofence: {
          mobileGeofenceEnabled: body.mobileGeofenceEnabled,
          rejectOutsideGeofence: body.rejectOutsideGeofence,
        },
      },
    });

    return NextResponse.json('ok' in result ? { ok: true } : result);
  });
}
