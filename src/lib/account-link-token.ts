/**
 * Signed tokens for account invite and password-reset links.
 * Never embed passwords — links only.
 */
import { createHmac, timingSafeEqual } from 'crypto';

export type AccountLinkPurpose =
  | 'staff_set_password'
  | 'staff_reset_password'
  | 'ess_set_password'
  | 'ess_reset_password';

type AccountLinkPayload = {
  userId: string;
  email: string;
  purpose: AccountLinkPurpose;
  exp: number;
};

function getSigningSecret(): string {
  return (
    process.env.ACCOUNT_LINK_SECRET?.trim() ||
    process.env.AUTH_CHALLENGE_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    'dev-account-link-secret'
  );
}

function sign(data: string): string {
  return createHmac('sha256', getSigningSecret()).update(data).digest('base64url');
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 48; // 48 hours

export function createAccountLinkToken(params: {
  userId: string;
  email: string;
  purpose: AccountLinkPurpose;
  ttlSeconds?: number;
}): string {
  const payload: AccountLinkPayload = {
    userId: params.userId,
    email: params.email.trim().toLowerCase(),
    purpose: params.purpose,
    exp: Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? DEFAULT_TTL_SECONDS),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function verifyAccountLinkToken(
  token: string,
  purpose: AccountLinkPurpose,
): AccountLinkPayload | null {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const sigA = Buffer.from(signature);
  const sigB = Buffer.from(expected);
  if (sigA.length !== sigB.length || !timingSafeEqual(sigA, sigB)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AccountLinkPayload;
    if (payload.purpose !== purpose || !payload.userId || !payload.email) return null;
    if (!Number.isFinite(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getAccountLinkPath(purpose: AccountLinkPurpose, token: string): string {
  const q = encodeURIComponent(token);
  switch (purpose) {
    case 'staff_set_password':
    case 'staff_reset_password':
      return `/dashboard/reset-password?token=${q}`;
    case 'ess_set_password':
    case 'ess_reset_password':
      return `/ess/reset-password?token=${q}`;
    default:
      return `/dashboard/reset-password?token=${q}`;
  }
}
