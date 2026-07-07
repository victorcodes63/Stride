import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { setActiveOrganizationId } from '@/lib/tenant-context-store';

/**
 * Run tenant-scoped work inside a transaction with app.current_org set (RAV-62).
 * Ported from platform/src/core/db/org-context.ts — RLS is ORM-agnostic.
 */
export async function withOrgContext<T>(
  organizationId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number },
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      setActiveOrganizationId(organizationId);
      try {
        await tx.$executeRaw`SELECT set_config('app.current_org', ${organizationId}, true)`;
        return await fn(tx);
      } finally {
        setActiveOrganizationId(null);
      }
    },
    { timeout: options?.timeout ?? 5_000 },
  );
}

export async function setOrgContext(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.current_org', ${organizationId}, true)`;
}
