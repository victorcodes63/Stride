/**
 * Secure tokens for public quote e-accept links (B3).
 * Mirrors interview-token.ts: base64url(quoteId).base64url(hmac).
 */
import { createHmac, timingSafeEqual } from 'crypto';

const SECRET =
  process.env.QUOTE_ACCEPT_SECRET?.trim() ||
  process.env.INTERVIEW_CONFIRM_SECRET?.trim() ||
  process.env.DATABASE_URL?.slice(-32) ||
  'stride-quote-accept-fallback';

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (3 - (str.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

export function createQuoteAcceptToken(quoteId: string): string {
  const idBuf = Buffer.from(quoteId, 'utf8');
  const hmac = createHmac('sha256', SECRET).update(idBuf).digest();
  return `${base64UrlEncode(idBuf)}.${base64UrlEncode(hmac)}`;
}

export function verifyQuoteAcceptToken(token: string): string | null {
  try {
    const [idPart, sigPart] = token.split('.');
    if (!idPart || !sigPart) return null;
    const quoteId = base64UrlDecode(idPart).toString('utf8');
    const expectedHmac = createHmac('sha256', SECRET).update(Buffer.from(quoteId, 'utf8')).digest();
    const providedHmac = base64UrlDecode(sigPart);
    if (expectedHmac.length !== providedHmac.length || !timingSafeEqual(expectedHmac, providedHmac)) {
      return null;
    }
    return quoteId;
  } catch {
    return null;
  }
}
