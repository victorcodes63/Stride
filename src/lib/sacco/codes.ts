import type { PrismaClient } from '@prisma/client';

export async function allocateMemberNumber(
  db: PrismaClient,
  outsourcingClientId: string,
): Promise<string> {
  const latest = await db.saccoMember.findFirst({
    where: { outsourcingClientId },
    orderBy: { memberNumber: 'desc' },
    select: { memberNumber: true },
  });

  const match = latest?.memberNumber?.match(/(\d+)$/);
  const next = match ? Number.parseInt(match[1], 10) + 1 : 1;
  return `MBR-${String(next).padStart(5, '0')}`;
}
