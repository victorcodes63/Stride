export interface ParsedEssSession {
  provider: 'local' | 'ms' | 'google' | 'unknown';
  userId?: string;
  role?: string;
  email?: string;
}

export function getEssSessionMaxAgeSeconds() {
  const rawDays = Number(process.env.ESS_SESSION_DAYS || 7);
  const safeDays = Number.isFinite(rawDays) && rawDays > 0 ? rawDays : 7;
  return Math.round(safeDays * 24 * 60 * 60);
}

export function parseEssSession(value: string): ParsedEssSession {
  if (!value) return { provider: 'unknown' };
  const parts = value.split(':');
  const head = parts[0];
  if (head === 'local' && parts.length >= 3) {
    return { provider: 'local', userId: parts[1], role: parts[2] };
  }
  if ((head === 'ms' || head === 'google') && parts.length >= 4) {
    return {
      provider: head,
      userId: parts[1],
      role: parts[2],
      email: parts.slice(3).join(':'),
    };
  }
  return { provider: 'unknown' };
}
