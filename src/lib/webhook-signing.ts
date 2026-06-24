import { createHmac, timingSafeEqual } from 'node:crypto';

export const WEBHOOK_SIGNATURE_HEADER = 'x-stride-webhook-signature';

export function signWebhookPayload(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

export function formatWebhookSignature(digest: string): string {
  return `sha256=${digest}`;
}

export function verifyWebhookSignature(
  secret: string,
  body: string,
  header: string | null,
): boolean {
  if (!header?.trim()) return false;
  const provided = header.trim().replace(/^sha256=/i, '');
  const expected = signWebhookPayload(secret, body);
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(provided, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
