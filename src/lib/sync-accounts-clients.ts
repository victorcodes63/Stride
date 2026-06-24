import type { PrismaClient } from '@prisma/client';

const SEED_NAME_PREFIXES = ['[SEED_ACCOUNTS]', '[SEED_INVOICE]'] as const;

/**
 * Removes demo billing profiles and ensures every recruitment Client and OutsourcingClient
 * has exactly one AccountsClient row (factual name + contacts from source).
 */
export async function syncLinkedBillingClients(db: PrismaClient): Promise<{
  deletedDemoCount: number;
  recruitmentSynced: number;
  outsourcingSynced: number;
}> {
  const deleted = await db.accountsClient.deleteMany({
    where: {
      OR: SEED_NAME_PREFIXES.map((prefix) => ({ name: { startsWith: prefix } })),
    },
  });

  const settings = await db.recruitmentSettings.findUnique({ where: { id: 'default' } });
  const linkedId = settings?.linkedClientId ?? null;
  const recruitmentClients = linkedId
    ? await db.client.findMany({ where: { id: linkedId } })
    : [];
  let recruitmentSynced = 0;
  for (const c of recruitmentClients) {
    const existing = await db.accountsClient.findUnique({
      where: { recruitmentClientId: c.id },
    });
    const payload = {
      type: 'recruitment' as const,
      name: c.name,
      contactName: c.contactName,
      contactEmail: c.contactEmail,
      contactPhone: c.contactPhone,
      recruitmentClientId: c.id,
      outsourcingClientId: null,
    };
    if (existing) {
      await db.accountsClient.update({
        where: { id: existing.id },
        data: {
          name: payload.name,
          contactName: payload.contactName,
          contactEmail: payload.contactEmail,
          contactPhone: payload.contactPhone,
          type: 'recruitment',
          outsourcingClientId: null,
        },
      });
    } else {
      await db.accountsClient.create({
        data: {
          ...payload,
          currency: 'KES',
        },
      });
    }
    recruitmentSynced++;
  }

  const outsourcingClients = await db.outsourcingClient.findMany({ orderBy: { name: 'asc' } });
  let outsourcingSynced = 0;
  for (const c of outsourcingClients) {
    const existing = await db.accountsClient.findUnique({
      where: { outsourcingClientId: c.id },
    });
    const currency = (c.currency ?? 'KES').trim() || 'KES';
    const payload = {
      type: 'outsourcing' as const,
      name: c.name,
      contactName: c.contactName,
      contactEmail: c.contactEmail,
      contactPhone: c.contactPhone,
      outsourcingClientId: c.id,
      recruitmentClientId: null,
    };
    if (existing) {
      await db.accountsClient.update({
        where: { id: existing.id },
        data: {
          name: payload.name,
          currency,
          contactName: payload.contactName,
          contactEmail: payload.contactEmail,
          contactPhone: payload.contactPhone,
          type: 'outsourcing',
          recruitmentClientId: null,
        },
      });
    } else {
      await db.accountsClient.create({
        data: {
          ...payload,
          currency,
        },
      });
    }
    outsourcingSynced++;
  }

  return {
    deletedDemoCount: deleted.count,
    recruitmentSynced,
    outsourcingSynced,
  };
}
