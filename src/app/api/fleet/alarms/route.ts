import { NextRequest, NextResponse } from 'next/server';
import type { FleetAlarmSeverity } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withFleetTenant } from '@/lib/fleet-tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const [rules, recentEvents] = await Promise.all([
      prisma.fleetAlarmRule.findMany({
        where: {
          outsourcingClientId: ctx.workspaceClientId,
          organizationId: ctx.organizationId,
        },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      }),
      prisma.fleetTripEvent.findMany({
        where: {
          organizationId: ctx.organizationId,
          trip: { outsourcingClientId: ctx.workspaceClientId },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          trip: { select: { tripNumber: true } },
        },
      }),
    ]);

    return NextResponse.json({
      rules: rules.map((r) => ({
        id: r.id,
        name: r.name,
        eventType: r.eventType,
        severity: r.severity,
        isActive: r.isActive,
        notifyEmail: r.notifyEmail,
        notifySms: r.notifySms,
      })),
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        tripNumber: e.trip.tripNumber,
        eventType: e.eventType,
        message: e.message,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  });
}

export async function POST(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const body = (await request.json()) as {
      name?: string;
      eventType?: string;
      severity?: FleetAlarmSeverity;
      condition?: unknown;
      notifyEmail?: string;
      notifySms?: string;
    };

    if (!body.name?.trim() || !body.eventType?.trim()) {
      return NextResponse.json({ error: 'Name and eventType are required.' }, { status: 400 });
    }

    const rule = await prisma.fleetAlarmRule.create({
      data: {
        organizationId: ctx.organizationId,
        outsourcingClientId: ctx.workspaceClientId,
        name: body.name.trim(),
        eventType: body.eventType.trim(),
        severity: body.severity ?? 'warning',
        condition: body.condition ? (body.condition as object) : undefined,
        notifyEmail: body.notifyEmail?.trim() || null,
        notifySms: body.notifySms?.trim() || null,
      },
    });

    return NextResponse.json({ id: rule.id, name: rule.name }, { status: 201 });
  });
}
