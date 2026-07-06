import type { Prisma } from '@prisma/client';

import type { PerformanceObjectiveLevel } from '@prisma/client';

export type ObjectiveInput = {
  cycleId?: string | null;
  parentObjectiveId?: string | null;
  level: PerformanceObjectiveLevel;
  divisionId?: string | null;
  jobDescriptionId?: string | null;
  employeeId?: string | null;
  title: string;
  description?: string | null;
  weightPercent?: number;
  sortOrder?: number;
};

export async function listObjectiveTree(
  tx: Prisma.TransactionClient,
  organizationId: string,
  cycleId?: string | null,
) {
  return tx.performanceObjective.findMany({
    where: {
      organizationId,
      ...(cycleId ? { cycleId } : {}),
    },
    include: {
      children: { orderBy: { sortOrder: 'asc' } },
      division: { select: { name: true } },
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
  });
}

export async function createObjective(
  tx: Prisma.TransactionClient,
  organizationId: string,
  input: ObjectiveInput,
) {
  if (input.parentObjectiveId) {
    const parent = await tx.performanceObjective.findFirst({
      where: { id: input.parentObjectiveId, organizationId },
    });
    if (!parent) throw new Error('Parent objective not found');
  }

  return tx.performanceObjective.create({
    data: {
      organizationId,
      cycleId: input.cycleId ?? null,
      parentObjectiveId: input.parentObjectiveId ?? null,
      level: input.level,
      divisionId: input.divisionId ?? null,
      jobDescriptionId: input.jobDescriptionId ?? null,
      employeeId: input.employeeId ?? null,
      title: input.title.trim(),
      description: input.description ?? null,
      weightPercent: input.weightPercent ?? 100,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function seedDefaultCompetencyFramework(
  tx: Prisma.TransactionClient,
  organizationId: string,
) {
  const existing = await tx.competencyFramework.findFirst({
    where: { organizationId, isDefault: true },
  });
  if (existing) return existing;

  const framework = await tx.competencyFramework.create({
    data: {
      organizationId,
      name: 'Stride Core Competencies',
      description: 'Reusable proficiency framework (1–5) for BSC behavioural measures.',
      isDefault: true,
    },
  });

  const entries = [
    ['Communication', 'Articulates clearly with stakeholders at all levels.'],
    ['Teamwork', 'Collaborates across functions to deliver shared outcomes.'],
    ['Problem solving', 'Identifies root causes and proposes practical solutions.'],
    ['Accountability', 'Owns commitments and follows through on deadlines.'],
    ['Customer focus', 'Anticipates internal and external customer needs.'],
  ] as const;

  await tx.competencyFrameworkEntry.createMany({
    data: entries.map(([name, description], index) => ({
      organizationId,
      frameworkId: framework.id,
      name,
      description,
      level1Descriptor: `Emerging ${name.toLowerCase()}`,
      level3Descriptor: `Proficient ${name.toLowerCase()}`,
      level5Descriptor: `Role-model ${name.toLowerCase()}`,
      sortOrder: index,
    })),
  });

  return framework;
}
