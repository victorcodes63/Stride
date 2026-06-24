import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Run tenant-scoped work inside a transaction with app.current_org set (RAV-62).
 * Ported from platform/src/core/db/org-context.ts — RLS is ORM-agnostic.
 */
export async function withOrgContext<T>(
  organizationId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org', ${organizationId}, true)`;
    return fn(tx);
  });
}

export async function setOrgContext(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.current_org', ${organizationId}, true)`;
}
