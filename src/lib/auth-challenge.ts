import { createHmac, timingSafeEqual } from 'crypto';

type ChallengePayload = {
  userId: string;
  email: string;
  purpose: 'login_mfa';
  exp: number;
};

function getSigningSecret(): string {
  return process.env.AUTH_CHALLENGE_SECRET || process.env.NEXTAUTH_SECRET || 'dev-auth-challenge-secret';
}

function sign(data: string): string {
  return createHmac('sha256', getSigningSecret()).update(data).digest('base64url');
}

export function createAuthChallengeToken(payload: ChallengePayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifyAuthChallengeToken(
  token: string,
  purpose: ChallengePayload['purpose'],
): ChallengePayload | null {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const sigA = Buffer.from(signature);
  const sigB = Buffer.from(expected);
  if (sigA.length !== sigB.length || !timingSafeEqual(sigA, sigB)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ChallengePayload;
    if (payload.purpose !== purpose || !payload.userId || !payload.email) return null;
    if (!Number.isFinite(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
