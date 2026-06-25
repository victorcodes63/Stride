import type { EnergyPermitStatus } from '@prisma/client';

const EXPIRING_SOON_DAYS = 60;

export function derivePermitStatus(expiresAt: Date, now = new Date()): EnergyPermitStatus {
  const today = new Date(now.toISOString().slice(0, 10));
  const expiry = new Date(expiresAt.toISOString().slice(0, 10));
  if (expiry < today) return 'expired';

  const soon = new Date(today);
  soon.setDate(soon.getDate() + EXPIRING_SOON_DAYS);
  if (expiry <= soon) return 'expiring_soon';

  return 'active';
}
