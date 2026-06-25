import type { PrismaClient } from '@prisma/client';

/** Allocate the next HSE incident number, e.g. INC-2026-0001. */
export async function allocateIncidentNumber(
  prisma: PrismaClient,
  outsourcingClientId: string,
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `INC-${year}-`;
  const count = await prisma.hseIncident.count({
    where: {
      outsourcingClientId,
      incidentNumber: { startsWith: prefix },
    },
  });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}
