import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import type { BiometricPunchDirection, BiometricPunchSource, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withOrgContext } from '@/lib/org-context';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { reportApiError } from '@/lib/monitoring';
import { pollStaffDevice } from '@/lib/staff-biometric/staff-adapter';
import { getSubjectMap } from '@/lib/staff-biometric/config';
import { materializeStaffPunches } from '@/lib/staff-biometric/ingest';
import type { RawPunch } from '@/lib/biometric/biometric-adapter';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const THROTTLE_LOCK_KEY = 'staff-biometric-poll';
const COLD_START_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

function pollIntervalSeconds(): number {
  const raw = process.env.BIOMETRIC_POLL_INTERVAL_SECONDS;
  if (raw == null || String(raw).trim() === '') return 60;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0) return 60;
  return n;
}

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return request.nextUrl.searchParams.get('secret') === secret;
}

function directionToEnum(d: RawPunch['direction'] | undefined): BiometricPunchDirection {
  if (d === 'in' || d === 'out' || d === 'unknown') return d;
  return 'unknown';
}

function clampSince(since: Date, now: Date): Date {
  return since.getTime() > now.getTime() ? new Date(now.getTime() - 60_000) : since;
}

/**
 * Poll active internal-staff biometric devices (Hikvision ISAPI), append
 * `StaffBiometricPunch` rows (idempotent on external id), and — for punches that
 * map to a staff User via the device's `subjectMap` — create `StaffAttendanceEvent`s
 * and reconcile the affected days. Mirrors /api/cron/biometric-poll (outsourcing)
 * but writes inside `withOrgContext` per device so tenancy/RLS is enforced.
 * Throttled via `SchedulerLock` `staff-biometric-poll`.
 */
export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const now = new Date();
  const intervalSec = pollIntervalSeconds();

  try {
    const lock = await prisma.schedulerLock.findUnique({ where: { key: THROTTLE_LOCK_KEY } });
    if (lock && now.getTime() - lock.lastRunAt.getTime() < intervalSec * 1000) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        nextAllowedAt: new Date(lock.lastRunAt.getTime() + intervalSec * 1000),
      });
    }

    const devices = await prisma.staffBiometricDevice.findMany({ where: { isActive: true } });

    let devicesPolled = 0;
    let punchesInserted = 0;
    let eventsCreated = 0;

    for (const device of devices) {
      const lastPunch = await prisma.staffBiometricPunch.findFirst({
        where: { staffBiometricDeviceId: device.id },
        orderBy: { observedAt: 'desc' },
        select: { observedAt: true },
      });
      const coldStart = new Date(now.getTime() - COLD_START_LOOKBACK_MS);
      const since = clampSince(device.lastPollAt ?? lastPunch?.observedAt ?? coldStart, now);

      let events: RawPunch[] = [];
      try {
        events = await pollStaffDevice(
          { id: device.id, adapterKind: device.adapterKind, config: device.config },
          since,
        );
      } catch (err) {
        console.error('[staff-biometric-poll] device poll failed', device.id, err);
        devicesPolled += 1;
        continue;
      }
      devicesPolled += 1;

      const subjectMap = getSubjectMap(device.config);

      await withOrgContext(
        device.organizationId,
        async (tx) => {
          const toInsert: Prisma.StaffBiometricPunchCreateManyInput[] = events
            .filter((e) => e.deviceConfigRef.id === device.id)
            .map((e) => ({
              id: randomUUID(),
              organizationId: device.organizationId,
              staffBiometricDeviceId: device.id,
              externalEventId: e.externalEventId,
              observedAt: e.observedAt,
              rawSubjectId: e.rawSubjectId,
              userId: subjectMap[e.rawSubjectId] ?? null,
              rawPayload: e.rawPayload as Prisma.InputJsonValue | undefined,
              source: 'device' as BiometricPunchSource,
              direction: directionToEnum(e.direction),
              createdAt: now,
            }));

          if (toInsert.length > 0) {
            const inserted = await tx.staffBiometricPunch.createMany({
              data: toInsert,
              skipDuplicates: true,
            });
            punchesInserted += inserted.count;

            if (isFeatureEnabled('attendanceV2') && inserted.count > 0) {
              const rows = await tx.staffBiometricPunch.findMany({
                where: {
                  staffBiometricDeviceId: device.id,
                  externalEventId: { in: toInsert.map((r) => r.externalEventId) },
                  userId: { not: null },
                },
                select: { id: true, userId: true, observedAt: true, direction: true },
              });
              const materializable = rows
                .filter((r): r is typeof r & { userId: string } => Boolean(r.userId))
                .map((r) => ({
                  id: r.id,
                  userId: r.userId,
                  observedAt: r.observedAt,
                  direction: r.direction,
                }));
              const result = await materializeStaffPunches(
                tx,
                device.organizationId,
                materializable,
                null,
              );
              eventsCreated += result.eventsCreated;
            }
          }

          await tx.staffBiometricDevice.update({
            where: { id: device.id },
            data: { lastPollAt: now },
          });
        },
        { timeout: 20_000 },
      );
    }

    await prisma.schedulerLock.upsert({
      where: { key: THROTTLE_LOCK_KEY },
      create: { key: THROTTLE_LOCK_KEY, lastRunAt: now },
      update: { lastRunAt: now },
    });

    return NextResponse.json({
      ok: true,
      skipped: false,
      intervalSeconds: intervalSec,
      devicesPolled,
      punchesInserted,
      eventsCreated,
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/cron/staff-biometric-poll',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Staff biometric poll failed.' }, { status: 500 });
  }
}
