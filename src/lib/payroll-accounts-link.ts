import { prisma } from '@/lib/prisma';

/** Maps outsourcing client id → AccountsClient id when a billing profile is linked. */
export async function mapOutsourcingClientsToAccountsClients(
  outsourcingClientIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(outsourcingClientIds.filter(Boolean))];
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const rows = await prisma.accountsClient.findMany({
    where: { outsourcingClientId: { in: ids } },
    select: { id: true, outsourcingClientId: true },
  });
  for (const r of rows) {
    if (r.outsourcingClientId) out.set(r.outsourcingClientId, r.id);
  }
  return out;
}
