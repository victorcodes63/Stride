import type { Prisma } from '@prisma/client';
import {
  reconcileStaffAttendanceDay,
  resolveStaffReconcileWorkDatesForObservedAt,
} from '@/lib/staff-time-attendance/reconciliation';

type Tx = Prisma.TransactionClient;

export type MaterializablePunch = {
  id: string;
  userId: string;
  observedAt: Date;
  direction: 'in' | 'out' | 'unknown';
};

function toWorkDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/**
 * For each staff punch already mapped to a User, create the corresponding
 * `StaffAttendanceEvent` (source `biometric`, kind derived from direction) and
 * re-reconcile every affected work-date's day summary.
 *
 * Idempotent per punch: a punch that already has an attendance event is skipped,
 * so re-running (e.g. CSV re-import, subject re-mapping) never double-counts.
 * Must be called inside a tenant `ctx.run` / `withOrgContext` transaction.
 */
export async function materializeStaffPunches(
  tx: Tx,
  organizationId: string,
  punches: MaterializablePunch[],
  actorUserId: string | null,
): Promise<{ eventsCreated: number; datesReconciled: number }> {
  let eventsCreated = 0;
  const reconciled = new Set<string>();

  for (const punch of punches) {
    if (!punch.userId) continue;

    const existing = await tx.staffAttendanceEvent.findFirst({
      where: { staffBiometricPunchId: punch.id },
      select: { id: true },
    });
    if (existing) continue;

    const workDateYmd = punch.observedAt.toISOString().slice(0, 10);
    await tx.staffAttendanceEvent.create({
      data: {
        organizationId,
        userId: punch.userId,
        observedAt: punch.observedAt,
        workDate: toWorkDate(workDateYmd),
        source: 'biometric',
        kind: punch.direction === 'out' ? 'check_out' : 'check_in',
        staffBiometricPunchId: punch.id,
        createdByUserId: actorUserId,
      },
    });
    eventsCreated += 1;

    const dates = await resolveStaffReconcileWorkDatesForObservedAt(tx, punch.userId, punch.observedAt);
    for (const date of dates) {
      const key = `${punch.userId}:${date}`;
      if (reconciled.has(key)) continue;
      reconciled.add(key);
      await reconcileStaffAttendanceDay(tx, organizationId, {
        userId: punch.userId,
        workDate: date,
        actorUserId,
      });
    }
  }

  return { eventsCreated, datesReconciled: reconciled.size };
}
