import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { withTenant } from '@/lib/tenant-api';
import { withOrgContext } from '@/lib/org-context';
import { canManageStaffBiometric, getSubjectMap } from '@/lib/staff-biometric/config';
import { pollStaffDevice, staffAdapterSupportsConnection } from '@/lib/staff-biometric/staff-adapter';
import { materializeStaffPunches } from '@/lib/staff-biometric/ingest';

export const dynamic = 'force-dynamic';

const COLD_START_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
/** Longer timeout: polling + reconciliation can span many rows. */
const POLL_TX_TIMEOUT_MS = 60_000;

/** POST /api/staff/biometric/devices/[id]/poll — best-effort on-demand device poll. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    if (!canManageStaffBiometric(ctx.staff)) {
      return NextResponse.json({ error: 'You do not have permission to poll devices.' }, { status: 403 });
    }
    const { id } = await params;
    const now = new Date();

    const device = await ctx.run((tx) =>
      tx.staffBiometricDevice.findFirst({ where: ctx.where({ id }) }),
    );
    if (!device) return NextResponse.json({ error: 'Device not found.' }, { status: 404 });

    if (!staffAdapterSupportsConnection(device.adapterKind)) {
      return NextResponse.json(
        { error: `Live polling is not supported for adapter "${device.adapterKind}". Use CSV import instead.` },
        { status: 400 },
      );
    }

    const lastPunch = await ctx.run((tx) =>
      tx.staffBiometricPunch.findFirst({
        where: ctx.where({ staffBiometricDeviceId: device.id }),
        orderBy: { observedAt: 'desc' },
        select: { observedAt: true },
      }),
    );

    let since = device.lastPollAt ?? lastPunch?.observedAt ?? new Date(now.getTime() - COLD_START_LOOKBACK_MS);
    if (since.getTime() > now.getTime()) since = new Date(now.getTime() - 60_000);

    let events;
    try {
      events = await pollStaffDevice(device, since);
    } catch (e) {
      await ctx.run((tx) =>
        tx.staffBiometricDevice.update({ where: { id: device.id }, data: { lastPollAt: now } }),
      );
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Device poll failed.', devicePolled: true },
        { status: 502 },
      );
    }

    const subjectMap = getSubjectMap(device.config);

    const result = await withOrgContext(
      ctx.organizationId,
      async (tx) => {
        const toInsert: Prisma.StaffBiometricPunchCreateManyInput[] = [];
        const externalIds: string[] = [];
        for (const e of events) {
          if (e.deviceConfigRef.id !== device.id) continue;
          externalIds.push(e.externalEventId);
          const mappedUserId = subjectMap[e.rawSubjectId] ?? null;
          toInsert.push({
            id: randomUUID(),
            organizationId: ctx.organizationId,
            staffBiometricDeviceId: device.id,
            externalEventId: e.externalEventId,
            observedAt: e.observedAt,
            rawSubjectId: e.rawSubjectId,
            userId: mappedUserId,
            rawPayload: (e.rawPayload as Prisma.InputJsonValue | undefined) ?? undefined,
            source: 'device',
            direction: e.direction ?? 'unknown',
            createdAt: now,
          });
        }

        let inserted = 0;
        let eventsCreated = 0;
        if (toInsert.length > 0) {
          const r = await tx.staffBiometricPunch.createMany({ data: toInsert, skipDuplicates: true });
          inserted = r.count;
          if (r.count > 0) {
            const rows = await tx.staffBiometricPunch.findMany({
              where: {
                organizationId: ctx.organizationId,
                staffBiometricDeviceId: device.id,
                externalEventId: { in: externalIds },
                userId: { not: null },
              },
              select: { id: true, userId: true, observedAt: true, direction: true },
            });
            const materialized = await materializeStaffPunches(
              tx,
              ctx.organizationId,
              rows.map((row) => ({
                id: row.id,
                userId: row.userId!,
                observedAt: row.observedAt,
                direction: row.direction,
              })),
              ctx.staff.id,
            );
            eventsCreated = materialized.eventsCreated;
          }
        }

        await tx.staffBiometricDevice.update({ where: { id: device.id }, data: { lastPollAt: now } });
        return { fetched: events.length, inserted, eventsCreated };
      },
      { timeout: POLL_TX_TIMEOUT_MS },
    );

    await ctx.audit({
      action: 'staff_biometric_device.poll',
      entityType: 'StaffBiometricDevice',
      entityId: id,
      route: `/api/staff/biometric/devices/${id}/poll`,
      metadata: result,
    });

    return NextResponse.json({ ok: true, lastPollAt: now.toISOString(), ...result });
  });
}
