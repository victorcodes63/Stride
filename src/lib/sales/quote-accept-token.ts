/**
 * Secure tokens for public quote e-accept links (B3).
 * Mirrors interview-token.ts: base64url(quoteId).base64url(hmac).
 *
 * Tenant scoping for the public accept route mirrors careers/applications public
 * POST: resolve organizationId from the signed entity id, then run all DB work
 * inside withOrgContext so app.current_org / RLS is set. (Interview /respond is
 * grandfathered unscoped via ROUTE_EXEMPT_PREFIXES — new routes must not copy that.)
 */
import { createHmac, timingSafeEqual } from 'crypto';
import type { Prisma } from '@prisma/client';
import { withOrgContext } from '@/lib/org-context';
import { prisma } from '@/lib/prisma';

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

export type QuoteAcceptContext = {
  tx: Prisma.TransactionClient;
  quoteId: string;
  organizationId: string;
};

export type QuoteAcceptResolveFailure = 'invalid_token' | 'not_found';

/**
 * Public e-accept DB entrypoint: verify HMAC → bootstrap organizationId → withOrgContext.
 * All Prisma reads/writes for the accept flow must run inside `fn` on `tx`.
 */
export async function withQuoteAcceptContext<T>(
  token: string,
  fn: (ctx: QuoteAcceptContext) => Promise<T>,
  options?: { timeout?: number },
): Promise<{ ok: true; result: T } | { ok: false; reason: QuoteAcceptResolveFailure }> {
  const quoteId = verifyQuoteAcceptToken(token);
  if (!quoteId) return { ok: false, reason: 'invalid_token' };

  // Bootstrap only: resolve tenant before RLS session var is set (same shape as
  // public applications POST jobBootstrap → withOrgContext).
  const bootstrap = await prisma.salesQuote.findUnique({
    where: { id: quoteId },
    select: { organizationId: true },
  });
  if (!bootstrap) return { ok: false, reason: 'not_found' };

  const result = await withOrgContext(
    bootstrap.organizationId,
    (tx) => fn({ tx, quoteId, organizationId: bootstrap.organizationId }),
    { timeout: options?.timeout ?? 15_000 },
  );
  return { ok: true, result };
}
