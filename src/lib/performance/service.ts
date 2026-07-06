import type { Prisma } from '@prisma/client';

import {
  buildFrozenSnapshot,
  computeReviewScores,
  resolveScorecardForEmployee,
} from '@/lib/performance/scoring/compute-bsc-score';

export const DEFAULT_RATING_DIMENSIONS = [
  'Quality of work',
  'Team collaboration',
  'Goal achievement',
  'Communication',
] as const;

export type GoalTemplateInput = { title: string; weightPercent: number; description?: string };

export function parseCycleGoalTemplates(raw: unknown): GoalTemplateInput[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_GOAL_TEMPLATES.map((g) => ({ ...g }));
  }
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      title: String(item.title ?? 'Goal').trim(),
      weightPercent: Number(item.weightPercent ?? 25),
      description: typeof item.description === 'string' ? item.description : undefined,
    }))
    .filter((g) => g.title.length > 0);
}

export function parseCycleRatingDimensions(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...DEFAULT_RATING_DIMENSIONS];
  return raw.map((d) => String(d).trim()).filter(Boolean);
}

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

/** Resolve staff User id for an employee's line manager (email match), else fallback. */
export async function resolveManagerUserId(
  tx: Prisma.TransactionClient,
  managerEmployeeId: string | null | undefined,
  fallbackUserId: string | null,
): Promise<string | null> {
  if (!managerEmployeeId) return fallbackUserId;
  const manager = await tx.employee.findFirst({
    where: { id: managerEmployeeId },
    select: { email: true },
  });
  if (!manager?.email?.trim()) return fallbackUserId;
  const user = await tx.user.findFirst({
    where: { email: { equals: manager.email.trim(), mode: 'insensitive' }, isActive: true },
    select: { id: true },
  });
  return user?.id ?? fallbackUserId;
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

  const goalTemplates = parseCycleGoalTemplates(cycle.goalTemplates);
  const ratingDimensions = parseCycleRatingDimensions(cycle.ratingDimensions);

  const employees = await tx.employee.findMany({
    where: {
      organizationId: input.organizationId,
      employmentStatus: 'active',
      ...(cycle.outsourcingClientId ? { outsourcingClientId: cycle.outsourcingClientId } : {}),
    },
    select: {
      id: true,
      managerEmployeeId: true,
      jobTitle: true,
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
    const managerUserId = await resolveManagerUserId(
      tx,
      employee.managerEmployeeId,
      adminUser?.id ?? null,
    );

    const useBsc = cycle.method === 'bsc';
    const scorecardMatch = useBsc
      ? await resolveScorecardForEmployee(tx, {
          organizationId: input.organizationId,
          jobTitle: employee.jobTitle,
        })
      : null;

    const snapshot = scorecardMatch ? buildFrozenSnapshot(scorecardMatch.template) : null;

    const review = await tx.performanceReview.create({
      data: {
        organizationId: input.organizationId,
        cycleId: cycle.id,
        employeeId: employee.id,
        managerUserId,
        scorecardTemplateId: scorecardMatch?.template.id ?? null,
        jobDescriptionId: scorecardMatch?.jd.id ?? null,
        jobDescriptionVersion: scorecardMatch?.jd.version ?? null,
        frozenScorecardSnapshot: snapshot ?? undefined,
        status: 'not_started',
        ratings: scorecardMatch
          ? {
              create: scorecardMatch.template.competencyReqs.map((competency, sortOrder) => ({
                organizationId: input.organizationId,
                dimension: competency.name,
                requiredLevel: competency.requiredLevel,
                competencyRequirementId: competency.id,
                sortOrder,
              })),
            }
          : {
              create: ratingDimensions.map((dimension, sortOrder) => ({
                organizationId: input.organizationId,
                dimension,
                sortOrder,
              })),
            },
      },
    });

    if (scorecardMatch && snapshot) {
      await tx.performanceGoal.createMany({
        data: scorecardMatch.template.measures.map((measure, sortOrder) => ({
          organizationId: input.organizationId,
          cycleId: cycle.id,
          employeeId: employee.id,
          title: measure.title,
          description: measure.description,
          weightPercent: measure.weightPercent,
          scorecardMeasureId: measure.id,
          sortOrder,
        })),
      });
    } else {
      await tx.performanceGoal.createMany({
        data: goalTemplates.map((goal, sortOrder) => ({
          organizationId: input.organizationId,
          cycleId: cycle.id,
          employeeId: employee.id,
          title: goal.title,
          description: goal.description ?? null,
          weightPercent: goal.weightPercent,
          sortOrder,
        })),
      });
    }

    void review;
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

export async function completeReviewCalibration(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; reviewId: string },
) {
  const review = await tx.performanceReview.findFirst({
    where: { id: input.reviewId, organizationId: input.organizationId },
  });
  if (!review) return { ok: false as const, error: 'Review not found' };
  if (review.status !== 'calibration_pending' && review.status !== 'manager_submitted') {
    return { ok: false as const, error: 'Review is not ready for calibration' };
  }

  const scores = await computeReviewScores(tx, review.id, input.organizationId);
  if (!scores?.finalBlendedScore) {
    return { ok: false as const, error: 'Cannot finalize — incomplete manager ratings' };
  }

  await tx.performanceReview.update({
    where: { id: review.id },
    data: {
      status: 'completed',
      completedAt: new Date(),
      calibratedAt: new Date(),
      finalResultsScore: scores.resultsScore,
      finalCompetenciesScore: scores.competenciesScore,
      finalBlendedScore: scores.finalBlendedScore,
      overallManagerRating: Math.round(scores.finalBlendedScore),
    },
  });

  return { ok: true as const, scores };
}
