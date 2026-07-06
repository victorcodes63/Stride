import type { Prisma } from '@prisma/client';

import type {
  JobDescriptionDetailDto,
  JobDescriptionDto,
  JobDescriptionInput,
} from '@/lib/performance/jd/types';
import {
  allStabexJobDescriptionInputs,
  STABEX_DIVISIONS,
  STABEX_REFERENCE_PACK_NAME,
  STABEX_ROLE_TEMPLATES,
} from '@/lib/performance/jd/stabex-reference';

const jdInclude = {
  division: { select: { name: true } },
  kras: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      kpis: { orderBy: { sortOrder: 'asc' as const } },
    },
  },
  competencies: { orderBy: { sortOrder: 'asc' as const } },
  _count: { select: { kras: true, competencies: true } },
} satisfies Prisma.JobDescriptionInclude;

type JdRow = Prisma.JobDescriptionGetPayload<{ include: typeof jdInclude }>;

export function serializeJobDescription(row: JdRow): JobDescriptionDto {
  return {
    id: row.id,
    divisionId: row.divisionId,
    divisionName: row.division?.name ?? null,
    title: row.title,
    grade: row.grade,
    version: row.version,
    status: row.status,
    jobPurpose: row.jobPurpose,
    keyActivities: row.keyActivities,
    authorityScope: row.authorityScope,
    workingConditions: row.workingConditions,
    qualifications: row.qualifications,
    relationships: row.relationships,
    rootJobDescriptionId: row.rootJobDescriptionId,
    previousVersionId: row.previousVersionId,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    isReferencePack: row.isReferencePack,
    kraCount: row._count.kras,
    competencyCount: row._count.competencies,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeJobDescriptionDetail(row: JdRow): JobDescriptionDetailDto {
  const base = serializeJobDescription(row);
  return {
    ...base,
    kras: row.kras.map((kra) => ({
      id: kra.id,
      title: kra.title,
      description: kra.description,
      bscPerspective: kra.bscPerspective,
      weightPercent: kra.weightPercent,
      sortOrder: kra.sortOrder,
      kpis: kra.kpis.map((kpi) => ({
        id: kpi.id,
        name: kpi.name,
        description: kpi.description,
        targetValue: kpi.targetValue,
        unit: kpi.unit,
        weightPercent: kpi.weightPercent,
        sortOrder: kpi.sortOrder,
      })),
    })),
    competencies: row.competencies.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      requiredLevel: c.requiredLevel,
      sortOrder: c.sortOrder,
    })),
  };
}

function validateCompetencyLevels(input: JobDescriptionInput): string | null {
  for (const c of input.competencies ?? []) {
    if (c.requiredLevel < 1 || c.requiredLevel > 5) {
      return `Competency "${c.name}" requiredLevel must be between 1 and 5`;
    }
  }
  return null;
}

async function createJobDescriptionTree(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    data: JobDescriptionInput;
    createdByUserId?: string | null;
    status?: 'draft' | 'published';
  },
) {
  const validationError = validateCompetencyLevels(input.data);
  if (validationError) return { ok: false as const, error: validationError };

  const jd = await tx.jobDescription.create({
    data: {
      organizationId: input.organizationId,
      divisionId: input.data.divisionId ?? null,
      title: input.data.title.trim(),
      grade: input.data.grade?.trim() || null,
      status: input.status ?? 'draft',
      jobPurpose: input.data.jobPurpose ?? null,
      keyActivities: input.data.keyActivities ?? null,
      authorityScope: input.data.authorityScope ?? null,
      workingConditions: input.data.workingConditions ?? null,
      qualifications: input.data.qualifications ?? null,
      relationships: input.data.relationships ?? null,
      isReferencePack: input.data.isReferencePack ?? false,
      createdByUserId: input.createdByUserId ?? null,
      publishedAt: input.status === 'published' ? new Date() : null,
      rootJobDescriptionId: null,
    },
  });

  await tx.jobDescription.update({
    where: { id: jd.id },
    data: { rootJobDescriptionId: jd.id },
  });

  for (const [kraIndex, kra] of (input.data.kras ?? []).entries()) {
    const createdKra = await tx.jobKRA.create({
      data: {
        organizationId: input.organizationId,
        jobDescriptionId: jd.id,
        title: kra.title.trim(),
        description: kra.description ?? null,
        bscPerspective: kra.bscPerspective ?? null,
        weightPercent: kra.weightPercent ?? 25,
        sortOrder: kra.sortOrder ?? kraIndex,
      },
    });

    for (const [kpiIndex, kpi] of (kra.kpis ?? []).entries()) {
      await tx.jobKPI.create({
        data: {
          organizationId: input.organizationId,
          jobDescriptionId: jd.id,
          jobKraId: createdKra.id,
          name: kpi.name.trim(),
          description: kpi.description ?? null,
          targetValue: kpi.targetValue ?? null,
          unit: kpi.unit ?? null,
          weightPercent: kpi.weightPercent ?? 25,
          sortOrder: kpi.sortOrder ?? kpiIndex,
        },
      });
    }
  }

  for (const [index, competency] of (input.data.competencies ?? []).entries()) {
    await tx.jobCompetency.create({
      data: {
        organizationId: input.organizationId,
        jobDescriptionId: jd.id,
        name: competency.name.trim(),
        description: competency.description ?? null,
        requiredLevel: competency.requiredLevel,
        sortOrder: competency.sortOrder ?? index,
      },
    });
  }

  const full = await tx.jobDescription.findFirstOrThrow({
    where: { id: jd.id },
    include: jdInclude,
  });

  return { ok: true as const, jobDescription: full };
}

export async function createJobDescriptionManual(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    data: JobDescriptionInput;
    createdByUserId?: string | null;
  },
) {
  return createJobDescriptionTree(tx, { ...input, status: 'draft' });
}

export async function updateJobDescriptionDraft(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    jobDescriptionId: string;
    data: JobDescriptionInput;
  },
) {
  const existing = await tx.jobDescription.findFirst({
    where: { id: input.jobDescriptionId, organizationId: input.organizationId },
  });
  if (!existing) return { ok: false as const, error: 'Job description not found' };
  if (existing.status !== 'draft') {
    return { ok: false as const, error: 'Only draft job descriptions can be edited' };
  }

  const validationError = validateCompetencyLevels(input.data);
  if (validationError) return { ok: false as const, error: validationError };

  await tx.jobKPI.deleteMany({
    where: { jobDescriptionId: existing.id, organizationId: input.organizationId },
  });
  await tx.jobKRA.deleteMany({
    where: { jobDescriptionId: existing.id, organizationId: input.organizationId },
  });
  await tx.jobCompetency.deleteMany({
    where: { jobDescriptionId: existing.id, organizationId: input.organizationId },
  });

  await tx.jobDescription.update({
    where: { id: existing.id },
    data: {
      divisionId: input.data.divisionId ?? null,
      title: input.data.title.trim(),
      grade: input.data.grade?.trim() || null,
      jobPurpose: input.data.jobPurpose ?? null,
      keyActivities: input.data.keyActivities ?? null,
      authorityScope: input.data.authorityScope ?? null,
      workingConditions: input.data.workingConditions ?? null,
      qualifications: input.data.qualifications ?? null,
      relationships: input.data.relationships ?? null,
    },
  });

  for (const [kraIndex, kra] of (input.data.kras ?? []).entries()) {
    const createdKra = await tx.jobKRA.create({
      data: {
        organizationId: input.organizationId,
        jobDescriptionId: existing.id,
        title: kra.title.trim(),
        description: kra.description ?? null,
        bscPerspective: kra.bscPerspective ?? null,
        weightPercent: kra.weightPercent ?? 25,
        sortOrder: kra.sortOrder ?? kraIndex,
      },
    });

    for (const [kpiIndex, kpi] of (kra.kpis ?? []).entries()) {
      await tx.jobKPI.create({
        data: {
          organizationId: input.organizationId,
          jobDescriptionId: existing.id,
          jobKraId: createdKra.id,
          name: kpi.name.trim(),
          description: kpi.description ?? null,
          targetValue: kpi.targetValue ?? null,
          unit: kpi.unit ?? null,
          weightPercent: kpi.weightPercent ?? 25,
          sortOrder: kpi.sortOrder ?? kpiIndex,
        },
      });
    }
  }

  for (const [index, competency] of (input.data.competencies ?? []).entries()) {
    await tx.jobCompetency.create({
      data: {
        organizationId: input.organizationId,
        jobDescriptionId: existing.id,
        name: competency.name.trim(),
        description: competency.description ?? null,
        requiredLevel: competency.requiredLevel,
        sortOrder: competency.sortOrder ?? index,
      },
    });
  }

  const full = await tx.jobDescription.findFirstOrThrow({
    where: { id: existing.id },
    include: jdInclude,
  });

  return { ok: true as const, jobDescription: full };
}

export async function publishJobDescription(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; jobDescriptionId: string },
) {
  const existing = await tx.jobDescription.findFirst({
    where: { id: input.jobDescriptionId, organizationId: input.organizationId },
    include: { _count: { select: { kras: true, competencies: true } } },
  });
  if (!existing) return { ok: false as const, error: 'Job description not found' };
  if (existing.status !== 'draft') {
    return { ok: false as const, error: 'Only draft job descriptions can be published' };
  }
  if (existing._count.kras === 0 || existing._count.competencies === 0) {
    return { ok: false as const, error: 'Publish requires at least one KRA and one competency' };
  }

  const updated = await tx.jobDescription.update({
    where: { id: existing.id },
    data: { status: 'published', publishedAt: new Date() },
    include: jdInclude,
  });

  return { ok: true as const, jobDescription: updated };
}

export async function importStabexReferencePack(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; createdByUserId?: string | null; replaceExisting?: boolean },
) {
  if (input.replaceExisting) {
    const existing = await tx.jobDescription.findMany({
      where: { organizationId: input.organizationId, isReferencePack: true },
      select: { id: true },
    });
    if (existing.length > 0) {
      await tx.jobKPI.deleteMany({
        where: { organizationId: input.organizationId, jobDescriptionId: { in: existing.map((e) => e.id) } },
      });
      await tx.jobKRA.deleteMany({
        where: { organizationId: input.organizationId, jobDescriptionId: { in: existing.map((e) => e.id) } },
      });
      await tx.jobCompetency.deleteMany({
        where: { organizationId: input.organizationId, jobDescriptionId: { in: existing.map((e) => e.id) } },
      });
      await tx.jobDescription.deleteMany({
        where: { organizationId: input.organizationId, isReferencePack: true },
      });
      await tx.jdDivision.deleteMany({
        where: { organizationId: input.organizationId, isReferencePack: true },
      });
    }
  } else {
    const count = await tx.jobDescription.count({
      where: { organizationId: input.organizationId, isReferencePack: true },
    });
    if (count > 0) {
      return { ok: false as const, error: 'Stabex reference pack already imported for this organization' };
    }
  }

  const divisionMap = new Map<string, string>();
  for (const [index, name] of STABEX_DIVISIONS.entries()) {
    const division = await tx.jdDivision.create({
      data: {
        organizationId: input.organizationId,
        name,
        sortOrder: index,
        isReferencePack: true,
      },
    });
    divisionMap.set(name, division.id);
  }

  const templates = allStabexJobDescriptionInputs();
  let created = 0;

  for (let i = 0; i < templates.length; i += 1) {
    const template = templates[i];
    const roleMeta = STABEX_ROLE_TEMPLATES[i];
    const divisionId = roleMeta ? divisionMap.get(roleMeta.division) ?? null : null;

    const result = await createJobDescriptionTree(tx, {
      organizationId: input.organizationId,
      createdByUserId: input.createdByUserId,
      status: 'published',
      data: {
        ...template,
        divisionId,
      },
    });
    if (!result.ok) return result;
    created += 1;
  }

  return {
    ok: true as const,
    packName: STABEX_REFERENCE_PACK_NAME,
    divisionCount: STABEX_DIVISIONS.length,
    roleCount: created,
  };
}

export async function ensureJdParserConfigManual(
  tx: Prisma.TransactionClient,
  organizationId: string,
) {
  return tx.jdParserConfig.upsert({
    where: { organizationId },
    create: { organizationId, mode: 'manual' },
    update: {},
  });
}
