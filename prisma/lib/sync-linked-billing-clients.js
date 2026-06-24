/**
 * Keep in sync with src/lib/sync-accounts-clients.ts (used by Next API).
 * Shared by prisma seeds and db:sync-accounts-clients.
 */

const SEED_PREFIXES = ['[SEED_ACCOUNTS]', '[SEED_INVOICE]'];

async function syncLinkedBillingClients(prisma) {
  const deleted = await prisma.accountsClient.deleteMany({
    where: {
      OR: SEED_PREFIXES.map((prefix) => ({ name: { startsWith: prefix } })),
    },
  });

  const settings = await prisma.recruitmentSettings.findUnique({ where: { id: 'default' } });
  const linkedId = settings && settings.linkedClientId ? settings.linkedClientId : null;
  const recruitmentClients = linkedId
    ? await prisma.client.findMany({ where: { id: linkedId } })
    : [];
  for (const c of recruitmentClients) {
    const existing = await prisma.accountsClient.findUnique({
      where: { recruitmentClientId: c.id },
    });
    if (existing) {
      await prisma.accountsClient.update({
        where: { id: existing.id },
        data: {
          name: c.name,
          contactName: c.contactName,
          contactEmail: c.contactEmail,
          contactPhone: c.contactPhone,
          type: 'recruitment',
          outsourcingClientId: null,
        },
      });
    } else {
      await prisma.accountsClient.create({
        data: {
          type: 'recruitment',
          name: c.name,
          currency: 'KES',
          contactName: c.contactName,
          contactEmail: c.contactEmail,
          contactPhone: c.contactPhone,
          recruitmentClientId: c.id,
          outsourcingClientId: null,
        },
      });
    }
  }

  const outsourcingClients = await prisma.outsourcingClient.findMany({ orderBy: { name: 'asc' } });
  for (const c of outsourcingClients) {
    const existing = await prisma.accountsClient.findUnique({
      where: { outsourcingClientId: c.id },
    });
    const currency = (c.currency && String(c.currency).trim()) || 'KES';
    if (existing) {
      await prisma.accountsClient.update({
        where: { id: existing.id },
        data: {
          name: c.name,
          currency,
          contactName: c.contactName,
          contactEmail: c.contactEmail,
          contactPhone: c.contactPhone,
          type: 'outsourcing',
          recruitmentClientId: null,
        },
      });
    } else {
      await prisma.accountsClient.create({
        data: {
          type: 'outsourcing',
          name: c.name,
          currency,
          contactName: c.contactName,
          contactEmail: c.contactEmail,
          contactPhone: c.contactPhone,
          outsourcingClientId: c.id,
          recruitmentClientId: null,
        },
      });
    }
  }

  return {
    deletedDemoCount: deleted.count,
    recruitmentSynced: recruitmentClients.length,
    outsourcingSynced: outsourcingClients.length,
  };
}

module.exports = { syncLinkedBillingClients, SEED_PREFIXES };
