import { NextRequest, NextResponse } from 'next/server';
import type { FleetComplianceCheckType, FleetComplianceResult } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withFleetTenant, fleetTenantWhere } from '@/lib/fleet-tenant-api';
import { fleetTripDetailInclude, tripToDetail } from '@/lib/fleet-api';
import {
  ensureTripComplianceChecks,
  FLEET_COMPLIANCE_CHECK_TYPES,
} from '@/lib/fleet-compliance';
import {
  applyTripStatusChange,
  TripStatusTransitionError,
} from '@/lib/fleet-trip-status-change';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withFleetTenant(request, async (ctx) => {
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as {
      checkType?: string;
      result?: string;
      notes?: string;
    } | null;

    const checkType = body?.checkType;
    const result = body?.result as FleetComplianceResult | undefined;

    if (
      !checkType ||
      !FLEET_COMPLIANCE_CHECK_TYPES.includes(checkType as FleetComplianceCheckType) ||
      !result ||
      !['pending', 'passed', 'failed', 'waived'].includes(result)
    ) {
      return NextResponse.json({ error: 'Invalid compliance update.' }, { status: 400 });
    }

    const trip = await prisma.fleetTrip.findFirst({
      where: fleetTenantWhere(ctx, { id }),
    });
    if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await ensureTripComplianceChecks(prisma, id);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.fleetTripComplianceCheck.update({
        where: {
          tripId_checkType: {
            tripId: id,
            checkType: checkType as FleetComplianceCheckType,
          },
        },
        data: {
          result,
          notes: body?.notes?.trim() || null,
          checkedByUserId: ctx.staff.id,
          checkedAt: new Date(),
        },
      });

      await tx.fleetTripEvent.create({
        data: {
          tripId: id,
          eventType: 'compliance',
          message: `${checkType.replace(/_/g, ' ')} marked ${result}.`,
          metadata: { checkType, result, actorEmail: ctx.staff.email },
        },
      });

      return tx.fleetTrip.findFirst({
        where: { id },
        include: fleetTripDetailInclude,
      });
    });

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const allPassed = updated.complianceChecks.every(
      (c) => c.result === 'passed' || c.result === 'waived',
    );

    if (
      allPassed &&
      updated.complianceChecks.length > 0 &&
      updated.status === 'compliance_check'
    ) {
      try {
        const advanced = await prisma.$transaction((tx) =>
          applyTripStatusChange(tx, {
            tripId: id,
            from: 'compliance_check',
            to: 'loaded',
            actor: 'staff',
            actorEmail: ctx.staff.email,
            source: 'compliance',
            note: 'All pre-trip checks passed.',
          }),
        );
        return NextResponse.json(tripToDetail(advanced));
      } catch (e) {
        if (e instanceof TripStatusTransitionError) {
          return NextResponse.json(tripToDetail(updated));
        }
        throw e;
      }
    }

    return NextResponse.json(tripToDetail(updated));
  });
}
