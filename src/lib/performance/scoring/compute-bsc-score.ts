import type { Prisma } from '@prisma/client';

export type FrozenScorecardSnapshot = {
  templateId: string;
  jobDescriptionId: string;
  jobDescriptionVersion: number;
  title: string;
  grade: string | null;
  resultsWeightPercent: number;
  competenciesWeightPercent: number;
  measures: Array<{
    id: string;
    title: string;
    targetValue: string | null;
    unit: string | null;
    weightPercent: number;
    kpiSourceKey: string | null;
  }>;
  competencies: Array<{
    id: string;
    name: string;
    requiredLevel: number;
    weightPercent: number;
  }>;
};

export function computeWeightedAverage(
  items: Array<{ score: number | null | undefined; weightPercent: number }>,
): number | null {
  let totalWeight = 0;
  let weighted = 0;
  for (const item of items) {
    if (item.score == null) continue;
    totalWeight += item.weightPercent;
    weighted += item.score * item.weightPercent;
  }
  if (totalWeight === 0) return null;
  return Math.round((weighted / totalWeight) * 100) / 100;
}

export function computeBscFinalScore(input: {
  resultsScore: number | null;
  competenciesScore: number | null;
  resultsWeightPercent: number;
  competenciesWeightPercent: number;
}): number | null {
  if (input.resultsScore == null || input.competenciesScore == null) return null;
  const total = input.resultsWeightPercent + input.competenciesWeightPercent;
  if (total === 0) return null;
  const blended =
    (input.resultsScore * input.resultsWeightPercent +
      input.competenciesScore * input.competenciesWeightPercent) /
    total;
  return Math.round(blended * 100) / 100;
}

export function buildFrozenSnapshot(
  template: Prisma.ScorecardTemplateGetPayload<{
    include: { measures: true; competencyReqs: true };
  }>,
): FrozenScorecardSnapshot {
  return {
    templateId: template.id,
    jobDescriptionId: template.jobDescriptionId,
    jobDescriptionVersion: template.jobDescriptionVersion,
    title: template.title,
    grade: template.grade,
    resultsWeightPercent: template.resultsWeightPercent,
    competenciesWeightPercent: template.competenciesWeightPercent,
    measures: template.measures.map((m) => ({
      id: m.id,
      title: m.title,
      targetValue: m.targetValue,
      unit: m.unit,
      weightPercent: m.weightPercent,
      kpiSourceKey: m.kpiSourceKey,
    })),
    competencies: template.competencyReqs.map((c) => ({
      id: c.id,
      name: c.name,
      requiredLevel: c.requiredLevel,
      weightPercent: Math.round(100 / Math.max(template.competencyReqs.length, 1)),
    })),
  };
}

export async function resolveScorecardForEmployee(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; jobTitle: string | null | undefined },
) {
  const title = input.jobTitle?.trim();
  if (!title) return null;

  const jd = await tx.jobDescription.findFirst({
    where: {
      organizationId: input.organizationId,
      status: 'published',
      title: { equals: title, mode: 'insensitive' },
    },
    orderBy: { version: 'desc' },
  });
  if (!jd) return null;

  const template = await tx.scorecardTemplate.findFirst({
    where: {
      organizationId: input.organizationId,
      jobDescriptionId: jd.id,
      jobDescriptionVersion: jd.version,
    },
    include: { measures: { orderBy: { sortOrder: 'asc' } }, competencyReqs: { orderBy: { sortOrder: 'asc' } } },
  });

  return template ? { jd, template } : null;
}

export async function computeReviewScores(
  tx: Prisma.TransactionClient,
  reviewId: string,
  organizationId: string,
) {
  const review = await tx.performanceReview.findFirst({
    where: { id: reviewId, organizationId },
    include: {
      cycle: true,
      ratings: true,
    },
  });
  if (!review) return null;

  // Goals are keyed by cycle + employee (no direct relation on PerformanceReview).
  const goals = await tx.performanceGoal.findMany({
    where: { organizationId, cycleId: review.cycleId, employeeId: review.employeeId },
  });

  const snapshot = review.frozenScorecardSnapshot as FrozenScorecardSnapshot | null;
  const resultsWeight = snapshot?.resultsWeightPercent ?? review.cycle.resultsWeightPercent;
  const competenciesWeight = snapshot?.competenciesWeightPercent ?? review.cycle.competenciesWeightPercent;

  const resultsScore = computeWeightedAverage(
    goals.map((g) => ({ score: g.managerScore ?? g.selfScore, weightPercent: g.weightPercent })),
  );
  const competenciesScore = computeWeightedAverage(
    review.ratings.map((r) => ({ score: r.managerScore ?? r.selfScore, weightPercent: 100 / Math.max(review.ratings.length, 1) })),
  );
  const finalBlendedScore = computeBscFinalScore({
    resultsScore,
    competenciesScore,
    resultsWeightPercent: resultsWeight,
    competenciesWeightPercent: competenciesWeight,
  });

  return {
    resultsScore,
    competenciesScore,
    finalBlendedScore,
    resultsWeight,
    competenciesWeight,
  };
}
