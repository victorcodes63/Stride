import type { PrismaClient } from '@prisma/client';

export async function allocateMeetingCode(
  prisma: PrismaClient,
  outsourcingClientId: string,
): Promise<string> {
  const count = await prisma.governanceMeeting.count({ where: { outsourcingClientId } });
  return `MTG-${String(count + 1).padStart(4, '0')}`;
}

export async function allocateResolutionCode(
  prisma: PrismaClient,
  outsourcingClientId: string,
): Promise<string> {
  const count = await prisma.governanceResolution.count({ where: { outsourcingClientId } });
  return `RES-${String(count + 1).padStart(4, '0')}`;
}
