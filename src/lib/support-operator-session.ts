import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_MS = 15 * 60 * 1000;

export type SupportOperatorTokenPayload = {
  organizationId: string;
  operatorEmail: string;
  operatorName: string;
  customerSlug: string;
  exp: number;
};

function provisionSecret(): string | null {
  return process.env.STRIDE_CELL_PROVISION_KEY?.trim() || null;
}

function signPayload(encoded: string, secret: string): string {
  return createHmac('sha256', secret).update(encoded).digest('base64url');
}

export function mintSupportOperatorToken(input: {
  organizationId: string;
  operatorEmail: string;
  operatorName: string;
  customerSlug: string;
}): { token: string; expiresAt: string } | null {
  const secret = provisionSecret();
  if (!secret) return null;

  const payload: SupportOperatorTokenPayload = {
    organizationId: input.organizationId,
    operatorEmail: input.operatorEmail.trim().toLowerCase(),
    operatorName: input.operatorName.trim(),
    customerSlug: input.customerSlug.trim(),
    exp: Date.now() + TOKEN_TTL_MS,
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = signPayload(encoded, secret);
  return { token: `${encoded}.${sig}`, expiresAt: new Date(payload.exp).toISOString() };
}

export function verifySupportOperatorToken(token: string): SupportOperatorTokenPayload | null {
  const secret = provisionSecret();
  if (!secret) return null;

  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const expected = signPayload(encoded, secret);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SupportOperatorTokenPayload;
    if (!payload.organizationId || !payload.operatorEmail || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildSupportOperatorDashboardUrl(baseUrl: string, token: string): string {
  const root = baseUrl.replace(/\/$/, '');
  return `${root}/dashboard?supportOperator=${encodeURIComponent(token)}`;
}

export function randomSupportAuditId(): string {
  return randomBytes(8).toString('hex');
}
