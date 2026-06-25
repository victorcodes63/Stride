import type { PrismaClient } from '@prisma/client';

/** Allocate the next site code for a workspace client, e.g. SITE-0001. */
export async function allocateSiteCode(
  prisma: PrismaClient,
  outsourcingClientId: string,
): Promise<string> {
  const count = await prisma.facilitySite.count({ where: { outsourcingClientId } });
  return `SITE-${String(count + 1).padStart(4, '0')}`;
}
