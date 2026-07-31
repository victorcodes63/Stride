/**
 * Public partner order-status links (FMCG OTC).
 * Token is a random opaque value stored on SalesOrder.publicStatusToken.
 * Resolve organizationId via bootstrap lookup, then run reads inside withOrgContext
 * so app.current_org / RLS is set (same shape as withQuoteAcceptContext).
 */
import type { Prisma } from '@prisma/client';
import { withOrgContext } from '@/lib/org-context';
import { prisma } from '@/lib/prisma';

export type OrderStatusContext = {
  tx: Prisma.TransactionClient;
  orderId: string;
  organizationId: string;
};

export type OrderStatusResolveFailure = 'invalid_token' | 'not_found';

/**
 * Public order-status DB entrypoint: validate token → bootstrap org → withOrgContext.
 * All Prisma reads for the partner status flow must run inside `fn` on `tx`.
 */
export async function withOrderStatusContext<T>(
  token: string,
  fn: (ctx: OrderStatusContext) => Promise<T>,
  options?: { timeout?: number },
): Promise<{ ok: true; result: T } | { ok: false; reason: OrderStatusResolveFailure }> {
  const trimmed = token?.trim() ?? '';
  if (!trimmed || trimmed.length < 16) return { ok: false, reason: 'invalid_token' };

  // Bootstrap only: resolve tenant before RLS session var is set.
  const bootstrap = await prisma.salesOrder.findFirst({
    where: { publicStatusToken: trimmed },
    select: { id: true, organizationId: true },
  });
  if (!bootstrap) return { ok: false, reason: 'not_found' };

  const result = await withOrgContext(
    bootstrap.organizationId,
    (tx) => fn({ tx, orderId: bootstrap.id, organizationId: bootstrap.organizationId }),
    { timeout: options?.timeout ?? 15_000 },
  );
  return { ok: true, result };
}
