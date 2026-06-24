/**
 * Secure tokens for interview confirmation/reschedule links.
 * Token format: base64url(interviewId).base64url(hmac) - so the link can't be forged.
 */
import { createHmac, timingSafeEqual } from 'crypto';

const SECRET =
  process.env.INTERVIEW_CONFIRM_SECRET?.trim() ||
  process.env.DATABASE_URL?.slice(-32) ||
  'hris-interview-confirm-fallback';

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (3 - (str.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

export function createInterviewToken(interviewId: string): string {
  const idBuf = Buffer.from(interviewId, 'utf8');
  const hmac = createHmac('sha256', SECRET).update(idBuf).digest();
  return `${base64UrlEncode(idBuf)}.${base64UrlEncode(hmac)}`;
}

export function verifyInterviewToken(token: string): string | null {
  try {
    const [idPart, sigPart] = token.split('.');
    if (!idPart || !sigPart) return null;
    const interviewId = base64UrlDecode(idPart).toString('utf8');
    const expectedHmac = createHmac('sha256', SECRET).update(Buffer.from(interviewId, 'utf8')).digest();
    const providedHmac = base64UrlDecode(sigPart);
    if (expectedHmac.length !== providedHmac.length || !timingSafeEqual(expectedHmac, providedHmac)) {
      return null;
    }
    return interviewId;
  } catch {
    return null;
  }
}
