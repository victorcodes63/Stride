export interface ParsedStaffSession {
  provider: 'local' | 'ms' | 'google' | 'unknown';
  userId?: string;
  role?: string;
  email?: string;
  issuedAt?: number;
}

export function getStaffSessionMaxAgeSeconds() {
  const rawDays = Number(process.env.STAFF_SESSION_DAYS || 7);
  const safeDays = Number.isFinite(rawDays) && rawDays > 0 ? rawDays : 7;
  return Math.round(safeDays * 24 * 60 * 60);
}

export function parseStaffSession(value: string): ParsedStaffSession {
  if (!value) return { provider: 'unknown' };

  const parts = value.split(':');
  const provider = parts[0];

  if (provider === 'local' && parts.length >= 3) {
    return {
      provider: 'local',
      userId: parts[1],
      role: parts[2],
      issuedAt: parts[3] && /^\d+$/.test(parts[3]) ? Number(parts[3]) : undefined,
    };
  }

  if (provider === 'ms' && parts.length >= 4) {
    const maybeIssuedAt = parts[parts.length - 1];
    const hasIssuedAt = !!maybeIssuedAt && /^\d+$/.test(maybeIssuedAt);
    return {
      provider: 'ms',
      userId: parts[1],
      role: parts[2],
      email: parts.slice(3, hasIssuedAt ? -1 : undefined).join(':'),
      issuedAt: hasIssuedAt ? Number(maybeIssuedAt) : undefined,
    };
  }

  if (provider === 'google' && parts.length >= 4) {
    const maybeIssuedAt = parts[parts.length - 1];
    const hasIssuedAt = !!maybeIssuedAt && /^\d+$/.test(maybeIssuedAt);
    return {
      provider: 'google',
      userId: parts[1],
      role: parts[2],
      email: parts.slice(3, hasIssuedAt ? -1 : undefined).join(':'),
      issuedAt: hasIssuedAt ? Number(maybeIssuedAt) : undefined,
    };
  }

  return { provider: 'unknown' };
}
