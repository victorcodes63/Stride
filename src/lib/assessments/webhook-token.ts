import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signed, self-describing token embedded in provider callback URLs so an
 * unauthenticated webhook can resolve its tenant (org) before RLS context is set,
 * without any cross-tenant database read.
 * Format: base64url(orgId).base64url(hmac)
 */
function secret(): string {
  return (
    process.env.ASSESSMENT_WEBHOOK_SECRET?.trim() ||
    process.env.CREDENTIALS_ENC_KEY?.trim() ||
    'stride-assessment-webhook'
  );
}

export function signOrgWebhookToken(organizationId: string): string {
  const payload = Buffer.from(organizationId, 'utf8').toString('base64url');
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyOrgWebhookToken(token: string): string | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret()).update(payload).digest('base64url');
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return Buffer.from(payload, 'base64url').toString('utf8');
}
