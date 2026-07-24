/**
 * Resolve AccountsClient for CRM→Finance/delivery handoffs (B4).
 * Single lookup path — do not re-derive client joins elsewhere.
 */
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export type ResolvedAccountsClient = {
  id: string;
  name: string;
  currency: string;
  outsourcingClientId: string | null;
  paymentTerms: string | null;
};

export async function resolveAccountsClient(
  tx: Tx,
  organizationId: string,
  accountsClientId: string | null | undefined,
): Promise<ResolvedAccountsClient | null> {
  if (!accountsClientId?.trim()) return null;
  const client = await tx.accountsClient.findFirst({
    where: { id: accountsClientId, organizationId },
    select: {
      id: true,
      name: true,
      currency: true,
      outsourcingClientId: true,
      outsourcingClient: { select: { paymentTerms: true } },
    },
  });
  if (!client) return null;
  return {
    id: client.id,
    name: client.name,
    currency: client.currency,
    outsourcingClientId: client.outsourcingClientId,
    paymentTerms: client.outsourcingClient?.paymentTerms ?? null,
  };
}
