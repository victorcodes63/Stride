import { NextRequest, NextResponse } from 'next/server';
import type { FleetGeofenceType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withFleetTenant } from '@/lib/fleet-tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const geofences = await prisma.fleetGeofence.findMany({
      where: {
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    return NextResponse.json(
      geofences.map((g) => ({
        id: g.id,
        name: g.name,
        geofenceType: g.geofenceType,
        description: g.description,
        geometry: g.geometry,
        isActive: g.isActive,
        alertOnEntry: g.alertOnEntry,
        alertOnExit: g.alertOnExit,
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const body = (await request.json()) as {
      name?: string;
      geofenceType?: FleetGeofenceType;
      description?: string;
      geometry?: unknown;
      alertOnEntry?: boolean;
      alertOnExit?: boolean;
    };

    if (!body.name?.trim() || !body.geometry) {
      return NextResponse.json({ error: 'Name and geometry are required.' }, { status: 400 });
    }

    const geofence = await prisma.fleetGeofence.create({
      data: {
        organizationId: ctx.organizationId,
        outsourcingClientId: ctx.workspaceClientId,
        name: body.name.trim(),
        geofenceType: body.geofenceType ?? 'custom',
        description: body.description?.trim() || null,
        geometry: body.geometry as object,
        alertOnEntry: body.alertOnEntry ?? true,
        alertOnExit: body.alertOnExit ?? true,
      },
    });

    return NextResponse.json({ id: geofence.id, name: geofence.name }, { status: 201 });
  });
}
