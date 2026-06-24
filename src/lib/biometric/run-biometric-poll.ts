import type { PrismaClient } from '@prisma/client';
import {
  type BiometricPunchDirection,
  type BiometricPunchSource,
  type Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { adapterForDevice } from './adapter-factory';
import type { RawPunch } from './biometric-adapter';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { reconcileAttendanceDay, resolveReconcileWorkDatesForObservedAt } from '@/lib/attendance-reconciliation';

const THROTTLE_LOCK_KEY = 'biometric-poll';

/** Max look-back when a device has never been polled and has no punches yet. */
const COLD_START_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export function biometricPollIntervalSeconds(): number {
  const raw = process.env.BIOMETRIC_POLL_INTERVAL_SECONDS;
  if (raw == null || String(raw).trim() === '') return 60;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0) return 60;
  return n;
}

function directionToEnum(
  d: RawPunch['direction'] | undefined
): BiometricPunchDirection {
  if (d === 'in' || d === 'out' || d === 'unknown') return d;
  return 'unknown';
}

function clampSince(since: Date, now: Date): Date {
  if (since.getTime() > now.getTime()) {
    return new Date(now.getTime() - 60_000);
  }
  return since;
}

/**
 * Fetches new events from all active devices and appends `BiometricPunch` rows (idempotent on external id).
 * Throttled by `BIOMETRIC_POLL_INTERVAL_SECONDS` via `SchedulerLock` `biometric-poll` (see cron route).
 */
export async function runBiometricIngestion(
  db: PrismaClient,
  options?: { now?: Date; skipThrottle?: boolean }
): Promise<{
  skipped: boolean;
  nextAllowedAt?: Date;
  intervalSeconds: number;
  devicesPolled: number;
  punchesInserted: number;
  punchAttemptCount: number;
}> {
  const now = options?.now ?? new Date();
  const intervalSec = biometricPollIntervalSeconds();
  const intervalMs = intervalSec * 1000;

  if (!options?.skipThrottle) {
    const lock = await db.schedulerLock.findUnique({ where: { key: THROTTLE_LOCK_KEY } });
    if (lock && now.getTime() - lock.lastRunAt.getTime() < intervalMs) {
      return {
        skipped: true,
        nextAllowedAt: new Date(lock.lastRunAt.getTime() + intervalMs),
        intervalSeconds: intervalSec,
        devicesPolled: 0,
        punchesInserted: 0,
        punchAttemptCount: 0,
      };
    }
  }

  const devices = await db.biometricDevice.findMany({ where: { isActive: true } });
  let devicesPolled = 0;
  let punchAttemptCount = 0;
  let punchesInserted = 0;

  for (const device of devices) {
    const adapter = adapterForDevice(device);
    const lastPunch = await db.biometricPunch.findFirst({
      where: { biometricDeviceId: device.id },
      orderBy: { observedAt: 'desc' },
      select: { observedAt: true },
    });
    const coldStart = new Date(now.getTime() - COLD_START_LOOKBACK_MS);
    const since = clampSince(device.lastPollAt ?? lastPunch?.observedAt ?? coldStart, now);

    let events: RawPunch[] = [];
    try {
      events = await adapter.pollEvents(since);
    } catch (err) {
      console.error('[runBiometricIngestion] device poll failed', device.id, err);
      devicesPolled += 1;
      continue;
    }

    devicesPolled += 1;

    const toInsert: Prisma.BiometricPunchCreateManyInput[] = [];
    for (const e of events) {
      if (e.deviceConfigRef.id !== device.id) {
        continue;
      }
      punchAttemptCount += 1;
      toInsert.push({
        id: randomUUID(),
        biometricDeviceId: device.id,
        externalEventId: e.externalEventId,
        observedAt: e.observedAt,
        rawSubjectId: e.rawSubjectId,
        employeeId: null,
        rawPayload: e.rawPayload as Prisma.InputJsonValue | undefined,
        source: 'device' as BiometricPunchSource,
        direction: directionToEnum(e.direction),
        createdAt: now,
      });
    }

    if (toInsert.length > 0) {
      const r = await db.biometricPunch.createMany({ data: toInsert, skipDuplicates: true });
      punchesInserted += r.count;

      if (isFeatureEnabled('attendanceV2') && r.count > 0) {
        const ids = toInsert.map((item) => item.externalEventId);
        const insertedRows = await db.biometricPunch.findMany({
          where: { biometricDeviceId: device.id, externalEventId: { in: ids } },
          select: {
            id: true,
            employeeId: true,
            observedAt: true,
            direction: true,
            biometricDeviceId: true,
          },
        });
        const clientId = device.outsourcingClientId;
        for (const row of insertedRows) {
          if (!row.employeeId) continue;
          const workDate = row.observedAt.toISOString().slice(0, 10);
          await db.attendanceEvent.create({
            data: {
              employeeId: row.employeeId,
              outsourcingClientId: clientId,
              observedAt: row.observedAt,
              workDate: new Date(`${workDate}T00:00:00.000Z`),
              source: 'biometric',
              kind: row.direction === 'out' ? 'check_out' : 'check_in',
              biometricPunchId: row.id,
            },
          });
          const workDates = await resolveReconcileWorkDatesForObservedAt(
            db,
            row.employeeId,
            row.observedAt
          );
          for (const dateKey of workDates) {
            await reconcileAttendanceDay(db, { employeeId: row.employeeId, workDate: dateKey });
          }
        }
      }
    }

    await db.biometricDevice.update({
      where: { id: device.id },
      data: { lastPollAt: now },
    });
  }

  await db.schedulerLock.upsert({
    where: { key: THROTTLE_LOCK_KEY },
    create: { key: THROTTLE_LOCK_KEY, lastRunAt: now },
    update: { lastRunAt: now },
  });

  return {
    skipped: false,
    intervalSeconds: intervalSec,
    devicesPolled,
    punchesInserted,
    punchAttemptCount,
  };
}
