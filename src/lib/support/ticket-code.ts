import type { Prisma } from '@prisma/client';

/** Allocate the next org-scoped support ticket number, e.g. SUP-0001. */
export async function allocateSupportTicketNumber(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<string> {
  const count = await tx.supportTicket.count({ where: { organizationId } });
  return `SUP-${String(count + 1).padStart(4, '0')}`;
}
