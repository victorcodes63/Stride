import type { PrismaClient } from '@prisma/client';

/** Allocate the next maintenance ticket number, e.g. MNT-0001. */
export async function allocateTicketNumber(
  prisma: PrismaClient,
  outsourcingClientId: string,
): Promise<string> {
  const count = await prisma.facilityMaintenanceTicket.count({ where: { outsourcingClientId } });
  return `MNT-${String(count + 1).padStart(4, '0')}`;
}
