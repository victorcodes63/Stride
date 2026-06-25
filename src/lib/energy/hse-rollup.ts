import type { PrismaClient } from '@prisma/client';

export type EnergyHseRollupRow = {
  entityLabel: string;
  clientId: string;
  clientName: string;
  siteCount: number;
  openIncidents: number;
  highSeverity: number;
  permitsExpiring: number;
};

export async function buildEnergyHseRollup(
  db: PrismaClient,
  organizationId: string,
): Promise<EnergyHseRollupRow[]> {
  const clients = await db.outsourcingClient.findMany({
    where: { organizationId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const soon = new Date();
  soon.setDate(soon.getDate() + 60);

  const rows: EnergyHseRollupRow[] = [];

  for (const client of clients) {
    const sites = await db.energySite.findMany({
      where: { outsourcingClientId: client.id, isActive: true },
      select: { operatingEntityLabel: true },
    });

    if (sites.length === 0) continue;

    const entityLabel =
      sites.find((s) => s.operatingEntityLabel?.trim())?.operatingEntityLabel?.trim() ??
      client.name;

    const [openIncidents, highSeverity, permitsExpiring] = await Promise.all([
      db.hseIncident.count({
        where: { outsourcingClientId: client.id, status: { in: ['open', 'investigating'] } },
      }),
      db.hseIncident.count({
        where: {
          outsourcingClientId: client.id,
          severity: { in: ['high', 'critical'] },
          status: { not: 'closed' },
        },
      }),
      db.energyPermit.count({
        where: {
          outsourcingClientId: client.id,
          expiresAt: { lte: soon },
          status: { in: ['active', 'expiring_soon'] },
        },
      }),
    ]);

    rows.push({
      entityLabel,
      clientId: client.id,
      clientName: client.name,
      siteCount: sites.length,
      openIncidents,
      highSeverity,
      permitsExpiring,
    });
  }

  return rows;
}
