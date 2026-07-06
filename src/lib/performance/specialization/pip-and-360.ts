import type { Prisma } from '@prisma/client';

export async function createPip(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    employeeId: string;
    cycleId?: string | null;
    reviewId?: string | null;
    startDate: Date;
    endDate: Date;
    goals?: unknown;
    notes?: string | null;
  },
) {
  return tx.performancePip.create({
    data: {
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      cycleId: input.cycleId ?? null,
      reviewId: input.reviewId ?? null,
      status: 'draft',
      startDate: input.startDate,
      endDate: input.endDate,
      goals: input.goals ?? [],
      notes: input.notes ?? null,
    },
  });
}

export async function activatePip(tx: Prisma.TransactionClient, organizationId: string, pipId: string) {
  const pip = await tx.performancePip.findFirst({ where: { id: pipId, organizationId } });
  if (!pip) throw new Error('PIP not found');
  return tx.performancePip.update({
    where: { id: pipId },
    data: { status: 'active' },
  });
}

export async function add360Raters(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    reviewId: string;
    raters: Array<{ raterEmployeeId: string; relationship: string }>;
  },
) {
  const review = await tx.performanceReview.findFirst({
    where: { id: input.reviewId, organizationId: input.organizationId },
    include: { cycle: true },
  });
  if (!review) throw new Error('Review not found');
  if (review.cycle.cycleKind !== 'multi_rater_360') {
    throw new Error('360 raters can only be added to multi_rater_360 cycles');
  }

  await tx.performanceRater.createMany({
    data: input.raters.map((r) => ({
      organizationId: input.organizationId,
      reviewId: input.reviewId,
      raterEmployeeId: r.raterEmployeeId,
      relationship: r.relationship,
    })),
    skipDuplicates: true,
  });

  return tx.performanceRater.findMany({
    where: { reviewId: input.reviewId, organizationId: input.organizationId },
  });
}
