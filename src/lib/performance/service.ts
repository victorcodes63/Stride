import type { Prisma } from '@prisma/client';

export const DEFAULT_RATING_DIMENSIONS = [
  'Quality of work',
  'Team collaboration',
  'Goal achievement',
  'Communication',
] as const;

export const DEFAULT_GOAL_TEMPLATES = [
  { title: 'Deliver role KPIs on time', weightPercent: 50 },
  { title: 'Complete compliance and training requirements', weightPercent: 50 },
] as const;

export function ratingLabel(score: number | null | undefined): string {
  if (score == null) return 'Not rated';
  if (score >= 5) return 'Exceptional';
  if (score >= 4) return 'Exceeds expectations';
  if (score >= 3) return 'Meets expectations';
  if (score >= 2) return 'Needs improvement';
  return 'Unsatisfactory';
}

export type PerformanceReviewDto = {
  id: string;
  cycleId: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  departmentName: string | null;
  status: string;
  overallSelfRating: number | null;
  overallManagerRating: number | null;
  selfSubmittedAt: string | null;
  managerSubmittedAt: string | null;
};

export function serializeReview(
  review: {
    id: string;
    cycleId: string;
    employeeId: string;
    status: string;
    overallSelfRating: number | null;
    overallManagerRating: number | null;
    selfSubmittedAt: Date | null;
    managerSubmittedAt: Date | null;
    employee: {
      firstName: string;
      lastName: string;
      employeeNumber: string | null;
      department: { name: string } | null;
    };
  },
): PerformanceReviewDto {
  return {
    id: review.id,
    cycleId: review.cycleId,
    employeeId: review.employeeId,
    employeeName: `${review.employee.firstName} ${review.employee.lastName}`.trim(),
    employeeNumber: review.employee.employeeNumber,
    departmentName: review.employee.department?.name ?? null,
    status: review.status,
    overallSelfRating: review.overallSelfRating,
    overallManagerRating: review.overallManagerRating,
    selfSubmittedAt: review.selfSubmittedAt?.toISOString() ?? null,
    managerSubmittedAt: review.managerSubmittedAt?.toISOString() ?? null,
  };
}

export async function activatePerformanceCycle(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    cycleId: string;
    maxEmployees?: number;
  },
) {
  const cycle = await tx.performanceCycle.findFirst({
    where: { id: input.cycleId, organizationId: input.organizationId },
  });
  if (!cycle) return { ok: false as const, error: 'Cycle not found' };
  if (cycle.status !== 'draft') {
    return { ok: false as const, error: 'Only draft cycles can be activated' };
  }

  const employees = await tx.employee.findMany({
    where: {
      organizationId: input.organizationId,
      employmentStatus: 'active',
      ...(cycle.outsourcingClientId ? { outsourcingClientId: cycle.outsourcingClientId } : {}),
    },
    select: {
      id: true,
      managerEmployeeId: true,
    },
    orderBy: { lastName: 'asc' },
    take: input.maxEmployees ?? 500,
  });

  if (employees.length === 0) {
    return { ok: false as const, error: 'No active employees in scope for this cycle' };
  }

  const adminUser = await tx.user.findFirst({
    where: { role: 'admin', isActive: true },
    select: { id: true },
  });

  for (const employee of employees) {
    await tx.performanceReview.create({
      data: {
        organizationId: input.organizationId,
        cycleId: cycle.id,
        employeeId: employee.id,
        managerUserId: adminUser?.id ?? null,
        status: 'not_started',
        ratings: {
          create: DEFAULT_RATING_DIMENSIONS.map((dimension, sortOrder) => ({
            organizationId: input.organizationId,
            dimension,
            sortOrder,
          })),
        },
      },
    });

    await tx.performanceGoal.createMany({
      data: DEFAULT_GOAL_TEMPLATES.map((goal, sortOrder) => ({
        organizationId: input.organizationId,
        cycleId: cycle.id,
        employeeId: employee.id,
        title: goal.title,
        weightPercent: goal.weightPercent,
        sortOrder,
      })),
    });
  }

  await tx.performanceCycle.update({
    where: { id: cycle.id },
    data: { status: 'active', activatedAt: new Date() },
  });

  return { ok: true as const, employeeCount: employees.length };
}

export async function closePerformanceCycle(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; cycleId: string },
) {
  const cycle = await tx.performanceCycle.findFirst({
    where: { id: input.cycleId, organizationId: input.organizationId },
  });
  if (!cycle) return { ok: false as const, error: 'Cycle not found' };
  if (cycle.status !== 'active') {
    return { ok: false as const, error: 'Only active cycles can be closed' };
  }

  await tx.performanceCycle.update({
    where: { id: cycle.id },
    data: { status: 'closed', closedAt: new Date() },
  });

  return { ok: true as const };
}
