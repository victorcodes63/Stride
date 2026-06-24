import type { PrismaClient } from '@prisma/client';

type LeaveDb = Pick<PrismaClient, 'staffLeaveBalance' | 'staffLeaveApplication'>;

/**
 * Recompute `usedDays` from approved applications only (cancelled/rejected/pending excluded).
 */
export async function syncStaffLeaveUsedDaysForUserYear(
  db: LeaveDb,
  userId: string,
  year: number,
): Promise<void> {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  const balances = await db.staffLeaveBalance.findMany({
    where: { userId, year },
    select: { id: true, leaveTypeId: true },
  });

  for (const bal of balances) {
    const agg = await db.staffLeaveApplication.aggregate({
      where: {
        userId,
        leaveTypeId: bal.leaveTypeId,
        status: 'approved',
        startDate: { gte: yearStart, lte: yearEnd },
      },
      _sum: { totalDays: true },
    });
    const usedDays = agg._sum.totalDays ?? 0;
    await db.staffLeaveBalance.update({
      where: { id: bal.id },
      data: { usedDays },
    });
  }
}

export async function syncStaffLeaveUsedDaysForUsersYear(
  db: LeaveDb,
  userIds: string[],
  year: number,
): Promise<void> {
  const unique = [...new Set(userIds)];
  for (const userId of unique) {
    await syncStaffLeaveUsedDaysForUserYear(db, userId, year);
  }
}
