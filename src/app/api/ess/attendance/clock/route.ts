import { NextRequest, NextResponse } from 'next/server';
import { AttendanceExceptionType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { evaluateGeofence, toWorkSiteGeofence } from '@/lib/attendance-geofence';
import { withEssTenant } from '@/lib/ess-tenant-api';

async function loadEmployeeClockContext(tx: Prisma.TransactionClient, organizationId: string, employeeId: string) {
  const employee = await tx.employee.findFirst({
    where: { id: employeeId, organizationId },
    select: {
      id: true,
      organizationId: true,
      outsourcingClientId: true,
      attendancePolicyAssignments: {
        where: { isPrimary: true },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
        select: {
          attendancePolicy: {
            select: {
              mobileGeofenceEnabled: true,
              rejectOutsideGeofence: true,
            },
          },
        },
      },
    },
  });
  if (!employee) return null;

  const policy = employee.attendancePolicyAssignments[0]?.attendancePolicy ?? null;
  const workSites = await tx.attendanceWorkSite.findMany({
    where: { organizationId, outsourcingClientId: employee.outsourcingClientId, isActive: true },
    select: { id: true, name: true, latitude: true, longitude: true, radiusMeters: true },
    orderBy: { name: 'asc' },
  });

  return { employee, policy, workSites };
}

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json({ error: 'No employee profile.' }, { status: 400 });

    const clockCtx = await ctx.run((tx) =>
      loadEmployeeClockContext(tx, ctx.organizationId, ctx.employeeId!),
    );
    if (!clockCtx) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

    const geofenceEnabled = Boolean(clockCtx.policy?.mobileGeofenceEnabled && clockCtx.workSites.length > 0);
    return NextResponse.json({
      geofenceEnabled,
      requireLocation: geofenceEnabled,
      rejectOutsideGeofence: clockCtx.policy?.rejectOutsideGeofence ?? true,
      workSiteCount: clockCtx.workSites.length,
    });
  });
}

export async function POST(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json({ error: 'No employee profile.' }, { status: 400 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    }
    const b = body as { kind?: string; latitude?: number; longitude?: number };
    const kind = b.kind === 'check_out' ? 'check_out' : 'check_in';

    const clockCtx = await ctx.run((tx) =>
      loadEmployeeClockContext(tx, ctx.organizationId, ctx.employeeId!),
    );
    if (!clockCtx) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

    const { employee, policy, workSites } = clockCtx;
    const geofenceEnabled = Boolean(policy?.mobileGeofenceEnabled && workSites.length > 0);
    const hasCoords = typeof b.latitude === 'number' && typeof b.longitude === 'number';

    if (geofenceEnabled && !hasCoords) {
      return NextResponse.json(
        { error: 'Location is required to clock in at your work site.', code: 'location_required' },
        { status: 400 },
      );
    }

    const sites = workSites.map(toWorkSiteGeofence);
    const geofence = hasCoords
      ? evaluateGeofence(b.latitude!, b.longitude!, sites)
      : { inside: !geofenceEnabled, matchedSite: null, distanceMeters: null };

    if (geofenceEnabled && !geofence.inside && policy?.rejectOutsideGeofence) {
      return NextResponse.json(
        {
          error: 'You are outside an approved work site. Ask your manager to record attendance manually.',
          code: 'outside_geofence',
          distanceMeters: geofence.distanceMeters,
        },
        { status: 422 },
      );
    }

    const now = new Date();
    const workDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const source = geofenceEnabled && hasCoords ? 'mobile_geo' : 'manual';

    const event = await ctx.run((tx) =>
      tx.attendanceEvent.create({
        data: {
          organizationId: ctx.organizationId,
          employeeId: employee.id,
          outsourcingClientId: employee.outsourcingClientId,
          observedAt: now,
          workDate,
          source,
          kind,
          notes: geofenceEnabled ? 'ESS mobile geo clock' : 'ESS mobile clock',
          metadata: {
            channel: 'ess_pwa',
            latitude: hasCoords ? b.latitude : null,
            longitude: hasCoords ? b.longitude : null,
            workSiteId: geofence.matchedSite?.id ?? null,
            workSiteName: geofence.matchedSite?.name ?? null,
            distanceMeters: geofence.distanceMeters,
            insideGeofence: geofence.inside,
          },
        },
      }),
    );

    if (geofenceEnabled && hasCoords && !geofence.inside) {
      await ctx.run((tx) =>
        tx.attendanceException.create({
          data: {
            organizationId: ctx.organizationId,
            employeeId: employee.id,
            workDate,
            type: AttendanceExceptionType.outside_geofence,
            description: `Mobile clock ${kind.replace('_', ' ')} recorded outside geofence (${geofence.distanceMeters ?? '?'} m from nearest site).`,
          },
        }),
      );
    }

    return NextResponse.json({
      id: event.id,
      kind: event.kind,
      observedAt: event.observedAt.toISOString(),
      source: event.source,
      geofence: {
        inside: geofence.inside,
        siteName: geofence.matchedSite?.name ?? null,
        distanceMeters: geofence.distanceMeters,
      },
    });
  });
}
