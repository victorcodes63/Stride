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

/** Cookie name used to carry Remember-me across the OAuth round-trip. */
export const ESS_REMEMBER_COOKIE = 'ess_remember';

/**
 * Session cookie options for ESS.
 * Remember me → persistent maxAge on this device; otherwise a session cookie
 * (cleared when the browser/app session ends).
 */
export function getEssSessionCookieOptions(rememberMe: boolean) {
  const base = {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
  if (rememberMe) {
    return { ...base, maxAge: getEssSessionMaxAgeSeconds() };
  }
  return base;
}

export function parseRememberMeFlag(value: unknown): boolean {
  return value === true || value === '1' || value === 'true';
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
