import type { FacilityLeaseStatus } from '@prisma/client';

const EXPIRING_SOON_DAYS = 90;

/** Derive lease display status from stored status and end date. */
export function resolveLeaseStatus(
  stored: FacilityLeaseStatus,
  endDate: Date,
  now = new Date(),
): FacilityLeaseStatus {
  if (stored === 'terminated') return 'terminated';
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  if (end < now) return 'expired';
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= EXPIRING_SOON_DAYS) return 'expiring_soon';
  return stored === 'expired' || stored === 'expiring_soon' ? 'active' : stored;
}

export function daysUntil(endDate: Date, now = new Date()) {
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
