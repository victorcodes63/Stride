import type { PrismaClient } from '@prisma/client';

/** Allocate the next project code for a workspace client, e.g. PRJ-0001. */
export async function allocateProjectCode(
  prisma: PrismaClient,
  outsourcingClientId: string,
): Promise<string> {
  const count = await prisma.project.count({ where: { outsourcingClientId } });
  return `PRJ-${String(count + 1).padStart(4, '0')}`;
}
