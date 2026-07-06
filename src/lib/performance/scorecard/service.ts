import type { BscPerspective, Prisma } from '@prisma/client';

const PERSPECTIVE_ORDER: BscPerspective[] = [
  'financial',
  'customer',
  'internal_process',
  'learning_growth',
];

const jdForScorecardInclude = {
  kras: {
    orderBy: { sortOrder: 'asc' as const },
    include: { kpis: { orderBy: { sortOrder: 'asc' as const } } },
  },
  competencies: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.JobDescriptionInclude;

export async function generateScorecardFromJobDescription(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    jobDescriptionId: string;
    resultsWeightPercent?: number;
    competenciesWeightPercent?: number;
  },
) {
  const jd = await tx.jobDescription.findFirst({
    where: { id: input.jobDescriptionId, organizationId: input.organizationId },
    include: jdForScorecardInclude,
  });

  if (!jd) return { ok: false as const, error: 'Job description not found' };
  if (jd.status !== 'published') {
    return { ok: false as const, error: 'Scorecards can only be generated from published job descriptions' };
  }

  const existing = await tx.scorecardTemplate.findFirst({
    where: {
      organizationId: input.organizationId,
      jobDescriptionId: jd.id,
      jobDescriptionVersion: jd.version,
    },
  });
  if (existing) {
    return { ok: false as const, error: 'Scorecard template already exists for this JD version' };
  }

  const resultsWeight = input.resultsWeightPercent ?? 70;
  const competenciesWeight = input.competenciesWeightPercent ?? 30;

  const template = await tx.scorecardTemplate.create({
    data: {
      organizationId: input.organizationId,
      jobDescriptionId: jd.id,
      jobDescriptionVersion: jd.version,
      title: jd.title,
      grade: jd.grade,
      resultsWeightPercent: resultsWeight,
      competenciesWeightPercent: competenciesWeight,
      status: 'published',
    },
  });

  const perspectiveWeights = new Map<BscPerspective, number>();
  for (const kra of jd.kras) {
    const p = kra.bscPerspective ?? 'internal_process';
    perspectiveWeights.set(p, (perspectiveWeights.get(p) ?? 0) + kra.weightPercent);
  }

  const perspectiveRows = new Map<BscPerspective, string>();
  for (const [index, perspective] of PERSPECTIVE_ORDER.entries()) {
    const weight = perspectiveWeights.get(perspective);
    if (!weight) continue;
    const row = await tx.scorecardPerspective.create({
      data: {
        organizationId: input.organizationId,
        templateId: template.id,
        perspective,
        weightPercent: weight,
        sortOrder: index,
      },
    });
    perspectiveRows.set(perspective, row.id);
  }

  for (const kra of jd.kras) {
    const perspectiveId = perspectiveRows.get(kra.bscPerspective ?? 'internal_process') ?? null;
    for (const kpi of kra.kpis) {
      await tx.scorecardMeasure.create({
        data: {
          organizationId: input.organizationId,
          templateId: template.id,
          perspectiveId,
          jobKpiId: kpi.id,
          title: kpi.name,
          description: kpi.description,
          targetValue: kpi.targetValue,
          unit: kpi.unit,
          weightPercent: kpi.weightPercent,
          sourceType: 'manual',
          sortOrder: kpi.sortOrder,
        },
      });
    }
  }

  for (const competency of jd.competencies) {
    await tx.competencyRequirement.create({
      data: {
        organizationId: input.organizationId,
        templateId: template.id,
        jobCompetencyId: competency.id,
        name: competency.name,
        description: competency.description,
        requiredLevel: competency.requiredLevel,
        sortOrder: competency.sortOrder,
      },
    });
  }

  const full = await tx.scorecardTemplate.findFirstOrThrow({
    where: { id: template.id },
    include: {
      perspectives: { orderBy: { sortOrder: 'asc' } },
      measures: { orderBy: { sortOrder: 'asc' } },
      competencyReqs: { orderBy: { sortOrder: 'asc' } },
      jobDescription: { select: { id: true, version: true, title: true } },
    },
  });

  return { ok: true as const, template: full };
}

export function serializeScorecardTemplate(
  template: Prisma.ScorecardTemplateGetPayload<{
    include: {
      perspectives: true;
      measures: true;
      competencyReqs: true;
      jobDescription: { select: { id: true; version: true; title: true } };
    };
  }>,
) {
  return {
    id: template.id,
    title: template.title,
    grade: template.grade,
    jobDescriptionId: template.jobDescriptionId,
    jobDescriptionVersion: template.jobDescriptionVersion,
    resultsWeightPercent: template.resultsWeightPercent,
    competenciesWeightPercent: template.competenciesWeightPercent,
    perspectiveCount: template.perspectives.length,
    measureCount: template.measures.length,
    competencyCount: template.competencyReqs.length,
    jobDescription: template.jobDescription,
  };
}
