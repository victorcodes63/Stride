import type { UserRole } from '@prisma/client';
import { isUuid } from '@/lib/staff-session-cookie';

export interface ParsedStaffSession {
  provider: 'local' | 'ms' | 'google' | 'unknown';
  userId?: string;
  currentOrgId?: string;
  role?: string;
  email?: string;
  issuedAt?: number;
}

export function getStaffSessionMaxAgeSeconds() {
  const rawDays = Number(process.env.STAFF_SESSION_DAYS || 7);
  const safeDays = Number.isFinite(rawDays) && rawDays > 0 ? rawDays : 7;
  return Math.round(safeDays * 24 * 60 * 60);
}

function parseIssuedAt(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

export function parseStaffSession(value: string): ParsedStaffSession {
  if (!value) return { provider: 'unknown' };

  const parts = value.split(':');
  const provider = parts[0];

  if (provider === 'local' && parts.length >= 3) {
    if (parts[2] && isUuid(parts[2]) && parts.length >= 4) {
      return {
        provider: 'local',
        userId: parts[1],
        currentOrgId: parts[2],
        role: parts[3],
        issuedAt: parseIssuedAt(parts[4]),
      };
    }
    return {
      provider: 'local',
      userId: parts[1],
      role: parts[2] as UserRole,
      issuedAt: parseIssuedAt(parts[3]),
    };
  }

  if ((provider === 'ms' || provider === 'google') && parts.length >= 4) {
    if (parts[2] && isUuid(parts[2]) && parts.length >= 5) {
      const maybeIssuedAt = parts[parts.length - 1];
      const hasIssuedAt = !!maybeIssuedAt && /^\d+$/.test(maybeIssuedAt);
      return {
        provider,
        userId: parts[1],
        currentOrgId: parts[2],
        role: parts[3],
        email: parts.slice(4, hasIssuedAt ? -1 : undefined).join(':'),
        issuedAt: hasIssuedAt ? Number(maybeIssuedAt) : undefined,
      };
    }
    const maybeIssuedAt = parts[parts.length - 1];
    const hasIssuedAt = !!maybeIssuedAt && /^\d+$/.test(maybeIssuedAt);
    return {
      provider,
      userId: parts[1],
      role: parts[2],
      email: parts.slice(3, hasIssuedAt ? -1 : undefined).join(':'),
      issuedAt: hasIssuedAt ? Number(maybeIssuedAt) : undefined,
    };
  }

  return { provider: 'unknown' };
}
